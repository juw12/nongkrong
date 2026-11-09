// The 3D place: a warung, kopitiam, angkringan, street stall, izakaya counter or beer garden
// built from simple shapes with three.js. You walk around as an avatar (tap the floor or use
// WASD / arrow keys), tap a table to walk over and sit, and see everyone else in the same
// place walking and sitting live. Chat bubbles only appear for people at your own table,
// because only they receive your messages.

import * as THREE from "./vendor/three.module.min.js";
import { themeFor } from "./themes.js";
import { drawLandmark, landmarkFor } from "./landmarks.js";
import { findCountry } from "./data.js";

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

function tableKind(layout, seats, index, variant = {}) {
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
  // a communal branch seats groups of four or more at long shared tables
  if (variant.communal && seats >= 4) {
    return "long";
  }
  return variant.square && seats <= 4 ? "square" : "round";
}

function seatRing(cx, cz, n, radius, offset) {
  return Array.from({ length: n }, (_, i) => {
    const angle = offset + (i * 2 * Math.PI) / n;
    const x = cx + radius * Math.cos(angle);
    const z = cz + radius * Math.sin(angle);
    return { x, z, ry: Math.atan2(cx - x, cz - z) };
  });
}

// variant (from the city branch): stagger shifts every other row sideways, square swaps small round tables,
// communal turns tables for four or more into long shared tables with benches
export function planVenue(layout, tables, variant = {}) {
  const hasBar = layout === "counter";
  const floorTables = hasBar ? tables.slice(1) : tables;
  const cols = floorTables.length <= 4 ? 2 : 3;
  const rows = Math.ceil(floorTables.length / cols);
  const cellW = layout === "bench" || layout === "garden" || variant.communal ? 3.9 : 3.4;
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
    const x = (col - (inRow - 1) / 2) * cellW + (row % 2 ? (variant.stagger || 0) * cellW : 0);
    const z = firstRowZ + row * cellD - cellD / 2;
    const kind = tableKind(layout, t.seats, hasBar ? i + 1 : i, variant);
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

function floorTexture(floor, width, depth) {
  const { kind, a } = floor;
  const b = floor.b;
  if (kind === "checker") {
    return canvasTexture(128, 128, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = b;
      c.fillRect(0, 0, 64, 64);
      c.fillRect(64, 64, 64, 64);
    }, [width / 1.2, depth / 1.2]);
  }
  if (kind === "terrazzo") {
    const specks = Array.isArray(b) ? b : ["#a99c86", "#8a5a3b", "#f4efe6", "#6d665c"];
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 900; i++) {
        c.fillStyle = specks[i % specks.length];
        c.fillRect((i * 97) % 256, (i * 57 + i * i) % 256, 2 + (i % 3), 2 + (i % 2));
      }
      c.strokeStyle = "rgba(90,80,70,.35)";
      c.strokeRect(0, 0, 256, 256);
    }, [width / 2, depth / 2]);
  }
  if (kind === "tile") {
    return canvasTexture(128, 128, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 128, 128);
      c.strokeStyle = b;
      c.lineWidth = 4;
      c.strokeRect(2, 2, 124, 124);
      c.fillStyle = b;
      c.globalAlpha = 0.18;
      c.fillRect(48, 48, 32, 32);
    }, [width / 0.7, depth / 0.7]);
  }
  if (kind === "wood") {
    return canvasTexture(256, 256, (c) => {
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? a : b;
        c.fillRect(i * 32, 0, 32, 256);
        c.fillStyle = "rgba(0,0,0,.18)";
        c.fillRect(i * 32, 0, 2, 256);
        c.fillRect(i * 32, (i * 71) % 256, 32, 2);
      }
    }, [width / 2.2, depth / 2.2]);
  }
  if (kind === "concrete" || kind === "asphalt" || kind === "sand") {
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1200; i++) {
        c.fillStyle = i % 2 ? "rgba(255,255,255,.07)" : "rgba(0,0,0,.08)";
        c.fillRect((i * 89) % 256, (i * 151 + i * 3) % 256, 2, 2);
      }
      if (kind === "concrete") {
        c.strokeStyle = "rgba(0,0,0,.16)";
        c.lineWidth = 2;
        c.strokeRect(0, 0, 256, 256);
      }
    }, [width / 3, depth / 3]);
  }
  if (kind === "grass") {
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 1400; i++) {
        c.fillStyle = i % 3 ? "rgba(0,0,0,.08)" : "rgba(255,255,255,.1)";
        c.fillRect((i * 73) % 256, (i * 131 + i * 7) % 256, 2, 4);
      }
    }, [width / 3, depth / 3]);
  }
  if (kind === "carpet") {
    return canvasTexture(256, 256, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 256, 256);
      c.strokeStyle = b;
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
          const x = i * 64 + 32;
          const y = j * 64 + 32;
          c.beginPath();
          c.moveTo(x, y - 20);
          c.lineTo(x + 20, y);
          c.lineTo(x, y + 20);
          c.lineTo(x - 20, y);
          c.closePath();
          c.stroke();
        }
      }
    }, [width / 2.5, depth / 2.5]);
  }
  if (kind === "tatami") {
    return canvasTexture(256, 128, (c) => {
      c.fillStyle = a;
      c.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 64; i++) {
        c.fillStyle = "rgba(0,0,0,.05)";
        c.fillRect(0, i * 2, 256, 1);
      }
      c.fillStyle = b;
      c.fillRect(0, 0, 256, 8);
      c.fillRect(0, 120, 256, 8);
      c.fillRect(126, 0, 4, 128);
    }, [width / 1.8, depth / 0.9]);
  }
  // paving stones
  return canvasTexture(128, 128, (c) => {
    c.fillStyle = a;
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = b || "#7f796f";
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

function bubbleSprite(text, name = "") {
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
  const nameSize = 26;
  const header = name ? nameSize + 10 : 0;
  context.font = `700 ${nameSize}px ${FONT}`;
  const nameWidth = name ? context.measureText(name).width : 0;
  context.font = `500 ${size}px ${FONT}`;
  const textWidth = Math.max(...lines.map((l) => context.measureText(l).width), nameWidth, 40);
  const width = Math.ceil(textWidth) + 44;
  const height = lines.length * (size + 8) + 30 + 18 + header;
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
  lines.forEach((l, i) => context.fillText(l, 22, 16 + header + i * (size + 8)));
  if (name) {
    context.font = `700 ${nameSize}px ${FONT}`;
    context.fillStyle = "#a63d24";
    context.fillText(name, 22, 16);
  }
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

function chair(seat, height, color, withBack, legColor = "#3b2a1e") {
  const group = new THREE.Group();
  group.add(cyl(0.2, 0.2, 0.05, color, 0, height, 0));
  for (const [lx, lz] of [[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) {
    group.add(cyl(0.018, 0.022, height, legColor, lx, height / 2, lz, 6));
  }
  if (withBack) {
    group.add(box(0.36, 0.3, 0.03, color, 0, height + 0.25, -0.19));
    group.add(cyl(0.015, 0.015, 0.3, legColor, 0.16, height + 0.12, -0.19, 6));
    group.add(cyl(0.015, 0.015, 0.3, legColor, -0.16, height + 0.12, -0.19, 6));
  }
  group.position.set(seat.x, 0, seat.z);
  group.rotation.y = seat.ry;
  return group;
}

function buildTable(t, theme) {
  const group = new THREE.Group();
  if (t.kind === "round") {
    group.add(cyl(t.r, t.r, 0.04, theme.top, t.x, 0.77, t.z, 32, { roughness: 0.35 }));
    group.add(cyl(t.r + 0.025, t.r + 0.025, 0.035, theme.wood, t.x, 0.735, t.z, 32));
    group.add(cyl(0.05, 0.05, 0.72, "#2a2a28", t.x, 0.36, t.z, 10));
    group.add(cyl(0.26, 0.3, 0.03, "#2a2a28", t.x, 0.015, t.z, 20));
    t.seatsPos.forEach((s) => group.add(chair(s, t.seatH, theme.chair, true, theme.wood)));
  } else if (t.kind === "long" || t.kind === "square") {
    const length = t.kind === "long" ? t.length : 0.8;
    const depth = t.kind === "long" ? 0.84 : 0.8;
    group.add(box(length, 0.05, depth, theme.top, t.x, 0.75, t.z));
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(box(0.06, 0.73, 0.06, theme.wood, t.x + lx * (length / 2 - 0.08), 0.365, t.z + lz * (depth / 2 - 0.08)));
    }
    if (t.kind === "long") {
      for (const side of [-1, 1]) {
        const bz = t.z + side * 0.78;
        group.add(box(length, 0.05, 0.32, theme.bench, t.x, t.seatH, bz));
        for (const lx of [-1, 1]) {
          group.add(box(0.05, t.seatH, 0.26, theme.wood, t.x + lx * (length / 2 - 0.1), t.seatH / 2, bz));
        }
      }
    } else {
      t.seatsPos.forEach((s) => group.add(chair(s, t.seatH, theme.bench, false, theme.wood)));
    }
  } else if (t.kind === "plastic" && theme.tableStyle === "bistro") {
    // small round cafe table with woven chairs, the European pavement kind
    group.add(cyl(0.36, 0.36, 0.03, theme.top === "#9a6b45" ? "#f1efe9" : theme.top, t.x, 0.74, t.z, 28, { roughness: 0.35 }));
    group.add(cyl(0.03, 0.03, 0.72, "#2a2a28", t.x, 0.36, t.z, 8));
    group.add(cyl(0.2, 0.22, 0.03, "#2a2a28", t.x, 0.015, t.z, 16));
    t.seatsPos.forEach((s) => group.add(chair(s, t.seatH, theme.chair, true, "#2a2a28")));
  } else if (t.kind === "plastic") {
    const low = theme.tableStyle === "low";
    const topY = low ? 0.4 : 0.55;
    const colors = theme.plastic;
    const color = colors[t.n % colors.length];
    group.add(box(low ? 0.6 : 0.72, 0.04, low ? 0.6 : 0.72, color, t.x, topY, t.z, { roughness: 0.5 }));
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(cyl(0.025, 0.03, topY - 0.01, color, t.x + lx * (low ? 0.24 : 0.3), (topY - 0.01) / 2, t.z + lz * (low ? 0.24 : 0.3), 8, { roughness: 0.5 }));
    }
    t.seatsPos.forEach((s, i) => {
      const stool = colors[(hash(t.n + ":" + i) >>> 3) % colors.length];
      group.add(cyl(0.16, 0.19, t.seatH, stool, s.x, t.seatH / 2, s.z, 14, { roughness: 0.5 }));
    });
  } else if (t.kind === "low") {
    const [c1, c2] = theme.cushions;
    const tikar = canvasTexture(128, 128, (c) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? "#c9a66b" : "#b88f52";
        c.fillRect(i * 8, 0, 8, 128);
      }
      c.fillStyle = c1;
      c.globalAlpha = 0.55;
      c.fillRect(0, 10, 128, 6);
      c.fillRect(0, 112, 128, 6);
    });
    const size = t.r * 2 + 1.5;
    if (theme.floor.kind !== "carpet" && theme.floor.kind !== "tatami") {
      const rug = mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tikar, roughness: 0.95 }), t.x, 0.012, t.z, false);
      rug.rotation.x = -Math.PI / 2;
      group.add(rug);
    }
    if (t.seats <= 4) {
      group.add(box(t.r * 2, 0.05, t.r * 2, theme.wood, t.x, 0.32, t.z));
    } else {
      group.add(cyl(t.r, t.r, 0.05, theme.wood, t.x, 0.32, t.z, 28));
    }
    for (const [lx, lz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      group.add(box(0.05, 0.3, 0.05, "#3b2a1e", t.x + lx * t.r * 0.6, 0.15, t.z + lz * t.r * 0.6));
    }
    t.seatsPos.forEach((s, i) => {
      const cushion = box(0.44, 0.07, 0.44, i % 2 ? c1 : c2, s.x, 0.04, s.z);
      cushion.rotation.y = s.ry;
      group.add(cushion);
    });
    group.add(cyl(0.05, 0.06, 0.12, "#f1efe9", t.x + 0.12, 0.41, t.z - 0.05, 12));
    group.add(cyl(0.05, 0.06, 0.12, "#f1efe9", t.x - 0.15, 0.41, t.z + 0.1, 12));
  } else if (t.kind === "bar") {
    const length = t.length + 0.8;
    group.add(box(length, 1.0, 0.7, theme.counterBody === "#8a5a3b" ? theme.wood : theme.counterBody, t.x, 0.5, t.z));
    group.add(box(length + 0.1, 0.05, 0.84, theme.top, t.x, 1.02, t.z + 0.05, { roughness: 0.35 }));
    for (let i = 0; i < Math.floor(length / 0.5); i++) {
      group.add(box(0.03, 0.9, 0.02, theme.trim, t.x - length / 2 + 0.25 + i * 0.5, 0.48, t.z + 0.36));
    }
    t.seatsPos.forEach((s) => {
      group.add(cyl(0.035, 0.035, t.seatH, "#2a2a28", s.x, t.seatH / 2, s.z, 8));
      group.add(cyl(0.2, 0.2, 0.05, theme.chair, s.x, t.seatH, s.z, 20));
      group.add(cyl(0.18, 0.2, 0.03, "#2a2a28", s.x, 0.015, s.z, 16));
    });
  }
  addTabletop(group, t, theme);
  group.traverse((node) => {
    node.userData.table = t.n;
  });
  return group;
}

