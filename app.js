const scene = document.querySelector('#scene');
const outpostGame = document.querySelector('#outpost-game');
const worldWidth = 320;
const worldHeight = 144;
const terrain = document.querySelector('#terrain');
const baseInterior = document.querySelector('#base-interior');
const vehicleInteriors = {
  rocket: document.querySelector('#rocket-interior'),
  rover: document.querySelector('#rover-interior')
};
const astronaut = document.querySelector('#astronaut');
const astronautAtlas = document.createElement('img');
astronautAtlas.src = 'astronaut-eva.png';
astronautAtlas.alt = '';
astronautAtlas.draggable = false;
astronaut.append(astronautAtlas);
const climbAtlas = document.createElement('img');
climbAtlas.src = 'astronaut-ladder.png';
climbAtlas.className = 'climb-atlas';
climbAtlas.alt = '';
climbAtlas.draggable = false;
climbAtlas.hidden = true;
astronaut.append(climbAtlas);
const astronautShadow = document.createElement('span');
astronautShadow.className = 'astronaut-shadow';
astronautShadow.setAttribute('aria-hidden', 'true');
astronaut.before(astronautShadow);
const stations = document.querySelector('#stations');
const markers = [...stations.querySelectorAll('.marker')];
const interaction = document.querySelector('#interaction');
const landingSequence = document.querySelector('#landing-sequence');
const landingCraft = landingSequence.querySelector('.landing-craft');
const baseAirlock = document.querySelector('#base-airlock');
const airlockLever = baseAirlock.querySelector('.airlock-lever');
const airlockStatus = baseAirlock.querySelector('.airlock-status');
const airlockChamber = baseAirlock.querySelector('.airlock-chamber');
const airlockSteam = createAirlockSteam(baseAirlock.querySelector('.airlock-steam'));
const landingObjective = document.querySelector('#landing-objective');
const landingAchievement = document.querySelector('#landing-achievement');
const touchJump = document.querySelector('#touch-jump');
const touchAction = document.querySelector('#touch-action');
const consoleButton = document.querySelector('[data-base-target="pc"]');
let activeConsoleButton = consoleButton;
const lifeSupport = document.querySelector('#console');
const closeConsole = document.querySelector('#close-console');
const topbar = document.querySelector('.topbar');
const baseHotspots = document.querySelector('#base-hotspots');
const baseHelp = document.querySelector('#base-help');
const subroomHelp = document.querySelector('#subroom-help');
const baseSubroom = document.querySelector('#base-subroom');
const subroomBack = document.querySelector('#subroom-back');
const subroomControls = document.querySelectorAll('[data-subroom-action]');
const basePanel = document.querySelector('#base-panel');
const closeBasePanel = document.querySelector('#close-base-panel');
const touchControls = document.querySelector('.touch-controls');
const movementHelp = document.querySelectorAll('.keyboard-help, .touch-help');
const basePanels = {
  computerLocked: ['Computer offline', 'Install all three server blocks in the base to unlock the computers.'],
  servers: ['Research servers', '0 datasets archived. Research collected by the rover at other stations will be stored here.'],
  crops: ['Crops · 100% food reserve', 'Carrots, potatoes, beetroot, lettuce and tomatoes grow under LED lights. Irrigation delivers water and nutrients to the roots.'],
  water: ['Water · 100% tank capacity', 'The recovery system cleans wastewater and cabin condensation before returning it to storage. A separate loop supplies the crop trays.'],
  oxygen: ['Oxygen · 100% reserve', 'The plants release oxygen in the light. A separate crew life-support unit splits purified water to produce breathable oxygen.'],
  energy: ['Energy · 100% battery reserve', 'Solar arrays charge the batteries during daylight. Dust can cut solar output, so the console tracks generation and reserve.'],
  radiation: ['Radiation · 0% of simulated limit', 'The external detector tracks radiation from cosmic rays and solar particles. The crew monitor tracks accumulated exposure.']
};
const subrooms = {
  greenhouse: ['crops', 'water', 'oxygen'],
  systems: ['systems-pc', 'energy', 'radiation']
};
let panelTrigger;

