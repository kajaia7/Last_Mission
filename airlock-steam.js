function createAirlockSteam(canvas) {
  const airlock = canvas.closest('#base-airlock');
  const ctx = canvas.getContext('2d');
  const sprite = new Image();
  sprite.src = 'airlock-steam.png';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  // Origins follow the upper, middle and lower vent grilles in the chamber art.
  const vents = [
    [0.15, 0.39, 1], [0.15, 0.54, 1], [0.10, 0.72, 1],
    [0.85, 0.39, -1], [0.85, 0.54, -1], [0.90, 0.72, -1]
  ];
  const random = (min, max) => min + Math.random() * (max - min);
  const puffs = [];
  let frame;
  let started;
  let nextBurst;
  let burst;

  function puff(x, y, direction, age, floor) {
    puffs.push({
      x, y, direction, born: age, floor,
      life: floor ? random(1.0, 1.38) : random(0.82, 1.28),
      speed: floor ? random(0.07, 0.15) : random(0.27, 0.45),
      lift: floor ? random(-0.03, 0.02) : random(-0.10, 0.07),
      size: floor ? random(0.19, 0.30) : random(0.23, 0.34),
      opacity: floor ? random(0.43, 0.66) : random(0.49, 0.76),
      turn: random(-0.35, 0.35),
      flip: Math.random() < 0.5 ? -1 : 1,
      phase: random(0, 6.28)
    });
  }

  function render(now) {
    if (motion.matches) {
      stop();
      return;
    }
    started ??= now;
    const age = (now - started) / 1000;
    const emitting = airlock.dataset.phase === 'spraying';
    if (emitting && age >= nextBurst && age < 1.45) {
      vents.forEach(([x, y, direction], i) => {
        if (i % 2 === burst % 2) puff(x, y, direction, age, false);
      });
      if (age > 0.24) {
        puff(random(0.10, 0.50), random(0.82, 0.96), 1, age, true);
        puff(random(0.50, 0.90), random(0.85, 0.99), -1, age, true);
      }
      burst++;
      nextBurst = age + random(0.053, 0.082);
    }

    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const width = Math.min(1440, Math.round(canvas.clientWidth * dpr));
    const height = Math.round(width * canvas.clientHeight / Math.max(1, canvas.clientWidth));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    ctx.clearRect(0, 0, width, height);

    const hasSprite = sprite.complete && sprite.naturalWidth > 0;
    for (let index = 0; index < puffs.length;) {
      const particle = puffs[index];
      const t = (age - particle.born) / particle.life;
      if (t >= 1) {
        puffs.splice(index, 1);
        continue;
      }
      index++;
      const drift = 1 - (1 - t) ** 1.75;
      const curl = Math.sin(t * 6 + particle.phase) * t;
      const x = particle.x + particle.direction * particle.speed * drift;
      const y = particle.y + particle.lift * t + curl * 0.028;
      const span = particle.size * (particle.floor ? 0.6 + t : 0.16 + 1.42 * t);
      const fade = Math.min(1, t * 11) * (1 - t) ** (particle.floor ? 1.25 : 0.72);
      const w = span * width;
      const h = w * (particle.floor ? 0.28 : 0.50);
      ctx.save();
      ctx.globalAlpha = particle.opacity * fade;
      ctx.translate(x * width, y * height);
      ctx.rotate(particle.turn * (1 + t));
      ctx.scale(particle.flip, 1);
      if (hasSprite) {
        ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
      } else {
        // Render a soft jet if the texture is still loading.
        ctx.scale(1, h / Math.max(w, 1));
        const cloud = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(w / 2, 1));
        cloud.addColorStop(0, '#fff6e5');
        cloud.addColorStop(0.48, '#dce7e6ac');
        cloud.addColorStop(1, '#c4d7dd00');
        ctx.fillStyle = cloud;
        ctx.fillRect(-w / 2, -w / 2, w, w);
      }
      ctx.restore();
    }
    frame = emitting || puffs.length ? requestAnimationFrame(render) : undefined;
  }

  function stop() {
    cancelAnimationFrame(frame);
    frame = undefined;
    puffs.length = 0;
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function start() {
    stop();
    if (!ctx || motion.matches) return;
    started = undefined;
    nextBurst = 0;
    burst = 0;
    frame = requestAnimationFrame(render);
  }

  return { start, stop };
}
