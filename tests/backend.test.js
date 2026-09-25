import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { SQLiteStore } from '../server/sqlite.js';
import { validateLead } from '../server/domain.js';
import { hash, requireAdmin, sessionCookie } from '../server/http.js';
import { dispatch } from '../server/automation.js';

const sample={name:'Pessoa Teste',phone:'79999990000',preferred_date:'2026-10-05',period:'manha',consent:true};
const payload=()=>({key:randomUUID(),lead:{...sample},fingerprint:hash(JSON.stringify(sample))});
test('validação: normaliza telefone, recusa dados inválidos, domingo e sábado à tarde',()=>{
  const now=new Date('2026-09-25T12:00:00Z');
  assert.equal(validateLead({...sample,phone:'(79) 99999-0000'},now).phone,'79999990000');
  for(const changes of [{consent:false},{phone:'123'},{preferred_date:'2026-02-30'},{preferred_date:'2026-10-04'},{preferred_date:'2026-10-03',period:'tarde'},{website:'bot'},{name:'X'},{period:'noite'},{preferred_date:'2027-10-05'}])assert.throws(()=>validateLead({...sample,...changes},now));
});
export async function contract(store) {
  const p=payload(); const lead=await store.rpc('create',p);
  assert.equal(lead.status,'novo');
  assert.equal((await store.rpc('create',p)).id,lead.id);
  await assert.rejects(store.rpc('create',{...p,fingerprint:'different'}));
  assert.equal((await store.rpc('list')).length,1);
  assert.equal((await store.rpc('events',{id:lead.id})).length,1);
  await assert.rejects(store.rpc('update',{id:lead.id,status:'agendado',version:1}));
  const updated=await store.rpc('update',{id:lead.id,status:'em_contato',version:1});
  assert.equal(updated.version,2);
  await assert.rejects(store.rpc('update',{id:lead.id,status:'cancelado',version:1}));
  await store.rpc('update',{id:lead.id,status:'agendado',version:2});
  assert.equal((await store.rpc('events',{id:lead.id})).length,3);
  assert.equal(await store.rpc('rate',{key:'ip',limit:1,window_ms:10000}),true);
  assert.equal(await store.rpc('rate',{key:'ip',limit:1,window_ms:10000}),false);
  const claimed=await store.rpc('claim');assert.ok(claimed.id);
  const claimed2=await store.rpc('claim');assert.notEqual(claimed.id,claimed2.id);
  await store.rpc('finish',{id:claimed.id,ok:true,attempts:1});
  assert.ok((await store.rpc('queue')).find(e=>e.id===claimed.id).delivered);
}
test('SQLite: persistência, idempotência, transações, histórico, concorrência e fila',async()=>{
  const store=new SQLiteStore(':memory:');try{await contract(store);}finally{store.db.close();}
});
test('automação preserva falhas e não transmite nome/telefone',async()=>{
  const store=new SQLiteStore(':memory:');await store.rpc('create',payload());
  process.env.N8N_WEBHOOK_URL='https://example.test/webhook';process.env.N8N_WEBHOOK_SECRET='test-only';
  try{
    const first=await dispatch(store,async()=>{throw new Error('network');});assert.equal(first.delivered,false);
    assert.equal((await store.rpc('queue'))[0].delivered,0);
    await store.rpc('retry');
    const second=await dispatch(store,async(url,options)=>{const data=JSON.parse(options.body);assert.equal(data.name,undefined);assert.equal(data.phone,undefined);assert.equal(options.headers['Idempotency-Key'],data.event_id);return{ok:true};});
    assert.equal(second.delivered,true);
  }finally{delete process.env.N8N_WEBHOOK_URL;delete process.env.N8N_WEBHOOK_SECRET;store.db.close();}
});
test('sessões: cookie válido, adulterado e expirado',()=>{
  process.env.ADMIN_PASSWORD='test-password-long-enough';process.env.SESSION_SECRET='test-session-secret-at-least-32-characters';process.env.APP_ORIGIN='http://localhost:3000';
  const cookie=sessionCookie().split(';')[0];
  assert.doesNotThrow(()=>requireAdmin({headers:{cookie}}));
  assert.throws(()=>requireAdmin({headers:{cookie:cookie+'x'}}));
  assert.throws(()=>requireAdmin({headers:{cookie:'clinic_session=1000000000000.fake'}}));
});
test('HTTP: bloqueia visitantes, origem externa e payload inválido; login, criar, atualizar e sair',async()=>{
  process.env.STORAGE_DRIVER='sqlite';process.env.SQLITE_PATH=':memory:';
  process.env.APP_ORIGIN='http://localhost:3000';
  const handlers={};for(const name of ['leads','session','health','events'])handlers['/api/'+name]=(await import('../api/'+name+'.js')).default;
  const server=createServer((req,res)=>handlers[new URL(req.url,'http://localhost').pathname](req,res));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  const request=(path,method='GET',data,cookie,origin='http://localhost:3000')=>fetch(url+'/api/'+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{}),'Idempotency-Key':'test-request-00000001'},body:data?JSON.stringify(data):undefined});
  try{
    assert.equal((await request('leads')).status,401);
    assert.equal((await request('leads','POST',sample,null,'https://evil.test')).status,403);
    assert.equal((await request('session','POST',{password:'wrong'})).status,401);
    const login=await request('session','POST',{password:process.env.ADMIN_PASSWORD});assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const future=new Date(Date.now()+7*86400000);while(future.getUTCDay()===0)future.setUTCDate(future.getUTCDate()+1);
    const input={...sample,preferred_date:future.toISOString().slice(0,10)};
    const created=await request('leads','POST',input);assert.equal(created.status,201);const lead=await created.json();
    assert.equal((await request('leads','POST',input)).status,201);
    const list=await(await request('leads','GET',null,cookie)).json();assert.equal(list.leads.length,1);
    assert.equal((await request('leads','PATCH',{id:lead.id,status:'em_contato',version:1})).status,401);
    assert.equal((await request('leads','PATCH',{id:lead.id,status:'em_contato',version:1},cookie)).status,200);
    const logout=await request('session','DELETE',null,cookie);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