const doors = { base: 73, rocket: 175, rover: 268 };
const movementKeys = { ArrowLeft: -1, ArrowRight: 1, KeyA: -1, KeyD: 1 };
const jumpSpeed = 96;
const gravity = 270;
const pilotHopSpeed = 63;
const pilotSeatPause = 300;
const pilotSurfaceStop = 151;
// Keep a single anchor so changing poses cannot shift the character.
const bootPadding = 1 / 124;
const gait = [1, 2, 3, 4];
const climbSteps = 8;
const climbDuration = 1600;
const surfaceFraming = { width: 1, height: 1, top: 0 };
const heldKeys = new Set();
const heldPointers = new Map();
let room = null;
let rocketDeck = 'storage';
let climb = null;
let x = 113;
let jumpHeight = 0;
let jumpStartedAt = null;
let jumpStartHeight = 0;
let jumpStartSpeed = jumpSpeed;
let jumpGravity = gravity;
let stride = 0;
let facing = -1;
let lastFrame = null;
let action = null;
let currentHint = null;
let currentPose = -1;
let framePending = false;
let hasLanded = false;
let landingAchievementTimer;
const roverDrive = createRoverDrive(toOutpost => {
  if (toOutpost) changeScene(null);
  touchControls.hidden = false;
  updateAction();
  scene.focus({ preventScroll: true });
  requestFrame();
});
let pilotExit = null;
let arrivalTitleActive = false;
let baseAirlockSeen = false;
let airlockTimer;
let airlockDrag;
let suppressLeverClick = false;
let landingSound = null;
let airShowerSound = null;

// Opening/closing a hatch or door plays a pressurized hiss.
function passHatch(nextRoom) {
  SFX.play('hatch');
  changeScene(nextRoom);
}

const sceneSize = { width: scene.clientWidth, height: scene.clientHeight };
new ResizeObserver(([entry]) => {
  sceneSize.width = entry.contentRect.width;
  sceneSize.height = entry.contentRect.height;
  requestFrame();
}).observe(scene);

function requestFrame() {
  if (framePending) return;
  framePending = true;
  lastFrame ??= performance.now();
  requestAnimationFrame(tick);
}

function jump(speed = jumpSpeed) {
  if (!baseAirlock.hidden) return;
  if (jumpStartedAt === null && !climb && lifeSupport.hidden) {
    jumpStartedAt = performance.now();
    jumpStartHeight = 0;
    jumpStartSpeed = speed;
    jumpGravity = gravity;
    SFX.play('jump');
  if (room === 'rocket' || room === 'rover') updateAction();
    requestFrame();
  }
}

function shortenJump() {
  if (jumpStartedAt === null || jumpGravity !== gravity) return;
  const now = performance.now();
  const elapsed = Math.max(0, (now - jumpStartedAt) / 1000);
  const speed = jumpStartSpeed - gravity * elapsed;
  if (speed <= 0) return;
  jumpStartHeight += elapsed * (jumpStartSpeed - gravity * elapsed / 2);
  jumpStartSpeed = speed;
  jumpGravity = gravity * 3;
  jumpStartedAt = now;
}

function jumpClearance(area, center) {
  if (!area?.ceiling) return Infinity;
  // Ceiling points leave room for the astronaut's shoulders at sloped walls.
  const roof = area.ceiling;
  const index = roof.findIndex(([position]) => position >= center);
  const [left, leftHeight] = roof[Math.max(0, index - 1)];
  const [right, rightHeight] = roof[index];
  const ceiling = left === right ? rightHeight
    : leftHeight + (rightHeight - leftHeight) * (center - left) / (right - left);
  return Math.max(0, area.floor - rooms[room].spriteHeight * worldHeight * (1 - bootPadding) - ceiling);
}

