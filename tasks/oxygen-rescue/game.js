// Oxygen Rescue — portable offline edition
(()=>{
"use strict";
const JOINTS = Object.freeze([
  {id:0,x:30.3,y:47.8,name:'Tank outlet'},
  {id:1,x:48.3,y:37.6,name:'Upper pipe'},
  {id:2,x:70.3,y:47.8,name:'Air unit inlet'},
  {id:3,x:32.9,y:67.0,name:'Lower tank pipe'},
  {id:4,x:54.6,y:66.8,name:'Lower middle pipe'},
  {id:5,x:75.7,y:66.7,name:'Air unit return'},
]);
const START_PRESSURE=58;
const LEAK_DURATION=25_000;
const LEAKING_PHASES=new Set(['search','found','placed','sealing']);

function newGame(leakId=0){
  if(!JOINTS.some(j=>j.id===leakId))throw new RangeError('Unknown pipe joint');
  return {phase:'search',leakId,checked:[],patchSelected:false,pressure:START_PRESSURE,scans:0};
}

function nextLeak(previous,random=Math.random){
  const choices=JOINTS.filter(j=>j.id!==previous);
  return choices[Math.min(choices.length-1,Math.max(0,Math.floor(random()*choices.length)))].id;
}

function signalAt(point,leakId){
  const target=JOINTS.find(j=>j.id===leakId);
  if(!target||!Number.isFinite(point.x)||!Number.isFinite(point.y))return 0;
  const distance=Math.hypot((point.x-target.x)*1.6,(point.y-target.y)*.9);
  return Math.max(0,Math.min(100,Math.round(100*(1-distance/85))));
}

function isNearLeak(point,leakId){
  const target=JOINTS.find(j=>j.id===leakId);
  return Boolean(target)&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.hypot((point.x-target.x)*1.6,(point.y-target.y)*.9)<=10;
}

function transition(current,action){
  const state=structuredClone(current);
  const result=(changed,message,kind='info')=>({state,changed,message,kind});
  const joint=JOINTS.find(j=>j.id===action.jointId);
  if(action.type==='scan'&&state.phase==='search'&&joint){
    state.scans++;
    if(joint.id===state.leakId){state.phase='found';return result(true,'Leak found! Pick up a repair patch.','success');}
    if(!state.checked.includes(joint.id))state.checked.push(joint.id);
    return result(true,'This joint is sealed. Follow the scanner signal to another one.');
  }
  if(action.type==='take-patch'&&state.phase==='found'){
    state.patchSelected=true;return result(true,'Patch ready. Place it on the glowing leak.');
  }
  if(action.type==='cancel-patch'&&state.phase==='found'){
    state.patchSelected=false;return result(true,'Patch returned to the kit.');
  }
  if(action.type==='place-patch'&&state.phase==='found'&&state.patchSelected){
    if(action.jointId!==state.leakId)return result(false,'Aim for the glowing leak. You can try again.');
    state.phase='placed';state.patchSelected=false;return result(true,'Patch in place. Press it to make a tight seal.','success');
  }
  if(action.type==='start-seal'&&state.phase==='placed'){
    state.phase='sealing';return result(true,'Securing the patch…');
  }
  if(action.type==='finish-seal'&&state.phase==='sealing'){
    state.phase='sealed';return result(true,'Patch secured! Test the repair.','success');
  }
  if(action.type==='start-test'&&state.phase==='sealed'){
    state.phase='testing';return result(true,'Checking the seal and restoring cabin air…');
  }
  if(action.type==='finish-test'&&state.phase==='testing'){
    state.phase='complete';state.pressure=100;return result(true,'Leak sealed. Cabin air is stable!','success');
  }
  return result(false,'Finish the current step first.');
}


// Shared repair cover for the kit, cursor and fitted pipe plate.
const REPAIR_PLATE_BOLTS = [[18, 19], [78, 19], [78, 61], [18, 61]].map(([x, y], index) => `
  <g transform="translate(${x} ${y})">
    <path fill="#47333f" d="M-7-10H7L10-7V7L7 10H-7L-10 7V-7Z"/>
    <path fill="#b18463" d="M-6-8H6L8-6V6L6 8H-6L-8 6V-6Z"/>
    <g class="repair-bolt bolt-${index + 1}">
      <path fill="#5b4e59" d="M-4-7H4L7-3V3L4 7H-4L-7 3V-3Z"/>
      <path fill="#e8d2aa" d="M-4-6H4L6-3V2L3 5H-3L-6 2V-3Z"/>
      <path fill="#fff2d6" d="M-4-6H4V-4H-3L-5-2H-6V-3Z"/>
      <path fill="#544550" d="M-4-1H4V1H-4Z"/>
    </g>
  </g>`).join('');

const REPAIR_PLATE_MARKUP = `<svg class="repair-plate-art" viewBox="0 0 96 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <path fill="#342631" d="M14 2H82L94 14V66L82 78H14L2 66V14Z"/>
  <path fill="#594655" d="M14 5H82L91 15V64L81 74H15L5 64V15Z"/>
  <path class="repair-gasket" fill="#262e3a" d="M15 7H81L89 15V63L80 72H16L7 63V15Z"/>
  <path fill="#8f5b4b" d="M15 7H81L86 13V61L78 69H17L9 61V13Z"/>
  <path fill="#f1c790" d="M15 7H81L85 12V58L77 66H18L10 58V12Z"/>
  <path fill="#fff0c8" d="M15 7H80V10H16L13 14V53H10V12Z"/>
  <path fill="#c48d63" d="M82 12H85V58L77 66H18L15 63H76L82 56Z"/>
  <path fill="#764b48" d="M29 15H67L73 21V58L67 64H29L23 58V21Z"/>
  <path fill="#f7d6a7" d="M29 18H67L70 22V55L65 60H30L26 56V22Z"/>
  <path fill="#fff1cb" d="M30 19H65V21H31L28 24V54H26V22Z"/>
  <path fill="#a55642" d="M29 25H67V40H29Z"/>
  <path fill="#ec9c51" d="M29 25H67V37H29Z"/>
  <path fill="#ffcf82" d="M29 25H67V27H29Z"/>
  <path fill="#76423d" d="M30 34L37 27H42L32 37H30ZM40 37L50 27H55L45 37ZM53 37L63 27H67V29L58 37Z"/>
  <path fill="#b18a6f" d="M30 45H40V47H30ZM30 50H37V52H30ZM30 55H41V57H30Z"/>
  <path fill="#554149" d="M47 44H65V57H47Z"/>
  <path fill="#845547" d="M49 46H63V55H49Z"/>
  <path class="repair-lamp" fill="#ffb655" d="M50 47H62V54H50Z"/>
  <path fill="#fff5d3" fill-opacity=".74" d="M51 48H59V49H51Z"/>
  <path fill="#935e4a" d="M14 35H17V44H14ZM79 34H82V44H79ZM35 12H44V14H35ZM55 61H64V63H55Z"/>
  ${REPAIR_PLATE_BOLTS}
</svg>`;



const $=id=>document.getElementById(id);
let state,epoch=0,dragging=false,dragMoved=false,dragStart=null,suppressClick=false,lastBand='',lastAnnounced=0;
const timers=new Set();
const phaseNames={search:'Find the leak in the air pipes.',found:'Leak found. Fit a patch over the joint.',placed:'Press the patch to tighten its bolts.',sealing:'Tightening the repair bolts…',sealed:'Now test your repair.',testing:'Checking the seal…',complete:'The cabin air is stable again!'};
const welcome='The cabin has a small air leak. Move your scanner around the pipe joints. Let’s find it!';

function later(fn,ms){const token=epoch;const id=setTimeout(()=>{timers.delete(id);if(token===epoch)fn();},ms);timers.add(id);return id;}
function speak(copy){$('coach-copy').textContent=copy;$('coach').classList.add('speaking');$('coach-toggle').setAttribute('aria-expanded','true');}
function status(copy,kind='info'){$('status').textContent=copy;$('status').className='status '+kind;}

function setPressure(value){
  $('pressure-fill').style.width=value+'%';
  const percent=String(Math.round(value));
  if($('pressure-meter').getAttribute('aria-valuenow')!==percent){
    $('pressure-meter').setAttribute('aria-valuenow',percent);
    $('pressure-percentage').textContent=percent+'%';
  }
}
function showLeakingPressure(){
  const label=state.pressure===0?'EMPTY':state.pressure<=20?'CRITICAL':'LOW';
  if($('pressure-label').textContent!==label)$('pressure-label').textContent=label;
  const note=state.pressure===0?'Seal the leak to restore cabin air.':'Cabin air is leaking.';
  if($('pressure-note').textContent!==note)$('pressure-note').textContent=note;
  setPressure(state.pressure);
}
let leakSound=null;
function stopLeakSound(){leakSound?.stop(.6);leakSound=null;}
function startLeak(){
  const token=epoch,start=performance.now();
  stopLeakSound();leakSound=SFX.loop('hiss',.6);
  function drain(now){
    if(token!==epoch||!LEAKING_PHASES.has(state.phase))return;
    state.pressure=START_PRESSURE*Math.max(0,1-(now-start)/LEAK_DURATION);
    showLeakingPressure();
    if(state.pressure>0)requestAnimationFrame(drain);
  }
  requestAnimationFrame(drain);
}
function scan(point){
  if(state.phase!=='search')return;
  const signal=signalAt(point,state.leakId);
  // Scanner beeps faster and higher as the signal gets stronger.
  const beepGap=900-signal*8;if(signal>=15&&performance.now()-lastBeep>beepGap){lastBeep=performance.now();SFX.play('scan',{signal});}
  const band=signal>=95?'VERY STRONG':signal>=72?'STRONG':signal>=43?'WARM':signal>=15?'FAINT':'QUIET';
  $('scanner-reading').textContent=band;
  $('scanner').dataset.band=signal>=72?'hot':signal>=43?'warm':'cold';
  $('signal-bars').setAttribute('aria-valuenow',String(signal));
  [...$('signal-bars').children].forEach((bar,i)=>bar.classList.toggle('on',i<Math.ceil(signal/12.5)));
  $('scanner-copy').textContent=signal>=95?'Very strong! Click this joint to inspect.':'Move over the pipes. Follow the stronger signal.';
  if(band!==lastBand&&Date.now()-lastAnnounced>1200){$('announcer').textContent='Scanner signal: '+band.toLowerCase();lastAnnounced=Date.now();lastBand=band;}
}
function pointFromEvent(event){const r=$('stage').getBoundingClientRect();return {x:Math.max(0,Math.min(100,(event.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(event.clientY-r.top)/r.height*100))};}

function render(){
  const phase=state.phase,located=phase!=='search',patched=['placed','sealing','sealed','testing','complete'].includes(phase),sealed=['sealed','testing','complete'].includes(phase);
  $('game').dataset.phase=phase;$('instruction').textContent=phaseNames[phase];
  $('scanner').hidden=located;$('patch-kit').hidden=!['found','placed','sealing'].includes(phase);
  $('test-repair').hidden=!['sealed','testing'].includes(phase);$('test-repair').disabled=phase==='testing';
  $('test-repair').textContent=phase==='testing'?'CHECKING THE SEAL…':'TEST THE REPAIR →';
  $('success').hidden=phase!=='complete';
  $('coach-speech').hidden=phase==='complete';
  $('coach-toggle').disabled=phase==='complete';
  if(phase==='complete')$('coach-toggle').setAttribute('aria-expanded','false');
  for(const [id,done,active] of [['step-find',located,phase==='search'],['step-seal',sealed,['found','placed','sealing'].includes(phase)],['step-test',phase==='complete',['sealed','testing','complete'].includes(phase)]]){
    $(id).classList.toggle('done',done);$(id).classList.toggle('active',active);if(active)$(id).setAttribute('aria-current','step');else $(id).removeAttribute('aria-current');
  }
  for(const joint of JOINTS){
    const button=$('joint-'+joint.id),target=joint.id===state.leakId;
    button.classList.toggle('checked',!located&&state.checked.includes(joint.id));button.classList.toggle('leak',located&&target);button.classList.toggle('has-patch',patched&&target);button.classList.toggle('seal-done',sealed&&target);
    button.disabled=located&&(!target||['sealing','sealed','testing','complete'].includes(phase));
    let name=`Scan pipe joint ${joint.id+1}: ${joint.name}`;
    if(state.checked.includes(joint.id))name+=', already checked and sealed';
    if(located&&target)name=phase==='found'?(state.patchSelected?'Place patch on':'Leak found at')+` pipe joint ${joint.id+1}`:phase==='placed'?`Press patch on joint ${joint.id+1} to seal it`:`Repaired pipe joint ${joint.id+1}`;
    button.setAttribute('aria-label',name);
  }
  $('take-patch').disabled=patched;$('take-patch').classList.toggle('equipped',state.patchSelected);$('take-patch').setAttribute('aria-pressed',String(state.patchSelected));
  $('patch-button-label').textContent=patched?'PATCH FITTED':state.patchSelected?'PATCH READY':'PICK UP PATCH';
  $('patch-instruction').textContent=phase==='placed'?'Press the fitted patch to secure it.':phase==='sealing'?'Making a tight seal…':state.patchSelected?'Tap the glowing leak, or drag the patch there.':'Drag to the leak, or tap patch then leak.';
  if(sealed){
    $('pressure-label').textContent=phase==='complete'?'STABLE':phase==='testing'?'RISING':'PATCHED';
    $('pressure-note').textContent=phase==='complete'?'A good seal. A happy crew.':phase==='testing'?'Restoring cabin air…':'Patch secured. Run a seal check.';
    setPressure(state.pressure);
  }else showLeakingPressure();
  if(located)$('scan-cursor').hidden=true;
}

let lastBeep=0;
function dispatch(action){const result=transition(state,action);state=result.state;if(result.changed)render();status(result.message,result.kind);return result;}
function inspect(id){
  if(state.phase==='search'){
    scan(JOINTS[id]);const result=dispatch({type:'scan',jointId:id});
    SFX.play(result.kind==='success'?'success':'blip',{pitch:.5});
    if(result.kind==='success')speak('There it is! Grab the repair patch. Drag it onto the glowing joint, or tap patch then leak.');
    else if(state.checked.length===2)speak('Two joints checked! Follow the scanner toward a stronger signal. You’re getting closer.');
  }else if(state.phase==='found'){
    if(!state.patchSelected){status('Pick up a repair patch from the kit first.');$('take-patch').focus({preventScroll:true});return;}
    place(id);
  }else if(state.phase==='placed'&&id===state.leakId)seal();
}
function takePatch(){if(state.phase==='found'){SFX.play('pickup');dispatch({type:'take-patch'});}}
function place(id){const result=dispatch({type:'place-patch',jointId:id});SFX.play(result.changed?'install':'denied');if(result.changed){speak('Patch in place! Press it to tighten the bolts and seal the pipe.');$('joint-'+state.leakId).focus({preventScroll:true});}}
function seal(){
  if(!dispatch({type:'start-seal'}).changed)return;
  SFX.play('ratchet');later(stopLeakSound,1350);
  later(()=>{dispatch({type:'finish-seal'});speak('All four bolts are snug. Let’s test the repair and make sure the cabin air recovers.');$('test-repair').focus({preventScroll:true});},1350);
}
function testRepair(){
  if(!dispatch({type:'start-test'}).changed)return;
  SFX.play('pressurize');
  const token=epoch,start=performance.now(),sealedPressure=state.pressure;
  const animate=now=>{if(token!==epoch||state.phase!=='testing')return;const t=Math.min(1,(now-start)/1800);setPressure(sealedPressure+(100-sealedPressure)*t);if(t<1)requestAnimationFrame(animate);else {dispatch({type:'finish-test'});SFX.play('win');confetti();$('return-tasks').focus({preventScroll:true});}};
  requestAnimationFrame(animate);
}
function confetti(){for(let i=0;i<16;i++){const p=document.createElement('i');p.style.cssText=`--x:${12+i*5}%;--delay:${i%5*.12}s`;$('effects').append(p);}later(()=>$('effects').replaceChildren(),4000);}
function hint(){
  if(state.phase==='search'){
    const target=JOINTS[state.leakId];speak(`Try the ${target.y<55?'upper':'lower'} pipes. Move your scanner slowly and look for a very strong signal.`);
    status('Hint: inspect the '+(target.y<55?'upper':'lower')+' row of pipe joints.');
  }else if(state.phase==='found')speak('Pick up the patch from the repair kit. Then tap the glowing leak. Dragging the patch there works too!');
  else if(state.phase==='placed')speak('The patch is sitting on the leak. Press it to secure the seal.');
  else if(state.phase==='sealed')speak('Press Test the repair. We’ll check the seal and restore the cabin air together.');
}

function reset(){
  const wasComplete=state?.phase==='complete';epoch++;for(const timer of timers)clearTimeout(timer);timers.clear();
  state=newGame(nextLeak(state?.leakId));dragging=false;dragMoved=false;suppressClick=false;lastBand='';
  $('drag-patch').hidden=true;$('scan-cursor').hidden=true;$('effects').replaceChildren();document.body.classList.remove('dragging');
  render();startLeak();scan({x:0,y:0});$('scanner-reading').textContent='READY';status('');speak(welcome);
  if(wasComplete)$('joint-0').focus({preventScroll:true});
}

$('joints').innerHTML=JOINTS.map(j=>`<button id="joint-${j.id}" class="joint" type="button" data-joint="${j.id}" style="--x:${j.x};--y:${j.y}"><span class="target-ring" aria-hidden="true"></span><span class="leak-mark" aria-hidden="true"><i></i><i></i><i></i></span><span class="fitted-patch patch-picture" aria-hidden="true"></span></button>`).join('');
document.querySelectorAll('.patch-picture').forEach(picture=>{picture.innerHTML=REPAIR_PLATE_MARKUP;});
$('signal-bars').innerHTML=Array.from({length:8},(_,i)=>`<span style="height:${26+i*10}%"></span>`).join('');

$('joints').addEventListener('click',event=>{const b=event.target.closest('[data-joint]');if(b)inspect(Number(b.dataset.joint));});
$('joints').addEventListener('focusin',event=>{const b=event.target.closest('[data-joint]');if(b&&state.phase==='search')scan(JOINTS[Number(b.dataset.joint)]);});
$('stage').addEventListener('pointermove',event=>{
  const point=pointFromEvent(event);
  if(state.phase==='search'){scan(point);$('scan-cursor').hidden=event.pointerType==='touch';$('scan-cursor').style.left=point.x+'%';$('scan-cursor').style.top=point.y+'%';}
});
$('stage').addEventListener('pointerleave',()=>{$('scan-cursor').hidden=true;});
$('game').addEventListener('pointerleave',()=>{$('scan-cursor').hidden=true;});
$('take-patch').addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}takePatch();});
$('take-patch').addEventListener('pointerdown',event=>{
  if(state.phase!=='found')return;dragging=true;dragMoved=false;dragStart={x:event.clientX,y:event.clientY};
  $('take-patch').setPointerCapture(event.pointerId);dispatch({type:'take-patch'});
});
document.addEventListener('pointermove',event=>{
  if(!dragging)return;
  if(Math.hypot(event.clientX-dragStart.x,event.clientY-dragStart.y)>7)dragMoved=true;
  if(dragMoved){document.body.classList.add('dragging');$('drag-patch').hidden=false;$('drag-patch').style.left=event.clientX+'px';$('drag-patch').style.top=event.clientY+'px';}
});
document.addEventListener('pointerup',event=>{
  if(!dragging)return;dragging=false;document.body.classList.remove('dragging');$('drag-patch').hidden=true;
  if(dragMoved){suppressClick=true;const joint=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-joint]');if(joint){place(Number(joint.dataset.joint));return;}const point=pointFromEvent(event);place(isNearLeak(point,state.leakId)?state.leakId:-1);}
});
document.addEventListener('pointercancel',()=>{dragging=false;$('drag-patch').hidden=true;document.body.classList.remove('dragging');});
document.addEventListener('keydown',event=>{
  if(event.key!=='Escape'||event.repeat||event.defaultPrevented)return;
  event.preventDefault();
  if(state.phase==='found'&&state.patchSelected){
    dispatch({type:'cancel-patch'});
    dragging=false;
    $('drag-patch').hidden=true;
    document.body.classList.remove('dragging');
    return;
  }
  window.location.href='../../index.html#tasks';
});
$('test-repair').addEventListener('click',testRepair);$('hint').addEventListener('click',hint);
$('coach-toggle').addEventListener('click',()=>{const open=$('coach').classList.toggle('speaking');$('coach-toggle').setAttribute('aria-expanded',String(open));});
$('close-speech').addEventListener('click',()=>{$('coach').classList.remove('speaking');$('coach-toggle').setAttribute('aria-expanded','false');});
reset();

})();
