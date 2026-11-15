const canvas = document.getElementById("workbench");
const ctx = canvas.getContext("2d");
const line = document.getElementById("line");
const hint = document.getElementById("input-hint");
const coachSpeech = document.getElementById("coach-speech");
const repairComplete = document.getElementById("repair-complete");
const continueTasks = document.getElementById("continue-tasks");
const marks = [...document.querySelectorAll(".steps li")];
const waterReserve = document.querySelector(".water-reserve");
const waterMeter = document.getElementById("water-meter");
const waterFill = document.getElementById("water-fill");
const waterLabel = document.getElementById("water-label");
const waterNote = document.getElementById("water-note");
const initialWater = 58;
const drainTime = 25_000;
const testTime = 2200;
const waterStarted = performance.now();
let lastWaterPercent = -1;

function remainingWater(now) {
  return initialWater * Math.max(0, 1 - (now - waterStarted) / drainTime);
}

function updateWaterReserve(now) {
  const restored = Math.max(0, Math.min(1, (now - state.started) / testTime));
  const level = state.stage === 7 ? 100
    : state.stage === 6 ? waterAtTest + (100 - waterAtTest) * restored
    : remainingWater(now);
  const percent = Math.ceil(level);
  if (percent !== lastWaterPercent) {
    lastWaterPercent = percent;
    waterMeter.setAttribute("aria-valuenow", String(percent));
    waterFill.style.width = percent + "%";
  }
  const status = state.stage === 7 ? "Stable" : state.stage === 6 ? "Rising"
    : percent === 0 ? "Empty" : percent <= 20 ? "Critical" : "Low";
  if (waterReserve.dataset.level === status.toLowerCase()) return;
  waterReserve.dataset.level = status.toLowerCase();
  waterLabel.textContent = status.toUpperCase();
  waterNote.textContent = {
    Low: "Water reserve is dropping.",
    Critical: "Water reserve is nearly empty.",
    Empty: "Finish the repair to restore water.",
    Rising: "Clean water is flowing again.",
    Stable: "Water reserve restored."
  }[status];
}

