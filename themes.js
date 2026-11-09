// What each kind of place looks like in 3D. world.js builds the scene from these values,
// so two venues that share a floor plan (say a Malaysian kopitiam and a Malaysian cafe)
// still look like two different places: own floor, walls, sign, furniture, counter and decor.
//
// floor.kind: terrazzo | checker | tile | wood | concrete | asphalt | paving | grass | sand | carpet | tatami
// back:       wall (indoor) | shophouse | shutter | stalls | tent | hedge | shopfront | truckart | beach
// counter:    jars | espresso | cart | kiosk | grill | tea | bakery | wine | taps | noodle | chai | kopitiam | griddle | stalls | none
// backbar:    (counter layouts) bottles | sake | taps | wine | pastry | noodle | coffee
// lights:     bulbs | string | pendant | fluor | chochin | dim
// deco:       bunting fans tv posters clock frames mirrors plants trees umbrellas awning neon noren lattice slats flags lanterns

const BASE = {
  floor: { kind: "terrazzo", a: "#d8cfbf", b: ["#a99c86", "#8a5a3b", "#f4efe6", "#6d665c"] },
  ground: "#5d564c",
  back: "wall",
  wall: "#e9dcc4",
  trim: "#8a5a3b",
  sign: { bg: "#a63d24", fg: "#f4efe6", font: "serif" },
  wood: "#6b4428",
  top: "#9a6b45",
  bench: "#8a5a3b",
  chair: "#6b4428",
  cushions: ["#2d4a3e", "#a63d24"],
  plastic: ["#c8432b", "#2f6fa3", "#d9a62e", "#3c8a5a"],
  counter: "jars",
  counterBody: "#8a5a3b",
  backbar: "bottles",
  lights: "bulbs",
  lamp: "#ffd28a",
  deco: [],
  bunting: ["#a63d24", "#2d4a3e", "#d9a62e", "#f4efe6"],
  posters: ["#c8432b", "#d9a62e", "#2f6fa3"],
  tableStyle: null,
  shirt: "#f1efe9",
};