function setConsole(open, trigger = activeConsoleButton) {
  if (open && !cargoSetup.canOpenComputer()) {
    openBasePanel('computerLocked', trigger);
    return;
  }
  if (open === !lifeSupport.hidden) return;
  SFX.play(open ? 'boot' : 'close');
  activeConsoleButton = trigger;
  lifeSupport.hidden = !open;
  outpostGame.inert = open;
  topbar.inert = open;
  trigger.setAttribute('aria-expanded', String(open));
  heldKeys.clear();
  heldPointers.clear();
  if (open) {
    lifeSupport.scrollTop = 0;
    closeConsole.focus();
  } else if (room === 'base') {
    trigger.focus();
  } else {
    scene.focus();
  }
}

function changeScene(nextRoom, startingDeck = 'storage') {
  x = nextRoom ? rooms[nextRoom].spawn : doors[room];
  if (nextRoom === 'rocket' && startingDeck === 'cabin') x = rooms.rocket.decks.cabin.pilotSeat;
  jumpHeight = 0;
  jumpStartedAt = null;
  stride = 0;
  room = nextRoom;
  rocketDeck = startingDeck;
  climb = null;
  scene.dataset.room = room ?? 'surface';
  const { width, height, top } = rooms[room]?.framing ?? surfaceFraming;
  scene.style.setProperty('--vehicle-width', width * 100 + '%');
  scene.style.setProperty('--vehicle-height', height * 100 + '%');
  scene.style.setProperty('--vehicle-top', top * 100 + '%');
  const inBase = room === 'base';
  scene.classList.toggle('in-base', inBase);
  baseHotspots.hidden = !inBase;
  baseSubroom.hidden = true;
  baseHelp.hidden = !inBase;
  subroomHelp.hidden = true;
  basePanel.hidden = true;
  astronaut.hidden = inBase;
  astronautShadow.hidden = inBase;
  for (const [name, image] of Object.entries(vehicleInteriors)) image.hidden = name !== room;
  touchControls.hidden = Boolean(pilotExit) || arrivalTitleActive;
  for (const help of movementHelp) help.hidden = inBase;
  if (inBase) {
    heldKeys.clear();
    heldPointers.clear();
  }
  terrain.hidden = Boolean(room);
  baseInterior.hidden = room !== 'base';
  stations.hidden = Boolean(room);
  updateAction();
  requestFrame();
}

function finishLanding() {
  if (landingSequence.hidden || location.hash !== '#chapter-1') return;
  landingSequence.hidden = true;
  showLandingAchievement();
  hasLanded = true;
  pilotExit = { hopAt: performance.now() + pilotSeatPause };
  landingObjective.textContent = 'Exiting spacecraft';
  changeScene('rocket', 'cabin');
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishPilotExit();
}

function showLandingAchievement() {
  if (hasLanded || !landingAchievement.hidden || location.hash !== '#chapter-1') return;
  landingAchievement.hidden = false;
  SFX.play('achievement');
  landingAchievementTimer = window.setTimeout(() => { landingAchievement.hidden = true; }, 6500);
}

function finishBaseEntry() {
  if (baseAirlock.hidden || baseAirlock.dataset.phase !== 'opening') return;
  closeAirlock();
  baseAirlockSeen = true;
  SFX.play('hatch');
  changeScene('base');
  scene.focus({ preventScroll: true });
}

function closeAirlock() {
  window.clearTimeout(airlockTimer);
  airlockSteam.stop();
  airShowerSound?.stop();
  airShowerSound = null;
  clearLeverDrag();
  baseAirlock.hidden = true;
}

function enterBase() {
  if (baseAirlockSeen) {
    passHatch('base');
    return;
  }
  heldKeys.clear();
  heldPointers.clear();
  touchControls.hidden = true;
  currentHint = null;
  interaction.textContent = '';
  action = null;
  baseAirlock.dataset.phase = 'ready';
  airlockLever.setAttribute('aria-pressed', 'false');
  airlockStatus.textContent = 'Press the lever or drag it down to start';
  baseAirlock.hidden = false;
  SFX.play('hatch');
  suppressLeverClick = false;
  airlockLever.focus({ preventScroll: true });
}

