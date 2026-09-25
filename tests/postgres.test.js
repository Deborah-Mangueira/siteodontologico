import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('migração PostgreSQL: permissões, idempotência, histórico, transições e outbox',async()=>{
  const db=new PGlite();
  try{
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
    await db.exec(await readFile(new URL('../supabase/migrations/001_clinic.sql',import.meta.url),'utf8'));
    const rpc=async(action,payload={})=>{
      const result=(await db.query('SELECT public.clinic_action($1,$2::jsonb) AS result',[action,JSON.stringify(payload)])).rows[0].result;
      if(result?.error)throw new Error(result.error);return result;
    };
    const p={key:'postgres-test-key',fingerprint:'abc',lead:{name:'Teste SQL',phone:'79999990000',preferred_date:'2026-10-05',period:'manha',consent:true}};
    const lead=await rpc('create',p);
    assert.equal((await rpc('create',p)).id,lead.id);
    await assert.rejects(rpc('create',{...p,fingerprint:'changed'}));
    assert.equal((await rpc('list')).length,1);
    assert.equal(lead.fingerprint,undefined);
    await assert.rejects(rpc('update',{id:lead.id,status:'agendado',version:1}));
    assert.equal((await rpc('update',{id:lead.id,status:'em_contato',version:1})).version,2);
    await assert.rejects(rpc('update',{id:lead.id,status:'cancelado',version:1}));
    assert.equal((await rpc('events',{id:lead.id})).length,2);
    const first=await rpc('claim');const second=await rpc('claim');assert.notEqual(first.id,second.id);
    assert.equal(await rpc('claim'),null);
    await rpc('finish',{id:first.id,ok:true,attempts:1});
    await rpc('finish',{id:second.id,ok:false,attempts:1});
    await rpc('retry');assert.equal((await rpc('claim')).id,second.id);
    assert.equal(await rpc('rate',{key:'ip',limit:1,window_ms:900000}),true);
    assert.equal(await rpc('rate',{key:'ip',limit:1,window_ms:900000}),false);
    await db.exec('SET ROLE anon');
    await assert.rejects(db.query('SELECT * FROM public.clinic_leads'));
    await assert.rejects(db.query("SELECT public.clinic_action('list','{}')"));
    await db.exec('RESET ROLE; SET ROLE authenticated');
    await assert.rejects(db.query('SELECT * FROM public.clinic_leads'));
    await assert.rejects(db.query("SELECT public.clinic_action('list','{}')"));
    await db.exec('RESET ROLE; SET ROLE service_role');
    assert.equal((await rpc('list')).length,1);
  }finally{await db.close();}
});
