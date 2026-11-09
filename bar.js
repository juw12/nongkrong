// The barista bar: a close 3D coffee station where you make each order step by step, with the sounds of a
// real bar (asmr.js). Three camera modes:
//   fp  - your eyes: looking down at your own hands and the tools
//   tp  - over the shoulder: you see yourself, the machine and the people waiting across the counter
//   mix - over the shoulder between steps, your eyes while you work a step
// Every step is a hold (grind, tamp, pull, steam, pour...) with a target zone, or a tap (lock in, serve).

import * as THREE from "./vendor/three.module.min.js";
import * as sound from "./asmr.js";
import { RECIPES } from "./shop.js";

// ---------- the steps ----------

export const STEPS = {
  grind:     { label: "Grind", kind: "hold", max: 22, rate: 2.6, target: [17.4, 18.6], unit: "g", verb: "Hold to grind", hint: "Stop at 18 g of coffee." },
  tamp:      { label: "Tamp", kind: "hold", max: 26, rate: 9, target: [13, 17], unit: "kg", verb: "Hold to press", hint: "Press level, about 15 kg." },
  lock:      { label: "Lock in", kind: "tap", verb: "Lock the portafilter in", hint: "Twist it into the group head." },
  pull:      { label: "Pull", kind: "hold", max: 42, rate: 3.2, target: [25, 30], unit: "s", verb: "Hold to pull the shot", hint: "Stop between 25 and 30 seconds." },
  steam:     { label: "Steam", kind: "hold", max: 80, rate: 7.5, from: 6, target: [58, 65], unit: "°C", verb: "Hold to steam the milk", hint: "Stop at 60 to 65 °C, before it screams." },
  art:       { label: "Pour", kind: "hold", max: 112, rate: 22, target: [90, 102], unit: "%", verb: "Hold to pour", hint: "Fill to the brim, then lift." },
  ice:       { label: "Ice", kind: "tap", verb: "Add ice, palm sugar and milk", hint: "Build the glass before the shot." },
  scoop:     { label: "Scoop", kind: "tap", verb: "Scoop the grounds into the glass", hint: "Two heaped spoons." },
  condensed: { label: "Milk", kind: "tap", verb: "Pour condensed milk in first", hint: "A thick white layer at the bottom." },
  kettle:    { label: "Pour water", kind: "hold", max: 260, rate: 46, target: [180, 210], unit: "ml", verb: "Hold to pour hot water", hint: "Stop at about 200 ml." },
  bloom:     { label: "Bloom", kind: "hold", max: 70, rate: 22, target: [34, 46], unit: "ml", verb: "Hold to wet the grounds", hint: "Just enough to wet them, about 40 ml." },
  stir:      { label: "Stir", kind: "hold", max: 14, rate: 3.2, target: [5, 8], unit: "turns", verb: "Hold to stir", hint: "Six or seven turns, then let it settle." },
  serve:     { label: "Serve", kind: "tap", verb: "Serve", hint: "Call the name and set it down." },
};

const COARSE_GRIND = { target: [13.4, 14.6], hint: "Coarse, stop at 14 g.", max: 18 };

export function stepsFor(recipeId) {
  const recipe = RECIPES[recipeId];
  return recipe.steps.map((id) => {
    const base = { id, ...STEPS[id] };
    if (id === "grind" && recipe.coarse) {
      Object.assign(base, COARSE_GRIND);
    }
    if (id === "grind" && recipe.dripper) {
      Object.assign(base, { target: [15.4, 16.6], hint: "Medium, stop at 16 g.", max: 20 });
    }
    if (id === "steam" && recipe.foam) {
      base.hint = "More air for a cappuccino. Stop at 60 to 65 °C.";
    }
    return base;
  });
}

export function scoreStep(step, value) {
  if (step.kind !== "hold") {
    return 1;
  }
  const [lo, hi] = step.target;
  if (value >= lo && value <= hi) {
    return 1;
  }
  const tolerance = (hi - lo) * 2.2 + step.max * 0.06;
  const miss = value < lo ? lo - value : value - hi;
  return Math.max(0.2, 1 - miss / tolerance);
}

// ---------- small 3D kit ----------

const mats = new Map();
function mat(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, flatShading: true, ...options }));
  }
  return mats.get(key);
}
const STEEL = { metalness: 0.75, roughness: 0.28, flatShading: false };
function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d, color, x, y, z, o) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, o), x, y, z);
const cyl = (rt, rb, h, color, x, y, z, seg = 24, o, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), mat(color, o), x, y, z);

function canvasTex(w, h, draw) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext("2d"), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const FONT = '"IBM Plex Sans", system-ui, "Segoe UI", sans-serif';
const SERIF = '"DM Serif Display", Georgia, serif';

