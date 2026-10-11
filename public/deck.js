/* ===== v4 deck layer: pointer depth, cursor, magnet, hold, radial, particles, HUD ===== */
(function(){
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
let RM=false;try{RM=localStorage.getItem('vault.motion')==='0'}catch{}
document.documentElement.classList.toggle('rm',RM);
const fine=matchMedia('(pointer:fine)').matches;
const frames=$$('.frame'),S=new Map(frames.map(f=>[f,{tx:0,ty:0,x:0,y:0,px:0,py:0,w:1,vis:false}]));
let mx=-999,my=-999;
const cr=document.createElement('div'),cd=document.createElement('div');cr.id='cr';cd.id='cd';
if(fine){document.body.append(cr,cd);document.body.classList.add('hascur')}

addEventListener('pointermove',e=>{mx=e.clientX;my=e.clientY;
  if(fine){const p=e.clientX+'px '+e.clientY+'px';cr.style.translate=p;cd.style.translate=p}
  let over=false;
  frames.forEach(f=>{const r=f.getBoundingClientRect(),s=S.get(f),ins=mx>=r.left&&mx<=r.right&&my>=r.top&&my<=r.bottom;
    if(ins){over=true;s.tx=(mx-r.left)/r.width*2-1;s.ty=(my-r.top)/r.height*2-1;s.px=mx-r.left;s.py=my-r.top;s.w=r.width}else{s.tx=0;s.ty=0}});
  document.body.classList.toggle('cur-on',fine&&over);
  magnet(e)},{passive:true});
function away(){document.body.classList.remove('cur-on');cr.classList.remove('hot');mx=my=-999;S.forEach(s=>{s.tx=0;s.ty=0});$$('.mag').forEach(m=>m.style.translate='')}
document.documentElement.addEventListener('mouseleave',away);addEventListener('blur',away);
document.addEventListener('visibilitychange',()=>{if(document.hidden)away()});
let fr=0;function probe(){if(mx<0)return;const el=document.elementFromPoint(mx,my),inF=!!(el&&el.closest('.frame'));
  document.body.classList.toggle('cur-on',fine&&inF);
  const hot=!!(el&&el.closest('button:not(:disabled),.mag button,.it,.rt'));cr.classList.toggle('hot',hot&&inF)}
addEventListener('scroll',probe,{passive:true});
window.addEventListener('vault-motion',e=>{RM=!e.detail?.enabled;document.documentElement.classList.toggle('rm',RM);if(RM){living.active=false;living.letters.forEach(letter=>{letter.glyph.style.transform='';letter.glyph.style.setProperty('--m',0)})}living.dirty=true});
window.addEventListener('storage',e=>{if(e.key==='vault.motion'){RM=e.newValue==='0';document.documentElement.classList.toggle('rm',RM)}});

/* magnetic buttons */
function magnet(e){$$('.mag').forEach(m=>{const r=m.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),d=Math.hypot(dx,dy);
  m.style.translate=d<150?(dx*.28).toFixed(1)+'px '+(dy*.28).toFixed(1)+'px':''})}

/* main loop: ease depth vars, cursor trail, readouts */
const xs=$$('[data-x]'),ys=$$('[data-y]');
(function loop(){requestAnimationFrame(loop);
  frames.forEach(f=>{const s=S.get(f);if(!s.vis)return;
    s.x+=(s.tx-s.x)*.07;s.y+=(s.ty-s.y)*.07;
    if(Math.abs(s.x-(s.px2||0))>.001||Math.abs(s.y-(s.py2||0))>.001){s.px2=s.x;s.py2=s.y;
      f.style.setProperty('--px',RM?0:s.x.toFixed(3));f.style.setProperty('--py',RM?0:s.y.toFixed(3));f.style.setProperty('--my',((s.y+1)/2).toFixed(3))}
    if(f.id==='hero'){const X=String(Math.round((s.px/s.w)*1910)).padStart(4,'0'),Y=String(Math.round((s.py/s.w)*1910)).padStart(4,'0');
      xs.forEach(n=>n.textContent=X);ys.forEach(n=>n.textContent=Y)}});
  if(++fr%4===0)probe();
})();

/* page scroll progress -> rails */
function sp(){const m=Math.max(1,document.documentElement.scrollHeight-innerHeight);document.documentElement.style.setProperty('--sp',Math.min(1,scrollY/m).toFixed(3))}
addEventListener('scroll',sp,{passive:true});addEventListener('resize',sp);sp();

/* clock */
const clk=$$('.clk');(function t(){const d=new Date().toLocaleTimeString([], {hour12:false});clk.forEach(n=>n.textContent='T '+d);setTimeout(t,1000)})();
const rdo=$('#rdo'),say=t=>{if(rdo)rdo.textContent='> '+t};

/* hold to confirm */
const hold=$('#hold'),hlt=$('#hlt'),holdTime=$('#hold-time');let hraf=0,hp=0,holding=false;
function updateHoldTime(){if(holdTime)holdTime.textContent=Math.max(0,(1-hp)*1.2).toFixed(2)+' SEC'}
function hStart(){if(holding||hold.classList.contains('ok'))return;holding=true;hold.classList.add('prs');cancelAnimationFrame(hraf);const t0=performance.now()-hp*1200;say('charging…');
  (function f(now){if(!holding)return;hp=Math.min(1,(now-t0)/1200);hold.style.setProperty('--hp',hp);updateHoldTime();
    if(hp>=1){holding=false;hold.classList.remove('prs');hold.classList.add('ok');hlt.textContent='CONFIRMED';say('confirmed');setTimeout(()=>{hold.classList.remove('ok');hlt.textContent='HOLD TO CONFIRM';hp=0;hold.style.setProperty('--hp',0);updateHoldTime();say('idle')},1900)}
    else hraf=requestAnimationFrame(f)})(t0)}
function hStop(){if(!holding)return;holding=false;hold.classList.remove('prs');say('aborted');
  (function d(){hp*=.86;hold.style.setProperty('--hp',hp<.01?0:hp);updateHoldTime();if(hp>=.01)hraf=requestAnimationFrame(d);else{hp=0;hold.style.setProperty('--hp',0);updateHoldTime()}})()}
hold.addEventListener('pointerdown',e=>{e.preventDefault();hStart();try{hold.setPointerCapture?.(e.pointerId)}catch{}});
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>hold.addEventListener(ev,hStop));
['pointerup','pointercancel'].forEach(ev=>window.addEventListener(ev,hStop));
hold.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();hStart()}});
hold.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')hStop()});