const ARCHETYPES = {
  warung: {
    wall: "#e7dcb8", trim: "#2f6f6a",
    deco: ["bunting", "posters", "tv", "fans"],
  },
  angkringan: {
    floor: { kind: "paving", a: "#9b958a", b: "#7f796f" }, ground: "#6f6a62",
    back: "shophouse", wall: "#d9cdb8", trim: "#8a5a3b",
    sign: { bg: "#3b2416", fg: "#f1d9a8", font: "serif" },
    counter: "cart", cart: { body: "#8a5a3b", tarp: "#2d4a3e" }, lights: "string",
    deco: ["lanterns"], lanterns: "#ffb85c",
  },
  kafeModern: {
    floor: { kind: "concrete", a: "#bcb7ae" }, wall: "#f2efe9", trim: "#2a2a28",
    sign: { bg: "#222120", fg: "#f2efe9", font: "sans" },
    top: "#d8c3a0", wood: "#2a2a28", chair: "#2a2a28", counter: "espresso", counterBody: "#c9a77c",
    lights: "pendant", deco: ["slats", "plants", "neon"], neon: "#e8a33d", shirt: "#2a2a28",
  },
  kopitiam: {
    floor: { kind: "checker", a: "#f1ece2", b: "#2a2a28" }, wall: "#efe6cf", trim: "#3d6b5a",
    sign: { bg: "#1f3b2f", fg: "#e9c46a", font: "serif" },
    top: "#f4f1ea", wood: "#3b2a1e", chair: "#4a3020", counter: "kopitiam", counterBody: "#3d6b5a",
    lights: "bulbs", deco: ["fans", "clock", "posters"], posters: ["#a63d24", "#1f3b2f", "#e9c46a"], shirt: "#f4f1ea",
  },
  mamak: {
    floor: { kind: "tile", a: "#e9e6df", b: "#c9c4ba" }, ground: "#6f6a62",
    back: "shutter", wall: "#d9e6d3", trim: "#1d6b3a",
    sign: { bg: "#1d6b3a", fg: "#ffffff", font: "sans" },
    counter: "griddle", counterBody: "#c9c4ba", lights: "fluor",
    deco: ["awning", "tv", "fans"], awning: ["#1d6b3a", "#f4efe6"], plastic: ["#2f6fa3", "#c8432b", "#e2b23b"],
  },
  hawker: {
    floor: { kind: "concrete", a: "#a9a69f" }, back: "stalls", wall: "#d7d3c8", trim: "#5a5f63",
    sign: { bg: "#c8432b", fg: "#ffffff", font: "sans" },
    top: "#e7e2d6", bench: "#8a8f94", wood: "#5a5f63", counter: "stalls", lights: "fluor", deco: ["fans"],
  },
  cafeLight: {
    floor: { kind: "wood", a: "#c9a77c", b: "#b8956a" }, wall: "#f4f1ea", trim: "#d9cbb4",
    sign: { bg: "#f4f1ea", fg: "#2a2a28", font: "sans", border: "#2a2a28" },
    top: "#e2cfa8", wood: "#c9a77c", chair: "#b8956a", counter: "espresso", counterBody: "#e2cfa8",
    lights: "pendant", deco: ["plants", "frames"], backbar: "coffee", shirt: "#2d4a3e",
  },
  streetfood: {
    floor: { kind: "asphalt", a: "#5f5d5a" }, ground: "#4f4d4a", back: "shutter", wall: "#cfc6b5", trim: "#2f6fa3",
    sign: { bg: "#e2b23b", fg: "#2a2a28", font: "sans" },
    counter: "grill", counterBody: "#c9c4ba", lights: "string",
    deco: ["umbrellas"], umbrellas: ["#c8432b", "#f4efe6"], plastic: ["#c8432b", "#2f6fa3", "#e2b23b", "#3c8a5a"],
  },
  caphe: {
    floor: { kind: "paving", a: "#a39b8b", b: "#8a8274" }, ground: "#6f6a62", back: "shophouse", wall: "#e8c86a", trim: "#7a2a1a",
    sign: { bg: "#7a2a1a", fg: "#f4e3b0", font: "serif" },
    counter: "chai", counterBody: "#7a2a1a", lights: "string", deco: ["trees", "lanterns"], lanterns: "#e2b23b",
    plastic: ["#2f6fa3", "#c8432b"], tableStyle: "low",
  },
  biahoi: {
    floor: { kind: "concrete", a: "#9a968e" }, ground: "#6f6a62", back: "shutter", wall: "#d6cfbd", trim: "#2f6fa3",
    sign: { bg: "#2f6fa3", fg: "#f4efe6", font: "sans" },
    counter: "taps", counterBody: "#c9c4ba", lights: "string", deco: ["umbrellas"], umbrellas: ["#2f6fa3", "#f4efe6"],
    plastic: ["#2f6fa3", "#c8432b"],
  },
  carinderia: {
    floor: { kind: "tile", a: "#e6e2d8", b: "#b9c7cf" }, wall: "#bcd3dc", trim: "#2f6fa3",
    sign: { bg: "#2f6fa3", fg: "#ffffff", font: "sans" }, counter: "pots", counterBody: "#c9c4ba",
    lights: "fluor", deco: ["bunting", "fans"], bunting: ["#2f6fa3", "#c8432b", "#e2b23b", "#f4efe6"],
  },
  sarisari: {
    floor: { kind: "concrete", a: "#a39c90" }, back: "shopfront", wall: "#e2b23b", trim: "#2f6fa3",
    sign: { bg: "#e2b23b", fg: "#2a2a28", font: "sans" }, counter: "jars", lights: "string",
    deco: ["awning"], awning: ["#2f6fa3", "#f4efe6"],
  },
  kissaten: {
    floor: { kind: "wood", a: "#5a3a26", b: "#4a2f1f" }, wall: "#5b4130", trim: "#2a1d16",
    sign: { bg: "#2a1d16", fg: "#d9b77a", font: "serif" },
    top: "#3b2416", wood: "#2a1d16", chair: "#7a2a24", counter: "espresso", counterBody: "#3b2416",
    lights: "dim", lamp: "#ffb870", deco: ["frames", "clock"], shirt: "#f4efe6",
  },
  izakaya: {
    floor: { kind: "wood", a: "#a07850", b: "#8a6640" }, wall: "#e9dcc0", trim: "#3b2416",
    sign: { bg: "#2a1d16", fg: "#f4efe6", font: "serif" },
    top: "#b58a5c", wood: "#7d5a3a", chair: "#7d5a3a", backbar: "sake", lights: "chochin",
    deco: ["noren", "lattice"], noren: "#1f2f4a", lamp: "#ffb36b", shirt: "#1f2f4a",
  },
  yatai: {
    floor: { kind: "asphalt", a: "#4f4d4a" }, ground: "#3f3d3a", back: "shutter", wall: "#a9a39a", trim: "#3b2416",
    sign: { bg: "#c8432b", fg: "#ffffff", font: "serif" },
    top: "#b58a5c", wood: "#7d5a3a", backbar: "noodle", lights: "chochin", deco: ["noren"], noren: "#c8432b", lamp: "#ffa05a",
  },
  pocha: {
    floor: { kind: "asphalt", a: "#55524e" }, ground: "#45423e", back: "tent", wall: "#e86a2a", trim: "#c8432b",
    sign: { bg: "#e86a2a", fg: "#ffffff", font: "sans" }, counter: "grill", counterBody: "#c9c4ba",
    lights: "string", lamp: "#ff9a5a", plastic: ["#e86a2a", "#2f6fa3", "#3c8a5a"], deco: ["tent"],
  },
  hof: {
    floor: { kind: "wood", a: "#7d5a3a", b: "#6b4a2e" }, wall: "#2a2f36", trim: "#7d5a3a",
    sign: { bg: "#e8a33d", fg: "#2a2a28", font: "sans" }, top: "#9a6b45", bench: "#7d5a3a",
    counter: "taps", counterBody: "#3b2416", lights: "pendant", deco: ["neon", "frames"], neon: "#e8a33d",
  },
  teahouse: {
    floor: { kind: "tatami", a: "#c9b67c", b: "#a8955c" }, wall: "#efe6cf", trim: "#5a3a26",
    sign: { bg: "#5a3a26", fg: "#efe6cf", font: "serif" }, counter: "tea", counterBody: "#5a3a26",
    lights: "chochin", deco: ["lattice", "plants"], cushions: ["#5a3a26", "#7a8a5a"], lamp: "#ffcf8a",
  },
  nightmarket: {
    floor: { kind: "concrete", a: "#8e8a83" }, ground: "#5f5c57", back: "stalls", wall: "#c9c2b5", trim: "#c8432b",
    sign: { bg: "#c8432b", fg: "#ffe9a8", font: "sans" }, top: "#e7e2d6", bench: "#c8432b",
    counter: "stalls", lights: "string", deco: ["lanterns"], lanterns: "#e8433b",
  },
  chaiStall: {
    floor: { kind: "paving", a: "#b5a58a", b: "#9c8c70" }, ground: "#7a6e5c", back: "shopfront", wall: "#e2a03b", trim: "#2f6f6a",
    sign: { bg: "#2f6f6a", fg: "#fff3d6", font: "sans" }, counter: "chai", counterBody: "#6b4428",
    lights: "string", deco: ["bunting", "awning"], awning: ["#2f6f6a", "#e2a03b"], bunting: ["#e2a03b", "#c8432b", "#2f6f6a", "#f4efe6"],
  },
  irani: {
    floor: { kind: "checker", a: "#f1ece2", b: "#2a2a28" }, wall: "#e9e1cf", trim: "#2a2a28",
    sign: { bg: "#2a2a28", fg: "#e9c46a", font: "serif" }, top: "#f4f1ea", wood: "#2a1d16", chair: "#2a1d16",
    counter: "bakery", counterBody: "#2a1d16", lights: "bulbs", deco: ["mirrors", "fans", "clock"],
  },
  dhaba: {
    floor: { kind: "concrete", a: "#b3a58c" }, ground: "#8a7c62", back: "truckart", wall: "#e2a03b", trim: "#c8432b",
    sign: { bg: "#c8432b", fg: "#ffe9a8", font: "sans" }, top: "#d9a62e", bench: "#2f6fa3",
    counter: "grill", counterBody: "#a63d24", lights: "string", deco: ["bunting"], bunting: ["#c8432b", "#2f6fa3", "#e2b23b", "#3c8a5a"],
  },
  majlis: {
    floor: { kind: "carpet", a: "#8a2a24", b: "#d9a62e" }, wall: "#e6d5b5", trim: "#8a5a3b",
    sign: { bg: "#3b2416", fg: "#d9a62e", font: "serif" }, counter: "tea", counterBody: "#3b2416",
    lights: "dim", lamp: "#ffbf75", deco: ["lanterns", "frames"], lanterns: "#d9a62e", cushions: ["#8a2a24", "#d9a62e"],
  },
  teaGarden: {
    floor: { kind: "grass", a: "#7f9a55" }, ground: "#6c8749", back: "hedge", wall: "#d9cdb8",
    sign: { bg: "#8a2a24", fg: "#f4efe6", font: "serif" }, counter: "tea", counterBody: "#6b4428",
    lights: "string", deco: ["trees"], top: "#9a6b45",
  },
  kahvehane: {
    floor: { kind: "tile", a: "#e9e2d2", b: "#3d6b8c" }, wall: "#dfe7ea", trim: "#3d6b8c",
    sign: { bg: "#3d6b8c", fg: "#f4efe6", font: "serif" }, top: "#f4f1ea", wood: "#3b2a1e", chair: "#3b2a1e",
    counter: "tea", counterBody: "#3d6b8c", lights: "bulbs", deco: ["frames", "clock"],
  },
  wineBar: {
    floor: { kind: "wood", a: "#6b4a2e", b: "#5a3d26" }, wall: "#7a2a2a", trim: "#3b2416",
    sign: { bg: "#3b2416", fg: "#e9c9a0", font: "serif" }, top: "#3b2416", wood: "#2a1d16", chair: "#2a1d16",
    counter: "wine", counterBody: "#3b2416", backbar: "wine", lights: "dim", lamp: "#ffb870", deco: ["frames"],
  },
  meyhane: {
    floor: { kind: "tile", a: "#e8dfcc", b: "#b0623a" }, wall: "#f0e6d0", trim: "#3d6b8c",
    sign: { bg: "#3d6b8c", fg: "#ffffff", font: "serif" }, top: "#f4f1ea", bench: "#6b4428",
    counter: "wine", counterBody: "#6b4428", lights: "bulbs", deco: ["frames", "plants"],
  },
  buka: {
    floor: { kind: "concrete", a: "#a89e8c" }, wall: "#e2d14b", trim: "#2f8a5a",
    sign: { bg: "#2f8a5a", fg: "#ffffff", font: "sans" }, counter: "pots", counterBody: "#c9c4ba",
    lights: "fluor", deco: ["posters", "fans"], posters: ["#2f8a5a", "#e2d14b", "#c8432b"],
  },
  suya: {
    floor: { kind: "concrete", a: "#7c776f" }, ground: "#5f5a52", back: "shutter", wall: "#c9c2b5", trim: "#2f8a5a",
    sign: { bg: "#2a2a28", fg: "#e8a33d", font: "sans" }, counter: "grill", counterBody: "#3b3a38", lights: "string",
    plastic: ["#f4f1ea", "#2f8a5a", "#c8432b"],
  },
  lounge: {
    floor: { kind: "wood", a: "#3b3a38", b: "#2f2e2c" }, wall: "#24323f", trim: "#c9a77c",
    sign: { bg: "#c9a77c", fg: "#24323f", font: "serif" }, top: "#c9a77c", wood: "#2a2a28", chair: "#2d4a3e",
    counter: "espresso", counterBody: "#2a2a28", lights: "dim", lamp: "#ffb870", deco: ["neon", "plants"], neon: "#3c8a8a",
  },
  pub: {
    floor: { kind: "carpet", a: "#6a2027", b: "#c09a52" }, wall: "#24402f", trim: "#3b2416",
    sign: { bg: "#1a2a20", fg: "#d9b77a", font: "serif" }, top: "#5a3a26", wood: "#3b2416", chair: "#3b2416",
    backbar: "taps", lights: "dim", lamp: "#ffbf75", deco: ["frames", "mirrors"], shirt: "#2a2a28",
  },
  beerGarden: {
    floor: { kind: "grass", a: "#7f9a55" }, ground: "#6c8749", back: "hedge",
    sign: { bg: "#2d4a3e", fg: "#f4efe6", font: "serif" }, counter: "taps", counterBody: "#6b4428",
    lights: "string", deco: ["trees", "umbrellas"], umbrellas: ["#2d4a3e", "#f4efe6"],
  },
  biergarten: {
    floor: { kind: "paving", a: "#b8ad98", b: "#9c917c" }, ground: "#6c8749", back: "hedge",
    sign: { bg: "#2f5f9a", fg: "#ffffff", font: "serif" }, counter: "taps", counterBody: "#6b4428",
    lights: "string", deco: ["trees", "bunting"], bunting: ["#2f5f9a", "#f4efe6"], top: "#c9a77c", bench: "#c9a77c",
  },
  terrasse: {
    floor: { kind: "paving", a: "#b9b2a3", b: "#9f9887" }, ground: "#6f6a62", back: "shopfront", wall: "#e9e1cf", trim: "#7a2a24",
    sign: { bg: "#7a2a24", fg: "#f4efe6", font: "serif" }, counter: "espresso", counterBody: "#7a2a24",
    lights: "string", deco: ["awning", "plants"], awning: ["#7a2a24", "#f4efe6"], tableStyle: "bistro", chair: "#b58a4a",
  },
  bistro: {
    floor: { kind: "checker", a: "#f1ece2", b: "#7a2a24" }, wall: "#e9e1cf", trim: "#7a2a24",
    sign: { bg: "#7a2a24", fg: "#f4efe6", font: "serif" }, top: "#f4f1ea", wood: "#2a1d16", chair: "#b58a4a",
    backbar: "wine", lights: "bulbs", deco: ["mirrors", "frames"],
  },
  kneipe: {
    floor: { kind: "wood", a: "#6b4a2e", b: "#5a3d26" }, wall: "#d9c9a8", trim: "#3b2416",
    sign: { bg: "#2a2a28", fg: "#e9c46a", font: "serif" }, top: "#7d5a3a", wood: "#3b2416", chair: "#3b2416",
    backbar: "taps", lights: "dim", lamp: "#ffbf75", deco: ["frames", "clock"],
  },
  italianBar: {
    floor: { kind: "tile", a: "#e9e2d2", b: "#c9c4ba" }, wall: "#f0e6d0", trim: "#2d6b4a",
    sign: { bg: "#2d6b4a", fg: "#f4efe6", font: "serif" }, top: "#f4f1ea", wood: "#2a2a28", chair: "#2a2a28",
    backbar: "coffee", lights: "pendant", deco: ["mirrors"],
  },
  piazza: {
    floor: { kind: "paving", a: "#c2b49a", b: "#a8997e" }, ground: "#8a7c62", back: "shopfront", wall: "#e2b483", trim: "#2d6b4a",
    sign: { bg: "#2d6b4a", fg: "#f4efe6", font: "serif" }, counter: "espresso", counterBody: "#2d6b4a",
    lights: "string", deco: ["umbrellas", "plants"], umbrellas: ["#f4efe6", "#2d6b4a"], tableStyle: "bistro", chair: "#2a2a28",
  },
  tapas: {
    floor: { kind: "tile", a: "#c4703f", b: "#a85a30" }, wall: "#f1e8d8", trim: "#2f5f9a",
    sign: { bg: "#7a2a24", fg: "#f1e8d8", font: "serif" }, top: "#5a3a26", wood: "#3b2416", chair: "#3b2416",
    backbar: "wine", lights: "bulbs", deco: ["tiles", "frames"],
  },
  terraza: {
    floor: { kind: "tile", a: "#c4703f", b: "#a85a30" }, ground: "#8a6a4a", back: "shopfront", wall: "#f1e8d8", trim: "#2f5f9a",
    sign: { bg: "#2f5f9a", fg: "#f1e8d8", font: "serif" }, counter: "wine", counterBody: "#2f5f9a",
    lights: "string", deco: ["umbrellas", "plants"], umbrellas: ["#f1e8d8", "#2f5f9a"], tableStyle: "bistro",
  },
  diner: {
    floor: { kind: "checker", a: "#f4f1ea", b: "#b0302a" }, wall: "#f4f1ea", trim: "#b0302a",
    sign: { bg: "#b0302a", fg: "#ffffff", font: "sans" }, top: "#e8e4dc", bench: "#b0302a",
    counter: "espresso", counterBody: "#c9c4ba", lights: "pendant", deco: ["neon", "clock"], neon: "#e8433b",
  },
  americanBar: {
    floor: { kind: "wood", a: "#4a3a2c", b: "#3b2e22" }, wall: "#2a2f36", trim: "#7d5a3a",
    sign: { bg: "#2a2f36", fg: "#e8a33d", font: "sans" }, top: "#5a3a26", wood: "#2a2a28", chair: "#2a2a28",
    backbar: "bottles", lights: "dim", deco: ["neon", "frames"], neon: "#3c9adf",
  },
  taqueria: {
    floor: { kind: "concrete", a: "#b9a68a" }, ground: "#8a7c62", back: "shopfront", wall: "#e8433b", trim: "#2f8a5a",
    sign: { bg: "#2f8a5a", fg: "#ffffff", font: "sans" }, counter: "grill", counterBody: "#c9c4ba", lights: "string",
    deco: ["bunting"], bunting: ["#e8433b", "#2f8a5a", "#e2b23b", "#3c6adf", "#f4efe6"], plastic: ["#e2b23b", "#e8433b", "#3c6adf"],
  },
  cantina: {
    floor: { kind: "tile", a: "#c4703f", b: "#a85a30" }, wall: "#e9c48a", trim: "#2f8a5a",
    sign: { bg: "#2a2a28", fg: "#e9c48a", font: "serif" }, top: "#7d5a3a", wood: "#3b2416", chair: "#3b2416",
    backbar: "bottles", lights: "bulbs", deco: ["bunting", "frames"], bunting: ["#e8433b", "#2f8a5a", "#e2b23b", "#3c6adf"],
  },
  boteco: {
    floor: { kind: "tile", a: "#f1ece2", b: "#d9d3c6" }, ground: "#6f6a62", back: "shopfront", wall: "#f4f1ea", trim: "#2f6fa3",
    sign: { bg: "#e2b23b", fg: "#2a2a28", font: "sans" }, counter: "taps", counterBody: "#c9c4ba", lights: "fluor",
    plastic: ["#e2b23b", "#e2b23b", "#c8432b"],
  },
  padaria: {
    floor: { kind: "tile", a: "#f1ece2", b: "#d9d3c6" }, wall: "#f4f1ea", trim: "#c58b2a",
    sign: { bg: "#c58b2a", fg: "#ffffff", font: "serif" }, top: "#f4f1ea", wood: "#c9c4ba", chair: "#c9c4ba",
    backbar: "pastry", lights: "fluor", deco: ["clock"],
  },
  quiosque: {
    floor: { kind: "sand", a: "#e4d3a8" }, ground: "#e0cfa0", back: "beach",
    sign: { bg: "#2f8a8a", fg: "#ffffff", font: "sans" }, counter: "kiosk", counterBody: "#b58a5c",
    lights: "string", deco: ["trees", "umbrellas"], umbrellas: ["#2f8a8a", "#f4efe6"], top: "#c9a77c", bench: "#c9a77c",
  },
  aussieCafe: {
    floor: { kind: "concrete", a: "#c7c2b8" }, wall: "#f4f1ea", trim: "#3c6a5a",
    sign: { bg: "#3c6a5a", fg: "#f4f1ea", font: "sans" }, top: "#d8c3a0", wood: "#c9a77c", chair: "#3c6a5a",
    counter: "espresso", counterBody: "#3c6a5a", lights: "pendant", deco: ["plants", "slats"],
  },
  nightOwls: {
    floor: { kind: "wood", a: "#2f2e2c", b: "#262523" }, wall: "#1f2a38", trim: "#3c6a8a",
    sign: { bg: "#1f2a38", fg: "#9fd0e8", font: "sans", border: "#9fd0e8" }, top: "#3b3a38", bench: "#3c6a8a",
    counter: "espresso", counterBody: "#2a2a28", lights: "dim", lamp: "#9fc8ff", deco: ["neon", "plants"], neon: "#9fd0e8",
  },
};

