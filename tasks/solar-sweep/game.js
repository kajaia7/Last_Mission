// Solar Sweep — portable offline edition
(()=>{
"use strict";
const MEASURE_INTERVAL = 120;
const noop = () => {};
const clock = () => globalThis.performance?.now() ?? Date.now();

function randomSource(seed) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value ^= value + Math.imul(value ^ value >>> 7, 61 | value);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

/** A scratch-off dust texture. All input coordinates are normalized to the glass. */
class DustLayer {
  constructor(canvas, {onProgress = noop, onComplete = noop, onPuff = noop} = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('The dust layer needs a 2D canvas.');
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onPuff = onPuff;
    this.sampleCanvas = typeof OffscreenCanvas === 'function'
      ? new OffscreenCanvas(160, 94)
      : canvas.ownerDocument.createElement('canvas');
    this.sampleCtx = this.sampleCanvas.getContext('2d', {willReadFrequently: true});
    this._timer = null;
    this.reset();
  }

  get progress() { return this._progress; }
  get complete() { return this._complete; }

  reset() {
    if (this._timer !== null) clearTimeout(this._timer);
    this._timer = null;
    this._progress = 0;
    this._complete = false;
    this._lastPoint = null;
    this._lastPuffAt = -Infinity;
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.radius = this.width * .035;
    this.sampleCanvas.width = 160;
    this.sampleCanvas.height = Math.max(1, Math.round(160 * this.height / this.width));
    this._random = randomSource((Date.now() ^ Math.floor(Math.random() * 0x7FFFFFFF)) >>> 0);
    this._paintDust();
    this._initialAlpha = this._readAlpha();
    this._lastMeasureAt = clock();
    this.onProgress(0);
  }

  breakStroke() { this._lastPoint = null; }

  wipe(u, v) {
    if (this._complete) return false;
    if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
      this.breakStroke();
      return false;
    }
    const point = {x: u * this.width, y: v * this.height};
    const from = this._lastPoint ?? point;
    const du = (point.x - from.x) / this.width;
    const dv = (point.y - from.y) / this.height;
    const touchedDust = this._hasDustNear(point.x, point.y) || this._hasDustNear(from.x, from.y);
    this._erase(from, point);
    this._lastPoint = point;
    const now = clock();
    if (touchedDust && now - this._lastPuffAt >= 30) {
      this._lastPuffAt = now;
      this.onPuff({u, v, du, dv});
    }
    if (now - this._lastMeasureAt >= MEASURE_INTERVAL) this._measure();
    else this._queueMeasure();
    return touchedDust;
  }

  _paintDust() {
    const {ctx, width, height} = this;
    const rand = this._random;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#b95836';
    ctx.fillRect(0, 0, width, height);

    // Broad grain clusters keep the coating earthy and visibly pixel based.
    const palette = ['#a74a30', '#b45233', '#bc603c', '#c46a42', '#cf784c', '#d48555'];
    for (let y = 0; y < height; y += 8) {
      for (let x = 0; x < width; x += 8) {
        const drift = Math.sin(x / 135 + Math.sin(y / 95) * 1.8) * .19;
        const tone = Math.max(0, Math.min(palette.length - 1, Math.floor((rand() * .8 + drift + .2) * palette.length)));
        ctx.globalAlpha = .38 + rand() * .35;
        ctx.fillStyle = palette[tone];
        ctx.fillRect(x, y, 8 + Math.floor(rand() * 5), 8 + Math.floor(rand() * 4));
      }
    }

    // Dust that has collected in shallow wind-swept ridges.
    for (let ridge = 0; ridge < 12; ridge++) {
      const start = rand() * height;
      const phase = rand() * Math.PI * 2;
      ctx.globalAlpha = .13 + rand() * .12;
      ctx.fillStyle = ridge % 2 ? '#f1ab70' : '#87382d';
      for (let x = -12; x < width; x += 8) {
        const y = Math.round((start + Math.sin(x / 160 + phase) * (12 + ridge * 1.8)) / 3) * 3;
        ctx.fillRect(x, y, 12, 2 + Math.floor(rand() * 4));
      }
    }

    ctx.globalAlpha = .42;
    for (let i = 0; i < width * height / 65; i++) {
      ctx.fillStyle = rand() > .54 ? '#eea66d' : '#80382e';
      const grain = rand() > .91 ? 3 : 1 + Math.floor(rand() * 2);
      ctx.fillRect(Math.floor(rand() * width), Math.floor(rand() * height), grain, grain);
    }
    ctx.restore();
  }

  _erase(from, point) {
    const {ctx, radius} = this;
    const distance = Math.hypot(point.x - from.x, point.y - from.y);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000';
    ctx.fillStyle = '#000';
    for (const [scale, alpha] of [[1.08, .18], [.98, .38], [.85, 1]]) {
      ctx.globalAlpha = alpha;
      if (distance < .1) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, radius * scale, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.lineWidth = radius * scale * 2;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(point.x, point.y);
        ctx.stroke();
      }
    }

    // A few stepped edge chips avoid an airbrushed or perfectly geometric trail.
    ctx.globalAlpha = .5;
    const steps = Math.max(1, Math.ceil(distance / (radius * .4)));
    for (let i = 0; i <= steps; i++) {
      const x = from.x + (point.x - from.x) * i / steps;
      const y = from.y + (point.y - from.y) * i / steps;
      for (let chip = 0; chip < 3; chip++) {
        const angle = this._random() * Math.PI * 2;
        const offset = radius * (.9 + this._random() * .24);
        const size = 2 + Math.floor(this._random() * 4);
        ctx.fillRect(Math.round((x + Math.cos(angle) * offset) / 2) * 2,
          Math.round((y + Math.sin(angle) * offset) / 2) * 2, size, size);
      }
    }
    ctx.restore();
  }

  _hasDustNear(x, y) {
    const sw = this.sampleCanvas.width;
    const sh = this.sampleCanvas.height;
    const sx = Math.max(0, Math.min(sw - 1, Math.round(x / this.width * (sw - 1))));
    const sy = Math.max(0, Math.min(sh - 1, Math.round(y / this.height * (sh - 1))));
    const spread = Math.max(1, Math.round(this.radius / this.width * sw * .7));
    for (const [dx, dy] of [[0, 0], [-spread, 0], [spread, 0], [0, -spread], [0, spread]]) {
      const px = Math.max(0, Math.min(sw - 1, sx + dx));
      const py = Math.max(0, Math.min(sh - 1, sy + dy));
      if (this._alphaData[(py * sw + px) * 4 + 3] > 24) return true;
    }
    return false;
  }

  _readAlpha() {
    const {sampleCanvas, sampleCtx} = this;
    sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
    sampleCtx.drawImage(this.canvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const data = sampleCtx.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data;
    this._alphaData = data;
    let sum = 0;
    for (let i = 3; i < data.length; i += 4) sum += data[i];
    return sum;
  }

  _queueMeasure() {
    if (this._timer !== null || this._complete) return;
    const remaining = Math.max(1, MEASURE_INTERVAL - (clock() - this._lastMeasureAt));
    this._timer = setTimeout(() => {
      this._timer = null;
      this._measure();
    }, remaining);
  }

  _measure() {
    if (this._complete) return;
    if (clock() - this._lastMeasureAt < MEASURE_INTERVAL) {
      this._queueMeasure();
      return;
    }
    this._lastMeasureAt = clock();
    const remaining = this._readAlpha();
    const cleaned = Math.max(0, Math.min(100, (1 - remaining / this._initialAlpha) * 100));
    if (cleaned >= 96) {
      this._complete = true;
      this._progress = 100;
      this._lastPoint = null;
      if (this._timer !== null) clearTimeout(this._timer);
      this._timer = null;
      this.ctx.clearRect(0, 0, this.width, this.height);
      this._alphaData.fill(0);
      this.onProgress(100);
      this.onComplete();
      return;
    }
    const next = Math.floor(cleaned);
    if (next !== this._progress) {
      this._progress = next;
      this.onProgress(next);
    }
  }
}



const $=id=>document.getElementById(id);
const game=$('game'),panel=$('panel'),surface=$('surface'),cells=$('cells'),dustCanvas=$('dust'),brush=$('brush');
let dust,lastQuarter=-1,pointer={x:0,y:0},keyboardPoint={u:.5,v:.5};
const particles=[];
const fx=$('dust-puffs'),fxCtx=fx.getContext('2d');
const rand=(a,b)=>a+Math.random()*(b-a);

function panelPoint(clientX,clientY){
 const r=surface.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(panel).transform);
 const dx=clientX-(r.left+r.width/2),dy=clientY-(r.top+r.height/2),det=m.a*m.d-m.b*m.c;
 return {u:((m.d*dx-m.c*dy)/det)/surface.clientWidth+.5,v:((-m.b*dx+m.a*dy)/det)/surface.clientHeight+.5};
}
function screenPoint(u,v){
 const r=surface.getBoundingClientRect(),m=new DOMMatrixReadOnly(getComputedStyle(panel).transform),x=(u-.5)*surface.clientWidth,y=(v-.5)*surface.clientHeight;
 return {x:r.left+r.width/2+m.a*x+m.c*y,y:r.top+r.height/2+m.b*x+m.d*y};
}
function showBrush(x,y,tilt=0){pointer={x,y};brush.hidden=false;brush.style.left=x+'px';brush.style.top=y+'px';brush.style.setProperty('--tilt',Math.max(-9,Math.min(9,tilt))+'deg');}
function hideBrush(){brush.hidden=true;dust?.breakStroke();}
function matchBrushFootprint(){if(dust)dust.radius=dustCanvas.width*(parseFloat(getComputedStyle(brush).width)*54/120)/(surface.clientWidth*2);}