$$('.gb').forEach(b=>b.addEventListener('click',()=>say('scanning archive…')));
const signal=$('.mb');let signalRaf=0,signalStart=0,signalHeld=false,signalComplete=false;
function startSignalHold(event){
  if(signalHeld||signalComplete)return;
  if(event?.pointerId!==undefined&&signal.setPointerCapture)signal.setPointerCapture(event.pointerId);
  signalHeld=true;signalStart=performance.now();signal.classList.add('signal-holding');say('hold to enter archive');cancelAnimationFrame(signalRaf);
  (function fill(now){if(!signalHeld)return;const progress=Math.min(1,(now-signalStart)/1200);signal.style.setProperty('--signal-progress',progress);
    if(progress>=1){signalHeld=false;signalComplete=true;signal.classList.remove('signal-holding');signal.classList.add('signal-complete');say('opening archive…');window.dispatchEvent(new CustomEvent('archive:enter',{detail:{source:signal}}))}
    else signalRaf=requestAnimationFrame(fill)})(signalStart);
}
function stopSignalHold(){if(!signalHeld)return;signalHeld=false;cancelAnimationFrame(signalRaf);signal.classList.remove('signal-holding');signal.style.setProperty('--signal-progress',0);say('signal hold cancelled')}
signal.addEventListener('pointerdown',startSignalHold);
['pointerup','pointercancel','lostpointercapture'].forEach(type=>signal.addEventListener(type,stopSignalHold));
signal.addEventListener('keydown',event=>{if((event.key===' '||event.key==='Enter')&&!event.repeat){event.preventDefault();startSignalHold()}});
signal.addEventListener('keyup',event=>{if(event.key===' '||event.key==='Enter')stopSignalHold()});
function resetArchiveHolds(){
  cancelAnimationFrame(signalRaf);signalHeld=false;signalComplete=false;signal.classList.remove('signal-holding','signal-complete');signal.style.setProperty('--signal-progress',0);
  cancelAnimationFrame(hraf);holding=false;hp=0;hold.classList.remove('prs','ok');hold.style.setProperty('--hp',0);hlt.textContent='HOLD TO CONFIRM';updateHoldTime();
}
window.addEventListener('archive:closed',resetArchiveHolds);

