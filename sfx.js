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
  let rocketBuffer = null;
  let gritBuffer = null;
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
    // Rocket exhaust: deep brown noise plus the sharp random "crackle" pops
    // that make real rocket engines sound torn and violent rather than smooth.
    rocketBuffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const out = rocketBuffer.getChannelData(channel);
      let brown = 0;
      let pop = 0;
      for (let i = 0; i < length; i++) {
        brown = (brown + 0.02 * (Math.random() * 2 - 1)) / 1.02;
        if (Math.random() < 0.0025) pop = (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
        out[i] = brown * 3.2 + pop + (Math.random() * 2 - 1) * 0.12;
        pop *= 0.55;
      }
    }
    // Sand and gravel: dense tiny impacts, like debris blasted across the ground.
    gritBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const grit = gritBuffer.getChannelData(0);
    let hit = 0;
    for (let i = 0; i < length; i++) {
      if (Math.random() < 0.02) hit = Math.random() * 2 - 1;
      grit[i] = hit;
      hit *= 0.7;
    }
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

  // Soft echo bus: gives the chapter title sounds a smooth, roomy tail.
  let echoBus = null;
  function echo() {
    if (echoBus) return echoBus;
    const input = ctx.createGain();
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.22;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.32;
    const soften = ctx.createBiquadFilter();
    soften.type = 'lowpass';
    soften.frequency.value = 2600;
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    input.connect(master);
    input.connect(delay);
    delay.connect(soften).connect(feedback).connect(delay);
    soften.connect(wet).connect(master);
    echoBus = input;
    return echoBus;
  }

  // Route through a stereo panner when a sound should come from one side.
  function panned(out, pan) {
    if (!pan || !ctx.createStereoPanner) return out;
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(out);
    return panner;
  }

  // A pitched tone with a quick attack and exponential decay.
  function tone({ type = 'sine', freq = 440, to = null, dur = 0.12, gain = 0.3, delay = 0, attack = 0.005, out = master, pan = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(panned(out, pan));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // A filtered noise burst (dust, air, impacts).
  function noise({ dur = 0.2, gain = 0.3, filter = 'bandpass', freq = 1000, to = null, q = 1, delay = 0, attack = 0.005, out = master, pan = 0, buffer = noiseBuffer }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
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
    src.connect(f).connect(amp).connect(panned(out, pan));
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
    // Chapter title card: smooth and calm, like a chapter card in an adventure game.
    // Big "SOL 01" letters land as soft bell notes climbing a major pentatonic scale...
    titleStamp: ({ index = 0 } = {}) => {
      const out = echo();
      const freq = [392, 440, 523, 587, 659, 784][Math.min(index, 5)];
      tone({ out, type: 'sine', freq, dur: 0.7, gain: 0.13, attack: 0.008 });
      tone({ out, type: 'sine', freq: freq * 2, dur: 0.3, gain: 0.035, attack: 0.008 });
      tone({ out, type: 'triangle', freq: freq / 2, dur: 0.4, gain: 0.05, attack: 0.01 });
      tone({ type: 'sine', freq: 110, to: 70, dur: 0.2, gain: 0.1, attack: 0.01 });
    },
    // ...the chapter name types out with soft, gentle ticks...
    titleType: ({ index = 0 } = {}) => {
      tone({ type: 'triangle', freq: vary(index % 2 ? 1760 : 1568, 0.01), dur: 0.06, gain: 0.08, attack: 0.004 });
      noise({ dur: 0.025, gain: 0.03, filter: 'highpass', freq: 6000 });
    },
    // ...and the full title settles with a warm, slowly swelling chord and a shimmer.
    titleSting: () => {
      const out = echo();
      for (const freq of [261.6, 329.6, 392, 493.9, 587.3]) {
        tone({ out, type: 'sine', freq, dur: 2.2, gain: 0.05, attack: 0.35 });
        tone({ out, type: 'triangle', freq: freq * 1.004, dur: 2.2, gain: 0.025, attack: 0.4 });
      }
      notes([1046.5, 1568], { out, type: 'sine', dur: 1.6, gain: 0.022, gap: 0.12, delay: 0.2, attack: 0.05 });
      noise({ dur: 0.9, gain: 0.04, freq: 400, to: 2000, q: 0.7, attack: 0.3 });
    },
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
    brake: () => noise({ dur: 0.5, gain: 0.12, filter: 'lowpass', freq: 1400, to: 300 }),
    // Rover wheels: metal wheels squeak and the suspension knocks over rocks.
    roverSqueak: () => {
      const freq = vary(2600, 0.3);
      tone({ type: 'sine', freq, to: freq * 1.08, dur: 0.18, gain: 0.03, attack: 0.02 });
      tone({ type: 'triangle', freq: freq * 1.5, to: freq * 1.55, dur: 0.12, gain: 0.012, attack: 0.02 });
    },
    roverClunk: () => {
      tone({ type: 'triangle', freq: vary(180, 0.15), to: 120, dur: 0.07, gain: 0.08 });
      noise({ dur: 0.05, gain: 0.06, freq: 900, q: 1.5 });
    },
    reverseAlert: () => {
      tone({ type: 'triangle', freq: 760, dur: 0.16, gain: 0.19, attack: 0.01 });
      tone({ type: 'sine', freq: 1520, dur: 0.12, gain: 0.045, attack: 0.01 });
    },
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
    hiss: () => {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer; src.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 4200; f.Q.value = 0.9;
      const amp = ctx.createGain(); amp.gain.value = 0;
      src.connect(f).connect(amp).connect(master);
      src.start();
      return { amp, max: 0.22, nodes: [src] };
    },
    // Electric Mars rover drive (no combustion engine): motor and gearbox whine
    // that rises with speed, grainy wheel crunch on gravel and a low chassis rumble.
    roverMotor: () => {
      const amp = ctx.createGain();
      amp.gain.value = 0;
      amp.connect(master);
      const voice = (source, filterType, gain) => {
        const filter = ctx.createBiquadFilter();
        filter.type = filterType;
        const level = ctx.createGain();
        level.gain.value = 0;
        source.connect(filter).connect(level).connect(amp);
        return { filter, level };
      };
      const motor = ctx.createOscillator();
      motor.type = 'sawtooth';
      const motorVoice = voice(motor, 'bandpass');
      motorVoice.filter.Q.value = 2;
      const gear = ctx.createOscillator();
      gear.type = 'triangle';
      const gearVoice = voice(gear, 'lowpass');
      gearVoice.filter.frequency.value = 4000;
      const hum = ctx.createOscillator();
      hum.type = 'sine';
      const humVoice = voice(hum, 'lowpass');
      humVoice.filter.frequency.value = 600;
      const gravel = ctx.createBufferSource();
      gravel.buffer = gritBuffer;
      gravel.loop = true;
      const gravelVoice = voice(gravel, 'bandpass');
      gravelVoice.filter.frequency.value = 1800;
      gravelVoice.filter.Q.value = 0.7;
      const body = ctx.createBufferSource();
      body.buffer = noiseBuffer;
      body.loop = true;
      const bodyVoice = voice(body, 'lowpass');
      bodyVoice.filter.frequency.value = 220;
      const nodes = [motor, gear, hum, gravel, body];
      for (const node of nodes) node.start();
      return {
        amp, max: 0.3, nodes,
        set(level, { speed = 0, reversing = false, climbing = false } = {}) {
          const t = ctx.currentTime;
          const s = Math.max(0, Math.min(1, speed));
          // Motors work harder (and a little lower) on a climb.
          const pitch = (140 + 520 * s) * (reversing ? 0.9 : 1) * (climbing ? 0.88 : 1);
          motor.frequency.setTargetAtTime(pitch, t, 0.12);
          gear.frequency.setTargetAtTime(pitch * 3.7, t, 0.12);
          hum.frequency.setTargetAtTime(pitch * 0.5, t, 0.12);
          motorVoice.filter.frequency.setTargetAtTime(pitch * 2, t, 0.12);
          motorVoice.level.gain.setTargetAtTime(0.05 + 0.22 * s + (climbing ? 0.08 : 0), t, 0.12);
          gearVoice.level.gain.setTargetAtTime(0.02 + 0.06 * s, t, 0.12);
          humVoice.level.gain.setTargetAtTime(0.12 + 0.1 * s, t, 0.12);
          gravel.playbackRate.setTargetAtTime(0.5 + 1.1 * s, t, 0.12);
          gravelVoice.level.gain.setTargetAtTime(0.35 * s, t, 0.12);
          bodyVoice.level.gain.setTargetAtTime(0.12 * s, t, 0.12);
        }
      };
    }
  };

  // Scripted soundtracks that follow an animation's timeline.
  // `at(f)` converts a fraction of the animation (0..1) into seconds from now.
  const sequences = {
    landing: ({ duration = 3.6 } = {}) => {
      const t0 = ctx.currentTime + 0.02;
      const at = fraction => fraction * duration;
      const time = fraction => t0 + at(fraction);
      const out = ctx.createGain();
      out.connect(master);
      const nodes = [];

      // Main engine: crackling exhaust, softly saturated, plus a roar band and sub-bass.
      const exhaust = ctx.createBufferSource();
      exhaust.buffer = rocketBuffer; exhaust.loop = true;
      const drive = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / 512 - 1) * 2.5);
      drive.curve = curve;
      const color = ctx.createBiquadFilter(); color.type = 'lowpass'; color.Q.value = 0.5;
      const body = ctx.createGain(); body.gain.value = 0;
      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = noiseBuffer; roarSrc.loop = true;
      const roarBand = ctx.createBiquadFilter(); roarBand.type = 'bandpass'; roarBand.Q.value = 0.6;
      const roar = ctx.createGain(); roar.gain.value = 0;
      const sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 36;
      const subGain = ctx.createGain(); subGain.gain.value = 0;
      // The rocket enters from the upper left and settles in the middle.
      const enginePan = ctx.createStereoPanner ? ctx.createStereoPanner() : ctx.createGain();
      exhaust.connect(drive).connect(color).connect(body).connect(enginePan);
      roarSrc.connect(roarBand).connect(roar).connect(enginePan);
      sub.connect(subGain).connect(out);
      enginePan.connect(out);
      nodes.push(exhaust, roarSrc, sub);

      // Throttle profile, matched to the plume size in the landing animation:
      // distant cruise -> landing burn at full power -> throttle down -> cut-off.
      const ramp = (param, points) => {
        param.setValueAtTime(points[0][1], t0);
        for (const [fraction, value] of points.slice(1)) param.linearRampToValueAtTime(value, time(fraction));
      };
      ramp(body.gain, [[0, 0.001], [0.06, 0.32], [0.29, 0.55], [0.40, 0.95], [0.46, 0.9], [0.68, 0.55], [0.81, 0.3], [0.845, 0.22], [0.86, 0.0001]]);
      ramp(color.frequency, [[0, 500], [0.29, 1500], [0.40, 4200], [0.68, 2200], [0.81, 1000], [0.86, 500]]);
      ramp(roar.gain, [[0, 0.001], [0.29, 0.12], [0.40, 0.3], [0.68, 0.16], [0.81, 0.07], [0.86, 0.0001]]);
      ramp(roarBand.frequency, [[0, 600], [0.40, 1100], [0.81, 700]]);
      ramp(subGain.gain, [[0, 0.001], [0.29, 0.12], [0.40, 0.3], [0.81, 0.14], [0.86, 0.0001]]);
      if (enginePan.pan) ramp(enginePan.pan, [[0, -0.75], [0.29, -0.45], [0.51, -0.1], [0.67, 0]]);
      exhaust.start(t0, Math.random());
      roarSrc.start(t0, Math.random());
      sub.start(t0);
      // The engine layers are silent after cut-off, so free them.
      for (const node of nodes) node.stop(time(0.9));

      // RCS thrusters: sharp gas puffs on the side each visible jet fires from.
      const puff = (fraction, pan, strength = 1) => {
        noise({ out, pan, delay: at(fraction) + 0.02, dur: 0.11 * strength, gain: 0.32 * strength, filter: 'highpass', freq: 2200, attack: 0.002 });
        noise({ out, pan, delay: at(fraction) + 0.02, dur: 0.06, gain: 0.12 * strength, freq: 600, q: 1.5, attack: 0.002 });
      };
      for (const [fraction, strength] of [[0.31, 1], [0.36, 0.6], [0.44, 1], [0.48, 0.6]]) {
        puff(fraction, 0.7, strength);
        puff(fraction + 0.004, -0.7, strength * 0.8);
      }
      for (const [fraction, strength] of [[0.52, 1], [0.56, 0.7], [0.64, 0.7]]) {
        puff(fraction, -0.6, strength);
        puff(fraction + 0.004, 0.6, strength * 0.9);
      }

      // Exhaust hits the ground: sand and gravel blasting outward.
      noise({ out, buffer: gritBuffer, delay: at(0.5), dur: at(0.38), gain: 0.3, filter: 'bandpass', freq: 2600, q: 0.5, attack: at(0.22) });
      noise({ out, delay: at(0.5), dur: at(0.45), gain: 0.18, filter: 'lowpass', freq: 900, to: 300, attack: at(0.2) });

      // Touchdown: legs hit the ground, struts compress, metal rings.
      const land = at(0.82);
      tone({ out, delay: land, type: 'sine', freq: 75, to: 30, dur: 0.7, gain: 0.6 });
      noise({ out, delay: land, dur: 0.25, gain: 0.3, filter: 'lowpass', freq: 500 });
      for (const [freq, gain, dur] of [[310, 0.12, 0.5], [857, 0.09, 0.6], [1530, 0.05, 0.7], [2410, 0.03, 0.5]]) {
        tone({ out, delay: land + 0.01, type: 'triangle', freq, dur, gain });
      }
      tone({ out, delay: land + 0.05, type: 'sawtooth', freq: 95, to: 70, dur: 0.35, gain: 0.04, attack: 0.05 });

      // Engine shutdown: valves slam shut and the flame collapses.
      const cutoff = at(0.86);
      tone({ out, delay: cutoff, type: 'square', freq: 130, to: 60, dur: 0.09, gain: 0.14 });
      noise({ out, delay: cutoff, dur: 0.7, gain: 0.25, filter: 'lowpass', freq: 2000, to: 200 });

      // After landing: tanks vent with a long hiss and the hot hull ticks as it cools.
      noise({ out, delay: cutoff + 0.35, dur: 1.9, gain: 0.2, filter: 'highpass', freq: 3500, to: 5500, attack: 0.25 });
      noise({ out, delay: cutoff + 0.35, dur: 1.9, gain: 0.05, freq: 900, q: 2, attack: 0.25 });
      for (let i = 0; i < 9; i++) {
        tone({ out, delay: cutoff + 0.6 + Math.random() * 3.2, type: 'triangle', freq: 1800 + Math.random() * 2200, dur: 0.025, gain: 0.03 + Math.random() * 0.05, pan: Math.random() - 0.5 });
      }

      return {
        stop(fade = 0.3) {
          const now = ctx.currentTime;
          out.gain.cancelScheduledValues(now);
          out.gain.setValueAtTime(out.gain.value, now);
          out.gain.linearRampToValueAtTime(0, now + fade);
          for (const node of nodes) { try { node.stop(now + fade + 0.05); } catch {} }
          setTimeout(() => out.disconnect(), (fade + 6) * 1000);
        }
      };
    }
  };

  // Plays a scripted soundtrack. Skipped when the page has had no click or key
  // press yet: audio would stay blocked and start late, out of sync with the animation.
  function sequence(name, options) {
    const silent = { stop() {} };
    if (muted || !sequences[name] || !audio()) return silent;
    if (ctx.state !== 'running') {
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return silent;
      ctx.resume().catch(() => {});
    }
    try { return sequences[name](options); } catch { return silent; }
  }

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
      set(level, state) {
        if (stopped) return;
        const clamped = Math.max(0, Math.min(1, level));
        voice.amp.gain.setTargetAtTime(voice.max * clamped, ctx.currentTime, 0.08);
        voice.set?.(clamped, state);
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

  return { play, loop, sequence, get muted() { return muted; }, setMuted };
})();