// venue id (or country:id when the same id means different places) -> archetype plus small tweaks
const VENUES = {
  "ID:warkop": ["warung"],
  "ID:angkringan": ["angkringan"],
  "ID:kafe": ["kafeModern"],
  "MY:mamak": ["mamak"],
  "MY:kopitiam": ["kopitiam"],
  "MY:kafe": ["cafeLight", { wall: "#f1ebe0", sign: { bg: "#2d4a3e", fg: "#f1ebe0", font: "sans" } }],
  "SG:kopitiam": ["kopitiam", { trim: "#a63d24", sign: { bg: "#a63d24", fg: "#fff3d6", font: "serif" } }],
  "SG:hawker": ["hawker"],
  "SG:cafe": ["kafeModern", { neon: "#3c8a8a", sign: { bg: "#3c6a5a", fg: "#f2efe9", font: "sans" } }],
  "TH:streetfood": ["streetfood"],
  "TH:nightmarket": ["nightmarket", { lanterns: "#e2b23b", sign: { bg: "#2a2a28", fg: "#e2b23b", font: "sans" } }],
  "TH:cafe": ["cafeLight", { wall: "#eef3ee", trim: "#3c8a5a", sign: { bg: "#e8933d", fg: "#ffffff", font: "sans" } }],
  "VN:caphe": ["caphe"],
  "VN:biahoi": ["biahoi"],
  "VN:cafe": ["kissaten", { wall: "#6b4a2e", sign: { bg: "#e2b23b", fg: "#3b2416", font: "serif" }, deco: ["frames", "lanterns"], lanterns: "#e2b23b" }],
  "PH:carinderia": ["carinderia"],
  "PH:kapihan": ["cafeLight", { floor: { kind: "wood", a: "#8a6640", b: "#7a5834" }, wall: "#e9dcc0", sign: { bg: "#5a3a26", fg: "#f4efe6", font: "serif" } }],
  "PH:sarisari": ["sarisari"],
  "JP:kissaten": ["kissaten"],
  "JP:izakaya": ["izakaya"],
  "JP:yatai": ["yatai"],
  "KR:pocha": ["pocha"],
  "KR:cafe": ["cafeLight", { floor: { kind: "wood", a: "#e2d3bc", b: "#d4c3aa" }, wall: "#f7f4ee", sign: { bg: "#f7f4ee", fg: "#2a2a28", font: "sans", border: "#2a2a28" }, deco: ["plants", "slats"] }],
  "KR:hof": ["hof"],
  "TW:teahouse": ["teahouse"],
  "TW:nightmarket": ["nightmarket"],
  "TW:cafe": ["kafeModern", { wall: "#e9eef0", neon: "#e8933d" }],
  "IN:tapri": ["chaiStall"],
  "IN:irani": ["irani"],
  "IN:dhaba": ["dhaba"],
  "AE:karak": ["chaiStall", { wall: "#e6d5b5", awning: ["#8a2a24", "#f4efe6"], sign: { bg: "#8a2a24", fg: "#fff3d6", font: "sans" } }],
  "AE:majlis": ["majlis"],
  "AE:cafe": ["kafeModern", { wall: "#efe6d6", sign: { bg: "#3b2416", fg: "#d9a62e", font: "serif" } }],
  "TR:caybahcesi": ["teaGarden"],
  "TR:kahvehane": ["kahvehane"],
  "TR:meyhane": ["meyhane"],
  "EG:ahwa": ["chaiStall", { wall: "#d9c49a", trim: "#3d6b8c", sign: { bg: "#3d6b8c", fg: "#f4efe6", font: "sans" }, awning: ["#3d6b8c", "#f4efe6"] }],
  "EG:cafe": ["cafeLight", { wall: "#efe6d6", trim: "#3d6b8c" }],
  "NG:buka": ["buka"],
  "NG:joint": ["suya"],
  "NG:lounge": ["lounge"],
  "GB:pub": ["pub"],
  "GB:cafe": ["cafeLight", { wall: "#e9eef0", trim: "#24402f", sign: { bg: "#24402f", fg: "#f4efe6", font: "serif" } }],
  "GB:beergarden": ["beerGarden"],
  "FR:terrasse": ["terrasse"],
  "FR:bistro": ["bistro"],
  "FR:cave": ["wineBar"],
  "DE:biergarten": ["biergarten"],
  "DE:kneipe": ["kneipe"],
  "DE:cafe": ["cafeLight", { wall: "#f3ece0", sign: { bg: "#2a2a28", fg: "#f3ece0", font: "serif" }, backbar: "pastry" }],
  "IT:bar": ["italianBar"],
  "IT:piazza": ["piazza"],
  "IT:enoteca": ["wineBar", { wall: "#e2c9a0", trim: "#5a3a26", sign: { bg: "#5a2a2a", fg: "#f4efe6", font: "serif" } }],
  "ES:tapas": ["tapas"],
  "ES:terraza": ["terraza"],
  "ES:cafe": ["cafeLight", { floor: { kind: "tile", a: "#e9e2d2", b: "#c4703f" }, wall: "#f1e8d8", sign: { bg: "#2f5f9a", fg: "#f1e8d8", font: "serif" } }],
  "US:diner": ["diner"],
  "US:coffee": ["cafeLight", { floor: { kind: "concrete", a: "#b5b0a6" }, wall: "#e9e4dc", sign: { bg: "#2a2a28", fg: "#e9e4dc", font: "sans" } }],
  "US:bar": ["americanBar"],
  "MX:taqueria": ["taqueria"],
  "MX:cantina": ["cantina"],
  "MX:cafe": ["cafeLight", { wall: "#f1e1c8", trim: "#c4703f", sign: { bg: "#c4703f", fg: "#ffffff", font: "serif" } }],
  "BR:boteco": ["boteco"],
  "BR:padaria": ["padaria"],
  "BR:quiosque": ["quiosque"],
  "AU:cafe": ["aussieCafe"],
  "AU:pub": ["beerGarden", { floor: { kind: "paving", a: "#b8ad98", b: "#9c917c" }, sign: { bg: "#7a2a24", fg: "#f4efe6", font: "serif" }, umbrellas: ["#7a2a24", "#f4efe6"] }],
  "XX:lounge": ["lounge"],
  "XX:nightowl": ["nightOwls"],
};

