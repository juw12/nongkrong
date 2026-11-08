import { COUNTRIES, LAYOUTS, findCountry, findRegion, findVenue, tablesFor, guessPlace } from "./data.js";
import { openRoom, myId, LOCAL, relayHealth } from "./net.js";

const $ = (selector) => document.querySelector(selector);

const store = {
  get(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem("nk:" + key));
      return value ?? fallback;
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem("nk:" + key, JSON.stringify(value));
    } catch (error) {
      // storage can be blocked (private mode); the app still works for this visit
    }
  },
};

const state = {
  name: store.get("name", ""),
  country: null,
  region: null,
  venue: null,
  seat: null,              // { table, seat, since } while seated
  people: new Map(),       // peerId -> presence from the region room
  regionRoom: null,
  sendHello: null,
  tableRoom: null,
  sendChat: null,
  tableKey: null,
  atTable: new Map(),      // peerId -> name at my table at the last render, for join/leave lines
  voice: { stream: null, on: false, muted: false },
  audio: new Map(),        // peerId -> { el, analyser }
  speaking: new Set(),
  blocked: new Set(store.get("blocked", [])),
  lastSent: 0,
  recent: new Map(),       // peerId -> timestamps, for flood control
  pendingTable: null,      // table number from a shared link
  pos: null,               // my { x, z, ry } in the 3D place while standing
  world: null,             // the 3D view (null when WebGL is not available)
  worldKey: null,          // which place the 3D view is showing
  sendMove: null,
};

// ---------- small helpers ----------

const initials = (name) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] || "?").slice(0, 2);
  return letters.toUpperCase();
};

const cleanName = (value) => String(value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 24);

const timeIn = (tz) => {
  try {
    return new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
  } catch (error) {
    return "--:--";
  }
};

const startedAt = Date.now();
let toastTimer = 0;
function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "class") {
      node.className = value;
    } else if (key === "text") {
      node.textContent = value;
    } else if (key.startsWith("on")) {
      node.addEventListener(key.slice(2), value);
    } else if (value !== false && value != null) {
      node.setAttribute(key, value === true ? "" : value);
    }
  }
  for (const child of [].concat(children)) {
    if (child != null) {
      node.append(child);
    }
  }
  return node;
}

const country = () => findCountry(state.country);
const region = () => findRegion(country(), state.region);
const venue = () => findVenue(country(), state.venue);

function me() {
  const presence = {
    name: state.name,
    venue: state.venue,
    table: state.seat ? state.seat.table : null,
    seat: state.seat ? state.seat.seat : null,
    since: state.seat ? state.seat.since : 0,
    voice: state.voice.on && !state.voice.muted,
  };
  if (!state.seat && state.pos) {
    Object.assign(presence, state.pos);
  }
  return presence;
}

// A spot in the 3D place: metres from the middle of the floor, and which way the person faces.
function validPos(p) {
  if (!p || typeof p !== "object") {
    return null;
  }
  const x = Number(p.x);
  const z = Number(p.z);
  const ry = Number(p.ry);
  if (![x, z, ry].every(Number.isFinite) || Math.abs(x) > 30 || Math.abs(z) > 30 || Math.abs(ry) > 7) {
    return null;
  }
  return { x, z, ry };
}

function validPresence(p) {
  if (!p || typeof p !== "object") {
    return null;
  }
  const name = cleanName(p.name);
  if (!name || typeof p.venue !== "string" || p.venue.length > 24) {
    return null;
  }
  const table = Number.isInteger(p.table) && p.table >= 1 && p.table <= 12 ? p.table : null;
  const seat = table && Number.isInteger(p.seat) && p.seat >= 0 && p.seat < 12 ? p.seat : null;
  const presence = {
    name,
    venue: p.venue,
    table: seat == null ? null : table,
    seat,
    since: Number(p.since) || 0,
    voice: p.voice === true,
  };
  const pos = seat == null ? validPos(p) : null;
  if (pos) {
    Object.assign(presence, pos);
  }
  return presence;
}

