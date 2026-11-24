// Tiny procedural sound effects — no audio assets, generated with WebAudio.

let ctx = null;
let muted = false;

function audio() {
  if (muted) return null;
  if (ctx) return ctx;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

function tone({ freq = 440, to = null, dur = 0.12, type = 'square', gain = 0.05, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const amp = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.16, gain = 0.09, lowpass = 1400, delay = 0 }) {
  const ac = audio();
  if (!ac) return;
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const t0 = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * dur);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    const decay = 1 - i / frames;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }
  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(lowpass, t0);
  filter.frequency.exponentialRampToValueAtTime(260, t0 + dur);
  const amp = ac.createGain();
  amp.gain.setValueAtTime(gain, t0);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(amp).connect(ac.destination);
  src.start(t0);
}

export const sfx = {
  setMuted(v) {
    muted = v;
  },
  select() {
    tone({ freq: 620, dur: 0.05, type: 'square', gain: 0.028 });
  },
  move() {
    tone({ freq: 300, to: 210, dur: 0.13, type: 'triangle', gain: 0.05 });
  },
  shot() {
    noise({ dur: 0.12, gain: 0.07, lowpass: 2600 });
    tone({ freq: 150, to: 70, dur: 0.1, type: 'sawtooth', gain: 0.05 });
  },
  boom() {
    noise({ dur: 0.34, gain: 0.12, lowpass: 900 });
    tone({ freq: 90, to: 40, dur: 0.28, type: 'sine', gain: 0.07 });
  },
  build() {
    tone({ freq: 440, dur: 0.07, type: 'square', gain: 0.04 });
    tone({ freq: 660, dur: 0.09, type: 'square', gain: 0.04, delay: 0.07 });
  },
  start() {
    tone({ freq: 220, dur: 0.14, type: 'triangle', gain: 0.05 });
    tone({ freq: 330, dur: 0.14, type: 'triangle', gain: 0.05, delay: 0.13 });
    tone({ freq: 440, dur: 0.2, type: 'triangle', gain: 0.05, delay: 0.26 });
  },
  win() {
    tone({ freq: 392, dur: 0.18, type: 'triangle', gain: 0.06 });
    tone({ freq: 523, dur: 0.18, type: 'triangle', gain: 0.06, delay: 0.16 });
    tone({ freq: 659, dur: 0.34, type: 'triangle', gain: 0.06, delay: 0.32 });
  },
  lose() {
    tone({ freq: 220, to: 110, dur: 0.5, type: 'sawtooth', gain: 0.05 });
  },
};
