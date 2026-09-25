const $ = s => document.querySelector(s);
const labels = { novo:'Novo',em_contato:'Em contato',agendado:'Agendado',cancelado:'Cancelado' };
const transitions = { novo:['em_contato','cancelado'], em_contato:['agendado','cancelado'], agendado:['cancelado'], cancelado:[] };
let leads = [], offset = 0;
async function api(path, method = 'GET', data) {
  const response = await fetch('/api/' + path,{method,headers:data ? {'Content-Type':'application/json'} : {},body:data ? JSON.stringify(data) : undefined});
  const result = await response.json();
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(result.error || 'Falha na comunicação.');
  }
  return result;
}
function message(text,error=false){$('#status-message').textContent=text;$('#status-message').className=error?'error':'success';}
function showLogin(){leads=[];$('#leads').replaceChildren();$('#stats').replaceChildren();$('#queue').replaceChildren();$('#history-items').replaceChildren();$('#history').close();$('#workspace').hidden=true;$('#login').hidden=false;$('#logout').hidden=true;}
function node(tag,text,className){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;if(className)element.className=className;return element;}
function render(){
  $('#stats').replaceChildren(...Object.keys(labels).map(status=>{const el=node('div',undefined,'stat');el.append(node('strong',leads.filter(l=>l.status===status).length),node('span',labels[status]+' nesta página'));return el;}));
  const query=$('#search').value.toLowerCase();
  const filtered=leads.filter(l=>(!$('#filter').value||l.status===$('#filter').value)&&`${l.name} ${l.phone}`.toLowerCase().includes(query));
  $('#leads').replaceChildren(...filtered.map(lead=>{
    const row=node('tr');const person=node('td');person.append(node('strong',lead.name),node('small',lead.phone),node('small','Protocolo '+lead.id.slice(0,8)));
    const date=node('td',lead.preferred_date.split('-').reverse().join('/'));date.append(node('small',lead.period==='manha'?'Manhã':'Tarde'));
    const status=node('td');status.append(node('span',labels[lead.status],'pill '+lead.status));
    const action=node('td');
    if(transitions[lead.status].length){const select=node('select');select.setAttribute('aria-label','Alterar status de '+lead.name);const placeholder=node('option','Alterar status…');placeholder.value='';select.append(placeholder);transitions[lead.status].forEach(value=>{const option=node('option',labels[value]);option.value=value;select.append(option);});select.addEventListener('change',async()=>{if(!select.value)return;select.disabled=true;try{await api('leads','PATCH',{id:lead.id,status:select.value,version:lead.version});await load();message('Status atualizado e registrado no histórico.');}catch(error){message(error.message,true);select.value='';select.disabled=false;}});action.append(select);}else action.textContent='Encerrado';
    const history=node('td');const button=node('button','Ver','btn light');button.addEventListener('click',async()=>{try{const result=await api('events?id='+encodeURIComponent(lead.id));$('#history-items').replaceChildren(...result.events.map(e=>node('li',`${new Date(e.created_at).toLocaleString('pt-BR')} · ${labels[e.status]}`)));$('#history').showModal();}catch(error){message(error.message,true);}});history.append(button);row.append(person,date,status,action,history);return row;
  }));
  $('#empty').hidden=filtered.length>0;$('#previous').disabled=offset===0;$('#next').disabled=leads.length<100;$('#page-label').textContent='Página '+(offset/100+1);
}
async function load(){
  const result=await api('leads?offset='+offset);leads=result.leads;
  $('#workspace').hidden=false;$('#login').hidden=true;$('#logout').hidden=false;render();
  const queue=await api('automations');$('#automation-status').textContent=queue.configured?'Integração configurada. Eventos pendentes são enviados nas operações e podem ser reprocessados aqui.':'n8n ainda não conectado. Os eventos ficam salvos no banco, aguardando configuração.';
  $('#process').disabled=!queue.configured;$('#retry').disabled=!queue.configured;
  $('#queue').replaceChildren(...queue.events.slice(0,10).map(e=>node('li',`${e.id.slice(0,8)} · ${e.delivered?'Entregue':e.attempts>=5?'Requer nova tentativa':'Pendente'} · ${e.attempts} tentativa(s)`)));
}
$('#login-form').addEventListener('submit',async event=>{event.preventDefault();const button=event.submitter;button.disabled=true;try{await api('session','POST',{password:$('#password').value});$('#password').value='';await load();message('Acesso autorizado.');}catch(error){message(error.message,true);}finally{button.disabled=false;}});
$('#logout').addEventListener('click',async()=>{try{await api('session','DELETE');showLogin();message('Você saiu do painel.');}catch(error){message(error.message,true);}});
$('#close-history').addEventListener('click',()=>$('#history').close());
$('#search').addEventListener('input',render);$('#filter').addEventListener('change',render);
$('#refresh').addEventListener('click',()=>load().catch(e=>message(e.message,true)));
for(const [id,delta]of [['previous',-100],['next',100]])$('#'+id).addEventListener('click',()=>{offset=Math.max(0,offset+delta);load().catch(e=>message(e.message,true));});
for(const id of ['process','retry'])$('#'+id).addEventListener('click',async()=>{const button=$('#'+id);button.disabled=true;try{const result=await api('automations','POST',{retry:id==='retry'});await load();message(result.delivered?'Evento entregue.':result.processed?'Falha no envio. Evento preservado para nova tentativa.':'Nenhum evento disponível agora.');}catch(error){message(error.message,true);}finally{button.disabled=false;}});
api('session').then(load).catch(error=>{if(!error.message.includes('Entre no painel'))message(error.message,true);});
