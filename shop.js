// The cafe as a small business: menu, prices in local money, stock, staff, customers and the day's books.
// Pure logic (no DOM). One game minute passes per real second while the store is open.

// ---------- what each drink takes ----------

// steps: the barista process, in order (bar.js knows how to animate and score each one)
// use: stock used per cup. cost: share of the default price that goes on ingredients.
export const RECIPES = {
  espresso:   { steps: ["grind", "tamp", "lock", "pull", "serve"], vessel: "cup", use: { beans: 18, cups: 1 }, weight: 1.0 },
  latte:      { steps: ["grind", "tamp", "lock", "pull", "steam", "art", "serve"], vessel: "cup", art: "heart", use: { beans: 18, milk: 180, cups: 1 }, weight: 1.4 },
  cappuccino: { steps: ["grind", "tamp", "lock", "pull", "steam", "art", "serve"], vessel: "cup", art: "rosetta", foam: true, use: { beans: 18, milk: 140, cups: 1 }, weight: 1.3 },
  iced:       { steps: ["grind", "tamp", "lock", "ice", "pull", "serve"], vessel: "glass", use: { beans: 18, milk: 150, ice: 1, syrup: 1, cups: 1 }, weight: 1.5 },
  tubruk:     { steps: ["grind", "scoop", "kettle", "stir", "serve"], vessel: "glass", coarse: true, use: { beans: 14, cups: 1 }, weight: 0.6 },
  kopisusu:   { steps: ["condensed", "grind", "scoop", "kettle", "stir", "serve"], vessel: "glass", coarse: true, use: { beans: 14, condensed: 1, cups: 1 }, weight: 0.8 },
  drip:       { steps: ["grind", "bloom", "kettle", "serve"], vessel: "cup", dripper: true, use: { beans: 16, cups: 1 }, weight: 1.5 },
};

export const STOCK = {
  beans:     { label: "Coffee beans", unit: "g", pack: 1000, packCost: 14, start: 1500, low: 200 },
  milk:      { label: "Fresh milk", unit: "ml", pack: 2000, packCost: 2.4, start: 3000, low: 400 },
  condensed: { label: "Condensed milk", unit: "cups", pack: 40, packCost: 1.6, start: 30, low: 5 },
  syrup:     { label: "Palm sugar syrup", unit: "cups", pack: 40, packCost: 2.0, start: 30, low: 5 },
  ice:       { label: "Ice", unit: "cups", pack: 60, packCost: 0.8, start: 40, low: 8 },
  cups:      { label: "Cups and glasses", unit: "", pack: 100, packCost: 3.0, start: 80, low: 12 },
};

// ---------- money ----------

// unit: what a plain espresso-sized coffee costs at an ordinary cafe there. step: how prices are rounded.
const MONEY = {
  ID: { currency: "IDR", locale: "id-ID", unit: 18000, step: 1000 },
  MY: { currency: "MYR", locale: "en-MY", unit: 7, step: 0.5 },
  SG: { currency: "SGD", locale: "en-SG", unit: 4.5, step: 0.1 },
  TH: { currency: "THB", locale: "th-TH", unit: 60, step: 5 },
  VN: { currency: "VND", locale: "vi-VN", unit: 30000, step: 1000 },
  PH: { currency: "PHP", locale: "en-PH", unit: 110, step: 5 },
  JP: { currency: "JPY", locale: "ja-JP", unit: 450, step: 10 },
  KR: { currency: "KRW", locale: "ko-KR", unit: 4500, step: 100 },
  TW: { currency: "TWD", locale: "zh-TW", unit: 90, step: 5 },
  IN: { currency: "INR", locale: "en-IN", unit: 160, step: 5 },
  AE: { currency: "AED", locale: "en-AE", unit: 16, step: 1 },
  TR: { currency: "TRY", locale: "tr-TR", unit: 80, step: 5 },
  EG: { currency: "EGP", locale: "en-EG", unit: 60, step: 5 },
  NG: { currency: "NGN", locale: "en-NG", unit: 2500, step: 50 },
  GB: { currency: "GBP", locale: "en-GB", unit: 3.2, step: 0.1 },
  FR: { currency: "EUR", locale: "fr-FR", unit: 2.8, step: 0.1 },
  DE: { currency: "EUR", locale: "de-DE", unit: 3.0, step: 0.1 },
  IT: { currency: "EUR", locale: "it-IT", unit: 1.5, step: 0.1 },
  ES: { currency: "EUR", locale: "es-ES", unit: 1.8, step: 0.1 },
  US: { currency: "USD", locale: "en-US", unit: 3.5, step: 0.25 },
  MX: { currency: "MXN", locale: "es-MX", unit: 45, step: 5 },
  BR: { currency: "BRL", locale: "pt-BR", unit: 8, step: 0.5 },
  AU: { currency: "AUD", locale: "en-AU", unit: 4.8, step: 0.1 },
  XX: { currency: "USD", locale: "en-US", unit: 3.5, step: 0.25 },
};

