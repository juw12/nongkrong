// Roles in a place: guest (sit and chat), barista (make the orders at the bar) and owner (run the store).
// Also the CrewCup layer: a company coffee allowance and table coffee runs.
//
// Versions (see versions.html): ?host=nongkrong|crewcup picks the shell, ?cam=fp|tp|mix the barista camera.
// The defaults below are the version judged best.

import * as S from "./shop.js";
import { setMuted, isMuted, unlock } from "./asmr.js";

export const DEFAULT_HOST = "nongkrong";
export const DEFAULT_CAM = "mix";

const params = new URLSearchParams(location.search);
const HOST = params.get("host") === "crewcup" ? "crewcup" : params.get("host") === "nongkrong" ? "nongkrong" : DEFAULT_HOST;
const CAMS = ["fp", "tp", "mix"];
const CAM_LABEL = { fp: "Your eyes", tp: "Over the shoulder", mix: "Mix" };

const ROLES = HOST === "crewcup"
  ? [["home", "Home", "Allowance and coffee runs"], ["guest", "Lounge", "Sit with your crew"], ["barista", "Bar", "Make the orders"], ["owner", "Cafe", "Run the store"]]
  : [["guest", "Guest", "Sit and talk"], ["barista", "Barista", "Make the orders"], ["owner", "Owner", "Run the store"]];

const SURFACE = { espresso: "#6b3b1c", latte: "#c9a27a", cappuccino: "#d8b993", iced: "#9a6a42", tubruk: "#2d1b0f", kopisusu: "#8a5a34", drip: "#4a2a16" };