function startAirShower() {
  if (baseAirlock.hidden || baseAirlock.dataset.phase !== 'ready') return;
  airlockLever.setAttribute('aria-pressed', 'true');
  baseAirlock.dataset.phase = 'spraying';
  airlockStatus.textContent = 'Air shower running';
  SFX.play('lever');
  airShowerSound = SFX.loop('hiss');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) airlockSteam.start();
  airlockTimer = window.setTimeout(() => {
    baseAirlock.dataset.phase = 'opening';
    airlockStatus.textContent = 'Air shower complete. Door opening.';
    airShowerSound?.stop(0.4);
    airShowerSound = null;
    SFX.play('doorOpen');
    // Finish even if the animation is interrupted by a motion setting change.
    airlockTimer = window.setTimeout(finishBaseEntry, reducedMotion ? 400 : 1900);
  }, reducedMotion ? 300 : 2000);
}

airlockLever.addEventListener('pointerdown', event => {
  if (baseAirlock.dataset.phase !== 'ready' || airlockDrag || !event.isPrimary || event.button !== 0) return;
  suppressLeverClick = false;
  airlockDrag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    travel: airlockLever.getBoundingClientRect().height * .36
  };
  airlockLever.setPointerCapture(event.pointerId);
});

function moveAirlockLever(event) {
  if (airlockDrag?.id !== event.pointerId || baseAirlock.dataset.phase !== 'ready') return;
  const distance = event.clientY - airlockDrag.y;
  if (!suppressLeverClick && Math.hypot(event.clientX - airlockDrag.x, distance) < 4) return;
  suppressLeverClick = true;
  if (distance >= Math.max(8, airlockDrag.travel)) {
    delete airlockLever.dataset.dragging;
    airlockLever.style.removeProperty('--lever-drag');
    startAirShower();
    return;
  }
  airlockLever.dataset.dragging = '';
  airlockLever.style.setProperty('--lever-drag', `${Math.min(1, Math.max(0, distance / airlockDrag.travel)) * 100}%`);
}

function clearLeverDrag() {
  const pointerId = airlockDrag?.id;
  airlockDrag = undefined;
  delete airlockLever.dataset.dragging;
  airlockLever.style.removeProperty('--lever-drag');
  if (pointerId !== undefined && airlockLever.hasPointerCapture(pointerId)) {
    airlockLever.releasePointerCapture(pointerId);
  }
}

function endAirlockDrag(event) {
  if (airlockDrag?.id === event.pointerId) clearLeverDrag();
}

airlockLever.addEventListener('pointermove', moveAirlockLever);
airlockLever.addEventListener('pointerup', event => {
  moveAirlockLever(event);
  endAirlockDrag(event);
});
airlockLever.addEventListener('pointercancel', endAirlockDrag);
airlockLever.addEventListener('lostpointercapture', endAirlockDrag);
airlockLever.addEventListener('click', event => {
  if (event.detail === 0 || !suppressLeverClick) startAirShower();
});

airlockChamber.addEventListener('animationend', event => {
  if (event.target === airlockChamber) finishBaseEntry();
});

function finishPilotExit() {
  pilotExit = null;
  arrivalTitleActive = location.hash === '#chapter-1';
  if (room === 'rocket') {
    changeScene(null);
    x = pilotSurfaceStop;
  }
  touchControls.hidden = arrivalTitleActive;
  updateAction();
  requestFrame();
  if (arrivalTitleActive) outpostGame.dispatchEvent(new Event('pilotarrived'));
}

function pilotDestination(now) {
  if (!pilotExit || climb) return null;
  if (pilotExit.hopAt !== null) {
    if (now < pilotExit.hopAt) return null;
    pilotExit.hopAt = null;
    jump(pilotHopSpeed);
  }
  if (!room) return pilotSurfaceStop;
  return rocketDeck === 'cabin' ? rooms.rocket.ladder : rooms.rocket.exit;
}