export function money(countryCode) {
  return MONEY[countryCode] || MONEY.XX;
}

export function formatMoney(amount, countryCode) {
  const m = money(countryCode);
  const decimals = m.step < 1 ? 2 : 0;
  try {
    return new Intl.NumberFormat(m.locale, { style: "currency", currency: m.currency, maximumFractionDigits: decimals, minimumFractionDigits: decimals }).format(amount);
  } catch (error) {
    return `${m.currency} ${amount.toFixed(decimals)}`;
  }
}

export const roundTo = (value, step) => Math.max(step, Math.round(value / step) * step);

// Street and neighbourhood places charge less than a sit-down cafe.
const CHEAP = new Set(["warkop", "angkringan", "mamak", "streetfood", "caphe", "sarisari", "carinderia", "hawker", "tapri",
  "irani", "dhaba", "ahwa", "kahvehane", "caybahcesi", "padaria", "buka", "yatai", "pocha", "nightmarket", "karak",
  "taqueria", "boteco", "quiosque", "kopitiam"]);

// ---------- menus ----------

const SETS = {
  warkop: [["tubruk", "Kopi tubruk"], ["kopisusu", "Kopi susu"], ["iced", "Es kopi susu"]],
  angkringan: [["tubruk", "Kopi joss"], ["kopisusu", "Kopi susu"]],
  kopitiam: [["tubruk", "Kopi O"], ["kopisusu", "Kopi"], ["iced", "Kopi peng"]],
  hawker: [["tubruk", "Kopi O"], ["kopisusu", "Kopi"], ["iced", "Kopi peng"]],
  mamak: [["tubruk", "Kopi O"], ["kopisusu", "Kopi tarik"], ["iced", "Kopi ais"]],
  caphe: [["tubruk", "Ca phe den"], ["kopisusu", "Ca phe sua nong"], ["iced", "Ca phe sua da"]],
  kissaten: [["drip", "Hand drip blend"], ["latte", "Cafe au lait"], ["espresso", "Espresso"]],
  kapihan: [["tubruk", "Kapeng barako"], ["latte", "Latte"], ["iced", "Iced coffee"]],
  ahwa: [["tubruk", "Ahwa"], ["kopisusu", "Coffee with milk"]],
  kahvehane: [["tubruk", "Turk kahvesi"], ["kopisusu", "Sutlu kahve"]],
  caybahcesi: [["tubruk", "Turk kahvesi"], ["kopisusu", "Sutlu kahve"]],
  irani: [["kopisusu", "Filter coffee"], ["tubruk", "Black coffee"]],
  tapri: [["kopisusu", "Filter coffee"], ["tubruk", "Black coffee"]],
  dhaba: [["kopisusu", "Filter coffee"], ["tubruk", "Black coffee"]],
  padaria: [["espresso", "Cafezinho"], ["kopisusu", "Pingado"], ["latte", "Cafe com leite"]],
  kafe_ID: [["espresso", "Espresso"], ["latte", "Kafe latte"], ["cappuccino", "Cappuccino"], ["iced", "Es kopi susu gula aren"]],
  cafe_AU: [["latte", "Flat white"], ["espresso", "Long black"], ["cappuccino", "Cappuccino"], ["iced", "Iced latte"]],
  cafe_IT: [["espresso", "Espresso"], ["cappuccino", "Cappuccino"], ["latte", "Latte macchiato"]],
  default: [["espresso", "Espresso"], ["latte", "Latte"], ["cappuccino", "Cappuccino"], ["iced", "Iced latte"], ["drip", "Pour-over"]],
};