const LAYOUT_DEFAULT = {
  bench: "warung", cafe: "cafeLight", mat: "angkringan", counter: "americanBar", street: "streetfood", garden: "beerGarden",
};

function merge(base, extra) {
  const out = { ...base };
  for (const [key, value] of Object.entries(extra || {})) {
    out[key] = value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])
      ? { ...base[key], ...value }
      : value;
  }
  return out;
}

function hashText(text) {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function toHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) {
    h = (g - b) / d + (g < b ? 6 : 0);
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return [h * 60, s, l];
}

function fromHsl(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${[f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, "0")).join("")}`;
}

// Nudge a colour's hue and lightness, never into the purple/violet band (250-320 degrees).
function nudge(hex, hueShift, lightShift) {
  if (typeof hex !== "string" || !hex.startsWith("#") || hex.length !== 7) {
    return hex;
  }
  const [h, s, l] = toHsl(hex);
  let hue = (h + hueShift + 360) % 360;
  if (s > 0.12 && hue > 250 && hue < 320) {
    hue = (h - hueShift + 360) % 360;
  }
  return fromHsl(hue, s, Math.max(0.04, Math.min(0.96, l + lightShift)));
}

// The same kind of venue in another city keeps its character but is not a copy:
// its own trim colour, wall and floor tone, and which side the plants and decor sit on.
function regionalise(theme, regionName) {
  const h = hashText(regionName.toLowerCase());
  const pick = (list, shift) => list[(h >>> shift) % list.length];
  const out = { ...theme };
  out.trim = nudge(theme.trim, pick([-28, -16, 0, 16, 28, 40], 0), pick([-0.06, 0, 0.05], 3));
  out.wall = nudge(theme.wall, pick([-10, 0, 10], 5), pick([-0.07, -0.03, 0.03, 0.06], 7));
  out.floor = { ...theme.floor, a: nudge(theme.floor.a, 0, pick([-0.08, -0.04, 0, 0.04], 9)) };
  out.counterBody = nudge(theme.counterBody, 0, pick([-0.06, 0, 0.05], 11));
  out.mirror = Boolean((h >>> 13) & 1);
  out.seed = h;

  // A branch in another city is fitted out differently, not just recoloured:
  // its own floor, lighting, wall art, extra decor and table arrangement.
  // The archetype's signature (checker floor, tatami, chochin, noren...) is kept.
  const indoor = theme.back === "wall";
  const fitout = (h >>> 15) % 3;
  out.fitout = fitout;
  const plainFloor = ["terrazzo", "concrete", "tile", "wood"].includes(theme.floor.kind);
  if (indoor && plainFloor && fitout === 1) {
    const plank = pick(["#b8956a", "#9a7550", "#c9a77c"], 19);
    out.floor = theme.floor.kind === "wood"
      ? { kind: "tile", a: nudge(theme.wall, 0, 0.03), b: nudge(theme.wall, 0, -0.1) }
      : { kind: "wood", a: plank, b: nudge(plank, 0, -0.06) };
  } else if (indoor && plainFloor && fitout === 2) {
    // the dark branch: charcoal tiles under timber walls
    const slate = pick(["#3b3c38", "#34383a", "#40392f"], 19);
    out.floor = { kind: "tile", a: slate, b: nudge(slate, 0, -0.05) };
  }
  if (indoor && ["bulbs", "pendant", "string"].includes(theme.lights) && fitout !== 0) {
    out.lights = theme.lights === "pendant" ? "bulbs" : "pendant";
  }
  const deco = [...theme.deco];
  const wallArt = ["posters", "frames", "mirrors", "slats", "lattice"];
  if (indoor && !deco.some((d) => wallArt.includes(d))) {
    deco.push(deco.includes("tv") ? "posters" : pick(["frames", "posters", "mirrors"], 25));
  }
  if (indoor && !deco.includes("clock") && (h >>> 27) & 1) {
    deco.push("clock");
  }
  if (!deco.includes("plants") && (h >>> 28) & 1) {
    deco.push("plants");
  }
  if (!indoor && !deco.includes("lanterns") && (h >>> 29) & 1) {
    deco.push("lanterns");
    out.lanterns = out.lanterns || "#ffb85c";
  }
  out.deco = deco;
  // seating and signage differ per branch too
  if (fitout !== 0) {
    out.chair = pick([theme.chair, nudge(theme.trim, 0, -0.05), "#7a2a24", "#2d4a3e", "#8a5a3b"], 17);
    out.top = nudge(theme.top, 0, fitout === 1 ? 0.08 : -0.08);
    out.sign = { ...theme.sign, bg: nudge(theme.sign.bg, pick([-24, 18, 30], 9), fitout === 1 ? 0.06 : -0.04) };
  }
  if (indoor && fitout === 2) {
    out.wall = nudge(theme.wall, pick([-14, 12], 23), -0.1);
  }
  // the back wall and the counter are what you see first, so a branch changes them too:
  // fitout 1 = warm wood counter and mirrors, fitout 2 = dark counter, wainscot panel and frames
  if (indoor && fitout !== 0) {
    const swap = fitout === 1 ? "mirrors" : "frames";
    out.deco = deco.map((d) => (d === "slats" ? swap : d)).filter((d, i, all) => all.indexOf(d) === i);
    out.counterBody = fitout === 1 ? "#6b4428" : nudge(theme.trim, 0, -0.18);
  }
  // the wall itself: plaster (fitout 0), exposed brick (1) or timber boards (2)
  if (indoor && !theme.wallFinish && fitout === 1) {
    out.wallFinish = "brick";
    out.wallFinishColor = pick(["#a4553a", "#9b4a32", "#b0664a"], 13);
  } else if (indoor && !theme.wallFinish && fitout === 2) {
    out.wallFinish = "boards";
    out.wallFinishColor = pick(["#6b4a33", "#5b3f2c", "#7a5639"], 13);
  }
  if (indoor && fitout === 2) {
    out.wainscot = nudge(theme.trim, 0, -0.08);
    out.wainscotRail = nudge(theme.trim, 0, 0.12);
  }
  // each fit-out seats people differently: round cafe tables (0), staggered square tables (1),
  // long communal tables with benches (2), so two branches never share a floor plan
  out.branch = {
    stagger: fitout === 1 ? pick([0.22, -0.22], 21) : 0,
    square: fitout === 1,
    communal: indoor && fitout === 2,
  };
  return out;
}

// Look up the theme for a venue in a country and city; every result has a stable id for tests.
export function themeFor(countryCode, venue, regionName = "") {
  const key = `${countryCode}:${venue.id}`;
  const entry = VENUES[key] || [LAYOUT_DEFAULT[venue.layout] || "warung"];
  const [archetype, tweaks] = entry;
  let theme = merge(merge(BASE, ARCHETYPES[archetype]), tweaks);
  const baseId = VENUES[key] ? key : `${venue.layout}:${archetype}`;
  if (regionName) {
    theme = regionalise(theme, regionName);
  }
  theme.id = regionName ? `${baseId}@${regionName.toLowerCase().replace(/\s+/g, "-")}` : baseId;
  theme.archetype = archetype;
  return theme;
}

export const THEMED_VENUES = Object.keys(VENUES);
