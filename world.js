// The 3D place: a warung, kopitiam, angkringan, street stall, izakaya counter or beer garden
// built from simple shapes with three.js. You walk around as an avatar (tap the floor or use
// WASD / arrow keys), tap a table to walk over and sit, and see everyone else in the same
// place walking and sitting live. Chat bubbles only appear for people at your own table,
// because only they receive your messages.

import * as THREE from "./vendor/three.module.min.js";

const SHIRTS = ["#a63d24", "#2d4a3e", "#c58b2a", "#3d6b8c", "#6f7f34", "#b5652e", "#4f5d63", "#8a5a3b", "#2f6f6a", "#c4573a"];
const SKINS = ["#f1d9bf", "#e6c09c", "#cf9c72", "#a8754d", "#7a5234"];
const HAIRS = ["#1f1a17", "#2b211b", "#3b2a1e", "#4a3a2c", "#141414"];
const PANTS = ["#2a2f36", "#3b3a38", "#5a4a3a", "#30403a"];
const PLASTIC = ["#c8432b", "#2f6fa3", "#d9a62e", "#3c8a5a"];
const ACCENT = "#a63d24";
const VOICE = "#3c8a5a";

const SEAT_HEIGHT = { round: 0.46, long: 0.45, square: 0.46, plastic: 0.3, low: 0.06, bar: 0.74 };
const WALK_SPEED = 2.6;
const FONT = '"IBM Plex Sans", system-ui, "Segoe UI", sans-serif';
const SERIF = '"DM Serif Display", Georgia, serif';

function hash(text) {
  let h = 2166136261;
  for (const ch of String(text)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function looksFor(key) {
  const h = hash(key);
  return {
    shirt: SHIRTS[h % SHIRTS.length],
    skin: SKINS[(h >>> 4) % SKINS.length],
    hair: HAIRS[(h >>> 8) % HAIRS.length],
    pants: PANTS[(h >>> 12) % PANTS.length],
  };
}

// ---------- floor plan (deterministic, so every visitor sees the same seats) ----------

function tableKind(layout, seats, index) {
  if (layout === "counter" && index === 0) {
    return "bar";
  }
  if (layout === "bench" || layout === "garden") {
    return seats >= 4 ? "long" : "square";
  }
  if (layout === "mat") {
    return "low";
  }
  if (layout === "street") {
    return "plastic";
  }
  return "round";
}

function seatRing(cx, cz, n, radius, offset) {
  return Array.from({ length: n }, (_, i) => {
    const angle = offset + (i * 2 * Math.PI) / n;
    const x = cx + radius * Math.cos(angle);
    const z = cz + radius * Math.sin(angle);
    return { x, z, ry: Math.atan2(cx - x, cz - z) };
  });
}

export function planVenue(layout, tables) {
  const hasBar = layout === "counter";
  const floorTables = hasBar ? tables.slice(1) : tables;
  const cols = floorTables.length <= 4 ? 2 : 3;
  const rows = Math.ceil(floorTables.length / cols);
  const cellW = layout === "bench" || layout === "garden" ? 3.9 : 3.4;
  const cellD = 3.3;
  const width = cols * cellW + 2.2;
  const depth = rows * cellD + 4.8;
  const backZ = -depth / 2;
  const counterZ = backZ + 0.85;
  const firstRowZ = backZ + 2.8 + cellD / 2;
  const plan = { layout, width, depth, backZ, counterZ, tables: [], spawn: { x: 0, z: depth / 2 - 0.9, ry: Math.PI } };

  if (hasBar) {
    const t = tables[0];
    const length = t.seats * 0.72;
    const seatZ = counterZ + 0.8;
    plan.tables.push({
      n: t.n, seats: t.seats, kind: "bar", x: 0, z: counterZ, length,
      seatH: SEAT_HEIGHT.bar,
      seatsPos: Array.from({ length: t.seats }, (_, i) => ({ x: -length / 2 + (i + 0.5) * 0.72, z: seatZ, ry: Math.PI })),
      half: { x: length / 2 + 0.45, z: 0.45 },
    });
  }

  floorTables.forEach((t, i) => {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, floorTables.length - row * cols);
    const col = i % cols;
    const x = (col - (inRow - 1) / 2) * cellW;
    const z = firstRowZ + row * cellD - cellD / 2;
    const kind = tableKind(layout, t.seats, hasBar ? i + 1 : i);
    const entry = { n: t.n, seats: t.seats, kind, x, z, seatH: SEAT_HEIGHT[kind] };
    if (kind === "round") {
      const r = t.seats <= 2 ? 0.42 : t.seats <= 4 ? 0.55 : t.seats <= 6 ? 0.72 : 0.85;
      entry.r = r;
      entry.seatsPos = seatRing(x, z, t.seats, r + 0.45, t.seats <= 4 ? 0 : -Math.PI / 2);
      entry.half = { x: r + 0.2, z: r + 0.2 };
    } else if (kind === "long") {
      const perSide = Math.ceil(t.seats / 2);
      const length = Math.max(1.6, perSide * 0.72);
      entry.length = length;
      entry.seatsPos = Array.from({ length: t.seats }, (_, k) => {
        const back = k < perSide;
        const index = back ? k : k - perSide;
        const count = back ? perSide : t.seats - perSide;
        const sx = x - length / 2 + ((index + 0.5) * length) / count;
        const sz = back ? z - 0.78 : z + 0.78;
        return { x: sx, z: sz, ry: back ? 0 : Math.PI };
      });
      entry.half = { x: length / 2 + 0.2, z: 0.62 };
    } else if (kind === "square") {
      entry.seatsPos = seatRing(x, z, t.seats, 0.78, 0);
      entry.half = { x: 0.5, z: 0.5 };
    } else if (kind === "plastic") {
      entry.color = PLASTIC[i % PLASTIC.length];
      entry.seatsPos = seatRing(x, z, t.seats, 0.66, t.seats === 4 ? 0 : -Math.PI / 2);
      entry.half = { x: 0.45, z: 0.45 };
    } else {
      const r = t.seats <= 4 ? 0.5 : 0.62;
      entry.r = r;
      entry.seatsPos = seatRing(x, z, t.seats, r + 0.42, t.seats <= 4 ? 0 : -Math.PI / 2);
      entry.half = { x: r + 0.1, z: r + 0.1 };
    }
    plan.tables.push(entry);
  });
  return plan;
}

// ---------- small geometry helpers ----------

const materials = new Map();
function mat(color, options = {}) {
  const key = color + JSON.stringify(options);
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...options }));
  }
  return materials.get(key);
}

function mesh(geometry, material, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const box = (w, h, d, color, x, y, z, options) => mesh(new THREE.BoxGeometry(w, h, d), mat(color, options), x, y, z);
const cyl = (rt, rb, h, color, x, y, z, segments = 20, options) =>
  mesh(new THREE.CylinderGeometry(rt, rb, h, segments), mat(color, options), x, y, z);
const ball = (r, color, x, y, z, options) => mesh(new THREE.SphereGeometry(r, 16, 12), mat(color, options), x, y, z);

function canvasTexture(width, height, draw, repeat) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

function floorTexture(layout, width, depth) {
  if (layout === "cafe" || layout === "counter") {
    return canvasTexture(128, 128, (c) => {
      c.fillStyle = "#efe9dc";
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = "#2d4a3e";
      c.fillRect(0, 0, 64, 64);
      c.fillRect(64, 64, 64, 64);
    }, [width / 1.2, depth / 1.2]);
  }
  if (layout === "bench") {
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = "#d8cfbf";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = ["#a99c86", "#8a5a3b", "#f4efe6", "#6d665c"][i % 4];
        c.fillRect((i * 97) % 256, (i * 57 + i * i) % 256, 2 + (i % 3), 2 + (i % 2));
      }
      c.strokeStyle = "rgba(90,80,70,.35)";
      c.strokeRect(0, 0, 256, 256);
    }, [width / 2, depth / 2]);
  }
  if (layout === "garden") {
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = "#7f9a55";
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = i % 3 ? "#748f4b" : "#8fa963";
        c.fillRect((i * 73) % 256, (i * 131 + i * 7) % 256, 2, 4);
      }
    }, [width / 3, depth / 3]);
  }
  // street and mat: paving stones
  return canvasTexture(128, 128, (c) => {
    c.fillStyle = "#9b958a";
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = "#7f796f";
    c.lineWidth = 3;
    c.strokeRect(1, 1, 126, 62);
    c.strokeRect(-63, 65, 126, 62);
    c.strokeRect(65, 65, 126, 62);
  }, [width / 1.6, depth / 1.6]);
}