// Everyone in the region, me included, as [id, presence].
function everyone() {
  return [[myId, me()], ...state.people];
}

function occupants(venueId, tableNo) {
  return everyone().filter(([, p]) => p.venue === venueId && p.table === tableNo && p.seat != null);
}

// ---------- region room: presence only ----------

function announce(target) {
  if (state.sendHello) {
    state.sendHello(me(), target);
  }
}

function enterRegion(countryCode, regionId) {
  leaveTable(true);
  if (state.regionRoom) {
    state.regionRoom.leave();
  }
  state.people.clear();
  state.country = countryCode;
  state.region = regionId;
  const c = country();
  if (!findVenue(c, state.venue)) {
    state.venue = c.venues[0].id;
  }
  store.set("place", { country: countryCode, region: regionId });

  const room = openRoom(`${countryCode}/${regionId}`);
  state.regionRoom = room;
  const [sendHello, onHello] = room.makeAction("hello");
  state.sendHello = sendHello;
  onHello((data, peerId) => {
    if (state.regionRoom !== room) {
      return;
    }
    const presence = validPresence(data);
    if (presence) {
      state.people.set(peerId, presence);
      resolveSeatClash();
      render();
    }
  });
  room.onPeerJoin((peerId) => announce(peerId));
  room.onPeerLeave((peerId) => {
    state.people.delete(peerId);
    render();
  });
  // Walking around the place: small position updates, a few per second at most.
  const [sendMove, onMove] = room.makeAction("move");
  state.sendMove = sendMove;
  onMove((data, peerId) => {
    if (state.regionRoom !== room) {
      return;
    }
    const person = state.people.get(peerId);
    const pos = validPos(data);
    if (!person || !pos || person.seat != null || flooding("move:" + peerId, 40)) {
      return;
    }
    Object.assign(person, pos);
    syncWorld();
  });
  announce();
  syncSelects();
  render();
}

// Two people grabbed the same stool: the one who sat first keeps it.
function resolveSeatClash() {
  if (!state.seat) {
    return;
  }
  const mine = me();
  const rival = [...state.people].find(([id, p]) =>
    p.venue === mine.venue && p.table === mine.table && p.seat === mine.seat &&
    (p.since < mine.since || (p.since === mine.since && id < myId)));
  if (!rival) {
    return;
  }
  const free = freeSeat(mine.venue, mine.table);
  if (free == null) {
    leaveTable();
    toast("That table just filled up.");
  } else {
    state.seat.seat = free;
    announce();
  }
}

function freeSeat(venueId, tableNo) {
  const t = tablesFor(findVenue(country(), venueId)).find((x) => x.n === tableNo);
  if (!t) {
    return null;
  }
  const taken = new Set(everyone()
    .filter(([id, p]) => id !== myId && p.venue === venueId && p.table === tableNo)
    .map(([, p]) => p.seat));
  for (let i = 0; i < t.seats; i++) {
    if (!taken.has(i)) {
      return i;
    }
  }
  return null;
}

// ---------- table room: chat and voice, only for people at this table ----------

function sit(tableNo) {
  if (state.seat && state.seat.table === tableNo) {
    showView("table");
    return;
  }
  const free = freeSeat(state.venue, tableNo);
  if (free == null) {
    toast("That table is full. Try another one.");
    return;
  }
  leaveTable(true);
  unlockAudio();
  state.seat = { table: tableNo, seat: free, since: Date.now() };
  announce();
  joinTable();
  render();
  showView("table");
  $("#sayInput").focus({ preventScroll: true });
}