const ASIAN = new Set(["warung", "angkringan", "kafeModern", "kopitiam", "mamak", "hawker", "streetfood", "caphe", "biahoi", "carinderia", "sarisari", "pocha", "nightmarket", "chaiStall", "dhaba", "buka", "suya"]);

// Cups, a condiment set, a plate of gorengan and a small jar lamp, so tables look used.
const TABLE_TOP = { round: 0.79, long: 0.775, square: 0.775, plastic: 0.57, low: 0.345, bar: 1.045 };
function addTabletop(group, t, theme) {
  const top = t.topY ?? TABLE_TOP[t.kind];
  const seed = hash("top" + t.n);
  const cups = t.kind === "bar" ? t.seatsPos.filter((_, i) => (seed >> i) & 1) : t.seatsPos.filter((_, i) => ((seed >> i) & 3) === 0).slice(0, 3);
  for (const s of cups) {
    const k = t.kind === "bar" ? 0.55 : 0.45;
    const cx = t.kind === "bar" ? s.x : s.x + (t.x - s.x) * k;
    const cz = t.kind === "bar" ? t.z + 0.2 : s.z + (t.z - s.z) * k;
    group.add(cyl(0.045, 0.038, 0.11, "#e8eef0", cx, top + 0.055, cz, 12, { transparent: true, opacity: 0.55, roughness: 0.1 }));
    group.add(cyl(0.04, 0.035, 0.07, t.kind === "low" ? "#c58b2a" : "#3b2416", cx, top + 0.04, cz, 12));
    for (let i = 0; i < 2; i++) {
      // own material per puff, since each one fades on its own
      const puff = mesh(new THREE.SphereGeometry(0.026, 10, 8), new THREE.MeshStandardMaterial({ color: "#f4f1ea", transparent: true, opacity: 0.3, depthWrite: false }), cx, top + 0.16, cz, false);
      puff.userData.steam = { y: top + 0.13, phase: (seed % 7) / 7 + i * 0.5 };
      group.add(puff);
    }
  }
  const asian = ASIAN.has(theme.archetype);
  if (t.kind !== "bar") {
    if (asian) {
      // condiment set: kecap bottle, sambal jar, toothpick pot
      group.add(cyl(0.025, 0.03, 0.16, "#2a1d16", t.x + 0.08, top + 0.08, t.z - 0.06, 10));
      group.add(cyl(0.035, 0.035, 0.07, "#a63d24", t.x - 0.02, top + 0.035, t.z - 0.1, 10));
      group.add(cyl(0.022, 0.022, 0.06, "#c9b48a", t.x - 0.1, top + 0.03, t.z - 0.04, 8));
    } else {
      // salt, pepper and a small vase
      group.add(cyl(0.02, 0.022, 0.08, "#f4f1ea", t.x + 0.08, top + 0.04, t.z - 0.06, 10));
      group.add(cyl(0.02, 0.022, 0.08, "#3b3a38", t.x + 0.13, top + 0.04, t.z - 0.06, 10));
      group.add(cyl(0.03, 0.04, 0.12, "#dfe9ea", t.x - 0.06, top + 0.06, t.z - 0.08, 10, { transparent: true, opacity: 0.6 }));
      group.add(ball(0.04, theme.trim, t.x - 0.06, top + 0.15, t.z - 0.08));
    }
    // jar lamp, glows at night
    const glass = cyl(0.05, 0.05, 0.1, "#fff3d6", t.x - 0.04, top + 0.05, t.z + 0.1, 12, { emissive: "#ffc46b", emissiveIntensity: 0.4, transparent: true, opacity: 0.9 });
    glass.castShadow = false;
    glass.userData.lamp = true;
    group.add(glass);
  }
  if (t.kind === "long" || t.kind === "square") {
    // a shared plate: gorengan in Asia, bread or chips elsewhere
    group.add(cyl(0.16, 0.13, 0.02, "#f1efe9", t.x + 0.32, top + 0.01, t.z + 0.05, 20));
    for (let i = 0; i < 4; i++) {
      const piece = box(0.09, 0.035, 0.05, asian ? (i % 2 ? "#c58b2a" : "#b5652e") : (i % 2 ? "#e2b46a" : "#d19a4a"), t.x + 0.28 + (i % 2) * 0.08, top + 0.035 + Math.floor(i / 2) * 0.02, t.z + 0.02 + Math.floor(i / 2) * 0.05);
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
  yatai: ["Ramen", "Oden", "Beer", "Sake"],
  pocha: ["Soju", "Tteokbokki", "Odeng", "Pajeon"],
  hof: ["Draft beer", "Fried chicken", "Pickled radish"],
  caphe: ["Ca phe sua da", "Ca phe den", "Tra da", "Bac xiu"],
  biahoi: ["Bia hoi", "Peanuts", "Nem chua"],
  teahouse: ["Oolong", "Jasmine", "Pu-erh", "Melon seeds"],
  nightmarket: ["Bubble tea", "Fried chicken", "Grilled squid"],
  tapri: ["Cutting chai", "Bun maska", "Parle-G"],
  irani: ["Irani chai", "Bun maska", "Kheema pav"],
  dhaba: ["Lassi", "Dal makhani", "Tandoori roti"],
  karak: ["Karak chai", "Chapati", "Paratha"],
  majlis: ["Gahwa", "Dates", "Luqaimat"],
  caybahcesi: ["Cay", "Simit", "Tavla"],
  kahvehane: ["Turkish coffee", "Cay", "Lokum"],
  meyhane: ["Raki", "Meze", "Fish"],
  ahwa: ["Shai", "Ahwa", "Shisha"],
  buka: ["Jollof", "Amala", "Zobo"],
  joint: ["Suya", "Chapman", "Plantain"],
  beergarden: ["Pint", "Cider", "Burger"],
  terrasse: ["Cafe creme", "Croissant", "Vin rouge"],
  bistro: ["Steak frites", "Croque", "Vin"],
  cave: ["Vin nature", "Fromage", "Charcuterie"],
  biergarten: ["Mass", "Brezel", "Radi"],
  kneipe: ["Pils", "Korn", "Bockwurst"],
  bar: ["Espresso", "Cornetto", "Spritz"],
  piazza: ["Aperol spritz", "Gelato", "Cappuccino"],
  enoteca: ["Vino", "Taglieri", "Bruschetta"],
  tapas: ["Cana", "Patatas bravas", "Jamon"],
  terraza: ["Tinto de verano", "Olives", "Calamares"],
  diner: ["Coffee", "Pancakes", "Pie", "Milkshake"],
  coffee: ["Latte", "Cold brew", "Muffin"],
  taqueria: ["Tacos al pastor", "Horchata", "Agua fresca"],
  cantina: ["Cerveza", "Botanas", "Mezcal"],
  boteco: ["Chopp", "Coxinha", "Pao de queijo"],
  padaria: ["Pingado", "Pao na chapa", "Pastel"],
  quiosque: ["Agua de coco", "Caipirinha", "Pastel"],
  carinderia: ["Adobo", "Sinigang", "Kanin", "Kape"],
  kapihan: ["Kapeng barako", "Pandesal", "Ensaymada"],
  sarisari: ["Kape", "Softdrinks", "Chicharon"],
  lounge: ["Mocktail", "Coffee", "Small plates"],
  nightowl: ["Coffee", "Tea", "Toast"],
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

function bunting(group, x0, x1, y, z, colors = ["#a63d24", "#2d4a3e", "#d9a62e", "#f4efe6"], gap = 0) {
  const count = Math.floor((x1 - x0) / 0.32);
  for (let i = 0; i < count; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / count);
    // leave the shop sign readable
    if (Math.abs(x) < gap) {
      continue;
    }
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

// The shop sign: the place's name, with the city underneath so a different city reads as a different place.
function signTexture(name, region, sign) {
  return canvasTexture(1024, 220, (c, w, h) => {
    c.fillStyle = sign.bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = sign.border || sign.fg;
    c.globalAlpha = 0.85;
    c.lineWidth = 6;
    c.strokeRect(14, 14, w - 28, h - 28);
    c.globalAlpha = 1;
    c.fillStyle = sign.fg;
    c.textAlign = "center";
    c.textBaseline = "middle";
    const face = sign.font === "sans" ? FONT : SERIF;
    const weight = sign.font === "sans" ? "600 " : "";
    let size = region ? 90 : 104;
    c.font = `${weight}${size}px ${face}`;
    while (c.measureText(name).width > w - 120 && size > 40) {
      size -= 6;
      c.font = `${weight}${size}px ${face}`;
    }
    c.fillText(name, w / 2, region ? h / 2 - 20 : h / 2 + 6);
    if (region) {
      c.font = `600 28px ${FONT}`;
      if ("letterSpacing" in c) {
        c.letterSpacing = "8px";
      }
      c.globalAlpha = 0.85;
      c.fillText(region.toUpperCase(), w / 2, h - 48);
    }
  });
}

// The street board: the city's landmark, its name and the country, so you know where you are.
function cityBoardTexture(city, countryName, seed, sign) {
  return canvasTexture(320, 440, (c, w, h) => {
    c.fillStyle = sign.bg;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = sign.fg;
    c.globalAlpha = 0.7;
    c.lineWidth = 4;
    c.strokeRect(12, 12, w - 24, h - 24);
    c.globalAlpha = 0.92;
    drawLandmark(c, landmarkFor(city), w / 2, h * 0.62, w - 70, h * 0.48, sign.fg, sign.bg, seed);
    c.fillStyle = sign.fg;
    c.fillRect(30, h * 0.62, w - 60, 4);
    c.globalAlpha = 1;
    c.textAlign = "center";
    c.textBaseline = "middle";
    let size = 46;
    c.font = `600 ${size}px ${FONT}`;
    const label = city.toUpperCase();
    while (c.measureText(label).width > w - 56 && size > 18) {
      size -= 2;
      c.font = `600 ${size}px ${FONT}`;
    }
    c.fillText(label, w / 2, h * 0.75);
    if (countryName) {
      c.globalAlpha = 0.8;
      let small = 22;
      c.font = `500 ${small}px ${FONT}`;
      while (c.measureText(countryName).width > w - 56 && small > 12) {
        small -= 1;
        c.font = `500 ${small}px ${FONT}`;
      }
      c.fillText(countryName, w / 2, h * 0.86);
    }
  });
}

// A framed print of the city's landmark on the back wall: the first thing that says which city this is.
function muralTexture(city, countryName, theme) {
  return canvasTexture(640, 352, (c, w, h) => {
    const paper = "#f3eee4";
    c.fillStyle = paper;
    c.fillRect(0, 0, w, h);
    // a warm sun behind the landmark, in the venue's sign colour
    c.globalAlpha = 0.22;
    c.fillStyle = theme.sign.bg;
    c.beginPath();
    c.arc(w * 0.68, h * 0.36, h * 0.24, 0, Math.PI * 2);
    c.fill();
    c.globalAlpha = 1;
    const ink = nudgeInk(theme.sign.bg);
    drawLandmark(c, landmarkFor(city), w * 0.5, h * 0.72, w * 0.84, h * 0.6, ink, paper, theme.seed);
    c.fillStyle = ink;
    c.fillRect(w * 0.06, h * 0.72, w * 0.88, 3);
    c.textAlign = "left";
    c.textBaseline = "middle";
    let size = 44;
    c.font = `700 ${size}px ${FONT}`;
    const label = city.toUpperCase();
    while (c.measureText(label).width > w * 0.6 && size > 20) {
      size -= 2;
      c.font = `700 ${size}px ${FONT}`;
    }
    c.fillText(label, w * 0.06, h * 0.85);
    if (countryName) {
      c.font = `500 24px ${FONT}`;
      c.textAlign = "right";
      c.globalAlpha = 0.75;
      c.fillText(countryName, w * 0.94, h * 0.86);
    }
  });
}

// Prints need a dark, readable ink even when the sign colour is pale.
function nudgeInk(hex) {
  const value = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(value)) {
    return "#2a2522";
  }
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (light < 0.45) {
    return hex;
  }
  const k = 0.45 / light;
  const part = (v) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

// Wall finishes: a branch fitted out in brick or timber boards reads differently from plaster.
function wallFinishTexture(kind, base, width, height) {
  if (kind === "brick") {
    return canvasTexture(256, 128, (c, w, h) => {
      c.fillStyle = "#d8cfc2";
      c.fillRect(0, 0, w, h);
      const rows = 8;
      const bh = h / rows;
      for (let row = 0; row < rows; row++) {
        const offset = row % 2 ? 32 : 0;
        for (let x = -64; x < w; x += 64) {
          const shade = ((row * 7 + x) % 5) * 0.03;
          c.fillStyle = shadeHex(base, -0.06 + shade);
          c.fillRect(x + offset + 2, row * bh + 2, 60, bh - 4);
        }
      }
    }, [width / 2.2, height / 1.1]);
  }
  // vertical timber boards
  return canvasTexture(128, 128, (c, w, h) => {
    c.fillStyle = base;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      c.fillStyle = shadeHex(base, (i % 3) * 0.025 - 0.03);
      c.fillRect(i * 16 + 1, 0, 14, h);
      c.fillStyle = "rgba(0,0,0,0.18)";
      c.fillRect(i * 16, 0, 1.5, h);
    }
  }, [width / 1.4, 1]);
}

function shadeHex(hex, amount) {
  const value = parseInt(String(hex).slice(1), 16);
  if (Number.isNaN(value)) {
    return hex;
  }
  const part = (v) => Math.max(0, Math.min(255, Math.round(v + amount * 255))).toString(16).padStart(2, "0");
  return `#${part((value >> 16) & 255)}${part((value >> 8) & 255)}${part(value & 255)}`;
}

function cityBoard(group, city, countryName, theme, x, z) {
  const board = new THREE.Group();
  const texture = cityBoardTexture(city, countryName, theme.seed, theme.sign);
  for (const side of [1, -1]) {
    const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.86), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.85 }));
    leaf.position.set(0, 0.5, side * 0.13);
    leaf.rotation.x = side * -0.28;
    if (side < 0) {
      leaf.rotation.y = Math.PI;
    }
    leaf.castShadow = true;
    board.add(leaf);
  }
  board.position.set(x, 0, z);
  board.scale.setScalar(1.25);
  board.rotation.y = x > 0 ? -0.45 : 0.45;
  group.add(board);
}

