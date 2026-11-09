// One recognisable silhouette per city, drawn flat on a 2D canvas. The print on the wall and the
// street board use it, so a room tells you which city (and country) you are in at a glance.
// Cities without an entry get a skyline drawn from their name.

export const CITY_LANDMARK = {
  // Indonesia
  jakarta: "monas", batam: "cablebridge", bandung: "mountain", surabaya: "obelisk", yogyakarta: "stupa",
  semarang: "colonial", medan: "dome", pontianak: "obelisk", bali: "splitgate", makassar: "dome", jayapura: "archbridge",
  // Malaysia, Singapore
  "kuala-lumpur": "twin", penang: "cablebridge", "johor-bahru": "dome", ipoh: "colonial", "kota-kinabalu": "mountain", kuching: "dome",
  central: "sands", east: "wheel",
  // Thailand, Vietnam, Philippines
  bangkok: "prang", "chiang-mai": "pagoda", phuket: "stupa",
  hanoi: "pagoda", "ho-chi-minh-city": "spire", "da-nang": "archbridge", hue: "gate",
  davao: "mountain", baguio: "mountain",
  // East Asia
  tokyo: "lattice", osaka: "pagoda", kyoto: "pagoda", fukuoka: "spire", sapporo: "clock",
  seoul: "spire", busan: "suspension", daegu: "spire", incheon: "cablebridge",
  taipei: "stack", tainan: "pagoda",
  // South Asia, Middle East, Africa
  mumbai: "gate", delhi: "gate", bengaluru: "colonial", kolkata: "dome", chennai: "colonial", hyderabad: "dome",
  dubai: "burj", "abu-dhabi": "dome", sharjah: "dome",
  istanbul: "dome", izmir: "clock",
  cairo: "pyramids", giza: "pyramids", abuja: "dome",
  // Europe
  london: "clock", edinburgh: "castle", cardiff: "castle",
  paris: "lattice", marseille: "dome",
  berlin: "spire", munich: "gothic", cologne: "gothic",
  rome: "colosseum", milan: "gothic", naples: "mountain",
  barcelona: "gothic", seville: "clock",
  // Americas, Oceania
  "new-york": "empire", denver: "mountain", "san-francisco": "suspension", seattle: "spire",
  "mexico-city": "obelisk", guadalajara: "gothic", monterrey: "mountain",
  "rio-de-janeiro": "mountain",
  sydney: "opera",
};

export function landmarkFor(regionName) {
  const key = String(regionName || "").toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return CITY_LANDMARK[key] || "skyline";
}

function poly(c, points) {
  c.beginPath();
  points.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  c.fill();
}

function rect(c, x, y, w, h) {
  c.fillRect(x, y, w, h);
}

