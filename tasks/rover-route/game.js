// Choose a Rover Route: compare two real Mars Trek paths and pick one.
// All numbers come from routes.js, so the feedback always matches the map.
(() => {
  const $ = id => document.getElementById(id);
  const { routes } = ROUTE_TASK;
  const inRover = window.parent !== window && new URLSearchParams(location.search).get('from') === 'rover-drive';
  const known = value => typeof value === 'number' && Number.isFinite(value);
  const both = key => routes.every(route => known(route[key]));
  const round = (value, digits = 2) => Number(value.toFixed(digits)).toString();
  let chosen = null;

  // The road that avoids the steep hill: the one with the gentler steepest part.
  // Until slopes are measured, Route B ("Around the hill") is treated as the gentle one.
  const gentle = both('maxSlopeDeg')
    ? routes.reduce((best, route) => (route.maxSlopeDeg < best.maxSlopeDeg ? route : best))
    : routes.find(route => route.id === 'b');

  // ---- Header and data check ----
  $('place').textContent = ROUTE_TASK.place.toUpperCase();
  if (ROUTE_TASK.start && ROUTE_TASK.finish) $('endpoints').textContent = `, from ${ROUTE_TASK.start} to ${ROUTE_TASK.finish}`;
  const missing = routes.some(route => !route.mapLayer || !['distanceKm', 'maxSlopeDeg', 'climbM'].every(key => known(route[key])));
  $('data-warning').hidden = !missing;

  // ---- Route cards ----
  function slopeGauge(degrees) {
    // A little ramp drawn at the real angle, so kids can see how steep it is.
    const width = 120;
    const rise = Math.min(60, Math.tan(degrees * Math.PI / 180) * width);
    return `<svg class="slope-gauge" viewBox="0 0 ${width} 62" aria-hidden="true">
      <path d="M0 61 L${width} 61 L${width} ${61 - rise} Z" />
      <text x="4" y="54">${round(degrees, 1)}°</text>
    </svg>`;
  }

  function stat(label, value, unit) {
    return `<div><dt>${label}</dt><dd>${known(value) ? `${round(value)} ${unit}` : '—'}</dd></div>`;
  }

  for (const route of routes) {
    const card = document.createElement('article');
    card.className = 'route-card';
    card.id = 'card-' + route.id;
    card.innerHTML = `
      <figure>
        <div class="route-picture">
          <img src="${route.image}" alt="Mars Trek map of ${route.label}: ${route.name}">
        </div>
        <figcaption>NASA Mars Trek · Layer: <b>${route.mapLayer ?? '— add layer name'}</b></figcaption>
      </figure>
      <div class="route-body">
        <p class="route-label">${route.label}</p>
        <h2>${route.name}</h2>
        <p class="route-summary">${route.summary}</p>
        <dl class="route-stats">
          ${stat('Distance', route.distanceKm, 'km')}
          ${stat('Steepest part', route.maxSlopeDeg, '°')}
          ${stat('Total climb', route.climbM, 'm')}
        </dl>
        ${known(route.maxSlopeDeg) ? slopeGauge(route.maxSlopeDeg) : ''}
        <button type="button" class="primary choose" data-route="${route.id}" aria-pressed="false">Take ${route.label}</button>
      </div>`;
    const img = card.querySelector('img');
    img.addEventListener('error', () => {
      img.closest('.route-picture').innerHTML = `<p class="picture-missing">Mars Trek screenshot goes here.<br>Save it as <code>tasks/rover-route/${route.image}</code></p>`;
    });
    $('route-cards').append(card);
  }

  // ---- Feedback: what the choice costs ----
  function costs(route, other) {
    const items = [];
    if (both('distanceKm')) {
      const diff = route.distanceKm - other.distanceKm;
      const percent = Math.round(Math.abs(diff) / other.distanceKm * 100);
      items.push(diff > 0
        ? `<b>${round(diff)} km longer</b> than ${other.label} (+${percent}%). More driving means more time and more battery.`
        : diff < 0
          ? `<b>${round(-diff)} km shorter</b> than ${other.label} (−${percent}%). Less driving saves time and battery.`
          : `Same distance as ${other.label}.`);
    }
    if (both('maxSlopeDeg')) {
      const steeper = route.maxSlopeDeg > other.maxSlopeDeg;
      items.push(`Steepest part: <b>${round(route.maxSlopeDeg, 1)}°</b> (${other.label}: ${round(other.maxSlopeDeg, 1)}°).`
        + (steeper ? ' Steep ground can make the wheels slip, and climbing it uses extra power.' : ' Gentler ground keeps the wheels gripping.'));
    }
    if (both('climbM')) {
      items.push(`Climbs <b>${round(route.climbM, 0)} m</b> uphill in total (${other.label}: ${round(other.climbM, 0)} m).`);
    }
    if (!items.length) {
      // Measurements not added yet: explain the trade-off in words only.
      items.push(route === gentle
        ? 'It is the longer way, so the drive takes more time and uses more battery.'
        : 'It is the shorter way, but the rover has to climb the steep hill.');
    }
    return items;
  }

  function choose(id) {
    const route = routes.find(item => item.id === id);
    const other = routes.find(item => item.id !== id);
    const avoidedHill = route === gentle;
    chosen = route;
    SFX.play(avoidedHill ? 'success' : 'denied');
    for (const button of document.querySelectorAll('.choose')) {
      const picked = button.dataset.route === id;
      button.setAttribute('aria-pressed', String(picked));
      button.closest('.route-card').dataset.state = picked ? (avoidedHill ? 'good' : 'bad') : '';
    }
    const feedback = $('feedback');
    feedback.dataset.state = avoidedHill ? 'good' : 'bad';
    $('feedback-kicker').textContent = avoidedHill ? 'GOOD CALL · GOAL MET' : 'THINK AGAIN · GOAL MISSED';
    $('feedback-title').textContent = avoidedHill
      ? `${route.label} avoids the steep hill.`
      : `${route.label} goes over the steep hill.`;
    $('feedback-costs').innerHTML = `<li class="cost-heading">What ${route.label} costs you:</li>`
      + costs(route, other).map(item => `<li>${item}</li>`).join('');
    $('try-other').textContent = `Try ${other.label}`;
    $('continue-drive').hidden = !inRover;
    feedback.hidden = false;
    feedback.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
    (inRover ? $('continue-drive') : $('try-other')).focus({ preventScroll: true });
  }

  $('route-cards').addEventListener('click', event => {
    const button = event.target.closest('.choose');
    if (button) choose(button.dataset.route);
  });
  $('try-other').addEventListener('click', () => {
    if (chosen) choose(routes.find(item => item !== chosen).id);
  });

  // ---- Inside the rover drive: send the choice back to the game ----
  if (inRover) {
    $('return-tasks').hidden = true;
    $('continue-drive').addEventListener('click', () => {
      SFX.play('select');
      window.parent.postMessage({ type: 'mission-trainer:route-chosen', route: chosen.id, avoidedHill: chosen === gentle }, '*');
    });
  } else {
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.repeat) location.href = '../../index.html#tasks';
    });
  }
})();