outpostGame.addEventListener('chapterchange', event => {
  if (!event.detail) {
    if (roverDrive.active) {
      const awayFromOutpost = roverDrive.awayFromOutpost;
      roverDrive.cancel();
      if (awayFromOutpost) changeScene(null);
      touchControls.hidden = false;
    }
    window.clearTimeout(landingAchievementTimer);
    landingAchievement.hidden = true;
    if (!baseAirlock.hidden) {
      closeAirlock();
      updateAction();
      touchControls.hidden = false;
    }
    landingSequence.hidden = true;
    landingSound?.stop();
    landingSound = null;
    if (!lifeSupport.hidden) setConsole(false);
    if (pilotExit) {
      finishPilotExit();
      cargoSetup.start();
    }
    heldKeys.clear();
    heldPointers.clear();
    return;
  }
  if (hasLanded) {
    requestFrame();
    return;
  }
  landingSequence.hidden = false;
  stations.hidden = true;
  astronaut.hidden = true;
  astronautShadow.hidden = true;
  touchControls.hidden = true;
  // Scripted landing soundtrack, timed to the descent animation.
  landingSound?.stop();
  const landingDuration = getComputedStyle(landingSequence).getPropertyValue('--landing-duration').trim();
  landingSound = SFX.sequence('landing', {
    duration: landingDuration.endsWith('ms') ? parseFloat(landingDuration) / 1000 : parseFloat(landingDuration) || 3.6
  });
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) finishLanding();
});
landingCraft.addEventListener('animationend', event => {
  if (event.target === landingCraft) finishLanding();
});
landingSequence.addEventListener('animationend', event => {
  if (event.animationName === 'show-settled-outpost') showLandingAchievement();
});

function climbLadder() {
  x = rooms.rocket.ladder;
  climb = { startedAt: performance.now(), to: rocketDeck === 'storage' ? 'cabin' : 'storage', rung: -1 };
  updateAction();
  requestFrame();
}

function openSubroom(name) {
  SFX.play('slide');
  baseSubroom.hidden = false;
  baseSubroom.dataset.room = name;
  baseHotspots.hidden = true;
  baseHelp.hidden = true;
  subroomHelp.hidden = false;
  touchControls.hidden = true;
  for (const control of subroomControls) control.hidden = !subrooms[name].includes(control.dataset.subroomAction);
  updateAction();
  subroomBack.focus();
}

function openBasePanel(target, button) {
  panelTrigger = button;
  const [title, description] = basePanels[target];
  SFX.play(target === 'computerLocked' ? 'denied' : 'blip');
  document.querySelector('#base-panel-title').textContent = title;
  document.querySelector('#base-panel-text').textContent = description;
  basePanel.hidden = false;
  closeBasePanel.focus();
}

function updateAction() {
  const showShelf = room === 'rocket';
  const inStorage = showShelf && rocketDeck === 'storage' && !climb && !pilotExit;
  cargoSetup.render(room, inStorage, room === 'base' && baseSubroom.hidden, showShelf);
  const station = room ? null : Object.keys(doors).find(name => Math.abs(x - doors[name]) <= 14);
  for (const marker of markers) marker.classList.toggle('nearby', marker.dataset.station === station);

  let label = '';
  let nextAction = null;
  if (room === 'base' && baseSubroom.hidden) {
    label = 'Exit base';
    nextAction = exitBase;
  } else if (!pilotExit && !arrivalTitleActive && station) {
    label = 'Enter ' + station;
    nextAction = station === 'base' ? enterBase : () => passHatch(station);
  } else if (inStorage && cargoSetup.canUnload() && jumpStartedAt === null && Math.abs(x - rooms.rocket.cargo) <= 14) {
    label = 'Pick up server blocks';
    nextAction = () => {
      SFX.play('pickup');
      cargoSetup.unload();
      updateAction();
    };
  } else if (!pilotExit && room === 'rocket' && !climb && jumpStartedAt === null && Math.abs(x - rooms.rocket.ladder) <= 11) {
    label = rocketDeck === 'storage' ? 'Climb to cabin' : 'Climb to storage';
    nextAction = climbLadder;
  } else if (room === 'rover' && jumpStartedAt === null && Math.abs(x - rooms.rover.driverSeat) <= 12) {
    label = 'Drive rover';
    nextAction = () => {
      heldKeys.clear();
      heldPointers.clear();
      touchControls.hidden = true;
      roverDrive.start();
    };
  } else if (!pilotExit && room && room !== 'base' && !climb && rocketDeck === 'storage' && Math.abs(x - rooms[room].exit) <= 11) {
    label = 'Exit to surface';
    nextAction = () => passHatch(null);
  }
  action = nextAction;
  landingObjective.hidden = !pilotExit;
  if (currentHint === label) return;
  currentHint = label;
  interaction.textContent = label ? 'E · ' + label : '';
  touchAction.textContent = label || 'Interact';
  touchAction.disabled = !action;
}