// Draws the landmark in the box centred on cx, standing on `base`, w wide and h tall.
// `ink` is the silhouette colour, `paper` is used for windows and arches cut into it.
export function drawLandmark(c, kind, cx, base, w, h, ink, paper, seed = 1) {
  c.save();
  c.fillStyle = ink;
  c.strokeStyle = ink;
  c.lineCap = "round";
  const X = (k) => cx + k * w;
  const Y = (k) => base - k * h;
  const cut = (fn) => {
    c.fillStyle = paper;
    fn();
    c.fillStyle = ink;
  };
  switch (kind) {
    case "monas": {
      rect(c, X(-0.34), Y(0.1), w * 0.68, h * 0.1);
      poly(c, [[X(-0.2), Y(0.1)], [X(0.2), Y(0.1)], [X(0.12), Y(0.2)], [X(-0.12), Y(0.2)]]);
      poly(c, [[X(-0.05), Y(0.2)], [X(0.05), Y(0.2)], [X(0.03), Y(0.8)], [X(-0.03), Y(0.8)]]);
      rect(c, X(-0.06), Y(0.83), w * 0.12, h * 0.03);
      c.beginPath();
      c.moveTo(X(0), Y(1));
      c.quadraticCurveTo(X(0.08), Y(0.9), X(0.03), Y(0.83));
      c.lineTo(X(-0.03), Y(0.83));
      c.quadraticCurveTo(X(-0.07), Y(0.9), X(0), Y(1));
      c.fill();
      break;
    }
    case "obelisk": {
      rect(c, X(-0.18), Y(0.08), w * 0.36, h * 0.08);
      poly(c, [[X(-0.07), Y(0.08)], [X(0.07), Y(0.08)], [X(0.045), Y(0.86)], [X(-0.045), Y(0.86)]]);
      poly(c, [[X(-0.045), Y(0.86)], [X(0.045), Y(0.86)], [X(0), Y(1)]]);
      break;
    }
    case "cablebridge":
    case "suspension":
    case "archbridge": {
      const deck = kind === "archbridge" ? 0.3 : 0.24;
      rect(c, X(-0.5), Y(deck + 0.04), w, h * 0.05);
      c.lineWidth = Math.max(1.5, w * 0.006);
      if (kind === "archbridge") {
        c.lineWidth = Math.max(3, w * 0.022);
        c.beginPath();
        c.moveTo(X(-0.42), Y(deck));
        c.quadraticCurveTo(X(0), Y(1.25), X(0.42), Y(deck));
        c.stroke();
        c.lineWidth = Math.max(1.5, w * 0.005);
        for (let k = -0.32; k <= 0.33; k += 0.08) {
          const t = (k + 0.42) / 0.84;
          const top = deck + (1.25 - deck) * 2 * t * (1 - t);
          c.beginPath();
          c.moveTo(X(k), Y(deck + 0.04));
          c.lineTo(X(k), Y(top));
          c.stroke();
        }
      } else {
        for (const side of [-1, 1]) {
          const px = side * 0.24;
          rect(c, X(px - 0.022), Y(0.95), w * 0.044, h * 0.95);
          if (kind === "cablebridge") {
            for (let i = 1; i <= 5; i++) {
              for (const dir of [-1, 1]) {
                c.beginPath();
                c.moveTo(X(px), Y(0.9 - i * 0.04));
                c.lineTo(X(px + dir * i * 0.045), Y(deck + 0.04));
                c.stroke();
              }
            }
          }
        }
        if (kind === "suspension") {
          c.lineWidth = Math.max(2, w * 0.01);
          c.beginPath();
          c.moveTo(X(-0.5), Y(deck + 0.1));
          c.quadraticCurveTo(X(-0.36), Y(deck + 0.2), X(-0.24), Y(0.92));
          c.quadraticCurveTo(X(0), Y(0.05), X(0.24), Y(0.92));
          c.quadraticCurveTo(X(0.36), Y(deck + 0.2), X(0.5), Y(deck + 0.1));
          c.stroke();
          c.lineWidth = Math.max(1, w * 0.004);
          for (let k = -0.2; k <= 0.21; k += 0.05) {
            const t = (k + 0.24) / 0.48;
            const top = 0.92 - (0.92 - 0.3) * 4 * t * (1 - t);
            c.beginPath();
            c.moveTo(X(k), Y(deck + 0.04));
            c.lineTo(X(k), Y(top));
            c.stroke();
          }
        }
      }
      rect(c, X(-0.5), Y(0.02), w, h * 0.02);
      break;
    }
    case "twin": {
      for (const side of [-1, 1]) {
        const tx = side * 0.13;
        const steps = [[0.16, 0.0, 0.55], [0.13, 0.55, 0.72], [0.1, 0.72, 0.84], [0.07, 0.84, 0.9]];
        for (const [sw, from, to] of steps) {
          rect(c, X(tx - sw / 2), Y(to), w * sw, h * (to - from));
        }
        poly(c, [[X(tx - 0.012), Y(0.9)], [X(tx + 0.012), Y(0.9)], [X(tx), Y(1)]]);
      }
      rect(c, X(-0.06), Y(0.47), w * 0.12, h * 0.03);
      break;
    }
    case "lattice": {
      c.beginPath();
      c.moveTo(X(-0.3), Y(0));
      c.quadraticCurveTo(X(-0.08), Y(0.25), X(-0.03), Y(0.8));
      c.lineTo(X(0.03), Y(0.8));
      c.quadraticCurveTo(X(0.08), Y(0.25), X(0.3), Y(0));
      c.closePath();
      c.fill();
      rect(c, X(-0.006), Y(1), w * 0.012, h * 0.22);
      cut(() => {
        c.beginPath();
        c.moveTo(X(-0.18), Y(0));
        c.quadraticCurveTo(X(0), Y(0.36), X(0.18), Y(0));
        c.fill();
      });
      rect(c, X(-0.17), Y(0.27), w * 0.34, h * 0.025);
      rect(c, X(-0.085), Y(0.55), w * 0.17, h * 0.02);
      break;
    }
    case "spire": {
      poly(c, [[X(-0.1), Y(0)], [X(0.1), Y(0)], [X(0.025), Y(0.2)], [X(-0.025), Y(0.2)]]);
      rect(c, X(-0.022), Y(0.68), w * 0.044, h * 0.5);
      c.beginPath();
      c.ellipse(X(0), Y(0.7), w * 0.075, h * 0.06, 0, 0, Math.PI * 2);
      c.fill();
      rect(c, X(-0.01), Y(1), w * 0.02, h * 0.32);
      break;
    }
    case "clock": {
      rect(c, X(-0.46), Y(0.26), w * 0.36, h * 0.26);
      for (let k = -0.44; k < -0.11; k += 0.05) {
        poly(c, [[X(k), Y(0.26)], [X(k + 0.02), Y(0.26)], [X(k + 0.01), Y(0.33)]]);
      }
      rect(c, X(-0.08), Y(0.72), w * 0.16, h * 0.72);
      cut(() => {
        c.beginPath();
        c.arc(X(0), Y(0.62), Math.min(w * 0.055, h * 0.06), 0, Math.PI * 2);
        c.fill();
      });
      poly(c, [[X(-0.09), Y(0.72)], [X(0.09), Y(0.72)], [X(0), Y(0.95)]]);
      rect(c, X(-0.005), Y(1), w * 0.01, h * 0.06);
      rect(c, X(0.12), Y(0.2), w * 0.34, h * 0.2);
      break;
    }
    case "dome": {
      rect(c, X(-0.24), Y(0.32), w * 0.48, h * 0.32);
      c.beginPath();
      c.ellipse(X(0), Y(0.32), w * 0.2, h * 0.34, 0, Math.PI, 0);
      c.fill();
      rect(c, X(-0.006), Y(0.78), w * 0.012, h * 0.12);
      c.beginPath();
      c.arc(X(0), Y(0.8), Math.max(2, w * 0.012), 0, Math.PI * 2);
      c.fill();
      for (const side of [-1, 1]) {
        rect(c, X(side * 0.38 - 0.025), Y(0.78), w * 0.05, h * 0.78);
        rect(c, X(side * 0.38 - 0.04), Y(0.6), w * 0.08, h * 0.03);
        poly(c, [[X(side * 0.38 - 0.03), Y(0.78)], [X(side * 0.38 + 0.03), Y(0.78)], [X(side * 0.38), Y(0.95)]]);
      }
      cut(() => {
        for (const k of [-0.15, 0, 0.15]) {
          c.beginPath();
          c.ellipse(X(k), Y(0.14), w * 0.035, h * 0.1, 0, Math.PI, 0);
          c.rect(X(k - 0.035), Y(0.14), w * 0.07, h * 0.14);
          c.fill();
        }
      });
      break;
    }
    case "pagoda": {
      const tiers = 5;
      for (let i = 0; i < tiers; i++) {
        const k = 1 - i * 0.14;
        const y0 = 0.05 + i * 0.16;
        rect(c, X(-0.13 * k), Y(y0 + 0.1), w * 0.26 * k, h * 0.1);
        poly(c, [[X(-0.3 * k), Y(y0 + 0.1)], [X(0.3 * k), Y(y0 + 0.1)], [X(0.18 * k), Y(y0 + 0.16)], [X(-0.18 * k), Y(y0 + 0.16)]]);
      }
      rect(c, X(-0.2), Y(0.05), w * 0.4, h * 0.05);
      rect(c, X(-0.008), Y(1), w * 0.016, h * 0.15);
      break;
    }
    case "prang": {
      const tower = (tx, scale) => {
        rect(c, X(tx - 0.12 * scale), Y(0.12 * scale), w * 0.24 * scale, h * 0.12 * scale);
        for (let i = 0; i < 6; i++) {
          const r = (0.1 - i * 0.014) * scale;
          c.beginPath();
          c.ellipse(X(tx), Y((0.18 + i * 0.12) * scale), w * r, h * 0.07 * scale, 0, 0, Math.PI * 2);
          c.fill();
        }
        rect(c, X(tx - 0.006), Y(1 * scale), w * 0.012, h * 0.2 * scale);
      };
      tower(-0.3, 0.55);
      tower(0.3, 0.55);
      tower(0, 1);
      break;
    }
    case "stupa": {
      const steps = [[0.48, 0.0, 0.1], [0.4, 0.1, 0.2], [0.32, 0.2, 0.3], [0.24, 0.3, 0.38]];
      for (const [sw, from, to] of steps) {
        rect(c, X(-sw), Y(to), w * sw * 2, h * (to - from));
      }
      c.beginPath();
      c.ellipse(X(0), Y(0.38), w * 0.14, h * 0.3, 0, Math.PI, 0);
      c.fill();
      poly(c, [[X(-0.03), Y(0.66)], [X(0.03), Y(0.66)], [X(0), Y(0.95)]]);
      for (const k of [-0.36, -0.24, 0.24, 0.36]) {
        c.beginPath();
        c.ellipse(X(k), Y(0.3), w * 0.03, h * 0.07, 0, Math.PI, 0);
        c.fill();
      }
      break;
    }
    case "splitgate": {
      for (const side of [-1, 1]) {
        const s = side;
        poly(c, [
          [X(s * 0.06), Y(0)], [X(s * 0.4), Y(0)], [X(s * 0.4), Y(0.2)], [X(s * 0.33), Y(0.2)], [X(s * 0.33), Y(0.42)],
          [X(s * 0.27), Y(0.42)], [X(s * 0.27), Y(0.62)], [X(s * 0.2), Y(0.62)], [X(s * 0.2), Y(0.8)], [X(s * 0.13), Y(0.8)],
          [X(s * 0.12), Y(0.96)], [X(s * 0.06), Y(0.9)],
        ]);
      }
      rect(c, X(-0.5), Y(0.02), w, h * 0.02);
      break;
    }
    case "gate": {
      rect(c, X(-0.26), Y(0.72), w * 0.52, h * 0.72);
      rect(c, X(-0.3), Y(0.78), w * 0.6, h * 0.06);
      c.beginPath();
      c.ellipse(X(0), Y(0.78), w * 0.08, h * 0.12, 0, Math.PI, 0);
      c.fill();
      for (const side of [-1, 1]) {
        poly(c, [[X(side * 0.26), Y(0.84)], [X(side * 0.2), Y(0.84)], [X(side * 0.23), Y(0.94)]]);
      }
      cut(() => {
        c.beginPath();
        c.ellipse(X(0), Y(0.34), w * 0.11, h * 0.16, 0, Math.PI, 0);
        c.rect(X(-0.11), Y(0.34), w * 0.22, h * 0.34);
        c.fill();
      });
      break;
    }
    case "colosseum": {
      c.beginPath();
      c.moveTo(X(-0.48), Y(0));
      c.lineTo(X(-0.48), Y(0.5));
      c.lineTo(X(0.12), Y(0.62));
      c.lineTo(X(0.3), Y(0.48));
      c.lineTo(X(0.48), Y(0.4));
      c.lineTo(X(0.48), Y(0));
      c.closePath();
      c.fill();
      cut(() => {
        for (let row = 0; row < 3; row++) {
          for (let k = -0.44; k < 0.44; k += 0.08) {
            const top = 0.16 + row * 0.15;
            if (top + 0.1 > (k < 0.12 ? 0.5 + (k + 0.48) * 0.2 : 0.4)) {
              continue;
            }
            c.beginPath();
            c.ellipse(X(k + 0.03), Y(top), w * 0.022, h * 0.03, 0, Math.PI, 0);
            c.rect(X(k + 0.008), Y(top), w * 0.044, h * 0.08);
            c.fill();
          }
        }
      });
      break;
    }
    case "pyramids": {
      poly(c, [[X(-0.48), Y(0)], [X(0.02), Y(0)], [X(-0.23), Y(0.62)]]);
      poly(c, [[X(-0.12), Y(0)], [X(0.42), Y(0)], [X(0.15), Y(0.85)]]);
      poly(c, [[X(0.28), Y(0)], [X(0.5), Y(0)], [X(0.39), Y(0.3)]]);
      break;
    }
    case "mountain": {
      poly(c, [[X(-0.5), Y(0)], [X(-0.2), Y(0.62)], [X(-0.1), Y(0.5)], [X(0.08), Y(0.9)], [X(0.12), Y(0.86)], [X(0.18), Y(0.9)], [X(0.5), Y(0.12)], [X(0.5), Y(0)]]);
      cut(() => {
        poly(c, [[X(0.02), Y(0.78)], [X(0.08), Y(0.9)], [X(0.12), Y(0.86)], [X(0.18), Y(0.9)], [X(0.22), Y(0.8)], [X(0.15), Y(0.82)], [X(0.1), Y(0.76)]]);
      });
      break;
    }
    case "burj": {
      const steps = [[0.11, 0.0, 0.3], [0.085, 0.3, 0.5], [0.06, 0.5, 0.66], [0.04, 0.66, 0.78], [0.022, 0.78, 0.88]];
      for (const [sw, from, to] of steps) {
        rect(c, X(-sw), Y(to), w * sw * 2, h * (to - from));
      }
      poly(c, [[X(-0.01), Y(0.88)], [X(0.01), Y(0.88)], [X(0), Y(1)]]);
      for (const [k, bh] of [[-0.4, 0.2], [-0.3, 0.3], [-0.2, 0.16], [0.2, 0.24], [0.3, 0.18], [0.4, 0.28]]) {
        rect(c, X(k - 0.04), Y(bh), w * 0.08, h * bh);
      }
      break;
    }
    case "opera": {
      rect(c, X(-0.46), Y(0.1), w * 0.92, h * 0.1);
      const sail = (x0, x1, top) => {
        c.beginPath();
        c.moveTo(X(x0), Y(0.1));
        c.quadraticCurveTo(X(x0 + 0.02), Y(top), X(x1), Y(top));
        c.quadraticCurveTo(X(x1 - 0.04), Y(top * 0.5), X(x1 + 0.04), Y(0.1));
        c.closePath();
        c.fill();
      };
      sail(-0.42, -0.18, 0.62);
      sail(-0.2, 0.04, 0.82);
      sail(0.02, 0.22, 0.66);
      sail(0.2, 0.36, 0.46);
      break;
    }
    case "sands": {
      for (const k of [-0.24, 0, 0.24]) {
        poly(c, [[X(k - 0.06), Y(0)], [X(k + 0.06), Y(0)], [X(k + 0.05), Y(0.78)], [X(k - 0.05), Y(0.78)]]);
      }
      c.beginPath();
      c.moveTo(X(-0.34), Y(0.78));
      c.lineTo(X(0.42), Y(0.79));
      c.quadraticCurveTo(X(0.46), Y(0.83), X(0.42), Y(0.86));
      c.lineTo(X(-0.34), Y(0.86));
      c.closePath();
      c.fill();
      rect(c, X(-0.5), Y(0.02), w, h * 0.02);
      break;
    }
    case "wheel": {
      const r = Math.min(w * 0.38, h * 0.42);
      const hy = base - h * 0.52;
      c.lineWidth = Math.max(2, r * 0.05);
      c.beginPath();
      c.arc(cx, hy, r, 0, Math.PI * 2);
      c.stroke();
      c.lineWidth = Math.max(1, r * 0.015);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, hy);
        c.lineTo(cx + Math.cos(a) * r, hy + Math.sin(a) * r);
        c.stroke();
        c.beginPath();
        c.arc(cx + Math.cos(a) * r, hy + Math.sin(a) * r, Math.max(2, r * 0.06), 0, Math.PI * 2);
        c.fill();
      }
      poly(c, [[cx - r * 0.5, base], [cx - r * 0.38, base], [cx, hy], [cx - r * 0.06, hy]]);
      poly(c, [[cx + r * 0.5, base], [cx + r * 0.38, base], [cx, hy], [cx + r * 0.06, hy]]);
      rect(c, X(-0.5), Y(0.02), w, h * 0.02);
      break;
    }
    case "empire": {
      for (const [k, bw, bh] of [[-0.42, 0.1, 0.3], [-0.32, 0.09, 0.42], [-0.22, 0.1, 0.26], [0.18, 0.1, 0.36], [0.28, 0.08, 0.5], [0.38, 0.12, 0.28]]) {
        rect(c, X(k - bw / 2), Y(bh), w * bw, h * bh);
      }
      const steps = [[0.12, 0.0, 0.5], [0.09, 0.5, 0.64], [0.06, 0.64, 0.74], [0.035, 0.74, 0.82]];
      for (const [sw, from, to] of steps) {
        rect(c, X(-sw), Y(to), w * sw * 2, h * (to - from));
      }
      rect(c, X(-0.008), Y(1), w * 0.016, h * 0.18);
      break;
    }
    case "gothic": {
      rect(c, X(-0.3), Y(0.42), w * 0.6, h * 0.42);
      poly(c, [[X(-0.3), Y(0.42)], [X(0.3), Y(0.42)], [X(0), Y(0.58)]]);
      for (const side of [-1, 1]) {
        rect(c, X(side * 0.2 - 0.07), Y(0.62), w * 0.14, h * 0.62);
        poly(c, [[X(side * 0.2 - 0.07), Y(0.62)], [X(side * 0.2 + 0.07), Y(0.62)], [X(side * 0.2), Y(1)]]);
      }
      cut(() => {
        c.beginPath();
        c.arc(X(0), Y(0.3), Math.min(w * 0.06, h * 0.07), 0, Math.PI * 2);
        c.fill();
        c.beginPath();
        c.ellipse(X(0), Y(0.12), w * 0.05, h * 0.06, 0, Math.PI, 0);
        c.rect(X(-0.05), Y(0.12), w * 0.1, h * 0.12);
        c.fill();
      });
      break;
    }
    case "castle": {
      poly(c, [[X(-0.5), Y(0)], [X(-0.42), Y(0.3)], [X(-0.2), Y(0.38)], [X(0.3), Y(0.4)], [X(0.5), Y(0.2)], [X(0.5), Y(0)]]);
      rect(c, X(-0.34), Y(0.6), w * 0.56, h * 0.24);
      for (let k = -0.34; k < 0.22; k += 0.06) {
        rect(c, X(k), Y(0.64), w * 0.03, h * 0.04);
      }
      for (const [k, th] of [[-0.36, 0.78], [0.16, 0.86]]) {
        rect(c, X(k), Y(th), w * 0.1, h * (th - 0.36));
        for (let j = 0; j < 3; j++) {
          rect(c, X(k + j * 0.035), Y(th + 0.04), w * 0.022, h * 0.04);
        }
      }
      break;
    }
    case "colonial": {
      rect(c, X(-0.44), Y(0.34), w * 0.88, h * 0.34);
      rect(c, X(-0.46), Y(0.38), w * 0.92, h * 0.04);
      for (const k of [-0.36, 0.36]) {
        rect(c, X(k - 0.06), Y(0.62), w * 0.12, h * 0.62);
        c.beginPath();
        c.ellipse(X(k), Y(0.62), w * 0.06, h * 0.12, 0, Math.PI, 0);
        c.fill();
        rect(c, X(k - 0.005), Y(0.84), w * 0.01, h * 0.1);
      }
      c.beginPath();
      c.ellipse(X(0), Y(0.38), w * 0.1, h * 0.2, 0, Math.PI, 0);
      c.fill();
      cut(() => {
        for (let k = -0.26; k <= 0.27; k += 0.065) {
          c.beginPath();
          c.ellipse(X(k), Y(0.2), w * 0.018, h * 0.03, 0, Math.PI, 0);
          c.rect(X(k - 0.018), Y(0.2), w * 0.036, h * 0.1);
          c.fill();
        }
      });
      break;
    }
    case "stack": {
      rect(c, X(-0.1), Y(0.2), w * 0.2, h * 0.2);
      for (let i = 0; i < 8; i++) {
        const y0 = 0.2 + i * 0.075;
        poly(c, [[X(-0.065), Y(y0)], [X(0.065), Y(y0)], [X(0.09), Y(y0 + 0.07)], [X(-0.09), Y(y0 + 0.07)]]);
      }
      rect(c, X(-0.04), Y(0.86), w * 0.08, h * 0.06);
      rect(c, X(-0.007), Y(1), w * 0.014, h * 0.14);
      break;
    }
    default: {
      let s = seed || 1;
      const rand = () => {
        s = (Math.imul(s, 1103515245) + 12345) >>> 0;
        return (s >>> 8) / 16777216;
      };
      let x = cx - w / 2;
      while (x < cx + w / 2 - 4) {
        const bw = w * (0.05 + rand() * 0.08);
        const bh = h * (0.25 + rand() * 0.65);
        rect(c, x, base - bh, Math.min(bw, cx + w / 2 - x), bh);
        if (rand() > 0.72) {
          rect(c, x + bw / 2 - 1.5, base - bh - h * 0.12, 3, h * 0.12);
        }
        x += bw + w * 0.01;
      }
    }
  }
  c.restore();
}
