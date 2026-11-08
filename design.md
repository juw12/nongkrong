# Nongkrong design system

Read this before changing any UI. Winner of a 4-direction /design bracket (2026-11-07): "kopitiam marble"
beat "floor plan", "menu board" and "wayfinding" on council votes (3-0 in both of its matches).

## References
- Singapore and Malaysian kopitiam: round white marble tables with dark rims, chequered floor tiles, porcelain
  with green prints. Taken: the round marble table as the main object, the checker strip, dark green tiles.
- Indonesian warung kopi: terracotta, wood, hand-made signage. Taken: the terracotta accent.
- Restaurant reservation floor plans (OpenTable, SevenRooms): tables as shapes with seats around them, free and
  taken seats readable at a glance. Taken: seats drawn around each table, occupancy shown, not described.
- Transit wayfinding (rejected direction D) for clear table numbers: big serif numerals on each table.

## Palette (light)
| token | hex | use |
|---|---|---|
| --bg | #fbfaf6 | page |
| --card | #ffffff | table cards, panel |
| --marble | #f1efe9 | table top |
| --rim | #3b3a38 | table rim |
| --ink | #222120 | text, taken seats (16.0:1 on --bg) |
| --muted | #5f5b55 | secondary text (6.5:1 on --bg) |
| --line | #e3dfd6 | borders |
| --accent | #a63d24 | terracotta: primary button, your seat, selection (6.0:1 on white) |
| --tile | #2d4a3e | checker strip, voice ring |

Dark theme: --bg #161917, --card #1f2320, --ink #ece8df, --muted #aaa59a, --accent #e0866a (6.6:1 on --card),
--marble #d9d5cb. One accent only. No purple, no gradients except the marble shading on table tops.

## Type
- Display: DM Serif Display 400 (headings, table numbers).
- Body: IBM Plex Sans 400/500/600. Never Inter.
- Scale: 13 / 15 / 18 / 28 / 44 px. Minimum 12 px.

## Shape, spacing, motion
- Spacing scale 4, 8, 12, 16, 20, 28, 40.
- Radius: cards 16, buttons and inputs 999 (pill), seats round.
- Shadow: none, except a 3 px accent-soft ring on the selected table.
- Motion: only the speaking ring (pulse 1 s); disabled under prefers-reduced-motion.

## Voice
Plain, warm, short. Indonesian place words are fine ("Meja", "warung kopi"). Banned: supercharge, seamless,
unlock, next-level, revolutionary, emoji anywhere.

## Signature
A walkable low-poly 3D place (three.js, `world.js`) in the same palette: marble table tops with dark rims, green and
cream checker floors, terracotta signboards, warm lamps at night. Your avatar has a terracotta ring and name tag,
a person in voice has a green ring that pulses while they talk. Flat shading, no textures from the internet, no
bloom or glow effects. The checker strip at the top of the page. The 2D marble table plan stays as the no-WebGL fallback.

## 3D rules
- Every place type is built from the same small kit (box, cylinder, sphere) and its own local props, so a warung,
  kopitiam, angkringan, street stall, izakaya counter and beer garden read differently at a glance.
- Nothing hangs between the camera and the tables: lamps sit on walls, string lights run along the edges.
- Labels: table tags just above the table top, names above heads, chat bubbles above names. Your own table hides its tag.
- Light follows the region's local time: day, dusk (17-19), night (19-6) with lamps on.

## Banned defaults
Purple/indigo gradients, Inter-only, emoji as icons, glow blobs, glassmorphism, identical icon+heading card
grids, gradient text, fake testimonials or logos, "Get started" as the only action, decorative status dots.

## 3D places (themes.js)
- Every venue maps to an archetype in `themes.js` (floor, walls, counter, sign, furniture, lights, decor); no two
  venue types share a room.
- The city makes a branch: `regionalise()` hashes the city name and picks the fit-out (floor, lights, wall art,
  chairs, table tops, sign colour, wall tone, counter finish, wainscot panel, square or round small tables,
  staggered rows, and a deeper two-column floor plan for some branches). The archetype's
  signature (checker floor, tatami, chochin, noren) is never replaced. Hue shifts skip the purple band.
- A street board outside shows the city name and a seeded skyline; two unnamed passers-by walk past outside.
- Table tags: my table first, then occupied, then nearest empty; a tag that would overlap or leave the view is
  hidden. Sizes come from view depth, so the collision test matches what is drawn. `world.info().tags` exposes the
  placed rectangles for tests.
- Privacy wording is one phrase everywhere: "Private to Meja N. Only people sitting here can read and hear you."
- Member actions: "Block" / "Unblock" (stops their messages and voice reaching you).
- Table tags always state availability the same way: "Meja 4 · 4 free", "Meja 3 · 3 free", "full".
- Name tags of people walking right past the camera are capped to normal size; your own name and chat bubbles are not.