function stringLights(group, from, to, bulbs, lamps, color = "#ffcf7a", gap = 0) {
  const sag = 0.45;
  for (let i = 0; i <= bulbs; i++) {
    const k = i / bulbs;
    const x = from.x + (to.x - from.x) * k;
    if (Math.abs(x) < gap) {
      continue;
    }
    const z = from.z + (to.z - from.z) * k;
    const y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * sag;
    const bulb = ball(0.06, "#ffe2a8", x, y, z, { emissive: color, emissiveIntensity: 1.2 });
    bulb.castShadow = false;
    lamps.push(bulb);
    group.add(bulb);
  }
}

function glow(radius, color, x, y, z, lamps, scaleY = 1) {
  const bulb = ball(radius, "#fff1d0", x, y, z, { emissive: color, emissiveIntensity: 1.5 });
  bulb.scale.y = scaleY;
  bulb.castShadow = false;
  lamps.push(bulb);
  return bulb;
}

function stripes(colors, count = 8, vertical = true) {
  return canvasTexture(256, 64, (c, w, h) => {
    const n = count;
    for (let i = 0; i < n; i++) {
      c.fillStyle = colors[i % colors.length];
      if (vertical) {
        c.fillRect((i * w) / n, 0, w / n + 1, h);
      } else {
        c.fillRect(0, (i * h) / n, w, h / n + 1);
      }
    }
  });
}

// ---------- the back of the place: a wall, a shop front, shutters, a tent or a hedge ----------

function addBack(ctx) {
  const { group, theme, width, depth, backZ } = ctx;
  const back = theme.back;
  if (back === "beach") {
    const sea = mesh(new THREE.PlaneGeometry(width + 40, 30), mat("#3c8aa8", { roughness: 0.3 }), 0, 0.004, backZ - 15.2, false);
    sea.rotation.x = -Math.PI / 2;
    group.add(sea);
    return;
  }
  if (back === "hedge") {
    group.add(box(width + 0.4, 1.3, 0.6, "#4f6b3a", 0, 0.65, backZ - 0.2));
    for (let x = -width / 2; x <= width / 2; x += 0.9) {
      group.add(ball(0.42, x % 1.8 ? "#5f7d44" : "#46613a", x, 1.35, backZ - 0.2));
    }
    return;
  }
  const wallH = back === "tent" ? 2.6 : 3.2;
  if (back === "wall" && theme.wallFinish) {
    const finish = new THREE.MeshStandardMaterial({ map: wallFinishTexture(theme.wallFinish, theme.wallFinishColor || theme.wall, width, wallH), roughness: 0.92 });
    group.add(mesh(new THREE.BoxGeometry(width, wallH, 0.2), finish, 0, wallH / 2, backZ - 0.1));
  } else {
    group.add(box(width, wallH, 0.2, theme.wall, 0, wallH / 2, backZ - 0.1));
  }
  group.add(box(width, 0.9, 0.04, theme.trim, 0, 0.45, backZ + 0.02));
  if (back === "wall") {
    for (const side of [-1, 1]) {
      group.add(box(0.2, 1.0, depth, theme.wall, side * (width / 2 + 0.1), 0.5, 0));
      group.add(box(0.24, 0.08, depth, theme.trim, side * (width / 2 + 0.1), 1.02, 0));
      for (let z = backZ; z <= depth / 2 + 0.01; z += depth / 2) {
        group.add(box(0.3, 3.2, 0.3, theme.trim, side * (width / 2 + 0.1), 1.6, z));
      }
    }
  } else if (back === "shophouse") {
    for (let x = -width / 2 + 1.2; x < width / 2 - 0.8; x += 2.4) {
      group.add(box(1.4, 1.1, 0.06, "#6d7f86", x, 2.2, backZ + 0.02, { roughness: 0.4 }));
      group.add(box(1.5, 0.08, 0.1, "#f4efe6", x, 1.62, backZ + 0.05));
    }
  } else if (back === "shutter") {
    const shutter = canvasTexture(64, 128, (c, w, h) => {
      c.fillStyle = "#a9adb0";
      c.fillRect(0, 0, w, h);
      c.fillStyle = "#8d9194";
      for (let y = 0; y < h; y += 8) {
        c.fillRect(0, y, w, 3);
      }
    });
    for (const x of [-width / 2 + 1.6, width / 2 - 1.6]) {
      group.add(box(2.2, 1.5, 0.05, "#2a2826", x, 0.75 + 0.9, backZ + 0.03));
      const roll = mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ map: shutter, roughness: 0.6, metalness: 0.3 }), x, 2.65, backZ + 0.07, false);
      group.add(roll);
    }
  } else if (back === "tent") {
    for (const side of [-1, 1]) {
      const wall = box(0.05, 2.4, depth - 1.2, theme.wall, side * (width / 2 + 0.05), 1.2, 0.3, { transparent: true, opacity: 0.82 });
      wall.castShadow = false;
      group.add(wall);
    }
    for (const [x, z] of [[-width / 2, backZ], [width / 2, backZ], [-width / 2, depth / 2 - 0.3], [width / 2, depth / 2 - 0.3]]) {
      group.add(cyl(0.04, 0.04, 2.7, "#c9c4ba", x, 1.35, z, 8, { metalness: 0.5 }));
    }
  } else if (back === "shopfront") {
    for (const x of [-width / 2 + 1.5, width / 2 - 1.5]) {
      group.add(box(2.0, 1.6, 0.05, theme.trim, x, 1.55, backZ + 0.03));
      group.add(box(1.84, 1.44, 0.06, "#cfdde2", x, 1.55, backZ + 0.05, { roughness: 0.15, metalness: 0.2 }));
      group.add(box(0.04, 1.44, 0.08, theme.trim, x, 1.55, backZ + 0.07));
    }
  } else if (back === "truckart") {
    const art = canvasTexture(512, 128, (c, w, h) => {
      const colors = ["#c8432b", "#2f6fa3", "#e2b23b", "#3c8a5a", "#f4efe6"];
      for (let i = 0; i < 16; i++) {
        c.fillStyle = colors[i % colors.length];
        c.beginPath();
        c.moveTo(i * 32, h / 2);
        c.lineTo(i * 32 + 16, 8);
        c.lineTo(i * 32 + 32, h / 2);
        c.lineTo(i * 32 + 16, h - 8);
        c.closePath();
        c.fill();
      }
    });
    const band = mesh(new THREE.PlaneGeometry(width - 0.4, 0.7), new THREE.MeshStandardMaterial({ map: art, roughness: 0.8 }), 0, 1.35, backZ + 0.03, false);
    group.add(band);
  }
}

// ---------- the counter, cart, stall or bar where the owner works ----------

function counterBase(ctx, w, cz, top = "#f1efe9") {
  const { group, theme } = ctx;
  group.add(box(w, 1.0, 0.75, theme.counterBody, 0, 0.5, cz));
  group.add(box(w + 0.1, 0.05, 0.85, top, 0, 1.02, cz, { roughness: 0.35 }));
}

