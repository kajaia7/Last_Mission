// Rock Detectives — portable offline edition
(()=>{
"use strict";
const TOOLS=['scale','scope','magnet'];
const ROCKS={
 basalt:{name:'Basalt',mass:290,pull:'Clear',level:3,texture:'Tiny, tightly interlocking crystals.',position:'0%',colour:'#55505c',light:'#807b86',dark:'#36323e',fact:'Basalt forms when lava cools and hardens.',learning:['A volcanic rock formed from cooling lava.','Usually has fine, interlocking mineral crystals.','Spirit found basaltic rocks in Mars’ Gusev Crater.']},
 sandstone:{name:'Sandstone',mass:220,pull:'None',level:0,texture:'Sand-sized grains cemented together.',position:'50%',colour:'#c8864e',light:'#efbc7c',dark:'#8b503d',fact:'Sandstone is made from sand grains cemented together.',learning:['Made of sand grains cemented together.','Can preserve layers formed by ancient wind or water.','Curiosity studied sandstone at Windjana on Mars.']},
 conglomerate:{name:'Conglomerate',mass:250,pull:'Weak',level:1,texture:'Rounded pebbles in finer material.',position:'100%',colour:'#a36c4e',light:'#d8a876',dark:'#71463c',fact:'Conglomerate holds larger pebbles in a finer-grained matrix.',learning:['Rounded pebbles are cemented into finer material.','Those pebbles are larger than 2 mm across.','Martian examples reveal evidence of ancient streams.']}
};
function newGame(random=Math.random){const order=Object.keys(ROCKS);for(let i=order.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[order[i],order[j]]=[order[j],order[i]];}return {order,index:0,used:{scale:false,scope:false,magnet:false},sorted:[],phase:'investigate',attempts:0};}
function recordTool(state,tool){if(state.phase!=='investigate'||!TOOLS.includes(tool))return state;return {...state,used:{...state.used,[tool]:true}};}
function sortSample(state,bin){if(state.phase!=='investigate')return {state,kind:'inactive'};if(!TOOLS.every(t=>state.used[t]))return {state,kind:'locked'};if(bin!==state.order[state.index])return {state:{...state,attempts:state.attempts+1},kind:'wrong'};const sorted=[...state.sorted,bin];return {state:{...state,sorted,phase:sorted.length===3?'complete':'correct'},kind:'correct'};}
function nextSample(state){if(state.phase!=='correct')return state;return {...state,index:state.index+1,used:{scale:false,scope:false,magnet:false},phase:'investigate'};}


let rockArtCount = 0;
function rockArt(type,variant=0){const r=ROCKS[type];const clipId = 'rock-face-' + ++rockArtCount;let details='';
 for(let i=0;i<30;i++){const x=20+(i*31+variant*7)%68,y=31+(i*17)%47;if(type==='conglomerate'){if(i<9){const a=23+(i*29)%63,b=34+(i*19)%39;details+=`<path fill="${['#b7a797','#665d61','#dac69d','#b88158'][i%4]}" stroke="#67483f" stroke-width="2" d="M${a} ${b}h9l4 4v8l-5 4h-9l-4-5v-6z"/>`;}}else{details+=`<path fill="${i%3?r.light:r.dark}" opacity="${i%2?.7:.5}" d="M${x} ${y}h${type==='basalt'?3:5}v3h-2v2h-3z"/>`;}}
 if(type==='sandstone')details+=`<path d="M19 45l73 7M17 56l76 7M24 69l58 4" stroke="${r.dark}" stroke-width="3" opacity=".55"/>`;
 return `<svg viewBox="0 0 120 100" class="rock-art" aria-hidden="true">
  <clipPath id="${clipId}"><path d="M18 60l10-26 17-12 28 3 23 17 4 20-18 14-36 6-24-10z"/></clipPath>
  <path fill="#34252e" d="M18 79L10 62l10-28 21-18 34 2 26 21 9 29-19 20-42 6z"/>
  <path fill="${r.dark}" d="M19 75L14 62l10-25 19-17 31 2 24 20 8 24-18 18-39 6z"/>
  <g clip-path="url(#${clipId})">
    <path fill="${r.colour}" d="M0 0h120v100H0z"/>
    <path fill="${r.light}" d="M28 34l17-12 28 3 23 17-29-8-22 2-24 22z" opacity=".65"/>
    ${details}
  </g>
  <path fill="${r.dark}" d="M22 72l24 10 36-6 18-14-3 12-13 10-36 6z"/>
 </svg>`;
}


const $=id=>document.getElementById(id);
let state,busy=false,epoch=0,scopeMode='guide',notesMode='review',drag=null,suppressClick=false;
const timers=new Set(),flying=$('flying-rock');
const lab = $('lab');

function positionFlyingRock(x, y) {
 const bounds = lab.getBoundingClientRect();
 flying.style.left = (x - bounds.left) + 'px';
 flying.style.top = (y - bounds.top) + 'px';
}
function later(fn,ms){const token=epoch;const id=setTimeout(()=>{timers.delete(id);if(token===epoch)fn();},ms);timers.add(id);}
function current(){return ROCKS[state.order[state.index]];}
function status(text,kind=''){$('status').textContent=text;$('status').className='status '+kind;}
function allClues(){return TOOLS.every(t=>state.used[t]);}
function render(){
 const type=state.order[state.index],rock=current(),investigating=state.phase==='investigate';
 $('game').classList.toggle('all-clues',allClues());$('score').textContent=state.sorted.length+' / 3';
 [...$('sample-dots').children].forEach((dot,i)=>{dot.classList.toggle('done',i<state.sorted.length);dot.classList.toggle('active',i===state.index&&investigating);dot.textContent=i<state.sorted.length?'✓':String.fromCharCode(65+i);});
 for(const tool of TOOLS){$('use-'+tool).disabled=busy||!investigating;$('use-'+tool).classList.toggle('done',state.used[tool]);$('done-'+tool).textContent=state.used[tool]?'✓':'○';$('clue-'+tool).classList.toggle('done',state.used[tool]);$('clue-'+tool).textContent=(state.used[tool]?'✓ ':'○ ')+({scale:'SCALE',scope:'SCOPE',magnet:'MAGNET'}[tool]);}
 $('scale-reading').textContent=state.used.scale?rock.mass+' g':'— g';$('scope-reading').textContent=state.used.scope?'TEXTURE RECORDED':'COMPARE GRAINS';$('magnet-reading').textContent=state.used.magnet?rock.pull.toUpperCase():'—';
 $('sample').innerHTML=rockArt(type,state.index);$('sample').disabled=busy||!investigating;$('sample').classList.toggle('in-transit',busy||!investigating);$('sample').setAttribute('aria-label','Pick up unknown sample '+String.fromCharCode(65+state.index));$('sample-label').textContent='SAMPLE '+String.fromCharCode(65+state.index)+' · 100 cm³';$('next').hidden=busy||state.phase!=='correct';
 $('reference-board').disabled=busy;$('open-notes').disabled=busy||state.sorted.length===0;$('instruction').textContent=state.phase==='complete'?'Three discoveries. Read your completed field notes.':state.phase==='correct'?'New discovery! Read its story in your field notes.':allClues()?'Three clues collected. Choose the matching bin.':'Use the tools. Match the clues. Sort the rock.';
 for(const id of Object.keys(ROCKS)){const filled=state.sorted.includes(id);$('bin-'+id).disabled=busy||!investigating;$('bin-'+id).classList.toggle('filled',filled);$('fill-'+id).classList.toggle('show',filled);$('bin-state-'+id).textContent=filled?'✓ SAMPLE STORED':allClues()?'STORE SAMPLE →':'';$('stored-'+id).innerHTML='';}
}
function flight(from,to,done,deposit=false){
 const a=from.getBoundingClientRect(),b=to.getBoundingClientRect(),token=epoch;
 flying.classList.remove('depositing');
 flying.innerHTML=rockArt(state.order[state.index],state.index);
 flying.style.transition='none';
 positionFlyingRock(a.x+a.width/2, a.y+a.height/2);
 flying.hidden=false;
 void flying.offsetWidth;
 flying.style.transition='';
 requestAnimationFrame(()=>{
  if(token===epoch) positionFlyingRock(b.x+b.width/2, b.y+b.height/2);
 });
 later(()=>{if(deposit){flying.classList.add('depositing');later(()=>{flying.hidden=true;flying.classList.remove('depositing');done();},220);}else{flying.hidden=true;done();}},390);
}
function finishTool(tool,message){
 state=recordTool(state,tool);$('slot-'+tool).innerHTML='';
 flight($('slot-'+tool),$('sample'),()=>{busy=false;$('use-'+tool).classList.remove('testing');render();status(allClues()?'Three clues recorded. Compare them with the guide and choose a bin.':message,'good');});
}
function useTool(tool){
 if(busy||state.phase!=='investigate')return;
 busy=true;render();$('use-'+tool).classList.add('testing');status(tool==='scale'?'Weighing the equal-volume sample…':tool==='scope'?'Bringing the sample into focus…':'Measuring magnetic response…');
 flight($('sample'),$('slot-'+tool),()=>{
  $('slot-'+tool).innerHTML=rockArt(state.order[state.index],state.index);
  if(tool==='scale'){for(let i=1;i<=8;i++)later(()=>{$('scale-reading').textContent=Math.round(current().mass*i/8)+' g';},i*85);later(()=>finishTool('scale','Mass recorded: '+current().mass+' g. Try another tool.'),900);}
  if(tool==='magnet'){for(let i=1;i<=5;i++)later(()=>{$('magnet-reading').textContent=i%2?'···':'TEST';},i*105);later(()=>finishTool('magnet','Magnet recorded: '+current().pull.toLowerCase()+' response. Try another tool.'),850);}
  if(tool==='scope')openScope('sample');
 });
}
function openScope(mode){
 scopeMode=mode;const guide=mode==='guide';$('scope-dialog').classList.toggle('guide-mode',guide);$('unknown-view').hidden=guide;$('scope-title').textContent=guide?'Your rock reference guide':'Match your sample';$('scope-eyebrow').textContent=guide?'THREE TRAINING SPECIMENS · SAME VOLUME':'MICROSCOPE · TEXTURE COMPARISON';$('scope-done').textContent=guide?'BACK TO LAB →':'RECORD OBSERVATION →';
 if(!guide){$('unknown-texture').style.setProperty('--texture-x',current().position);$('unknown-label').textContent='SAMPLE '+String.fromCharCode(65+state.index)+' · NAME UNKNOWN';$('observation').textContent=current().texture;}
 $('scope-dialog').showModal();
}
function closeScope(){
 if(!$('scope-dialog').open)return;$('scope-dialog').close();
 if(scopeMode==='sample'&&busy)finishTool('scope','Texture recorded. '+current().texture);
}
function chooseBin(bin){
 if(busy||state.phase!=='investigate')return;const result=sortSample(state,bin);
 if(result.kind==='locked'){const missing=TOOLS.filter(t=>!state.used[t]).map(t=>({scale:'scale',scope:'microscope',magnet:'magnet tester'}[t]));status('Collect all three clues first. Still needed: '+missing.join(', ')+'.','retry');return;}
 if(result.kind==='wrong'){state=result.state;$('bin-'+bin).classList.add('wrong');later(()=>$('bin-'+bin).classList.remove('wrong'),350);status('That bin doesn’t match all three clues. Compare with the reference guide and try again.','retry');return;}
 if(result.kind==='correct'){
  busy=true;render();status('Storing the sample…');flight($('sample'),$('stored-'+bin),()=>{state=result.state;render();status('Correct! '+ROCKS[bin].name+'. A new page entry is ready.','good');later(()=>{busy=false;render();openNotes('discovery');},650);},true);
 }
}
function renderNotes(highlight=null){
 $('notes-progress').textContent=state.sorted.length+' / 3 RECORDED';$('notes-dialog').classList.toggle('notes-complete',state.sorted.length===3);
 $('notes-entries').innerHTML=Array.from({length:3},(_,i)=>{const type=state.sorted[i];if(!type)return `<article class="note-entry note-empty" aria-label="Undiscovered rock entry ${i+1}"><div class="note-placeholder" aria-hidden="true">?</div><div><span class="entry-number">DISCOVERY ${i+1}</span><h3>Rock still to discover</h3><p>Investigate and sort another sample to fill this space.</p><div class="blank-lines" aria-hidden="true"></div></div></article>`;const r=ROCKS[type];return `<article class="note-entry discovered ${type===highlight?'new-entry':''}" data-rock="${type}"><div class="note-photo"><div class="texture" style="--texture-x:${r.position}" role="img" aria-label="Magnified ${r.name.toLowerCase()} texture illustration"></div><span>MICROSCOPE VIEW</span></div><div class="note-facts"><span class="entry-number">DISCOVERY ${i+1}${type===highlight?' · NEW!':''}</span><h3>${r.name}</h3><ul>${r.learning.map(fact=>`<li>${fact}</li>`).join('')}</ul><p class="specimen-reading"><b>OUR 100 cm³ SAMPLE:</b> ${r.mass} g · ${r.pull==='None'?'no detectable':r.pull.toLowerCase()} magnet response</p></div></article>`;}).join('');
}
function openNotes(mode='review'){
 if(state.sorted.length===0||$('notes-dialog').open)return;notesMode=mode;renderNotes(mode==='discovery'?state.sorted.at(-1):null);$('notes-intro').textContent=state.sorted.length===3?'Your sheet is complete. Three rocks, three stories from Mars.':'A new rock, a new piece of Mars’ story. Fill all three entries.';
 $('notes-continue').textContent=mode==='review'?(state.phase==='complete'?'BACK TO RESULTS →':'BACK TO LAB →'):(state.phase==='complete'?'FINISH COLLECTION →':'NEXT SAMPLE →');$('notes-dialog').showModal();$('notes-entries').scrollTop=0;$('notes-continue').focus({preventScroll:true});
 if(mode==='discovery'){const token=epoch;requestAnimationFrame(()=>{if(token===epoch&&$('notes-dialog').open)$('notes-entries').querySelector('.new-entry')?.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});}
}
function advanceSample(){if(state.phase!=='correct')return;state=nextSample(state);render();status('New sample. Use the three tools, then choose its bin.');$('sample').focus({preventScroll:true});}
function closeNotes(advance=false){
 if(!$('notes-dialog').open)return;$('notes-dialog').close();
 if(notesMode==='discovery'){if(state.phase==='complete'){win();return;}if(advance){advanceSample();return;}}
 if(!$('win').hidden)$('review-notes').focus({preventScroll:true});else if(state.phase==='correct')$('next').focus({preventScroll:true});else $('open-notes').focus({preventScroll:true});
}
function setGameInert(value){for(const selector of ['#tools','#bins','#sample-area','.controls','#reference-board','#open-notes'])document.querySelector(selector).inert=value;}
function win(){
 $('game').classList.add('complete');setGameInert(true);$('win').hidden=false;$('review-notes').focus({preventScroll:true});
 for(let i=0;i<27;i++){const p=document.createElement('i');p.className='spark';p.style.cssText=`--x:${4+i*3.5}%;--delay:${i%6*.1}s;--colour:${['#f3c774','#8bdbca','#e78b60'][i%3]}`;$('celebration').append(p);}later(()=>$('celebration').replaceChildren(),4000);
}
function reset(){
 epoch++;for(const timer of timers)clearTimeout(timer);timers.clear();if($('scope-dialog').open)$('scope-dialog').close();if($('manual').open)$('manual').close();if($('notes-dialog').open)$('notes-dialog').close();notesMode='review';drag=null;suppressClick=false;busy=false;document.body.classList.remove('dragging');flying.hidden=true;flying.classList.remove('depositing');$('celebration').replaceChildren();$('win').hidden=true;$('game').classList.remove('complete');setGameInert(false);
 for(const tool of TOOLS){$('use-'+tool).classList.remove('testing');$('slot-'+tool).innerHTML='';}for(const id of Object.keys(ROCKS))$('bin-'+id).classList.remove('wrong');state=newGame();render();renderNotes();status('Start with any tool. All samples have the same volume.');
}
function cancelDrag(){drag=null;document.body.classList.remove('dragging');flying.hidden=true;$('sample').classList.remove('in-transit');document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));}
$('sample').addEventListener('pointerdown',event=>{if(busy||state.phase!=='investigate')return;drag={x:event.clientX,y:event.clientY,moved:false};$('sample').setPointerCapture(event.pointerId);});
document.addEventListener('pointermove',event=>{if(!drag)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7)drag.moved=true;if(!drag.moved)return;document.body.classList.add('dragging');$('sample').classList.add('in-transit');flying.innerHTML=rockArt(state.order[state.index],state.index);flying.hidden=false;positionFlyingRock(event.clientX, event.clientY);document.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-tool],[data-bin]');target?.classList.add('drag-over');});
document.addEventListener('pointerup',event=>{if(!drag)return;const moved=drag.moved,target=moved?document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-tool],[data-bin]'):null;cancelDrag();if(!moved)return;suppressClick=true;if(target?.dataset.tool)useTool(target.dataset.tool);else if(target?.dataset.bin)chooseBin(target.dataset.bin);else status('Drop on a tool or a collection bin. You can also tap the equipment.');});
document.addEventListener('pointercancel',cancelDrag);
$('sample').addEventListener('click',()=>{if(suppressClick){suppressClick=false;return;}$('sample').classList.toggle('picked');status('Sample '+String.fromCharCode(65+state.index)+' ready. Tap a tool to investigate, or drag the rock onto it.');});
for(const tool of TOOLS)$('use-'+tool).addEventListener('click',()=>useTool(tool));for(const bin of Object.keys(ROCKS))$('bin-'+bin).addEventListener('click',()=>chooseBin(bin));
$('reference-board').addEventListener('click',()=>{if(!busy)openScope('guide');});$('scope-done').addEventListener('click',closeScope);$('close-scope').addEventListener('click',closeScope);$('scope-dialog').addEventListener('cancel',event=>{event.preventDefault();closeScope();});
$('next').addEventListener('click',advanceSample);$('restart').addEventListener('click',reset);
$('open-notes').addEventListener('click',()=>{if(!busy)openNotes('review');});$('review-notes').addEventListener('click',()=>openNotes('review'));$('notes-continue').addEventListener('click',()=>closeNotes(true));$('close-notes').addEventListener('click',()=>closeNotes(false));$('notes-dialog').addEventListener('cancel',event=>{event.preventDefault();closeNotes(false);});
if (window.parent !== window && new URLSearchParams(location.search).get('from') === 'research-station') {
 const returnLink = document.querySelector('#win .task-return');
 returnLink.textContent = '← Return to rover';
 returnLink.href = '../../index.html#chapter-1';
 returnLink.addEventListener('click', event => {
  event.preventDefault();
  if (!$('win').hidden) window.parent.postMessage('mission-trainer:research-task-complete', '*');
 });
}
$('help').addEventListener('click',()=>{$('manual').showModal();});$('close-manual').addEventListener('click',()=>$('manual').close());$('ready').addEventListener('click',()=>$('manual').close());$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}});
$('wall-references').innerHTML=Object.entries(ROCKS).map(([id,r])=>`<span class="wall-card"><b>${r.name}</b><small>${r.mass} g · ${r.pull==='None'?'no':r.pull.toLowerCase()} pull</small></span>`).join('');
$('scope-references').innerHTML=Object.entries(ROCKS).map(([id,r])=>`<article class="reference-card"><div class="texture" style="--texture-x:${r.position}" role="img" aria-label="Illustrated magnified ${r.name.toLowerCase()} texture"></div><h3>${r.name}</h3><p>${r.texture}</p><p><b>${r.mass} g</b> · ${r.pull==='None'?'no detectable':r.pull.toLowerCase()} magnet response</p><p class="fact">${r.fact}</p></article>`).join('');
reset();

})();