function joinTable() {
  const key = `${state.country}/${state.region}/${state.venue}/${state.seat.table}`;
  const room = openRoom(key);
  state.tableRoom = room;
  state.tableKey = key;
  state.atTable = new Map(occupants(state.venue, state.seat.table)
    .filter(([id]) => id !== myId)
    .map(([id, p]) => [id, p.name]));
  $("#log").replaceChildren();
  logLine(`You sat down at ${tableName(state.seat.table)}.`);

  const [sendChat, onChat] = room.makeAction("chat");
  state.sendChat = sendChat;
  onChat((data, peerId) => {
    if (state.tableRoom !== room || state.blocked.has(peerId) || !data || typeof data.text !== "string") {
      return;
    }
    if (flooding(peerId)) {
      return;
    }
    const text = data.text.slice(0, 400).trim();
    if (text) {
      const who = state.people.get(peerId)?.name || "Someone";
      addMessage(who, text, false);
      state.world?.say(peerId, text);
    }
  });

  room.onPeerJoin((peerId) => {
    if (state.voice.on && state.voice.stream) {
      room.addStream(state.voice.stream, peerId);
    }
  });
  room.onPeerStream((stream, peerId) => attachAudio(peerId, stream));
  room.onPeerLeave((peerId) => detachAudio(peerId));
  history.replaceState(null, "", location.pathname + location.search + "#" + key);
}

function leaveTable(quiet = false) {
  if (!state.seat) {
    return;
  }
  stopVoice();
  if (state.tableRoom) {
    state.tableRoom.leave();
  }
  for (const id of [...state.audio.keys()]) {
    detachAudio(id);
  }
  state.tableRoom = null;
  state.sendChat = null;
  state.tableKey = null;
  state.seat = null;
  announce();
  history.replaceState(null, "", location.pathname + location.search);
  if (!quiet) {
    render();
    showView("floor");
  }
}

function flooding(peerId, limit = 6) {
  const now = Date.now();
  const times = (state.recent.get(peerId) || []).filter((t) => now - t < 3000);
  times.push(now);
  state.recent.set(peerId, times);
  return times.length > limit;
}

const tableName = (n) => `${country().table} ${n}`;

function logLine(text) {
  const log = $("#log");
  log.append(el("div", { class: "sys", text }));
  log.scrollTop = log.scrollHeight;
}

function addMessage(who, text, mine) {
  const log = $("#log");
  const stamp = timeIn(region().tz === "UTC" ? undefined : region().tz);
  log.append(el("div", { class: mine ? "msg mine" : "msg" }, [
    el("div", { class: "n" }, [who, el("span", { class: "tm", text: stamp })]),
    el("p", { text }),
  ]));
  while (log.children.length > 200) {
    log.firstElementChild.remove();
  }
  log.scrollTop = log.scrollHeight;
}

function sendMessage(event) {
  event.preventDefault();
  const input = $("#sayInput");
  const text = input.value.trim().slice(0, 400);
  if (!text || !state.sendChat) {
    return;
  }
  const now = Date.now();
  if (now - state.lastSent < 600) {
    toast("Slow down a little.");
    return;
  }
  state.lastSent = now;
  state.sendChat({ text });
  addMessage(state.name + " (you)", text, true);
  state.world?.say(myId, text);
  input.value = "";
}

// ---------- voice ----------

let audioContext = null;

function unlockAudio() {
  if (!audioContext && window.AudioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext && audioContext.state === "suspended") {
    audioContext.resume();
  }
}

function watchLevel(peerId, stream) {
  if (!audioContext) {
    return null;
  }
  try {
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);
    return analyser;
  } catch (error) {
    return null;
  }
}

function attachAudio(peerId, stream) {
  detachAudio(peerId);
  const audio = el("audio", { autoplay: true });
  audio.srcObject = stream;
  audio.muted = state.blocked.has(peerId);
  $("#audio").append(audio);
  audio.play().catch(() => {});
  state.audio.set(peerId, { el: audio, analyser: watchLevel(peerId, stream) });
}

function detachAudio(peerId) {
  const entry = state.audio.get(peerId);
  if (entry) {
    entry.el.srcObject = null;
    entry.el.remove();
    state.audio.delete(peerId);
  }
  state.speaking.delete(peerId);
}

