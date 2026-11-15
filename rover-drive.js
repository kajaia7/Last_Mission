function createRoverDrive(onExit) {
  const drive = document.querySelector('#rover-drive');
  const fade = document.querySelector('#rover-fade');
  const canvas = drive.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  const objective = drive.querySelector('.rover-objective');
  const exit = drive.querySelector('.park-rover');
  const jump = drive.querySelector('.rover-jump');
  const siteAction = drive.querySelector('#rover-site-action');
  const pedals = [...drive.querySelectorAll('[data-drive-direction]')];
  const stationMarker = drive.querySelector('.research-station-marker');
  const boardingMarker = drive.querySelector('.rover-boarding-marker');
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
  const horizonHaze = ctx.createLinearGradient(0, 48, 0, height);
  horizonHaze.addColorStop(0, '#e88f7300');
  horizonHaze.addColorStop(.36, '#e88f7312');
  horizonHaze.addColorStop(.6, '#d9886b29');
  horizonHaze.addColorStop(1, '#d9886b00');
  const hillStart = 350;
  const hillEnd = 750;
  // Past the first rise the road forks and the player picks a route (Choose a Rover Route task).
  const routeFork = 770;
  // Route A: a steep hill sits right on the road.
  const steepStart = 840;
  const steepEnd = 1230;
  const steepCenter = (steepStart + steepEnd) / 2;
  const steepHeight = 58;
  // Route B: the road after the fork grows by the real Mars Trek distance ratio.
  const shortDestination = 1780;
  const stationWidth = 210;
  const stationHeight = 136;
  let destination, stationDoor, stationLeft, roverExitStart, roverDoor, roverFront;
  let routeChoice = null;
  const departure = 115;
  const outboundObjective = 'Heading to research Station';
  const roverGravity = 460;
  const rollingResistance = 15;
  const rollingDrag = 1.05;
  const stepOutDuration = .72;
  const jumpSpeed = 112;
  const jumpGravity = 300;
  const suitHeight = 39;
  const suitWidth = suitHeight * 96 / 124;
  const keyboardDirections = { KeyW: 1, KeyS: -1 };
  const walkingDirections = { KeyA: -1, ArrowLeft: -1, KeyD: 1, ArrowRight: 1 };
  const input = new Map();
  const roverScale = .27;
  const roverArtX = 1275;
  const roverArtY = 416;
  const tireDiameter = 86;
  const tireFaceRatio = .84;
  // The original wheel art, traced from the outpost's middle wheel.
  const tireArt = { x: 1493, y: 590, width: 105, height: 88, hubX: 66, hubY: 43, faceX: 34, faceY: 42,
    // Rows of tread that roll around the tire band (fully covered across the tire's width).
    treadRow: 34, treadRows: 24,
    // The spinning face fades out from this fraction of its size, blending into the tread.
    faceFade: .74 };
  const tireOutline = new Path2D('M43 1H75V4H83V9H89V15H94V23H98V32H101V59H98V68H94V75H89V81H82V86H26V84H15V80H10V74H6V63H3V33H5V23H9V16H15V10H23V6H33V3H43Z');
  const terrainScale = 2;
  const tires = [
    { x: 39, mount: 36, radius: 9.8, phase: .4 },
    { x: 12, mount: 19, radius: 11.8, phase: 1.1 },
    { x: -15, mount: -8, radius: 11.8, phase: .6 },
    { x: -42, mount: -32, radius: 11.8, phase: 0 }
  ];
  const dust = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let phase = 'idle';
  let frameId = 0;
  let transitionStart = 0;
  let lastFrame = null;
  let distance = 0;
  let wheelTravel = 0;
  let speed = 0;
  let cruising = true;
  let heading = 1;
  let atStation = false;
  let researchComplete = false;
  let avatarX = 0;
  let avatarFacing = 1;
  let avatarStride = 0;
  let avatarWalking = false;
  let avatarJumpHeight = 0;
  let avatarJumpVelocity = 0;
  let stepOutTime = 0;
  let chassisSprite;
  let tireSprite;
  let treadPattern;
  let treadShade;
  let faceLayer;
  let faceMask;
  let roadSprite;
  let dustInterval = 0;
  let engineSound = null;
  let reverseAlertTime = 0;
  let squeakTimer = 1;

  // Place the research station at the end of the chosen road.
  function layoutTrack(length) {
    destination = Math.round(length);
    stationDoor = destination + 220;
    stationLeft = stationDoor - 137;
    roverExitStart = destination - 34;
    roverDoor = destination - 67;
    roverFront = destination + 51;
    roadSprite = null;
  }
  layoutTrack(shortDestination);

  function stopEngine() {
    engineSound?.stop();
    engineSound = null;
    reverseAlertTime = 0;
  }

  // Electric rover drive sound: follows speed and effort, with wheel squeaks
  // and suspension knocks like NASA's recording of Perseverance driving.
  function updateEngine(pedal, dt) {
    if (!engineSound) engineSound = SFX.loop('roverMotor', .25);
    const roadSpeed = Math.abs(speed);
    const reversing = speed * heading < -7;
    if (reversing) {
      reverseAlertTime -= dt;
      if (reverseAlertTime <= 0) {
        SFX.play('reverseAlert');
        reverseAlertTime = .62;
      }
    } else reverseAlertTime = 0;

    const moving = Math.min(1, roadSpeed / 145);
    // Uphill means the ground ahead is higher (smaller y on screen).
    const climbing = moving > .05 && groundAt(distance + 20 * heading) < groundAt(distance - 20 * heading) - 1;
    const effort = pedal === 0 ? 0 : cruising ? .5 : 1;
    engineSound.set(.25 + .55 * moving + .2 * effort * (climbing ? 1 : .4), { speed: moving, reversing, climbing });

    squeakTimer -= dt * moving;
    if (squeakTimer <= 0) {
      SFX.play(Math.random() < .6 ? 'roverSqueak' : 'roverClunk');
      squeakTimer = .6 + Math.random() * 1.6;
    }
  }

  function riseBetween(x, start, end) {
    if (x <= start || x >= end) return 0;
    return Math.sin(Math.PI * (x - start) / (end - start)) ** 2;
  }

  function groundAt(x) {
    const ground = 144 - 30 * riseBetween(x, hillStart, hillEnd);
    if (!routeChoice || x < routeFork) return ground;
    // Route A: straight over the steep hill.
    if (!routeChoice.avoidedHill) return ground - steepHeight * riseBetween(x, steepStart, steepEnd);
    // Route B: the long way round stays low, with only gentle rolls.
    const fadeIn = Math.min(1, (x - routeFork) / 140);
    const fadeOut = Math.max(0, Math.min(1, (destination - 40 - x) / 140));
    return ground - 4 * Math.sin((x - routeFork) / 80) ** 2 * fadeIn * fadeOut;
  }

  function coastWithGravity(dt) {
    const front = distance + tires[0].x * heading;
    const rear = distance + tires.at(-1).x * heading;
    const grade = (groundAt(front) - groundAt(rear)) / (front - rear);
    const downhillAcceleration = roverGravity * grade / (1 + grade ** 2);
    const downhillSpeed = speed + downhillAcceleration * dt;
    const rollingSpeed = Math.max(0, Math.abs(downhillSpeed) - rollingResistance * dt);
    return Math.sign(downhillSpeed) * rollingSpeed / (1 + rollingDrag * dt);
  }

  function trailShoulder(x) {
    return 17 + 3.1 * Math.sin(x / 51) + 1.8 * Math.sin(x / 11) + .8 * Math.sin(x / 3.8);
  }

  function prepareRoad() {
    const trackWidth = destination + width;
    roadSprite = document.createElement('canvas');
    roadSprite.width = trackWidth * terrainScale;
    roadSprite.height = height * terrainScale;
    const road = roadSprite.getContext('2d');
    road.scale(terrainScale, terrainScale);
    road.imageSmoothingEnabled = false;
    if (routeChoice && !routeChoice.avoidedHill) drawHillShoulder(road);

    const surface = new Path2D();
    surface.moveTo(0, groundAt(0) - 3);
    for (let x = 2; x <= trackWidth; x += 2) {
      const ridge = Math.sin(x / 16) * 1.0 + Math.sin(x / 4) * .65;
      surface.lineTo(x, groundAt(x) - 3 + ridge);
    }
    surface.lineTo(trackWidth, height);
    surface.lineTo(0, height);
    surface.closePath();
    road.save();
    road.clip(surface);

    // Follow the wheel elevation with the base's own painted regolith. Vary the
    // space between seams so the same landmarks do not repeat at regular intervals.
    const textureWidth = 440 * terrainScale;
    const tileHeight = 96;
    const texture = document.createElement('canvas');
    texture.width = textureWidth * 2;
    texture.height = tileHeight * terrainScale;
    const textureCtx = texture.getContext('2d');
    const sourceY = 684;
    const sourceHeight = outpost.naturalHeight - sourceY;
    textureCtx.drawImage(outpost, 0, sourceY, outpost.naturalWidth, sourceHeight,
      0, 0, textureWidth, texture.height);
    textureCtx.translate(texture.width, 0);
    textureCtx.scale(-1, 1);
    textureCtx.drawImage(outpost, 0, sourceY, outpost.naturalWidth, sourceHeight,
      0, 0, textureWidth, texture.height);
    const tileWidths = [410, 478, 376, 462, 396, 484];
    for (let start = 0, tile = 0; start < trackWidth; tile++) {
      const tileWidth = tileWidths[tile % tileWidths.length];
      const end = Math.min(start + tileWidth, trackWidth);
      const offset = (tile % 2) * textureWidth;
      for (let x = start; x < end; x += 2) {
        const strip = Math.min(2, end - x);
        const column = offset + (x - start) * textureWidth / tileWidth;
        road.drawImage(texture, column, 0, strip * textureWidth / tileWidth, texture.height,
          x, groundAt(x + strip / 2) - 6, strip, tileHeight);
      }
      start = end;
    }

    const foregroundShade = road.createLinearGradient(0, 151, 0, height);
    foregroundShade.addColorStop(0, '#54233000');
    foregroundShade.addColorStop(1, '#54233048');
    road.fillStyle = foregroundShade;
    road.fillRect(0, 0, trackWidth, height);

    // Give the packed soil a rust tone and soften its edge without covering the painted rock texture.
    for (const [edge, color] of [[4, '#aa3e2f22'], [0, '#b4433029'], [-4, '#c04a3522']]) {
      const soil = new Path2D();
      soil.moveTo(0, groundAt(0) - 6);
      for (let x = 3; x <= trackWidth; x += 3) soil.lineTo(x, groundAt(x) - 6);
      soil.lineTo(trackWidth, groundAt(trackWidth) - 6);
      for (let x = trackWidth; x >= 0; x -= 2) {
        soil.lineTo(x, groundAt(x) + trailShoulder(x) + edge);
      }
      soil.closePath();
      road.fillStyle = color;
      road.fill(soil);
    }

    const sun = road.createLinearGradient(0, 0, trackWidth, 0);
    for (let x = 0; x <= trackWidth; x += 20) {
      const depth = Math.max(0, groundAt(x) - 144);
      const slope = (groundAt(x + 5) - groundAt(x - 5)) / 10;
      const shade = Math.max(0, slope * .67) + depth * .0045;
      const light = Math.max(0, -slope * .61);
      sun.addColorStop(x / trackWidth, shade > light ? `rgb(85 33 46 / ${shade})` : `rgb(237 111 59 / ${light})`);
    }
    road.fillStyle = sun;
    road.fillRect(0, 0, trackWidth, height);
    road.restore();

    drawTrailDetails(road, trackWidth);
  }

  function drawTrailDetails(road, trackWidth) {
    let seed = 0x6d2b79f5;
    const random = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };

    // Short tapered ruts reveal darker compacted soil under the loose dirt.
    for (const depth of [4.4, 10.4]) {
      for (let x = -8; x < trackWidth; x += 9 + random() * 20) {
        const end = Math.min(trackWidth, x + 5 + random() * 17);
        const middle = (x + end) / 2;
        const offset = depth + (random() - .5) * 2.1 + Math.sin(x / 37);
        const width = .55 + random() * 1.15;
        const startY = groundAt(x) + offset;
        const middleY = groundAt(middle) + offset;
        const endY = groundAt(end) + offset + (random() - .5);
        road.beginPath();
        road.moveTo(x, startY);
        road.lineTo(middle, middleY - width * .75);
        road.lineTo(end, endY);
        road.lineTo(middle, middleY + width);
        road.closePath();
        road.fillStyle = depth < 5 ? '#7a312e72' : '#8a383367';
        road.fill();
      }
    }

    const chips = ['#71313a92', '#934032a7', '#bd583c88', '#da77539b', '#ec946676'];
    for (let i = 0; i < 3100; i++) {
      const x = Math.round(random() * trackWidth * 2) / 2;
      const margin = trailShoulder(x);
      const depth = random() < .32 ? random() * margin : margin + (random() - .46) * 13;
      const y = Math.round((groundAt(x) + depth) * 2) / 2;
      road.fillStyle = chips[i % chips.length];
      road.fillRect(x, y, .5 + (random() * 2 | 0) * .5, .5);
    }

    const stones = [
      [new Path2D('M-4 0L-3 -2L-1 -2.5L.5 -4L2.5 -3L4.5 -1.5L5 0Z'),
        new Path2D('M-3 -2L-1 -2.5L.5 -4L2.5 -3L1 -2L-2 -1Z'),
        new Path2D('M1 -2L2.5 -3L4.5 -1.5L5 0L2 0Z')],
      [new Path2D('M-5 0L-3 -1.5L-1.5 -1.5L.5 -3.5L3 -3L4 -2L5 0Z'),
        new Path2D('M-3 -1.5L-1.5 -1.5L.5 -3.5L3 -3L1 -1L-2 -.5Z'),
        new Path2D('M1 -1L3 -3L4 -2L5 0L2.5 0Z')],
      [new Path2D('M-4.5 0L-4 -1L-2 -2L-1 -3L1 -2L3 -2.5L5 0Z'),
        new Path2D('M-4 -1L-2 -2L-1 -3L1 -2L3 -2.5L2.5 -1.5L-1 -.5Z'),
        new Path2D('M2.5 -1.5L3 -2.5L5 0L2 0Z')]
    ];
    const paintStone = (x, y, scale, near) => {
      const [shape, litFace, flank] = stones[Math.floor(random() * stones.length)];
      road.save();
      road.translate(Math.round(x * 2) / 2, Math.round(y * 2) / 2);
      road.scale(scale, scale);
      road.fillStyle = '#54283179';
      road.fillRect(-3, -.15, 8, 1);
      road.fillStyle = near ? '#914436' : '#a65640';
      road.fill(shape);
      road.fillStyle = near ? '#d77a51' : '#e18c61';
      road.fill(litFace);
      road.fillStyle = near ? '#6e3232' : '#8b463b';
      road.fill(flank);
      road.restore();
    };
    for (let x = 3; x < trackWidth; x += 7 + random() * 23) {
      const near = random() < .72;
      const y = groundAt(x) + (near ? trailShoulder(x) + random() * 12 : -2 + random() * 1.5);
      const scale = near ? .47 + random() * 1.06 : .4 + random() * .4;
      paintStone(x, y, scale, near);
      if (near && random() < .47) {
        paintStone(x - 4 - random() * 4, y + 1 + random() * 2, scale * .46, true);
        paintStone(x + 3 + random() * 5, y + random() * 4, scale * .32, true);
      }
    }
  }

  // Route A: the hill's rocky shoulder rises above the road that climbs its face,
  // painted with the same outpost rock texture as the rest of the trail.
  function drawHillShoulder(road) {
    const left = steepStart - 30;
    const right = steepEnd + 30;
    const top = 144 - steepHeight * 1.5 - 10;
    const rock = new Path2D();
    rock.moveTo(left, 150);
    for (let x = left; x <= right; x += 2) {
      const rise = 144 - groundAt(x);
      const rubble = (Math.sin(x / 6) * .9 + Math.sin(x / 2.9) * .64) * Math.min(1, rise / 9);
      rock.lineTo(x, groundAt(x) - 5 - rise * .45 - Math.abs(rubble) * 1.5);
    }
    rock.lineTo(right, 150);
    rock.closePath();
    road.save();
    road.clip(rock);
    road.drawImage(outpost, 205, 716, 1360, 131, left, top, right - left, 150 - top);
    const shade = road.createLinearGradient(0, top, 0, 150);
    shade.addColorStop(0, '#f0915f2e');
    shade.addColorStop(.45, '#a44a4438');
    shade.addColorStop(1, '#592334a8');
    road.fillStyle = shade;
    road.fillRect(left, top, right - left, 150 - top);
    road.restore();

    // A yellow "steep slope" sign at the foot of the hill.
    const signX = steepStart - 26;
    const base = groundAt(signX);
    road.fillStyle = '#392938';
    road.fillRect(signX - 1, base - 16, 2, 16);
    road.beginPath();
    road.moveTo(signX, base - 28);
    road.lineTo(signX + 9, base - 13);
    road.lineTo(signX - 9, base - 13);
    road.closePath();
    road.fillStyle = '#ffd36e';
    road.fill();
    road.lineWidth = 1.2;
    road.strokeStyle = '#392938';
    road.stroke();
    road.fillStyle = '#392938';
    road.fillRect(signX - .6, base - 23, 1.2, 5);
    road.fillRect(signX - .6, base - 16.5, 1.2, 1.2);
  }

  // The steep hill in the distance: ahead before the fork, and off to the side on Route B.
  function drawDistantHill(camera) {
    const x = width / 2 + (steepCenter - camera - width / 2) * .55;
    if (x < -160 || x > width + 160) return;
    const body = ctx.createLinearGradient(0, 96, 0, 142);
    body.addColorStop(0, '#c9775fd9');
    body.addColorStop(1, '#9c5352d9');
    ctx.beginPath();
    ctx.moveTo(x - 150, 142);
    for (let dx = -150; dx <= 150; dx += 6) {
      const t = dx / 150;
      ctx.lineTo(x + dx, 142 - 44 * (1 - t * t) ** 1.6 + Math.sin(dx / 7) * .8);
    }
    ctx.closePath();
    ctx.fillStyle = body;
    ctx.fill();
    ctx.fillStyle = '#f3a77f4d';
    ctx.beginPath();
    ctx.moveTo(x - 70, 142 - 44 * (1 - (70 / 150) ** 2) ** 1.6);
    ctx.quadraticCurveTo(x - 20, 96, x + 6, 98.5);
    ctx.lineTo(x - 30, 120);
    ctx.closePath();
    ctx.fill();
  }

  function drawLandscape(camera, now) {
    ctx.fillStyle = '#e88968';
    ctx.fillRect(0, 0, width, height);
    if (background.naturalWidth) {
      const shift = camera * .144;
      ctx.drawImage(background, Math.round(-shift * 2) / 2, 0, 718, height);
    }

    if (!routeChoice || routeChoice.avoidedHill) drawDistantHill(camera);
    ctx.fillStyle = horizonHaze;
    ctx.fillRect(0, 48, width, height - 48);
    const drift = reducedMotion.matches ? 0 : now * .009;
    const span = width + 240;
    for (let i = 0; i < 3; i++) {
      const offset = (i * 233 + drift - camera * .24) % span;
      const x = (offset + span) % span - 120;
      groundGlow(x, 117 + i * 4, 115, 8, '#e7866119', '#e7866100');
    }
    if (!roadSprite && outpost.naturalWidth) prepareRoad();
    if (roadSprite) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(roadSprite, Math.round(camera * terrainScale), 0, width * terrainScale, height * terrainScale,
        0, 0, width, height);
      ctx.restore();
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
    tire.clip(tireOutline);
    tire.drawImage(outpost, -tireArt.x, -tireArt.y);

    // A strip of tread rows that repeats seamlessly, so the band can roll.
    const strip = document.createElement('canvas');
    strip.width = tireArt.width;
    strip.height = tireArt.treadRows;
    // Use only real tread columns: the band's own columns, continued with its inner
    // columns, so no hub pieces or the dark band/face border end up in the tread.
    const stripCtx = strip.getContext('2d');
    stripCtx.drawImage(tireSprite, 0, tireArt.treadRow, 30, tireArt.treadRows, 0, 0, 30, tireArt.treadRows);
    for (let x = 30; x < tireArt.width; x += 22) {
      stripCtx.drawImage(tireSprite, 8, tireArt.treadRow, 22, tireArt.treadRows, x, 0, 22, tireArt.treadRows);
    }
    treadPattern = ctx.createPattern(strip, 'repeat');
    // Keep the tire round: light on top, shadow underneath.
    treadShade = ctx.createLinearGradient(0, 0, 0, tireArt.height);
    treadShade.addColorStop(0, '#ffd0a033');
    treadShade.addColorStop(.5, '#00000000');
    treadShade.addColorStop(1, '#1a0c1466');

    // The spinning face is drawn on its own layer and faded at the edge (no hard ring).
    faceLayer = document.createElement('canvas');
    faceLayer.width = tireArt.width;
    faceLayer.height = tireArt.height;
    faceMask = document.createElement('canvas');
    faceMask.width = tireArt.width;
    faceMask.height = tireArt.height;
    const mask = faceMask.getContext('2d');
    mask.translate(tireArt.hubX, tireArt.hubY);
    mask.scale(tireArt.faceX / tireArt.faceY, 1);
    const fade = mask.createRadialGradient(0, 0, 0, 0, 0, tireArt.faceY);
    fade.addColorStop(0, '#000');
    fade.addColorStop(tireArt.faceFade, '#000');
    fade.addColorStop(1, '#0000');
    mask.fillStyle = fade;
    mask.fillRect(-tireArt.faceY, -tireArt.faceY, tireArt.faceY * 2, tireArt.faceY * 2);
  }

  function drawTire(axle, farSide = false) {
    // Each wheel rides its own suspension and turns with the distance it rolls.
    // The tread band rolls around the tire, and the wheel face (rim, hub and the
    // tread notches on its edge) spins on top, so the whole wheel turns.
    const turn = axle.phase - (reducedMotion.matches ? 0 : wheelTravel * heading / axle.radius);
    const scale = axle.radius * 2 / tireDiameter;
    const { width, height, hubX, hubY, faceX, faceY, treadRow, treadRows } = tireArt;
    ctx.save();
    ctx.translate(axle.centerX, axle.centerY);
    ctx.scale(-scale * heading, scale);
    if (farSide) ctx.filter = 'brightness(.63)';

    // Tread band: on a clockwise turn the visible side of the tread moves upward.
    ctx.save();
    ctx.translate(-hubX, -hubY);
    ctx.clip(tireOutline);
    const roll = ((-turn * hubY) % treadRows + treadRows) % treadRows;
    treadPattern.setTransform(new DOMMatrix().translate(0, treadRow + roll));
    ctx.fillStyle = treadPattern;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = treadShade;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Wheel face, rotated in its own (foreshortened) plane so it still reads as 3D,
    // then faded at its edge so it blends into the rolling tread.
    const face = faceLayer.getContext('2d');
    face.globalCompositeOperation = 'source-over';
    face.setTransform(1, 0, 0, 1, 0, 0);
    face.clearRect(0, 0, width, height);
    face.translate(hubX, hubY);
    face.scale(faceX / faceY, 1);
    face.rotate(turn);
    face.scale(faceY / faceX, 1);
    face.drawImage(tireSprite, -hubX, -hubY);
    face.setTransform(1, 0, 0, 1, 0, 0);
    face.globalCompositeOperation = 'destination-in';
    face.drawImage(faceMask, 0, 0);
    ctx.drawImage(faceLayer, -hubX, -hubY);
    ctx.restore();
  }

  function drawSuspension(axles, screenX, y, pitch) {
    const cos = Math.cos(pitch);
    const sin = Math.sin(pitch);
    ctx.save();
    ctx.lineCap = 'round';
    for (const axle of axles) {
      const x = axle.mount * heading;
      const anchorX = screenX + x * cos + 22 * sin;
      const anchorY = y + x * sin - 22 * cos;
      ctx.beginPath();
      ctx.moveTo(anchorX, anchorY);
      ctx.lineTo(axle.centerX, axle.centerY);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#281d24';
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#8c6552';
      ctx.stroke();
    }
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
    const axles = tires.map(tire => {
      const worldX = distance + tire.x * heading;
      const x = screenX + tire.x * heading;
      const ground = groundAt(worldX);
      const slope = (groundAt(worldX + 1) - groundAt(worldX - 1)) / 2;
      const normal = Math.hypot(1, tireFaceRatio * slope);
      return { ...tire, ground,
        centerX: x + tire.radius * tireFaceRatio ** 2 * slope / normal,
        centerY: ground - tire.radius / normal
      };
    });
    const rear = axles.at(-1).ground;
    const front = axles[0].ground;
    const pitch = Math.atan2((front - rear) * heading, tires[0].x - tires.at(-1).x);
    const y = (front + rear) / 2;

    drawSuspension(axles, screenX, y, pitch);
    drawTire(axles[0], true);
    ctx.save();
    ctx.translate(screenX, y);
    ctx.rotate(pitch);
    ctx.scale(-roverScale * heading, roverScale);
    ctx.drawImage(chassisSprite, -210, -260);
    ctx.restore();
    for (const axle of axles.slice(1)) drawTire(axle);
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
      ctx.fillStyle = '#edb29a';
      ctx.fillRect(x - size + 1, y - 2, size + 1, 2.5);
      ctx.fillStyle = '#a34f4c';
      ctx.fillRect(x - size, y, 2 * size, 3);
      ctx.fillStyle = '#f4c7aa';
      ctx.fillRect(x - Math.round(size * .6), y - 3, 1.5, 1);
    }
    ctx.globalAlpha = 1;
  }

  function drawAstronaut(camera) {
    if (!atStation || !astronaut.naturalWidth) return;
    const pose = avatarJumpHeight > 0 ? 5 : avatarWalking ? 1 + Math.floor(avatarStride / 3) % 4 : 0;
    const floor = groundAt(avatarX);
    const x = avatarX - camera;
    ctx.save();
    ctx.translate(x, floor - avatarJumpHeight + suitHeight / 124);
    ctx.scale(avatarFacing, 1);
    ctx.drawImage(astronaut, pose * 96, 0, 96, 124, -suitWidth / 2, -suitHeight, suitWidth, suitHeight);
    ctx.restore();
  }

  const stationArtScale = .94;
  const stationArtCrop = { x: 29, y: 67, width: 1380, height: 892 };

  function drawStation(left, entranceReady) {
    const floor = groundAt(stationLeft);
    const doorway = left + stationDoor - stationLeft;
    const artLeft = doorway - (stationDoor - stationLeft) * stationArtScale;
    const artWidth = stationWidth * stationArtScale;
    const artHeight = stationHeight * stationArtScale;
    const artTop = floor - artHeight;
    const crop = stationArtCrop;
    const artX = x => artLeft + (x - crop.x) * artWidth / crop.width;
    const artY = y => artTop + (y - crop.y) * artHeight / crop.height;

    ctx.drawImage(station, crop.x, crop.y, crop.width, crop.height, artLeft, artTop, artWidth, artHeight);

    if (entranceReady) {
      groundGlow(artX(924), artY(559), 9, 5, '#ffe3b2c4', '#ffb45300');
      groundGlow(artX(1067), artY(618), 5, 3, '#84f4d36b', '#84f4d300');
    }
    if (!researchComplete) {
      groundGlow(artX(228), artY(699), 9, 3.5, '#84edcd5e', '#84edcd00');
    }
  }

  function paint(now) {
    const camera = Math.max(0, distance - 177);
    drawLandscape(camera, now);
    const roverX = distance - camera;
    const left = stationLeft - camera;
    const labelX = stationDoor - camera;
    const entranceReady = canEnterStation();
    stationMarker.hidden = !station.naturalWidth || labelX > width - 70;
    stationMarker.classList.toggle('is-ready', entranceReady);
    if (!stationMarker.hidden) {
      stationMarker.style.setProperty('--x', `${(labelX - 23) / width * 100}%`);
    }
    boardingMarker.hidden = !atStation || !researchComplete;
    if (!boardingMarker.hidden) {
      boardingMarker.style.setProperty('--x', `${roverX / width * 100}%`);
      boardingMarker.classList.toggle('is-ready', canBoardRover());
    }
    if (left < width && station.naturalWidth) drawStation(left, entranceReady);
    drawDust(camera);
    const behindRover = atStation && stepOutTime < stepOutDuration;
    if (behindRover) drawAstronaut(camera);
    drawRover(roverX);
    if (!behindRover) drawAstronaut(camera);
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
    drive.classList.toggle('is-on-foot', atStation);
    objective.classList.toggle('is-announcement-only', atStation);
    jump.hidden = !atStation;
    jump.disabled = stepOutTime < stepOutDuration;
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
    avatarX = reducedMotion.matches ? roverDoor : roverExitStart;
    avatarFacing = -1;
    avatarStride = 0;
    avatarWalking = stepOutTime < stepOutDuration;
    avatarJumpHeight = 0;
    avatarJumpVelocity = 0;
    clearInput();
    configureControls();
    objective.textContent = 'Lost research bot located. Enter the Research Station.';
  }

  function canEnterStation() {
    return atStation && !researchComplete && stepOutTime >= stepOutDuration && Math.abs(avatarX - stationDoor) <= 15;
  }

  function canBoardRover() {
    return atStation && researchComplete && stepOutTime >= stepOutDuration
      && avatarX >= roverDoor && avatarX <= roverFront + 12;
  }

  function stationActionLabel() {
    if (canBoardRover()) return 'Board rover';
    if (canEnterStation()) return 'Enter Research Station';
    return '';
  }

  function jumpAtStation() {
    if (phase !== 'driving' || !atStation || stepOutTime < stepOutDuration || avatarJumpVelocity || avatarJumpHeight) return;
    avatarJumpVelocity = jumpSpeed;
    SFX.play('jump');
  }

  function moveAtStation(dt) {
    if (stepOutTime < stepOutDuration) {
      stepOutTime = Math.min(stepOutDuration, stepOutTime + dt);
      const progress = stepOutTime / stepOutDuration;
      avatarX = roverExitStart + (roverDoor - roverExitStart) * progress;
      avatarStride = roverExitStart - avatarX;
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
      if (avatarJumpVelocity || avatarJumpHeight) {
        avatarJumpHeight += (avatarJumpVelocity - jumpGravity * dt / 2) * dt;
        avatarJumpVelocity -= jumpGravity * dt;
        if (avatarJumpHeight <= 0 && avatarJumpVelocity <= 0) {
          avatarJumpHeight = 0;
          avatarJumpVelocity = 0;
          SFX.play('land');
        }
      }
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
      heading = -1;
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
      let pedal = 0;
      if (atStation && phase === 'driving') moveAtStation(dt);
      else if (!atStation && phase === 'driving') {
        pedal = [...input.values()].at(-1) ?? (cruising ? 1 : 0);
        // Route A: the steep hill forces a slow crawl, and the wheels slip on the way up.
        const steepRoad = Boolean(routeChoice && !routeChoice.avoidedHill
          && distance >= steepStart - 40 && distance <= steepEnd + 40);
        const climbing = steepRoad && (heading === 1 ? distance < steepCenter : distance > steepCenter);
        const slip = climbing ? .7 + .3 * Math.sin(now / 170) : 1;
        const topSpeed = steepRoad ? 80 * slip : Infinity;
        const detour = Boolean(routeChoice?.avoidedHill && distance > routeFork + 40 && distance < destination - 120);
        if (pedal === 0) {
          speed = coastWithGravity(dt);
        } else {
          const targetSpeed = heading * (pedal < 0 ? -Math.min(86, topSpeed) : Math.min(cruising ? 110 : 145, topSpeed));
          const delta = targetSpeed - speed;
          speed += Math.sign(delta) * Math.min(Math.abs(delta), 310 * dt);
        }
        distance = Math.max(heading === 1 ? 105 : departure, Math.min(destination, distance + speed * dt));
        if (heading === 1 && !routeChoice && distance >= routeFork) openRouteChoice();
        else if (heading === 1 && distance === destination) stopAtStation();
        else if (heading === -1 && distance === departure) {
          beginExit();
          if (phase === 'idle') return;
        } else {
          const message = steepRoad
            ? (climbing ? 'Steep climb! The wheels are slipping. Take it slow.' : 'Steep way down. Ease off the speed.')
            : detour ? 'Driving around the hill. A longer road, but gentle and safe.'
            : heading === 1 && routeChoice && !routeChoice.avoidedHill && distance < steepStart
              ? 'Heading straight for the steep hill.'
            : heading === 1 ? outboundObjective : 'Drive back to the outpost.';
          if (objective.textContent !== message) objective.textContent = message;
        }
        if ((distance <= departure && speed < 0 && heading === -1)
          || (distance === 105 && speed < 0) || (distance === destination && speed > 0)) speed = 0;
      }
      const motorOn = !atStation && phase === 'driving';
      if (motorOn) updateEngine(pedal, dt);
      else if (engineSound) stopEngine();
      const traveled = distance - previousDistance;
      wheelTravel += Math.sign(traveled) * Math.hypot(traveled, groundAt(distance) - groundAt(previousDistance));
      updateDust(dt, traveled);
      paint(now);
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
  jump.addEventListener('click', jumpAtStation);
  siteAction.addEventListener('click', interactAtStation);
  window.addEventListener('message', event => {
    if (researchTask.hidden || event.source !== researchTask.contentWindow) return;
    if (event.data?.type === 'mission-trainer:route-chosen') {
      closeResearchTask();
      routeChoice = { route: event.data.route, avoidedHill: Boolean(event.data.avoidedHill) };
      // The road after the fork grows by the real distance ratio between the two routes.
      const ratio = Number(event.data.lengthRatio);
      const lengthRatio = Number.isFinite(ratio) && ratio >= 1 ? ratio : (routeChoice.avoidedHill ? 1.45 : 1);
      layoutTrack(routeFork + (shortDestination - routeFork) * lengthRatio);
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
    clearInput();
    SFX.play('success');
    objective.textContent = 'Research complete. Walk back to the rover.';
    drive.focus({ preventScroll: true });
  });

  const prepareDriveArt = () => window.requestIdleCallback?.(() => {
    if (!outpost.naturalWidth) return;
    if (!roadSprite) prepareRoad();
    if (!chassisSprite) prepareRoverSprites();
  });
  if (outpost.complete) prepareDriveArt();
  else outpost.addEventListener('load', prepareDriveArt, { once: true });

  return {
    get active() { return phase !== 'idle'; },
    get awayFromOutpost() { return atStation || heading === -1; },
    start() {
      if (phase !== 'idle') return;
      SFX.play('hatch');
      phase = 'entering';
      distance = departure;
      wheelTravel = 0;
      speed = 0;
      dust.length = 0;
      dustInterval = 0;
      lastFrame = null;
      heading = 1;
      atStation = false;
      researchComplete = false;
      if (routeChoice) {
        routeChoice = null;
        layoutTrack(shortDestination);
      }
      cruising = true;
      objective.textContent = outboundObjective;
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
      } else if (atStation && (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW')) {
        if (event.code === 'Space' && event.target.closest('button')) return;
        event.preventDefault();
        if (!event.repeat) jumpAtStation();
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