function textSprite(text, { color = "#ffffff", background = "rgba(34,33,32,0.78)", size = 40, weight = 600 } = {}) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `${weight} ${size}px ${FONT}`;
  const width = Math.ceil(context.measureText(text).width) + 36;
  canvas.width = width;
  canvas.height = size + 24;
  context.font = `${weight} ${size}px ${FONT}`;
  context.fillStyle = background;
  context.beginPath();
  context.roundRect(0, 0, width, canvas.height, canvas.height / 2);
  context.fill();
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(text, 18, canvas.height / 2 + 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, transparent: true }));
  const scale = 0.0045;
  sprite.scale.set(width * scale, canvas.height * scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function bubbleSprite(text) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > 26 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) {
    lines.push(line);
  }
  if (lines.length > 3) {
    lines.length = 3;
    lines[2] = lines[2].replace(/[.,!?]*$/, "") + "...";
  }
  const size = 34;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = `500 ${size}px ${FONT}`;
  const textWidth = Math.max(...lines.map((l) => context.measureText(l).width), 40);
  const width = Math.ceil(textWidth) + 44;
  const height = lines.length * (size + 8) + 30 + 18;
  canvas.width = width;
  canvas.height = height;
  context.font = `500 ${size}px ${FONT}`;
  context.fillStyle = "rgba(255,255,255,0.97)";
  context.strokeStyle = "rgba(34,33,32,0.25)";
  context.lineWidth = 3;
  context.beginPath();
  context.roundRect(2, 2, width - 4, height - 22, 22);
  context.moveTo(width / 2 - 14, height - 21);
  context.lineTo(width / 2, height - 3);
  context.lineTo(width / 2 + 14, height - 21);
  context.fill();
  context.stroke();
  context.fillStyle = "#222120";
  context.textBaseline = "top";
  lines.forEach((l, i) => context.fillText(l, 22, 16 + i * (size + 8)));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: false, depthTest: false, transparent: true }));
  const scale = 0.0042;
  sprite.scale.set(width * scale, height * scale, 1);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = 20;
  return sprite;
}

function disposeTree(root) {
  root.traverse((node) => {
    if (node.geometry) {
      node.geometry.dispose();
    }
    if (node.isSprite) {
      node.material.map?.dispose();
      node.material.dispose();
    }
    if (node.material && node.material.map && !node.isSprite) {
      node.material.map.dispose();
      node.material.dispose();
    }
  });
}

// ---------- furniture ----------

function chair(seat, height, color, withBack) {
  const group = new THREE.Group();
  group.add(cyl(0.2, 0.2, 0.05, color, 0, height, 0));
  for (const [lx, lz] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) {
    group.add(cyl(0.018, 0.022, height, "#3b2a1e", lx, height / 2, lz, 6));
  }
  if (withBack) {
    group.add(box(0.36, 0.3, 0.03, color, 0, height + 0.25, -0.19));
    group.add(cyl(0.015, 0.015, 0.3, "#3b2a1e", 0.16, height + 0.12, -0.19, 6));
    group.add(cyl(0.015, 0.015, 0.3, "#3b2a1e", -0.16, height + 0.12, -0.19, 6));
  }
  group.position.set(seat.x, 0, seat.z);
  group.rotation.y = seat.ry;
  return group;
}

function buildTable(t) {
  const group = new THREE.Group();
  if (t.kind === "round") {
    group.add(cyl(t.r, t.r, 0.04, "#f1efe9", t.x, 0.77, t.z, 32, { roughness: 0.35 }));
    group.add(cyl(t.r + 0.025, t.r + 0.025, 0.035, "#3b3a38", t.x, 0.735, t.z, 32));
    group.add(cyl(0.05, 0.05, 0.72, "#2a2a28", t.x, 0.36, t.z, 10));
    group.add(cyl(0.26, 0.3, 0.03, "#2a2a28", t.x, 0.015, t.z, 20));
    t.seatsPos.forEach((s) => group.add(chair(s, t.seatH, "#6b4428", true)));
  } else if (t.kind === "long" || t.kind === "square") {
    const length = t.kind === "long" ? t.length : 0.8;
    const depth = t.kind === "long" ? 0.84 : 0.8;
    group.add(box(length, 0.05, depth, "#9a6b45", t.x, 0.75, t.z));
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(box(0.06, 0.73, 0.06, "#6b4428", t.x + lx * (length / 2 - 0.08), 0.365, t.z + lz * (depth / 2 - 0.08)));
    }
    if (t.kind === "long") {
      for (const side of [-1, 1]) {
        const bz = t.z + side * 0.78;
        group.add(box(length, 0.05, 0.32, "#8a5a3b", t.x, t.seatH, bz));
        for (const lx of [-1, 1]) {
          group.add(box(0.05, t.seatH, 0.26, "#6b4428", t.x + lx * (length / 2 - 0.1), t.seatH / 2, bz));
        }
      }
    } else {
      t.seatsPos.forEach((s) => group.add(chair(s, t.seatH, "#8a5a3b", false)));
    }
  } else if (t.kind === "plastic") {
    group.add(box(0.72, 0.04, 0.72, t.color, t.x, 0.55, t.z, { roughness: 0.5 }));
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(cyl(0.025, 0.03, 0.54, t.color, t.x + lx * 0.3, 0.27, t.z + lz * 0.3, 8, { roughness: 0.5 }));
    }
    t.seatsPos.forEach((s, i) => {
      const color = PLASTIC[(hash(t.n + ":" + i) >>> 3) % PLASTIC.length];
      group.add(cyl(0.16, 0.19, 0.3, color, s.x, 0.15, s.z, 14, { roughness: 0.5 }));
    });
  } else if (t.kind === "low") {
    const tikar = canvasTexture(128, 128, (c) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? "#c9a66b" : "#b88f52";
        c.fillRect(i * 8, 0, 8, 128);
      }
      c.fillStyle = "rgba(166,61,36,.55)";
      c.fillRect(0, 10, 128, 6);
      c.fillRect(0, 112, 128, 6);
    });
    const size = t.r * 2 + 1.5;
    const rug = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tikar, roughness: 0.95 }), t.x, 0.012, t.z, false);
    rug.rotation.x = -Math.PI / 2;
    group.add(rug);
    if (t.seats <= 4) {
      group.add(box(t.r * 2, 0.05, t.r * 2, "#6b4428", t.x, 0.32, t.z));
    } else {
      group.add(cyl(t.r, t.r, 0.05, "#6b4428", t.x, 0.32, t.z, 28));
    }
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(box(0.05, 0.3, 0.05, "#3b2a1e", t.x + lx * t.r * 0.6, 0.15, t.z + lz * t.r * 0.6));
    }
    t.seatsPos.forEach((s, i) => {
      const cushion = box(0.44, 0.07, 0.44, i % 2 ? "#2d4a3e" : "#a63d24", s.x, 0.04, s.z);
      cushion.rotation.y = s.ry;
      group.add(cushion);
    });
    group.add(cyl(0.05, 0.06, 0.12, "#f1efe9", t.x + 0.12, 0.41, t.z - 0.05, 12));
    group.add(cyl(0.05, 0.06, 0.12, "#f1efe9", t.x - 0.15, 0.41, t.z + 0.1, 12));
  } else if (t.kind === "bar") {
    const length = t.length + 0.8;
    group.add(box(length, 1.0, 0.7, "#7d5134", t.x, 0.5, t.z));
    group.add(box(length + 0.1, 0.05, 0.84, "#f1efe9", t.x, 1.02, t.z + 0.05, { roughness: 0.35 }));
    for (let i = 0; i < Math.floor(length / 0.5); i++) {
      group.add(box(0.03, 0.9, 0.02, "#6b4428", t.x - length / 2 + 0.25 + i * 0.5, 0.48, t.z + 0.36));
    }
    t.seatsPos.forEach((s) => {
      group.add(cyl(0.035, 0.035, t.seatH, "#2a2a28", s.x, t.seatH / 2, s.z, 8));
      group.add(cyl(0.2, 0.2, 0.05, "#2d4a3e", s.x, t.seatH, s.z, 20));
      group.add(cyl(0.18, 0.2, 0.03, "#2a2a28", s.x, 0.015, s.z, 16));
    });
  }
  addTabletop(group, t);
  group.traverse((node) => {
    node.userData.table = t.n;
  });
  return group;
}