function shelvesOfJars(ctx, colors) {
  const { group, backZ, theme } = ctx;
  for (const y of [1.55, 2.0]) {
    group.add(box(2.6, 0.04, 0.26, theme.wood, 0, y, backZ + 0.15));
    for (let i = 0; i < 7; i++) {
      group.add(cyl(0.06, 0.06, 0.2, colors[(i + Math.round(y)) % colors.length], -1.1 + i * 0.36, y + 0.12, backZ + 0.15, 10));
    }
  }
}

function steam(group, x, y, z) {
  for (let i = 0; i < 3; i++) {
    const puff = ball(0.09 + i * 0.03, "#f4f1ea", x + Math.sin(i) * 0.04, y + i * 0.16, z, { transparent: true, opacity: 0.32 - i * 0.08 });
    puff.castShadow = false;
    group.add(puff);
  }
}

function addCounter(ctx) {
  const { group, theme, width, backZ, lamps } = ctx;
  const cz = backZ + 0.7;
  const kind = theme.counter;
  if (kind === "none") {
    return;
  }
  if (kind === "cart") {
    const cart = theme.cart || { body: "#8a5a3b", tarp: "#2d4a3e" };
    group.add(box(2.2, 0.85, 0.8, cart.body, 0, 0.75, cz));
    group.add(box(2.3, 0.05, 0.9, "#f1efe9", 0, 1.2, cz));
    for (const side of [-1, 1]) {
      group.add(mesh(new THREE.TorusGeometry(0.3, 0.06, 8, 20), mat("#2a2a28"), side * 0.8, 0.33, cz + 0.42));
      group.add(cyl(0.03, 0.03, 1.2, "#3b2a1e", side * 1.05, 1.8, cz + 0.35, 6));
    }
    const tarp = box(2.6, 0.05, 1.3, cart.tarp, 0, 2.42, cz + 0.2);
    tarp.rotation.x = 0.12;
    group.add(tarp);
    group.add(glow(0.13, "#ffb85c", 0.6, 1.95, cz + 0.4, lamps));
    for (let i = 0; i < 5; i++) {
      group.add(cyl(0.07, 0.07, 0.16, ["#d9a62e", "#a63d24", "#6f7f34"][i % 3], -0.8 + i * 0.32, 1.31, cz - 0.1, 10));
    }
    group.add(cyl(0.12, 0.1, 0.22, "#c9c4ba", 0.8, 1.34, cz, 14, { metalness: 0.5, roughness: 0.35 }));
    for (let i = 0; i < 6; i++) {
      const packet = box(0.13, 0.05, 0.1, i % 2 ? "#4f6b2a" : "#b08a5a", -0.95 + i * 0.17, 1.25, cz + 0.3);
      packet.rotation.y = (i % 3) * 0.2 - 0.2;
      group.add(packet);
    }
    group.add(cyl(0.1, 0.13, 0.17, "#3b3a38", -0.95, 1.31, cz - 0.15, 14, { metalness: 0.4, roughness: 0.5 }));
    const spout = cyl(0.018, 0.025, 0.16, "#3b3a38", -0.82, 1.36, cz - 0.15, 8);
    spout.rotation.z = -0.9;
    group.add(spout);
    return;
  }
  if (kind === "kiosk" || kind === "taps") {
    group.add(box(3.4, 1.05, 0.8, theme.counterBody, 0, 0.52, cz));
    group.add(box(3.5, 0.06, 0.9, theme.top, 0, 1.08, cz));
    for (const side of [-1, 1]) {
      group.add(box(0.12, 2.4, 0.12, theme.counterBody, side * 1.7, 1.2, cz + 0.5));
    }
    const thatch = theme.archetype === "quiosque";
    const roof = box(4.0, thatch ? 0.22 : 0.08, 1.8, thatch ? "#c9a066" : "#3b3a38", 0, 2.45, cz + 0.2);
    roof.rotation.x = 0.1;
    group.add(roof);
    if (kind === "taps") {
      group.add(box(0.9, 0.42, 0.14, "#c9c4ba", 0, 1.32, cz - 0.1, { metalness: 0.7, roughness: 0.25 }));
      ["#c8432b", "#e2b23b", "#2d4a3e", "#2f6fa3"].forEach((color, i) => {
        group.add(cyl(0.025, 0.025, 0.22, color, -0.3 + i * 0.2, 1.62, cz - 0.1, 8));
      });
      for (const x of [-1.9, -2.4]) {
        group.add(cyl(0.22, 0.22, 0.6, "#a9adb0", x, 0.3, cz + 0.1, 16, { metalness: 0.7, roughness: 0.3 }));
      }
      for (let i = 0; i < 6; i++) {
        group.add(cyl(0.045, 0.04, 0.16, "#e8b04a", 0.7 + i * 0.13, 1.19, cz, 10, { transparent: true, opacity: 0.8 }));
      }
    } else {
      for (let i = 0; i < 4; i++) {
        group.add(cyl(0.05, 0.05, 0.4, "#c9c4ba", -0.9 + i * 0.6, 1.3, cz - 0.15, 8, { metalness: 0.6, roughness: 0.3 }));
      }
      for (let i = 0; i < 5; i++) {
        group.add(ball(0.11, "#6f8f3a", 0.9 + (i % 3) * 0.22, 1.2 + Math.floor(i / 3) * 0.18, cz + 0.05));
      }
    }
    return;
  }
  if (kind === "stalls") {
    const colors = ["#c8432b", "#2f6fa3", "#e2b23b", "#3c8a5a"];
    const units = width > 9 ? 3 : 2;
    const span = (width - 1.2) / units;
    for (let i = 0; i < units; i++) {
      const x = -width / 2 + 0.6 + span * (i + 0.5);
      const w = span - 0.4;
      group.add(box(w, 1.0, 0.7, "#c9c4ba", x, 0.5, cz, { metalness: 0.3 }));
      group.add(box(w + 0.05, 0.04, 0.8, "#e9e6df", x, 1.02, cz));
      group.add(box(w, 0.42, 0.06, colors[i % colors.length], x, 2.35, backZ + 0.25));
      group.add(box(w - 0.3, 0.12, 0.07, "#f4efe6", x, 2.35, backZ + 0.27));
      for (const side of [-1, 1]) {
        group.add(cyl(0.03, 0.03, 2.2, "#5a5f63", x + side * (w / 2), 1.1, cz + 0.32, 6));
      }
      for (let k = 0; k < 3; k++) {
        group.add(cyl(0.16, 0.14, 0.2, "#c9c4ba", x - w / 3 + k * (w / 3), 1.14, cz - 0.05, 14, { metalness: 0.6, roughness: 0.3 }));
      }
      steam(group, x, 1.35, cz - 0.05);
    }
    return;
  }
  if (kind === "chai") {
    counterBase(ctx, 2.4, cz, theme.top);
    group.add(box(0.5, 0.12, 0.4, "#2a2a28", -0.5, 1.1, cz));
    group.add(glow(0.06, "#ff7a3a", -0.5, 1.17, cz, lamps));
    group.add(cyl(0.12, 0.15, 0.22, "#c9c4ba", -0.5, 1.3, cz, 14, { metalness: 0.6, roughness: 0.3 }));
    const spout = cyl(0.015, 0.025, 0.18, "#c9c4ba", -0.34, 1.34, cz, 8, { metalness: 0.6 });
    spout.rotation.z = -0.9;
    group.add(spout);
    steam(group, -0.5, 1.5, cz);
    for (let i = 0; i < 7; i++) {
      group.add(cyl(0.035, 0.03, 0.08, "#e8c27a", 0.1 + i * 0.12, 1.09, cz + 0.12, 10, { transparent: true, opacity: 0.85 }));
    }
    for (let i = 0; i < 3; i++) {
      group.add(cyl(0.1, 0.1, 0.24, "#dfe9ea", 0.3 + i * 0.26, 1.17, cz - 0.18, 14, { transparent: true, opacity: 0.6 }));
      group.add(cyl(0.09, 0.09, 0.12, "#c58b2a", 0.3 + i * 0.26, 1.11, cz - 0.18, 12));
    }
    return;
  }
  counterBase(ctx, 3.6, cz);
  if (kind === "espresso") {
    group.add(box(0.6, 0.45, 0.45, "#c9c4ba", -1.0, 1.27, cz - 0.1, { metalness: 0.6, roughness: 0.3 }));
    group.add(box(0.9, 0.36, 0.5, "#dfe9ea", 0.8, 1.23, cz, { transparent: true, opacity: 0.55, roughness: 0.1 }));
    group.add(cyl(0.12, 0.12, 0.06, "#c58b2a", 0.6, 1.1, cz, 16));
    group.add(cyl(0.12, 0.12, 0.06, theme.trim, 1.0, 1.1, cz, 16));
    for (const y of [1.6, 2.05]) {
      group.add(box(2.4, 0.04, 0.24, theme.wood, 0, y, backZ + 0.14));
      for (let i = 0; i < 8; i++) {
        group.add(cyl(0.05, 0.045, 0.09, i % 2 ? "#f4f1ea" : theme.trim, -1.0 + i * 0.28, y + 0.065, backZ + 0.14, 10));
      }
    }
  } else if (kind === "kopitiam") {
    for (let i = 0; i < 3; i++) {
      group.add(cyl(0.13, 0.16, 0.34, "#c9c4ba", -1.3 + i * 0.36, 1.21, cz - 0.1, 16, { metalness: 0.6, roughness: 0.3 }));
    }
    group.add(cyl(0.09, 0.02, 0.26, "#e9dcc0", -0.2, 1.3, cz - 0.1, 12));
    for (let i = 0; i < 6; i++) {
      group.add(cyl(0.06, 0.05, 0.08, "#f4f1ea", 0.3 + (i % 3) * 0.16, 1.09 + Math.floor(i / 3) * 0.09, cz + 0.1, 12));
    }
    group.add(box(0.36, 0.04, 0.2, "#d9a26a", 1.2, 1.07, cz));
    group.add(box(0.36, 0.02, 0.2, "#6f8f3a", 1.2, 1.1, cz));
    shelvesOfJars(ctx, ["#c8432b", "#e9c46a", "#1f3b2f"]);
  } else if (kind === "griddle") {
    group.add(box(1.4, 0.05, 0.6, "#2a2a28", -0.7, 1.07, cz, { metalness: 0.6, roughness: 0.4 }));
    for (let i = 0; i < 5; i++) {
      group.add(cyl(0.16, 0.16, 0.02, "#e2b46a", -1.1 + (i % 3) * 0.36, 1.1 + Math.floor(i / 3) * 0.02, cz - 0.05 + Math.floor(i / 3) * 0.2, 16));
    }
    for (let i = 0; i < 8; i++) {
      group.add(cyl(0.14, 0.12, 0.015, "#f4f1ea", 0.9, 1.06 + i * 0.016, cz, 18));
    }
    for (let i = 0; i < 4; i++) {
      group.add(ball(0.06, "#efdcb0", 0.3 + i * 0.14, 1.09, cz + 0.15));
    }
    shelvesOfJars(ctx, ["#1d6b3a", "#e2b23b", "#c8432b"]);
  } else if (kind === "grill") {
    group.add(box(1.6, 0.18, 0.5, "#2a2a28", -0.6, 1.13, cz, { metalness: 0.5 }));
    const coals = box(1.5, 0.03, 0.42, "#ff7a3a", -0.6, 1.2, cz, { emissive: "#ff5a1a", emissiveIntensity: 0.8 });
    coals.userData.lamp = true;
    group.add(coals);
    for (let i = 0; i < 10; i++) {
      group.add(box(0.03, 0.03, 0.46, i % 2 ? "#8a3a1a" : "#a8542a", -1.3 + i * 0.15, 1.24, cz));
    }
    steam(group, -0.9, 1.45, cz);
    steam(group, -0.3, 1.5, cz);
    for (let i = 0; i < 4; i++) {
      group.add(cyl(0.12, 0.1, 0.06, "#f4f1ea", 0.6 + i * 0.28, 1.08, cz, 16));
    }
  } else if (kind === "tea") {
    group.add(cyl(0.16, 0.2, 0.42, "#c9a050", -0.9, 1.25, cz - 0.1, 16, { metalness: 0.7, roughness: 0.25 }));
    group.add(cyl(0.1, 0.14, 0.16, "#c9a050", -0.9, 1.54, cz - 0.1, 16, { metalness: 0.7, roughness: 0.25 }));
    group.add(ball(0.11, theme.trim, -0.9, 1.68, cz - 0.1));
    for (let i = 0; i < 8; i++) {
      group.add(cyl(0.03, 0.025, 0.1, "#b8402a", -0.3 + i * 0.13, 1.1, cz + 0.12, 10, { transparent: true, opacity: 0.85 }));
    }
    for (const x of [0.9, 1.3]) {
      group.add(ball(0.12, "#e9dcc0", x, 1.15, cz - 0.05));
      const spout = cyl(0.015, 0.025, 0.14, "#e9dcc0", x + 0.13, 1.17, cz - 0.05, 8);
      spout.rotation.z = -1.0;
      group.add(spout);
    }
    shelvesOfJars(ctx, ["#5a3a26", "#c9a050", "#7a8a5a"]);
  } else if (kind === "bakery") {
    group.add(box(1.6, 0.42, 0.55, "#dfe9ea", 0.6, 1.26, cz, { transparent: true, opacity: 0.5, roughness: 0.1 }));
    for (let i = 0; i < 9; i++) {
      const bun = ball(0.07, i % 3 ? "#d19a4a" : "#b8783a", 0.05 + (i % 5) * 0.27, 1.12 + Math.floor(i / 5) * 0.16, cz - 0.05);
      bun.scale.set(1.3, 0.7, 1);
      group.add(bun);
    }
    group.add(box(0.5, 0.4, 0.4, "#c9c4ba", -1.1, 1.25, cz - 0.1, { metalness: 0.6, roughness: 0.3 }));
    shelvesOfJars(ctx, ["#d19a4a", "#f4f1ea", "#b8783a"]);
  } else if (kind === "wine") {
    addWineRack(ctx, 0, backZ + 0.15, 2.8);
    for (let i = 0; i < 5; i++) {
      group.add(cyl(0.035, 0.035, 0.28, "#2a1d16", -0.8 + i * 0.4, 1.19, cz - 0.1, 10));
    }
  } else if (kind === "noodle") {
    for (let i = 0; i < 3; i++) {
      group.add(cyl(0.2, 0.18, 0.3, "#c9c4ba", -1.0 + i * 0.6, 1.2, cz - 0.05, 16, { metalness: 0.6, roughness: 0.3 }));
      steam(group, -1.0 + i * 0.6, 1.45, cz - 0.05);
    }
  } else if (kind === "pots") {
    for (let i = 0; i < 5; i++) {
      const x = -1.4 + i * 0.7;
      group.add(cyl(0.22, 0.2, 0.26, "#c9c4ba", x, 1.18, cz - 0.05, 18, { metalness: 0.6, roughness: 0.3 }));
      group.add(cyl(0.23, 0.23, 0.03, "#a9adb0", x + 0.12, 1.33, cz - 0.05, 18, { metalness: 0.6 }));
    }
    shelvesOfJars(ctx, theme.posters);
  } else {
    // jars of snacks and a kettle: the warung counter
    for (let i = 0; i < 6; i++) {
      group.add(cyl(0.11, 0.11, 0.26, "#dfe9ea", -1.4 + i * 0.36, 1.18, cz, 14, { transparent: true, opacity: 0.6, roughness: 0.1 }));
      group.add(cyl(0.1, 0.1, 0.14, ["#d9a62e", "#a63d24", "#6f7f34", "#c58b2a"][i % 4], -1.4 + i * 0.36, 1.12, cz, 12));
    }
    group.add(cyl(0.14, 0.12, 0.24, "#c9c4ba", 1.3, 1.17, cz, 14, { metalness: 0.5, roughness: 0.35 }));
    if (theme.archetype === "warung") {
      for (const [i, x] of [2.25, 2.75].entries()) {
        group.add(box(0.42, 0.46, 0.42, "#c9c4ba", x, 0.23, cz + 0.05, { metalness: 0.45, roughness: 0.4 }));
        group.add(box(0.3, 0.26, 0.01, "#efe2c0", x, 0.26, cz + 0.265));
        group.add(box(0.44, 0.04, 0.44, i ? "#2f6fa3" : "#c8432b", x, 0.48, cz + 0.05));
      }
      group.add(cyl(0.012, 0.012, 3.0, "#3b3a38", 0, 2.42, backZ + 0.32, 6).rotateZ(Math.PI / 2));
      const sachetColors = ["#c8432b", "#d9a62e", "#2f6fa3", "#3b2416", "#2d4a3e"];
      for (const [s, x] of [-1.45, -1.3, -1.15, 1.15, 1.3, 1.45].entries()) {
        for (let k = 0; k < 5; k++) {
          group.add(box(0.12, 0.13, 0.008, sachetColors[(s + k) % sachetColors.length], x, 2.32 - k * 0.14, backZ + 0.33));
        }
      }
    }
    shelvesOfJars(ctx, ["#f1efe9", "#2d4a3e", "#c58b2a"]);
  }
}