/* Living type, ported from the reference's split/build/decode/pointer loop. */
const livingFrames=$$('.frame').filter(frame=>frame.querySelector('.disp'));
const originals=new WeakMap();
const living={letters:[],visible:new WeakSet(),dirty:true,active:false,x:-9999,y:-9999,breatheAt:Infinity};
function splitLiving(root){let index=0;function walk(node){[...node.childNodes].forEach(child=>{
  if(child.nodeType===Node.TEXT_NODE){const fragment=document.createDocumentFragment();child.textContent.split(/(\s+)/).forEach(token=>{
    if(!token)return;if(/^\s+$/.test(token)){fragment.append(document.createTextNode(token));return}
    const word=document.createElement('span');word.className='w';
    [...token].forEach(char=>{const cell=document.createElement('span');cell.className='c';cell.style.setProperty('--i',index++);const sway=document.createElement('span');sway.className='s';sway.style.setProperty('--sw',(6+(index%4))+'s');const glyph=document.createElement('span');glyph.className='d';glyph.textContent=char;sway.append(glyph);cell.append(sway);word.append(cell)});fragment.append(word)});child.replaceWith(fragment)}
  else if(child.nodeType===Node.ELEMENT_NODE&&child.tagName!=='BR'&&child.tagName.toLowerCase()!=='svg'&&!child.closest('svg'))walk(child)
})}walk(root)}
function decodeLiving(element,duration=1000){if(!element)return;const glyphs=$$('.d',element),chars='01<>/\\#*+=',start=performance.now();glyphs.forEach(glyph=>{glyph.dataset.original??=glyph.textContent});
  function tick(now){let pending=false;glyphs.forEach((glyph,index)=>{const original=glyph.dataset.original,settle=(index/glyphs.length)*duration*.6+duration*.4;if(!/[a-z0-9]/i.test(original)){glyph.textContent=original;return}if(now-start<settle){glyph.textContent=chars[Math.random()*chars.length|0];pending=true}else glyph.textContent=original});if(pending&&!document.hidden&&!RM)requestAnimationFrame(tick)}requestAnimationFrame(tick)}
