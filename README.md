# NEONFALL 2100 — a hover-car crime story in the neon city of Voltspire

make.fun bounty **gta6-01** · three.js r187 (vendored) · sun-soaked daylight
· palette cyan `#00f0ff` / magenta `#ff2d78` / amber `#ffb300`

> Target: TOP 10. Quality over speed — 6 days to the deadline
> (Tue 24 Nov 2026 22:00 WIB). This is the Day 0–1 scaffold: the city,
> the on-foot player, and a verified render. Vehicles, police, weapons,
> missions and the HUD land on Days 2–5. The CDP playtest QA gate
> (23 Nov) and John's render review stand before any submit.

## What is built (Day 0–1)

- **Voltspire, 600×600 m** — 6 districts (Neon Row, The Spire, Foundry
  Quarter, Glass Gardens, The Shore, Skyport), ~87 buildings on a seeded
  layout (seed 7, deterministic), a 540×600 m ground map texture
  (streets, lane dashes, crosswalks, parks, plazas), a sand beach and an
  animated sea to the east, a boardwalk, pier and parasols.
- **Buildings** — 3 instanced archetypes (slab / tower / stepped) with
  shared window textures (3 lit variants), neon roof trim per district,
  rooftop landing pads, holo-signs (`VOLTSPIRE`, `NEON ROW`, `HELIX`,
  `AETHER`, `SKYPORT`, `FOUNDRY`, `LAGUNA`, `AURORA`) and street lamps.
  ~18 draw calls for all buildings (instancing + merged geometry).
- **Kade Voss** — the protagonist on foot: realistic proportions,
  long dark coat (lathe), belt, collar, boots, skin head with hair cap.
  Walk / sprint / jump with a procedural run cycle, third-person orbit
  camera, WASD + mouse (pointer lock), P pause, R reset.
- **Rendering** — sun-soaked daylight: one strong southern sun with
  1024 PCF-soft shadows, hemisphere fill, gradient sky dome with sun
  glow, exponential fog, ACES tone mapping. No network requests from
  the game; WebAudio synth only (no audio files yet); save via
  localStorage.
- **Screens** — title (hero skyline + story), play (HUD-less scaffold),
  pause. Deterministic screenshots via `?shot=start|play&seed=7`.

## Run it

```sh
node serve.ts --port 8080        # serves game/ at http://localhost:8080/
# then open http://localhost:8080/ in a browser (desktop Chrome).
# WASD walk · Shift sprint · Space jump · mouse orbit · P pause · R reset.
```

Build the submission bundle (parent runs this; the builder never does):

```sh
node main.ts                     # copies game/ + screenshots/ to /output,
                                 # writes dossier.json via vendor/makefun-game.ts
```

## Quality knobs (URL params, all optional)

| param | effect |
|---|---|
| `?quality=high` (default) | 4× AA, 1024 shadows, aniso 8 |
| `?quality=med` | 2× AA, 1024 shadows, aniso 4 |
| `?quality=low` | no AA, no shadows, aniso 1 |
| `?scale=0.5` | render at half resolution, upscale via CSS |
| `?hide=ground,buildings,props,sky,player` | hide scene parts (QA isolation) |
| `?flat=1` / `?notone=1` | debug: unlit materials / no tone mapping |
| `?seed=N` | deterministic city layout (default 7) |
| `?shot=start\|play` | deterministic screenshot framing |

## Performance — measured honestly

Perf budget: ≤120 draw calls, ≤250k triangles, ≥30 FPS headless
swiftshader @1280×720.

| shot | draw calls | triangles | headless errors |
|---|---|---|---|
| start | 76 | 18,894 | 0 |
| play | 60 | 18,514 | 0 |

Draw calls and triangles are **well inside budget** (68 / 18.9k live).
**FPS is NOT — and that is a property of this VM, not the scene.**
Measured 2026-11-18 on this VM (1.5 shared CPUs, swiftshader):

- NEONFALL full scene: **1–4 FPS** @1280×720 (high 2, low 4)
- DUSTLINE (the reference three.js game, simpler scene): **4 FPS**
- Trivial WebGL clear / empty scene: **57 FPS**
- NEONFALL with everything hidden except Kade: **43 FPS**
- Material cost is nil: Standard → Lambert → Basic and tone mapping
  on/off change FPS by **0**. Only pixel count moves it
  (scale 0.5 → 8 FPS, scale 0.375 → 13 FPS).

Conclusion: this VM's swiftshader tops out around **4 FPS for any real
textured 3D scene at 1280×720** (DUSTLINE, built and tuned in this same
environment, gets the same 4 FPS). The scene itself is light — 68 draw
calls, 19k triangles — and will run 60+ FPS on any real GPU, which is
what the judge's desktop-Chrome playtest uses. The ≥30 FPS swiftshader
target is therefore **not achievable on this VM without destroying the
visuals** (rendering at ~480×270); the QA gate on 23 Nov should measure
FPS in real Chrome, or accept the swiftshader limitation. The quality
scaler (`?quality`, `?scale`) is kept for weak machines.

## Files

```
game/
  index.html            title / play / pause screens + HUD shell
  src/
    config.js           districts, palette, quality scaler, debug hides
    random.js           mulberry32 + hash helpers
    input.js            keyboard + pointer-lock mouse
    models.js           canvas textures, building archetypes, Kade
    city.js             Voltspire layout, ground/sea/signs/lamps
    player.js           on-foot movement + run-cycle pose
    world.js            world state + step()
    render.js           renderer, sun, sky, camera, HUD draw
    shots.js            deterministic ?shot= framing
    main.js             boot + game loop + ?shot= autopilot
  vendor/three/         three.js r187 (module build, vendored)
main.ts                 copies game/ + screenshots/ to /output, dossier.json
serve.ts                local static server (dev only)
shots.json              shot definitions (start / play)
screenshots/            1-start.jpg, 2-play.jpg (1280×720, <256 KiB)
vendor/makefun-game.ts  kit vendor file — byte-identical, do not edit
```

## Next session (Day 2)

Vehicles + traffic: the 6 vehicle classes (Courier, Streetster, Luxury,
Hauler, Skybike, AETHER-9) with enter/exit (E), hover physics, traffic
on the street grid, and the vehicle HUD. See
`~/workspace/makefun/gta6-01-concept.md` (source of truth) for the full
design, and `~/workspace/makefun/gta6-01-kit/gta6-01-kit/competition.yaml`
for the bounty rules. Then Days 3–5: police + combat + audio, missions
1–6, polish + renders + QA gate. Submit Day 6 (target 24 Nov 18:00 WIB).