outpostGame.addEventListener('arrivaltitleend', () => {
  arrivalTitleActive = false;
  touchControls.hidden = false;
  cargoSetup.start();
  updateAction();
});

function exitBase() {
  setConsole(false);
  passHatch(null);
  scene.focus();
}

window.addEventListener('keydown', event => {
  if (outpostGame?.hidden) return;
  if (roverDrive.active) {
    roverDrive.keyDown(event);
    return;
  }
  if (!baseAirlock.hidden) {
    if (event.code === 'Escape') {
      event.preventDefault();
      if (!event.repeat) {
        closeAirlock();
        touchControls.hidden = false;
        updateAction();
        scene.focus({ preventScroll: true });
      }
    }
    return;
  }
  if (!landingSequence.hidden) {
    if (event.code === 'Escape' && !event.repeat) {
      event.preventDefault();
      location.hash = '#chapters';
    }
    return;
  }
  if (arrivalTitleActive) return;
  if (event.code === 'Escape') {
    event.preventDefault();
    if (event.repeat) return;
    heldKeys.clear();
    heldPointers.clear();
    if (!lifeSupport.hidden) setConsole(false);
    else if (pilotExit) finishPilotExit();
    else if (!baseSubroom.hidden) returnToLobby();
    else if (!basePanel.hidden) closeBasePanel.click();
    else if (room === 'base') exitBase();
    else if (room) {
      passHatch(null);
      scene.focus();
    } else location.hash = '#chapters';
    return;
  }
  if (pilotExit || !lifeSupport.hidden) return;
  if (room === 'base' && event.code === 'KeyE' && !event.altKey && !event.ctrlKey && !event.metaKey) {
    event.preventDefault();
    if (!event.repeat) {
      if (baseSubroom.hidden) exitBase();
      else returnToLobby();
    }
    return;
  }
  if (!basePanel.hidden) return;
  if (room === 'base') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('button, a, input, textarea, select')) return;
  if (event.code in movementKeys || event.key === 'Shift') {
    event.preventDefault();
    heldKeys.add(event.code);
    requestFrame();
  } else if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') {
    event.preventDefault();
    if (!event.repeat) jump();
  } else if (event.code === 'KeyE') {
    event.preventDefault();
    if (!event.repeat && action) action();
  }
});

window.addEventListener('keyup', event => {
  if (roverDrive.active) {
    roverDrive.keyUp(event);
    return;
  }
  if (heldKeys.delete(event.code)) requestFrame();
  if (!pilotExit && ['Space', 'ArrowUp', 'KeyW'].includes(event.code)) shortenJump();
});
window.addEventListener('blur', () => {
  roverDrive.clearInput();
  heldKeys.clear();
  heldPointers.clear();
  requestFrame();
});