function drawPanel(){
 const ctx=cells.getContext('2d'),w=cells.width,h=cells.height;
 const columns=Math.max(4,Math.min(10,Math.round(w/h*4))),rows=w/h<1.1?7:5;
 ctx.fillStyle='#142838';ctx.fillRect(0,0,w,h);
 const cw=w/columns,ch=h/rows;
 for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
  const x=Math.round(col*cw+5),y=Math.round(row*ch+5),a=Math.round(cw-10),b=Math.round(ch-10);
  ctx.fillStyle=(col+row)%3===0?'#263f62':'#254c6c';ctx.beginPath();ctx.moveTo(x+7,y);ctx.lineTo(x+a-7,y);ctx.lineTo(x+a,y+7);ctx.lineTo(x+a,y+b-7);ctx.lineTo(x+a-7,y+b);ctx.lineTo(x+7,y+b);ctx.lineTo(x,y+b-7);ctx.lineTo(x,y+7);ctx.closePath();ctx.fill();
  ctx.fillStyle='#507891';ctx.fillRect(x+8,y+2,a-16,2);ctx.fillRect(x+2,y+8,2,b-16);
  ctx.fillStyle='#1b314e';ctx.fillRect(x+8,y+b-4,a-16,3);ctx.fillRect(x+a-4,y+8,3,b-16);
  ctx.fillStyle='#49617c';for(let n=1;n<6;n++)ctx.fillRect(Math.round(x+a*n/6),y+4,1,b-8);
  ctx.fillStyle='#b9b99e';ctx.globalAlpha=.75;ctx.fillRect(Math.round(x+a*.33),y+3,2,b-6);ctx.fillRect(Math.round(x+a*.67),y+3,2,b-6);ctx.globalAlpha=1;
  ctx.fillStyle='#65859a';ctx.globalAlpha=.17;for(let line=12;line<b-4;line+=8)ctx.fillRect(x+5,y+line,a-10,1);ctx.globalAlpha=1;
 }
 // The reflected sky is broken into broad pixel bands, keeping the cells readable.
 ctx.save();ctx.globalAlpha=.08;ctx.fillStyle='#b9ccce';
 for(let n=0;n<4;n++){ctx.beginPath();ctx.moveTo(w*.12+n*15,0);ctx.lineTo(w*.36+n*15,0);ctx.lineTo(w*.70+n*15,h);ctx.lineTo(w*.46+n*15,h);ctx.closePath();ctx.fill();}ctx.restore();
 for(let i=0;i<1800;i++){ctx.fillStyle=i%3?'#1d355431':'#83a1ac18';ctx.fillRect(Math.floor(Math.random()*w),Math.floor(Math.random()*h),2,2);}
}
function updateProgress(value){
 $('percent').textContent=value+'%';$('progress-fill').style.width=value+'%';$('clean-meter').setAttribute('aria-valuenow',String(value));
 $('clean-meter').setAttribute('aria-valuetext',value+' percent of the panel cleaned');
 $('progress-note').textContent=value===100?'Sunlight is reaching every cell.':value>=85?'Almost there. Sweep along the edges.':value>=50?'Keep sweeping. More sunlight is getting through!':value>=20?'The blue cells are coming back!':'Let the sunlight reach the cells.';
 const quarter=Math.floor(value/25);if(quarter>lastQuarter){lastQuarter=quarter;$('announcer').textContent=value===100?'Powers restored. Dr. Ian is back online.':value+' percent cleaned.';}
}
function setCoachOnline(online){
 $('coach').setAttribute('aria-label',online?'Dr. Ian is back online. Communications restored.':'Dr. Ian is not responding. Communications are offline.');$('coach-status').textContent=online?'CONNECTED':'NOT RESPONDING';$('link-copy').textContent=online?'Connection restored':'Connection lost';$('link-mark').textContent=online?'✓':'×';$('coach-image').alt=online?'Dr. Ian, your astronaut trainer, back online':"Dr. Ian's astronaut portrait tinted red";
}
function restored(){
 game.classList.add('power-restored');panel.inert=true;$('panel').setAttribute('aria-label','Clean solar panel. Power restored.');$('title').textContent='Powers restored';$('power-copy').textContent='POWER FLOWING';$('win-screen').hidden=false;setCoachOnline(true);hideBrush();$('return-tasks').focus({preventScroll:true});
 for(let i=0;i<35;i++){const p=screenPoint(Math.random(),Math.random());particles.push({x:p.x,y:p.y,vx:rand(-12,12),vy:rand(-55,-15),size:rand(2,4),life:rand(.5,1.1),ttl:1.1,color:i%2?'#f8da88':'#b6ddb0'});}
}
function puff({u,v,du,dv}){
 const p=screenPoint(u,v);for(let i=0;i<5;i++){const ttl=rand(.28,.62);particles.push({x:p.x+rand(-20,20),y:p.y+rand(-8,7),vx:rand(-45,40)+du*170,vy:rand(-85,-25)+dv*70,size:rand(2,5),life:ttl,ttl,color:['#d77a4e','#eea16a','#ae4b32','#f4b27a'][i%4]});}
}
function reset(){
 hideBrush();particles.length=0;lastQuarter=-1;game.classList.remove('power-restored');panel.inert=false;$('win-screen').hidden=true;setCoachOnline(false);$('title').textContent='Solar Sweep';$('panel').setAttribute('aria-label','Dusty solar panel');$('power-copy').textContent='DUST BLOCKING LIGHT';keyboardPoint={u:.5,v:.5};
 cells.width=dustCanvas.width=960;cells.height=dustCanvas.height=Math.round(960*surface.clientHeight/surface.clientWidth);drawPanel();
 if(dust)dust.reset();else dust=new DustLayer(dustCanvas,{onProgress:updateProgress,onComplete:restored,onPuff:puff});matchBrushFootprint();
}
function moveBrush(event){
 if(event.pointerType==='touch'&&event.buttons===0)return;
 const point=panelPoint(event.clientX,event.clientY),tilt=(event.clientX-pointer.x)*.5;
 showBrush(event.clientX,event.clientY,tilt);keyboardPoint=point;dust.wipe(point.u,point.v);
 if(event.pointerType==='touch')event.preventDefault();
}
surface.addEventListener('pointerenter',event=>{dust.breakStroke();if(event.pointerType!=='touch')moveBrush(event);});
surface.addEventListener('pointermove',moveBrush);
surface.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')surface.setPointerCapture(event.pointerId);moveBrush(event);});
surface.addEventListener('pointerleave',hideBrush);
surface.addEventListener('pointerup',event=>{if(event.pointerType==='touch')hideBrush();});
surface.addEventListener('pointercancel',hideBrush);
surface.addEventListener('focus',()=>{if(surface.matches(':focus-visible')){const p=screenPoint(keyboardPoint.u,keyboardPoint.v);showBrush(p.x,p.y);}});
surface.addEventListener('blur',hideBrush);
surface.addEventListener('keydown',event=>{
 const step=event.shiftKey ? .085 : .04,keys={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
 if(!keys[event.key]&&event.key!==' ')return;event.preventDefault();
 if(keys[event.key]){keyboardPoint.u=Math.max(0,Math.min(1,keyboardPoint.u+keys[event.key][0]));keyboardPoint.v=Math.max(0,Math.min(1,keyboardPoint.v+keys[event.key][1]));}
 const p=screenPoint(keyboardPoint.u,keyboardPoint.v);showBrush(p.x,p.y);dust.wipe(keyboardPoint.u,keyboardPoint.v);
});

function resizeEffects(){const d=Math.min(devicePixelRatio||1,2);fx.width=Math.round(innerWidth*d);fx.height=Math.round(innerHeight*d);fxCtx.setTransform(d,0,0,d,0,0);}
let lastFrame=performance.now();
function animate(now){const dt=Math.min(.05,(now-lastFrame)/1000);lastFrame=now;fxCtx.clearRect(0,0,innerWidth,innerHeight);for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.life-=dt;if(p.life<=0){particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.98;p.vy+=20*dt;fxCtx.globalAlpha=Math.min(1,p.life/p.ttl);fxCtx.fillStyle=p.color;fxCtx.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,p.size,p.size);}fxCtx.globalAlpha=1;requestAnimationFrame(animate);}
window.addEventListener('resize',()=>{resizeEffects();hideBrush();matchBrushFootprint();});

window.addEventListener('keydown', event => {
 if(event.key === 'Escape' && !event.repeat) location.href = '../../index.html#tasks';
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)hideBrush();});
const bolt=(x,y)=>`<g transform="translate(${x} ${y})"><path fill="#66424a" d="M-8-10H6V-7H10V7H7V11H-7V7H-11V-6H-8Z"/><path fill="#f7ddb0" d="M-6-8H5V-5H8V5H5V8H-5V5H-8V-4H-6Z"/><path fill="#c49372" d="M-5 5H5V8H-5Z"/><path fill="#825549" d="M-5-2H5V1H-5Z"/></g>`;
$('frame-bolts').innerHTML=[[25,25],[500,25],[975,25],[24,320],[976,320],[25,607],[975,607]].map(([x,y])=>bolt(x,y)).join('');
resizeEffects();reset();requestAnimationFrame(animate);

})();
