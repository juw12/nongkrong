# Nongkrong

**Sit at a table in a virtual warung, kopitiam, pub or cafe for your city. Only the people at your table can read your messages or hear your voice.**

Live: https://juw12.github.io/nongkrong/

Nongkrong (Indonesian for "hanging out") is a free, no-account place to chill with people near you after work.
Pick your country and city, choose the kind of place people there actually sit in (warung kopi, angkringan,
mamak, kopitiam, kissaten, izakaya, pub, biergarten, diner and more), and sit at a table. The floor plan shows who
sits where. Text chat and voice stay inside the table.

![Nongkrong floor plan with a table open](docs/screenshot.png)

<img src="docs/phone.png" alt="Nongkrong on a phone, seated at Meja 1" width="300">

## What it does

- **23 countries plus "Anywhere", 107 cities and regions, 69 places.** Each place type comes from the local
  hangout culture and has its own floor plan (long benches, floor mats, a counter, stools on the street, garden tables).
- **Table-only chat.** Messages go to the people at your table and nobody else.
- **Table-only voice.** Turn on voice and only your table-mates hear you. Mute, unmute or turn it off at any time.
  A green ring shows who is in voice and pulses while they talk.
- **Live floor plan.** Every stool shows the initials of whoever sits on it; your own stool is terracotta.
  Full tables refuse new sitters, and if two people grab the same stool, the one who sat first keeps it.
- **Local time** of the region on screen, so you know if people there are on lunch or on a night shift.
- **Share a table.** "Copy link to this table" makes a link that drops a friend at the same table.
- **Hide a person** at your table: their messages and voice stop reaching you.
- **Light and dark theme**, works on phones, installable as an app (PWA), and the app shell works offline.

## How it works (and what that means for privacy)

There is no server and no account.

- Your name and last city are stored only in your browser (localStorage).
- Browsers find each other through public **Nostr relays** using [Trystero](https://github.com/dmotz/trystero) (MIT,
  bundled in `vendor/`). The relays only pass the WebRTC handshake, which is encrypted with a key derived from the room name.
- After that, **text and voice go directly from browser to browser** over WebRTC (DTLS/SRTP encryption).
- Each city is one presence room (names and seat positions only). Each table is its own room for chat and voice,
  so people at other tables never receive your messages or audio.
- Nothing is recorded or saved. Leave the table and the chat is gone.

## Limits (honest list)

- Rooms are public: anyone who picks the same city can see your chosen name and seat.
- There is no TURN relay server, so on some strict networks (some office or mobile networks) two browsers cannot
  connect directly and will not see each other.
- Voice uses a full mesh between table-mates, which is why tables have 2 to 8 seats.
- Moderation is personal (Hide). There are no accounts, so there are no bans.
- Text messages are limited to 400 characters and a few per second.

## Run it yourself

It is a static site. Serve the folder with any web server:

```
python -m http.server 8000
```

Then open http://localhost:8000/. Add `?local=1` to try it alone across several tabs of one browser
(BroadcastChannel instead of the network; text only).

## Tests

```
python tests/e2e_local.py    # 3 tabs, local mode: table-only chat, full tables, hide, 390/1440 px overflow, JS errors
python tests/e2e_online.py   # 3 separate browsers over the real Nostr relays with fake microphones
```

Both need Python with Playwright and Chrome or Chromium.

## Files

| File | What |
|---|---|
| `index.html`, `app.css`, `app.js` | the app |
| `data.js` | countries, regions, time zones, venue types and floor plans |
| `net.js` | online (Trystero/Nostr) and local (BroadcastChannel) transports |
| `design.md` | design system: palette, type, banned defaults |
| `sw.js`, `manifest.webmanifest`, `icon*` | installable app and offline shell |

## License

MIT. Trystero and noble-secp256k1 in `vendor/` are MIT licensed by their authors.