function rebuildLiving(){living.letters=[];let breathIndex=0;$$('.frame .c .d').forEach(glyph=>{const cell=glyph.closest('.c'),frame=glyph.closest('.frame'),breath=!!glyph.closest('#dec');living.letters.push({glyph,cell,frame,current:0,x:0,y:0,breath,breathIndex:breath?breathIndex++:0})});living.dirty=true}
function playLiving(frame){frame.classList.remove('play');void frame.offsetWidth;frame.classList.add('play');frame.dataset.livingPlayed='1';if(frame.id==='hero'){living.breatheAt=performance.now()+3300;window.setTimeout(()=>decodeLiving(frame.querySelector('#dec')),1900)}}
livingFrames.forEach(frame=>{$$('.disp',frame).forEach(heading=>{originals.set(heading,heading.innerHTML);splitLiving(heading)});frame.classList.remove('play')});
let livingFontsReady=false;
document.fonts?.ready.then(()=>{livingFontsReady=true;rebuildLiving();livingFrames.forEach(frame=>{$$('.frame .c',frame).forEach(cell=>{if(!cell.closest('#dec'))cell.style.minWidth=cell.getBoundingClientRect().width+'px'});if(living.visible.has(frame)&&!frame.dataset.livingPlayed)playLiving(frame)})});
const typeObserver=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){living.visible.add(entry.target);if(livingFontsReady&&!entry.target.dataset.livingPlayed)playLiving(entry.target)}else living.visible.delete(entry.target)}),{threshold:.15});livingFrames.forEach(frame=>typeObserver.observe(frame));
addEventListener('pointermove',event=>{living.x=event.clientX+scrollX;living.y=event.clientY+scrollY;living.active=true;clearTimeout(living.idleTimer);living.idleTimer=setTimeout(()=>{living.active=false},1500)},{passive:true});
addEventListener('resize',()=>{living.dirty=true});addEventListener('scroll',()=>{living.dirty=true},{passive:true});
document.fonts?.addEventListener?.('loadingdone',()=>{living.dirty=true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)living.dirty=true});
function livingLoop(now){if(document.hidden)return;requestAnimationFrame(livingLoop);if(RM)return;
  const activeFrames=livingFrames.filter(frame=>living.visible.has(frame));if(!activeFrames.length)return;
  if(now>living.breatheAt&&activeFrames.some(frame=>frame.id==='hero')){const amount=Math.min(1,(now-living.breatheAt)/1800),time=now/1000;living.letters.forEach(letter=>{if(!letter.breath)return;const k=letter.breathIndex,phase=time*1.25-k*.55;letter.glyph.style.fontVariationSettings='"wdth" '+(100+40*amount*Math.sin(phase)).toFixed(1)+',"wght" '+(600+270*amount*Math.sin(phase+.8)).toFixed(0);letter.glyph.style.setProperty('--br',(.35+.35*Math.sin(phase))*amount)})}
  if(living.dirty&&(living.active||living.letters.some(letter=>letter.current>.002))){living.letters.forEach(letter=>{if(!living.visible.has(letter.frame))return;const rect=letter.cell.getBoundingClientRect();letter.x=rect.left+rect.width/2+scrollX;letter.y=rect.top+rect.height/2+scrollY});living.dirty=false}
  for(const letter of living.letters){if(!living.visible.has(letter.frame)||(!living.active&&letter.current<.002))continue;const dx=letter.x-living.x,dy=letter.y-living.y,distance=Math.hypot(dx,dy),target=living.active?Math.max(0,1-distance/170):0;letter.current+=(target-letter.current)*.1;if(letter.current>.002){const k=letter.current*letter.current*(3-2*letter.current),push=k*18/(distance||1);letter.glyph.style.transform='translate('+(dx*push).toFixed(1)+'px,'+(dy*push).toFixed(1)+'px) scale('+(1+k*.2).toFixed(3)+')';letter.glyph.style.setProperty('--m',k.toFixed(3))}else if(letter.glyph.style.transform){letter.glyph.style.transform='';letter.glyph.style.setProperty('--m',0)}}
}
let livingFrameId=requestAnimationFrame(livingLoop);document.addEventListener('visibilitychange',()=>{if(!document.hidden)livingFrameId=requestAnimationFrame(livingLoop)});

/* particles */
frames.forEach(f=>{const c=document.createElement('canvas');c.className='pt';c.setAttribute('aria-hidden','true');f.prepend(c);
  const g=c.getContext('2d');let W=1,H=1,P=[];
  const size=()=>{const r=f.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);W=c.width=Math.round(r.width*d)||1;H=c.height=Math.round(r.height*d)||1;
    P=Array.from({length:44},()=>({x:Math.random()*W,y:Math.random()*H,v:.12+Math.random()*.3,r:(.6+Math.random()*1.5)*d,a:Math.random()*6.28}))};
  size();new ResizeObserver(size).observe(f);
  const s=S.get(f);
  new IntersectionObserver(es=>{s.vis=es[0].isIntersecting;if(s.vis&&!RM)tick()},{threshold:0}).observe(f);
  let run=false;
  function draw(t){g.clearRect(0,0,W,H);const L=W*.075;
    for(const p of P){if(!RM){p.y-=p.v;p.x+=Math.sin(t/1800+p.a)*.18;if(p.y<-6){p.y=H+6;p.x=Math.random()*W}}
      g.fillStyle='rgba(190,205,255,'+(.25+.35*Math.sin(t/900+p.a)**2).toFixed(2)+')';g.beginPath();g.arc(p.x,p.y,p.r,0,6.283);g.fill()}
    g.lineWidth=1;for(let i=0;i<P.length;i++)for(let j=i+1;j<P.length;j++){const dx=P[i].x-P[j].x,dy=P[i].y-P[j].y,d=Math.hypot(dx,dy);
      if(d<L){g.strokeStyle='rgba(98,116,224,'+(.22*(1-d/L)).toFixed(3)+')';g.beginPath();g.moveTo(P[i].x,P[i].y);g.lineTo(P[j].x,P[j].y);g.stroke()}}}
  function tick(){if(run)return;run=true;(function f(t){if(!s.vis||RM){run=false;draw(t||0);return}draw(t);requestAnimationFrame(f)})(performance.now())}
  if(RM)draw(0)});
})();