function tag(text, sub = "") {
  const scale = 2;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  ctx.font = `600 ${26 * scale}px ${FONT}`;
  const w1 = ctx.measureText(text).width;
  ctx.font = `500 ${20 * scale}px ${FONT}`;
  const w2 = sub ? ctx.measureText(sub).width : 0;
  canvas.width = Math.ceil(Math.max(w1, w2) + 36 * scale);
  canvas.height = (sub ? 78 : 50) * scale;
  ctx.fillStyle = "rgba(34,33,32,0.86)";
  ctx.beginPath();
  ctx.roundRect(0, 0, canvas.width, canvas.height, 14 * scale);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${26 * scale}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText(text, 18 * scale, (sub ? 26 : 25) * scale);
  if (sub) {
    ctx.fillStyle = "#e9d9c7";
    ctx.font = `500 ${20 * scale}px ${FONT}`;
    ctx.fillText(sub, 18 * scale, 56 * scale);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  const height = sub ? 0.2 : 0.13;
  sprite.scale.set(height * canvas.width / canvas.height, height, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const puffTexture = (() => {
  let tex = null;
  return () => {
    if (!tex) {
      tex = canvasTex(64, 64, (ctx) => {
        const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
        g.addColorStop(0, "rgba(255,255,255,0.9)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      });
    }
    return tex;
  };
})();

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const ease = (t) => t * t * (3 - 2 * t);

// ---------- people ----------

const SKINS = ["#f1d9bf", "#e6c09c", "#cf9c72", "#a8754d", "#7a5234"];
const SHIRTS = ["#2d4a3e", "#c58b2a", "#3d6b8c", "#6f7f34", "#b5652e", "#4f5d63", "#8a5a3b"];
const HAIRS = ["#1f1a17", "#2b211b", "#3b2a1e", "#141414"];
const pick = (list, seed) => list[Math.abs(seed) % list.length];
function seedOf(text) {
  let h = 7;
  for (const ch of String(text)) {
    h = (h * 31 + ch.charCodeAt(0)) | 0;
  }
  return Math.abs(h);
}

function person(name, { apron = false } = {}) {
  const s = seedOf(name);
  const g = new THREE.Group();
  const skin = pick(SKINS, s);
  const shirt = apron ? "#f4efe6" : pick(SHIRTS, s >> 2);
  const legs = cyl(0.11, 0.1, 0.8, "#2a2f36", 0, 0.4, 0, 12);
  const body = cyl(0.17, 0.15, 0.62, shirt, 0, 1.11, 0, 14);
  const head = mesh(new THREE.SphereGeometry(0.12, 16, 12), mat(skin), 0, 1.58, 0);
  const hair = mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9), mat(pick(HAIRS, s >> 4)), 0, 1.6, 0.0);
  g.add(legs, body, head, hair);
  if (apron) {
    const a = box(0.3, 0.62, 0.02, "#2d4a3e", 0, 0.96, -0.16);
    g.add(a);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.2 * side, 1.36, 0);
    const upper = cyl(0.045, 0.04, 0.3, shirt, 0, -0.15, 0, 10);
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    const fore = cyl(0.04, 0.035, 0.28, skin, 0, -0.14, 0, 10);
    const hand = mesh(new THREE.SphereGeometry(0.045, 10, 8), mat(skin), 0, -0.3, 0);
    elbow.add(fore, hand);
    shoulder.add(upper, elbow);
    g.add(shoulder);
    arms.push({ shoulder, elbow, side });
  }
  g.userData.arms = arms;
  return g;
}

// ---------- hands for the first-person view ----------

function firstPersonHand(side, skin) {
  const g = new THREE.Group();
  const palm = box(0.075, 0.026, 0.085, skin, 0, 0, 0, { flatShading: false, roughness: 0.75 });
  g.add(palm);
  for (let i = 0; i < 4; i++) {
    const finger = mesh(new THREE.CapsuleGeometry(0.0095, 0.045, 4, 8), mat(skin, { flatShading: false, roughness: 0.75 }), -0.027 + i * 0.018, -0.004, -0.062);
    finger.rotation.x = Math.PI / 2 - 0.35;
    g.add(finger);
  }
  const thumb = mesh(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), mat(skin, { flatShading: false, roughness: 0.75 }), 0.045 * side, -0.002, -0.012);
  thumb.rotation.z = side * 1.1;
  thumb.rotation.x = 0.5;
  g.add(thumb);
  // dark green sleeve, same as the apron, so the arm never reads as a tool
  const sleeve = cyl(0.036, 0.042, 0.24, "#2d4a3e", 0, 0, 0.21, 14, { flatShading: false, roughness: 0.9 });
  sleeve.rotation.x = Math.PI / 2;
  const wrist = cyl(0.027, 0.032, 0.1, skin, 0, 0, 0.07, 12, { flatShading: false, roughness: 0.75 });
  wrist.rotation.x = Math.PI / 2;
  g.add(wrist, sleeve);
  return g;
}

// ---------- latte art and drink surfaces ----------

function drawSurface(ctx, size, s) {
  const c = size / 2;
  ctx.clearRect(0, 0, size, size);
  // espresso with crema: darker at the rim, golden in the middle
  const crema = ctx.createRadialGradient(c, c, size * 0.05, c, c, c);
  crema.addColorStop(0, s.crema ? "#c98a4f" : "#3a2414");
  crema.addColorStop(0.7, s.crema ? "#9b5f31" : "#2d1b0f");
  crema.addColorStop(1, "#4a2c17");
  ctx.fillStyle = crema;
  ctx.fillRect(0, 0, size, size);
  if (s.milk > 0) {
    // milk mixes in as a lighter brown first
    ctx.fillStyle = `rgba(214,170,120,${Math.min(0.75, s.milk * 0.9)})`;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s.art > 0.35) {
    const p = clamp01((s.art - 0.35) / 0.55);
    const wobble = (1 - s.quality) * 10;
    ctx.fillStyle = "#fbf6ec";
    if (s.kind === "rosetta") {
      // stacked leaves along a line, then the pull-through
      const leaves = Math.round(2 + p * 6);
      for (let i = 0; i < leaves; i++) {
        const y = c + size * 0.28 - i * size * 0.075;
        const w = size * (0.3 - i * 0.026) * (0.7 + p * 0.3);
        ctx.beginPath();
        ctx.ellipse(c + Math.sin(i * 1.7) * wobble, y, Math.max(4, w), size * 0.035, 0, Math.PI, 0, true);
        ctx.fill();
      }
      if (p > 0.85) {
        ctx.strokeStyle = "#fbf6ec";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(c, c - size * 0.3);
        ctx.lineTo(c, c + size * 0.34);
        ctx.stroke();
      }
    } else {
      // heart: a round blob that the pull-through turns into a heart
      const r = size * (0.12 + p * 0.2);
      if (p < 0.8) {
        ctx.beginPath();
        ctx.arc(c + wobble * 0.4, c + size * 0.04, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.moveTo(c, c + r * 1.15);
        ctx.bezierCurveTo(c - r * 1.6, c + r * 0.1, c - r * 0.9, c - r * 1.15, c, c - r * 0.35);
        ctx.bezierCurveTo(c + r * 0.9, c - r * 1.15, c + r * 1.6 + wobble, c + r * 0.1, c, c + r * 1.15);
        ctx.fill();
      }
    }
    if (s.art > 1.0) {
      // poured past the brim: the pattern washes out
      ctx.fillStyle = `rgba(214,170,120,${Math.min(0.8, (s.art - 1) * 6)})`;
      ctx.fillRect(0, 0, size, size);
    }
  }
}

// ---------- the bar ----------

export function createBar(container, handlers = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
  } catch (error) {
    return null;
  }
  if (!renderer.getContext()) {
    return null;
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const canvas = renderer.domElement;
  canvas.className = "bar-canvas";
  canvas.setAttribute("aria-label", "3D coffee bar. Hold the button, the space bar or the view itself to work the current step.");
  container.prepend(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#2b2620");
  scene.fog = new THREE.Fog("#2b2620", 6, 11);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.03, 40);

  scene.add(new THREE.HemisphereLight("#fff3e0", "#4d4238", 1.5));
  const key = new THREE.DirectionalLight("#fff1d8", 2.0);
  key.position.set(1.4, 3.2, 1.8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -2;
  key.shadow.camera.right = 2;
  key.shadow.camera.top = 2;
  key.shadow.camera.bottom = -2;
  key.shadow.bias = -0.0006;
  scene.add(key);
  const pendant = new THREE.PointLight("#ffcf8a", 6, 4, 1.6);
  pendant.position.set(0, 2.1, 0.1);
  scene.add(pendant);

  // room: chequered floor, tiled counter front, back wall with the menu board
  const floorTex = canvasTex(256, 256, (ctx) => {
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#2d4a3e" : "#efe9dd";
        ctx.fillRect(i * 32, j * 32, 32, 32);
      }
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(4, 4);
  const floor = mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 }), 0, 0, 0);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const wall = box(10, 4, 0.1, "#e9dfcf", 0, 2, -3.2);
  scene.add(wall);
  // the menu board hangs to the left so the people waiting across the counter stand clear of it
  const menuBoard = mesh(new THREE.PlaneGeometry(1.9, 1.05), new THREE.MeshBasicMaterial({ color: "#ffffff" }), -1.7, 2.2, -3.14);
  menuBoard.scale.setScalar(0.85);
  scene.add(menuBoard);
  for (const x of [-2.6, 2.6]) {
    scene.add(box(0.08, 4, 0.08, "#5a3d27", x, 2, -3.12));
  }

  // counter
  const counter = new THREE.Group();
  const tileTex = canvasTex(256, 128, (ctx) => {
    ctx.fillStyle = "#a63d24";
    ctx.fillRect(0, 0, 256, 128);
    ctx.strokeStyle = "rgba(255,240,225,0.55)";
    ctx.lineWidth = 2;
    for (let x = 0; x <= 256; x += 21) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 128);
      ctx.stroke();
    }
    for (let y = 0; y <= 128; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y);
      ctx.stroke();
    }
  });
  tileTex.wrapS = THREE.RepeatWrapping;
  tileTex.repeat.set(3, 1);
  const front = mesh(new THREE.BoxGeometry(2.6, 0.86, 0.06), new THREE.MeshStandardMaterial({ map: tileTex, roughness: 0.7 }), 0, 0.43, -0.56);
  counter.add(front);
  counter.add(box(2.6, 0.86, 1.05, "#5a3d27", 0, 0.43, -0.05));
  const top = box(2.72, 0.05, 1.18, "#f1efe9", 0, 0.885, -0.05, { flatShading: false, roughness: 0.35 });
  counter.add(top);
  // the pass where finished cups wait, on the customer side
  counter.add(box(2.72, 0.04, 0.32, "#3b3a38", 0, 1.18, -0.78, { flatShading: false }));
  counter.add(box(0.05, 0.3, 0.05, "#3b3a38", -1.3, 1.03, -0.78));
  counter.add(box(0.05, 0.3, 0.05, "#3b3a38", 1.3, 1.03, -0.78));
  scene.add(counter);
  const Y = 0.91; // counter surface

  // grinder
  const grinder = new THREE.Group();
  grinder.position.set(-0.72, Y, -0.22);
  grinder.add(box(0.2, 0.05, 0.26, "#222120", 0, 0.025, 0.02));
  grinder.add(box(0.17, 0.34, 0.2, "#2f2e2c", 0, 0.22, -0.02, { flatShading: false, roughness: 0.4 }));
  grinder.add(cyl(0.035, 0.03, 0.05, "#c7c3bb", 0, 0.32, 0.09, 16, STEEL));
  const hopper = cyl(0.1, 0.05, 0.22, "#d9a066", 0, 0.5, -0.02, 24, { transparent: true, opacity: 0.35, flatShading: false, roughness: 0.1 }, true);
  hopper.castShadow = false;
  grinder.add(hopper);
  const beans = cyl(0.088, 0.045, 0.18, "#4a2a16", 0, 0.48, -0.02, 20, { roughness: 1 });
  grinder.add(beans);
  grinder.add(box(0.03, 0.03, 0.05, "#c7c3bb", 0, 0.29, 0.12, STEEL));
  const grinderButton = cyl(0.016, 0.016, 0.01, "#a63d24", 0.07, 0.24, 0.085, 12);
  grinderButton.rotation.x = Math.PI / 2;
  grinder.add(grinderButton);
  scene.add(grinder);

  // espresso machine
  const machine = new THREE.Group();
  machine.position.set(0.18, Y, -0.36);
  machine.add(box(0.76, 0.46, 0.44, "#d5d1c9", 0, 0.29, 0, { metalness: 0.6, roughness: 0.3, flatShading: false }));
  machine.add(box(0.78, 0.04, 0.46, "#3b3a38", 0, 0.54, 0));
  machine.add(box(0.8, 0.06, 0.48, "#3b3a38", 0, 0.03, 0.02));
  const panel = mesh(new THREE.PlaneGeometry(0.62, 0.22), mat("#a63d24", { flatShading: false, roughness: 0.5 }), 0, 0.36, 0.222);
  machine.add(panel);
  const gaugeTex = canvasTex(128, 128, (ctx) => {
    ctx.fillStyle = "#fbf6ec";
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#222120";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#2d4a3e";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(64, 64, 46, Math.PI * 1.15, Math.PI * 1.55);
    ctx.stroke();
    ctx.fillStyle = "#222120";
    ctx.font = "bold 16px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BAR", 64, 98);
  });
  const gauge = mesh(new THREE.CircleGeometry(0.045, 24), new THREE.MeshBasicMaterial({ map: gaugeTex }), 0.24, 0.4, 0.224);
  machine.add(gauge);
  const needle = box(0.004, 0.035, 0.002, "#a63d24", 0, 0.015, 0.002);
  const needlePivot = new THREE.Group();
  needlePivot.position.set(0.24, 0.4, 0.226);
  needlePivot.add(needle);
  machine.add(needlePivot);
  // group head and drip tray
  machine.add(cyl(0.06, 0.06, 0.07, "#c7c3bb", -0.13, 0.24, 0.26, 24, STEEL));
  const tray = box(0.66, 0.03, 0.2, "#8e8a83", 0, 0.03, 0.32, STEEL);
  machine.add(tray);
  for (let i = 0; i < 9; i++) {
    machine.add(box(0.005, 0.005, 0.18, "#222120", -0.3 + i * 0.075, 0.048, 0.32));
  }
  // cups warming on top
  for (let i = 0; i < 4; i++) {
    machine.add(cyl(0.04, 0.032, 0.06, "#fbf6ec", -0.28 + i * 0.09, 0.6, -0.05, 16));
  }
  // steam wand
  const wand = new THREE.Group();
  wand.position.set(0.33, 0.36, 0.25);
  const wandTube = cyl(0.008, 0.008, 0.26, "#c7c3bb", 0, -0.12, 0.03, 10, STEEL);
  wandTube.rotation.x = -0.25;
  wand.add(wandTube);
  wand.add(cyl(0.018, 0.018, 0.04, "#222120", 0, 0.02, 0, 12));
  machine.add(wand);
  scene.add(machine);
  const groupHeadWorld = new THREE.Vector3(0.05, Y + 0.2, -0.1);
  const wandTip = new THREE.Vector3(0.51, Y + 0.12, -0.06);

  // knock box and tamping mat
  scene.add(cyl(0.07, 0.07, 0.12, "#222120", -0.45, Y + 0.06, -0.32, 16));
  scene.add(box(0.2, 0.012, 0.16, "#3b3a38", -0.36, Y + 0.006, 0.05));

  // portafilter: basket, grounds, handle
  const portafilter = new THREE.Group();
  const basket = cyl(0.05, 0.045, 0.035, "#c7c3bb", 0, 0, 0, 24, STEEL);
  const handle = cyl(0.014, 0.017, 0.16, "#222120", 0, 0, 0.11, 12);
  handle.rotation.x = Math.PI / 2;
  const grounds = mesh(new THREE.SphereGeometry(0.044, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat("#5a3620", { roughness: 1 }), 0, 0.017, 0);
  grounds.scale.y = 0.01;
  portafilter.add(basket, handle, grounds);
  scene.add(portafilter);

  // tamper
  const tamper = new THREE.Group();
  tamper.add(cyl(0.044, 0.044, 0.016, "#c7c3bb", 0, 0, 0, 24, STEEL));
  tamper.add(cyl(0.014, 0.02, 0.05, "#c7c3bb", 0, 0.033, 0, 12, STEEL));
  tamper.add(mesh(new THREE.SphereGeometry(0.028, 14, 10), mat("#8a5a3b", { flatShading: false }), 0, 0.075, 0));
  scene.add(tamper);

  // cup with saucer, liquid surface with the latte art drawn on it
  const surfaceCanvas = document.createElement("canvas");
  surfaceCanvas.width = surfaceCanvas.height = 256;
  const surfaceCtx = surfaceCanvas.getContext("2d");
  const surfaceTex = new THREE.CanvasTexture(surfaceCanvas);
  surfaceTex.colorSpace = THREE.SRGBColorSpace;

  const cup = new THREE.Group();
  cup.add(cyl(0.075, 0.07, 0.01, "#fbf6ec", 0, 0.005, 0, 28, { flatShading: false }));
  const cupBody = cyl(0.055, 0.038, 0.075, "#fbf6ec", 0, 0.048, 0, 28, { flatShading: false, side: THREE.DoubleSide }, true);
  cup.add(cupBody);
  cup.add(cyl(0.038, 0.038, 0.004, "#fbf6ec", 0, 0.012, 0, 20));
  const cupHandle = mesh(new THREE.TorusGeometry(0.02, 0.006, 8, 16, Math.PI), mat("#fbf6ec", { flatShading: false }), 0.058, 0.05, 0);
  cupHandle.rotation.z = -Math.PI / 2;
  cup.add(cupHandle);
  const cupLiquid = mesh(new THREE.CircleGeometry(0.052, 32), new THREE.MeshStandardMaterial({ map: surfaceTex, roughness: 0.35 }), 0, 0.015, 0);
  cupLiquid.rotation.x = -Math.PI / 2;
  cupLiquid.visible = false;
  cup.add(cupLiquid);
  scene.add(cup);

  // glass for kopi tubruk, kopi susu and iced drinks
  const glass = new THREE.Group();
  const glassWall = cyl(0.05, 0.042, 0.14, "#e8f1f0", 0, 0.07, 0, 28, { transparent: true, opacity: 0.28, flatShading: false, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }, true);
  glassWall.castShadow = false;
  glass.add(glassWall);
  glass.add(cyl(0.042, 0.042, 0.006, "#e8f1f0", 0, 0.003, 0, 20, { transparent: true, opacity: 0.4 }));
  const layer = (color, opacity = 1) => {
    const m = cyl(0.046, 0.04, 1, color, 0, 0, 0, 24, { flatShading: false, transparent: opacity < 1, opacity, roughness: 0.3 });
    m.castShadow = false;
    m.visible = false;
    glass.add(m);
    return m;
  };
  const glassLayers = {
    condensed: layer("#f7f1e2"),
    syrup: layer("#5b2d0e"),
    milk: layer("#f4ede0"),
    coffee: layer("#3a2212", 0.92),
    grounds: layer("#2a180c"),
  };
  const iceCubes = [];
  for (let i = 0; i < 5; i++) {
    const cube = box(0.028, 0.028, 0.028, "#eaf6f8", 0, 0, 0, { transparent: true, opacity: 0.55, flatShading: false, roughness: 0.05 });
    cube.castShadow = false;
    cube.visible = false;
    glass.add(cube);
    iceCubes.push(cube);
  }
  const spoon = new THREE.Group();
  spoon.add(cyl(0.003, 0.003, 0.2, "#c7c3bb", 0, 0.1, 0, 8, STEEL));
  spoon.add(mesh(new THREE.SphereGeometry(0.012, 10, 6), mat("#c7c3bb", STEEL), 0, 0.005, 0));
  spoon.visible = false;
  glass.add(spoon);
  scene.add(glass);

  // dripper for hand drip
  const dripper = new THREE.Group();
  dripper.add(cyl(0.065, 0.028, 0.075, "#fbf6ec", 0, 0.04, 0, 24, { flatShading: false, side: THREE.DoubleSide }, true));
  dripper.add(cyl(0.07, 0.07, 0.006, "#fbf6ec", 0, 0.003, 0, 24));
  const bed = cyl(0.05, 0.03, 0.03, "#4a2a16", 0, 0.03, 0, 20, { roughness: 1 });
  bed.visible = false;
  dripper.add(bed);
  dripper.visible = false;
  scene.add(dripper);

  // milk pitcher
  const pitcher = new THREE.Group();
  const PITCHER = "#a9a7a2";
  pitcher.add(cyl(0.05, 0.052, 0.06, PITCHER, 0, 0.03, 0, 24, { ...STEEL, side: THREE.DoubleSide }, true));
  pitcher.add(cyl(0.04, 0.05, 0.05, PITCHER, 0, 0.085, 0, 24, { ...STEEL, side: THREE.DoubleSide }, true));
  pitcher.add(cyl(0.052, 0.052, 0.004, PITCHER, 0, 0.002, 0, 20, STEEL));
  const spout = mesh(new THREE.ConeGeometry(0.016, 0.04, 12, 1, true), mat(PITCHER, { ...STEEL, side: THREE.DoubleSide }), -0.045, 0.104, 0);
  spout.rotation.z = Math.PI / 2 + 0.5;
  pitcher.add(spout);
  const pitcherHandle = mesh(new THREE.TorusGeometry(0.03, 0.006, 8, 18, Math.PI), mat("#7d7a75", STEEL), 0.05, 0.06, 0);
  pitcherHandle.rotation.z = -Math.PI / 2;
  pitcher.add(pitcherHandle);
  const milkTop = mesh(new THREE.CircleGeometry(0.038, 24), mat("#fbf6ec", { flatShading: false }), 0, 0.06, 0);
  milkTop.rotation.x = -Math.PI / 2;
  pitcher.add(milkTop);
  scene.add(pitcher);

  // gooseneck kettle
  const kettle = new THREE.Group();
  kettle.add(cyl(0.06, 0.075, 0.13, "#3b3a38", 0, 0.065, 0, 24, { metalness: 0.5, roughness: 0.4, flatShading: false }));
  kettle.add(cyl(0.02, 0.02, 0.02, "#3b3a38", 0, 0.14, 0, 12));
  const neck = cyl(0.007, 0.01, 0.22, "#3b3a38", -0.09, 0.12, 0, 10, { metalness: 0.5, roughness: 0.4 });
  neck.rotation.z = 0.75;
  kettle.add(neck);
  kettle.add(box(0.015, 0.1, 0.03, "#8a5a3b", 0.075, 0.09, 0));
  scene.add(kettle);

  // streams and steam
  const streamMat = new THREE.MeshStandardMaterial({ color: "#6b3b1c", roughness: 0.3, transparent: true, opacity: 0.9 });
  const streams = [-0.012, 0.012].map((dx) => {
    const s = mesh(new THREE.CylinderGeometry(0.0025, 0.0018, 1, 8), streamMat, groupHeadWorld.x + dx, 0, groupHeadWorld.z);
    s.castShadow = false;
    s.visible = false;
    scene.add(s);
    return s;
  });
  const pourStream = mesh(new THREE.CylinderGeometry(0.004, 0.003, 1, 8), new THREE.MeshStandardMaterial({ color: "#f4ede0", roughness: 0.4, transparent: true, opacity: 0.95 }), 0, 0, 0);
  pourStream.castShadow = false;
  pourStream.visible = false;
  scene.add(pourStream);
  const groundsFall = mesh(new THREE.CylinderGeometry(0.008, 0.012, 1, 8), mat("#5a3620", { roughness: 1, transparent: true, opacity: 0.85 }), 0, 0, 0);
  groundsFall.visible = false;
  scene.add(groundsFall);
  const puffs = [];
  for (let i = 0; i < 18; i++) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, opacity: 0, depthWrite: false }));
    sprite.scale.set(0.06, 0.06, 1);
    scene.add(sprite);
    puffs.push({ sprite, life: 0, vx: 0, vy: 0, vz: 0 });
  }
  let puffSource = null;   // a THREE.Vector3 while steam should come out
  let puffRate = 0;
  let puffDebt = 0;

  // the barista (seen in third person) and the people waiting across the counter
  const me = person(handlers.name || "You", { apron: true });
  me.position.set(0.0, 0, 0.72);
  me.rotation.y = Math.PI;
  scene.add(me);
  const myTag = tag(handlers.name || "You");
  myTag.position.set(0, 1.95, 0.72);
  myTag.scale.multiplyScalar(0.7);
  scene.add(myTag);
  const skin = pick(SKINS, seedOf(handlers.name || "You"));
  const hands = { left: firstPersonHand(-1, skin), right: firstPersonHand(1, skin) };
  scene.add(hands.left, hands.right);

  const customers = new Map(); // order id -> { group, tag }
  let customerSig = "";
  const pickupCups = [];

  // ---------- state ----------

  const cam = { mode: handlers.cam || "mix", blend: 0, wantBlend: 0, pos: new THREE.Vector3(0.3, 2.1, 2.2), look: new THREE.Vector3(0, 1, -0.3) };
  const s = {
    order: null,
    recipe: null,
    steps: [],
    index: 0,
    value: 0,
    holding: false,
    scores: [],
    tapT: 0,          // animation timer for tap steps
    done: false,
    serveT: 0,
    // visuals
    dose: 0,
    tamped: 0,
    locked: false,
    shot: 0,          // 0..1 of the shot pulled
    milkHeat: 0,
    milkPoured: 0,
    art: 0,
    water: 0,
    stirred: 0,
    iceIn: false,
    condensedIn: false,
    scooped: false,
    bloomed: 0,
  };
  let loop = null;   // the running sound for a hold step

  function resetStation() {
    Object.assign(s, { index: 0, value: 0, holding: false, scores: [], tapT: 0, done: false, serveT: 0, dose: 0, tamped: 0, locked: false, shot: 0,
      milkHeat: 0, milkPoured: 0, art: 0, water: 0, stirred: 0, iceIn: false, condensedIn: false, scooped: false, bloomed: 0 });
    beans.scale.y = 1;
  }

  function current() {
    return s.steps[s.index] || null;
  }

  function vessel() {
    return s.recipe ? RECIPES[s.recipe].vessel : "cup";
  }

  // ---------- where everything sits for the current step ----------

  const P = {
    pfRest: new THREE.Vector3(-0.32, Y + 0.02, 0.18),
    pfGrinder: new THREE.Vector3(-0.72, Y + 0.12, -0.08),
    pfTamp: new THREE.Vector3(-0.36, Y + 0.03, 0.05),
    pfGroup: new THREE.Vector3(groupHeadWorld.x, Y + 0.17, groupHeadWorld.z),
    pfKnock: new THREE.Vector3(-0.45, Y + 0.16, -0.32),
    tamperRest: new THREE.Vector3(-0.14, Y + 0.008, 0.18),
    tamperUp: new THREE.Vector3(-0.36, Y + 0.12, 0.05),
    tamperDown: new THREE.Vector3(-0.36, Y + 0.064, 0.05),
    cupRest: new THREE.Vector3(0.62, Y, 0.2),
    cupTray: new THREE.Vector3(groupHeadWorld.x, Y + 0.05, groupHeadWorld.z),
    cupFront: new THREE.Vector3(0.05, Y, 0.2),
    pickup: new THREE.Vector3(0.95, Y + 0.29, -0.78),
    pitcherRest: new THREE.Vector3(0.62, Y, 0.0),
    pitcherWand: new THREE.Vector3(wandTip.x, Y + 0.02, wandTip.z + 0.02),
    pitcherPour: new THREE.Vector3(0.12, Y + 0.08, 0.2),
    kettleRest: new THREE.Vector3(0.78, Y, -0.1),
    kettlePour: new THREE.Vector3(0.18, Y + 0.18, 0.2),
  };
  // initial placement
  portafilter.position.copy(P.pfRest);
  tamper.position.copy(P.tamperRest);
  cup.position.copy(P.cupRest);
  glass.position.copy(P.cupRest);
  pitcher.position.copy(P.pitcherRest);
  kettle.position.copy(P.kettleRest);

  function targets() {
    const step = current();
    const id = step ? step.id : "idle";
    const v = vessel();
    const p = step && step.kind === "hold" ? clamp01(s.value / step.max) : 0;
    const t = {
      pf: s.locked ? P.pfGroup : P.pfRest,
      pfRot: s.locked ? -0.7 : 0,
      tamper: P.tamperRest,
      vessel: P.cupRest,
      pitcher: P.pitcherRest,
      pitcherTilt: 0,
      kettle: P.kettleRest,
      kettleTilt: 0,
      focus: new THREE.Vector3(0, Y + 0.1, -0.05),
      right: null,
      left: null,
    };
    const vesselHome = v === "glass" || s.recipe === "drip" ? P.cupFront : P.cupTray;
    if (s.dose > 0 || ["pull", "steam", "art", "ice", "scoop", "condensed", "kettle", "bloom", "stir", "serve"].includes(id)) {
      t.vessel = vesselHome;
    }
    if (["steam", "art"].includes(id) || (s.shot >= 1 && v === "cup" && RECIPES[s.recipe]?.steps.includes("art"))) {
      t.vessel = P.cupFront;
    }
    switch (id) {
      case "grind":
        t.pf = P.pfGrinder;
        t.focus = new THREE.Vector3(-0.72, Y + 0.18, -0.12);
        t.right = P.pfGrinder.clone().add(new THREE.Vector3(0, -0.01, 0.15));
        t.left = new THREE.Vector3(-0.65, Y + 0.24, -0.13);
        if (s.recipe && RECIPES[s.recipe].vessel === "glass" && !RECIPES[s.recipe].steps.includes("pull")) {
          t.pf = P.pfGrinder;
        }
        break;
      case "tamp":
        t.pf = P.pfTamp;
        t.tamper = s.holding || s.value > 0 ? P.tamperUp.clone().lerp(P.tamperDown, Math.min(1, s.value / 14)) : P.tamperUp;
        t.focus = P.pfTamp.clone().add(new THREE.Vector3(0, 0.05, 0));
        t.right = t.tamper.clone().add(new THREE.Vector3(0, 0.1, 0.01));
        t.left = P.pfTamp.clone().add(new THREE.Vector3(0, 0.0, 0.13));
        break;
      case "lock":
        t.pf = s.tapT > 0 ? P.pfGroup : P.pfTamp.clone().lerp(P.pfGroup, 0.4);
        t.pfRot = s.tapT > 0 ? -0.7 * clamp01(s.tapT * 2) : 0;
        t.focus = groupHeadWorld.clone().add(new THREE.Vector3(0, -0.06, 0.05));
        t.right = t.pf.clone().add(new THREE.Vector3(0.08, 0, 0.14));
        break;
      case "pull":
        t.focus = P.cupTray.clone().add(new THREE.Vector3(0, 0.08, 0));
        t.right = new THREE.Vector3(0.28, Y + 0.33, -0.12);
        t.left = new THREE.Vector3(-0.2, Y + 0.02, 0.22);
        break;
      case "steam":
        t.pitcher = P.pitcherWand.clone().add(new THREE.Vector3(0, -0.03 * p, 0));
        t.focus = wandTip.clone();
        t.right = t.pitcher.clone().add(new THREE.Vector3(0.07, 0.06, 0.03));
        t.left = new THREE.Vector3(0.4, Y + 0.3, -0.12);
        break;
      case "art":
        t.pitcher = P.pitcherPour.clone().add(new THREE.Vector3(0, 0.02 - p * 0.04, 0));
        t.pitcherTilt = s.holding ? 0.9 + p * 0.5 : 0.5;
        t.focus = P.cupFront.clone().add(new THREE.Vector3(0, 0.06, 0));
        t.right = t.pitcher.clone().add(new THREE.Vector3(0.07, 0.06, 0.02));
        t.left = P.cupFront.clone().add(new THREE.Vector3(-0.09, 0.04, 0.02));
        break;
      case "ice":
      case "scoop":
      case "condensed":
        t.focus = P.cupFront.clone().add(new THREE.Vector3(0, 0.08, 0));
        t.right = P.cupFront.clone().add(new THREE.Vector3(0.06, 0.2, 0.06));
        t.left = P.cupFront.clone().add(new THREE.Vector3(-0.08, 0.06, 0.04));
        break;
      case "kettle":
      case "bloom":
        t.kettle = P.kettlePour;
        t.kettleTilt = s.holding ? 0.55 : 0.25;
        t.focus = P.cupFront.clone().add(new THREE.Vector3(0, 0.1, 0));
        t.right = P.kettlePour.clone().add(new THREE.Vector3(0.09, 0.08, 0.02));
        t.left = P.cupFront.clone().add(new THREE.Vector3(-0.09, 0.05, 0.03));
        break;
      case "stir":
        t.focus = P.cupFront.clone().add(new THREE.Vector3(0, 0.1, 0));
        t.right = P.cupFront.clone().add(new THREE.Vector3(0.0, 0.24, 0.02));
        t.left = P.cupFront.clone().add(new THREE.Vector3(-0.08, 0.05, 0.03));
        break;
      case "serve":
        t.vessel = s.tapT > 0 ? P.pickup : vesselHome;
        t.focus = s.tapT > 0 ? P.pickup.clone() : t.vessel.clone().add(new THREE.Vector3(0, 0.06, 0));
        t.right = t.vessel.clone().add(new THREE.Vector3(0.08, 0.06, 0.06));
        break;
      default:
        break;
    }
    if (s.done) {
      t.vessel = P.pickup;
    }
    return t;
  }

  // ---------- frame update ----------

  const tmp = new THREE.Vector3();
  function approach(obj, target, k) {
    obj.position.lerp(target, k);
  }

  function updateLiquids() {
    const v = vessel();
    const recipe = s.recipe ? RECIPES[s.recipe] : null;
    cup.visible = v === "cup";
    glass.visible = v === "glass";
    dripper.visible = Boolean(recipe?.dripper) && !s.done && s.index < s.steps.length - 1;
    if (dripper.visible) {
      dripper.position.copy(cup.position).add(new THREE.Vector3(0, 0.09, 0));
      bed.visible = s.scooped || s.dose > 0;
      bed.scale.y = 1 + s.bloomed * 0.6;
      bed.material = mat(s.bloomed > 0 || s.water > 0 ? "#2f1a0c" : "#5a3620", { roughness: 1 });
    }
    // cup surface
    if (v === "cup") {
      const espressoFill = s.shot;
      const fill = Math.min(1, espressoFill * 0.35 + s.milkPoured * 0.65 + (recipe?.dripper ? s.water / 200 : 0));
      cupLiquid.visible = fill > 0.02;
      cupLiquid.position.y = 0.015 + fill * 0.065;
      const scale = 0.7 + fill * 0.3;
      cupLiquid.scale.set(scale, scale, 1);
      drawSurface(surfaceCtx, 256, {
        crema: !recipe?.dripper && s.shot > 0.3,
        milk: s.milkPoured,
        art: recipe?.art ? s.art : 0,
        kind: recipe?.art || "heart",
        quality: s.scores.length ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : 1,
      });
      surfaceTex.needsUpdate = true;
    }
    // glass layers stack from the bottom
    if (v === "glass") {
      let base = 0.006;
      const put = (m, h) => {
        m.visible = h > 0.002;
        if (m.visible) {
          m.scale.y = h;
          m.position.y = base + h / 2;
          base += h;
        }
      };
      put(glassLayers.condensed, s.condensedIn ? 0.022 : 0);
      put(glassLayers.syrup, s.iceIn && recipe?.use.syrup ? 0.014 : 0);
      put(glassLayers.milk, s.iceIn && recipe?.use.milk ? 0.05 : 0);
      const coffeeH = recipe?.steps.includes("pull") ? s.shot * 0.035 : (s.water / 200) * 0.105;
      put(glassLayers.coffee, coffeeH);
      glassLayers.coffee.material.color.set(s.stirred > 2 && s.condensedIn ? "#7a4a26" : "#3a2212");
      glassLayers.grounds.visible = s.scooped && s.water > 0;
      if (glassLayers.grounds.visible) {
        const settled = s.stirred > 4;
        glassLayers.grounds.scale.y = 0.012;
        glassLayers.grounds.position.y = settled ? 0.012 : Math.max(0.02, base - 0.008);
      }
      iceCubes.forEach((cube, i) => {
        cube.visible = s.iceIn;
        cube.position.set(Math.cos(i * 2.1) * 0.018, 0.035 + i * 0.022, Math.sin(i * 2.1) * 0.018);
        cube.rotation.set(i, i * 0.7, i * 1.3);
      });
    }
  }

  function aimArm(arm, target) {
    // point the whole arm at a world target from the shoulder
    if (!target) {
      arm.shoulder.rotation.set(0.05, 0, 0.05 * arm.side);
      arm.elbow.rotation.set(-0.2, 0, 0);
      return;
    }
    const shoulderWorld = arm.shoulder.getWorldPosition(tmp.clone());
    const local = target.clone().sub(shoulderWorld);
    local.applyAxisAngle(new THREE.Vector3(0, 1, 0), -me.rotation.y);
    const reach = local.length();
    const pitch = Math.atan2(-local.z, -local.y);
    const yaw = Math.atan2(local.x, Math.hypot(local.y, local.z));
    arm.shoulder.rotation.set(pitch * 0.85, 0, -yaw * 0.8);
    arm.elbow.rotation.set(-Math.max(0, 0.6 - reach) * 1.6, 0, 0);
  }

  function placeHand(hand, target, side, t) {
    if (!target) {
      target = new THREE.Vector3(0.28 * side, Y + 0.03, 0.34);
    }
    hand.position.lerp(target, 0.25);
    // forearm points back toward the barista's body, below the eyes
    const body = new THREE.Vector3(0.3 * side, Y - 0.2, 1.05);
    hand.lookAt(body.x, body.y, body.z);
    hand.rotateY(Math.PI);
    hand.rotateX(Math.PI);
    hand.rotateZ(Math.sin(t * 2 + side) * 0.03);
  }

  function updatePuffs(dt) {
    if (puffSource) {
      puffDebt += puffRate * dt;
      while (puffDebt >= 1) {
        puffDebt -= 1;
        const p = puffs.find((x) => x.life <= 0);
        if (!p) {
          break;
        }
        p.life = 1;
        p.sprite.position.copy(puffSource).add(new THREE.Vector3((Math.random() - 0.5) * 0.02, 0, (Math.random() - 0.5) * 0.02));
        p.vx = (Math.random() - 0.5) * 0.05;
        p.vy = 0.12 + Math.random() * 0.1;
        p.vz = (Math.random() - 0.5) * 0.05;
      }
    }
    for (const p of puffs) {
      if (p.life > 0) {
        p.life -= dt * 0.9;
        p.sprite.position.x += p.vx * dt;
        p.sprite.position.y += p.vy * dt;
        p.sprite.position.z += p.vz * dt;
        const size = 0.04 + (1 - p.life) * 0.12;
        p.sprite.scale.set(size, size, 1);
        p.sprite.material.opacity = Math.max(0, p.life) * 0.5;
      } else {
        p.sprite.material.opacity = 0;
      }
    }
  }

  function updateCustomers(t) {
    let i = 0;
    for (const [, c] of customers) {
      const x = -0.45 + i * 0.55;
      c.group.position.x = lerp(c.group.position.x, x, 0.05);
      c.group.position.z = -1.35;
      c.group.position.y = Math.sin(t * 1.4 + i) * 0.004;
      c.tag.position.set(c.group.position.x, i % 2 ? 2.16 : 1.94, -1.35);
      // on a narrow phone screen the name tags would sit on top of the step chips
      c.tag.visible = camera.aspect > 0.9;
      i += 1;
    }
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;
  let lastStep = -1;

  function frame() {
    if (disposed) {
      return;
    }
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;
    const step = current();

    // hold progress
    if (step && step.kind === "hold" && s.holding && !s.done) {
      s.value = Math.min(step.max, s.value + step.rate * dt);
      applyHold(step, dt);
      if (s.value >= step.max) {
        release();
      }
    }
    if (step && step.kind === "tap" && s.tapT > 0) {
      s.tapT += dt;
      if (s.tapT > 0.75) {
        finishTap(step);
      }
    }

    const tg = targets();
    const k = 1 - Math.pow(0.0025, dt);
    approach(portafilter, tg.pf, k);
    portafilter.rotation.y = lerp(portafilter.rotation.y, tg.pfRot, k);
    approach(tamper, tg.tamper, k * 1.3);
    const vesselObj = vessel() === "glass" ? glass : cup;
    approach(vesselObj, tg.vessel, k * 0.9);
    approach(pitcher, tg.pitcher, k);
    pitcher.rotation.z = lerp(pitcher.rotation.z, tg.pitcherTilt, k);
    approach(kettle, tg.kettle, k);
    kettle.rotation.z = lerp(kettle.rotation.z, -tg.kettleTilt, k);

    // grounds in the basket and beans in the hopper
    grounds.scale.y = s.dose > 0 ? Math.max(0.05, (s.dose / 18) * (1 - s.tamped * 0.6) * 0.75) : 0.01;
    grounds.scale.x = grounds.scale.z = s.tamped > 0 ? 1 : 0.85 + s.dose / 80;
    grounds.material = mat(s.shot > 0.2 ? "#2f1a0c" : "#5a3620", { roughness: 1 });
    beans.scale.y = Math.max(0.25, 1 - s.dose / 70);
    needlePivot.rotation.z = step?.id === "pull" && s.holding ? -1.2 - Math.sin(t * 9) * 0.03 : lerp(needlePivot.rotation.z, 0.6, 0.05);

    // streams
    const pulling = step?.id === "pull" && s.holding && s.value > 4;
    streams.forEach((stream) => {
      stream.visible = pulling;
      if (pulling) {
        const topY = groupHeadWorld.y - 0.07;
        const bottomY = cup.position.y + 0.02 + s.shot * 0.03;
        const fromGlass = vessel() === "glass" ? glass.position.y + 0.12 : bottomY;
        const low = vessel() === "glass" ? fromGlass : bottomY;
        stream.scale.set(0.8 + Math.sin(t * 30 + stream.position.x * 100) * 0.2, topY - low, 1);
        stream.position.y = (topY + low) / 2;
        stream.position.z = groupHeadWorld.z;
      }
    });
    const pouringMilk = step?.id === "art" && s.holding;
    const pouringWater = (step?.id === "kettle" || step?.id === "bloom") && s.holding;
    pourStream.visible = pouringMilk || pouringWater;
    if (pourStream.visible) {
      const from = pouringMilk ? pitcher.position.clone().add(new THREE.Vector3(-0.05, 0.07, 0)) : kettle.position.clone().add(new THREE.Vector3(-0.17, 0.2, 0));
      const to = (vessel() === "glass" ? glass.position : cup.position).clone().add(new THREE.Vector3(0, s.recipe === "drip" ? 0.14 : 0.06, 0));
      pourStream.position.copy(from).add(to).multiplyScalar(0.5);
      pourStream.scale.set(1, Math.max(0.01, from.distanceTo(to)), 1);
      pourStream.lookAt(to);
      pourStream.rotateX(Math.PI / 2);
      pourStream.material.color.set(pouringMilk ? "#f4ede0" : "#cfe3ea");
      pourStream.material.opacity = pouringMilk ? 0.95 : 0.55;
    }
    const grinding = step?.id === "grind" && s.holding;
    groundsFall.visible = grinding;
    if (grinding) {
      const topY = grinder.position.y + 0.27;
      const lowY = portafilter.position.y + 0.02;
      groundsFall.position.set(grinder.position.x, (topY + lowY) / 2, grinder.position.z + 0.14);
      groundsFall.scale.set(1, topY - lowY, 1);
    }
    // steam: from the wand while steaming, from the cup once there is a hot drink
    if (step?.id === "steam" && s.holding) {
      puffSource = wandTip.clone().add(new THREE.Vector3(0, 0.03, 0.02));
      puffRate = 26;
    } else if (s.shot > 0.5 || s.water > 60) {
      puffSource = (vessel() === "glass" ? glass.position : cup.position).clone().add(new THREE.Vector3(0, 0.11, 0));
      puffRate = s.iceIn ? 0 : 3;
    } else {
      puffSource = null;
    }
    updatePuffs(dt);
    spoon.visible = step?.id === "stir" || (s.stirred > 0 && !s.done);
    if (spoon.visible) {
      const a = t * (s.holding && step?.id === "stir" ? 9 : 0);
      spoon.position.set(Math.cos(a) * 0.015, 0.03, Math.sin(a) * 0.015);
      spoon.rotation.z = 0.2;
    }
    milkTop.position.y = 0.06 + s.milkHeat * 0.025 * (RECIPES[s.recipe]?.foam ? 1.5 : 1);
    milkTop.visible = !(s.milkPoured > 0.95);
    updateLiquids();
    updateCustomers(t);

    // my body (third person) and my hands (first person)
    aimArm(me.userData.arms[1], tg.right);
    aimArm(me.userData.arms[0], tg.left);
    me.position.x = lerp(me.position.x, Math.max(-0.5, Math.min(0.55, tg.focus.x * 0.8)), 0.04);
    myTag.position.x = me.position.x;
    placeHand(hands.right, tg.right, 1, t);
    placeHand(hands.left, tg.left, -1, t);

    // camera
    const close = cam.mode === "fp" || (cam.mode === "mix" && step && step.kind === "hold" && !s.done);
    cam.wantBlend = close ? 1 : 0;
    cam.blend = lerp(cam.blend, cam.wantBlend, 1 - Math.pow(0.02, dt));
    const fpPos = new THREE.Vector3(tg.focus.x * 0.6 + 0.02, Y + 0.74, 0.74);
    const fpLook = tg.focus.clone();
    const tpPos = new THREE.Vector3(me.position.x + 0.55, 2.15, 2.25);
    const tpLook = new THREE.Vector3(me.position.x * 0.5, Y + 0.25, -0.45);
    const b = ease(cam.blend);
    cam.pos.lerp(tpPos.clone().lerp(fpPos, b), 0.12);
    cam.look.lerp(tpLook.clone().lerp(fpLook, b), 0.12);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
    camera.fov = lerp(46, 52, b);
    camera.updateProjectionMatrix();
    const fpVisible = b > 0.55;
    me.visible = !fpVisible;
    myTag.visible = !fpVisible;
    hands.left.visible = hands.right.visible = fpVisible;

    if (s.index !== lastStep) {
      lastStep = s.index;
      handlers.onChange?.(snapshot());
    }
    renderer.render(scene, camera);
  }

  // ---------- step actions ----------

  function applyHold(step, dt) {
    switch (step.id) {
      case "grind":
        s.dose = s.value;
        break;
      case "tamp":
        s.tamped = clamp01(s.value / 15);
        break;
      case "pull":
        s.shot = clamp01((s.value - 4) / 24);
        break;
      case "steam":
        s.milkHeat = clamp01((s.value - 20) / 45);
        loop?.setHeat?.(clamp01((s.value - 30) / 40));
        break;
      case "art":
        s.milkPoured = clamp01(s.value / 95);
        s.art = s.value / 95;
        break;
      case "kettle":
        s.water = s.value;
        break;
      case "bloom":
        s.bloomed = clamp01(s.value / 40);
        s.water = s.value * 0.3;
        break;
      case "stir":
        s.stirred = s.value;
        break;
      default:
        break;
    }
    handlers.onProgress?.(snapshot());
  }

  function startLoop(step) {
    stopLoop();
    switch (step.id) {
      case "grind":
        loop = sound.grind();
        break;
      case "pull":
        loop = sound.pull();
        break;
      case "steam":
        loop = sound.steam();
        break;
      case "art":
        loop = sound.pour(0.8);
        break;
      case "kettle":
      case "bloom":
        loop = sound.pour(1);
        break;
      case "stir":
        loop = sound.stir();
        break;
      case "tamp":
        loop = null;
        break;
      default:
        loop = null;
    }
  }

  function stopLoop() {
    if (loop) {
      loop();
      loop = null;
    }
  }

  function press() {
    sound.unlock();
    const step = current();
    if (!step || s.done) {
      return;
    }
    if (step.kind === "tap") {
      tap();
      return;
    }
    if (s.holding) {
      return;
    }
    if (step.id === "art" && step.from == null) {
      // nothing special
    }
    if (step.id === "steam" && s.value === 0) {
      s.value = 20;
    }
    s.holding = true;
    startLoop(step);
    if (step.id === "grind") {
      sound.scatter(18, 0.6, 2400);
    }
    handlers.onProgress?.(snapshot());
  }

  function release() {
    const step = current();
    if (!step || !s.holding) {
      return;
    }
    s.holding = false;
    stopLoop();
    if (step.id === "tamp") {
      sound.thud(1);
    }
    if (step.id === "grind") {
      sound.scatter(10, 0.3, 1800);
    }
    const score = scoreStep(step, s.value);
    s.scores.push(score);
    handlers.onStepDone?.({ step, value: s.value, score });
    next();
  }

  function tap() {
    const step = current();
    if (!step || step.kind !== "tap" || s.tapT > 0 || s.done) {
      return;
    }
    sound.unlock();
    s.tapT = 0.001;
    switch (step.id) {
      case "lock":
        setTimeout(() => sound.clink(0.8), 250);
        setTimeout(() => sound.thud(1.3), 420);
        break;
      case "ice":
        sound.ice();
        break;
      case "scoop":
        sound.scatter(20, 0.5, 1500);
        break;
      case "condensed":
        sound.pour(0.6);
        setTimeout(() => {}, 0);
        break;
      case "serve":
        setTimeout(() => sound.cupDown(), 450);
        break;
      default:
        break;
    }
    handlers.onProgress?.(snapshot());
  }

  function finishTap(step) {
    s.tapT = 0;
    if (step.id === "lock") {
      s.locked = true;
    }
    if (step.id === "ice") {
      s.iceIn = true;
    }
    if (step.id === "scoop") {
      s.scooped = true;
      s.dose = Math.max(s.dose, 14);
    }
    if (step.id === "condensed") {
      s.condensedIn = true;
    }
    s.scores.push(1);
    handlers.onStepDone?.({ step, value: 1, score: 1 });
    if (step.id === "serve") {
      s.done = true;
      s.locked = false;
      const quality = s.scores.reduce((a, b) => a + b, 0) / s.scores.length;
      handlers.onServed?.({ order: s.order, quality, scores: [...s.scores] });
      return;
    }
    next();
  }

  function next() {
    s.index += 1;
    s.value = 0;
    const step = current();
    // the grounds land in the glass straight from the grinder for brewed coffee
    if (step?.id === "scoop") {
      s.dose = 0;
    }
    handlers.onProgress?.(snapshot());
  }

  // hold with the space bar or by pressing on the 3D view
  const onKeyDown = (event) => {
    if (event.code === "Space" && !event.repeat && container.isConnected && !container.closest("[hidden]") && document.activeElement?.tagName !== "INPUT") {
      event.preventDefault();
      press();
    }
  };
  const onKeyUp = (event) => {
    if (event.code === "Space") {
      event.preventDefault();
      release();
    }
  };
  addEventListener("keydown", onKeyDown);
  addEventListener("keyup", onKeyUp);
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    press();
  });
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  frame();

  function snapshot() {
    const step = current();
    return {
      order: s.order,
      steps: s.steps.map((x, i) => ({ id: x.id, label: x.label, done: i < s.index || s.done, score: s.scores[i] ?? null })),
      index: s.index,
      step,
      value: s.value,
      holding: s.holding,
      done: s.done,
      quality: s.scores.length ? s.scores.reduce((a, b) => a + b, 0) / s.scores.length : null,
      cam: cam.mode,
      view: cam.blend > 0.55 ? "fp" : "tp",
    };
  }

  return {
    start(order) {
      stopLoop();
      resetStation();
      s.order = order;
      s.recipe = order ? order.recipe : null;
      s.steps = order ? stepsFor(order.recipe) : [];
      lastStep = -1;
      handlers.onProgress?.(snapshot());
    },
    clear() {
      stopLoop();
      resetStation();
      s.order = null;
      s.recipe = null;
      s.steps = [];
      handlers.onProgress?.(snapshot());
    },
    press,
    release,
    tap,
    setCam(mode) {
      cam.mode = mode;
      handlers.onProgress?.(snapshot());
    },
    setMenu(lines) {
      const tex = canvasTex(760, 420, (ctx, w, h) => {
        ctx.fillStyle = "#222120";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "#c58b2a";
        ctx.lineWidth = 6;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = "#f4efe6";
        ctx.font = `48px ${SERIF}`;
        ctx.textAlign = "center";
        ctx.fillText(lines.title || "Menu", w / 2, 74);
        ctx.font = `500 30px ${FONT}`;
        lines.items.slice(0, 6).forEach((item, i) => {
          const y = 140 + i * 48;
          ctx.textAlign = "left";
          ctx.fillText(item.name, 56, y);
          ctx.textAlign = "right";
          ctx.fillText(item.price, w - 56, y);
        });
      });
      menuBoard.material.map?.dispose?.();
      menuBoard.material = new THREE.MeshBasicMaterial({ map: tex });
    },
    setCustomers(list) {
      const sig = list.map((o) => o.id).join(",");
      if (sig === customerSig) {
        return;
      }
      customerSig = sig;
      const wanted = new Set(list.slice(0, 4).map((o) => o.id));
      for (const [id, c] of customers) {
        if (!wanted.has(id)) {
          scene.remove(c.group, c.tag);
          customers.delete(id);
        }
      }
      list.slice(0, 4).forEach((o) => {
        if (!customers.has(o.id)) {
          const group = person(o.who);
          group.position.set(1.8, 0, -1.35);
          const t = tag(o.who, o.name);
          t.scale.multiplyScalar(0.8);
          scene.add(group, t);
          customers.set(o.id, { group, tag: t });
        }
      });
    },
    setName(name) {
      myTag.material.map.dispose();
      const fresh = tag(name);
      myTag.material = fresh.material;
      myTag.scale.copy(fresh.scale).multiplyScalar(0.7);
    },
    snapshot,
    // Test and preview hook: run the current order up to a step, part-way through it.
    jump(stepIndex, fraction = 0.5) {
      while (s.index < Math.min(stepIndex, s.steps.length - 1)) {
        const step = current();
        if (step.kind === "hold") {
          s.value = (step.target[0] + step.target[1]) / 2;
          applyHold(step, 0);
          s.scores.push(1);
          s.index += 1;
          s.value = 0;
        } else {
          finishTap(step);
        }
      }
      const step = current();
      if (step && step.kind === "hold" && fraction > 0) {
        if (step.id === "steam") {
          s.value = 20;
        }
        s.value = Math.max(s.value, step.max * fraction);
        s.holding = true;
        applyHold(step, 0);
      }
      handlers.onProgress?.(snapshot());
    },
    unhold() {
      s.holding = false;
      stopLoop();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      stopLoop();
      observer.disconnect();
      removeEventListener("keydown", onKeyDown);
      removeEventListener("keyup", onKeyUp);
      renderer.dispose();
      canvas.remove();
    },
  };
}