function addWineRack(ctx, x, z, w) {
  const { group, theme } = ctx;
  group.add(box(w, 1.5, 0.3, theme.wood, x, 1.85, z));
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < Math.floor(w / 0.2); col++) {
      const bottle = cyl(0.04, 0.04, 0.26, (row + col) % 3 ? "#2a1d16" : "#3a4a2a", x - w / 2 + 0.12 + col * 0.2, 1.22 + row * 0.27, z + 0.12, 8);
      bottle.rotation.x = Math.PI / 2;
      group.add(bottle);
    }
  }
}

// Behind a bar counter: bottles, sake, beer taps, wine, pastries, noodle pots or coffee.
function addBackbar(ctx) {
  const { group, theme, plan, backZ, lamps } = ctx;
  const bar = plan.tables.find((t) => t.kind === "bar");
  const kind = theme.backbar;
  const barTop = 1.05;
  const bz = bar ? bar.z - 0.12 : backZ + 1;
  if (kind === "wine") {
    addWineRack(ctx, 0, backZ + 0.15, 3.0);
  } else if (kind === "pastry" || kind === "coffee") {
    for (const y of [1.6, 2.05]) {
      group.add(box(3.0, 0.04, 0.26, theme.wood, 0, y, backZ + 0.15));
      for (let i = 0; i < 9; i++) {
        if (kind === "pastry") {
          const bread = ball(0.08, i % 2 ? "#d19a4a" : "#b8783a", -1.2 + i * 0.3, y + 0.07, backZ + 0.15);
          bread.scale.set(1.4, 0.7, 1);
          group.add(bread);
        } else {
          group.add(cyl(0.05, 0.045, 0.09, i % 2 ? "#f4f1ea" : theme.trim, -1.2 + i * 0.3, y + 0.065, backZ + 0.15, 10));
        }
      }
    }
    if (bar) {
      if (kind === "pastry") {
        group.add(box(1.2, 0.36, 0.45, "#dfe9ea", bar.x + bar.length / 2 - 0.5, barTop + 0.18, bz, { transparent: true, opacity: 0.5, roughness: 0.1 }));
      } else {
        group.add(box(0.7, 0.45, 0.4, "#c9c4ba", bar.x - bar.length / 2 + 0.6, barTop + 0.22, bz, { metalness: 0.7, roughness: 0.25 }));
      }
    }
  } else if (kind === "noodle") {
    group.add(box(3.0, 0.9, 0.5, "#c9c4ba", 0, 0.45, backZ + 0.3, { metalness: 0.4 }));
    for (let i = 0; i < 3; i++) {
      group.add(cyl(0.22, 0.2, 0.32, "#a9adb0", -0.9 + i * 0.9, 1.06, backZ + 0.3, 16, { metalness: 0.6, roughness: 0.3 }));
      steam(group, -0.9 + i * 0.9, 1.32, backZ + 0.3);
    }
  } else if (kind === "sake") {
    for (const y of [1.5, 2.0]) {
      group.add(box(3.0, 0.04, 0.3, theme.wood, 0, y, backZ + 0.16));
      for (let i = 0; i < 9; i++) {
        group.add(cyl(0.07, 0.08, 0.32, i % 3 ? "#f1ece2" : "#5a3a26", -1.2 + i * 0.3, y + 0.18, backZ + 0.16, 12));
      }
    }
    group.add(box(0.5, 0.36, 0.36, "#d9c49a", 1.6, 0.18, backZ + 0.4));
  } else {
    // bottles on mirrored shelves (taps go on the bar)
    group.add(box(3.2, 1.3, 0.04, "#9fb3bc", 0, 1.85, backZ + 0.03, { metalness: 0.6, roughness: 0.15 }));
    for (const y of [1.35, 1.8, 2.25]) {
      group.add(box(3.0, 0.04, 0.24, theme.wood, 0, y, backZ + 0.14));
      for (let i = 0; i < 10; i++) {
        const tall = (i + y * 10) % 3 === 0;
        group.add(cyl(0.04, 0.045, tall ? 0.32 : 0.26, ["#3a4a2a", "#7a3a1a", "#d9c49a", "#2a1d16"][(i + Math.round(y * 3)) % 4], -1.35 + i * 0.3, y + (tall ? 0.18 : 0.15), backZ + 0.14, 10, { transparent: true, opacity: 0.9 }));
      }
    }
  }
  if (bar && kind === "taps") {
    group.add(box(0.9, 0.42, 0.14, "#c9a050", bar.x, barTop + 0.21, bz, { metalness: 0.8, roughness: 0.2 }));
    ["#c8432b", "#e2b23b", "#2d4a3e", "#f4efe6"].forEach((color, i) => {
      group.add(cyl(0.025, 0.025, 0.22, color, bar.x - 0.3 + i * 0.2, barTop + 0.53, bz, 8));
    });
  }
}

// ---------- lights ----------