async function startVoice() {
  if (LOCAL) {
    toast("Voice works in the online version, not in local test mode.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("This browser cannot use a microphone here.");
    return;
  }
  unlockAudio();
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (!state.seat || !state.tableRoom) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    state.voice = { stream, on: true, muted: false };
    state.tableRoom.addStream(stream);
    state.audio.set("me", { el: null, analyser: watchLevel("me", stream) });
    logLine("Voice is on. Only this table can hear you.");
  } catch (error) {
    toast("Microphone blocked. Allow it in the browser to use voice.");
  }
  announce();
  render();
}

function stopVoice() {
  const { stream } = state.voice;
  if (stream) {
    if (state.tableRoom) {
      try {
        state.tableRoom.removeStream(stream);
      } catch (error) {
        // peer already gone
      }
    }
    stream.getTracks().forEach((t) => t.stop());
  }
  state.audio.delete("me");
  state.speaking.delete(myId);
  state.voice = { stream: null, on: false, muted: false };
}

function toggleMute() {
  const v = state.voice;
  if (!v.stream) {
    return;
  }
  v.muted = !v.muted;
  v.stream.getAudioTracks().forEach((t) => {
    t.enabled = !v.muted;
  });
  announce();
  render();
}

const levelBuffer = new Uint8Array(512);
setInterval(() => {
  let changed = false;
  for (const [id, entry] of state.audio) {
    if (!entry.analyser) {
      continue;
    }
    entry.analyser.getByteTimeDomainData(levelBuffer);
    let sum = 0;
    for (const v of levelBuffer) {
      const x = (v - 128) / 128;
      sum += x * x;
    }
    const peer = id === "me" ? myId : id;
    const loud = Math.sqrt(sum / levelBuffer.length) > 0.035 && !(id === "me" && state.voice.muted);
    if (loud !== state.speaking.has(peer)) {
      changed = true;
      if (loud) {
        state.speaking.add(peer);
      } else {
        state.speaking.delete(peer);
      }
    }
  }
  if (changed) {
    document.querySelectorAll(".stool[data-peer]").forEach((s) => {
      s.classList.toggle("speaking", state.speaking.has(s.dataset.peer));
    });
    syncWorld();
  }
}, 200);

// ---------- 3D place ----------

const params = new URLSearchParams(location.search);

function hourIn(tz) {
  const forced = Number(params.get("hour"));
  if (params.has("hour") && Number.isInteger(forced) && forced >= 0 && forced < 24) {
    return forced;
  }
  try {
    const text = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: tz === "UTC" ? undefined : tz }).format(new Date());
    return Number.parseInt(text, 10) || 0;
  } catch (error) {
    return new Date().getHours();
  }
}

function tryTable(tableNo) {
  const t = tablesFor(venue()).find((x) => x.n === tableNo);
  if (!t) {
    return;
  }
  const mine = state.seat && state.seat.table === tableNo;
  const full = occupants(state.venue, tableNo).length >= t.seats && !mine;
  if (full) {
    toast("That table is full. Try another one.");
  } else {
    sit(tableNo);
  }
}

// Push everyone in this place (and me) into the 3D view.
function syncWorld() {
  const world = state.world;
  if (!world || !state.country) {
    return;
  }
  const key = `${state.country}/${state.venue}`;
  if (state.worldKey !== key) {
    state.worldKey = key;
    world.setVenue({ layout: venue().layout, tables: tablesFor(venue()), tableWord: country().table, venue: venue() });
    world.setHour(hourIn(region().tz));
    state.pos = world.myPosition();
    announce();
  }
  const people = everyone()
    .filter(([, p]) => p.venue === state.venue)
    .map(([id, p]) => ({ id, name: p.name, table: p.table, seat: p.seat, x: p.x, z: p.z, ry: p.ry, voice: p.voice }));
  world.sync(people, { myId, speaking: state.speaking });
}

