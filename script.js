'use strict';
/* ================= 1. SETUP ================= */
const W=27,H=19,T=48,SPEED=150,$=id=>document.getElementById(id);
const cv=$('c'),cx=cv.getContext('2d'),lc=document.createElement('canvas'),lx=lc.getContext('2d');
let vw=0,vh=0;
function resize(){vw=cv.width=lc.width=innerWidth;vh=cv.height=lc.height=innerHeight}
addEventListener('resize',resize);resize();
const hs=(x,y)=>{const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s)};
let seed=11;const R=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
let state='title',muted=false,last=0,P,E,got,noteDone,ghost,ghostT,ambT,msgT,heartT,near,caughtT,esc,lastPrompt='';
const keysDown={};

/* ================= 2. MAZE (seeded, always connected) ================= */
// 0 floor, 1 wall, 2 furniture. Recursive-backtracker maze + loops + carved rooms.
const map=Array.from({length:H},()=>Array(W).fill(1));
const solid=(x,y)=>x<0||y<0||x>=W||y>=H||map[y][x]!==0;
const inside=(a,b)=>a>0&&b>0&&a<W-1&&b<H-1;
(function(){
  const st=[[1,1]];map[1][1]=0;
  while(st.length){
    const [x,y]=st[st.length-1];
    const n=[[2,0],[-2,0],[0,2],[0,-2]].map(d=>[x+d[0],y+d[1],d]).filter(([a,b])=>inside(a,b)&&map[b][a]===1);
    if(!n.length){st.pop();continue}
    const [a,b,d]=n[Math.floor(R()*n.length)];
    map[y+d[1]/2][x+d[0]/2]=0;map[b][a]=0;st.push([a,b]);
  }
  for(let i=0;i<22;i++){ // knock out walls to make loops (needed to shake the entity)
    const x=1+Math.floor(R()*(W-2)),y=1+Math.floor(R()*(H-2));
    if((x+y)%2===1&&map[y][x]===1&&inside(x,y))map[y][x]=0;
  }
})();
const DIRS=[[1,0],[-1,0],[0,1],[0,-1]];
function bfs(sx,sy){
  const d=Array.from({length:H},()=>Array(W).fill(-1)),p={},q=[[sx,sy]];d[sy][sx]=0;
  for(let i=0;i<q.length;i++){const [x,y]=q[i];
    for(const [dx,dy] of DIRS){const a=x+dx,b=y+dy;
      if(!solid(a,b)&&d[b][a]<0){d[b][a]=d[y][x]+1;p[b*W+a]=[x,y];q.push([a,b])}}}
  return {d,p};
}
function findPath(sx,sy,tx,ty){ // list of tiles from next step to target
  const {d,p}=bfs(sx,sy);if(d[ty][tx]<0)return[];
  const r=[];let c=[tx,ty];while(c[0]!==sx||c[1]!==sy){r.push(c);c=p[c[1]*W+c[0]]}
  return r.reverse();
}
const D=bfs(1,1).d,CL=[];
for(let y=1;y<H;y+=2)for(let x=1;x<W;x+=2)CL.push([x,y]);
CL.sort((a,b)=>D[a[1]][a[0]]-D[b[1]][b[0]]);
const used=[[1,1]];
function pick(f,gap){ // choose a cell at a fraction of the walking distance, spaced from earlier picks
  const s=Math.floor(f*(CL.length-1));
  for(let i=0;i<CL.length;i++){const c=CL[(s+i)%CL.length];
    if(used.every(u=>Math.abs(u[0]-c[0])+Math.abs(u[1]-c[1])>=gap)){used.push(c);return c}}
  return CL[s];
}
const EXIT=CL[CL.length-1];used.push(EXIT);
const KEYS=[.3,.55,.78].map(f=>pick(f,8)),NOTES=[.08,.4,.66,.9].map(f=>pick(f,5));
[...KEYS,EXIT,CL[20],CL[80]].forEach(([x,y])=>{ // carve 3x3 rooms with furniture in two corners
  for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)if(inside(x+i,y+j))map[y+j][x+i]=0;
  [[-1,-1],[1,1]].forEach(([i,j])=>{if(inside(x+i,y+j))map[y+j][x+i]=2});
});
const cc=c=>(c+.5)*T;
const KEYCOL=['#d6a93a','#b8c2cc','#c0572f'];
const NOTE_TXT=[
 "Entry, October 3. The Harlow estate has stood empty since the family vanished. Villagers say the cellar was sealed for a reason. I found the hatch standing open.",
 "Harlow's ledger: 'We dug the lower rooms to hide it. It was only ever meant to be kept below. Three keys, three rooms, far apart. Never let one man carry all three.'",
 "Scratched into the brick: IT DOES NOT HUNT BY SOUND. IT HUNTS BY SIGHT. BREAK ITS LINE. Every key you take wakes it a little more.",
 "The last page: 'Mary hums down here at night. Mary has been dead ten years. If you are reading this, the door behind you is already locked. Take the keys. Do not look back.'"];

