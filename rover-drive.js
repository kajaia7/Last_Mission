function createRoverDrive(onExit) {
  const drive = document.querySelector('#rover-drive');
  const fade = document.querySelector('#rover-fade');
  const canvas = drive.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const objective = drive.querySelector('.rover-objective');
  const exit = drive.querySelector('.park-rover');
  const siteAction = drive.querySelector('#rover-site-action');
  const pedals = [...drive.querySelectorAll('[data-drive-direction]')];
  const stationMarker = drive.querySelector('.research-station-marker');
  const researchTask = document.querySelector('#research-task');
  const outpostGame = document.querySelector('#outpost-game');
  const topbar = document.querySelector('.topbar');
  const astronaut = document.querySelector('#astronaut img');
  const background = new Image();
  const outpost = document.querySelector('#terrain');
  const station = new Image();
  background.src = 'mars-vehicle-background.png';
  station.src = 'rover-research-station.png';

  const width = 480;
  const height = 200;
  ctx.scale(canvas.width / width, canvas.height / height);
  ctx.imageSmoothingEnabled = true;
  const craterStart = 810;
  const craterEnd = 1200;
  const destination = 1780;
  const stationDoor = destination + 220;
  const stationWidth = 210;
  const stationHeight = 136;
  const stationLeft = stationDoor - 137;
  const roverDoor = destination + 55;
  const departure = 115;
  const stepOutDuration = .9;
  const suitHeight = 39;
  const suitWidth = suitHeight * 96 / 124;
  const keyboardDirections = { KeyW: 1, KeyS: -1 };
  const walkingDirections = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
  const input = new Map();
  const roverScale = .27;
  const roverArtX = 1275;
  const roverArtY = 416;
  const tireArt = { x: 1493, y: 590, width: 105, height: 88, hubX: 66, hubY: 43 };
  const tires = [
    { x: 37, radius: 10.5, phase: .4 },
    { x: 10, radius: 12, phase: 1.1 },
    { x: -18, radius: 12, phase: .6 },
    { x: -42, radius: 12, phase: 0 }
  ];
  const dust = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let phase = 'idle';
  let frameId = 0;
  let transitionStart = 0;
  let lastFrame = null;
  let distance = 0;
  let speed = 0;
  let cruising = true;
  let heading = 1;
  let atStation = false;
  let researchComplete = false;
  // Route choice before the crater: null until the player picks a road.
  const routeFork = craterStart - 170;
  let routeChoice = null;
  let avatarX = 0;
  let avatarFacing = 1;
  let avatarStride = 0;
  let avatarWalking = false;
  let stepOutTime = 0;
  let chassisSprite;
  let tireSprite;
  let roadSprite;
  let dustInterval = 0;
  let engineSound = null;

  function stopEngine() {
    engineSound?.stop();
    engineSound = null;
  }

  function groundAt(x) {
    const progress = Math.max(0, Math.min(1, (x - craterStart) / (craterEnd - craterStart)));
    const crater = Math.sin(Math.PI * progress);
    return 144 + crater * crater * 27;
  }

  function prepareRoad() {
    const trackWidth = destination + width;
    roadSprite = document.createElement('canvas');
    roadSprite.width = trackWidth * 2;
    roadSprite.height = height * 2;
    const road = roadSprite.getContext('2d');
    road.scale(2, 2);
    const roughness = x => Math.sin(x / 13) + .5 * Math.sin(x / 4);
    const band = (far, near, fill) => {
      road.beginPath();
      road.moveTo(0, far(0));
      for (let x = 2; x <= trackWidth; x += 2) road.lineTo(x, far(x));
      road.lineTo(trackWidth, near(trackWidth));
      for (let x = trackWidth - 2; x >= 0; x -= 2) road.lineTo(x, near(x));
      road.closePath();
      road.fillStyle = fill;
      road.fill();
    };
    const farEdge = x => groundAt(x) - 1.7 + roughness(x) * .45;
    const nearEdge = x => groundAt(x) + 21 + roughness(x) * 1.5;
    const foreground = road.createLinearGradient(0, 130, 0, height);
    foreground.addColorStop(0, '#e4674e');
    foreground.addColorStop(.55, '#c84c3b');
    foreground.addColorStop(1, '#9b322f');
    band(x => groundAt(x) - 3.8 + roughness(x) * 1.4, () => height, foreground);
    band(farEdge, x => nearEdge(x) + 2, '#914f57');
    band(farEdge, nearEdge, '#535563');
    band(x => groundAt(x) + 1, x => groundAt(x) + 4 + roughness(x) * .6, '#777887');
    band(x => groundAt(x) + 5, x => groundAt(x) + 9 + roughness(x) * .5, '#444654');
    band(x => groundAt(x) + 10, x => groundAt(x) + 14 + roughness(x) * .65, '#626575');
    band(x => nearEdge(x) - 3, nearEdge, '#67616e');

    let seed = 0x4d415253;
    const noise = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const gravel = ['#292d4499', '#b4b3ba80', '#9297a26b', '#31333b90'];
    const grit = ['#762c3f99', '#f5815b99', '#e9674788', '#8f384966'];
    for (let i = 0; i < 11000; i++) {
      const x = noise() * trackWidth;
      const y = groundAt(x) - 1 + noise() * 59;
      if (y > height) continue;
      const palette = y < nearEdge(x) ? gravel : grit;
      road.fillStyle = palette[i % palette.length];
      road.fillRect(Math.floor(x), Math.floor(y * 2) / 2, .5 + noise() * 2.6, .5 + noise() * .65);
    }

    // Near rocks follow the slope so the foreground keeps its depth through the crater.
    const rock = new Path2D('M-7 0L-6 -2L-4 -3L-3 -6L1 -7L3 -5L5 -4L7 0Z');
    const rockFace = new Path2D('M-6 -2L-4 -3L-3 -6L1 -7L3 -5L1 -4L-1 -4L-2 -2Z');
    for (let i = 0; i < 620; i++) {
      const x = Math.round(noise() * trackWidth);
      const depth = noise();
      const y = Math.floor(nearEdge(x) + 7 + depth * 39);
      if (y > height + 3) continue;
      const size = .12 + noise() * (.4 + depth * .5);
      road.save();
      road.translate(x, y);
      road.scale(size * (1 + noise() * .8), size);
      road.fillStyle = '#67273570';
      road.fillRect(-8, -1, 17, 2);
      road.fillStyle = i % 2 ? '#853848' : '#9d3f43';
      road.fill(rock);
      road.fillStyle = i % 2 ? '#e67754' : '#d55745';
      road.fill(rockFace);
      road.restore();
    }
  }

  function drawCrater(camera) {
    if (camera > craterEnd || camera + width < craterStart) return;
    const apron = ctx.createLinearGradient(0, 137, 0, 174);
    apron.addColorStop(0, '#99474b00');
    apron.addColorStop(.35, '#98434c');
    apron.addColorStop(1, '#542f40');
    ctx.beginPath();
    ctx.moveTo(craterStart - camera, groundAt(craterStart) - 4);
    for (let x = craterStart; x <= craterEnd; x += 3) {
      const wall = (groundAt(x) - 144) * .35;
      ctx.lineTo(x - camera, 140 + wall + Math.sin(x / 9) * .65);
    }
    for (let x = craterEnd; x >= craterStart; x -= 3) ctx.lineTo(x - camera, groundAt(x));
    ctx.closePath();
    ctx.fillStyle = apron;
    ctx.fill();
    for (const [depth, color] of [[.52, '#de775964'], [.7, '#5d304d90'], [.84, '#c4665b7b']]) {
      ctx.beginPath();
      for (let x = craterStart + 26; x <= craterEnd - 26; x += 4) {
        const y = 140 + (groundAt(x) - 144) * depth + Math.sin(x / 12) * .65;
        if (x === craterStart + 26) ctx.moveTo(x - camera, y);
        else ctx.lineTo(x - camera, y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = .85;
      ctx.stroke();
    }
  }

  function drawLandscape(camera) {
    ctx.fillStyle = '#e88968';
    ctx.fillRect(0, 0, width, height);
    const tileWidth = 530;
    const shift = camera * .3;
    if (background.naturalWidth) {
      for (let tile = Math.floor(shift / tileWidth); tile * tileWidth - shift < width; tile++) {
        const left = tile * tileWidth - shift;
        ctx.save();
        ctx.translate(left + (tile % 2 ? tileWidth : 0), 0);
        ctx.scale(tile % 2 ? -1 : 1, 1);
        ctx.drawImage(background, 0, 0, background.naturalWidth, 720, 0, 0, tileWidth, 163);
        ctx.drawImage(background, 0, 720, background.naturalWidth, 92, 0, 163, tileWidth, height - 163);
        ctx.restore();
      }
    }

    drawCrater(camera);
    if (!roadSprite) prepareRoad();
    ctx.drawImage(roadSprite, -camera, 0, roadSprite.width / 2, height);

    for (const marker of [351, 628, 797, 1214, 1470, 1693]) {
      const x = Math.round(marker - camera);
      if (x < -12 || x > width + 12) continue;
      const y = groundAt(marker) - 2;
      ctx.fillStyle = '#352e3e80';
      ctx.fillRect(x - 4, y, 13, 1.5);
      ctx.fillStyle = '#392938';
      ctx.fillRect(x - 1.5, y - 11, 3, 12);
      ctx.fillStyle = '#e18d61';
      ctx.fillRect(x + .5, y - 10, 1, 10);
      ctx.fillStyle = '#ffe3ad';
      ctx.fillRect(x - 1.5, y - 10, 3, 2);
    }
  }

  function prepareRoverSprites() {
    chassisSprite = document.createElement('canvas');
    chassisSprite.width = 420;
    chassisSprite.height = 230;
    const chassis = chassisSprite.getContext('2d');
    // Keep the antennas and undercarriage, leaving the wheels on their own layer.
    chassis.clip(new Path2D('M20 148L28 134L74 91L92 85L133 83L135 79L175 75L203 76L203 60L188 51L184 45L184 33L194 28L210 27L212 16L219 16L222 27L240 29L248 36L248 47L233 54L226 58L224 78L267 85L269 70L272 5L281 5L283 86L298 87L301 30L309 29L311 87L345 89L370 102L372 142L357 148L357 154L370 155L370 169L349 177L332 189L311 201L274 199L243 199L218 211L178 210L139 210L109 222L68 218L38 207L22 188Z'));
    chassis.drawImage(outpost, -roverArtX, -roverArtY);

    tireSprite = document.createElement('canvas');
    tireSprite.width = tireArt.width;
    tireSprite.height = tireArt.height;
    const tire = tireSprite.getContext('2d');
    // Trace the outpost's middle wheel so its tread keeps the same perspective as the chassis.
    tire.clip(new Path2D('M43 1H75V4H83V9H89V15H94V23H98V32H101V59H98V68H94V75H89V81H82V86H26V84H15V80H10V74H6V63H3V33H5V23H9V16H15V10H23V6H33V3H43Z'));
    tire.drawImage(outpost, -tireArt.x, -tireArt.y);
  }

  function drawTire(axle, turn, farSide = false) {
    const scale = axle.radius * 2 / 86;
    const { hubX, hubY } = tireArt;
    ctx.save();
    ctx.translate(axle.screenX, groundAt(axle.worldX) - (86 - hubY) * scale);
    ctx.scale(-scale * heading, scale);
    if (farSide) ctx.filter = 'brightness(.63)';
    ctx.drawImage(tireSprite, -hubX, -hubY);
    // The hub spins while the tire keeps its three-quarter silhouette.
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.clip();
    ctx.rotate(turn + axle.phase);
    ctx.drawImage(tireSprite, -hubX, -hubY);
    ctx.restore();
  }

  function groundGlow(x, y, radiusX, radiusY, center, edge) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radiusX, radiusY);
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    glow.addColorStop(0, center);
    glow.addColorStop(1, edge);
    ctx.fillStyle = glow;
    ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
  }

  function drawRover(screenX) {
    if (!outpost.naturalWidth) return;
    if (!chassisSprite) prepareRoverSprites();
    const axles = tires.map(tire => ({
      ...tire, worldX: distance + tire.x * heading, screenX: screenX + tire.x * heading
    }));
    const rear = groundAt(axles.at(-1).worldX);
    const front = groundAt(axles[0].worldX);
    const pitch = Math.atan2((front - rear) * heading, tires[0].x - tires.at(-1).x);
    const y = (front + rear) / 2;
    const turn = (departure - distance) * heading / 11.7;

    groundGlow(screenX + 50 * heading, groundAt(distance + 50 * heading) + 3,
      28, 4.5, atStation ? '#ffe8bd28' : '#ffe8bd6b', '#ffe8bd00');
    groundGlow(screenX - 3 * heading, y + 1, 56, 6, '#21172a99', '#21172a00');
    for (const axle of axles) {
      groundGlow(axle.screenX, groundAt(axle.worldX) + .6, axle.radius, 2.1, '#21172acc', '#21172a00');
    }
    drawTire(axles[0], turn, true);
    ctx.save();
    ctx.translate(screenX, y);
    ctx.rotate(pitch);
    ctx.scale(-roverScale * heading, roverScale);
    ctx.drawImage(chassisSprite, -210, -260);
    ctx.restore();
    for (const axle of axles.slice(1)) drawTire(axle, turn);
  }

  function updateDust(dt, traveled) {
    for (let i = dust.length - 1; i >= 0; i--) {
      const puff = dust[i];
      puff.age += dt;
      if (puff.age >= puff.life) {
        dust.splice(i, 1);
        continue;
      }
      puff.x += puff.drift * dt;
      puff.y -= dt * puff.lift;
    }
    if (reducedMotion.matches || Math.abs(speed) < 12 || !traveled) return;
    dustInterval += Math.abs(traveled);
    if (dustInterval < 3.5) return;
    dustInterval %= 3.5;
    const direction = Math.sign(traveled);
    const trailingAxle = direction === heading ? tires.at(-1) : tires[0];
    const x = distance + trailingAxle.x * heading - direction * 8;
    dust.push({
      x, y: groundAt(x) - 2, age: 0, life: .35 + Math.random() * .25,
      drift: -direction * (19 + Math.random() * 25),
      lift: 9 + Math.random() * 13,
      size: 2 + Math.random() * 2
    });
  }

  function drawDust(camera) {
    if (reducedMotion.matches) return;
    for (const puff of dust) {
      const progress = puff.age / puff.life;
      const x = Math.round(puff.x - camera);
      const y = Math.round(puff.y);
      const size = Math.round(puff.size + progress * 3);
      ctx.globalAlpha = (1 - progress) * .45;
      ctx.fillStyle = '#dfc0bb';
      ctx.fillRect(x - size + 1, y - 2, size + 1, 2.5);
      ctx.fillStyle = '#9e7e87';
      ctx.fillRect(x - size, y, 2 * size, 3);
      ctx.fillStyle = '#f4c7aa';
      ctx.fillRect(x - Math.round(size * .6), y - 3, 1.5, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawAstronaut(camera) {
    if (!atStation || !astronaut.naturalWidth) return;
    const steppingOut = stepOutTime < stepOutDuration;
    const progress = steppingOut ? stepOutTime / stepOutDuration : 1;
    const pose = avatarWalking ? 1 + Math.floor(avatarStride / 3) % 4 : 0;
    const floor = groundAt(avatarX);
    const boot = floor - (1 - progress) * 14;
    const x = avatarX - camera;
    const opacity = Math.min(1, progress * 4);
    groundGlow(x + 1, floor + 1, 11 - (1 - progress) * 3, 2.8,
      `rgb(31 24 44 / ${opacity * .72})`, '#1f182c00');
    ctx.save();
    ctx.translate(x, boot + suitHeight / 124);
    ctx.scale(avatarFacing, 1);
    ctx.globalAlpha = opacity;
    ctx.drawImage(astronaut, pose * 96, 0, 96, 124, -suitWidth / 2, -suitHeight, suitWidth, suitHeight);
    ctx.restore();
  }

  function drawStation(left) {
    const floor = groundAt(stationLeft);
    const doorway = left + stationDoor - stationLeft;
    ctx.save();
    ctx.translate(left, floor);
    // The beveled apron ties the station's feet and steps into the track.
    ctx.fillStyle = '#292739';
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.lineTo(stationWidth, -4);
    ctx.lineTo(stationWidth + 7, 7);
    ctx.lineTo(stationWidth + 7, 10);
    ctx.lineTo(-5, 10);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#555669';
    ctx.beginPath();
    ctx.moveTo(9, -4);
    ctx.lineTo(stationWidth, -4);
    ctx.lineTo(stationWidth + 7, 7);
    ctx.lineTo(-5, 7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#878094';
    ctx.fillRect(-5, 7, stationWidth + 12, 1);
    ctx.restore();

    groundGlow(left + stationWidth * .53, floor, stationWidth * .55, 5, '#21172ac9', '#21172a00');
    ctx.drawImage(station, 29, 67, 1380, 892, left, floor - stationHeight, stationWidth, stationHeight);
    groundGlow(doorway, floor + 1, 24, 5, '#ffc07974', '#ffc07900');
    for (const x of [left + 11, left + 62, doorway - 22, doorway + 22, left + stationWidth - 6]) {
      groundGlow(x, floor + 5, 8, 2, '#79f3ed70', '#79f3ed00');
      ctx.fillStyle = '#302f41';
      ctx.fillRect(x - 3, floor + 4, 6, 2);
      ctx.fillStyle = '#8ce1de';
      ctx.fillRect(x - 2, floor + 4.5, 4, .8);
    }
    // Use the station lamp and the bot's eyes as small points of color.
    groundGlow(doorway - .5, floor - 61, 9, 5, '#ffb45391', '#ffb45300');
    if (!researchComplete) {
      groundGlow(left + 30, floor - 39, 10, 4, '#7be0dd72', '#7be0dd00');
    }
  }

  function paint() {
    const camera = Math.max(0, distance - 177);
    drawLandscape(camera);
    const left = stationLeft - camera;
    const labelX = stationDoor - camera;
    stationMarker.hidden = !station.naturalWidth || labelX > width - 70;
    if (!stationMarker.hidden) {
      stationMarker.style.setProperty('--x', `min(${labelX / width * 100}%, calc(100% - 64px))`);
    }
    if (left < width && station.naturalWidth) drawStation(left);
    drawDust(camera);
    drawRover(distance - camera);
    drawAstronaut(camera);
  }

  function clearInput() {
    input.clear();
    cruising = false;
  }

  function cancel() {
    cancelAnimationFrame(frameId);
    stopEngine();
    phase = 'idle';
    clearInput();
    closeResearchTask();
    drive.hidden = true;
    fade.hidden = true;
  }

  function closeResearchTask() {
    if (researchTask.hidden) return;
    researchTask.hidden = true;
    researchTask.removeAttribute('src');
    outpostGame.inert = false;
    topbar.inert = false;
  }

  function configureControls() {
    for (const [index, pedal] of pedals.entries()) {
      pedal.querySelector('kbd').textContent = (atStation ? ['A', 'D'] : ['S', 'W'])[index];
      pedal.querySelector('span').textContent = (atStation ? ['Walk left', 'Walk right'] : ['Reverse', 'Forward'])[index];
      pedal.disabled = atStation && stepOutTime < stepOutDuration;
    }
    exit.hidden = atStation;
    exit.textContent = heading === -1 ? 'Back to outpost' : 'Exit drive';
    siteAction.hidden = true;
  }

  function stopAtStation() {
    SFX.play('brake');
    SFX.play('chime');
    atStation = true;
    speed = 0;
    stepOutTime = reducedMotion.matches ? stepOutDuration : 0;
    avatarX = reducedMotion.matches ? roverDoor : destination + 25;
    avatarFacing = 1;
    avatarStride = 0;
    avatarWalking = false;
    clearInput();
    configureControls();
    objective.textContent = 'Lost research bot located. Enter the Research Station.';
  }

  function stationActionLabel() {
    if (!atStation || stepOutTime < stepOutDuration) return '';
    if (researchComplete && Math.abs(avatarX - roverDoor) <= 12) return 'Board rover';
    if (!researchComplete && Math.abs(avatarX - stationDoor) <= 15) return 'Enter Research Station';
    return '';
  }

  function moveAtStation(dt) {
    if (stepOutTime < stepOutDuration) {
      stepOutTime = Math.min(stepOutDuration, stepOutTime + dt);
      const progress = stepOutTime / stepOutDuration;
      avatarX = destination + 25 + (roverDoor - destination - 25) * progress;
      avatarStride = avatarX - destination;
      avatarWalking = progress < 1;
      if (!avatarWalking) configureControls();
    } else {
      const direction = [...input.values()].at(-1) ?? 0;
      const nextX = Math.min(stationDoor + 40, Math.max(roverDoor, avatarX + direction * 65 * dt));
      avatarWalking = nextX !== avatarX;
      if (avatarWalking) {
        avatarStride += Math.abs(nextX - avatarX);
        avatarFacing = direction;
      }
      avatarX = nextX;
    }
    const label = stationActionLabel();
    siteAction.hidden = !label;
    if (label && siteAction.textContent !== 'E · ' + label) siteAction.textContent = 'E · ' + label;
  }

  function interactAtStation() {
    const label = stationActionLabel();
    if (!label) return;
    SFX.play('hatch');
    if (researchComplete) {
      input.clear();
      atStation = false;
      cruising = true;
      speed = 0;
      phase = 'entering';
      fade.style.opacity = 1;
      fade.hidden = false;
      drive.hidden = true;
      transitionStart = performance.now() - 180;
      objective.textContent = 'Drive back to the outpost.';
      configureControls();
      return;
    }
    clearInput();
    researchTask.src = 'tasks/rock-detectives/index.html?from=research-station';
    researchTask.hidden = false;
    outpostGame.inert = true;
    topbar.inert = true;
    researchTask.focus();
  }

  // Pause at the fork and open the "Choose a Rover Route" task over the drive.
  function openRouteChoice() {
    distance = routeFork;
    speed = 0;
    clearInput();
    stopEngine();
    SFX.play('brake');
    objective.textContent = 'Two roads ahead. Choose a route.';
    researchTask.src = 'tasks/rover-route/index.html?from=rover-drive';
    researchTask.hidden = false;
    outpostGame.inert = true;
    topbar.inert = true;
    researchTask.focus();
  }

  function beginExit() {
    if (phase === 'idle' || phase === 'leaving') return;
    const wasEntering = phase === 'entering' && drive.hidden;
    clearInput();
    if (wasEntering || reducedMotion.matches) {
      cancel();
      onExit(atStation || heading === -1);
      return;
    }
    phase = 'leaving';
    stopEngine();
    SFX.play('hatch');
    transitionStart = performance.now();
    fade.hidden = false;
  }

  function update(now) {
    const dt = lastFrame === null ? 0 : Math.min(.05, (now - lastFrame) / 1000);
    lastFrame = now;
    const elapsed = now - transitionStart;
    if (phase === 'entering') {
      const cut = reducedMotion.matches;
      fade.style.opacity = cut ? 1 : Math.min(1, elapsed / 200);
      if (elapsed >= (cut ? 120 : 325)) {
        drive.hidden = false;
        drive.focus({ preventScroll: true });
        phase = 'driving';
        transitionStart = now;
      }
    } else if (phase === 'leaving') {
      fade.style.opacity = Math.min(1, elapsed / 180);
      if (elapsed >= 220) {
        cancel();
        onExit(atStation || heading === -1);
        return;
      }
    } else if (!fade.hidden) {
      fade.style.opacity = reducedMotion.matches ? 0 : Math.max(0, 1 - elapsed / 250);
      if (Number(fade.style.opacity) === 0) fade.hidden = true;
    }

    if (!drive.hidden && researchTask.hidden) {
      const previousDistance = distance;
      if (atStation && phase === 'driving') moveAtStation(dt);
      else if (!atStation && phase === 'driving') {
        const pedal = [...input.values()].at(-1) ?? (cruising ? 1 : 0);
        const inCrater = distance >= craterStart - 65 && distance <= craterEnd + 65;
        // The steep road forces a slow, careful crawl through the slope.
        const steepRoad = inCrater && routeChoice && !routeChoice.avoidedHill;
        const topSpeed = steepRoad ? 55 : 145;
        const targetSpeed = heading * (pedal < 0 ? -Math.min(86, topSpeed) : pedal * Math.min(topSpeed, cruising ? 110 : 145));
        const delta = targetSpeed - speed;
        speed += Math.sign(delta) * Math.min(Math.abs(delta), 310 * dt);
        distance = Math.max(heading === 1 ? 105 : departure, Math.min(destination, distance + speed * dt));
        if (heading === 1 && !routeChoice && distance >= routeFork) openRouteChoice();
        else if (heading === 1 && distance === destination) stopAtStation();
        else if (heading === -1 && distance === departure) {
          beginExit();
          if (phase === 'idle') return;
        } else {
          const message = inCrater
            ? (steepRoad ? 'Steep slope! The wheels are slipping. Take it slow.'
              : routeChoice ? 'Gentle road around the hill. Longer, but safe.' : 'Crater ahead. Follow the slope.')
            : heading === 1 && routeChoice && distance < craterStart
              ? (routeChoice.avoidedHill ? 'Taking the long way around the hill.' : 'Heading straight for the steep hill.')
            : heading === 1 ? 'Find the lost research bot.' : 'Drive back to the outpost.';
          if (objective.textContent !== message) objective.textContent = message;
        }
        if ((distance <= departure && speed < 0 && heading === -1)
          || (distance === 105 && speed < 0) || (distance === destination && speed > 0)) speed = 0;
      }
      // Rover motor: louder and higher-pitched the faster it drives.
      const motorOn = !atStation && phase === 'driving';
      if (motorOn && !engineSound) engineSound = SFX.loop('engine', 0.3);
      if (!motorOn && engineSound) stopEngine();
      engineSound?.set(0.3 + Math.min(1, Math.abs(speed) / 145) * 0.7);
      updateDust(dt, distance - previousDistance);
      paint();
    }
    frameId = requestAnimationFrame(update);
  }

  for (const pedal of pedals) {
    pedal.addEventListener('pointerdown', event => {
      if (phase !== 'driving' || pedal.disabled || event.button !== 0) return;
      pedal.setPointerCapture(event.pointerId);
      cruising = false;
      input.set(event.pointerId, Number(pedal.dataset.driveDirection));
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      pedal.addEventListener(name, event => input.delete(event.pointerId));
    }
    pedal.addEventListener('keydown', event => {
      if (event.code !== 'Space' && event.code !== 'Enter') return;
      event.preventDefault();
      cruising = false;
      input.set(pedal, Number(pedal.dataset.driveDirection));
    });
    pedal.addEventListener('keyup', () => input.delete(pedal));
    pedal.addEventListener('blur', () => input.delete(pedal));
  }
  exit.addEventListener('click', beginExit);
  siteAction.addEventListener('click', interactAtStation);
  window.addEventListener('message', event => {
    if (researchTask.hidden || event.source !== researchTask.contentWindow) return;
    if (event.data?.type === 'mission-trainer:route-chosen') {
      closeResearchTask();
      routeChoice = { route: event.data.route, avoidedHill: Boolean(event.data.avoidedHill) };
      cruising = true;
      objective.textContent = routeChoice.avoidedHill
        ? 'Taking the long way around the hill.'
        : 'Heading straight over the steep hill.';
      drive.focus({ preventScroll: true });
      return;
    }
    if (event.data !== 'mission-trainer:research-task-complete') return;
    closeResearchTask();
    researchComplete = true;
    SFX.play('success');
    heading = -1;
    objective.textContent = 'Research complete. Walk back to the rover.';
    drive.focus({ preventScroll: true });
  });

  return {
    get active() { return phase !== 'idle'; },
    get awayFromOutpost() { return atStation || heading === -1; },
    start() {
      if (phase !== 'idle') return;
      SFX.play('hatch');
      phase = 'entering';
      distance = departure;
      speed = 0;
      dust.length = 0;
      dustInterval = 0;
      lastFrame = null;
      heading = 1;
      atStation = false;
      researchComplete = false;
      routeChoice = null;
      cruising = true;
      objective.textContent = 'Find the lost research bot.';
      configureControls();
      fade.style.opacity = reducedMotion.matches ? 1 : 0;
      fade.hidden = false;
      transitionStart = performance.now();
      frameId = requestAnimationFrame(update);
    },
    cancel,
    clearInput,
    keyDown(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.code === 'Escape') {
        event.preventDefault();
        if (!event.repeat) beginExit();
      } else if (event.code === 'KeyE' && atStation) {
        event.preventDefault();
        if (!event.repeat) interactAtStation();
      } else {
        const directions = atStation ? walkingDirections : keyboardDirections;
        if (!(event.code in directions)) return;
        event.preventDefault();
        if ((!atStation || stepOutTime >= stepOutDuration) && !input.has(event.code)) {
          cruising = false;
          input.set(event.code, directions[event.code]);
        }
      }
    },
    keyUp(event) { input.delete(event.code); }
  };
}
