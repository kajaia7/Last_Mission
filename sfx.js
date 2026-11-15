// Mission Trainer sound effects.
// Every sound is synthesized with the Web Audio API, so there are no audio
// files to load or license. Use SFX.play('name') for one-shots and
// SFX.loop('name') for continuous sounds (returns { set(level), stop() }).
// Press M (or the speaker button) to mute; the choice is remembered.
const SFX = (() => {
  const storageKey = 'mission-trainer:muted';
  let muted = false;
  try { muted = localStorage.getItem(storageKey) === '1'; } catch {}
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  const lastPlayed = new Map();

  function audio() {
    if (ctx) return ctx;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return null;
    ctx = new Context();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    // Gentle limiter so stacked sounds never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    master.connect(limiter).connect(ctx.destination);
    const length = ctx.sampleRate * 2;
    noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function unlock() {
    const c = audio();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, unlock, { capture: true, passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  // A pitched tone with a quick attack and exponential decay.
  function tone({ type = 'sine', freq = 440, to = null, dur = 0.12, gain = 0.3, delay = 0, attack = 0.005, out = master }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A filtered noise burst (dust, air, impacts).
  function noise({ dur = 0.2, gain = 0.3, filter = 'bandpass', freq = 1000, to = null, q = 1, delay = 0, attack = 0.005 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
    f.Q.value = q;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(amp).connect(master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  const notes = (list, opts) => list.forEach((freq, i) => tone({ ...opts, freq, delay: (opts.delay ?? 0) + i * (opts.gap ?? 0.09) }));
  const vary = (value, amount = 0.08) => value * (1 + (Math.random() * 2 - 1) * amount);

  const sounds = {
    // ---- Interface ----
    click: () => tone({ type: 'square', freq: 880, dur: 0.05, gain: 0.08 }),
    select: () => notes([660, 990], { type: 'square', dur: 0.08, gain: 0.08, gap: 0.06 }),
    back: () => notes([700, 470], { type: 'square', dur: 0.08, gain: 0.07, gap: 0.06 }),
    blip: ({ pitch = 1 } = {}) => tone({ type: 'triangle', freq: 1046 * pitch, dur: 0.07, gain: 0.14 }),
    close: () => tone({ type: 'triangle', freq: 780, to: 420, dur: 0.1, gain: 0.12 }),
    denied: () => notes([196, 165], { type: 'square', dur: 0.13, gain: 0.09, gap: 0.12 }),
    type: () => tone({ type: 'square', freq: vary(1800, 0.15), dur: 0.025, gain: 0.04 }),
    page: () => noise({ dur: 0.18, gain: 0.12, filter: 'highpass', freq: 2500, to: 5000 }),

    // ---- Astronaut ----
    step: ({ metal = false } = {}) => metal
      ? (tone({ type: 'triangle', freq: vary(190), dur: 0.06, gain: 0.12 }), noise({ dur: 0.05, gain: 0.07, freq: 2600, q: 3 }))
      : noise({ dur: 0.09, gain: 0.16, filter: 'lowpass', freq: vary(900, 0.2), to: 300 }),
    jump: () => {
      tone({ type: 'sine', freq: 260, to: 620, dur: 0.18, gain: 0.14 });
      noise({ dur: 0.12, gain: 0.07, filter: 'lowpass', freq: 700 });
    },
    land: () => {
      tone({ type: 'sine', freq: 140, to: 55, dur: 0.14, gain: 0.25 });
      noise({ dur: 0.16, gain: 0.12, filter: 'lowpass', freq: 600, to: 200 });
    },
    // Metal ladder rung: a sharp clank with ringing, inharmonic overtones plus a boot knock.
    rung: () => {
      const base = vary(520, 0.06);
      noise({ dur: 0.04, gain: 0.25, filter: 'highpass', freq: 3000 });
      tone({ type: 'square', freq: base, dur: 0.07, gain: 0.12 });
      tone({ type: 'triangle', freq: base * 2.76, dur: 0.22, gain: 0.14 });
      tone({ type: 'sine', freq: base * 5.4, dur: 0.3, gain: 0.08 });
      tone({ type: 'sine', freq: 140, to: 80, dur: 0.08, gain: 0.2 });
    },

    // ---- Doors, hatches, airlock ----
    hatch: () => {
      tone({ type: 'square', freq: 90, to: 60, dur: 0.12, gain: 0.12 });
      noise({ dur: 0.45, gain: 0.18, freq: 3000, to: 900, q: 0.8, delay: 0.05 });
    },
    slide: () => noise({ dur: 0.35, gain: 0.14, freq: 600, to: 1800, q: 1.4, attack: 0.08 }),
    lever: () => {
      for (let i = 0; i < 3; i++) tone({ type: 'square', freq: 320 - i * 40, dur: 0.03, gain: 0.08, delay: i * 0.05 });
      tone({ type: 'sine', freq: 110, to: 60, dur: 0.18, gain: 0.25, delay: 0.16 });
    },
    doorOpen: () => {
      tone({ type: 'sawtooth', freq: 70, to: 110, dur: 1.2, gain: 0.06, attack: 0.15 });
      noise({ dur: 0.6, gain: 0.2, freq: 2500, to: 700, delay: 0.05 });
      notes([523, 784], { type: 'triangle', dur: 0.15, gain: 0.1, gap: 0.12, delay: 1.1 });
    },

    // ---- Cargo and computers ----
    pickup: () => notes([523, 659, 784], { type: 'square', dur: 0.08, gain: 0.08, gap: 0.06 }),
    install: () => {
      tone({ type: 'square', freq: 120, to: 70, dur: 0.1, gain: 0.15 });
      noise({ dur: 0.07, gain: 0.1, freq: 1800, q: 2 });
      notes([880, 1320], { type: 'triangle', dur: 0.1, gain: 0.1, gap: 0.08, delay: 0.14 });
    },
    boot: () => {
      tone({ type: 'sine', freq: 220, to: 440, dur: 0.3, gain: 0.08 });
      notes([523, 659, 784, 1046], { type: 'triangle', dur: 0.09, gain: 0.08, gap: 0.07, delay: 0.25 });
    },
    achievement: () => {
      notes([523, 659, 784, 1046], { type: 'square', dur: 0.14, gain: 0.07, gap: 0.1 });
      notes([1568, 2093], { type: 'sine', dur: 0.5, gain: 0.06, gap: 0.08, delay: 0.42 });
    },

    // ---- Rocket and rover ----
    // Engine ignition at the start of the descent.
    ignition: () => {
      noise({ dur: 0.9, gain: 0.5, freq: 300, to: 2400, q: 0.6, attack: 0.05 });
      tone({ type: 'sawtooth', freq: 60, to: 140, dur: 0.6, gain: 0.25, attack: 0.03 });
    },
    // Touchdown: heavy thud, landing-leg clank, engine cut-off hiss and settling dust.
    touchdown: () => {
      tone({ type: 'sine', freq: 110, to: 35, dur: 0.7, gain: 0.6 });
      tone({ type: 'square', freq: 180, to: 90, dur: 0.15, gain: 0.2 });
      tone({ type: 'triangle', freq: 640, dur: 0.35, gain: 0.12, delay: 0.04 });
      tone({ type: 'sine', freq: 1720, dur: 0.4, gain: 0.06, delay: 0.04 });
      noise({ dur: 0.9, gain: 0.35, filter: 'highpass', freq: 2500, to: 6000 });
      noise({ dur: 1.8, gain: 0.3, filter: 'lowpass', freq: 1500, to: 150 });
    },
    brake: () => noise({ dur: 0.5, gain: 0.12, filter: 'lowpass', freq: 1400, to: 300 }),
    chime: () => notes([784, 988, 1175], { type: 'sine', dur: 0.4, gain: 0.12, gap: 0.12 }),

    // ---- Mission tasks ----
    success: () => notes([659, 988], { type: 'triangle', dur: 0.18, gain: 0.14, gap: 0.1 }),
    win: () => {
      notes([523, 659, 784, 1046, 784, 1046], { type: 'square', dur: 0.14, gain: 0.07, gap: 0.11 });
      notes([262, 330, 392], { type: 'triangle', dur: 0.9, gain: 0.07, gap: 0, delay: 0.66 });
    },
    scan: ({ signal = 0 } = {}) => tone({ type: 'sine', freq: 500 + signal * 9, dur: 0.05, gain: 0.05 + signal / 1000 }),
    ratchet: () => {
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) tone({ type: 'square', freq: vary(1400), dur: 0.02, gain: 0.06, delay: i * 0.32 + j * 0.06 });
        tone({ type: 'sine', freq: 700, dur: 0.06, gain: 0.08, delay: i * 0.32 + 0.2 });
      }
    },
    pressurize: () => {
      noise({ dur: 1.8, gain: 0.16, freq: 400, to: 3200, q: 0.7, attack: 0.3 });
      tone({ type: 'sine', freq: 200, to: 600, dur: 1.8, gain: 0.05, attack: 0.3 });
    },
    sweep: () => noise({ dur: 0.12, gain: 0.07, filter: 'highpass', freq: vary(2400, 0.2), attack: 0.03 }),
    powerUp: () => {
      tone({ type: 'sawtooth', freq: 110, to: 880, dur: 0.7, gain: 0.07, attack: 0.05 });
      notes([523, 659, 784], { type: 'sine', dur: 0.6, gain: 0.07, gap: 0, delay: 0.65 });
    },
    tick: () => tone({ type: 'square', freq: 2200, dur: 0.02, gain: 0.04 }),
    zap: () => {
      for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', freq: 180, to: 90, dur: 0.08, gain: 0.07, delay: i * 0.1 });
    },
    focus: () => tone({ type: 'sine', freq: 400, to: 1200, dur: 0.25, gain: 0.07 }),
    whoosh: () => noise({ dur: 0.3, gain: 0.08, freq: 500, to: 2000, q: 1, attack: 0.1 }),
    drop: () => {
      tone({ type: 'sine', freq: 160, to: 70, dur: 0.12, gain: 0.2 });
      noise({ dur: 0.08, gain: 0.1, filter: 'lowpass', freq: 1200 });
    },
    valve: () => {
      tone({ type: 'square', freq: 100, to: 70, dur: 0.15, gain: 0.12 });
      noise({ dur: 0.3, gain: 0.1, freq: 2000, to: 500, delay: 0.05 });
    },
    flow: () => {
      for (let i = 0; i < 10; i++) tone({ type: 'sine', freq: vary(500, 0.4), to: vary(900, 0.3), dur: 0.08, gain: 0.05, delay: i * 0.16 + Math.random() * 0.08 });
      noise({ dur: 2, gain: 0.08, freq: 900, q: 0.6, attack: 0.3 });
    }
  };

  // Continuous sounds. level 0..1 drives volume (and pitch where it fits).
  const loops = {
    // Rocket engine: deep rumble plus a mid-range roar so it is audible on laptop speakers,
    // with a fast flutter like a real exhaust plume.
    thrust: () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer; src.loop = true;
      const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 500;
      const roar = ctx.createBiquadFilter(); roar.type = 'bandpass'; roar.frequency.value = 1200; roar.Q.value = 0.7;
      const roarGain = ctx.createGain(); roarGain.gain.value = 0.55;
      const rumble = ctx.createOscillator(); rumble.type = 'sawtooth'; rumble.frequency.value = 46;
      const rumbleGain = ctx.createGain(); rumbleGain.gain.value = 0.3;
      const flutter = ctx.createOscillator(); flutter.frequency.value = 13;
      const flutterDepth = ctx.createGain(); flutterDepth.gain.value = 0.15;
      const body = ctx.createGain(); body.gain.value = 0.85;
      const amp = ctx.createGain(); amp.gain.value = 0;
      src.connect(low).connect(body);
      src.connect(roar).connect(roarGain).connect(body);
      rumble.connect(rumbleGain).connect(low);
      flutter.connect(flutterDepth).connect(body.gain);
      body.connect(amp).connect(master);
      src.start(); rumble.start(); flutter.start();
      return {
        amp, max: 0.75, nodes: [src, rumble, flutter],
        set(level) {
          const t = ctx.currentTime;
          low.frequency.setTargetAtTime(300 + level * 700, t, 0.1);
          roar.frequency.setTargetAtTime(700 + level * 900, t, 0.1);
        }
      };
    },
    hiss: () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.9;
      const amp = ctx.createGain(); amp.gain.value = 0;
      src.connect(f).connect(amp).connect(master);
      src.start();
      return { amp, max: 0.22, nodes: [src] };
    },
    engine: () => {
      const motor = ctx.createOscillator(); motor.type = 'sawtooth'; motor.frequency.value = 55;
      const whine = ctx.createOscillator(); whine.type = 'sine'; whine.frequency.value = 300;
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
      const whineGain = ctx.createGain(); whineGain.gain.value = 0.15;
      const amp = ctx.createGain(); amp.gain.value = 0;
      motor.connect(f);
      whine.connect(whineGain).connect(f);
      f.connect(amp).connect(master);
      motor.start(); whine.start();
      return {
        amp, max: 0.18, nodes: [motor, whine],
        set(level) {
          const t = ctx.currentTime;
          motor.frequency.setTargetAtTime(48 + level * 40, t, 0.15);
          whine.frequency.setTargetAtTime(260 + level * 520, t, 0.15);
          f.frequency.setTargetAtTime(300 + level * 700, t, 0.15);
        }
      };
    }
  };

  function play(name, options) {
    if (muted || !sounds[name] || !audio()) return;
    // Avoid machine-gun repeats of the same sound in a single frame.
    const now = performance.now();
    if (now - (lastPlayed.get(name) ?? -Infinity) < 25) return;
    lastPlayed.set(name, now);
    try { sounds[name](options); } catch {}
  }

  // Returns a handle even when audio is unavailable so callers never need checks.
  function loop(name, startLevel = 1) {
    if (!loops[name] || !audio()) return { set() {}, stop() {} };
    const voice = loops[name]();
    let stopped = false;
    const handle = {
      set(level) {
        if (stopped) return;
        const clamped = Math.max(0, Math.min(1, level));
        voice.amp.gain.setTargetAtTime(voice.max * clamped, ctx.currentTime, 0.08);
        voice.set?.(clamped);
      },
      stop(fade = 0.25) {
        if (stopped) return;
        stopped = true;
        voice.amp.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        for (const node of voice.nodes) node.stop(ctx.currentTime + fade + 0.1);
      }
    };
    handle.set(startLevel);
    return handle;
  }

  function setMuted(value) {
    muted = value;
    try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.55, ctx.currentTime, 0.02);
    if (button) {
      button.textContent = muted ? '🔇' : '🔊';
      button.setAttribute('aria-pressed', String(muted));
      button.title = muted ? 'Sound off (M)' : 'Sound on (M)';
    }
  }

  // Floating speaker button (skipped inside embedded task frames).
  let button = null;
  function addButton() {
    if (window.parent !== window) return;
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'sfx-toggle';
    button.setAttribute('aria-label', 'Mute sound effects');
    button.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:9999;width:42px;height:42px;border-radius:50%;'
      + 'border:2px solid #ffffff55;background:#1b1414cc;color:#fff;font-size:20px;line-height:1;cursor:pointer;';
    button.addEventListener('click', () => {
      setMuted(!muted);
      play('click');
    });
    document.body.append(button);
    setMuted(muted);
  }
  if (document.body) addButton();
  else document.addEventListener('DOMContentLoaded', addButton);

  window.addEventListener('keydown', event => {
    if (event.code !== 'KeyM' || event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.target.closest?.('input, textarea, select, [contenteditable]')) return;
    setMuted(!muted);
  });

  return { play, loop, get muted() { return muted; }, setMuted };
})();
