// Two transports with the same small interface:
//  - online: Trystero over public Nostr relays. Relays only pass the WebRTC handshake;
//    text and voice then go browser to browser (DTLS/SRTP encrypted by WebRTC).
//  - local (?local=1): BroadcastChannel between tabs of one browser. Used by the tests
//    and for trying the app alone. Text only, no voice.

import { joinRoom as joinNostr, selfId as nostrSelfId } from "./vendor/trystero-nostr.mjs";

const APP_ID = "juw12-nongkrong-v1";
const params = new URLSearchParams(location.search);
export const LOCAL = params.has("local");

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 16);
export const myId = LOCAL ? randomId() : nostrSelfId;

export function openRoom(roomId) {
  if (LOCAL) {
    return localRoom(roomId);
  }
  return joinNostr({ appId: APP_ID, password: "nongkrong:" + roomId }, roomId);
}

function localRoom(roomId) {
  const channel = new BroadcastChannel("nongkrong:" + roomId);
  const peers = new Map();
  const handlers = { join: [], leave: [] };
  const actions = new Map();
  let open = true;

  const post = (msg) => {
    if (open) {
      channel.postMessage({ ...msg, from: myId });
    }
  };

  const addPeer = (id) => {
    const isNew = !peers.has(id);
    peers.set(id, Date.now());
    if (isNew) {
      handlers.join.forEach((fn) => fn(id));
    }
    return isNew;
  };

  const dropPeer = (id) => {
    if (peers.delete(id)) {
      handlers.leave.forEach((fn) => fn(id));
    }
  };

  channel.onmessage = ({ data: msg }) => {
    if (!open || msg.from === myId || (msg.to && msg.to !== myId)) {
      return;
    }
    if (msg.type === "hello") {
      if (addPeer(msg.from)) {
        post({ type: "hello", to: msg.from });
      }
    } else if (msg.type === "beat") {
      if (addPeer(msg.from)) {
        post({ type: "hello", to: msg.from });
      }
    } else if (msg.type === "bye") {
      dropPeer(msg.from);
    } else if (msg.type === "act") {
      addPeer(msg.from);
      (actions.get(msg.name) || []).forEach((fn) => fn(msg.data, msg.from));
    }
  };

  const beat = setInterval(() => {
    post({ type: "beat" });
    const cutoff = Date.now() - 9000;
    for (const [id, seen] of peers) {
      if (seen < cutoff) {
        dropPeer(id);
      }
    }
  }, 3000);

  const onUnload = () => post({ type: "bye" });
  addEventListener("pagehide", onUnload);
  setTimeout(() => post({ type: "hello" }), 0);

  return {
    makeAction(name) {
      const send = (data, target) => {
        const targets = target == null ? [null] : [].concat(target);
        targets.forEach((to) => post({ type: "act", name, data, to }));
        return Promise.resolve();
      };
      const receive = (fn) => {
        actions.set(name, [...(actions.get(name) || []), fn]);
      };
      return [send, receive];
    },
    onPeerJoin(fn) {
      handlers.join.push(fn);
    },
    onPeerLeave(fn) {
      handlers.leave.push(fn);
    },
    onPeerStream() {},
    addStream() {
      return [];
    },
    removeStream() {},
    getPeers() {
      return Object.fromEntries([...peers.keys()].map((id) => [id, {}]));
    },
    leave() {
      post({ type: "bye" });
      open = false;
      clearInterval(beat);
      removeEventListener("pagehide", onUnload);
      channel.close();
      return Promise.resolve();
    },
  };
}