for (const button of document.querySelectorAll('[data-move]')) {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    heldPointers.set(event.pointerId, Number(button.dataset.move));
    requestFrame();
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    button.addEventListener(name, event => {
      if (heldPointers.delete(event.pointerId)) requestFrame();
    });
  }
}
touchJump.addEventListener('click', () => jump());
touchAction.addEventListener('click', () => action?.());
closeConsole.addEventListener('click', () => setConsole(false));
baseHotspots.addEventListener('click', event => {
  const button = event.target.closest('[data-base-target]');
  if (!button) return;
  const target = button.dataset.baseTarget;
  if (target === 'pc') {
    setConsole(true, consoleButton);
    return;
  }
  if (target.startsWith('servers-') && cargoSetup.installAt(button)) return;
  if (target in subrooms) openSubroom(target);
  else openBasePanel('servers', button);
});
for (const control of subroomControls) {
  control.addEventListener('click', () => {
    const target = control.dataset.subroomAction;
    if (target === 'systems-pc') setConsole(true, control);
    else openBasePanel(target, control);
  });
}
function returnToLobby() {
  SFX.play('slide');
  if (!lifeSupport.hidden) setConsole(false);
  basePanel.hidden = true;
  baseSubroom.hidden = true;
  baseHotspots.hidden = false;
  baseHelp.hidden = false;
  subroomHelp.hidden = true;
  touchControls.hidden = false;
  updateAction();
  document.querySelector(`[data-base-target="${baseSubroom.dataset.room}"]`).focus();
}
subroomBack.addEventListener('click', returnToLobby);
closeBasePanel.addEventListener('click', () => {
  SFX.play('close');
  basePanel.hidden = true;
  panelTrigger.focus();
});