function setupWorld(module) {
  const stage = $("#stage");
  const world = module.createWorld(stage, {
    onTable: (tableNo) => tryTable(tableNo),
    onFloorWhileSeated: () => toast("You are sitting down. Tap Leave table to walk around."),
    onMove: (pos) => {
      state.pos = pos;
      if (state.sendMove && !state.seat) {
        state.sendMove(pos);
      }
    },
  });
  if (!world) {
    return;
  }
  state.world = world;
  stage.hidden = false;
  $("#main").classList.add("has-world");
  $("#tables").classList.add("chips");
  render();
}

// ---------- rendering ----------

function renderVenues() {
  const nav = $("#venues");
  const counts = new Map();
  for (const [, p] of everyone()) {
    counts.set(p.venue, (counts.get(p.venue) || 0) + 1);
  }
  nav.replaceChildren(...country().venues.map((v) => el("button", {
    class: "venue",
    type: "button",
    "aria-current": v.id === state.venue ? "true" : "false",
    onclick: () => chooseVenue(v.id),
  }, [v.name, el("span", { class: "n", text: String(counts.get(v.id) || 0) })])));
}

function chooseVenue(venueId) {
  if (venueId === state.venue) {
    return;
  }
  leaveTable(true);
  state.venue = venueId;
  announce();
  render();
  showView("floor");
}

function stoolPosition(i, n, shape, size) {
  if (shape === "long") {
    const perSide = Math.ceil(n / 2);
    const side = i < perSide ? 0 : 1;
    const k = side === 0 ? i : i - perSide;
    const count = side === 0 ? perSide : n - perSide;
    const width = size.w - 24;
    const x = 12 + 6 + (width * (k + 0.5)) / count;
    const y = side === 0 ? 12 : size.h + 44;
    return { left: x, top: y };
  }
  const angle = (-90 + (360 * i) / n) * (Math.PI / 180);
  const radius = size.w / 2 + 2;
  const center = size.w / 2 + 18;
  return { left: center + radius * Math.cos(angle), top: center + radius * Math.sin(angle) };
}

function renderTables() {
  const v = venue();
  const tablesEl = $("#tables");
  const long = v.layout === "bench" || v.layout === "garden";
  const cards = tablesFor(v).map((t) => {
    const sitters = occupants(v.id, t.n);
    const bySeat = new Map(sitters.map(([id, p]) => [p.seat, [id, p]]));
    const mine = state.seat && state.seat.table === t.n;
    const full = sitters.length >= t.seats && !mine;
    const shape = long && t.seats >= 6 ? "long" : "round";
    const narrow = matchMedia("(max-width: 900px)").matches;
    const roundSize = t.seats <= 2 ? 84 : t.seats <= 4 ? 104 : t.seats <= 6 ? 124 : 140;
    const size = shape === "long" ? { w: narrow ? 128 : 168, h: 60 } : { w: narrow ? Math.min(roundSize, 100) : roundSize };
    const plateSize = shape === "long" ? { width: size.w + 12, height: size.h + 56 } : { width: size.w + 36, height: size.w + 36 };

    const stools = [];
    for (let i = 0; i < t.seats; i++) {
      const pos = stoolPosition(i, t.seats, shape, size);
      const who = bySeat.get(i);
      let cls = "stool";
      let label = "";
      let peer = null;
      if (who) {
        const [id, p] = who;
        peer = id;
        label = initials(p.name);
        cls += id === myId ? " me" : " taken";
        if (p.voice) {
          cls += " voice";
        }
        if (state.speaking.has(id)) {
          cls += " speaking";
        }
      }
      stools.push(el("span", {
        class: cls,
        "data-peer": peer,
        title: who ? who[1].name : null,
        style: `left:${pos.left}px;top:${pos.top}px`,
        text: label,
      }));
    }

    const top = shape === "long"
      ? el("div", { class: "top-l", style: `width:${size.w}px;height:${size.h}px` }, el("b", { text: String(t.n) }))
      : el("div", { class: "top-r", style: `width:${size.w}px;height:${size.w}px` }, el("b", { text: String(t.n) }));

    const freeCount = t.seats - sitters.length;
    const hasCompany = sitters.length > 0;
    const cap = mine ? "You are here"
      : full ? "Full"
      : hasCompany ? `Join them, ${freeCount} ${freeCount === 1 ? "seat" : "seats"} free`
      : `Sit here, ${t.seats} seats`;
    const names = sitters.map(([id, p]) => (id === myId ? "You" : p.name)).join(", ");
    const label = `${tableName(t.n)}. ${cap}.${names ? " " + names + "." : ""}${mine ? " Open your table." : full ? "" : " Sit here."}`;

    return el("button", {
      class: "t" + (mine ? " mine" : "") + (full ? " full" : ""),
      type: "button",
      "aria-label": label,
      "aria-disabled": full ? "true" : null,
      onclick: () => tryTable(t.n),
    }, [
      el("div", { class: "plate", style: `width:${plateSize.width}px;height:${plateSize.height}px` }, [top, ...stools]),
      el("div", { class: "tn", text: tableName(t.n) }),
      el("div", { class: "names", text: names || (state.world ? "Nobody yet" : "\u00a0") }),
      el("div", { class: mine || full ? "cap" : hasCompany ? "cap free join" : "cap free", text: cap }),
    ]);
  });
  tablesEl.replaceChildren(...cards);
}

