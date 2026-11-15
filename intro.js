(() => {
  const chapters = [
    ['A Place to Live', '1–7'],
    ['Keeping the Base Alive', '10–11'],
    ['Beyond the Markers', '17–21'],
    ['When the Light Fades', '34–38'],
    ['A Night Away from Home', '45–52'],
    ['Shelter Protocol', '57–64'],
    ['Under a Blue Sun', '72–75'],
    ['Bring It Home', '88–90']
  ];
  const launcher = document.getElementById('mission-launcher');
  const chapterSection = document.getElementById('chapters');
  const taskSection = document.getElementById('tasks');
  const game = document.getElementById('outpost-game');
  const clock = document.getElementById('outpost-clock');
  const grid = document.getElementById('launch-chapter-grid');
  const titleScreen = document.getElementById('launch-title-screen');
  const startButton = document.getElementById('launch-start');
  const arrivalTitle = document.getElementById('chapter-arrival-title');
  const arrivalAnnouncement = document.getElementById('chapter-arrival-announcement');
  const arrivalSol = arrivalTitle.querySelector('.chapter-arrival-sol');
  const arrivalName = arrivalTitle.querySelector('.chapter-arrival-name');
  let arrivalTimer;

  function hideArrivalTitle() {
    window.clearTimeout(arrivalTimer);
    arrivalTitle.hidden = true;
    delete arrivalTitle.dataset.typing;
  }

  game.addEventListener('pilotarrived', () => {
    hideArrivalTitle();
    const sol = 'SOL ' + clock.querySelector('b').textContent;
    const [title] = chapters[0];
    const characterDelay = 65;
    const lineDelay = 220;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    arrivalTitle.hidden = false;
    arrivalAnnouncement.textContent = sol + '. ' + title;

    const startedAt = performance.now();
    function typeArrival() {
      const elapsed = performance.now() - startedAt;
      const nameStart = sol.length * characterDelay + lineDelay;
      const solCount = reducedMotion ? sol.length : Math.min(sol.length, 1 + Math.floor(elapsed / characterDelay));
      const nameCount = reducedMotion ? title.length : Math.min(title.length, Math.max(0, 1 + Math.floor((elapsed - nameStart) / characterDelay)));
      arrivalSol.textContent = sol.slice(0, solCount);
      arrivalName.textContent = title.slice(0, nameCount);
      if (nameCount === title.length) {
        delete arrivalTitle.dataset.typing;
        arrivalTimer = window.setTimeout(endArrivalTitle, 2400);
      } else {
        arrivalTitle.dataset.typing = elapsed < nameStart ? 'sol' : 'name';
        arrivalTimer = window.setTimeout(typeArrival, characterDelay);
      }
    }
    typeArrival();
  });

  function endArrivalTitle() {
    hideArrivalTitle();
    game.dispatchEvent(new Event('arrivaltitleend'));
  }

  game.addEventListener('chapterchange', event => {
    if (!event.detail) {
      if (!arrivalTitle.hidden) endArrivalTitle();
      arrivalAnnouncement.textContent = '';
    }
  });

  for (const [index, [title, sols]] of chapters.entries()) {
    const number = index + 1;
    const item = document.createElement('li');
    const unlocked = number === 1;
    const card = document.createElement(unlocked ? 'a' : 'div');
    card.className = 'launch-chapter';
    if (unlocked) card.href = '#chapter-1';
    const details = document.createElement('span');
    details.className = 'launch-card-details';
    const caption = document.createElement('span');
    caption.textContent = `Chapter ${String(number).padStart(2, '0')}`;
    const range = document.createElement('span');
    range.textContent = `Sols ${sols}`;
    const name = document.createElement('strong');
    name.textContent = title;
    const status = document.createElement('span');
    status.className = 'launch-card-arrow';
    if (unlocked) {
      status.textContent = '→';
      status.setAttribute('aria-hidden', 'true');
    } else {
      status.classList.add('launch-card-lock');
      status.setAttribute('role', 'img');
      status.setAttribute('aria-label', 'Locked');
    }
    details.append(caption, range);
    card.append(details, name, status);
    item.append(card);
    grid.append(item);
  }

  function showRoute(moveFocus) {
    if (/^#chapter-[2-8]$/.test(location.hash)) history.replaceState(null, '', '#chapters');
    const chapter = location.hash === '#chapter-1';
    const choosing = location.hash === '#chapters';
    const choosingTask = location.hash === '#tasks';
    const chapterChanged = game.hidden === chapter;
    launcher.hidden = chapter;
    titleScreen.hidden = choosing || choosingTask;
    chapterSection.hidden = !choosing;
    taskSection.hidden = !choosingTask;
    game.hidden = !chapter;
    clock.hidden = !chapter;
    if (chapterChanged) game.dispatchEvent(new CustomEvent('chapterchange', { detail: chapter }));
    if (moveFocus) {
      window.scrollTo(0, 0);
      const focusTarget = chapter ? document.getElementById('scene')
        : choosing ? document.getElementById('chapters-title')
        : choosingTask ? document.getElementById('tasks-title') : startButton;
      focusTarget.focus({ preventScroll: true });
    }
  }

  window.addEventListener('hashchange', () => showRoute(true));
  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.code !== 'Escape'
      || !['#chapters', '#tasks'].includes(location.hash)) return;
    event.preventDefault();
    if (!event.repeat) location.hash = '#title';
  });
  showRoute(Boolean(location.hash));
})();
