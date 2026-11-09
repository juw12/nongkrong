// Coffee-bar sounds, made on the fly with Web Audio (no sound files).
// Each loop returns a stop() function; one-shots just play. Everything goes through one master gain
// so the barista view can mute the bar with one switch.

let ctx = null;
let master = null;
let noiseBuffer = null;
let muted = false;

function audio() {
  if (ctx) {
    return ctx;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return null;
  }
  ctx = new AudioCtx();
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.ratio.value = 3;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  master.connect(compressor);
  compressor.connect(ctx.destination);
  // two seconds of pink-ish noise, shared by every texture
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99765 * b0 + white * 0.099046;
    b1 = 0.963 * b1 + white * 0.2965164;
    b2 = 0.57 * b2 + white * 1.0526913;
    data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
  }
  return ctx;
}

export function unlock() {
  const c = audio();
  if (c && c.state === "suspended") {
    c.resume().catch(() => {});
  }
}

export function setMuted(value) {
  muted = Boolean(value);
  if (master) {
    master.gain.setTargetAtTime(muted ? 0 : 0.8, ctx.currentTime, 0.05);
  }
}

export const isMuted = () => muted;

function noise(loop = true) {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer;
  source.loop = loop;
  source.loopStart = Math.random();
  return source;
}

function envelopeGain(peak, attack = 0.04) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(peak, ctx.currentTime + attack);
  return gain;
}

function stopper(nodes, gain, release = 0.12) {
  let stopped = false;
  return () => {
    if (stopped || !ctx) {
      return;
    }
    stopped = true;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(0, t + release);
    nodes.forEach((node) => {
      try {
        node.stop(t + release + 0.05);
      } catch (error) {
        // already stopped
      }
    });
  };
}

const silent = () => () => {};

// Burr grinder: a gritty band of noise over a low motor hum that wobbles a little.
export function grind() {
  if (!audio()) {
    return silent();
  }
  const gain = envelopeGain(0.55, 0.15);
  const grit = noise();
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1900;
  band.Q.value = 0.9;
  const motor = ctx.createOscillator();
  motor.type = "sawtooth";
  motor.frequency.value = 118;
  const motorGain = ctx.createGain();
  motorGain.gain.value = 0.09;
  const motorLow = ctx.createBiquadFilter();
  motorLow.type = "lowpass";
  motorLow.frequency.value = 420;
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 7;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 260;
  wobble.connect(wobbleDepth).connect(band.frequency);
  grit.connect(band).connect(gain);
  motor.connect(motorLow).connect(motorGain).connect(gain);
  gain.connect(master);
  [grit, motor, wobble].forEach((node) => node.start());
  return stopper([grit, motor, wobble], gain, 0.35);
}

// Beans tumbling into the hopper or grounds falling: a scatter of tiny ticks.
export function scatter(count = 26, spread = 0.9, pitch = 2600) {
  if (!audio()) {
    return;
  }
  for (let i = 0; i < count; i++) {
    const at = ctx.currentTime + Math.random() * spread;
    const tick = noise(false);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = pitch * (0.7 + Math.random() * 0.8);
    filter.Q.value = 6;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(0.22 * Math.random() + 0.05, at + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.03);
    tick.connect(filter).connect(gain).connect(master);
    tick.start(at);
    tick.stop(at + 0.05);
  }
}

// A soft low thud (tamping, knocking the puck out, a glass on wood).
export function thud(depth = 1) {
  if (!audio()) {
    return;
  }
  const t = ctx.currentTime;
  const body = ctx.createOscillator();
  body.type = "sine";
  body.frequency.setValueAtTime(140 * depth, t);
  body.frequency.exponentialRampToValueAtTime(48, t + 0.18);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.7, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
  body.connect(gain).connect(master);
  body.start(t);
  body.stop(t + 0.3);
  const click = noise(false);
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 900;
  const clickGain = ctx.createGain();
  clickGain.gain.setValueAtTime(0.35, t);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
  click.connect(low).connect(clickGain).connect(master);
  click.start(t);
  click.stop(t + 0.08);
}