function renderPanel() {
  const seated = Boolean(state.seat);
  $("#panelEmpty").hidden = seated;
  $("#panelSeated").hidden = !seated;
  $("#tabTable").textContent = seated ? `My table (${occupants(state.venue, state.seat.table).length})` : "My table";
  if (!seated) {
    return;
  }
  const sitters = occupants(state.venue, state.seat.table);
  $("#tableTitle").textContent = tableName(state.seat.table);
  $("#sayInput").placeholder = `Message ${tableName(state.seat.table)} (only this table sees it)`;
  const count = sitters.length;
  $("#tableSub").textContent = count === 1
    ? `${venue().name}. Nobody else yet. Share the link to bring a friend.`
    : `${venue().name}. Only the ${count} people at this table can read and hear it.`;

  const voiceBtn = $("#voiceBtn");
  voiceBtn.textContent = LOCAL ? "Voice off in test mode" : state.voice.on ? "Turn off voice" : "Turn on voice";
  voiceBtn.className = LOCAL ? "btn" : state.voice.on ? "btn on" : "btn primary";
  voiceBtn.disabled = LOCAL;
  voiceBtn.setAttribute("aria-pressed", String(state.voice.on));
  const muteBtn = $("#muteBtn");
  muteBtn.hidden = !state.voice.on;
  muteBtn.textContent = state.voice.muted ? "Unmute" : "Mute";
  muteBtn.setAttribute("aria-pressed", String(state.voice.muted));
  const note = $("#voiceNote");
  note.hidden = true;
  note.textContent = "";
  voiceBtn.title = LOCAL ? "Open the normal link (without ?local=1) to talk by voice." : "";

  const list = $("#members");
  list.replaceChildren(...sitters.map(([id, p]) => {
    const isMe = id === myId;
    const tag = p.voice ? "in voice" : "";
    const blocked = state.blocked.has(id);
    return el("li", { class: p.voice ? "in-voice" : null }, [
      el("span", { class: "who", text: isMe ? `${p.name} (you)` : p.name }),
      (blocked || tag) ? el("span", { class: "tag", text: blocked ? "hidden" : tag }) : null,
      isMe ? null : el("button", {
        type: "button",
        text: blocked ? "Show" : "Hide",
        "aria-label": `${blocked ? "Show" : "Hide"} ${p.name}`,
        onclick: () => toggleBlock(id),
      }),
    ]);
  }));

  // join and leave lines
  const now = new Map(sitters.filter(([id]) => id !== myId).map(([id, p]) => [id, p.name]));
  for (const [id, name] of now) {
    if (!state.atTable.has(id)) {
      logLine(`${name} sat down.`);
    }
  }
  for (const [id, name] of state.atTable) {
    if (!now.has(id)) {
      logLine(`${name} left the table.`);
    }
  }
  state.atTable = now;
}