/* ================= 3. BAKED WORLD (floors, walls, furniture, doors) ================= */
const wc=document.createElement('canvas');wc.width=W*T;wc.height=H*T;
(function(){
  const c=wc.getContext('2d');
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const px=x*T,py=y*T,r=hs(x,y),t=map[y][x];
    if(t===1){
      c.fillStyle=`rgb(${38+r*14|0},${34+r*12|0},${32+r*10|0})`;c.fillRect(px,py,T,T);
      c.strokeStyle='rgba(0,0,0,.55)';c.lineWidth=2;c.beginPath();
      for(let k=0;k<3;k++){const by=py+k*16;c.moveTo(px,by);c.lineTo(px+T,by);
        const o=k%2?10:26;c.moveTo(px+o,by);c.lineTo(px+o,by+16);c.moveTo(px+o+24>T?px+T:px+o+24,by);c.lineTo(px+o+24>T?px+T:px+o+24,by+16)}
      c.stroke();c.fillStyle='rgba(140,125,105,.1)';c.fillRect(px,py,T,3);
      if(r>.78){c.strokeStyle='rgba(0,0,0,.75)';c.lineWidth=1.5;c.beginPath();c.moveTo(px+10,py);c.lineTo(px+18,py+14);c.lineTo(px+12,py+26);c.lineTo(px+22,py+T);c.stroke()}
      continue;
    }
    c.fillStyle=`rgb(${30+r*10|0},${27+r*9|0},${24+r*8|0})`;c.fillRect(px,py,T,T); // floor tile
    c.strokeStyle='rgba(0,0,0,.45)';c.lineWidth=1;c.strokeRect(px+.5,py+.5,T-1,T-1);
    c.fillStyle='rgba(255,255,255,.035)';c.fillRect(px+2,py+2,T-4,3);
    for(let k=0;k<5;k++){c.fillStyle='rgba(0,0,0,.25)';c.fillRect(px+hs(x+k,y)*T,py+hs(y+k,x)*T,2,2)}
    if(r>.86){c.fillStyle='rgba(20,30,20,.5)';c.beginPath();c.ellipse(px+24,py+24,16,9,r*6,0,7);c.fill()}
    if(r<.08){c.strokeStyle='rgba(0,0,0,.6)';c.beginPath();c.moveTo(px+4,py+30);c.lineTo(px+20,py+22);c.lineTo(px+30,py+34);c.lineTo(px+44,py+26);c.stroke()}
    if(t===2){ // furniture: crate or bookshelf
      if(r<.5){c.fillStyle='#5a4126';c.fillRect(px+4,py+4,T-8,T-8);c.strokeStyle='#2a1c0e';c.lineWidth=3;c.strokeRect(px+4,py+4,T-8,T-8);
        c.beginPath();c.moveTo(px+4,py+4);c.lineTo(px+T-4,py+T-4);c.moveTo(px+T-4,py+4);c.lineTo(px+4,py+T-4);c.stroke()}
      else{c.fillStyle='#3b2a1c';c.fillRect(px+3,py+3,T-6,T-6);
        for(let k=0;k<3;k++){c.fillStyle='#1c1209';c.fillRect(px+3,py+15+k*14-12,T-6,3);
          for(let b=0;b<6;b++){c.fillStyle=['#6b2b2b','#2f4a3a','#5a5030','#3a3a55'][(b+k)%4];c.fillRect(px+6+b*6,py+6+k*14,4,9)}}}
    } else if(solid(x,y-1)&&solid(x,y+1)&&!solid(x-1,y)&&!solid(x+1,y)&&r>.7){ // wooden door in a corridor
      c.fillStyle='#4a3320';c.fillRect(px+3,py,10,T);c.strokeStyle='#1d130a';c.lineWidth=2;c.strokeRect(px+3,py,10,T);
      c.fillStyle='#b08a3a';c.fillRect(px+10,py+22,2,4);
    }
  }
})();