export function menuFor(venueId, countryCode) {
  const set = SETS[`${venueId}_${countryCode}`] || SETS[venueId] || (countryCode === "IT" ? SETS.cafe_IT : null) ||
    SETS[`cafe_${countryCode}`] || SETS.default;
  const m = money(countryCode);
  const level = CHEAP.has(venueId) ? 0.5 : 1;
  return set.map(([recipe, name]) => {
    const base = roundTo(m.unit * level * RECIPES[recipe].weight, m.step);
    return { id: recipe, recipe, name, base, cost: base * 0.28 };
  });
}

// ---------- staff you can hire ----------

const CANDIDATES = [
  { name: "Sari", skill: 0.9 }, { name: "Budi", skill: 0.75 }, { name: "Rina", skill: 1.05 },
  { name: "Dimas", skill: 0.85 }, { name: "Ayu", skill: 1.15 }, { name: "Joko", skill: 0.7 },
];

// ---------- the shop ----------

export function newShop({ countryCode, venueId, venueName, regionName, hour = 8 }) {
  const menu = menuFor(venueId, countryCode);
  const m = money(countryCode);
  const unit = m.unit;
  const stock = Object.fromEntries(Object.entries(STOCK).map(([key, s]) => [key, s.start]));
  return {
    v: 1,
    countryCode,
    venueId,
    name: `${venueName} ${regionName}`,
    open: false,
    day: 1,
    minute: hour * 60,          // game clock, minutes since midnight
    cash: roundTo(unit * 120, m.step),
    prices: Object.fromEntries(menu.map((item) => [item.id, item.base])),
    stock,
    staff: [],
    candidates: pickCandidates(1),
    rating: 4.2,
    ratings: 0,
    queue: [],                  // waiting orders
    seq: 1,
    today: blankDay(),
    history: [],                // closed days: { day, revenue, costs, profit, cups }
    ledger: [],                 // last 40 money movements
    spawnDebt: 0,
  };
}

function blankDay() {
  return { revenue: 0, tips: 0, purchases: 0, wages: 0, rent: 0, cups: 0, walkouts: 0, waitTotal: 0, byHour: Array(24).fill(0), quality: [] };
}

function pickCandidates(seed) {
  const list = [];
  for (let i = 0; i < 3; i++) {
    const c = CANDIDATES[(seed * 7 + i * 3) % CANDIDATES.length];
    list.push({ ...c });
  }
  return list;
}

export function wageFor(shop, skill) {
  const m = money(shop.countryCode);
  return roundTo(m.unit * 0.55 * skill, m.step);   // per game hour
}

export function rentFor(shop) {
  const m = money(shop.countryCode);
  const level = CHEAP.has(shop.venueId) ? 0.5 : 1;
  return roundTo(m.unit * 18 * level, m.step);        // per day
}

function book(shop, amount, note) {
  shop.cash = +(shop.cash + amount).toFixed(2);
  shop.ledger.unshift({ day: shop.day, minute: Math.round(shop.minute), amount: +amount.toFixed(2), note });
  shop.ledger.length = Math.min(shop.ledger.length, 40);
}

export function menuOf(shop) {
  return menuFor(shop.venueId, shop.countryCode).map((item) => ({ ...item, price: shop.prices[item.id] ?? item.base }));
}

export function canMake(shop, recipeId) {
  const use = RECIPES[recipeId].use;
  return Object.entries(use).every(([key, amount]) => (shop.stock[key] || 0) >= amount);
}

function useStock(shop, recipeId) {
  for (const [key, amount] of Object.entries(RECIPES[recipeId].use)) {
    shop.stock[key] = Math.max(0, (shop.stock[key] || 0) - amount);
  }
}

export function buyStock(shop, key) {
  const s = STOCK[key];
  const m = money(shop.countryCode);
  const cost = roundTo(s.packCost * m.unit / 3.5, m.step);
  if (shop.cash < cost) {
    return { ok: false, reason: "Not enough cash" };
  }
  shop.stock[key] = (shop.stock[key] || 0) + s.pack;
  shop.today.purchases += cost;
  book(shop, -cost, `Bought ${s.label.toLowerCase()}`);
  return { ok: true, cost };
}

export function packCost(shop, key) {
  const m = money(shop.countryCode);
  return roundTo(STOCK[key].packCost * m.unit / 3.5, m.step);
}

