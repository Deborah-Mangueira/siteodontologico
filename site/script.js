document.querySelector('.menu-toggle').addEventListener('click',function(){const open=document.querySelector('.header nav').classList.toggle('open');this.setAttribute('aria-expanded',open);});
document.querySelectorAll('.header nav a').forEach(a=>a.addEventListener('click',()=>{document.querySelector('.header nav').classList.remove('open');document.querySelector('.menu-toggle').setAttribute('aria-expanded','false');}));
// Configure o número real, com país e DDD, para ativar o WhatsApp.
const WHATSAPP_NUMBER = '';
const booking=document.querySelector('#booking');
document.querySelectorAll('[data-book]').forEach(button=>button.addEventListener('click',()=>{if(WHATSAPP_NUMBER){window.open('https://wa.me/'+WHATSAPP_NUMBER+'?text='+encodeURIComponent('Olá! Gostaria de agendar uma avaliação.'),'_blank','noopener');}else{booking.showModal();}}));
document.querySelectorAll('.dialog-close,.dialog-ok').forEach(b=>b.addEventListener('click',()=>booking.close()));
booking.addEventListener('click',e=>{if(e.target===booking){const r=booking.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)booking.close();}});
document.querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)document.querySelectorAll('details').forEach(other=>{if(other!==d)other.open=false;});}));
const treatments=[['Reposição da raiz e da coroa, com planejamento digital antes da cirurgia.','4 a 6 meses','4','2 a 3 dias',22,63],['Alinhamento dos dentes, com acompanhamento em cada etapa do tratamento.','12 a 24 meses','Mensais','Rotina habitual',85,12],['Um sorriso mais luminoso, com orientação e acompanhamento profissional.','2 a 4 semanas','2 a 3','Rotina habitual',18,8],['Cuidado com a parte interna do dente para preservar o seu sorriso.','1 a 3 semanas','2 a 3','1 a 2 dias',18,40],['Planejamento para recuperar a função e a naturalidade do sorriso.','1 a 2 meses','3 a 5','Adaptação gradual',32,50],['Um primeiro contato tranquilo com o cuidado dos dentes.','Conforme avaliação','Personalizadas','Rotina habitual',15,8]];
const selector=document.querySelector('#treatment');
selector.addEventListener('change',()=>{const d=treatments[selector.selectedIndex];['treatment-description','duration','appointments','recovery'].forEach((id,i)=>document.getElementById(id).textContent=d[i]);document.querySelector('#appointment-meter').style.width=d[4]+'%';document.querySelector('#recovery-meter').style.width=d[5]+'%';});
document.querySelectorAll('[data-treatment]').forEach(b=>b.addEventListener('click',()=>{selector.value=b.dataset.treatment;selector.dispatchEvent(new Event('change'));document.querySelector('#tratamentos').scrollIntoView({behavior:'smooth'});}));

// Scroll-driven animation: the section stays pinned while each card enters.
// The cards are animated on mobile too; no dependency or network is required.
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
const smooth=n=>n*n*(3-2*n);
// Full motion was explicitly requested for this replica. This changes only
// this page; the footer control can pause motion without changing the system.
let reducedMotion=false;
const motionToggle=document.querySelector('#motion-toggle');
motionToggle.addEventListener('click',()=>{reducedMotion=!reducedMotion;document.documentElement.classList.toggle('motion-paused',reducedMotion);motionToggle.setAttribute('aria-pressed',String(reducedMotion));motionToggle.textContent=reducedMotion?'Ativar animações':'Pausar animações';scheduleMotion();});
const section=document.querySelector('.testimonials');
const cards=[...document.querySelectorAll('.quote')];
const reveals=[...document.querySelectorAll('.reveal')];
const hero=document.querySelector('.hero');
const photo=document.querySelector('.hero-photo');
const badges=[...document.querySelectorAll('.hero-badge')];
const stats=[...document.querySelectorAll('[data-count]')];
const offsets=[-8,5,-1,-4];
let ticking=false;
document.documentElement.classList.add('motion-ready');
function renderMotion(){
 ticking=false;
 const vh=innerHeight,mobile=innerWidth<=720;
 const r=section.getBoundingClientRect();
 const travel=section.offsetHeight-section.querySelector('.testimonials-sticky').offsetHeight;
 const progress=clamp(-r.top/Math.max(1,travel));
 const stage=section.querySelector('.cards');
 const stageWidth=stage.clientWidth,cardWidth=cards[0].offsetWidth;
 cards.forEach((card,i)=>{
  const start=.035+i*.205;
  const p=smooth(clamp((progress-start)/.16));
  const x=mobile?(stageWidth-cardWidth)/2+i*4:i*(stageWidth-cardWidth)/3;
  const y=(1-p)*(reducedMotion?25:Math.min(vh*.57,420))+(mobile?i*4:0);
  card.style.setProperty('--card-x',x+'px');
  card.style.setProperty('--card-y',y+'px');
  card.style.setProperty('--card-r',(offsets[i]+(1-p)*(reducedMotion?0:24))+'deg');
  card.style.setProperty('--card-scale',.93+p*.07);
  card.style.setProperty('--card-opacity',p);
  card.style.pointerEvents=p>.95?'auto':'none';
 });
 reveals.forEach(el=>{
  const top=el.getBoundingClientRect().top-(parseFloat(el.style.getPropertyValue('--reveal-y'))||0);
  const p=smooth(clamp((vh*.96-top)/(vh*.32)));
  el.style.setProperty('--reveal-opacity',p);
  el.style.setProperty('--reveal-blur',(1-p)*(reducedMotion?0:10)+'px');
  el.style.setProperty('--reveal-y',(1-p)*(reducedMotion?10:65)+'px');
  el.classList.toggle('is-revealed',p===1);
 });
 const scroll=clamp(-hero.getBoundingClientRect().top,0,hero.offsetHeight);
 photo.style.setProperty('--portrait-y',scroll*(reducedMotion?.025:.1)+'px');
 photo.style.setProperty('--portrait-scale',1+clamp(scroll/hero.offsetHeight)*.055);
 photo.style.setProperty('--halo-scale',1+clamp(scroll/hero.offsetHeight)*.15);
 hero.style.setProperty('--gradient-y',scroll*.13+'px');
 badges.forEach((b,i)=>b.style.setProperty('--badge-y',scroll*[-.05,.035,-.025][i]+'px'));
 stats.forEach(el=>{
  const rect=el.getBoundingClientRect();
  if(rect.top<vh*.92&&rect.bottom>0&&!el.dataset.started){
   el.dataset.started='true';const end=+el.dataset.count,start=performance.now();
   function tick(now){const p=clamp((now-start)/1700),n=Math.round(end*(1-Math.pow(1-p,3)));el.textContent=n.toLocaleString('pt-BR')+(end>=15?'+':'');if(p<1)requestAnimationFrame(tick);}requestAnimationFrame(tick);
  }
 });
}
function scheduleMotion(){if(!ticking){ticking=true;requestAnimationFrame(renderMotion);}}
addEventListener('scroll',scheduleMotion,{passive:true});
addEventListener('resize',scheduleMotion);
addEventListener('load',scheduleMotion);
document.fonts.ready.then(scheduleMotion);
document.querySelectorAll('details').forEach(el=>el.addEventListener('toggle',scheduleMotion));
renderMotion();

