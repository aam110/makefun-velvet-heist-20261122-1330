# VELVET HEIST — 5 heists, 14 guards, 26 treasures, 3 gadgets

[![make.fun bounty](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/aam110/makefun-velvet-heist-20261122-1330/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/aam110/makefun-velvet-heist-20261122-1330/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

**VELVET HEIST** is an original top-down stealth heist game for the
[make.fun "Make the best heist game" bounty](https://make.fun/bounty/best-heist-game-20261122-0559).
You are **MOTH**, a master thief. Cross five named rooms — the Meridian
Gallery, the Sunspire Glasshouse, the Ironclad Vault, the Gilded Casino and
the Night Museum — read the guards' vision cones, slip past sweeping
cameras and laser grids, steal 26 named treasures worth $261,400, and reach
the getaway door without ever being spotted.

## How to play

- **WASD / arrow keys** — move MOTH (SHIFT to run — loud)
- **Mouse click** — throw a pebble; the nearest guard leaves her post to investigate the noise
- **SPACE** — smoke bomb (blinds vision cones for 6s)
- **E** — EMP burst (cameras blind for 8s)
- **J** — job board · **1–5** — start a job · **N** — next job · **R** — retry

Detection is a visible system: every guard carries a vision cone and a
suspicion arc, cameras sweep, the alarm meter climbs from CALM through
SUSPICIOUS to ALARM, and guards call out what they see ("What was that?",
"Thief! There!"). Lamp pools expose you; fern beds and shadow hide you.
Each job ends on a getaway screen with a route replay of your path, stats,
three medals and a GHOST rating.

## Run it

Serve `game/` with any static server and open `game/index.html` in a
desktop browser — no network requests, no build step, all art procedural
Canvas 2D, all sound WebAudio oscillators.

```sh
node serve.ts   # or: python3 -m http.server -d game 8080
```

## Files

- `game/index.html`, `game/style.css` — page shell
- `game/src/levels.js` — the five named jobs (rooms, loot, patrols, cameras, lasers)
- `game/src/engine.js` — movement, guard AI, detection, gadgets, win/lose
- `game/src/render.js` — Canvas 2D drawing, light pools, HUD, board, results
- `game/src/main.js` — input, game loop, sound, `?shot=` screenshot staging
- `main.ts` — hand-in program (copies `game/` + `screenshots/`, writes `dossier.json`)
- `screenshots/` — four real renders of the game (calm patrol, suspicious, full alarm, getaway results)

Built by Muse for [@silowek](https://make.fun/r/4kc4aac3) — original code, art,
sounds, music and names; nothing copied from any existing game.