function addLights(ctx) {
  const { group, theme, width, depth, backZ, plan, lamps } = ctx;
  const indoor = theme.back === "wall";
  const kind = theme.lights;
  const wallLamp = (x, y, z) => {
    group.add(box(0.05, 0.05, 0.22, "#2a2a28", x, y, z));
    group.add(glow(0.11, theme.lamp, x, y - 0.06, z + 0.14, lamps));
  };
  if (kind === "pendant") {
    const spots = plan.tables.filter((t) => t.kind !== "bar").map((t) => [t.x, t.z]);
    const bar = plan.tables.find((t) => t.kind === "bar");
    if (bar) {
      spots.push([bar.x - bar.length / 3, bar.z], [bar.x, bar.z], [bar.x + bar.length / 3, bar.z]);
    }
    for (const [x, z] of spots) {
      group.add(cyl(0.006, 0.006, 0.9, "#2a2a28", x, 2.75, z, 4));
      const shade = mesh(new THREE.ConeGeometry(0.2, 0.18, 18, 1, true), mat(theme.trim, { side: THREE.DoubleSide }), x, 2.25, z, false);
      group.add(shade);
      group.add(glow(0.07, theme.lamp, x, 2.18, z, lamps));
    }
  } else if (kind === "fluor") {
    for (const x of [-width / 4, width / 4]) {
      const wallTube = box(1.4, 0.06, 0.06, "#f4fbff", x, 3.0, backZ + 0.08, { emissive: "#eaf6ff", emissiveIntensity: 1.2 });
      lamps.push(wallTube);
      group.add(wallTube);
    }
    for (const t of plan.tables.filter((tt) => tt.kind !== "bar")) {
      const tube = box(1.1, 0.05, 0.08, "#f4fbff", t.x, 2.9, t.z, { emissive: "#eaf6ff", emissiveIntensity: 1.2 });
      tube.castShadow = false;
      lamps.push(tube);
      group.add(tube);
      group.add(cyl(0.005, 0.005, 0.4, "#2a2a28", t.x - 0.4, 3.1, t.z, 4));
      group.add(cyl(0.005, 0.005, 0.4, "#2a2a28", t.x + 0.4, 3.1, t.z, 4));
    }
  } else if (kind === "chochin") {
    for (let i = 0; i < 7; i++) {
      const x = -width / 2 + 0.8 + i * ((width - 1.6) / 6);
      group.add(glow(0.17, "#ff7a4a", x, 2.55, backZ + 0.45, lamps, 1.35));
      group.add(cyl(0.09, 0.09, 0.05, "#2a2a28", x, 2.8, backZ + 0.45, 10));
      group.add(cyl(0.09, 0.09, 0.05, "#2a2a28", x, 2.31, backZ + 0.45, 10));
      lamps[lamps.length - 1].material = mat(i % 2 ? "#c8432b" : "#f4efe6", { emissive: "#ff8a4a", emissiveIntensity: 1.2 });
    }
  } else if (kind === "dim") {
    for (const x of [-width / 2 + 0.9, -width / 6, width / 6, width / 2 - 0.9]) {
      wallLamp(x, 2.1, backZ + 0.1);
    }
    for (const t of plan.tables.filter((tt) => tt.kind !== "bar")) {
      const top = t.topY ?? TABLE_TOP[t.kind];
      group.add(glow(0.03, "#ffb35a", t.x + 0.05, top + 0.08, t.z + 0.04, lamps, 1.6));
    }
  } else if (kind === "bulbs" || indoor) {
    for (const x of [-width / 2 + 0.9, width / 2 - 0.9]) {
      wallLamp(x, 2.35, backZ + 0.1);
    }
    stringLights(group, { x: -width / 2 + 0.2, y: 3.05, z: backZ + 0.15 }, { x: width / 2 - 0.2, y: 3.05, z: backZ + 0.15 }, 18, lamps, theme.lamp, 2.25);
  }
  if (kind === "string" && !indoor) {
    const h = 2.7;
    const corners = [
      { x: -width / 2, y: h, z: -depth / 2 + 1.6 }, { x: width / 2, y: h, z: -depth / 2 + 1.6 },
      { x: width / 2, y: h, z: depth / 2 - 0.4 }, { x: -width / 2, y: h, z: depth / 2 - 0.4 },
    ];
    corners.forEach((p) => group.add(cyl(0.05, 0.06, h, "#3b3a38", p.x, h / 2, p.z, 8)));
    stringLights(group, corners[0], corners[1], 16, lamps, theme.lamp);
    stringLights(group, corners[0], corners[3], 16, lamps, theme.lamp);
    stringLights(group, corners[1], corners[2], 16, lamps, theme.lamp);
  }
}

// ---------- small things that make a place recognisable ----------

function addDeco(ctx) {
  const { group, theme, width, depth, backZ, plan, lamps } = ctx;
  const wall = theme.back !== "hedge" && theme.back !== "beach";
  const has = (name) => theme.deco.includes(name);
  const shift = ctx.artShift || 0;
  const leftX = -width / 2 + 1.5 + shift;
  // the sign spans x = -2.1..2.1 above the counter; left wall art must stay clear of it
  const clearOfSign = (x, half) => !shift || x + half < -2.25;
  if (has("bunting")) {
    bunting(group, -width / 2 + 0.3, width / 2 - 0.3, 3.15, backZ + 0.25, theme.bunting, wall ? 2.25 : 0);
  }
  if (has("posters") && wall) {
    theme.posters.forEach((color, i) => {
      const x = shift ? -width / 2 + shift + 0.3 + i * 0.6 : leftX - 0.55 + i * 0.6;
      if (!clearOfSign(x, 0.24)) {
        return;
      }
      group.add(box(0.48, 0.66, 0.02, "#f4efe6", x, 1.85, backZ + 0.03));
      group.add(box(0.4, 0.4, 0.025, color, x, 1.92, backZ + 0.04));
      group.add(box(0.3, 0.05, 0.025, "#2a2a28", x, 1.64, backZ + 0.04));
    });
  }
  if (has("tv") && wall) {
    group.add(box(0.95, 0.58, 0.07, "#1d1d1b", width / 2 - 2.6, 2.45, backZ + 0.06));
    group.add(box(0.86, 0.5, 0.01, "#3a6a8a", width / 2 - 2.6, 2.45, backZ + 0.1, { emissive: "#4a8ab0", emissiveIntensity: 0.45 }));
  }
  if (has("fans")) {
    for (const x of [-width / 2 + 0.9, width / 2 - 0.9]) {
      const fan = new THREE.Group();
      fan.add(cyl(0.05, 0.05, 0.2, "#e9e6df", 0, 0, 0.1, 10).rotateX(Math.PI / 2));
      for (let i = 0; i < 3; i++) {
        const blade = box(0.08, 0.26, 0.01, "#c9d6dc", 0, 0.13, 0.21);
        const pivot = new THREE.Group();
        pivot.add(blade);
        pivot.rotation.z = (i * Math.PI * 2) / 3;
        fan.add(pivot);
      }
      fan.add(mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 24), mat("#8d9194"), 0, 0, 0.2));
      fan.position.set(x, shift && x < 0 ? 2.82 : 2.6, backZ + 0.05);
      group.add(fan);
    }
  }
  if (has("clock") && wall && clearOfSign(leftX + 1.2, 0.25)) {
    const face = cyl(0.2, 0.2, 0.04, "#f4f1ea", leftX + 1.2, 2.45, backZ + 0.04, 24);
    face.rotation.x = Math.PI / 2;
    group.add(face);
    group.add(mesh(new THREE.TorusGeometry(0.2, 0.025, 8, 24), mat("#2a2a28"), leftX + 1.2, 2.45, backZ + 0.06));
    group.add(box(0.02, 0.13, 0.01, "#2a2a28", leftX + 1.2, 2.5, backZ + 0.07));
    const hand = box(0.02, 0.1, 0.01, "#2a2a28", leftX + 1.24, 2.43, backZ + 0.07);
    hand.rotation.z = -1.1;
    group.add(hand);
  }
  if (has("frames") && wall) {
    const colors = [theme.trim, "#c58b2a", "#6f7f34", "#3d6b8c"];
    [-width / 2 + 0.9 + shift, -width / 2 + 1.7 + shift, width / 2 - 2.4].filter((x) => x > 0 || clearOfSign(x, 0.3)).forEach((x, i) => {
      group.add(box(0.56, 0.44, 0.03, "#2a1d16", x, 1.95 + (i % 2) * 0.12, backZ + 0.03));
      group.add(box(0.46, 0.34, 0.035, colors[i % colors.length], x, 1.95 + (i % 2) * 0.12, backZ + 0.04));
    });
  }
  if (has("mirrors") && wall) {
    for (const x of [-width / 2 + 1.2 + shift, width / 2 - 2.4].filter((v) => v > 0 || clearOfSign(v, 0.45))) {
      group.add(box(0.9, 1.2, 0.03, "#c9a050", x, 1.85, backZ + 0.03, { metalness: 0.6 }));
      group.add(box(0.8, 1.1, 0.035, "#cfd8dc", x, 1.85, backZ + 0.045, { metalness: 0.8, roughness: 0.1 }));
    }
  }
  if (theme.wainscot && wall) {
    // lower panel along the back wall with a thin rail on top
    group.add(box(width, 1.05, 0.03, theme.wainscot, 0, 0.525, backZ + 0.02));
    group.add(box(width, 0.05, 0.06, theme.wainscotRail || theme.trim, 0, 1.07, backZ + 0.03));
  }
  if (has("slats") && wall) {
    for (let i = 0; i < 12; i++) {
      const x = -width / 2 + 0.5 + shift + i * 0.16;
      if (clearOfSign(x, 0.04)) {
        group.add(box(0.07, 2.2, 0.05, "#b8956a", x, 1.1 + 0.9, backZ + 0.04));
      }
    }
  }
  if (has("lattice") && wall) {
    const x0 = width / 2 - 2.9;
    for (let i = 0; i <= 6; i++) {
      group.add(box(0.03, 1.2, 0.03, theme.trim, x0 + i * 0.2, 1.95, backZ + 0.04));
      group.add(box(1.2, 0.03, 0.03, theme.trim, x0 + 0.6, 1.35 + i * 0.2, backZ + 0.04));
    }
  }
  if (has("tiles") && wall) {
    const tiles = canvasTexture(256, 64, (c, w, h) => {
      c.fillStyle = "#f4f1ea";
      c.fillRect(0, 0, w, h);
      c.strokeStyle = "#2f5f9a";
      c.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        c.strokeRect(i * 64 + 4, 4, 56, 56);
        c.beginPath();
        c.arc(i * 64 + 32, 32, 16, 0, Math.PI * 2);
        c.stroke();
      }
    }, [width / 1.6, 1]);
    group.add(mesh(new THREE.PlaneGeometry(width, 0.45), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.4 }), 0, 1.15, backZ + 0.03, false));
  }
  if (has("awning") && wall) {
    const awning = mesh(new THREE.BoxGeometry(width - 0.6, 0.04, 1.1), new THREE.MeshStandardMaterial({ map: stripes(theme.awning, 18), roughness: 0.8 }), 0, 3.05, backZ + 0.55, false);
    awning.rotation.x = 0.32;
    group.add(awning);
  }
  if (has("neon") && wall) {
    const x = width / 2 - 2.4;
    const y = 2.45;
    const tube = (w, h, px, py) => {
      const piece = box(w, h, 0.03, theme.neon, px, py, backZ + 0.06, { emissive: theme.neon, emissiveIntensity: 1.4 });
      piece.castShadow = false;
      lamps.push(piece);
      group.add(piece);
    };
    tube(0.9, 0.035, x, y + 0.25);
    tube(0.9, 0.035, x, y - 0.25);
    tube(0.035, 0.5, x - 0.45, y);
    tube(0.035, 0.5, x + 0.45, y);
    group.add(glow(0.08, theme.neon, x - 0.15, y, backZ + 0.07, lamps));
    group.add(glow(0.08, theme.neon, x + 0.15, y, backZ + 0.07, lamps));
  }
  if (has("noren")) {
    const bar = plan.tables.find((t) => t.kind === "bar");
    const span = bar ? bar.length : 3.2;
    const z = bar ? bar.z - 0.42 : backZ + 1.2;
    const count = Math.max(3, Math.floor(span / 0.5));
    group.add(cyl(0.015, 0.015, span + 0.3, "#3b2416", 0, 2.4, z, 6).rotateZ(Math.PI / 2));
    for (let i = 0; i < count; i++) {
      const x = -span / 2 + (i + 0.5) * (span / count);
      const cloth = mesh(new THREE.PlaneGeometry(span / count - 0.04, 0.55), mat(theme.noren, { side: THREE.DoubleSide }), x, 2.1, z, false);
      group.add(cloth);
      if (i === Math.floor(count / 2)) {
        group.add(mesh(new THREE.CircleGeometry(0.08, 20), mat("#f4efe6", { side: THREE.DoubleSide }), x, 2.12, z + 0.01, false));
      }
    }
  }
  if (has("lanterns")) {
    for (let i = 0; i < 6; i++) {
      const x = -width / 2 + 1 + i * ((width - 2) / 5);
      group.add(cyl(0.004, 0.004, 0.35, "#2a2a28", x, 2.85, backZ + 1.1, 4));
      group.add(glow(0.15, theme.lanterns, x, 2.55, backZ + 1.1, lamps, 1.25));
    }
  }
  if (has("trees")) {
    const spots = [[-width / 2 - 0.4, backZ + 0.8], [width / 2 + 0.4, backZ + 0.8], [-width / 2 - 0.5, depth / 2 - 1], [width / 2 + 0.5, depth / 2 - 1]];
    for (const [x, z] of spots) {
      const palm = theme.archetype === "quiosque";
      group.add(cyl(0.12, 0.16, palm ? 3.4 : 2.4, "#6b4428", x, palm ? 1.7 : 1.2, z, 10));
      if (palm) {
        for (let i = 0; i < 6; i++) {
          const leaf = box(1.3, 0.03, 0.26, "#4f7a3a", x + Math.cos(i) * 0.5, 3.35, z + Math.sin(i) * 0.5);
          leaf.rotation.y = i;
          leaf.rotation.z = -0.35;
          group.add(leaf);
        }
      } else {
        group.add(ball(0.9, "#4f6b3a", x, 2.8, z));
        group.add(ball(0.7, "#5f7d44", x + 0.5, 2.5, z + 0.2));
        group.add(ball(0.6, "#46613a", x - 0.45, 2.6, z - 0.2));
      }
    }
  }
  if (has("umbrellas")) {
    plan.tables.filter((t) => t.kind !== "bar" && t.kind !== "low").forEach((t, i) => {
      group.add(cyl(0.025, 0.025, 2.4, "#e9e6df", t.x, 1.2, t.z, 6));
      const canopy = mesh(new THREE.ConeGeometry(1.15, 0.42, 8, 1, true), new THREE.MeshStandardMaterial({ map: stripes(theme.umbrellas, 8), side: THREE.DoubleSide, roughness: 0.8 }), t.x, 2.45, t.z, false);
      canopy.rotation.y = i * 0.4;
      group.add(canopy);
    });
  }
  if (has("plants")) {
    // which corners get a plant depends on the city, so two branches of one cafe differ
    const corners = [
      [-width / 2 + 0.5, depth / 2 - 0.5, 1],
      [width / 2 - 0.5, depth / 2 - 0.5, 1],
      [-width / 2 + 0.5, backZ + 1.6, 0.85],
      [width / 2 - 0.5, backZ + 1.6, 0.85],
    ];
    const keep = theme.seed ? (theme.seed >>> 17) % 4 : -1;
    corners.forEach(([x, z, scale], i) => {
      if (i !== keep) {
        group.add(plant(x, z, scale));
      }
    });
  }
}

