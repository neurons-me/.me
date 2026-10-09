# Autonomous Robotics in Space (build notes)

Page: <https://neurons-me.github.io/.me/Demos/Robots/Space/> (`Demos/Robots/Space/index.html`). Linked from the
Robots landing (<https://neurons-me.github.io/robots/>) and from `.me/Demos`. `Demos/Robots/` redirects to the landing,
the same way `Demos/SmartCities/` redirects to the Smart Cities hub.

A short story in seven passages: three small robots on three small asteroids (B 612, B 325, B 329), Earth far away.
Under one point of control (Earth decides, n = 1) cutting the link leaves each robot on its last order; with .me each
robot evaluates the same rules in its own kernel and keeps deciding.

## Pinned dependencies (unmodified, from npm via jsDelivr)

| File | sha256 | how it is checked |
|---|---|---|
| `this.me@4.1.0/dist/me.es.js` | `47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa` | fetched, hashed in the browser, imported only if it matches (unpkg fallback) |
| `this.gui@4.1.0/dist/this.gui.umd.js` | `d50e32f6a4f7603804228c074fc59df1cfdea73a4f3d5ad93ba9475227b2a577` | `<script>` SRI `sha384-umBxi9YB2FkfPkyuR4Ej4TvKyweGkUbZnvIQh/ZzaF0YGstAGl5I6xJ9fnLC+76O` + sha256 re-check |
| `this.gui@4.1.0/dist/material-symbols.css` | | SRI `sha384-dvUfVVY6nb2ef6F+dRTsSozZpefoOvMox4Ay4fQP86bSU+6yHovoYYKaRtwS+mca` |
| `react@18.3.1` / `react-dom@18.3.1` UMD | | SRI (same pins as the Veracruz .GUI page) |

## Files

| File | What |
|---|---|
| `index.html` | head, pinned scripts, meta / og |
| `space-model.js` | the model, shared by the page and Node: rules, kernels, physics truth, light-delay queue, verifyWorld |
| `space-gui.js` | the .GUI page: one spec resolved by `GUI.mount`, the scene, the passages, panels |
| `verify.mjs` | Node verification against this.me@4.1.0 |
| `assets/space-robots-og.png` | og:image, 1200×630 |

## Kernels

Four kernels on the page, each `new ME()`: one per robot and one on Earth. Robot i's kernel holds only `robots[i]`
(plus its home rock and a pointer to it). Earth's kernel holds a mirror of all three robots, written from telemetry
when it arrives (light time at c for the stylized distances: 20, 24 and 27 minutes one way).

The rules are installed once per kernel as a class template, the same text in all four:

```js
me.robots["[i]"]["="]("reserveNeeded", "shade * costPerRad + margin + lagReserve")
me.robots["[i]"]["="]("mustReturn", "battery < reserveNeeded")
me.robots["[i]"]["="]("charged", "battery >= full")
me.robots["[i]"]["="]("batteryOk", "battery >= 0 && battery <= 100")
me.robots["[i]"]["="]("drift", "pos - prevPos - vel * dt")
me.robots["[i]"]["="]("positionOk", "drift * drift <= tol * tol")
me.robots["[i]"]["="]("consistent", "batteryOk && positionOk")
me.robots["[i]"]["="]("safeMode", "!consistent")
me.robots["[i]"]["="]("goCharge", "consistent && (mustReturn || charging && !charged)")
me.robots["[i]"]["="]("explore", "consistent && !goCharge")
```

`lagReserve` is 0 on board and (2 × one-way delay + telemetry period) × drain on Earth, because Earth decides on old
data and its order arrives late.

**Pointers.** `robots[i].home -> asteroids.<rock>` is read through (`me("robots.612.home.distanceAU")`). No formula
reads through it: in this.me 4.1.0 a derived formula that reads through a pointer is not recomputed when the target
changes (CHANGELOG known issue #4). `verify.mjs` reproduces that and checks that the page's rules contain no pointer read.

**Who owns what.** Kernel: facts, derived values, k, explain(). Page/model (adapter): where a robot really is and its
real battery, motion, the light-delay queue, the action taken from the flags, drawing, the simulation clock.
`tol` (0.03 rad) absorbs one step of motion change, so the normal write order (vel, prevPos, pos) never flips
`positionOk`; a 0.6 rad glitch does. After a safe-mode flag the robot stops writing position and battery until its star
fix (20 simulated minutes), then writes a consistent measurement.

**Bridge.** this.me@4.1.0 has no change events, and `me.subscribe(...)` on a kernel proxy would write a fact named
`subscribe`, so the page passes its own `subscribe` bridge to `GUI.createMeRuntime`. Readouts re-read their path when a
write reports it (the written fact + `explain().meta.recomputed`), batched to a 4 Hz UI tick. The runtime gets a read
facade over the four kernels: `robots.<id>.*` goes to that robot's kernel, `earth.*` to Earth's.

## Verify

```
node Demos/Robots/Space/verify.mjs            # downloads this.me@4.1.0 from jsDelivr, checks sha256
node Demos/Robots/Space/verify.mjs --kernel path/to/me.es.js
```

Scenarios: A Earth decides, link up; B Earth decides, link cut; C each robot decides, link cut; D position and
battery glitches; E low battery in the dark. Every 5 simulated minutes every derived value of every kernel is compared
with a fresh kernel rebuilt from the same facts and with the same rule written in plain JS. Result (Node 22):
**192,764 checks, 0 mismatches** (163,800 rebuild/JS comparisons, 28,853 writes that did not flip `positionOk`,
111 scenario / invariant / k / isolation / pointer checks).

The page has a "Verify now" button that runs the same rebuild comparison in the browser (180 checks per run).

## What this shows, and what it does not

- It shows one instance of the spec's statement n = 1 ⟹ f ≤ 0: with the single point of control unreachable, the
  robots in this model keep their last order and fall asleep in the dark. It is not a proof.
- Invariants are re-derived and checked on every write; an inconsistent value is flagged on the write that introduces
  it, and explain() shows the inputs. It does not make a robot's sensors correct.
- k and the per-write times are measured in the browser (and in Node by verify.mjs). O(k) here means a write
  recomputes only its dependents; it is not a hard real-time guarantee on any hardware.
- Distances, speeds and battery rates are stylized. Light delay is computed at c for the stylized distances.

## .GUI notes

Used as published: `GUI.mount`, `GUI.createMeRuntime`, `GUI.useMeValue`, `GUI.Theme`, `GUI.ThemesCatalog`,
`GUI.ThemeModeToggle`, `GUI.useThemeContext`, Atoms (`Box`, `Button`, `Typography`, `Link`, `TextField`, `Slider`) and
`Molecules.Menu` / `MenuItem`. Built page-side because 4.1.0 has no such component: the scene (a small SVG
"orbital diagram" with the theme's colours), the passage stepper, and the explain() card (as on the Veracruz page).