// Cups, a condiment set, a plate of gorengan and a small jar lamp, so tables look used.
const TABLE_TOP = { round: 0.79, long: 0.775, square: 0.775, plastic: 0.57, low: 0.345, bar: 1.045 };
function addTabletop(group, t) {
  const top = TABLE_TOP[t.kind];
  const seed = hash("top" + t.n);
  const cups = t.kind === "bar" ? t.seatsPos.filter((_, i) => (seed >> i) & 1) : t.seatsPos.filter((_, i) => ((seed >> i) & 3) === 0).slice(0, 3);
  for (const s of cups) {
    const k = t.kind === "bar" ? 0.55 : 0.45;
    const cx = t.kind === "bar" ? s.x : s.x + (t.x - s.x) * k;
    const cz = t.kind === "bar" ? t.z + 0.2 : s.z + (t.z - s.z) * k;
    group.add(cyl(0.045, 0.038, 0.11, "#e8eef0", cx, top + 0.055, cz, 12, { transparent: true, opacity: 0.55, roughness: 0.1 }));
    group.add(cyl(0.04, 0.035, 0.07, t.kind === "low" ? "#c58b2a" : "#3b2416", cx, top + 0.04, cz, 12));
  }
  if (t.kind !== "bar") {
    // condiment set: kecap bottle, sambal jar, toothpick pot
    group.add(cyl(0.025, 0.03, 0.16, "#2a1d16", t.x + 0.08, top + 0.08, t.z - 0.06, 10));
    group.add(cyl(0.035, 0.035, 0.07, "#a63d24", t.x - 0.02, top + 0.035, t.z - 0.1, 10));
    group.add(cyl(0.022, 0.022, 0.06, "#c9b48a", t.x - 0.1, top + 0.03, t.z - 0.04, 8));
    // jar lamp, glows at night
    const glass = cyl(0.05, 0.05, 0.1, "#fff3d6", t.x - 0.04, top + 0.05, t.z + 0.1, 12, { emissive: "#ffc46b", emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
    glass.castShadow = false;
    glass.userData.lamp = true;
    group.add(glass);
  }
  if (t.kind === "long" || t.kind === "square") {
    // plate of gorengan
    group.add(cyl(0.16, 0.13, 0.02, "#f1efe9", t.x + 0.32, top + 0.01, t.z + 0.05, 20));
    for (let i = 0; i < 4; i++) {
      const piece = box(0.09, 0.035, 0.05, i % 2 ? "#c58b2a" : "#b5652e", t.x + 0.28 + (i % 2) * 0.08, top + 0.035 + Math.floor(i / 2) * 0.02, t.z + 0.02 + Math.floor(i / 2) * 0.05);
      piece.rotation.y = i * 0.7;
      group.add(piece);
    }
  }
}

const MENUS = {
  warkop: ["Kopi tubruk", "Kopi susu", "Teh manis", "Gorengan", "Indomie"],
  angkringan: ["Wedang jahe", "Kopi joss", "Nasi kucing", "Sate usus", "Teh nasgitel"],
  kafe: ["Es kopi susu", "Americano", "Teh tarik", "Roti bakar"],
  kopitiam: ["Kopi O", "Kopi C", "Teh tarik", "Kaya toast", "Half-boiled eggs"],
  mamak: ["Teh tarik", "Roti canai", "Maggi goreng", "Milo ais"],
  hawker: ["Kopi", "Teh", "Chicken rice", "Char kway teow"],
  kissaten: ["Blend coffee", "Hand drip", "Toast", "Pudding"],
  izakaya: ["Highball", "Edamame", "Yakitori", "Karaage"],
  streetfood: ["Cha yen", "Pad kra pao", "Moo ping", "Mango sticky rice"],
  pub: ["Pint", "Lemon squash", "Chips", "Pie"],
};

function menuTexture(venue) {
  const lines = MENUS[venue.id] || ["Kopi", "Teh", "Snacks"];
  return canvasTexture(512, 640, (c, w, h) => {
    c.fillStyle = "#24372f";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#8a5a3b";
    c.lineWidth = 22;
    c.strokeRect(0, 0, w, h);
    c.fillStyle = "#f4efe6";
    c.textAlign = "center";
    c.font = `64px ${SERIF}`;
    c.fillText("Menu", w / 2, 110);
    c.font = `500 40px ${FONT}`;
    lines.forEach((line, i) => c.fillText(line, w / 2, 200 + i * 78));
  });
}

function bunting(group, x0, x1, y, z) {
  const colors = ["#a63d24", "#2d4a3e", "#d9a62e", "#f4efe6"];
  const count = Math.floor((x1 - x0) / 0.32);
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / count);
    const sag = Math.sin(((i + 0.5) / count) * Math.PI) * 0.18;
    const flag = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 3), mat(colors[i % colors.length], { side: THREE.DoubleSide }));
    flag.position.set(x, y - sag - 0.11, z);
    flag.rotation.x = Math.PI;
    flag.scale.z = 0.15;
    group.add(flag);
  }
}

function plant(x, z, scale = 1) {
  const group = new THREE.Group();
  group.add(cyl(0.22 * scale, 0.17 * scale, 0.4 * scale, "#b5652e", x, 0.2 * scale, z, 14));
  group.add(ball(0.32 * scale, "#4f6b3a", x, 0.62 * scale, z));
  group.add(ball(0.24 * scale, "#5f7d44", x + 0.14 * scale, 0.82 * scale, z - 0.06));
  group.add(ball(0.2 * scale, "#46613a", x - 0.12 * scale, 0.86 * scale, z + 0.08));
  return group;
}

function signTexture(name, layout) {
  const dark = layout === "cafe" || layout === "counter";
  return canvasTexture(1024, 200, (c, w, h) => {
    c.fillStyle = dark ? "#2d4a3e" : "#a63d24";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#f4efe6";
    c.lineWidth = 6;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.fillStyle = "#f4efe6";
    c.textAlign = "center";
    c.textBaseline = "middle";
    let size = 104;
    c.font = `${size}px ${SERIF}`;
    while (c.measureText(name).width > w - 120 && size > 40) {
      size -= 6;
      c.font = `${size}px ${SERIF}`;
    }
    c.fillText(name, w / 2, h / 2 + 6);
  });
}

function stringLights(group, from, to, bulbs, lamps) {
  const sag = 0.45;
  for (let i = 0; i <= bulbs; i++) {
    const k = i / bulbs;
    const x = from.x + (to.x - from.x) * k;
    const z = from.z + (to.z - from.z) * k;
    const y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * sag;
    const bulb = ball(0.06, "#ffe2a8", x, y, z, { emissive: "#ffcf7a", emissiveIntensity: 1.2 });
    bulb.castShadow = false;
    lamps.push(bulb);
    group.add(bulb);
  }
}