export function initCafe(app) {
  const { $, el, toast, store } = app;
  const c = {
    host: HOST,
    role: params.get("role") && ROLES.some(([id]) => id === params.get("role")) ? params.get("role") : (HOST === "crewcup" ? "home" : "guest"),
    cam: CAMS.includes(params.get("cam")) ? params.get("cam") : (store.get("cam", null) || DEFAULT_CAM),
    shop: null,
    shopKey: null,
    bar: null,
    barLoading: false,
    making: null,            // order id I am making at the bar
    mine: [],                // my orders as a guest: { id, name, recipe, status, by, table, seat, at }
    served: [],              // drinks on tables: { table, seat, kind, color, until }
    sitting: [],             // customers who stay a while after their drink: { id, who, until, recipe }
    remote: new Map(),       // order id -> peer id, for orders other people sent to my bar
    run: null,               // coffee run at my table
    sendCafe: null,
    sendRun: null,
    lastSave: 0,
  };
  const wallet = loadWallet();

  // Panels here refresh every second; never rebuild one while a finger or mouse button is down on it,
  // or the click would land on a button that no longer exists.
  let pressedIn = null;
  addEventListener("pointerdown", (event) => {
    pressedIn = event.target instanceof Element ? event.target : null;
  }, true);
  addEventListener("pointerup", () => {
    setTimeout(() => {
      pressedIn = null;
    }, 0);
  }, true);
  const busy = (root) => Boolean(pressedIn && root && root.contains(pressedIn));

  // ---------- money and places ----------

  const place = () => app.place();
  const cc = () => place().countryCode;
  const fmt = (amount) => S.formatMoney(amount, cc());

  function loadWallet() {
    const today = new Date().toISOString().slice(0, 10);
    const saved = store.get("crewcup", null);
    const w = saved && typeof saved === "object" ? saved : { linked: HOST === "crewcup", company: "PT Nusantara Digital", spent: 0, date: today, usual: null, history: [] };
    if (w.date !== today) {
      w.date = today;
      w.spent = 0;
    }
    if (HOST === "crewcup") {
      w.linked = true;
    }
    return w;
  }
  const saveWallet = () => store.set("crewcup", wallet);
  const allowance = () => S.roundTo(S.money(cc()).unit * 3, S.money(cc()).step);
  const allowanceLeft = () => Math.max(0, allowance() - wallet.spent);

  function shopKeyFor(p) {
    return `shop:${p.countryCode}:${p.regionId}:${p.venue.id}`;
  }

  function loadShop() {
    const p = place();
    const key = shopKeyFor(p);
    if (c.shopKey === key) {
      return;
    }
    saveShop(true);
    c.shopKey = key;
    const saved = store.get(key, null);
    c.shop = saved && saved.v === 1 && saved.countryCode === p.countryCode ? saved : S.newShop({
      countryCode: p.countryCode, venueId: p.venue.id, venueName: p.venue.name, regionName: p.regionName, hour: app.hour(),
    });
    // a shop on this device keeps going only while the page is open; reloads start with an empty floor
    c.shop.queue = c.shop.queue.filter((o) => o.source !== "walk-in");
    c.shop.staff.forEach((s) => {
      s.busy = null;
    });
    c.sitting = [];
    c.served = c.served.filter((d) => d.key === key);
    c.making = null;
    c.bar?.clear();
  }

  function saveShop(force = false) {
    if (!c.shop || !c.shopKey) {
      return;
    }
    if (force || Date.now() - c.lastSave > 4000) {
      c.lastSave = Date.now();
      store.set(c.shopKey, c.shop);
    }
  }

  // ---------- the room: orders between guests and whoever works the bar ----------

  function attachRegionRoom(room) {
    const [send, receive] = room.makeAction("cafe");
    c.sendCafe = send;
    receive((data, peer) => {
      if (!data || typeof data !== "object" || typeof data.t !== "string") {
        return;
      }
      const p = place();
      if (data.venue !== p.venue.id) {
        return;
      }
      if (data.t === "order" && c.role === "barista" && c.shop) {
        const recipe = String(data.recipe || "");
        if (!S.RECIPES[recipe]) {
          return;
        }
        const who = String(data.who || "Guest").slice(0, 24);
        const table = Number.isInteger(data.table) ? data.table : null;
        if (!c.shop.open) {
          S.openStore(c.shop);
        }
        const result = S.addOrder(c.shop, { recipe, who, source: "table", table, peer, paid: data.paid === "crewcup" ? "crewcup" : "cash", run: data.run || null });
        if (result.ok) {
          c.remote.set(result.order.id, { peer, ref: String(data.ref || "") });
          send({ t: "ack", venue: p.venue.id, ref: data.ref, by: app.name(), id: result.order.id }, peer);
          toast(`New order from ${who}: ${result.order.name}`);
          render();
        } else {
          send({ t: "nack", venue: p.venue.id, ref: data.ref, reason: result.reason }, peer);
        }
      } else if (data.t === "ack") {
        const mine = c.mine.find((o) => o.ref === data.ref);
        if (mine) {
          mine.status = "making";
          mine.by = String(data.by || "the barista").slice(0, 24);
          renderGuest();
        }
      } else if (data.t === "nack") {
        const mine = c.mine.find((o) => o.ref === data.ref);
        if (mine) {
          mine.status = "cancelled";
          toast(`Order not taken: ${String(data.reason || "the bar is busy").slice(0, 60)}`);
          renderGuest();
        }
      } else if (data.t === "served") {
        const mine = c.mine.find((o) => o.ref === data.ref);
        if (mine) {
          deliver(mine, String(data.by || "the barista").slice(0, 24), Number(data.quality) || 0.8);
        }
      }
    });
  }

  function attachTableRoom(room) {
    const [send, receive] = room.makeAction("run");
    c.sendRun = send;
    c.run = null;
    receive((data, peer) => {
      if (!data || typeof data !== "object") {
        return;
      }
      if (data.t === "start" && !c.run) {
        c.run = { id: String(data.id), runner: String(data.runner || "Someone").slice(0, 24), runnerPeer: peer, closes: Date.now() + Math.min(120000, Number(data.ms) || 60000), items: [] };
        app.logLine(`${c.run.runner} started a coffee run. Add yours before it closes.`);
        renderGuest();
      } else if (data.t === "join" && c.run && data.id === c.run.id) {
        const recipe = String(data.recipe || "");
        if (S.RECIPES[recipe] && !c.run.items.some((x) => x.peer === peer)) {
          c.run.items.push({ peer, who: String(data.who || "Guest").slice(0, 24), recipe, seat: Number.isInteger(data.seat) ? data.seat : null });
          renderGuest();
        }
      } else if (data.t === "close" && c.run && data.id === c.run.id) {
        app.logLine(`Coffee run sent to the bar: ${c.run.items.length} ${c.run.items.length === 1 ? "drink" : "drinks"}.`);
        c.run = null;
        renderGuest();
      }
    });
  }

  function baristaOnline() {
    const p = place();
    return app.people().find(([id, x]) => id !== app.myId && x.venue === p.venue.id && x.role === "barista");
  }

  // Place an order as a guest. Goes to a barista online here, else to my own store if it is open,
  // else to the house barista of the place.
  function order(recipe, { paid = "cash", run = null, who = app.name(), seat = null, quiet = false } = {}) {
    const p = place();
    const seatNow = app.seat();
    const table = seatNow ? seatNow.table : null;
    const item = S.menuFor(p.venue.id, p.countryCode).find((x) => x.id === recipe);
    if (!item) {
      return false;
    }
    const price = c.shop?.prices[recipe] ?? item.base;
    if (paid === "crewcup") {
      if (!wallet.linked) {
        toast("Link your CrewCup work account first.");
        return false;
      }
      if (allowanceLeft() < price && who === app.name()) {
        toast(`Not enough allowance left today (${fmt(allowanceLeft())}).`);
        return false;
      }
      if (who === app.name()) {
        wallet.spent += price;
        wallet.usual = recipe;
        wallet.history.unshift({ name: item.name, price, at: Date.now(), place: `${p.venue.name}, ${p.regionName}` });
        wallet.history.length = Math.min(wallet.history.length, 12);
        saveWallet();
      }
    }
    const ref = Math.random().toString(36).slice(2, 10);
    const mine = { ref, id: null, name: item.name, recipe, status: "sent", by: null, table, seat: seat ?? seatNow?.seat ?? null, at: Date.now(), paid, who };
    c.mine.unshift(mine);
    c.mine.length = Math.min(c.mine.length, 8);
    const remote = baristaOnline();
    if (remote && c.sendCafe) {
      c.sendCafe({ t: "order", venue: p.venue.id, recipe, who, table, paid, ref, run }, remote[0]);
      mine.status = "sent";
      if (!quiet) {
        toast(`Sent to ${remote[1].name} at the bar.`);
      }
    } else if (c.shop?.open) {
      const result = S.addOrder(c.shop, { recipe, who, source: "table", table, paid, run });
      if (!result.ok) {
        mine.status = "cancelled";
        toast(result.reason);
      } else {
        mine.id = result.order.id;
        mine.status = "waiting";
        result.order.ref = ref;
        if (!quiet) {
          toast(c.shop.staff.length ? `${item.name} ordered. Your staff will make it.` : `${item.name} ordered. Nobody is on the bar: go to Barista and make it.`);
        }
      }
    } else {
      mine.status = "making";
      mine.by = "the house barista";
      setTimeout(() => deliver(mine, "the house barista", 0.85), 9000 + Math.random() * 7000);
      if (!quiet) {
        toast(`${item.name} ordered from the counter.`);
      }
    }
    renderGuest();
    return true;
  }

  function deliver(mine, by, quality) {
    if (mine.status === "served") {
      return;
    }
    mine.status = "served";
    mine.by = by;
    const seatNow = app.seat();
    const table = mine.table ?? seatNow?.table;
    const seat = mine.seat ?? seatNow?.seat;
    if (table != null && seat != null) {
      c.served = c.served.filter((d) => !(d.table === table && d.seat === seat));
      c.served.push({ key: c.shopKey, table, seat, kind: S.RECIPES[mine.recipe].vessel === "glass" ? "glass" : "cup", color: SURFACE[mine.recipe], until: Date.now() + 15 * 60000 });
    }
    if (mine.who === app.name()) {
      toast(`Your ${mine.name} is here, made by ${by}.`);
      app.logLine(`${by} brought your ${mine.name}.`);
    }
    renderGuest();
    app.requestSync();
  }

  // ---------- the clock: customers, staff and wages ----------

  function claimed() {
    return new Set(c.making ? [c.making] : []);
  }

  function onServed(result) {
    const o = result.order;
    // a guest of mine on this device, a guest elsewhere, or a walk-in who now sits down for a while
    const mine = c.mine.find((x) => x.id === o.id || (o.ref && x.ref === o.ref));
    if (mine) {
      deliver(mine, result.by === "you" ? "you" : result.by, 0.8);
    }
    const remote = c.remote.get(o.id);
    if (remote && c.sendCafe) {
      c.sendCafe({ t: "served", venue: place().venue.id, ref: remote.ref, by: app.name(), quality: result.quality ?? 0.8 }, remote.peer);
      c.remote.delete(o.id);
    }
    if (o.source === "walk-in") {
      c.sitting.push({ id: o.id, who: o.who, recipe: o.recipe, until: Date.now() + (40 + Math.random() * 50) * 1000 });
      if (c.sitting.length > 12) {
        c.sitting.shift();
      }
    }
  }

  setInterval(() => {
    if (!c.shop) {
      return;
    }
    const events = S.tick(c.shop, 1, { claimed: claimed() });
    let changed = events.length > 0;
    for (const e of events) {
      if (e.type === "served") {
        onServed(e);
      } else if (e.type === "walkout" && (c.role === "owner" || c.role === "barista")) {
        toast(`${e.order.who} gave up waiting for a ${e.order.name}.`);
      }
    }
    const now = Date.now();
    const before = c.sitting.length + c.served.length;
    c.sitting = c.sitting.filter((x) => x.until > now);
    c.served = c.served.filter((x) => x.until > now);
    changed = changed || before !== c.sitting.length + c.served.length;
    if (c.run && c.run.runnerPeer === "me" && now >= c.run.closes) {
      closeRun();
      changed = true;
    }
    saveShop();
    if (c.role === "owner") {
      renderOwner();
    } else if (c.role === "barista") {
      renderBarSide();
    }
    if (c.run) {
      renderGuest();
    }
    if (changed) {
      app.requestSync();
    }
  }, 1000);

  // ---------- 3D: customers sitting at free seats, drinks on the tables ----------

  function npcPeople(realPeople) {
    if (!c.shop) {
      return [];
    }
    const p = place();
    const tables = app.tables();
    const taken = new Set(realPeople.filter((x) => x.table != null && x.seat != null).map((x) => `${x.table}:${x.seat}`));
    const crowd = [...c.sitting, ...c.shop.queue.filter((o) => o.source === "walk-in").map((o) => ({ id: o.id, who: o.who }))];
    const out = [];
    let cursor = 0;
    const seats = [];
    tables.forEach((t) => {
      for (let s = 0; s < t.seats; s++) {
        seats.push([t.n, s]);
      }
    });
    // spread people out: walk the seat list with a stride so they do not all pile onto table 1
    const stride = 5;
    for (const person of crowd) {
      let placed = false;
      for (let tries = 0; tries < seats.length && !placed; tries++) {
        const [table, seat] = seats[(cursor * stride + tries) % seats.length];
        const key = `${table}:${seat}`;
        if (!taken.has(key)) {
          taken.add(key);
          out.push({ id: `npc:${person.id}`, name: person.who, table, seat, voice: false });
          placed = true;
        }
      }
      cursor += 1;
    }
    return p ? out : [];
  }

  function drinks(npcs) {
    const list = c.served.filter((d) => d.key === c.shopKey).map(({ table, seat, kind, color }) => ({ table, seat, kind, color }));
    for (const n of npcs) {
      const id = n.id.slice(4);
      const sat = c.sitting.find((x) => x.id === id);
      if (sat) {
        list.push({ table: n.table, seat: n.seat, kind: S.RECIPES[sat.recipe].vessel === "glass" ? "glass" : "cup", color: SURFACE[sat.recipe] });
      }
    }
    return list;
  }

  // ---------- coffee runs (CrewCup) ----------

  function startRun() {
    if (!app.seat() || !c.sendRun) {
      toast("Sit at a table to start a coffee run.");
      return;
    }
    if (!wallet.linked) {
      toast("Link your CrewCup work account first.");
      return;
    }
    const id = Math.random().toString(36).slice(2, 9);
    c.run = { id, runner: app.name(), runnerPeer: "me", closes: Date.now() + 60000, items: [] };
    c.sendRun({ t: "start", id, runner: app.name(), ms: 60000 });
    app.logLine("You started a coffee run. It closes in a minute.");
    renderGuest();
  }

  function joinRun(recipe) {
    if (!c.run) {
      return;
    }
    const item = S.menuFor(place().venue.id, cc()).find((x) => x.id === recipe);
    const price = c.shop?.prices[recipe] ?? item.base;
    if (allowanceLeft() < price) {
      toast(`Not enough allowance left today (${fmt(allowanceLeft())}).`);
      return;
    }
    wallet.spent += price;
    wallet.usual = recipe;
    wallet.history.unshift({ name: item.name, price, at: Date.now(), place: `${place().venue.name}, ${place().regionName}`, run: true });
    wallet.history.length = Math.min(wallet.history.length, 12);
    saveWallet();
    const mineItem = { peer: "me", who: app.name(), recipe, seat: app.seat()?.seat ?? null };
    if (c.run.runnerPeer === "me") {
      c.run.items = c.run.items.filter((x) => x.peer !== "me");
      c.run.items.push(mineItem);
    } else {
      c.run.items.push(mineItem);
      c.sendRun?.({ t: "join", id: c.run.id, recipe, who: app.name(), seat: mineItem.seat });
    }
    c.run.joined = recipe;
    renderGuest();
  }

  function closeRun() {
    const run = c.run;
    if (!run || run.runnerPeer !== "me") {
      return;
    }
    c.run = null;
    c.sendRun?.({ t: "close", id: run.id });
    if (!run.items.length) {
      app.logLine("The coffee run closed with no orders.");
      renderGuest();
      return;
    }
    for (const item of run.items) {
      order(item.recipe, { paid: "crewcup", run: run.id, who: item.who, seat: item.seat, quiet: true });
    }
    app.logLine(`Coffee run sent to the bar: ${run.items.length} ${run.items.length === 1 ? "drink" : "drinks"}, paid from CrewCup allowances.`);
    toast(`Coffee run placed: ${run.items.length} ${run.items.length === 1 ? "drink" : "drinks"}.`);
    renderGuest();
  }

  // ---------- roles bar ----------

  function setRole(role) {
    if (c.role === role) {
      return;
    }
    c.role = role;
    const url = new URL(location.href);
    url.searchParams.set("role", role);
    history.replaceState(null, "", url);
    if (role !== "barista") {
      c.bar?.unhold();
    }
    render();
    app.requestSync();
    app.onRole?.(role);
  }

  function renderRoles() {
    const bar = $("#roles");
    if (!bar) {
      return;
    }
    bar.replaceChildren(...ROLES.map(([id, label, sub]) => el("button", {
      type: "button",
      role: "tab",
      class: "role",
      "aria-selected": String(c.role === id),
      "data-role": id,
      onclick: () => setRole(id),
    }, [el("b", { text: label }), el("span", { text: sub })])));
  }

  // ---------- guest: order card in the table panel ----------

  function renderGuest() {
    const card = $("#orderCard");
    if (!card || !c.shop || busy(card)) {
      return;
    }
    const seat = app.seat();
    card.hidden = !seat;
    if (!seat) {
      return;
    }
    const menu = S.menuOf(c.shop);
    const pay = wallet.linked ? (store.get("pay", "crewcup") === "cash" ? "cash" : "crewcup") : "cash";
    const children = [];
    children.push(el("div", { class: "oc-head" }, [
      el("h3", { text: "Order to your table" }),
      el("span", { class: "oc-where", text: baristaOnline() ? `${baristaOnline()[1].name} is on the bar` : c.shop.open ? (c.shop.staff.length ? "Your staff is on the bar" : "Your store is open") : "The counter makes it" }),
    ]));
    children.push(el("div", { class: "oc-menu" }, menu.map((item) => el("button", {
      type: "button",
      class: "oc-item",
      onclick: () => (c.run ? joinRun(item.id) : order(item.id, { paid: pay })),
      "aria-label": `${c.run ? "Add to the coffee run" : "Order"} ${item.name}, ${fmt(item.price)}`,
    }, [el("b", { text: item.name }), el("span", { text: fmt(item.price) })]))));
    if (c.run) {
      const left = Math.max(0, Math.ceil((c.run.closes - Date.now()) / 1000));
      children.push(el("div", { class: "oc-run" }, [
        el("p", { text: c.run.runnerPeer === "me"
          ? `Your coffee run closes in ${left} s. ${c.run.items.length} ${c.run.items.length === 1 ? "drink" : "drinks"} so far.`
          : `${c.run.runner}'s coffee run closes in ${left} s.${c.run.joined ? " You are in." : " Tap a drink to add yours."}` }),
        c.run.runnerPeer === "me" ? el("button", { type: "button", class: "btn small", text: "Send it now", onclick: closeRun }) : null,
      ]));
    }
    const payRow = el("div", { class: "oc-pay", role: "radiogroup", "aria-label": "Pay with" }, wallet.linked ? [
      el("button", { type: "button", role: "radio", "aria-checked": String(pay === "crewcup"), class: "oc-paybtn", onclick: () => {
        store.set("pay", "crewcup");
        renderGuest();
      } }, [el("b", { text: "CrewCup allowance" }), el("span", { text: `${fmt(allowanceLeft())} left today` })]),
      el("button", { type: "button", role: "radio", "aria-checked": String(pay === "cash"), class: "oc-paybtn", onclick: () => {
        store.set("pay", "cash");
        renderGuest();
      } }, [el("b", { text: "Pay at the counter" }), el("span", { text: "Cash or QRIS" })]),
    ] : [
      el("span", { class: "oc-paynote", text: "Pay at the counter." }),
      el("button", { type: "button", class: "link inline", text: "Link CrewCup work account", onclick: () => {
        wallet.linked = true;
        saveWallet();
        toast(`Linked to ${wallet.company}. ${fmt(allowance())} coffee allowance a day.`);
        renderGuest();
      } }),
    ]);
    children.push(payRow);
    if (wallet.linked && !c.run) {
      children.push(el("button", { type: "button", class: "btn wide run-btn", text: "Start a coffee run for this table", onclick: startRun }));
    }
    const recent = c.mine.filter((o) => o.who === app.name()).slice(0, 3);
    if (recent.length) {
      children.push(el("ul", { class: "oc-mine" }, recent.map((o) => el("li", {}, [
        el("b", { text: o.name }),
        el("span", { text: o.status === "served" ? `served by ${o.by}` : o.status === "making" ? `${o.by || "the barista"} is making it` : o.status === "cancelled" ? "not taken" : o.status === "waiting" ? "waiting at the bar" : "sent" }),
      ]))));
    }
    card.replaceChildren(...children.filter(Boolean));
  }

  // ---------- barista view ----------

  async function ensureBar() {
    if (c.bar || c.barLoading) {
      return;
    }
    c.barLoading = true;
    try {
      const module = await import("./bar.js");
      const stage = $("#barStage");
      c.bar = module.createBar(stage, {
        cam: c.cam,
        name: app.name(),
        onProgress: (snap) => renderHud(snap),
        onStepDone: () => {},
        onServed: ({ order: o, quality }) => finishOrder(o, quality),
      });
      if (!c.bar) {
        $("#barEmpty").hidden = false;
        $("#barEmpty").textContent = "This browser cannot show the 3D bar. Orders still work from the Owner view with hired staff.";
        return;
      }
      updateMenuBoard();
      renderBarSide();
      pickNext();
    } finally {
      c.barLoading = false;
    }
  }

  function updateMenuBoard() {
    if (!c.bar || !c.shop) {
      return;
    }
    c.bar.setMenu({ title: c.shop.name, items: S.menuOf(c.shop).map((m) => ({ name: m.name, price: fmt(m.price) })) });
  }

  function pickNext(id = null) {
    if (!c.bar || !c.shop) {
      return;
    }
    const candidates = c.shop.queue.filter((o) => !o.by);
    const next = id ? c.shop.queue.find((o) => o.id === id) : candidates[0];
    if (!next) {
      c.making = null;
      c.bar.clear();
      renderHud(c.bar.snapshot());
      return;
    }
    c.making = next.id;
    next.by = "you";
    c.bar.start(next);
    renderBarSide();
  }

  function finishOrder(o, quality) {
    if (!c.shop) {
      return;
    }
    const result = S.serve(c.shop, o.id, { quality, by: "you" });
    c.making = null;
    if (result) {
      result.quality = quality;
      onServed(result);
      const tip = result.tip ? `, tip ${fmt(result.tip)}` : "";
      toast(`${o.name} for ${o.who}: ${Math.round(quality * 100)}%${tip}.`);
    }
    saveShop(true);
    renderBarSide();
    setTimeout(() => pickNext(), 1400);
  }

  function hudStepText(snap) {
    const step = snap.step;
    if (!step) {
      return "";
    }
    if (step.kind === "tap") {
      return `${step.verb}. ${step.hint}`;
    }
    return `${step.verb}. ${step.hint}`;
  }

  function renderHud(snap) {
    const hud = $("#barHud");
    if (!hud) {
      return;
    }
    const has = Boolean(snap?.order);
    $("#barEmpty").hidden = has;
    hud.hidden = !has;
    if (!has) {
      $("#barEmpty").textContent = c.shop?.open
        ? "No orders waiting. New customers arrive on their own; guests can order from their table."
        : "The store is closed. Open it from Owner, or wait for a guest to order.";
      return;
    }
    const o = snap.order;
    $("#hudOrder").textContent = `${o.name} for ${o.who}${o.table ? `, ${app.tableWord()} ${o.table}` : ""}`;
    $("#hudQuality").textContent = snap.quality == null ? "" : `${Math.round(snap.quality * 100)}%`;
    $("#hudSteps").replaceChildren(...snap.steps.map((st, i) => el("li", {
      class: i === snap.index && !snap.done ? "now" : st.done ? "done" : "",
    }, [el("span", { text: st.label }), st.score != null ? el("i", { text: `${Math.round(st.score * 100)}` }) : null])));
    const step = snap.step;
    const gauge = $("#hudGauge");
    const holdBtn = $("#holdBtn");
    $("#hudHint").textContent = snap.done ? "Served. The next order comes up by itself." : hudStepText(snap);
    if (step && step.kind === "hold" && !snap.done) {
      gauge.hidden = false;
      const lo = (step.target[0] / step.max) * 100;
      const hi = (step.target[1] / step.max) * 100;
      $("#hudZone").style.left = `${lo}%`;
      $("#hudZone").style.width = `${hi - lo}%`;
      $("#hudZone").dataset.label = hi - lo > 7 ? `${step.target[0]}-${step.target[1]} ${step.unit}` : "";
      $("#hudFill").style.width = `${Math.min(100, (snap.value / step.max) * 100)}%`;
      const inZone = snap.value >= step.target[0] && snap.value <= step.target[1];
      gauge.classList.toggle("in", inZone);
      $("#hudValue").textContent = `${snap.value.toFixed(step.unit === "°C" || step.unit === "ml" || step.unit === "%" ? 0 : 1)} ${step.unit}`;
      holdBtn.textContent = snap.holding ? "Release" : "Hold";
      holdBtn.classList.toggle("on", snap.holding);
    } else {
      gauge.hidden = true;
      holdBtn.textContent = snap.done ? "Served" : step ? step.label : "Hold";
      holdBtn.classList.remove("on");
    }
    holdBtn.disabled = snap.done;
    $("#camSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cam === c.cam)));
  }

  function renderBarSide() {
    const list = $("#tickets");
    if (c.bar && c.shop) {
      // the people waiting across the counter are the open tickets
      c.bar.setCustomers(c.shop.queue);
    }
    if (!list || !c.shop || busy(list)) {
      return;
    }
    const q = c.shop.queue;
    $("#ticketCount").textContent = String(q.length);
    list.replaceChildren(...(q.length ? q.slice(0, 8).map((o) => {
      const wait = Math.max(0, Math.round(c.shop.minute - o.placed));
      const mineNow = o.id === c.making;
      return el("li", { class: mineNow ? "now" : o.by ? "taken" : "" }, [
        el("div", { class: "tk-main" }, [
          el("b", { text: o.name }),
          el("span", { text: `${o.who}${o.table ? ` · ${app.tableWord()} ${o.table}` : ""}${o.run ? " · coffee run" : ""}${o.paid === "crewcup" ? " · CrewCup" : ""}` }),
        ]),
        el("span", { class: "tk-wait", text: mineNow ? "making" : o.by ? o.by : `${wait} min` }),
        !mineNow && !o.by ? el("button", { type: "button", class: "btn small", text: "Make", onclick: () => {
          const current = c.shop.queue.find((x) => x.id === c.making);
          if (current) {
            current.by = null;
          }
          pickNext(o.id);
        } }) : null,
      ]);
    }) : [el("li", { class: "empty", text: c.shop.open ? "No orders right now." : "Store closed." })]));
    const t = c.shop.today;
    const avg = t.quality.length ? Math.round((t.quality.reduce((a, b) => a + b, 0) / t.quality.length) * 100) : null;
    $("#barToday").textContent = `${t.cups} cups today · tips ${fmt(t.tips)}${avg != null ? ` · average ${avg}%` : ""}`;
    $("#soundBtn").textContent = isMuted() ? "Sound off" : "Sound on";
    $("#soundBtn").setAttribute("aria-pressed", String(!isMuted()));
    if (!c.making && c.bar && q.some((o) => !o.by)) {
      pickNext();
    }
  }

  // ---------- owner view ----------

  function renderOwner() {
    const root = $("#ownerView");
    if (!root || !c.shop || root.hidden || busy(root)) {
      return;
    }
    const shop = c.shop;
    const t = shop.today;
    const costs = t.purchases + t.wages;
    const profit = t.revenue + t.tips - costs;
    const menu = S.menuOf(shop);
    const low = new Set(S.lowStock(shop));
    const hourMax = Math.max(1, ...t.byHour);
    const nowHour = Math.floor(shop.minute / 60) % 24;
    const waiting = shop.queue.length;
    const avgWait = t.cups ? Math.round(t.waitTotal / t.cups) : 0;

    const head = el("div", { class: "ow-head" }, [
      el("div", {}, [
        el("h2", { text: shop.name }),
        el("p", { class: "ow-sub", text: `Day ${shop.day} · ${S.clockText(shop.minute)} · ${shop.open ? "Open" : "Closed"} · rating ${shop.rating.toFixed(1)} / 5` }),
      ]),
      el("button", {
        type: "button",
        class: shop.open ? "btn" : "btn primary",
        id: "storeBtn",
        text: shop.open ? "Close for today" : "Open the store",
        onclick: () => {
          unlock();
          if (shop.open) {
            const sum = S.closeStore(shop);
            c.sitting = [];
            toast(`Day ${sum.day} closed: ${sum.cups} cups, profit ${fmt(sum.profit)}.`);
          } else {
            shop.minute = app.hour() * 60;
            S.openStore(shop);
            toast(shop.staff.length ? "Store open. Your staff is on the bar." : "Store open. Customers are coming; go to Barista to make their drinks, or hire someone.");
          }
          saveShop(true);
          renderOwner();
          app.requestSync();
        },
      }),
    ]);

    const stats = el("div", { class: "ow-stats" }, [
      stat("Cash", fmt(shop.cash)),
      stat("Sales today", fmt(t.revenue + t.tips), t.tips ? `incl. ${fmt(t.tips)} tips` : ""),
      stat("Profit today", fmt(profit), "before rent", profit < 0 ? "neg" : ""),
      stat("Cups", String(t.cups), t.walkouts ? `${t.walkouts} walked out` : avgWait ? `${avgWait} min average wait` : ""),
    ]);

    const chart = el("div", { class: "ow-chart", "aria-label": "Sales by hour today" }, t.byHour.map((v, h) => el("i", {
      class: h === nowHour ? "now" : "",
      style: `height:${Math.round((v / hourMax) * 100)}%`,
      title: `${String(h).padStart(2, "0")}:00 ${fmt(v)}`,
    })));
    if (!t.byHour.some((v) => v > 0)) {
      chart.append(el("span", { class: "ow-chart-empty", text: "Sales by hour fill in here after the first cup." }));
    }

    const prices = el("section", { class: "ow-card" }, [
      el("h3", { text: "Menu and prices" }),
      el("p", { class: "ow-note", text: `Usual here: ${menu.map((m) => fmt(m.base)).join(", ")}. Above that, fewer people come in.` }),
      el("ul", { class: "ow-rows" }, menu.map((m) => el("li", {}, [
        el("span", { class: "ow-name", text: m.name }),
        el("span", { class: "ow-meta", text: `costs ${fmt(m.cost)} · ${Math.round((1 - m.cost / m.price) * 100)}% margin` }),
        el("div", { class: "stepper" }, [
          el("button", { type: "button", text: "-", "aria-label": `Lower the price of ${m.name}`, onclick: () => {
            S.setPrice(shop, m.id, m.price - S.money(cc()).step * stepMul());
            saveShop(true);
            updateMenuBoard();
            renderOwner();
          } }),
          el("b", { text: fmt(m.price) }),
          el("button", { type: "button", text: "+", "aria-label": `Raise the price of ${m.name}`, onclick: () => {
            S.setPrice(shop, m.id, m.price + S.money(cc()).step * stepMul());
            saveShop(true);
            updateMenuBoard();
            renderOwner();
          } }),
        ]),
      ]))),
      el("p", { class: "ow-note", text: `Demand from prices: ${Math.round(S.priceFactor(shop) * 100)}% of normal.` }),
    ]);

    const stock = el("section", { class: "ow-card" }, [
      el("h3", { text: "Stock" }),
      el("ul", { class: "ow-rows" }, Object.entries(S.STOCK).map(([key, s]) => el("li", { class: low.has(key) ? "low" : "" }, [
        el("span", { class: "ow-name", text: s.label }),
        el("span", { class: "ow-meta", text: `${Math.round(shop.stock[key] || 0)}${s.unit ? " " + s.unit : ""}${low.has(key) ? " · running low" : ""}` }),
        el("button", { type: "button", class: "btn small", text: `Buy ${s.pack}${s.unit ? " " + s.unit : ""} · ${fmt(S.packCost(shop, key))}`, onclick: () => {
          const r = S.buyStock(shop, key);
          if (!r.ok) {
            toast(r.reason);
          }
          saveShop(true);
          renderOwner();
        } }),
      ]))),
    ]);

    const staff = el("section", { class: "ow-card" }, [
      el("h3", { text: "Staff" }),
      shop.staff.length ? el("ul", { class: "ow-rows" }, shop.staff.map((s, i) => el("li", {}, [
        el("span", { class: "ow-name", text: s.name }),
        el("span", { class: "ow-meta", text: `${s.busy ? "making a drink" : "free"} · ${s.done} made · ${fmt(s.wage)} an hour` }),
        el("button", { type: "button", class: "btn small", text: "Let go", onclick: () => {
          S.letGo(shop, i);
          saveShop(true);
          renderOwner();
        } }),
      ]))) : el("p", { class: "ow-note", text: "Nobody yet. You make every drink yourself at the bar." }),
      shop.staff.length < 3 ? el("div", { class: "ow-hire" }, shop.candidates.map((cand, i) => el("button", {
        type: "button",
        class: "hire",
        onclick: () => {
          S.hire(shop, i);
          saveShop(true);
          toast(`${cand.name} starts now.`);
          renderOwner();
        },
      }, [el("b", { text: `Hire ${cand.name}` }), el("span", { text: `${cand.skill >= 1 ? "fast" : cand.skill >= 0.85 ? "steady" : "learning"} · ${fmt(S.wageFor(shop, cand.skill))} an hour` })]))) : null,
    ]);

    const books = el("section", { class: "ow-card" }, [
      el("h3", { text: "Books" }),
      el("ul", { class: "ow-ledger" }, shop.ledger.slice(0, 7).map((l) => el("li", {}, [
        el("span", { text: `${S.clockText(l.minute)} ${l.note}` }),
        el("b", { class: l.amount < 0 ? "neg" : "", text: `${l.amount < 0 ? "" : "+"}${fmt(l.amount)}` }),
      ]))),
      shop.history.length ? el("p", { class: "ow-note", text: `Last day: ${shop.history[0].cups} cups, profit ${fmt(shop.history[0].profit)} after ${fmt(S.rentFor(shop))} rent.` }) : el("p", { class: "ow-note", text: `Rent is ${fmt(S.rentFor(shop))} a day, paid when you close.` }),
    ]);

    const queueLine = el("div", { class: "ow-queue" }, [
      el("span", { text: waiting ? `${waiting} waiting at the bar` : shop.open ? "Nobody waiting" : "Open the store to let customers in" }),
      el("button", { type: "button", class: "btn small", text: "Go behind the bar", onclick: () => setRole("barista") }),
    ]);

    root.replaceChildren(head, stats, chart, queueLine, el("div", { class: "ow-grid" }, [prices, stock, staff, books].filter(Boolean)));
  }

  function stepMul() {
    const m = S.money(cc());
    return m.step >= 1000 ? 1 : m.step >= 5 ? 1 : m.step >= 1 ? 1 : 1;
  }

  function stat(label, value, sub = "", cls = "") {
    return el("div", { class: `ow-stat ${cls}`.trim() }, [el("span", { text: label }), el("b", { text: value }), sub ? el("i", { text: sub }) : null]);
  }

  // ---------- CrewCup home ----------

  function renderHome() {
    const root = $("#homeView");
    if (!root || root.hidden || !c.shop || busy(root)) {
      return;
    }
    const p = place();
    const menu = S.menuOf(c.shop);
    const usual = menu.find((m) => m.id === wallet.usual) || menu[1] || menu[0];
    const left = allowanceLeft();
    root.replaceChildren(
      el("div", { class: "cc-hello" }, [
        el("p", { class: "cc-kicker", text: wallet.company }),
        el("h2", { text: `Morning, ${app.name()}` }),
        el("p", { text: `${p.venue.name}, ${p.regionName} is your partner cafe today.` }),
      ]),
      el("div", { class: "cc-cards" }, [
        el("section", { class: "cc-card" }, [
          el("span", { class: "cc-label", text: "Coffee allowance today" }),
          el("b", { class: "cc-big", text: fmt(left) }),
          el("div", { class: "cc-bar" }, [el("i", { style: `width:${Math.round((left / allowance()) * 100)}%` })]),
          el("span", { class: "cc-sub", text: `of ${fmt(allowance())}, paid by ${wallet.company}` }),
        ]),
        el("section", { class: "cc-card" }, [
          el("span", { class: "cc-label", text: "Order my usual" }),
          el("b", { class: "cc-big", text: usual.name }),
          el("span", { class: "cc-sub", text: `${fmt(usual.price)} · brought to your table in the lounge` }),
          el("button", { type: "button", class: "btn primary", text: `Order ${usual.name}`, onclick: () => {
            if (!app.seat()) {
              app.sitAnywhere();
            }
            setTimeout(() => order(usual.id, { paid: "crewcup" }), 400);
            setRole("guest");
          } }),
        ]),
        el("section", { class: "cc-card" }, [
          el("span", { class: "cc-label", text: "Coffee run" }),
          el("b", { class: "cc-big", text: "One trip for the table" }),
          el("span", { class: "cc-sub", text: "Start a run at your table; everyone adds a drink from their own allowance for one minute, then it goes to the bar as one batch." }),
          el("button", { type: "button", class: "btn", text: "Sit with your crew", onclick: () => setRole("guest") }),
        ]),
      ]),
      el("section", { class: "cc-recent" }, [
        el("h3", { text: "Recent" }),
        wallet.history.length ? el("ul", {}, wallet.history.slice(0, 5).map((h) => el("li", {}, [
          el("span", { text: `${h.name}${h.run ? " (coffee run)" : ""}` }),
          el("span", { class: "cc-sub", text: h.place }),
          el("b", { text: fmt(h.price) }),
        ]))) : el("p", { class: "cc-sub", text: "Nothing yet today." }),
      ]),
    );
  }

  // ---------- render everything ----------

  function render() {
    const p = place();
    if (!p) {
      return;
    }
    loadShop();
    document.body.dataset.host = HOST;
    const main = $("#main");
    main.dataset.role = c.role;
    renderRoles();
    $("#barView").hidden = c.role !== "barista";
    $("#ownerView").hidden = c.role !== "owner";
    if ($("#homeView")) {
      $("#homeView").hidden = c.role !== "home";
    }
    if (c.role === "barista") {
      ensureBar();
      renderBarSide();
      if (c.bar) {
        renderHud(c.bar.snapshot());
      }
    } else {
      c.bar?.unhold();
    }
    renderOwner();
    renderGuest();
    renderHome();
  }

  // ---------- wire the static controls ----------

  function wire() {
    const holdBtn = $("#holdBtn");
    holdBtn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      holdBtn.setPointerCapture?.(event.pointerId);
      c.bar?.press();
    });
    holdBtn.addEventListener("pointerup", () => c.bar?.release());
    holdBtn.addEventListener("pointercancel", () => c.bar?.release());
    holdBtn.addEventListener("keydown", (event) => {
      if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
        event.preventDefault();
        c.bar?.press();
      }
    });
    holdBtn.addEventListener("keyup", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        c.bar?.release();
      }
    });
    $("#camSeg").replaceChildren(...CAMS.map((mode) => el("button", {
      type: "button",
      "data-cam": mode,
      "aria-pressed": String(mode === c.cam),
      text: CAM_LABEL[mode],
      onclick: () => {
        c.cam = mode;
        store.set("cam", mode);
        c.bar?.setCam(mode);
        $("#camSeg").querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.cam === mode)));
      },
    })));
    $("#soundBtn").addEventListener("click", () => {
      setMuted(!isMuted());
      unlock();
      renderBarSide();
    });
    $("#skipBtn").addEventListener("click", () => {
      if (!c.shop) {
        return;
      }
      const current = c.shop.queue.find((o) => o.id === c.making);
      if (current) {
        current.by = null;
        const rest = c.shop.queue.filter((o) => o !== current);
        c.shop.queue = [...rest, current];
      }
      c.making = null;
      pickNext();
    });
    if (HOST === "crewcup") {
      document.title = "CrewCup - office coffee, with a lounge";
      const brand = document.querySelector(".brand");
      if (brand) {
        brand.replaceChildren(document.createTextNode("Crew"), el("span", { text: "Cup" }));
        brand.setAttribute("aria-label", "CrewCup home");
        brand.after(el("span", { class: "brand-sub", text: "Lounge by Nongkrong" }));
      }
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#1f2937");
    }
  }
  wire();

  return {
    get role() {
      return c.role;
    },
    get host() {
      return HOST;
    },
    attachRegionRoom,
    attachTableRoom,
    render,
    renderGuest,
    npcPeople,
    drinks,
    setRole,
    order,
    // test and preview hooks
    debug: {
      shop: () => c.shop,
      bar: () => c.bar,
      wallet: () => wallet,
      run: () => c.run,
      mine: () => c.mine,
      fastForward(minutes) {
        const events = S.tick(c.shop, minutes, { claimed: claimed() });
        events.filter((e) => e.type === "served").forEach(onServed);
        render();
        app.requestSync();
        return events.length;
      },
      startRun,
      closeRun,
      joinRun,
      pickNext,
    },
  };
}