export function setPrice(shop, id, price) {
  const m = money(shop.countryCode);
  shop.prices[id] = roundTo(Math.max(m.step, price), m.step);
}

export function hire(shop, index) {
  const c = shop.candidates[index];
  if (!c || shop.staff.length >= 3) {
    return false;
  }
  shop.staff.push({ name: c.name, skill: c.skill, wage: wageFor(shop, c.skill), busy: null, done: 0 });
  shop.candidates.splice(index, 1);
  if (!shop.candidates.length) {
    shop.candidates = pickCandidates(shop.day + shop.staff.length);
  }
  return true;
}

export function letGo(shop, index) {
  shop.staff.splice(index, 1);
}

export function openStore(shop) {
  shop.open = true;
}

export function closeStore(shop) {
  if (!shop.open) {
    return null;
  }
  shop.open = false;
  const rent = rentFor(shop);
  shop.today.rent = rent;
  book(shop, -rent, "Rent for the day");
  const t = shop.today;
  const costs = t.purchases + t.wages + t.rent;
  const summary = { day: shop.day, revenue: +(t.revenue + t.tips).toFixed(2), costs: +costs.toFixed(2), profit: +(t.revenue + t.tips - costs).toFixed(2), cups: t.cups, walkouts: t.walkouts };
  shop.history.unshift(summary);
  shop.history.length = Math.min(shop.history.length, 14);
  shop.queue = shop.queue.filter((o) => o.source !== "walk-in");
  shop.staff.forEach((s) => {
    s.busy = null;
  });
  shop.day += 1;
  shop.today = blankDay();
  shop.candidates = pickCandidates(shop.day);
  return summary;
}

// How busy the place is by hour: morning rush, lunch, after-work, and quiet at night.
export function hourCurve(hour, venueId) {
  const late = new Set(["warkop", "angkringan", "mamak", "pub", "izakaya", "bar", "nightowl", "biahoi", "pocha", "kneipe"]).has(venueId);
  const h = hour % 24;
  if (h < 6) {
    return late ? 0.35 : 0.05;
  }
  if (h < 7) {
    return 0.5;
  }
  if (h < 10) {
    return 1.35;
  }
  if (h < 12) {
    return 0.8;
  }
  if (h < 14) {
    return 1.1;
  }
  if (h < 16) {
    return 0.75;
  }
  if (h < 19) {
    return 1.0;
  }
  if (h < 22) {
    return late ? 1.25 : 0.6;
  }
  return late ? 0.8 : 0.25;
}

// Higher prices than the local norm scare people off; lower prices bring more in.
export function priceFactor(shop) {
  const menu = menuOf(shop);
  const ratio = menu.reduce((sum, item) => sum + item.price / item.base, 0) / menu.length;
  return Math.min(1.7, Math.max(0.2, Math.pow(1 / ratio, 1.6)));
}

export function arrivalsPerMinute(shop) {
  const hour = Math.floor(shop.minute / 60) % 24;
  return 0.22 * hourCurve(hour, shop.venueId) * priceFactor(shop) * (0.55 + 0.45 * (shop.rating / 5));
}

const FIRST = ["Rina", "Ahmad", "Sari", "Budi", "Dewi", "Tono", "Lia", "Eko", "Maya", "Hendra", "Putri", "Fajar", "Nina", "Arif", "Wulan", "Yusuf"];

export function addOrder(shop, { recipe, who, source = "walk-in", table = null, peer = null, paid = null, run = null }) {
  const menu = menuOf(shop);
  const item = menu.find((x) => x.id === recipe);
  if (!item) {
    return { ok: false, reason: "Not on the menu here" };
  }
  if (!canMake(shop, recipe)) {
    return { ok: false, reason: `Out of stock for ${item.name}` };
  }
  const order = {
    id: `o${shop.day}-${shop.seq++}`,
    recipe,
    name: item.name,
    price: item.price,
    who,
    source,
    table,
    peer,
    paid,
    run,
    placed: shop.minute,
    patience: source === "walk-in" ? 14 + Math.random() * 10 : 60,
    by: null,
  };
  shop.queue.push(order);
  return { ok: true, order };
}