function buildPlace(plan, venue) {
  const group = new THREE.Group();
  const lamps = [];
  const { width, depth, backZ, layout } = plan;
  const indoor = layout === "cafe" || layout === "counter" || layout === "bench";

  const ground = mesh(new THREE.PlaneGeometry(width + 40, depth + 40), mat(indoor ? "#5d564c" : layout === "garden" ? "#6c8749" : "#6f6a62"), 0, -0.01, 0, false);
  ground.rotation.x = -Math.PI / 2;
  ground.userData.floor = true;
  group.add(ground);
  const floor = mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: floorTexture(layout, width, depth), roughness: 0.9 }), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;
  floor.userData.floor = true;
  group.add(floor);

  // back wall or shop front
  const wallColor = layout === "cafe" || layout === "counter" ? "#efe9dc" : layout === "bench" ? "#e9dcc4" : "#d9cdb8";
  group.add(box(width, 3.2, 0.2, wallColor, 0, 1.6, backZ - 0.1));
  group.add(box(width, 0.9, 0.04, layout === "cafe" || layout === "counter" ? "#2d4a3e" : "#8a5a3b", 0, 0.45, backZ + 0.02));
  if (indoor) {
    for (const side of [-1, 1]) {
      group.add(box(0.2, 1.0, depth, wallColor, side * (width / 2 + 0.1), 0.5, 0));
      group.add(box(0.24, 0.08, depth, "#8a5a3b", side * (width / 2 + 0.1), 1.02, 0));
      for (let z = backZ; z <= depth / 2 + 0.01; z += depth / 2) {
        group.add(box(0.3, 3.2, 0.3, "#8a5a3b", side * (width / 2 + 0.1), 1.6, z));
      }
    }
  } else {
    // shophouse windows with shutters behind the stall
    for (let x = -width / 2 + 1.2; x < width / 2 - 0.8; x += 2.4) {
      group.add(box(1.4, 1.1, 0.06, "#6d7f86", x, 2.2, backZ + 0.02, { roughness: 0.4 }));
      group.add(box(1.5, 0.08, 0.1, "#f4efe6", x, 1.62, backZ + 0.05));
    }
  }

  // service counter, cart or kiosk at the back (the bar layout uses table 1 as its counter)
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.82), new THREE.MeshStandardMaterial({ map: signTexture(venue.name, layout), roughness: 0.7 }));
  sign.position.set(0, 2.75, backZ + 0.03);
  group.add(sign);
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.12), new THREE.MeshStandardMaterial({ map: menuTexture(venue), roughness: 0.9 }));
  menu.position.set(width / 2 - 1.15, 1.75, backZ + 0.03);
  group.add(menu);
  bunting(group, -width / 2 + 0.3, width / 2 - 0.3, 3.15, backZ + 0.25);
  if (layout !== "counter") {
    const cz = backZ + 0.7;
    if (layout === "mat" || layout === "street") {
      // gerobak: cart on wheels with a tarp roof and a lantern
      group.add(box(2.2, 0.85, 0.8, layout === "mat" ? "#8a5a3b" : "#2f6fa3", 0, 0.75, cz));
      group.add(box(2.3, 0.05, 0.9, "#f1efe9", 0, 1.2, cz));
      for (const side of [-1, 1]) {
        const wheel = mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), mat("#2a2a28"), side * 0.8, 0.33, cz + 0.42);
        group.add(wheel);
        group.add(cyl(0.03, 0.03, 1.2, "#3b2a1e", side * 1.05, 1.8, cz + 0.35, 6));
      }
      const tarp = box(2.6, 0.05, 1.3, layout === "mat" ? "#2d4a3e" : "#c8432b", 0, 2.42, cz + 0.2);
      tarp.rotation.x = 0.12;
      group.add(tarp);
      const lantern = ball(0.13, "#ffe2a8", 0.6, 1.95, cz + 0.4, { emissive: "#ffb85c", emissiveIntensity: 1.4 });
      lamps.push(lantern);
      group.add(lantern);
      for (let i = 0; i < 5; i++) {
        group.add(cyl(0.07, 0.07, 0.16, ["#d9a62e", "#a63d24", "#6f7f34"][i % 3], -0.8 + i * 0.32, 1.31, cz - 0.1, 10));
      }
      group.add(cyl(0.12, 0.1, 0.22, "#c9c4ba", 0.8, 1.34, cz, 14, { metalness: 0.5, roughness: 0.35 }));
    } else if (layout === "garden") {
      group.add(box(3.4, 1.05, 0.8, "#6b4428", 0, 0.52, cz));
      group.add(box(3.5, 0.06, 0.9, "#9a6b45", 0, 1.08, cz));
      for (const side of [-1, 1]) {
        group.add(box(0.12, 2.4, 0.12, "#6b4428", side * 1.7, 1.2, cz + 0.5));
      }
      const roof = box(4.0, 0.08, 1.8, "#3b3a38", 0, 2.45, cz + 0.2);
      roof.rotation.x = 0.1;
      group.add(roof);
      for (let i = 0; i < 4; i++) {
        group.add(cyl(0.05, 0.05, 0.4, "#c9c4ba", -0.9 + i * 0.6, 1.3, cz - 0.15, 8, { metalness: 0.6, roughness: 0.3 }));
      }
    } else {
      // warung or cafe counter with jars, cake case or espresso machine
      group.add(box(3.6, 1.0, 0.75, layout === "cafe" ? "#7d5134" : "#8a5a3b", 0, 0.5, cz));
      group.add(box(3.7, 0.05, 0.85, "#f1efe9", 0, 1.02, cz, { roughness: 0.35 }));
      if (layout === "cafe") {
        group.add(box(0.6, 0.45, 0.45, "#c9c4ba", -1.0, 1.27, cz - 0.1, { metalness: 0.6, roughness: 0.3 }));
        group.add(box(0.9, 0.36, 0.5, "#dfe9ea", 0.8, 1.23, cz, { transparent: true, opacity: 0.55, roughness: 0.1 }));
        group.add(cyl(0.12, 0.12, 0.06, "#c58b2a", 0.6, 1.1, cz, 16));
        group.add(cyl(0.12, 0.12, 0.06, "#8a5a3b", 1.0, 1.1, cz, 16));
      } else {
        for (let i = 0; i < 6; i++) {
          group.add(cyl(0.11, 0.11, 0.26, "#dfe9ea", -1.4 + i * 0.36, 1.18, cz, 14, { transparent: true, opacity: 0.6, roughness: 0.1 }));
          group.add(cyl(0.1, 0.1, 0.14, ["#d9a62e", "#a63d24", "#6f7f34", "#c58b2a"][i % 4], -1.4 + i * 0.36, 1.12, cz, 12));
        }
        group.add(cyl(0.14, 0.12, 0.24, "#c9c4ba", 1.3, 1.17, cz, 14, { metalness: 0.5, roughness: 0.35 }));
      }
      // shelves on the wall behind
      for (const y of [1.55, 2.0]) {
        group.add(box(2.6, 0.04, 0.26, "#6b4428", 0, y, backZ + 0.15));
        for (let i = 0; i < 7; i++) {
          group.add(cyl(0.06, 0.06, 0.2, ["#f1efe9", "#2d4a3e", "#c58b2a"][(i + Math.round(y)) % 3], -1.1 + i * 0.36, y + 0.12, backZ + 0.15, 10));
        }
      }
    }
  }

  // lamps over the tables indoors, string lights outdoors
  if (indoor) {
    // wall lamps: a short bracket and a glowing globe along the back wall and on the side pillars
    const wallLamp = (x, y, z) => {
      group.add(box(0.05, 0.05, 0.22, "#2a2a28", x, y, z));
      const bulb = ball(0.11, "#fff1d0", x, y - 0.06, z + 0.14, { emissive: "#ffd28a", emissiveIntensity: 1.5 });
      bulb.castShadow = false;
      lamps.push(bulb);
      group.add(bulb);
    };
    for (const x of [-width / 2 + 0.9, width / 2 - 0.9]) {
      wallLamp(x, 2.35, backZ + 0.1);
    }
    stringLights(group, { x: -width / 2 + 0.2, y: 3.05, z: backZ + 0.15 }, { x: width / 2 - 0.2, y: 3.05, z: backZ + 0.15 }, 18, lamps);
  } else {
    const h = 2.7;
    const corners = [
      { x: -width / 2, y: h, z: -depth / 2 + 1.6 }, { x: width / 2, y: h, z: -depth / 2 + 1.6 },
      { x: width / 2, y: h, z: depth / 2 - 0.4 }, { x: -width / 2, y: h, z: depth / 2 - 0.4 },
    ];
    corners.forEach((p) => group.add(cyl(0.05, 0.06, h, "#3b3a38", p.x, h / 2, p.z, 8)));
    stringLights(group, corners[0], corners[1], 16, lamps);
    stringLights(group, corners[0], corners[3], 16, lamps);
    stringLights(group, corners[1], corners[2], 16, lamps);
  }

  // plants in the corners
  group.add(plant(-width / 2 + 0.5, depth / 2 - 0.5));
  group.add(plant(width / 2 - 0.5, depth / 2 - 0.5));
  group.add(plant(-width / 2 + 0.5, backZ + 1.6, 0.85));
  group.add(plant(width / 2 - 0.5, backZ + 1.6, 0.85));

  for (const t of plan.tables) {
    group.add(buildTable(t));
  }
  group.traverse((node) => {
    if (node.userData.lamp) {
      lamps.push(node);
    }
  });

  // the owner minds the counter (no name tag, not a player)
  const ownerLooks = { skin: "#b98a68", shirt: layout === "counter" ? "#2a2a28" : "#f1efe9", pants: "#3b3a38", hair: "#222120" };
  const owner = makeAvatar(ownerLooks, "", false);
  owner.root.remove(owner.label);
  owner.label.material.map?.dispose();
  poseStanding(owner, 0, false);
  owner.arms[0].rotation.x = -0.5;
  if (layout === "counter") {
    owner.root.position.set(-1.2, 0, backZ + 0.4);
  } else {
    const halfCounter = layout === "mat" || layout === "street" ? 1.1 : layout === "garden" ? 1.7 : 1.8;
    owner.root.position.set(-(halfCounter + 0.45), 0, backZ + 0.75);
    owner.root.rotation.y = 0.35;
  }
  group.add(owner.root);
  return { group, lamps };
}