const stages = [
  [0, "Grab the orange wheel. Turn it clockwise until the flow stops.", "Drag around the wheel clockwise.", "valve"],
  [1, "Pull the hatch handle to the right. The worn filter is inside.", "Drag the handle right.", "hatch"],
  [2, "That’s the worn filter. Pull it out and drop it in the left tray.", "Drag the W-2 cartridge to the tray marked USED FILTER.", "old"],
  [2, "Now pick up the fresh W-2. Slide it into the empty slot.", "Drag from the right tray to the highlighted slot.", "spare"],
  [2, "The spare is seated. Slide the hatch shut.", "Drag the hatch handle left.", "hatch"],
  [3, "Turn the wheel back to let water run through the new filter.", "Drag around the wheel counterclockwise.", "valve"],
  [3, "Watch the water reach the tester. The clean tank stays shut while it runs.", "", null],
  [4, "", "", null]
];
const wheel = { x: 230, y: 237, r: 56 };
const slot = { x: 489, y: 237 };
const leftTray = { x: 250, y: 443 };
const rightTray = { x: 711, y: 443 };
const initial = () => ({ stage: 0, turn: 0, hatch: 0, drag: null, started: 0 });
let state = initial();
let waterAtTest = 0;

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}
function shape(points, color, stroke = null, width = 1, radius = 0) {
  ctx.beginPath();
  if (radius) {
    const last = points.at(-1);
    ctx.moveTo((last[0] + points[0][0]) / 2, (last[1] + points[0][1]) / 2);
    points.forEach(([x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length];
      ctx.arcTo(x, y, (x + nx) / 2, (y + ny) / 2, radius);
      ctx.lineTo((x + nx) / 2, (y + ny) / 2);
    });
  } else {
    points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) { ctx.lineWidth = width; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function circle(x, y, r, color, stroke, width = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (color) { ctx.fillStyle = color; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = width; ctx.stroke(); }
}
function stroke(points, width, color) {
  ctx.beginPath();
  points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}
function text(value, x, y, size, color, align = "left") {
  ctx.fillStyle = color;
  ctx.font = "800 " + size + "px Consolas, monospace";
  ctx.textAlign = align;
  ctx.fillText(value, x, y);
}
function shade(y1, y2, colors) {
  const gradient = ctx.createLinearGradient(0, y1, 0, y2);
  colors.forEach((color, i) => {
    gradient.addColorStop(i / colors.length, color);
    gradient.addColorStop((i + 1) / colors.length, color);
  });
  return gradient;
}
function plate(x, y, w, h, colors = ["#fff0ce", "#dfb898", "#b28470"], corner = 12) {
  shape([[x+corner,y],[x+w-corner,y],[x+w,y+corner],[x+w,y+h-corner],
    [x+w-corner,y+h],[x+corner,y+h],[x,y+h-corner],[x,y+corner]],
  shade(y,y+h,colors), "#392725",4);
  stroke([[x+corner,y+4],[x+w-corner,y+4],[x+w-4,y+corner]],2,"#fff0cf");
}
function wear(x, y, w, h, count, seed, light = "#fff0cf4a", dark = "#623f3448") {
  for (let i = 0; i < count; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const px = x + (seed % w);
    const py = y + ((seed >>> 12) % h);
    rect(px, py, i % 5 === 0 ? 5 : 2, 2, i % 2 ? light : dark);
  }
}
function copper(points, width) {
  stroke(points, width+7, "#34211e");
  stroke(points, width, "#87422b");
  stroke(points.map(([x,y]) => [x,y-2]), width-7, "#cf632e");
  stroke(points.map(([x,y]) => [x,y-5]), Math.max(2,width/4), "#ffb274");
}
function vent(x, y, w) {
  rect(x, y, w, 17, "#553d36");
  rect(x+2, y+2, w-4, 12, "#211d20");
  for (let dx=5; dx<w-4; dx+=6) rect(x+dx, y+3, 2, 10, "#76574b");
}
function bolt(x, y) {
  circle(x, y, 5, "#ead1ac", "#644638", 2);
  stroke([[x - 2, y + 2], [x + 2, y - 2]], 1.5, "#5a4539");
}
function halo(x, y, w, h) {
  ctx.save();
  ctx.setLineDash([7, 5]);
  ctx.strokeStyle = "#a7fbff";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}
function cartridge(x, y, fresh, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  rect(-36, -49, 77, 105, "#120f10aa");
  plate(-34,-49,68,98,["#f7d7b0","#c09779","#8d6659"],9);
  rect(-25,-31,50,65,"#342526");
  rect(-21,-27,42,57,shade(-27,30,fresh ? ["#d5f8ee","#84bfc1","#56919e"] : ["#ddaf7c","#96674c","#664334"]));
  for (let dx = -18; dx < 22; dx += 6) {
    rect(dx,-26,2,54,fresh ? "#426f78" : "#58362d");
    rect(dx+2,-26,1,54,fresh ? "#f3ffea" : "#e4ab79");
  }
  wear(-20,-24,39,50,fresh ? 12 : 44,814,"#f6d3a760","#51332a8a");
  if (!fresh) {
    shape([[-18,-23],[-10,-27],[-4,-19],[-2,-15],[-12,-12],[-17,-15]],"#573620");
    shape([[8,20],[20,13],[20,25],[15,29],[6,27]],"#543521");
  }
  for (const y of [-44,34]) {
    rect(-32,y,64,5,fresh ? "#87d4cf" : "#e68a55");
    bolt(-24,y+6);
    bolt(24,y+6);
  }
  rect(-20,-8,40,20,"#203037");
  text("W-2",0,7,15,fresh ? "#b7fffb" : "#ffd5a8","center");
  ctx.restore();
}
function tank(x, y, active) {
  plate(x,y,54,156,["#ffdeb0","#c29579","#80594d"],12);
  plate(x+7,y+22,40,105,["#255264","#193442","#14232f"],6);
  rect(x+10,y+59,34,63,shade(y+59,y+122,active ? ["#70e7ee","#178da9","#15566f"] : ["#35818a","#226075","#143a50"]));
  rect(x+10,y+59,34,2,active ? "#bbffff" : "#69a8ae");
  rect(x+15,y+32,3,85,"#b1eef951");
  wear(x+11,y+64,31,52,24,125,"#b7fff668","#10364457");
  for (const dy of [13,133]) {
    rect(x-4,y+dy,62,10,"#684539");
    rect(x-3,y+dy+2,60,4,"#e0b895");
    bolt(x+5,y+dy+4);
    bolt(x+49,y+dy+4);
  }
}

function machine(now) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  shape([[125,64],[811,64],[869,134],[869,358],[90,358],[90,112]], "#201a1d", "#100e10", 8);
  shape([[125,64],[812,64],[843,100],[112,100]], "#f3cba1", "#754e3b", 3);
  shape([[812,64],[869,134],[869,359],[842,331],[842,100]], "#664438", "#302321", 3);
  plate(94,92,756,251,["#f1d0ae","#dcb497","#ae8270"],18);
  plate(120,113,704,202,["#8f6554","#c39477","#987063"],13);
  rect(134,125,676,178,shade(125,303,["#382a2b","#4a3531","#33292b"]));
  wear(139,128,663,170,160,727,"#b1896740","#18141c55");
  plate(348,72,274,39,["#ffe8c1","#c89f84","#987260"],7);
  rect(368,82,234,18,"#362722");
  text("WATER RECYCLER",485,96,14,"#ffdcaa","center");
  for (const x of [360,610]) bolt(x,91);
  vent(275,317,108);
  vent(580,317,107);
  wear(141,319,663,13,50,122);
  for (const [x, y] of [[123,109],[832,109],[123,324],[832,324]]) bolt(x,y);
  const wire = [[78,265],[152,265],[177,235],[724,235],[748,270],[875,270]];
  ctx.lineJoin = "round";
  copper(wire,25);
  for(const x of [305,366,667]) {
    plate(x,216,13,37,["#e6c7a8","#9a7968","#68514b"],3);
    rect(x+4,220,3,28,"#57423e");
  }
  const elapsed = Math.max(0, now - state.started);
  const running = state.stage === 6 || state.stage === 7;
  const test = state.stage === 7 ? 1 : Math.min(1, elapsed / testTime);
  if (running) {
    ctx.save();
    ctx.setLineDash([12, 11]);
    ctx.lineDashOffset = -(elapsed / 18) % 23;
    const end = 240 + 485 * test;
    stroke([[240,235],[end,235]], 5, "#8af6ff");
    if (state.stage === 7) stroke(wire.slice(3), 5, "#8af6ff");
    ctx.restore();
  }
  tank(25,161,false);
  tank(874,161,state.stage === 7);
  text("INTAKE",52,335,11,"#ffdfbe","center");
  text("CLEAN",901,335,11,"#ffdfbe","center");

  plate(400,145,177,168,["#ead4b5","#a8816a","#78554c"],12);
  rect(416, 162, 146, 137, "#191725");
  rect(423,167,132,11,"#3d343b");
  for (const offset of [-1, 1]) rect(487 + offset * 56, 182, 6, 104, "#6e5347");
  rect(444, 168, 88, 7, "#8f715e");
  rect(444, 290, 88, 5, "#685045");
  if (state.stage < 3 && state.drag?.kind !== "old") cartridge(slot.x, slot.y, false, .96);
  if (state.stage >= 4) cartridge(slot.x, slot.y, true, .96);
  const doorX = 410 + state.hatch * 166;
  rect(doorX + 8, 160, 157, 149, "#150d13aa");
  plate(doorX,153,150,152,["#fff0cf","#e4ba96","#ad7962"],14);
  plate(doorX+14,172,98,100,["#e0914d","#be632f","#8c492f"],12);
  plate(doorX+22,180,82,84,["#fce1b9","#d9b396","#c2967a"],9);
  wear(doorX+25,185,70,70,44,401);
  for (const [dx,y] of [[13,168],[137,169],[14,289],[136,288]]) bolt(doorX+dx,y);
  rect(doorX+35,212,56,18,"#342822");
  text("FILTER", doorX+63, 225, 12, "#ffe3bc", "center");
  vent(doorX+44,240,39);
  rect(doorX+117,204,25,62,"#523a33");
  rect(doorX+121,209,17,52,"#261b1d");
  stroke([[doorX+123,214],[doorX+135,214],[doorX+135,256],[doorX+123,256]], 11, "#593725");
  stroke([[doorX+123,212],[doorX+133,212],[doorX+133,254],[doorX+123,254]], 5, "#ffb768");

  plate(169,173,124,125,["#f4d3af","#aa7962","#8a5c4b"],17);
  for(const dx of [-45,45]) for(const dy of [-45,44]) bolt(wheel.x+dx,wheel.y+dy);
  circle(wheel.x, wheel.y, 49, "#63504a", "#2f1a19", 5);
  ctx.save();
  ctx.translate(wheel.x, wheel.y);
  ctx.rotate(state.turn * Math.PI / 2);
  circle(0, 0, 43, "#402421", "#672d24", 15);
  circle(0, -1, 42, null, "#dd783d", 10);
  circle(0, -2, 45, null, "#ffbb77", 3);
  for (let i=0; i<4; i++) {
    ctx.rotate(Math.PI/2);
    stroke([[0,0],[0,-41]], 10, "#502b24");
    stroke([[0,0],[0,-38]], 5, "#d9814e");
  }
  circle(0,0,12,"#cba486","#422720",3);
  circle(0,-42,7,"#ffe098");
  ctx.restore();
  text("FLOW VALVE", wheel.x, 165, 15, "#ffdebf", "center");
  text(state.turn >= .98 ? "CLOSED" : state.turn <= .02 ? "OPEN" : "TURNING", wheel.x, 310, 13, "#ffdcab", "center");

  plate(721,130,95,87,["#ffdfb6","#c39376","#8e6555"],10);
  plate(731,140,75,64,["#254754","#142b3d","#102433"],6);
  for(let x=739;x<802;x+=7) rect(x,147,1,51,"#235567");
  for(let y=150;y<199;y+=7) rect(736,y,64,1,"#235567");
  text("WATER TEST", 768, 158, 10, "#a9f7ff", "center");
  stroke([[737,178],[746,178],[751,171],[756,183],[765,183],[771,168],[777,179],[785,174],[799,174]],2,state.stage === 7 ? "#9df3bc" : "#56cdda");
  rect(740, 189, 56, 7, "#234d56");
  rect(740, 189, state.stage === 7 ? 56 : running ? 56 * test : 0, 7, state.stage === 7 ? "#97f3b7" : "#6beaf8");
  circle(806, 272, 9, state.stage === 7 ? "#92ffc3" : "#f3af69", "#4f3932", 3);
  text("CLEAN TANK", 816, 300, 12, "#ffe2bc", "right");

  shape([[90,344],[867,344],[953,527],[7,527]], shade(345,530,["#ebc8a6","#cbab90","#ad8270"]), "#332622", 4, 22);
  stroke([[96,349],[864,349]], 4, "#ffe9c8");
  for(const [top,bottom] of [[191,118],[389,365],[580,593],[776,835]]) {
    stroke([[top,350],[bottom,524]],3,"#8d695c");
    stroke([[top+4,350],[bottom+4,524]],2,"#efcdb1");
  }
  wear(93,353,772,166,440,17206,"#fff1d367","#95695c70");
  for (const tray of [leftTray, rightTray]) {
    shape([[tray.x-88,384],[tray.x+88,384],[tray.x+107,473],[tray.x+97,484],[tray.x-97,484],[tray.x-107,473]], "#bd8f71", "#392724", 4);
    shape([[tray.x-77,392],[tray.x+77,392],[tray.x+93,469],[tray.x-93,469]], "#45353a", "#f1cd9d", 3);
    stroke([[tray.x-72,401],[tray.x+72,401]],3,"#78564b");
    for(const dir of [-1,1]) bolt(tray.x+dir*95,475);
  }
  for(const [tray,label] of [[leftTray,"USED FILTER"],[rightTray,"SPARE · W-2"]]) {
    plate(tray.x-60,488,120,22,["#f5d5ac","#e8c5a1","#b68970"],4);
    text(label,tray.x,504,12,"#38251f","center");
  }
  if (state.stage >= 3) cartridge(leftTray.x, leftTray.y - 8, false, .72);
  if (state.stage < 4 && state.drag?.kind !== "spare") cartridge(rightTray.x, rightTray.y - 8, true, .72);
  if (state.stage === 2) halo(leftTray.x - 100, 386, 200, 94);
  if (state.stage === 3) {
    halo(slot.x - 46, slot.y - 60, 92, 120);
    if (!state.drag) halo(rightTray.x-40,rightTray.y-49,80,82);
  }
  if (!state.drag) {
    if (state.stage === 0 || state.stage === 5) circle(wheel.x, wheel.y, 62, null, "#a7fbff", 1.5);
    if (state.stage === 1 || state.stage === 4) halo(doorX + 114, 202, 35, 66);
    if (state.stage === 2) halo(slot.x-39,slot.y-53,78,106);
  }
  if (["old", "spare"].includes(state.drag?.kind)) {
    const { kind, x, y } = state.drag;
    const scale = kind === "old" ? 1 + Math.max(0, y - slot.y) / 420 : .72 + Math.max(0, rightTray.y - y) / 550;
    cartridge(x, y, kind === "spare", scale);
  }
  if (state.stage === 6 && elapsed >= testTime) advance();
  updateWaterReserve(now);
  requestAnimationFrame(machine);
}

function targetAt(x, y) {
  const target = stages[state.stage][3];
  if (target === "valve" && Math.hypot(x - wheel.x, y - wheel.y) <= wheel.r + 13) return target;
  if (target === "hatch" && Math.abs(x - (527 + state.hatch * 166)) < 49 && Math.abs(y - 234) < 69) return target;
  if (target === "old" && Math.abs(x - slot.x) < 70 && Math.abs(y - slot.y) < 72) return target;
  if (target === "spare" && Math.abs(x - rightTray.x) < 91 && Math.abs(y - rightTray.y) < 63) return target;
  return null;
}
const clamp = v => Math.max(0, Math.min(1, v));
function updateCaption() {
  const [index, message, info] = stages[state.stage];
  line.textContent = message;
  hint.textContent = info + (info && state.stage < 6 ? " Keyboard: hold the arrow keys." : "");
  marks.forEach((mark, i) => {
    mark.classList.toggle("done", i < index);
    if (i === index) mark.setAttribute("aria-current", "step");
    else mark.removeAttribute("aria-current");
  });
}
function showCompletion() {
  coachSpeech.hidden = true;
  canvas.parentElement.inert = true;
  const confetti = Array.from({ length: 16 }, (_, i) => {
    const piece = document.createElement("i");
    piece.style.cssText = `--x:${12 + i * 5}%;--delay:${i % 5 * .12}s`;
    return piece;
  });
  repairComplete.querySelector(".completion-effects").append(...confetti);
  repairComplete.hidden = false;
  continueTasks.focus({ preventScroll: true });
}
// Sound for finishing each repair stage (index = stage just reached).
const stageSounds = [null, 'valve', 'hatch', 'drop', 'install', 'slide', 'flow', 'win'];
function advance() {
  state.stage++;
  if (stageSounds[state.stage]) SFX.play(stageSounds[state.stage]);
  state.drag = null;
  state.turn = state.stage >= 6 ? 0 : 1;
  state.hatch = state.stage >= 2 && state.stage <= 4 ? 1 : 0;
  state.started = performance.now();
  if (state.stage === 6) {
    waterAtTest = remainingWater(state.started);
  }
  canvas.dataset.cursor = "default";
  updateCaption();
  if (state.stage === 7) showCompletion();
}
function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return { x: (event.clientX - bounds.left) * 960 / bounds.width, y: (event.clientY - bounds.top) * 530 / bounds.height };
}
function angle(x,y) { return Math.atan2(y-wheel.y, x-wheel.x); }
canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0 || state.drag?.id != null) return;
  const p = point(event);
  const kind = targetAt(p.x, p.y);
  if (!kind) return;
  canvas.classList.add("pointer-focused");
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  if (kind === 'old' || kind === 'spare') SFX.play('pickup');
  state.drag = { kind, id: event.pointerId, angle: angle(p.x,p.y), start: p.x,
    opening: state.hatch, x: p.x, y: p.y };
  canvas.dataset.cursor = "grabbing";
});
canvas.addEventListener("pointermove", event => {
  const p = point(event);
  const drag = state.drag;
  if (!drag || drag.id !== event.pointerId) {
    if (!drag) canvas.dataset.cursor = targetAt(p.x, p.y) ? "grab" : "default";
    return;
  }
  drag.x = p.x;
  drag.y = p.y;
  if (drag.kind === "valve") {
    const next = angle(p.x,p.y);
    const delta = Math.atan2(Math.sin(next - drag.angle), Math.cos(next - drag.angle));
    const before = state.turn;
    state.turn = clamp(state.turn + delta / (Math.PI / 2));
    if (Math.floor(before * 8) !== Math.floor(state.turn * 8)) SFX.play('tick');
    drag.angle = next;
    if ((state.stage === 0 && state.turn >= .97) || (state.stage === 5 && state.turn <= .03)) advance();
  } else if (drag.kind === "hatch") {
    state.hatch = clamp(drag.opening + (p.x - drag.start) / 166);
    if ((state.stage === 1 && state.hatch >= .96) || (state.stage === 4 && state.hatch <= .04)) advance();
  }
});
canvas.addEventListener("pointerup", event => {
  const drag = state.drag;
  if (!drag || drag.id !== event.pointerId) return;
  const { x, y } = point(event);
  if (drag.kind === "old" && Math.abs(x - leftTray.x) < 103 && Math.abs(y - leftTray.y) < 69) advance();
  else if (drag.kind === "spare" && Math.abs(x - slot.x) < 66 && Math.abs(y - slot.y) < 67) advance();
  else {
    if (drag.kind === "old" || drag.kind === "spare") SFX.play('back');
    if (drag.kind === "old" || drag.kind === "spare") line.textContent = stages[state.stage][1];
    state.drag = null;
  }
  canvas.dataset.cursor = targetAt(x, y) ? "grab" : "default";
});
canvas.addEventListener("lostpointercapture", () => { state.drag = null; canvas.dataset.cursor = "default"; });
canvas.addEventListener("keydown", event => {
  const key = event.key;
  if (!key.startsWith("Arrow") || state.stage >= 6 || state.drag?.id != null) return;
  event.preventDefault();
  if (state.stage === 0 || state.stage === 5) {
    if (key === "ArrowRight") state.turn = clamp(state.turn + .13);
    if (key === "ArrowLeft") state.turn = clamp(state.turn - .13);
    if ((state.stage === 0 && state.turn >= .97) || (state.stage === 5 && state.turn <= .03)) advance();
  } else if (state.stage === 1 || state.stage === 4) {
    if (key === "ArrowRight") state.hatch = clamp(state.hatch + .13);
    if (key === "ArrowLeft") state.hatch = clamp(state.hatch - .13);
    if ((state.stage === 1 && state.hatch >= .96) || (state.stage === 4 && state.hatch <= .04)) advance();
  } else {
    const start = state.stage === 2 ? slot : rightTray;
    state.drag ??= { kind: stages[state.stage][3], x: start.x, y: start.y };
    const drag = state.drag;
    if (key === "ArrowLeft") drag.x -= 17;
    if (key === "ArrowRight") drag.x += 17;
    if (key === "ArrowDown") drag.y += 17;
    if (key === "ArrowUp") drag.y -= 17;
    drag.x = Math.max(50, Math.min(910, drag.x));
    drag.y = Math.max(65, Math.min(475, drag.y));
    const end = state.stage === 2 ? leftTray : slot;
    if (Math.hypot(drag.x - end.x, drag.y - end.y) < 49) advance();
  }
});
updateCaption();
requestAnimationFrame(machine);
canvas.addEventListener("blur", () => canvas.classList.remove("pointer-focused"));
window.addEventListener("keydown", event => {
  if (event.key === "Escape" && !event.repeat) location.href = "../../index.html#tasks";
});