// Metal on metal: the portafilter locking into the group, a spoon on a glass.
export function clink(pitch = 1) {
  if (!audio()) {
    return;
  }
  const t = ctx.currentTime;
  [1, 2.76, 5.4].forEach((ratio, i) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 1180 * pitch * ratio;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.16 / (i + 1), t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / (i + 1));
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.6);
  });
}

// A ceramic cup set down on its saucer.
export function cupDown() {
  if (!audio()) {
    return;
  }
  thud(1.6);
  const t = ctx.currentTime + 0.02;
  [1920, 3150].forEach((f) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.09, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(master);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}

// Espresso: the pump's low buzz plus a thin trickle.
export function pull() {
  if (!audio()) {
    return silent();
  }
  const gain = envelopeGain(0.5, 0.3);
  const pump = ctx.createOscillator();
  pump.type = "square";
  pump.frequency.value = 50;
  const pumpLow = ctx.createBiquadFilter();
  pumpLow.type = "lowpass";
  pumpLow.frequency.value = 180;
  const pumpGain = ctx.createGain();
  pumpGain.gain.value = 0.12;
  const trickle = noise();
  const trickleBand = ctx.createBiquadFilter();
  trickleBand.type = "bandpass";
  trickleBand.frequency.value = 3200;
  trickleBand.Q.value = 1.4;
  const trickleGain = ctx.createGain();
  trickleGain.gain.value = 0.18;
  const flutter = ctx.createOscillator();
  flutter.frequency.value = 11;
  const flutterDepth = ctx.createGain();
  flutterDepth.gain.value = 0.08;
  flutter.connect(flutterDepth).connect(trickleGain.gain);
  pump.connect(pumpLow).connect(pumpGain).connect(gain);
  trickle.connect(trickleBand).connect(trickleGain).connect(gain);
  gain.connect(master);
  [pump, trickle, flutter].forEach((node) => node.start());
  return stopper([pump, trickle, flutter], gain, 0.4);
}

// Steam wand: airy hiss that turns into a deeper roll as the milk warms. setHeat(0..1) moves it.
export function steam() {
  if (!audio()) {
    const stop = silent();
    stop.setHeat = () => {};
    return stop;
  }
  const gain = envelopeGain(0.42, 0.08);
  const hiss = noise();
  const high = ctx.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 2600;
  const roll = noise();
  const rollBand = ctx.createBiquadFilter();
  rollBand.type = "bandpass";
  rollBand.frequency.value = 700;
  rollBand.Q.value = 1.2;
  const rollGain = ctx.createGain();
  rollGain.gain.value = 0.05;
  hiss.connect(high).connect(gain);
  roll.connect(rollBand).connect(rollGain).connect(gain);
  gain.connect(master);
  hiss.start();
  roll.start();
  const stop = stopper([hiss, roll], gain, 0.25);
  stop.setHeat = (heat) => {
    const t = ctx.currentTime;
    high.frequency.setTargetAtTime(2600 + heat * 2200, t, 0.2);
    rollGain.gain.setTargetAtTime(0.05 + heat * 0.35, t, 0.2);
    rollBand.frequency.setTargetAtTime(700 - heat * 260, t, 0.2);
  };
  return stop;
}

// Pouring milk or water: a soft low gurgle.
export function pour(weight = 1) {
  if (!audio()) {
    return silent();
  }
  const gain = envelopeGain(0.38 * weight, 0.12);
  const flow = noise();
  const low = ctx.createBiquadFilter();
  low.type = "lowpass";
  low.frequency.value = 820;
  low.Q.value = 3;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 5.5;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 260;
  lfo.connect(lfoDepth).connect(low.frequency);
  flow.connect(low).connect(gain);
  gain.connect(master);
  flow.start();
  lfo.start();
  return stopper([flow, lfo], gain, 0.3);
}

// Ice cubes dropped into a glass.
export function ice() {
  if (!audio()) {
    return;
  }
  for (let i = 0; i < 5; i++) {
    setTimeout(() => clink(1.6 + Math.random() * 0.6), i * 70 + Math.random() * 40);
  }
}

// A spoon going round a glass.
export function stir() {
  if (!audio()) {
    return silent();
  }
  const timer = setInterval(() => clink(2.1 + Math.random() * 0.2), 260);
  return () => clearInterval(timer);
}