// ---------- avatars ----------

function makeAvatar(looks, name, isMe) {
  const root = new THREE.Group();
  const hips = new THREE.Group();
  hips.position.y = 0.82;
  root.add(hips);

  const legs = [];
  for (const side of [-1, 1]) {
    const thigh = new THREE.Group();
    thigh.position.set(side * 0.09, 0, 0);
    thigh.add(box(0.13, 0.44, 0.15, looks.pants, 0, -0.22, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    knee.add(box(0.12, 0.4, 0.13, looks.pants, 0, -0.2, 0));
    knee.add(box(0.12, 0.06, 0.22, "#2a2a28", 0, -0.39, 0.04));
    thigh.add(knee);
    hips.add(thigh);
    legs.push({ thigh, knee });
  }
  const torso = cyl(0.17, 0.2, 0.56, looks.shirt, 0, 0.28, 0, 14);
  hips.add(torso);
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 0.52, 0);
    shoulder.add(box(0.09, 0.48, 0.1, looks.shirt, 0, -0.22, 0));
    shoulder.add(ball(0.05, looks.skin, 0, -0.48, 0));
    hips.add(shoulder);
    arms.push(shoulder);
  }
  const head = new THREE.Group();
  head.position.y = 0.74;
  head.add(ball(0.16, looks.skin, 0, 0, 0));
  const hair = mesh(new THREE.SphereGeometry(0.168, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(looks.hair), 0, 0.01, -0.01);
  hair.rotation.x = -0.25;
  head.add(hair);
  head.add(ball(0.018, "#222120", 0.055, 0.02, 0.15));
  head.add(ball(0.018, "#222120", -0.055, 0.02, 0.15));
  hips.add(head);

  const ring = mesh(new THREE.RingGeometry(0.3, 0.38, 32), new THREE.MeshBasicMaterial({ color: isMe ? ACCENT : VOICE, transparent: true, opacity: 0.9, side: THREE.DoubleSide }), 0, 0.02, 0, false);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = isMe;
  root.add(ring);

  const label = textSprite(name, isMe ? { background: "rgba(166,61,36,0.95)" } : {});
  label.position.y = 1.95;
  root.add(label);

  return { root, hips, legs, arms, head, ring, label, labelText: name, bubble: null, bubbleUntil: 0 };
}

function poseStanding(a, t, moving) {
  a.hips.position.y = 0.82 + (moving ? Math.abs(Math.sin(t * 10)) * 0.03 : 0);
  const swing = moving ? Math.sin(t * 10) * 0.55 : 0;
  a.legs[0].thigh.rotation.x = swing;
  a.legs[1].thigh.rotation.x = -swing;
  a.legs[0].knee.rotation.x = moving ? Math.max(0, -swing) * 0.8 : 0;
  a.legs[1].knee.rotation.x = moving ? Math.max(0, swing) * 0.8 : 0;
  a.arms[0].rotation.x = -swing * 0.7;
  a.arms[1].rotation.x = swing * 0.7;
  a.head.rotation.y = 0;
}

function poseSitting(a, seatH, t, talking) {
  const floor = seatH < 0.15;
  a.hips.position.y = seatH + 0.06;
  for (const [i, leg] of a.legs.entries()) {
    leg.thigh.rotation.x = -Math.PI / 2;
    leg.thigh.rotation.z = floor ? (i ? -0.5 : 0.5) : 0;
    leg.knee.rotation.x = floor ? Math.PI * 0.85 : Math.min(Math.PI / 2, (Math.PI / 2) * (seatH / 0.46));
  }
  a.arms[0].rotation.x = -0.75 + (talking ? Math.sin(t * 7) * 0.25 : 0);
  a.arms[1].rotation.x = -0.75;
  a.head.rotation.y = Math.sin(t * 0.6 + a.labelText.length) * 0.25;
}

// ---------- the world ----------

export function createWorld(container, handlers = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
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
  canvas.className = "world-canvas";
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "application");
  canvas.setAttribute("aria-label", "3D view of the place. Tap the floor or use the arrow keys to walk, tap a table to sit.");
  container.prepend(canvas);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
  const hemi = new THREE.HemisphereLight("#fff6e6", "#5d564c", 1.6);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight("#fff1d8", 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);
  const night = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.PointLight("#ffcf8a", 0, 9, 1.6);
    scene.add(light);
    night.push(light);
  }

  let tableLights = [];

  const avatarsGroup = new THREE.Group();
  scene.add(avatarsGroup);
  const marker = mesh(new THREE.RingGeometry(0.16, 0.24, 24), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, side: THREE.DoubleSide }), 0, 0.03, 0, false);
  marker.rotation.x = -Math.PI / 2;
  scene.add(marker);

  const avatars = new Map();   // id -> avatar + motion state
  const tableLabels = new Map();
  let place = null;
  let plan = null;
  let lamps = [];
  let myId = null;
  let mySeat = null;           // { table, seat } while seated
  const me = { x: 0, z: 0, ry: Math.PI, path: [] };
  const keys = new Set();
  const cam = { yaw: 0, pitch: 0.68, dist: 10.5, target: new THREE.Vector3(), wantDist: 10.5 };
  let hour = 12;
  let lastMoveSent = 0;
  let moveDirty = false;
  let readyFlag = false;
  const clock = new THREE.Clock();

  function resize() {
    const width = container.clientWidth || 1;
    const height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function applyHour() {
    const h = hour;
    const isNight = h < 6 || h >= 19;
    const dusk = (h >= 17 && h < 19) || (h >= 6 && h < 7);
    const sky = isNight ? "#1d2a33" : dusk ? "#e9b98c" : "#cfe0e3";
    scene.background = new THREE.Color(sky);
    scene.fog = new THREE.Fog(sky, 22, 60);
    hemi.intensity = isNight ? 0.55 : dusk ? 1.2 : 1.7;
    hemi.color.set(isNight ? "#9fb3c8" : "#fff6e6");
    sun.intensity = isNight ? 0.35 : dusk ? 1.5 : 2.3;
    sun.color.set(isNight ? "#a9bdd6" : dusk ? "#ffc58a" : "#fff1d8");
    night.forEach((light) => {
      light.intensity = isNight ? 14 : dusk ? 6 : 0;
    });
    lamps.forEach((lamp) => {
      lamp.material.emissiveIntensity = isNight ? 2.2 : dusk ? 1.4 : 0.6;
    });
    tableLights.forEach((light) => {
      light.intensity = isNight ? 3.2 : dusk ? 1.6 : 0;
    });
    renderer.toneMappingExposure = 1;
  }

  function seatOf(tableNo, seatNo) {
    const t = plan?.tables.find((x) => x.n === tableNo);
    return t && t.seatsPos[seatNo] ? { ...t.seatsPos[seatNo], h: t.seatH, table: t } : null;
  }

  function tableLabelText(t, sitters, mineHere) {
    const free = t.seats - sitters;
    const dot = "\u00b7";
    return mineHere ? `Only ${t.label} hears you` : free <= 0 ? `${t.label} ${dot} full` : sitters ? `${t.label} ${dot} ${free} free` : `${t.label} ${dot} ${t.seats} seats`;
  }

  function setVenue({ layout, tables, tableWord, venue, spawn }) {
    if (place) {
      scene.remove(place);
      disposeTree(place);
    }
    for (const label of tableLabels.values()) {
      scene.remove(label.sprite);
      label.sprite.material.map.dispose();
      label.sprite.material.dispose();
    }
    tableLabels.clear();
    plan = planVenue(layout, tables);
    plan.tables.forEach((t) => {
      t.label = `${tableWord} ${t.n}`;
    });
    const built = buildPlace(plan, venue);
    place = built.group;
    lamps = built.lamps;
    scene.add(place);

    const span = Math.max(plan.width, plan.depth);
    sun.position.set(span * 0.4, 12, span * 0.55);
    sun.target.position.set(0, 0, 0);
    const half = span / 2 + 1;
    Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 40 });
    sun.shadow.camera.updateProjectionMatrix();
    night[0].position.set(-plan.width / 4, 2.4, -plan.depth / 6);
    night[1].position.set(plan.width / 4, 2.4, -plan.depth / 6);
    night[2].position.set(0, 2.4, plan.depth / 4);
    tableLights.forEach((light) => scene.remove(light));
    tableLights = plan.tables.slice(0, 6).map((t) => {
      const light = new THREE.PointLight("#ffbf75", 0, 3.6, 1.8);
      light.position.set(t.x, (TABLE_TOP[t.kind] || 0.75) + 0.9, t.z);
      scene.add(light);
      return light;
    });

    const start = spawn || plan.spawn;
    me.x = start.x + (Math.random() - 0.5) * 1.6;
    me.z = start.z;
    me.ry = Math.PI;
    me.path = [];
    for (const a of avatars.values()) {
      a.snap = true;
    }
    cam.target.set(me.x, 0.9, me.z);
    cam.yaw = 0;
    const narrow = camera.aspect < 1 ? 1.3 : 1;
    cam.dist = cam.wantDist = Math.min(16, Math.max(9, span * 0.85) * narrow);
    applyHour();
    moveDirty = true;
  }

  // A warm circle on the floor around my table: the table's private zone.
  const zone = new THREE.Group();
  const zoneFill = mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.16, depthWrite: false }), 0, 0.012, 0, false);
  const zoneEdge = mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide }), 0, 0.014, 0, false);
  zoneFill.rotation.x = -Math.PI / 2;
  zoneEdge.rotation.x = -Math.PI / 2;
  zone.add(zoneFill, zoneEdge);
  zone.visible = false;
  scene.add(zone);

  function placeZone(tableNo) {
    const t = plan?.tables.find((x) => x.n === tableNo);
    if (!t) {
      zone.visible = false;
      return;
    }
    const xs = t.seatsPos.map((s) => s.x).concat(t.x);
    const zs = t.seatsPos.map((s) => s.z).concat(t.z);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
    const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 0.55;
    const rz = (Math.max(...zs) - Math.min(...zs)) / 2 + 0.55;
    zone.position.set(cx, 0, cz);
    zone.scale.set(rx, 1, rz);
    zone.visible = true;
  }

  function updateTableLabels(occupancy, myTable) {
    if (!plan) {
      return;
    }
    placeZone(myTable);
    for (const t of plan.tables) {
      const sitters = occupancy.get(t.n) || 0;
      const text = tableLabelText(t, sitters, myTable === t.n);
      const existing = tableLabels.get(t.n);
      if (existing && existing.text === text) {
        continue;
      }
      if (existing) {
        scene.remove(existing.sprite);
        existing.sprite.material.map.dispose();
        existing.sprite.material.dispose();
      }
      const free = t.seats - sitters;
      const style = myTable === t.n ? { background: "rgba(166,61,36,0.92)" }
        : free <= 0 ? { background: "rgba(95,91,85,0.85)" }
        : sitters ? { background: "rgba(45,74,62,0.92)" }
        : { background: "rgba(255,255,255,0.92)", color: "#222120" };
      const sprite = textSprite(text, { ...style, size: 36 });
      sprite.position.set(t.x, t.kind === "bar" ? 1.3 : t.kind === "low" ? 0.6 : t.kind === "plastic" ? 0.8 : 1.0, t.kind === "bar" ? t.z + 0.1 : t.z);
      sprite.material.depthTest = false;
      sprite.renderOrder = 5;
      sprite.renderOrder = myTable === t.n ? 6 : 5;
      sprite.userData.table = t.n;
      scene.add(sprite);
      tableLabels.set(t.n, { sprite, text });
    }
  }

  // people: [{ id, name, table, seat, x, z, ry, voice }]
  function sync(people, options = {}) {
    myId = options.myId ?? myId;
    const speaking = options.speaking || new Set();
    const seen = new Set();
    const occupancy = new Map();
    let myTable = null;
    for (const p of people) {
      seen.add(p.id);
      const isMe = p.id === myId;
      if (p.table != null && p.seat != null) {
        occupancy.set(p.table, (occupancy.get(p.table) || 0) + 1);
        if (isMe) {
          myTable = p.table;
        }
      }
      let a = avatars.get(p.id);
      if (!a || a.labelText !== p.name) {
        if (a) {
          avatarsGroup.remove(a.root);
          disposeTree(a.root);
        }
        a = makeAvatar(looksFor(p.name), p.name, isMe);
        a.isMe = isMe;
        a.snap = true;
        a.x = p.x ?? plan?.spawn.x ?? 0;
        a.z = p.z ?? plan?.spawn.z ?? 0;
        a.ry = p.ry ?? Math.PI;
        avatarsGroup.add(a.root);
        avatars.set(p.id, a);
      }
      a.voice = p.voice;
      a.speaking = speaking.has(p.id);
      const seat = p.table != null && p.seat != null ? seatOf(p.table, p.seat) : null;
      if (isMe) {
        const wasSeated = mySeat;
        mySeat = seat ? { table: p.table, seat: p.seat } : null;
        if (seat && (!wasSeated || wasSeated.table !== p.table || wasSeated.seat !== p.seat)) {
          // walk over: first to a spot just outside the seat, then onto it
          const outX = seat.x - Math.sin(seat.ry) * 0.75;
          const outZ = seat.z - Math.cos(seat.ry) * 0.75;
          me.path = [{ x: outX, z: outZ }, { x: seat.x, z: seat.z, ry: seat.ry, sit: seat.h }];
          a.sitH = null;
          cam.wantDist = Math.min(cam.wantDist, 7.5);
        } else if (!seat && wasSeated) {
          const s = seatOf(wasSeated.table, wasSeated.seat);
          if (s) {
            me.x = s.x - Math.sin(s.ry) * 0.7;
            me.z = s.z - Math.cos(s.ry) * 0.7;
          }
          me.path = [];
          a.sitH = null;
          moveDirty = true;
        }
      } else if (seat) {
        a.goal = { x: seat.x, z: seat.z, ry: seat.ry, sit: seat.h };
      } else {
        a.goal = { x: p.x ?? a.x, z: p.z ?? a.z, ry: p.ry ?? a.ry, sit: null };
      }
    }
    for (const [id, a] of avatars) {
      if (!seen.has(id)) {
        avatarsGroup.remove(a.root);
        disposeTree(a.root);
        avatars.delete(id);
      }
    }
    updateTableLabels(occupancy, myTable);
  }

  function say(id, text) {
    const a = avatars.get(id);
    if (!a) {
      return;
    }
    if (a.bubble) {
      a.root.remove(a.bubble);
      a.bubble.material.map.dispose();
      a.bubble.material.dispose();
    }
    a.bubble = bubbleSprite(text);
    a.bubble.position.y = 2.12;
    a.bubble.userData.lift = 0;
    a.root.add(a.bubble);
    a.bubbleUntil = performance.now() + 4000 + Math.min(6000, text.length * 80);
    // Stack older bubbles above the new one so a lively table stays readable; keep the 3 newest.
    const others = [...avatars.values()]
      .filter((other) => other !== a && other.bubble)
      .sort((x, y) => y.bubbleUntil - x.bubbleUntil);
    others.forEach((other, index) => {
      if (index >= 2) {
        other.bubbleUntil = 0;
      } else {
        other.bubble.userData.lift += a.bubble.scale.y + 0.05;
      }
    });
  }

  // ---------- my movement ----------

  function blocked(x, z) {
    if (!plan) {
      return { x, z };
    }
    const hw = plan.width / 2 - 0.35;
    const front = plan.depth / 2 - 0.3;
    const back = plan.backZ + (plan.layout === "counter" ? 1.75 : 1.5);
    x = Math.max(-hw, Math.min(hw, x));
    z = Math.max(back, Math.min(front, z));
    for (const t of plan.tables) {
      if (t.kind === "bar") {
        continue;
      }
      const hx = t.half.x + 0.25;
      const hz = t.half.z + 0.25;
      const dx = x - t.x;
      const dz = z - t.z;
      if (Math.abs(dx) < hx && Math.abs(dz) < hz) {
        const px = hx - Math.abs(dx);
        const pz = hz - Math.abs(dz);
        if (px < pz) {
          x = t.x + Math.sign(dx || 1) * hx;
        } else {
          z = t.z + Math.sign(dz || 1) * hz;
        }
      }
    }
    return { x, z };
  }

  function stepMe(dt, a) {
    let moving = false;
    if (mySeat) {
      keys.clear();
    }
    let ix = 0;
    let iz = 0;
    if (keys.has("f")) iz -= 1;
    if (keys.has("b")) iz += 1;
    if (keys.has("l")) ix -= 1;
    if (keys.has("r")) ix += 1;
    if ((ix || iz) && !mySeat) {
      me.path = [];
      const len = Math.hypot(ix, iz);
      const sin = Math.sin(cam.yaw);
      const cos = Math.cos(cam.yaw);
      const wx = (ix * cos + iz * sin) / len;
      const wz = (-ix * sin + iz * cos) / len;
      const next = blocked(me.x + wx * WALK_SPEED * dt, me.z + wz * WALK_SPEED * dt);
      me.x = next.x;
      me.z = next.z;
      me.ry = Math.atan2(wx, wz);
      moving = true;
      moveDirty = true;
    } else if (me.path.length) {
      const goal = me.path[0];
      const dx = goal.x - me.x;
      const dz = goal.z - me.z;
      const dist = Math.hypot(dx, dz);
      const step = WALK_SPEED * dt;
      if (dist <= step) {
        me.x = goal.x;
        me.z = goal.z;
        me.path.shift();
        if (goal.ry != null) {
          me.ry = goal.ry;
        }
        if (goal.sit != null) {
          a.sitH = goal.sit;
        }
      } else {
        const free = goal.sit != null || me.path.length > 1 || mySeat;
        const next = free ? { x: me.x + (dx / dist) * step, z: me.z + (dz / dist) * step } : blocked(me.x + (dx / dist) * step, me.z + (dz / dist) * step);
        if (!free && Math.hypot(next.x - me.x, next.z - me.z) < step * 0.2) {
          me.path = [];
        }
        me.x = next.x;
        me.z = next.z;
        me.ry = Math.atan2(dx, dz);
        moving = true;
      }
      if (!mySeat) {
        moveDirty = true;
      }
    }
    if (!mySeat) {
      a.sitH = null;
    }
    a.x = me.x;
    a.z = me.z;
    a.ry = me.ry;
    a.moving = moving;
    const now = performance.now();
    if (moveDirty && !mySeat && now - lastMoveSent > 180) {
      lastMoveSent = now;
      moveDirty = false;
      handlers.onMove?.({ x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2) });
    }
  }

  function stepOther(dt, a) {
    const goal = a.goal;
    if (!goal) {
      return;
    }
    if (a.snap) {
      a.x = goal.x;
      a.z = goal.z;
      a.ry = goal.ry;
      a.snap = false;
    }
    const dx = goal.x - a.x;
    const dz = goal.z - a.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * 1.15 * dt;
    if (dist > 6) {
      a.x = goal.x;
      a.z = goal.z;
      a.moving = false;
    } else if (dist > step) {
      a.x += (dx / dist) * step;
      a.z += (dz / dist) * step;
      a.ry = Math.atan2(dx, dz);
      a.moving = true;
    } else {
      a.x = goal.x;
      a.z = goal.z;
      a.ry = turn(a.ry, goal.ry, 0.2);
      a.moving = false;
    }
    a.sitH = !a.moving && goal.sit != null && dist < 0.05 ? goal.sit : null;
  }

  const turn = (from, to, k) => {
    let d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d * k;
  };

  // ---------- input ----------

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pointers = new Map();
  let drag = null;

  function pick(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const targets = [place, avatarsGroup, ...[...tableLabels.values()].map((l) => l.sprite)].filter(Boolean);
    const hits = raycaster.intersectObjects(targets, true);
    for (const hit of hits) {
      if (hit.object.userData.table != null) {
        return { table: hit.object.userData.table };
      }
      if (hit.object.userData.floor) {
        return { floor: hit.point };
      }
    }
    return null;
  }

  function tap(clientX, clientY) {
    const hit = pick(clientX, clientY);
    if (!hit) {
      return;
    }
    if (hit.table != null) {
      handlers.onTable?.(hit.table);
    } else if (hit.floor) {
      if (mySeat) {
        handlers.onFloorWhileSeated?.();
        return;
      }
      const target = blocked(hit.floor.x, hit.floor.z);
      me.path = [{ x: target.x, z: target.z }];
      marker.position.set(target.x, 0.03, target.z);
      marker.material.opacity = 0.9;
    }
  }

  canvas.addEventListener("pointerdown", (event) => {
    canvas.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      drag = { x: event.clientX, y: event.clientY, moved: false };
    } else {
      drag = null;
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const previous = pointers.get(event.pointerId);
    if (!previous) {
      return;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const before = Math.hypot(a.x - b.x, a.y - b.y);
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const [c, d] = [...pointers.values()];
      const after = Math.hypot(c.x - d.x, c.y - d.y);
      if (before > 0) {
        cam.wantDist = Math.max(4, Math.min(18, cam.wantDist * (before / after)));
      }
      return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (drag) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 6) {
        drag.moved = true;
      }
      if (drag.moved) {
        cam.yaw -= dx * 0.008;
        cam.pitch = Math.max(0.22, Math.min(1.3, cam.pitch + dy * 0.005));
      }
    }
  });
  const release = (event) => {
    const wasDrag = drag;
    pointers.delete(event.pointerId);
    if (event.type === "pointerup" && wasDrag && !wasDrag.moved && pointers.size === 0) {
      tap(event.clientX, event.clientY);
    }
    if (pointers.size === 0) {
      drag = null;
    }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    cam.wantDist = Math.max(4, Math.min(18, cam.wantDist * (1 + event.deltaY * 0.0012)));
  }, { passive: false });

  const KEYMAP = { w: "f", arrowup: "f", s: "b", arrowdown: "b", a: "l", arrowleft: "l", d: "r", arrowright: "r" };
  function typing(target) {
    return target && (target.isContentEditable || /^(input|textarea|select|button)$/i.test(target.tagName));
  }
  addEventListener("keydown", (event) => {
    const dir = KEYMAP[event.key.toLowerCase()];
    if (!dir || typing(event.target) || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (container.offsetParent === null) {
      return;
    }
    if (event.target === canvas || event.target === document.body) {
      event.preventDefault();
      if (mySeat) {
        handlers.onFloorWhileSeated?.();
        return;
      }
      keys.add(dir);
    }
  });
  addEventListener("keyup", (event) => {
    const dir = KEYMAP[event.key.toLowerCase()];
    if (dir) {
      keys.delete(dir);
    }
  });
  addEventListener("blur", () => keys.clear());

  // ---------- frame loop ----------

  // Keep name tags from sitting on top of each other: push the farther one up in screen space.
  const projected = new THREE.Vector3();
  function separateLabels() {
    const height = canvas.clientHeight || 1;
    const width = canvas.clientWidth || 1;
    const items = [];
    for (const a of avatars.values()) {
      const baseY = a.sitH != null ? a.sitH + 0.06 + 1.12 : 1.95;
      projected.set(a.x, baseY, a.z);
      const distance = camera.position.distanceTo(projected);
      const worldPerPixel = (2 * distance * Math.tan((camera.fov * Math.PI) / 360)) / height;
      projected.project(camera);
      items.push({
        a, baseY, worldPerPixel,
        x: ((projected.x + 1) / 2) * width,
        y: ((1 - projected.y) / 2) * height,
        w: a.label.scale.x / worldPerPixel,
        h: a.label.scale.y / worldPerPixel,
        depth: distance,
      });
    }
    items.sort((p, q) => p.depth - q.depth);
    const placed = [];
    for (const item of items) {
      let lift = 0;
      for (let guard = 0; guard < 6; guard++) {
        const top = item.y - lift;
        const hit = placed.find((o) => Math.abs(o.x - item.x) < (o.w + item.w) / 2 + 2 && Math.abs(o.top - top) < (o.h + item.h) / 2 + 1);
        if (!hit) {
          break;
        }
        lift = item.y - (hit.top - (hit.h + item.h) / 2 - 2);
      }
      placed.push({ x: item.x, top: item.y - lift, w: item.w, h: item.h });
      item.a.label.position.y = item.baseY + lift * item.worldPerPixel;
      if (item.a.bubble) {
        item.a.bubble.position.y = item.a.label.position.y + 0.17 + (item.a.bubble.userData.lift || 0);
      }
    }
  }

  const lookAt = new THREE.Vector3();
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, clock.getDelta());
    if (document.hidden || container.offsetParent === null || !plan) {
      return;
    }
    const t = clock.elapsedTime;
    const now = performance.now();
    for (const [id, a] of avatars) {
      if (id === myId) {
        stepMe(dt, a);
      } else {
        stepOther(dt, a);
      }
      a.root.position.set(a.x, 0, a.z);
      a.root.rotation.y = a.ry;
      if (a.sitH != null) {
        poseSitting(a, a.sitH, t, a.speaking);
      } else {
        poseStanding(a, t, a.moving);
      }
      a.ring.visible = a.isMe || a.voice;
      a.ring.material.color.set(a.voice ? VOICE : ACCENT);
      const pulse = a.speaking ? 1 + Math.sin(t * 9) * 0.18 : 1;
      a.ring.scale.set(pulse, pulse, pulse);
      a.label.position.y = (a.sitH != null ? a.sitH + 0.06 + 1.12 : 1.95);
      if (a.bubble) {
        a.bubble.position.y = a.label.position.y + 0.17 + (a.bubble.userData.lift || 0);
        if (now > a.bubbleUntil) {
          a.root.remove(a.bubble);
          a.bubble.material.map.dispose();
          a.bubble.material.dispose();
          a.bubble = null;
        }
      }
    }
    separateLabels();
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * 0.9);

    // Look a little ahead of me into the room, or at my table once I sit down.
    const mine = avatars.get(myId);
    const seatTable = mySeat ? plan.tables.find((x) => x.n === mySeat.table) : null;
    let focus;
    if (seatTable && seatTable.kind !== "bar") {
      focus = lookAt.set((seatTable.x + me.x) / 2, 0.8, (seatTable.z + me.z) / 2);
    } else if (mine) {
      const ahead = mine.sitH != null ? 0.4 : 1.6;
      focus = lookAt.set(mine.x - Math.sin(cam.yaw) * ahead, 0.9, mine.z - Math.cos(cam.yaw) * ahead);
    } else {
      focus = lookAt.set(0, 0.9, 0);
    }
    cam.target.lerp(focus, 0.12);
    cam.dist += (cam.wantDist - cam.dist) * 0.12;
    const horizontal = Math.cos(cam.pitch) * cam.dist;
    camera.position.set(
      cam.target.x + Math.sin(cam.yaw) * horizontal,
      cam.target.y + Math.sin(cam.pitch) * cam.dist,
      cam.target.z + Math.cos(cam.yaw) * horizontal,
    );
    camera.lookAt(cam.target);
    renderer.render(scene, camera);
    if (!readyFlag) {
      readyFlag = true;
      container.dataset.ready = "1";
      handlers.onReady?.();
    }
  }
  resize();
  requestAnimationFrame(frame);

  return {
    canvas,
    setVenue,
    sync,
    say,
    setHour(h) {
      hour = h;
      applyHour();
    },
    myPosition() {
      return { x: +me.x.toFixed(2), z: +me.z.toFixed(2), ry: +me.ry.toFixed(2) };
    },
    // For tests: where a table sits on screen, in client pixels.
    tableOnScreen(tableNo) {
      const table = plan?.tables.find((x) => x.n === tableNo);
      if (!table) {
        return null;
      }
      const v = new THREE.Vector3(table.x, table.kind === "bar" ? 1.0 : 0.76, table.z).project(camera);
      const rect = canvas.getBoundingClientRect();
      return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
    },
    info() {
      return {
        avatars: avatars.size,
        seated: [...avatars.values()].filter((a) => a.sitH != null).length,
        me: { ...me, path: me.path.length },
        tables: plan?.tables.length || 0,
        bubbles: [...avatars.values()].filter((a) => a.bubble).length,
        positions: Object.fromEntries([...avatars.entries()].map(([id, a]) => [a.labelText, { x: +a.x.toFixed(2), z: +a.z.toFixed(2), sitting: a.sitH != null }])),
        hour,
      };
    },
  };
}