function toggleBlock(peerId) {
  if (state.blocked.has(peerId)) {
    state.blocked.delete(peerId);
  } else {
    state.blocked.add(peerId);
  }
  store.set("blocked", [...state.blocked].slice(-200));
  const entry = state.audio.get(peerId);
  if (entry?.el) {
    entry.el.muted = state.blocked.has(peerId);
  }
  render();
}

function renderIntro() {
  const v = venue();
  const reg = region();
  const here = everyone().filter(([, p]) => p.venue === v.id).length;
  const tables = tablesFor(v).length;
  $("#venueName").textContent = v.name;
  $("#venueNote").textContent = `${here === 1 ? "Just you so far" : `${here} people here`} at ${tables} tables. ${LAYOUTS[v.layout].label}.`;
  $("#counterText").textContent = v.note;
  $("#clockLabel").textContent = reg.tz === "UTC" ? "UTC" : `${reg.name} time`;
  $("#clock").textContent = timeIn(reg.tz);
  document.title = `${v.name}, ${reg.name} - Nongkrong`;
  const total = everyone().length;
  const health = relayHealth();
  const blocked = !LOCAL && total === 1 && health.total > 0 && health.open === 0 && Date.now() - startedAt > 15000;
  $("#status").dataset.level = blocked ? "warn" : "info";
  $("#status").textContent = LOCAL
    ? `Local test mode, ${total} in ${reg.name}`
    : blocked ? "Can't reach the meeting relays. This network may block them."
    : total === 1 ? `Online, nobody else in ${reg.name} yet` : `Online, ${total} in ${reg.name}`;
  const hint = $("#hint");
  const alone = total === 1;
  hint.hidden = !alone;
  hint.textContent = alone ? "Quiet here right now. Sit down anyway and share your table link, or try Anywhere > Open lounge." : "";
}

function render() {
  if (!state.country) {
    return;
  }
  $("#nameBtn").textContent = state.name || "Name";
  renderVenues();
  renderIntro();
  renderTables();
  renderPanel();
  syncWorld();
}

function showView(view) {
  $("#main").dataset.view = view;
  $("#tabFloor").setAttribute("aria-selected", String(view === "floor"));
  $("#tabTable").setAttribute("aria-selected", String(view === "table"));
}

// ---------- selects, welcome, theme ----------

function fillCountries(select) {
  select.replaceChildren(...COUNTRIES.map((c) => el("option", { value: c.code, text: c.name })));
}

function fillRegions(select, code, selected) {
  const c = findCountry(code);
  select.replaceChildren(...c.regions.map((reg) => el("option", { value: reg.id, text: reg.name, selected: reg.id === selected })));
}

function syncSelects() {
  $("#country").value = state.country;
  fillRegions($("#region"), state.country, state.region);
}

function parseHash() {
  const parts = decodeURIComponent(location.hash.slice(1)).split("/");
  if (parts.length < 3) {
    return null;
  }
  const c = findCountry(parts[0]);
  const reg = findRegion(c, parts[1]);
  const v = findVenue(c, parts[2]);
  if (!c || !reg || !v) {
    return null;
  }
  const table = Number(parts[3]);
  return { country: c.code, region: reg.id, venue: v.id, table: Number.isInteger(table) ? table : null };
}

function openWelcome(place) {
  const dialog = $("#welcome");
  fillCountries($("#wCountry"));
  $("#wCountry").value = place.country;
  fillRegions($("#wRegion"), place.country, place.region);
  $("#nameInput").value = state.name;
  updateEnterLabel();
  dialog.showModal();
  $("#nameInput").focus();
}

function updateEnterLabel() {
  const reg = findRegion(findCountry($("#wCountry").value), $("#wRegion").value);
  $("#enterBtn").textContent = reg ? `Go to ${reg.name}` : "Go in";
}