/* ================= 4. ENTITY SPRITE (image + soft mask, procedural fallback) ================= */
let spr=null,sprAR=1;
function makeSprite(img){
  const s=document.createElement('canvas'),c=s.getContext('2d');
  if(img){ // crop 7% border, keep proportions, cap size
    const mx=img.width*.07,my=img.height*.07,cw=img.width-2*mx,ch=img.height-2*my,k=Math.min(1,320/ch);
    s.width=Math.max(2,cw*k|0);s.height=Math.max(2,ch*k|0);c.drawImage(img,mx,my,cw,ch,0,0,s.width,s.height);
  }else{
    s.width=240;s.height=300;
    const g=c.createRadialGradient(120,130,10,120,150,150);g.addColorStop(0,'#16161a');g.addColorStop(1,'#000');
    c.fillStyle=g;c.fillRect(0,0,240,300);
    c.shadowColor='#ffb030';c.shadowBlur=22;c.fillStyle='#ffc040';
    [88,152].forEach(x=>{c.beginPath();c.ellipse(x,105,14,7,x<120?.3:-.3,0,7);c.fill()});
    c.shadowBlur=0;c.strokeStyle='#e8e0c0';c.lineWidth=4;c.beginPath();c.arc(120,140,56,.12*Math.PI,.88*Math.PI);c.stroke();
    c.lineWidth=2;for(let i=0;i<9;i++){const a=(.16+i*.088)*Math.PI;c.beginPath();c.moveTo(120+Math.cos(a)*56,140+Math.sin(a)*56);c.lineTo(120+Math.cos(a)*47,140+Math.sin(a)*47);c.stroke()}
  }
  // elliptical feathered mask removes rectangular edges so it blends into the dark
  c.globalCompositeOperation='destination-in';c.save();c.translate(s.width/2,s.height/2);c.scale(s.width/2,s.height/2);
  const g=c.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,'#000');g.addColorStop(.55,'#000');g.addColorStop(1,'rgba(0,0,0,0)');
  c.fillStyle=g;c.fillRect(-1,-1,2,2);c.restore();
  return s;
}
function spriteReady(img){spr=makeSprite(img);sprAR=spr.width/spr.height;$('start').disabled=false;
  $('load').textContent=img?'':'assets/entity.png not found, using a procedural shadow creature.'}
const img=new Image();img.onload=()=>spriteReady(img);img.onerror=()=>spriteReady(null);img.src='assets/entity.png'; // preload
// draw sprite with feet at (x,y), height h, preserving aspect ratio
function drawSprite(x,y,h,a){cx.globalAlpha=a;cx.drawImage(spr,x-h*sprAR/2,y-h*.82,h*sprAR,h);cx.globalAlpha=1}

