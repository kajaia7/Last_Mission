const cargoSetup = (() => {
  const bubble = document.querySelector('#cargo-bubble');
  const shelf = document.querySelector('#rocket-cargo');
  const floorBoxes = document.querySelector('#base-cargo');
  const achievement = document.querySelector('#cargo-achievement');
  const boxes = [...floorBoxes.querySelectorAll('.cargo-box')];
  const racks = [...document.querySelectorAll('[data-base-target^="servers-"]')];
  const computers = document.querySelectorAll('[aria-controls="console"]');
  const installed = racks.map(() => 0);
  const usedBoxes = new Set();
  let phase = 'waiting';
  let selected = null;

  function highlight(index) {
    selected = index;
    boxes.forEach((box, i) => {
      const active = selected === i;
      box.dataset.selected = String(active);
      box.setAttribute('aria-pressed', String(active));
    });
  }

  function point(message, x, y, placement = 'above') {
    if (bubble.textContent !== message) bubble.textContent = message;
    bubble.style.setProperty('--x', x + '%');
    bubble.style.setProperty('--y', y + '%');
    bubble.dataset.placement = placement;
    bubble.hidden = false;
  }

  function render(room, storage, lobby, showShelf = storage) {
    const delivering = phase === 'delivering';
    shelf.hidden = !showShelf;
    shelf.classList.toggle('is-empty', phase !== 'waiting' && phase !== 'unload');
    floorBoxes.hidden = !(delivering && lobby);
    racks.forEach((rack, index) => {
      rack.classList.toggle('cargo-drop', delivering);
      rack.dataset.installed = installed[index];
    });
    const locked = phase !== 'complete';
    for (const computer of computers) {
      if (computer.getAttribute('aria-disabled') !== String(locked)) {
        computer.setAttribute('aria-disabled', String(locked));
        computer.title = locked ? 'Install all three server blocks to unlock' : '';
      }
    }
    if (phase === 'unload' && room === null) point('Unload storage', 54.7, 26);
    else if (phase === 'unload' && storage) point('Pick up the server blocks', 57.95, 52.05, 'below');
    else if (delivering && storage) point('Exit through the hatch', 40.5, 55);
    else if (delivering && room === null) point('Take the blocks to the base', 22.8, 31, 'below');
    else if (delivering && lobby) {
      if (selected === null) {
        point('Drag the blocks into servers', 16, 84);
      } else {
        point('Select either server rack', 50, 50);
      }
    } else bubble.hidden = true;
  }

  function install(index, rackIndex) {
    if (phase !== 'delivering' || index === null || rackIndex < 0
      || usedBoxes.has(index)) return false;
    const restoreFocus = document.activeElement === boxes[index];
    usedBoxes.add(index);
    installed[rackIndex]++;
    const module = document.createElement('i');
    module.className = 'cargo-crate cargo-installed-block';
    module.setAttribute('aria-hidden', 'true');
    module.style.setProperty('--slot', installed[rackIndex] - 1);
    racks[rackIndex].append(module);
    boxes[index].hidden = true;
    highlight(null);
    if (usedBoxes.size === boxes.length) {
      phase = 'complete';
      achievement.hidden = false;
      window.setTimeout(() => { achievement.hidden = true; }, 6500);
    }
    render('base', false, true);
    if (restoreFocus) racks[rackIndex].focus();
    return true;
  }

  boxes.forEach((box, index) => {
    let pointer = null;
    let moved = false;
    box.addEventListener('click', event => {
      if (moved && event.detail) return;
      highlight(selected === index ? null : index);
      render('base', false, true);
    });
    box.addEventListener('pointerdown', event => {
      if (event.button !== 0 || pointer) return;
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      moved = false;
    });
    window.addEventListener('pointermove', event => {
      if (event.pointerId !== pointer?.id) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      if (!moved && Math.hypot(dx, dy) < 6) return;
      moved = true;
      box.classList.add('cargo-dragging');
      box.style.translate = dx + 'px ' + dy + 'px';
    });
    function resetDrag() {
      pointer = null;
      box.classList.remove('cargo-dragging');
      box.style.translate = '';
    }
    window.addEventListener('pointerup', event => {
      if (event.pointerId !== pointer?.id) return;
      if (moved) {
        const rack = document.elementsFromPoint(event.clientX, event.clientY)
          .map(element => element.closest('[data-base-target^="servers-"]'))
          .find(Boolean);
        install(index, racks.indexOf(rack));
      }
      resetDrag();
    });
    window.addEventListener('pointercancel', event => {
      if (event.pointerId === pointer?.id) resetDrag();
    });
    window.addEventListener('blur', resetDrag);
  });

  return {
    start() { if (phase === 'waiting') phase = 'unload'; },
    unload() { if (phase === 'unload') phase = 'delivering'; },
    render,
    canUnload: () => phase === 'unload',
    canOpenComputer: () => phase === 'complete',
    installAt: rack => install(selected, racks.indexOf(rack))
  };
})();
