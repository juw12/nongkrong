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
Round marble tables with stools drawn around them; your stool is terracotta, a person in voice has a green ring
that pulses while they talk. The checker strip at the top of the page.

## Banned defaults
Purple/indigo gradients, Inter-only, emoji as icons, glow blobs, glassmorphism, identical icon+heading card
grids, gradient text, fake testimonials or logos, "Get started" as the only action, decorative status dots.