function start(place) {
  enterRegion(place.country, place.region);
  if (state.pendingTable) {
    const tableNo = state.pendingTable;
    state.pendingTable = null;
    setTimeout(() => sit(tableNo), LOCAL ? 300 : 2500);
  }
}

function applyTheme(theme) {
  if (theme) {
    document.documentElement.dataset.theme = theme;
  }
  const dark = document.documentElement.dataset.theme === "dark" ||
    (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  $("#themeBtn").textContent = dark ? "Light" : "Dark";
}

function init() {
  fillCountries($("#country"));
  applyTheme();

  const linked = parseHash();
  const saved = store.get("place", null);
  const place = linked || (saved && findRegion(findCountry(saved.country), saved.region) ? saved : guessPlace());
  if (linked) {
    state.venue = linked.venue;
    state.pendingTable = linked.table;
  }

  $("#country").addEventListener("change", (event) => {
    const c = findCountry(event.target.value);
    enterRegion(c.code, c.regions[0].id);
  });
  $("#region").addEventListener("change", (event) => enterRegion(state.country, event.target.value));
  $("#wCountry").addEventListener("change", (event) => {
    fillRegions($("#wRegion"), event.target.value, null);
    updateEnterLabel();
  });
  $("#wRegion").addEventListener("change", updateEnterLabel);
  $("#welcomeForm").addEventListener("submit", (event) => {
    const name = cleanName($("#nameInput").value);
    if (!name) {
      event.preventDefault();
      return;
    }
    const first = !state.country;
    const changedName = name !== state.name;
    state.name = name;
    store.set("name", name);
    const chosen = { country: $("#wCountry").value, region: $("#wRegion").value };
    if (first || chosen.country !== state.country || chosen.region !== state.region) {
      start(chosen);
    } else if (changedName) {
      announce();
      render();
    }
  });
  $("#welcome").addEventListener("cancel", (event) => {
    if (!state.country) {
      event.preventDefault();
    }
  });
  $("#nameBtn").addEventListener("click", () => openWelcome({ country: state.country, region: state.region }));
  $("#themeBtn").addEventListener("click", () => {
    const dark = $("#themeBtn").textContent === "Dark";
    store.set("theme", dark ? "dark" : "light");
    applyTheme(dark ? "dark" : "light");
  });
  $("#sayForm").addEventListener("submit", sendMessage);
  $("#voiceBtn").addEventListener("click", () => {
    if (state.voice.on) {
      stopVoice();
      announce();
      logLine("Voice is off.");
      render();
    } else {
      startVoice();
    }
  });
  $("#muteBtn").addEventListener("click", toggleMute);
  $("#leaveBtn").addEventListener("click", () => leaveTable());
  $("#copyBtn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("Link copied. Anyone who opens it lands at this table.");
    } catch (error) {
      toast(location.href);
    }
  });
  $("#tabFloor").addEventListener("click", () => showView("floor"));
  $("#tabTable").addEventListener("click", () => {
    if (state.seat) {
      showView("table");
    } else {
      toast("Sit at a table first.");
    }
  });

  setInterval(() => {
    if (state.country) {
      $("#clock").textContent = timeIn(region().tz);
      state.world?.setHour(hourIn(region().tz));
    }
  }, 15000);
  setInterval(() => announce(), 20000);
  setInterval(() => {
    if (state.country) {
      renderIntro();
    }
  }, 5000);

  $("#country").value = place.country;
  fillRegions($("#region"), place.country, place.region);
  addEventListener("resize", () => render());

  if (state.name) {
    start(place);
  } else {
    openWelcome(place);
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

window.nongkrong = { state, myId };
init();
// The 3D place loads after the page works, so a slow or missing WebGL never blocks chatting.
if (!params.has("flat")) {
  import("./world.js")
    .then((module) => setupWorld(module))
    .catch((error) => console.warn("3D view unavailable", error));
}