/* ================= 5. AUDIO (Web Audio, no files) ================= */
let AC=null,master=null,droneG=null;
function initAudio(){
  if(AC)return;
  try{
    AC=new (window.AudioContext||window.webkitAudioContext)();
    master=AC.createGain();master.gain.value=muted?0:.7;master.connect(AC.destination);
    droneG=AC.createGain();droneG.gain.value=.03;droneG.connect(master);
    [55,82.4,110.5].forEach(f=>{const o=AC.createOscillator(),l=AC.createBiquadFilter();
      o.type='sawtooth';o.frequency.value=f;l.type='lowpass';l.frequency.value=170;o.connect(l);l.connect(droneG);o.start()});
  }catch(e){AC=null}
}
function tone(f,d,type='sine',v=.2,w=0,f2){
  if(!AC)return;const t=AC.currentTime+w,o=AC.createOscillator(),g=AC.createGain();
  o.type=type;o.frequency.setValueAtTime(f,t);if(f2)o.frequency.exponentialRampToValueAtTime(f2,t+d);
  g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  o.connect(g);g.connect(master);o.start(t);o.stop(t+d);
}
function noise(d,v,fq,w=0){
  if(!AC)return;const t=AC.currentTime+w,n=AC.sampleRate*d|0,b=AC.createBuffer(1,n,AC.sampleRate),a=b.getChannelData(0);
  for(let i=0;i<n;i++)a[i]=Math.random()*2-1;
  const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();
  s.buffer=b;f.type='lowpass';f.frequency.value=fq;g.gain.setValueAtTime(v,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  s.connect(f);f.connect(g);g.connect(master);s.start(t);
}
const sfx={
  step:v=>noise(.07,v,500),
  key:()=>{tone(660,.4,'triangle',.2);tone(880,.5,'triangle',.18,.12);tone(1320,.8,'triangle',.15,.25)},
  sting:()=>{tone(110,1,'sawtooth',.18,0,50);noise(.6,.12,900)},
  heart:()=>{tone(60,.18,'sine',.5);tone(52,.22,'sine',.4,.2)},
  creak:()=>{noise(1.2,.08,400);tone(140,1,'sawtooth',.03,0,90)},
  thud:()=>{tone(70,.4,'sine',.35,0,35);noise(.3,.12,200)},
  click:()=>tone(1400,.03,'square',.05),
  note:()=>noise(.25,.1,1500),
  unlock:()=>{[0,.3,.6].forEach(w=>tone(180,.12,'square',.2,w));tone(90,1.2,'sawtooth',.2,.9,40)}
};
function setMute(){
  muted=!muted;if(master)master.gain.value=muted?0:.7;
  document.querySelectorAll('.mutebtn').forEach(b=>b.textContent='Sound: '+(muted?'Off':'On'));
}

/* ================= 6. GAME STATE ================= */
const kc=()=>got.filter(Boolean).length;
let OBJ=[];
function reset(){
  P={x:cc(1),y:cc(1),face:0,step:0,flash:true};
  E={on:false,x:0,y:0,path:[],mode:'patrol',lost:0,last:null,repath:0,stepT:0,prev:'patrol'};
  got=[false,false,false];noteDone=[false,false,false,false];ghost=null;ghostT=14;ambT=6;msgT=0;heartT=0;near=null;lastPrompt='';
  OBJ=[...KEYS.map((c,i)=>({t:'key',i,x:cc(c[0]),y:cc(c[1])})),...NOTES.map((c,i)=>({t:'note',i,x:cc(c[0]),y:cc(c[1])})),{t:'exit',x:cc(EXIT[0]),y:cc(EXIT[1])}];
  $('msg').textContent='';$('prompt').textContent='';
  if(droneG)droneG.gain.value=.03;
  setObj();
}
function setObj(){
  const n=kc();
  $('obj').textContent=n===3?'Find the exit and escape.':n?`${n} of 3 keys. It is awake. Stay out of its sight.`:'Find three keys hidden in the basement.';
  $('keys').textContent='Keys  '+got.map(g=>g?'◆':'◇').join(' ');
  if(droneG&&AC)droneG.gain.setTargetAtTime(.03+.016*n,AC.currentTime,.5);
}
function msg(t,s=3){$('msg').textContent=t;msgT=s}
function show(id){['title','howto','intro','note','pause','over','win'].forEach(s=>$(s).hidden=s!==id)}
function begin(){reset();state='play';show();$('hud').hidden=false;last=performance.now()}

/* ================= 7. UPDATE ================= */
function hit(x,y,r){return solid((x-r)/T|0,(y-r)/T|0)||solid((x+r)/T|0,(y-r)/T|0)||solid((x-r)/T|0,(y+r)/T|0)||solid((x+r)/T|0,(y+r)/T|0)}
function move(o,mx,my,r=13){o.x+=mx;if(hit(o.x,o.y,r))o.x-=mx;o.y+=my;if(hit(o.x,o.y,r))o.y-=my}
function clear(x1,y1,x2,y2){ // line-of-sight test through the tile grid
  const n=Math.ceil(Math.hypot(x2-x1,y2-y1)/10);
  for(let i=1;i<n;i++){const t=i/n;if(solid((x1+(x2-x1)*t)/T|0,(y1+(y2-y1)*t)/T|0))return false}
  return true;
}
function activateEntity(){
  const far=CL.filter(c=>Math.abs(cc(c[0])-P.x)+Math.abs(cc(c[1])-P.y)>14*T);
  const c=(far.length?far:CL)[Math.floor(Math.random()*(far.length||CL.length))];
  E.x=cc(c[0]);E.y=cc(c[1]);E.on=true;E.path=[];E.mode='patrol';
}
function update(dt){
  // --- player movement (dt based, so speed is frame-rate independent) ---
  const k=keysDown;let dx=(k.d||k.arrowright?1:0)-(k.a||k.arrowleft?1:0),dy=(k.s||k.arrowdown?1:0)-(k.w||k.arrowup?1:0);
  const l=Math.hypot(dx,dy);
  if(l){dx/=l;dy/=l;P.face=Math.atan2(dy,dx);const s=SPEED*dt;move(P,dx*s,0);move(P,0,dy*s);P.step+=s;
    if(P.step>=46){P.step-=46;sfx.step(.12)}}
  // --- nearest interactable ---
  near=null;let best=40;
  for(const o of OBJ){if(o.t==='key'&&got[o.i])continue;const d=Math.hypot(o.x-P.x,o.y-P.y);if(d<best){best=d;near=o}}
  const pt=near?(near.t==='key'?'Press E to take the key':near.t==='note'?'Press E to read the note':'Press E to try the iron door'):'';
  if(pt!==lastPrompt){$('prompt').textContent=pt;lastPrompt=pt}
  if(msgT>0&&(msgT-=dt)<=0)$('msg').textContent='';
  // --- distant sounds ---
  if((ambT-=dt)<=0){ambT=7+Math.random()*10;Math.random()<.5?sfx.creak():sfx.thud()}
  // --- brief sightings at the end of a corridor in front of the player ---
  ghostT-=dt;
  if(ghost){ghost.t+=dt;if(ghost.t>2.4||Math.hypot(P.x-ghost.x,P.y-ghost.y)<3.4*T){ghost=null;ghostT=20+Math.random()*16}}
  else if(ghostT<=0){
    const ux=Math.cos(P.face),uy=Math.sin(P.face);let n=0;
    while(n<11&&!solid((P.x+ux*(n+1)*T)/T|0,(P.y+uy*(n+1)*T)/T|0))n++;
    const gx=((P.x+ux*n*T)/T|0),gy=((P.y+uy*n*T)/T|0);
    if(n>=5&&!(E.on&&Math.hypot(E.x-P.x,E.y-P.y)<10*T)){ghost={x:cc(gx),y:cc(gy),t:0};sfx.sting()}else ghostT=2;
  }
  // --- entity AI (starts after the first key) ---
  if(!E.on)return;
  const d=Math.hypot(P.x-E.x,P.y-E.y),los=d<7.5*T&&clear(E.x,E.y,P.x,P.y),n=kc();
  if(los){E.mode='chase';E.lost=0;E.last=[P.x/T|0,P.y/T|0]}
  else if(E.mode==='chase'&&(E.lost+=dt)>2.5){E.mode='patrol';E.path=[]}
  if(E.mode==='chase'&&E.prev!=='chase'){sfx.sting()}
  E.prev=E.mode;
  const tx=E.x/T|0,ty=E.y/T|0;
  if((E.repath-=dt)<=0||!E.path.length){
    E.repath=.3;
    if(E.mode==='chase'){const t=E.last||[P.x/T|0,P.y/T|0];E.path=findPath(tx,ty,t[0],t[1])}
    else if(!E.path.length){const c=CL[Math.floor(Math.random()*CL.length)];E.path=findPath(tx,ty,c[0],c[1])}
  }
  const sp=(E.mode==='chase'?96+n*11:56+n*7)*dt; // always slower than the player (150)
  if(E.path.length){const [a,b]=E.path[0],X=cc(a)-E.x,Y=cc(b)-E.y,dd=Math.hypot(X,Y);
    if(dd<=sp){E.x=cc(a);E.y=cc(b);E.path.shift()}else{E.x+=X/dd*sp;E.y+=Y/dd*sp}}
  if((E.stepT-=dt)<=0){E.stepT=E.mode==='chase'?.34:.6;if(d<14*T)sfx.step(.2*(1-d/(14*T)))}
  if(E.mode==='chase'||d<6*T){if((heartT-=dt)<=0){heartT=Math.max(.45,d/(9*T));sfx.heart()}}
  if(d<.55*T){state='caught';caughtT=0;$('hud').hidden=true;sfx.sting();sfx.thud()}
}

/* ================= 8. RENDER ================= */
function drawKey(o,tt){
  const g=.5+.5*Math.sin(tt*3+o.x),col=KEYCOL[o.i],gr=cx.createRadialGradient(o.x,o.y,2,o.x,o.y,26);
  gr.addColorStop(0,col+'88');gr.addColorStop(1,'transparent');cx.globalAlpha=.4+.4*g;cx.fillStyle=gr;cx.fillRect(o.x-26,o.y-26,52,52);cx.globalAlpha=1;
  cx.strokeStyle=col;cx.fillStyle=col;cx.lineWidth=3;cx.beginPath();cx.arc(o.x-8,o.y,6,0,7);cx.stroke();
  cx.fillRect(o.x-2,o.y-1.5,16,3);cx.fillRect(o.x+8,o.y,3,6);cx.fillRect(o.x+13,o.y,3,[5,8,4][o.i]);
}
function drawWorld(){
  const tt=performance.now()/1000;
  cx.save();cx.translate(Math.round(vw/2-P.x),Math.round(vh/2-P.y));
  cx.drawImage(wc,0,0);
  for(const o of OBJ){
    if(o.t==='key'){if(!got[o.i])drawKey(o,tt)}
    else if(o.t==='note'){cx.globalAlpha=noteDone[o.i]?.45:1;cx.fillStyle='#cdbf93';cx.fillRect(o.x-8,o.y-10,16,20);
      cx.fillStyle='#6a5d3c';for(let i=0;i<4;i++)cx.fillRect(o.x-5,o.y-7+i*5,10,1.5);cx.globalAlpha=1}
    else{cx.fillStyle='#2b2d2f';cx.fillRect(o.x-18,o.y-22,36,44);cx.strokeStyle='#58595b';cx.lineWidth=3;cx.strokeRect(o.x-18,o.y-22,36,44);
      for(let i=0;i<3;i++){cx.fillStyle=got[i]?KEYCOL[i]:'#0a0a0a';cx.beginPath();cx.arc(o.x,o.y-12+i*12,3.5,0,7);cx.fill()}}
  }
  // player (top-down explorer)
  cx.save();cx.translate(P.x,P.y);cx.rotate(P.face);
  cx.fillStyle='#3f4a3a';cx.beginPath();cx.ellipse(0,0,7,12,0,0,7);cx.fill();
  cx.fillStyle='#c9a88a';cx.beginPath();cx.arc(1,0,6,0,7);cx.fill();cx.fillStyle='#2a2f26';cx.beginPath();cx.arc(-1,0,6,Math.PI*.6,Math.PI*1.4);cx.fill();
  cx.fillStyle=P.flash?'#ffe9a0':'#444';cx.fillRect(8,6,8,4);cx.restore();
  // entity and sightings (only visible where light reaches)
  if(E.on){cx.fillStyle='rgba(0,0,0,.5)';cx.beginPath();cx.ellipse(E.x,E.y+4,18,7,0,0,7);cx.fill();
    drawSprite(E.x,E.y+4+Math.sin(tt*5)*2,T*2,E.mode==='chase'?1:.85)}
  if(ghost)drawSprite(ghost.x,ghost.y+8,T*2,Math.min(1,ghost.t*3)*(Math.random()<.12?.3:1));
  cx.restore();
}
function drawLight(){
  const sx=vw/2,sy=vh/2;
  lx.globalCompositeOperation='source-over';lx.fillStyle='rgba(0,0,0,.955)';lx.fillRect(0,0,vw,vh);
  lx.globalCompositeOperation='destination-out';
  let g=lx.createRadialGradient(sx,sy,6,sx,sy,P.flash?95:80);g.addColorStop(0,'rgba(0,0,0,1)');g.addColorStop(1,'rgba(0,0,0,0)');
  lx.fillStyle=g;lx.beginPath();lx.arc(sx,sy,100,0,7);lx.fill();
  if(P.flash){ // flashlight cone, clipped by walls with a ray fan
    const len=330*(1-(Math.random()<.03?.15:0));lx.beginPath();lx.moveTo(sx,sy);
    for(let i=0;i<=40;i++){const a=P.face-.4+.8*i/40;let dist=len;
      for(let d=20;d<len;d+=8)if(solid((P.x+Math.cos(a)*d)/T|0,(P.y+Math.sin(a)*d)/T|0)){dist=d+6;break}
      lx.lineTo(sx+Math.cos(a)*dist,sy+Math.sin(a)*dist)}
    lx.closePath();g=lx.createRadialGradient(sx,sy,10,sx,sy,len);g.addColorStop(0,'rgba(0,0,0,.95)');g.addColorStop(1,'rgba(0,0,0,0)');
    lx.fillStyle=g;lx.fill();
  }
  lx.globalCompositeOperation='source-over';
}
function eyes(x,y,a){ // faint glowing eyes visible even in the dark
  const ex=x-P.x+vw/2,ey=y-P.y+vh/2-T*.55;cx.save();cx.shadowColor='#ffa020';cx.shadowBlur=14;cx.fillStyle=`rgba(255,190,70,${a})`;
  [-9,9].forEach(o=>{cx.beginPath();cx.ellipse(ex+o,ey,3,2,0,0,7);cx.fill()});cx.restore();
}
function draw(){
  cx.fillStyle='#000';cx.fillRect(0,0,vw,vh);
  drawWorld();drawLight();cx.drawImage(lc,0,0);
  if(E.on){const d=Math.hypot(E.x-P.x,E.y-P.y);if(d<10*T&&clear(P.x,P.y,E.x,E.y))eyes(E.x,E.y,.6)}
  if(ghost&&ghost.t<2)eyes(ghost.x,ghost.y,.7*Math.min(1,ghost.t*3));
}
function drawCaught(){ // flickering full-face reveal before the Game Over screen
  draw();const h=vh*.9;
  cx.globalAlpha=Math.random()<.35?0:.55+Math.random()*.45;
  cx.drawImage(spr,vw/2-h*sprAR/2+(Math.random()-.5)*16,vh/2-h/2,h*sprAR,h);cx.globalAlpha=1;
}
function drawEscape(t){
  let g=cx.createLinearGradient(0,0,0,vh);g.addColorStop(0,'#03080c');g.addColorStop(1,'#0e1a14');cx.fillStyle=g;cx.fillRect(0,0,vw,vh);
  cx.fillStyle='rgba(207,216,208,.8)';cx.beginPath();cx.arc(vw*.8,vh*.18,26,0,7);cx.fill();
  for(let i=0;i<14;i++){const x=(i+.5)*vw/14,h=vh*(.32+hs(i,3)*.3);cx.fillStyle='#050a08';cx.beginPath();cx.moveTo(x-42,vh*.8);cx.lineTo(x,vh*.8-h);cx.lineTo(x+42,vh*.8);cx.fill()}
  cx.fillStyle='#030605';cx.fillRect(0,vh*.8,vw,vh*.2);
  const px=vw*.25+t*vw*.07,py=vh*.8+20,sw=Math.sin(t*8)*6;
  cx.fillStyle='#0b100d';cx.fillRect(px-8,py-46,16,34);cx.beginPath();cx.arc(px,py-54,8,0,7);cx.fill();
  cx.fillRect(px-7+sw,py-12,6,12);cx.fillRect(px+1-sw,py-12,6,12);
  if(t>3.6){const a=Math.min(1,(t-3.6)/1.2)*(.6+.35*Math.random());drawSprite(px-vw*.2,py+8,vh*.5,a)} // it was behind him all along
  if(t>5.8){cx.fillStyle=`rgba(0,0,0,${Math.min(1,t-5.8)})`;cx.fillRect(0,0,vw,vh)}
}

/* ================= 9. LOOP & STATES ================= */
function loop(t){
  const dt=Math.min(.05,(t-last)/1000||0);last=t;
  if(state==='play'){update(dt);if(state==='play')draw()}
  else if(state==='pause'||state==='note')draw();
  else if(state==='caught'){caughtT+=dt;drawCaught();if(caughtT>1.5){state='over';show('over')}}
  else if(state==='escape'){esc+=dt;drawEscape(esc);if(Math.random()<.04)sfx.step(.1);if(esc>7){state='won';show('win')}}
  requestAnimationFrame(loop);
}
function interact(){
  const o=near;if(!o)return;
  if(o.t==='key'){got[o.i]=true;sfx.key();setObj();msg('You take the key. The air grows colder.',3.5);
    if(kc()===1){activateEntity();msg('Somewhere in the dark, something heavy stirs.',4)}}
  else if(o.t==='note'){noteDone[o.i]=true;$('ntext').textContent=NOTE_TXT[o.i];sfx.note();state='note';show('note')}
  else if(kc()<3){const m=3-kc();sfx.click();msg(`The iron door is locked. ${m} key${m>1?'s':''} still missing.`,3.5)}
  else{sfx.unlock();state='escape';esc=0;$('hud').hidden=true}
}
function togglePause(){
  if(state==='play'){state='pause';show('pause')}
  else if(state==='pause'){state='play';show();last=performance.now()}
}
addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();keysDown[k]=true;
  if(k.startsWith('arrow')||k===' ')e.preventDefault();
  if(e.repeat)return;
  if(state==='play'){if(k==='e')interact();else if(k==='f'){P.flash=!P.flash;sfx.click()}else if(k==='escape')togglePause()}
  else if(state==='pause'&&k==='escape')togglePause();
  else if(state==='note'&&(k==='e'||k==='escape')){state='play';show();last=performance.now()}
});
addEventListener('keyup',e=>{keysDown[e.key.toLowerCase()]=false});
addEventListener('blur',()=>{for(const k in keysDown)keysDown[k]=false;if(state==='play')togglePause()});
$('start').onclick=()=>{initAudio();show('intro')};
$('how').onclick=()=>show('howto');
$('back').onclick=()=>show('title');
$('begin').onclick=begin;
$('resume').onclick=togglePause;
['restartP','restartO','again'].forEach(id=>$(id).onclick=begin);
document.querySelectorAll('.mutebtn').forEach(b=>b.onclick=setMute);
reset();show('title');requestAnimationFrame(loop);