function buildPlace(plan, venue, theme, regionName, countryName = "") {
  const group = new THREE.Group();
  const lamps = [];
  const { width, depth, backZ, layout } = plan;
  const ctx = { group, lamps, theme, plan, width, depth, backZ, artShift: 0 };
  // a print of the city's landmark at the left of the back wall; wall art moves along to make room
  if (regionName && theme.back === "wall") {
    const muralW = Math.min(3.0, width / 2 - 2.6);
    if (muralW >= 1.4) {
      const muralH = muralW * 0.55;
      const muralX = -width / 2 + 0.3 + muralW / 2;
      const muralY = 1.78;
      group.add(box(muralW + 0.1, muralH + 0.1, 0.04, "#2a211b", muralX, muralY, backZ + 0.03));
      const print = new THREE.Mesh(new THREE.PlaneGeometry(muralW, muralH), new THREE.MeshStandardMaterial({ map: muralTexture(regionName, countryName, theme), roughness: 0.85 }));
      print.position.set(muralX, muralY, backZ + 0.056);
      group.add(print);
      ctx.muralMesh = print;
      ctx.artShift = muralW + 0.45;
      ctx.mural = { x: muralX, y: muralY, w: muralW, h: muralH };
    }
  }

  const ground = mesh(new THREE.PlaneGeometry(width + 40, depth + 40), mat(theme.ground), 0, -0.01, 0, false);
  ground.rotation.x = -Math.PI / 2;
  ground.userData.floor = true;
  group.add(ground);
  const floor = mesh(new THREE.PlaneGeometry(width, depth), new THREE.MeshStandardMaterial({ map: floorTexture(theme.floor, width, depth), roughness: 0.9 }), 0, 0, 0, false);
  floor.rotation.x = -Math.PI / 2;
  floor.userData.floor = true;
  group.add(floor);

  addBack(ctx);

  // the sign: on the wall, or on two posts when the place has no wall
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 0.9), new THREE.MeshStandardMaterial({ map: signTexture(venue.name, regionName, theme.sign), roughness: 0.7 }));
  const freeStanding = theme.back === "hedge" || theme.back === "beach";
  sign.position.set(0, freeStanding ? 2.95 : 2.75, backZ + (freeStanding ? 0.05 : 0.03));
  group.add(sign);
  if (freeStanding) {
    for (const side of [-1, 1]) {
      group.add(cyl(0.05, 0.05, 3.4, "#3b3a38", side * 2.15, 1.7, backZ + 0.02, 8));
    }
  }
  const menu = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.12), new THREE.MeshStandardMaterial({ map: menuTexture(venue), roughness: 0.9 }));
  menu.position.set(width / 2 - 1.15, freeStanding ? 1.0 : 1.75, backZ + (freeStanding ? 0.7 : 0.03));
  group.add(menu);
  if (regionName) {
    const side = theme.mirror ? 1 : -1;
    cityBoard(group, regionName, countryName, theme, side * (width / 2 - 1.5), depth / 2 - 1.5);
  }

  if (layout === "counter") {
    addBackbar(ctx);
  } else {
    addCounter(ctx);
  }
  addLights(ctx);
  addDeco(ctx);

  for (const t of plan.tables) {
    group.add(buildTable(t, theme));
  }
  group.traverse((node) => {
    if (node.userData.lamp && !lamps.includes(node)) {
      lamps.push(node);
    }
  });

  // the owner minds the counter: not a player, so a small light "Owner" tag says who they are
  const ownerLooks = { skin: "#b98a68", shirt: theme.shirt, pants: "#3b3a38", hair: "#222120" };
  const owner = makeAvatar(ownerLooks, "", false);
  owner.root.remove(owner.label);
  owner.label.material.map?.dispose();
  const ownerTag = textSprite("Owner", { color: "#3b3a38", background: "rgba(246,242,234,0.92)", size: 34, weight: 600 });
  ownerTag.position.y = 1.95;
  owner.root.add(ownerTag);
  poseStanding(owner, 0, false);
  owner.arms[0].rotation.x = -0.5;
  if (layout === "counter") {
    owner.root.position.set(-1.2, 0, backZ + 0.45);
  } else {
    const halfCounter = theme.counter === "cart" ? 1.1 : theme.counter === "chai" ? 1.2 : theme.counter === "kiosk" || theme.counter === "taps" ? 1.7 : theme.counter === "stalls" ? width / 2 - 1.2 : 1.8;
    owner.root.position.set(-(halfCounter + 0.45), 0, backZ + 0.75);
    owner.root.rotation.y = 0.35;
  }
  group.add(owner.root);

  // two people walk past outside, so the street around the place is alive (no tags, not players)
  const walkers = [];
  const shirts = ["#2d4a3e", "#8a5a3b", "#3d5a80", "#c58b2a"];
  for (const side of [-1, 1]) {
    const looks = { skin: side < 0 ? "#c69a74" : "#8d5f43", shirt: shirts[((theme.seed || 3) + side + 2) % shirts.length], pants: "#3b3a38", hair: "#222120" };
    const walker = makeAvatar(looks, "", false);
    walker.root.remove(walker.label);
    walker.label.material.map?.dispose();
    walker.path = { x: side * (width / 2 + 1.4), from: backZ + 1, to: depth / 2 + 1, speed: 0.55 + (side > 0 ? 0.12 : 0), offset: side > 0 ? 0.5 : 0 };
    group.add(walker.root);
    walkers.push(walker);
  }
  const steamPuffs = [];
  group.traverse((node) => {
    if (node.userData.steam) {
      steamPuffs.push(node);
    }
  });
  return { group, lamps, walkers, steamPuffs, owner: { root: owner.root, tag: ownerTag }, keepOut: [sign, ...(ctx.muralMesh ? [ctx.muralMesh] : [])] };
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
  const stem = new THREE.Sprite(new THREE.SpriteMaterial({ color: "#222120", transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  stem.center.set(0.5, 0);
  stem.renderOrder = 9;
  stem.visible = false;
  root.add(stem);

  return { root, hips, legs, arms, head, ring, label, stem, labelText: name, bubble: null, bubbleUntil: 0 };
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
  let theme = null;
  let walkers = [];
  let tagRects = [];
  let labelRects = [];
  let keepOutMeshes = [];
  let ownerInfo = null;
  let steamPuffs = [];
  let scene_ = null;

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
  const cam = { yaw: 0, pitch: 0.6, dist: 10.5, target: new THREE.Vector3(), wantDist: 10.5 };
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
    const dimIndoor = theme && theme.lights === "dim";
    hemi.intensity = (isNight ? 0.55 : dusk ? 1.2 : 1.7) * (dimIndoor ? 0.78 : 1);
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
    return mineHere ? `Private to ${t.label}` : free <= 0 ? `${t.label} ${dot} full` : `${t.label} ${dot} ${free} free`;
  }

  function setVenue({ layout, tables, tableWord, venue, spawn, country = "XX", region = "" }) {
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
    theme = themeFor(country, venue, region);
    plan = planVenue(layout, tables, theme.branch || {});
    plan.tables.forEach((t) => {
      t.label = `${tableWord} ${t.n}`;
      if (t.kind === "plastic" && theme.tableStyle === "bistro") {
        t.seatH = 0.46;
        t.topY = 0.755;
      } else if (t.kind === "plastic" && theme.tableStyle === "low") {
        t.seatH = 0.22;
        t.topY = 0.42;
      }
    });
    scene_ = { country, region, venue: venue.id, layout, theme: theme.id, archetype: theme.archetype };
    const built = buildPlace(plan, venue, theme, region, country === "XX" ? "" : findCountry(country)?.name || "");
    place = built.group;
    lamps = built.lamps;
    walkers = built.walkers;
    steamPuffs = built.steamPuffs;
    keepOutMeshes = built.keepOut || [];
    ownerInfo = built.owner || null;
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
      const light = new THREE.PointLight(theme.lamp, 0, 3.6, 1.8);
      light.position.set(t.x, (t.topY ?? TABLE_TOP[t.kind] ?? 0.75) + 0.9, t.z);
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
        : sitters ? { background: "rgba(34,33,32,0.86)" }
        : { background: "rgba(255,255,255,0.92)", color: "#222120" };
      const sprite = textSprite(text, { ...style, size: 36 });
      const base = new THREE.Vector3(t.x, t.kind === "bar" ? 1.3 : t.kind === "low" ? 0.6 : t.kind === "plastic" ? 0.8 : 1.0, t.kind === "bar" ? t.z + 0.1 : t.z);
      sprite.position.copy(base);
      sprite.material.depthTest = false;
      sprite.renderOrder = myTable === t.n ? 6 : 5;
      sprite.userData.table = t.n;
      scene.add(sprite);
      tableLabels.set(t.n, { sprite, text, base, mine: myTable === t.n, sitters });
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
    a.bubble = bubbleSprite(text, a.labelText);
    a.bubble.position.y = 2.12;
    a.bubble.userData.lift = 0;
    a.root.add(a.bubble);
    a.bubbleUntil = performance.now() + 4000 + Math.min(6000, text.length * 80);
    // Only the newest line floats in the room; the full conversation stays in the side panel.
    for (const other of avatars.values()) {
      if (other !== a && other.bubble) {
        other.bubbleUntil = 0;
      }
    }
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

  // Lay out every floating tag once per frame so none hide each other or fall off the canvas.
  // Table tags go first (your own table's tag sits on the near edge of its floor ring), then
  // name tags nearest first, then chat bubbles newest first; each one is lifted until it is clear.
  const anchorScreen = new THREE.Vector3();
  const anchorUp = new THREE.Vector3();
  const anchorView = new THREE.Vector3();
  const NEAR_LABEL_DEPTH = 3.5;
  const camRight = new THREE.Vector3();
  const anchorWorld = new THREE.Vector3();
  function screenOf(v, width, height) {
    anchorScreen.copy(v).project(camera);
    return { x: ((anchorScreen.x + 1) / 2) * width, y: ((1 - anchorScreen.y) / 2) * height, behind: anchorScreen.z > 1 };
  }
  const boxCorner = new THREE.Vector3();
  const keepBox = new THREE.Box3();
  function screenRectOf(object, width, height) {
    keepBox.setFromObject(object);
    if (keepBox.isEmpty()) {
      return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 8; i++) {
      boxCorner.set(i & 1 ? keepBox.max.x : keepBox.min.x, i & 2 ? keepBox.max.y : keepBox.min.y, i & 4 ? keepBox.max.z : keepBox.min.z);
      const p = screenOf(boxCorner, width, height);
      if (p.behind) {
        return null;
      }
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    if (maxX < 0 || minX > width || maxY < 0 || minY > height) {
      return null;
    }
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY };
  }
  function sizeSprite(sprite, factor) {
    if (!sprite.userData.base) {
      sprite.userData.base = sprite.scale.clone();
    }
    sprite.scale.copy(sprite.userData.base).multiplyScalar(factor);
  }
  function layoutLabels() {
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    const factor = width < 560 ? 1.3 : 1;
    const pad = 6;
    camRight.setFromMatrixColumn(camera.matrixWorld, 0);
    camRight.y = 0;
    camRight.normalize();
    const placed = [];
    tagRects = [];
    labelRects = [];
    // The sign and the city print are keep-out areas: tags and bubbles never cover them.
    for (const keep of keepOutMeshes) {
      const rect = screenRectOf(keep, width, height);
      if (rect) {
        placed.push({ ...rect, keepout: true });
      }
    }
    const overlaps = (o, r) => Math.abs(o.x - r.x) < (o.w + r.w) / 2 + 6 && Math.abs(o.y - r.y) < (o.h + r.h) / 2 + 3;
    const hitTest = (r, withKeepOut = false) => placed.find((o) => (withKeepOut || !o.keepout) && overlaps(o, r));

    // Returns the world position the sprite should take, given where it would sit untouched.
    function place(sprite, anchor, movable, droppable = false, shrinkNear = false, kind = "name") {
      sizeSprite(sprite, factor);
      const s = screenOf(anchor, width, height);
      if (s.behind) {
        return droppable ? null : anchor.clone();
      }
      anchorUp.copy(anchor);
      anchorUp.y += 1;
      const up = screenOf(anchorUp, width, height);
      const pixelsPerY = Math.max(1, s.y - up.y);
      anchorView.copy(anchor).applyMatrix4(camera.matrixWorldInverse);
      const viewDepth = Math.max(0.1, -anchorView.z);
      // someone walking right past the camera keeps a normal-sized name instead of a giant one
      if (shrinkNear && viewDepth < NEAR_LABEL_DEPTH) {
        sizeSprite(sprite, (factor * viewDepth) / NEAR_LABEL_DEPTH);
      }
      const worldPerPixel = (2 * viewDepth * Math.tan((camera.fov * Math.PI) / 360)) / height;
      const w = sprite.scale.x / worldPerPixel;
      const h = sprite.scale.y / worldPerPixel;
      const offsetY = (0.5 - sprite.center.y) * h;
      const rect = { x: s.x, y: s.y - offsetY, w, h };
      if (w < width - pad * 2) {
        rect.x = Math.min(width - pad - w / 2, Math.max(pad + w / 2, rect.x));
      }
      if (droppable && (hitTest(rect, true) || rect.y - rect.h / 2 < pad || rect.y + rect.h / 2 > height - pad)) {
        return null;
      }
      const bubble = kind === "bubble";
      const lift = () => {
        for (let guard = 0; guard < 12; guard++) {
          const hit = hitTest(rect, bubble);
          if (!hit) {
            break;
          }
          rect.y = hit.y - (hit.h + rect.h) / 2 - 3;
        }
        // never push a name or bubble off the top of the view; bubbles keep extra room for their frame
        const topPad = bubble ? pad + 12 : pad;
        rect.y = Math.max(rect.y, topPad + rect.h / 2);
      };
      if (movable) {
        const startY = rect.y;
        lift();
        // a bubble that is still over the sign (or was pinned at the top) steps sideways instead
        const stuck = bubble && hitTest(rect, true);
        if (stuck && w < width / 2) {
          const left = stuck.x - stuck.w / 2 - w / 2 - 8;
          const right = stuck.x + stuck.w / 2 + w / 2 + 8;
          const options = [left, right].filter((x) => x - w / 2 >= pad && x + w / 2 <= width - pad);
          if (options.length) {
            rect.x = options.sort((p, q) => Math.abs(p - s.x) - Math.abs(q - s.x))[0];
            rect.y = startY;
            lift();
          }
        }
      }
      placed.push(rect);
      labelRects.push({ kind, x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.w), h: Math.round(rect.h) });
      const world = anchor.clone().addScaledVector(camRight, (rect.x - s.x) * worldPerPixel);
      world.y += (s.y - (rect.y + offsetY)) / pixelsPerY;
      return world;
    }

    // my table first, then tables with people, then the nearest empty ones; a tag that would overlap is hidden
    const tableOrder = [...tableLabels].sort((p, q) => Number(q[1].mine) - Number(p[1].mine)
      || Number(q[1].sitters > 0) - Number(p[1].sitters > 0)
      || camera.position.distanceToSquared(p[1].base) - camera.position.distanceToSquared(q[1].base));
    for (const [tableNo, entry] of tableOrder) {
      const base = entry.base;
      if (entry.mine && zone.visible) {
        const dx = camera.position.x - zone.position.x;
        const dz = camera.position.z - zone.position.z;
        const length = Math.hypot(dx, dz) || 1;
        const ux = dx / length;
        const uz = dz / length;
        const r = 1 / Math.sqrt((ux / zone.scale.x) ** 2 + (uz / zone.scale.z) ** 2);
        anchorWorld.set(zone.position.x + ux * r, 0.12, zone.position.z + uz * r);
      } else {
        anchorWorld.copy(base);
      }
      // on a phone-sized view only your table and tables with people get a tag; the list below has the rest
      if (width < 560 && !entry.mine && !entry.sitters) {
        entry.sprite.visible = false;
        continue;
      }
      const spot = place(entry.sprite, anchorWorld, false, !entry.mine, false, "table");
      entry.sprite.visible = Boolean(spot);
      if (spot) {
        const r = placed[placed.length - 1];
        tagRects.push({ table: tableNo, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h), canvasW: width, canvasH: height });
      }
      if (spot) {
        entry.sprite.position.copy(spot);
      }
      entry.sprite.userData.table = tableNo;
    }

    const people = [...avatars.values()].sort((p, q) => camera.position.distanceToSquared(p.root.position) - camera.position.distanceToSquared(q.root.position));
    const nowMs = performance.now();
    for (const a of people) {
      a.root.updateMatrixWorld();
      anchorWorld.set(a.x, a.sitH != null ? a.sitH + 0.06 + 1.12 : 1.95, a.z);
      // while someone is talking their bubble carries their name, so the name tag steps aside
      const talking = a.bubble && a.bubbleUntil > nowMs;
      a.label.visible = !talking;
      if (talking) {
        a.stem.visible = false;
        a.labelWorld = anchorWorld.clone();
        a.labelWorld.y -= 0.12;
        continue;
      }
      const world = place(a.label, anchorWorld, true, false, !a.isMe);
      a.label.position.copy(a.root.worldToLocal(world.clone()));
      a.labelWorld = world;
      const headTop = a.sitH != null ? a.sitH + 1.0 : 1.76;
      const stemLength = world.y - a.label.scale.y / 2 - headTop - 0.03;
      a.stem.visible = stemLength > 0.12;
      if (a.stem.visible) {
        anchorWorld.set(world.x, headTop + 0.03, world.z);
        a.stem.position.copy(a.root.worldToLocal(anchorWorld.clone()));
        a.stem.scale.set(0.012 * factor, stemLength, 1);
      }
    }
    // the owner's tag comes after the players' names and is simply hidden when it would crowd them
    if (ownerInfo) {
      ownerInfo.root.updateMatrixWorld();
      ownerInfo.root.getWorldPosition(anchorWorld);
      anchorWorld.y = 1.95;
      const spot = place(ownerInfo.tag, anchorWorld, false, true, false, "owner");
      ownerInfo.tag.visible = Boolean(spot);
      if (spot) {
        ownerInfo.tag.position.copy(ownerInfo.root.worldToLocal(spot.clone()));
      }
    }
    const talkers = people.filter((a) => a.bubble).sort((p, q) => q.bubbleUntil - p.bubbleUntil);
    for (const a of talkers) {
      anchorWorld.copy(a.labelWorld);
      const world = place(a.bubble, anchorWorld, true, false, false, "bubble");
      a.bubble.position.copy(a.root.worldToLocal(world.clone()));
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
    marker.material.opacity = Math.max(0, marker.material.opacity - dt * 0.9);
    for (const w of walkers) {
      const span = w.path.to - w.path.from;
      const k = ((t * w.path.speed) / span + w.path.offset) % 2;
      const forward = k < 1;
      const z = w.path.from + span * (forward ? k : 2 - k);
      w.root.position.set(w.path.x, 0, z);
      w.root.rotation.y = forward ? 0 : Math.PI;
      poseStanding(w, t, true);
    }
    for (const puff of steamPuffs) {
      const k = (t * 0.35 + puff.userData.steam.phase) % 1;
      puff.position.y = puff.userData.steam.y + k * 0.22;
      puff.material.opacity = 0.32 * (1 - k);
      puff.scale.setScalar(0.8 + k * 0.9);
    }

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
    camera.updateMatrixWorld();
    layoutLabels();
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
        scene: scene_,
        tags: tagRects,
        labels: labelRects,
        canvasSize: { client: [canvas.clientWidth, canvas.clientHeight], buffer: [canvas.width, canvas.height], aspect: +camera.aspect.toFixed(3) },
      };
    },
  };
}