// A finished cup: money in, stock out, rating nudged by quality and wait.
export function serve(shop, orderId, { quality = 0.8, by = "you" } = {}) {
  const index = shop.queue.findIndex((o) => o.id === orderId);
  if (index < 0) {
    return null;
  }
  const order = shop.queue[index];
  shop.queue.splice(index, 1);
  useStock(shop, order.recipe);
  const m = money(shop.countryCode);
  const wait = Math.max(0, shop.minute - order.placed);
  const tip = quality >= 0.9 ? roundTo(order.price * 0.15, m.step) : quality >= 0.75 ? roundTo(order.price * 0.05, m.step) : 0;
  const tipNow = tip >= m.step ? tip : 0;
  shop.today.revenue += order.price;
  shop.today.tips += tipNow;
  shop.today.cups += 1;
  shop.today.waitTotal += wait;
  shop.today.quality.push(quality);
  shop.today.byHour[Math.floor(shop.minute / 60) % 24] += order.price + tipNow;
  book(shop, order.price + tipNow, `${order.name} for ${order.who}${tipNow ? " (with tip)" : ""}`);
  const stars = Math.max(1, Math.min(5, 2.2 + quality * 3 - Math.max(0, wait - 8) * 0.06));
  shop.ratings += 1;
  const weight = Math.min(30, shop.ratings + 10);
  shop.rating = +((shop.rating * (weight - 1) + stars) / weight).toFixed(2);
  return { order, tip: tipNow, wait, stars, by };
}

function walkout(shop, order) {
  const index = shop.queue.indexOf(order);
  if (index >= 0) {
    shop.queue.splice(index, 1);
  }
  shop.today.walkouts += 1;
  shop.ratings += 1;
  const weight = Math.min(30, shop.ratings + 10);
  shop.rating = +((shop.rating * (weight - 1) + 1.5) / weight).toFixed(2);
}

// Advance the shop by some game minutes. claimed: order ids the player is making right now.
// Returns what happened so the page can show it (served cups, walk-outs, new customers).
export function tick(shop, minutes, { claimed = new Set(), random = Math.random } = {}) {
  const events = [];
  if (!shop.open) {
    return events;
  }
  for (let step = 0; step < minutes; step++) {
    shop.minute += 1;
    if (shop.minute >= 24 * 60) {
      shop.minute -= 24 * 60;
    }
    // wages accrue every game minute
    for (const s of shop.staff) {
      const pay = s.wage / 60;
      shop.today.wages += pay;
      shop.cash -= pay;
    }
    // new walk-in customers
    shop.spawnDebt += arrivalsPerMinute(shop);
    while (shop.spawnDebt >= 1 || random() < shop.spawnDebt * 0.02) {
      shop.spawnDebt = Math.max(0, shop.spawnDebt - 1);
      const menu = menuOf(shop).filter((x) => canMake(shop, x.id));
      if (!menu.length || shop.queue.length >= 12) {
        break;
      }
      const pick = menu[Math.floor(random() * menu.length)];
      const who = FIRST[Math.floor(random() * FIRST.length)];
      const result = addOrder(shop, { recipe: pick.id, who });
      if (result.ok) {
        events.push({ type: "arrive", order: result.order });
      }
    }
    // staff make drinks, oldest first, skipping what the player has claimed
    for (const s of shop.staff) {
      if (s.busy) {
        s.busy.left -= s.skill;
        if (s.busy.left <= 0) {
          const done = serve(shop, s.busy.id, { quality: Math.min(0.97, 0.62 + s.skill * 0.25 + random() * 0.08), by: s.name });
          s.busy = null;
          s.done += 1;
          if (done) {
            events.push({ type: "served", ...done });
          }
        }
      }
      if (!s.busy) {
        const next = shop.queue.find((o) => !claimed.has(o.id) && !o.by);
        if (next) {
          next.by = s.name;
          s.busy = { id: next.id, left: RECIPES[next.recipe].steps.length * 0.9 + 1.5 };
        }
      }
    }
    // walk-ins give up if they wait too long (table orders and coffee runs wait)
    for (const order of [...shop.queue]) {
      if (order.source === "walk-in" && !order.by && !claimed.has(order.id) && shop.minute - order.placed > order.patience) {
        walkout(shop, order);
        events.push({ type: "walkout", order });
      }
    }
  }
  shop.cash = +shop.cash.toFixed(2);
  return events;
}

export function lowStock(shop) {
  return Object.entries(STOCK).filter(([key, s]) => (shop.stock[key] || 0) < s.low).map(([key]) => key);
}

export function clockText(minute) {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