function tick(now) {
  framePending = false;
  if (roverDrive.active || room === 'base' || outpostGame?.hidden || !landingSequence.hidden || !baseAirlock.hidden) {
    lastFrame = null;
    heldKeys.clear();
    heldPointers.clear();
    return;
  }
  const dt = Math.max(0, Math.min((now - lastFrame) / 1000, 0.1));
  lastFrame = now;
  let direction = 0;
  for (const key of heldKeys) direction = movementKeys[key] ?? direction;
  for (const pointerDirection of heldPointers.values()) direction = pointerDirection;
  const destination = pilotDestination(now);
  if (pilotExit) direction = destination === null ? 0 : Math.sign(destination - x);
  if (climb) direction = 0;
  const area = room === 'rocket' ? rooms.rocket.decks[rocketDeck] : rooms[room];
  const [left, right] = area?.bounds ?? [13, 307];
  const sprinting = heldKeys.has('ShiftLeft') || heldKeys.has('ShiftRight');
  const speed = sprinting ? 98 : 66;
  const distance = destination === null ? speed * dt : Math.min(speed * dt, Math.abs(destination - x));
  const nextX = destination !== null && Math.abs(destination - x) <= distance
    ? destination
    : Math.max(left, Math.min(right, x + direction * distance));
  const moving = nextX !== x;
  const wasJumping = jumpStartedAt !== null;
  const wasClimbing = Boolean(climb);
  if (jumpStartedAt === null) {
    const frameDistance = sprinting ? 6 : 4.75;
    const previousStep = Math.floor(stride);
    stride = moving ? (stride + Math.abs(nextX - x) / frameDistance) % gait.length : 0;
    // A footstep each time a boot touches down (every other gait frame).
    const currentStep = Math.floor(stride);
    if (moving && !climb && currentStep !== previousStep && currentStep % 2 === 0) {
      SFX.play('step', { metal: Boolean(room) });
    }
  }
  if (direction) facing = direction;
  x = nextX;

  if (jumpStartedAt !== null) {
    const jumpElapsed = Math.max(0, (now - jumpStartedAt) / 1000);
    jumpHeight = jumpStartHeight + jumpElapsed * (jumpStartSpeed - jumpGravity * jumpElapsed / 2);
    const clearance = jumpClearance(area, x);
    if (jumpHeight > clearance) {
      jumpHeight = clearance;
      jumpStartHeight = clearance;
      jumpStartSpeed = Math.min(0, jumpStartSpeed - jumpGravity * jumpElapsed);
      jumpStartedAt = now;
    }
    if (jumpHeight <= 0 && jumpElapsed > 0) {
      jumpHeight = 0;
      jumpStartedAt = null;
      SFX.play('land');
    }
  }

  let floor = area?.floor ?? 125;
  let climbFrame = 0;
  if (climb) {
    const destinationFloor = rooms.rocket.decks[climb.to].floor;
    const elapsed = Math.max(0, now - climb.startedAt);
    const progress = Math.min(1, elapsed / climbDuration);
    const steps = progress * climbSteps;
    const step = Math.floor(steps);
    const reach = steps - step;
    if (step !== climb.rung && step < climbSteps) {
      climb.rung = step;
      SFX.play('rung');
    }
    // The body transfers its weight onto each rung before the next reach.
    const distance = (step + reach * reach * (3 - 2 * reach)) / climbSteps;
    const frame = Math.floor(steps * 2) % 4;
    climbFrame = climb.to === 'cabin' ? frame : 3 - frame;
    floor += (destinationFloor - floor) * distance;
    if (progress === 1) {
      rocketDeck = climb.to;
      climb = null;
    }
  }
  if (moving || wasJumping !== (jumpStartedAt !== null) || wasClimbing !== Boolean(climb)) updateAction();
  if (astronautShadow.hidden !== Boolean(climb)) astronautShadow.hidden = Boolean(climb);
  positionAstronautShadow(floor);
  const standing = !direction && jumpStartedAt === null;
  const walkPose = moving ? gait[Math.floor(stride)] : 7;
  const sitting = pilotExit && pilotExit.hopAt !== null;
  const pose = sitting ? 6 : jumpStartedAt !== null ? 5 : standing ? 0 : walkPose;
  const spriteFacing = climb || standing ? 1 : facing;
  astronautAtlas.hidden = Boolean(climb);
  climbAtlas.hidden = !climb;
  if (climb) climbAtlas.style.transform = `translate3d(${climbFrame * -25}%, 0, 0)`;

  if (pose !== currentPose) {
    astronautAtlas.style.transform = `translate3d(${pose * -12.5}%, 0, 0)`;
    currentPose = pose;
  }
  const { width, height, top } = rooms[room]?.framing ?? surfaceFraming;
  const spriteHeight = (rooms[room]?.spriteHeight ?? 0.24) * height;
  const screenX = (0.5 + (x / worldWidth - 0.5) * width) * sceneSize.width;
  const screenY = (top + (floor - jumpHeight) / worldHeight * height - spriteHeight * (1 - bootPadding)) * sceneSize.height;
  astronaut.style.height = spriteHeight * 100 + '%';
  astronaut.style.width = spriteHeight * sceneSize.height * (96 / 124) + 'px';
  astronaut.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translateX(-50%) scaleX(${spriteFacing})`;
  if (pilotExit && x === destination && jumpStartedAt === null) {
    if (room === 'rocket' && rocketDeck === 'cabin') climbLadder();
    else if (room === 'rocket') passHatch(null);
    else finishPilotExit();
  }
  if (moving || (direction && dt === 0) || jumpStartedAt !== null || climb || pilotExit) requestFrame();
  else lastFrame = null;
}

function positionAstronautShadow(floor) {
  const lift = Math.min(jumpHeight / 18, 1);
  const center = x + (room ? 0 : 4 + lift * 3);
  const { width, height, top } = rooms[room]?.framing ?? surfaceFraming;
  const screenX = (0.5 + (center / worldWidth - 0.5) * width) * sceneSize.width;
  const screenY = (top + (floor + 1) / worldHeight * height) * sceneSize.height;
  astronautShadow.style.transform = `translate3d(${screenX}px, ${screenY}px, 0) translate(-50%, -50%) scale(${height * (1 + lift * 0.25)})`;
  astronautShadow.style.opacity = 0.6 - lift * 0.3;
}

updateAction();
requestFrame();
