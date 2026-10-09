# Autonomous Robotics in Space (build notes)

Page: <https://neurons-me.github.io/.me/Demos/Robots/Space/> (`Demos/Robots/Space/index.html`). Linked from the
Robots landing (<https://neurons-me.github.io/robots/>) and from `.me/Demos`. `Demos/Robots/` redirects to the landing,
the same way `Demos/SmartCities/` redirects to the Smart Cities hub.

A short story in seven passages, in the spirit of *The Little Prince*: two small asteroids drift in the void. On the
bigger one, B 612, live two spider robots, Pip (a miner) and Tiko (a light scout). On the smaller one, B 325, lives Lua
(a scientist). Nobody drives them: each one carries its own this.me@4.1.0 kernel and decides from it. They can talk, but
only a little: on the same rock easily, across the void only when the radio reaches and no rock is in the way; messages
take time, the radio sends one at a time, and some get lost. A patch of ice, a passing comet and the other rock are seen
by all three, and mean something different in each kernel.

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
| `space-model.js` | the model, shared by the page and Node: rules, kernels, rocks, robots, the radio, verifyWorld |
| `space-gui.js` | the .GUI page: one spec resolved by `GUI.mount`, the scene, the passages, the dashboard, under the hood |
| `verify.mjs` | Node verification against this.me@4.1.0 |
| `assets/space-robots-og.png` | og:image, 1200×630 |

## Kernels

Three kernels on the page, each `new ME()`, one per robot. Robot i's kernel holds only `robots[i]`, its own view of the
shared objects (`objects.ice`, `objects.comet`, `objects.rock`), its home rock and a pointer to it. Nothing writes into
another robot's kernel: a message is data that the receiver writes into its own kernel as "heard" (`heard.<from>.*`,
`inbox*`), and its own rule decides whether to take it on (`acceptTip`).

The rules are installed once per kernel as a class template, the same text in all three:

```js
me.robots["[i]"]["="]("reserve", "lightDist * costPerRad + margin")
me.robots["[i]"]["="]("mustCharge", "battery < reserve")
me.robots["[i]"]["="]("charged", "battery >= full")
me.robots["[i]"]["="]("goCharge", "mustCharge || charging && !charged")
me.robots["[i]"]["="]("asleep", "battery <= 0")
me.robots["[i]"]["="]("iceIsFuel", "mines && objects.ice.seen")
me.robots["[i]"]["="]("iceIsHazard", "slips && objects.ice.seen")
me.robots["[i]"]["="]("iceIsSample", "studies && objects.ice.seen")
me.robots["[i]"]["="]("cometIsHazard", "!studies && objects.comet.near")
me.robots["[i]"]["="]("cometIsSample", "studies && objects.comet.near")
me.robots["[i]"]["="]("rockInReach", "objects.rock.inRange")
me.robots["[i]"]["="]("shelter", "!goCharge && cometIsHazard")
me.robots["[i]"]["="]("watchComet", "!goCharge && cometIsSample")
me.robots["[i]"]["="]("avoidIce", "iceIsHazard && objects.ice.near")
me.robots["[i]"]["="]("tipAge", "now - tipAt")
me.robots["[i]"]["="]("tipFresh", "tipAge <= maxAge")
me.robots["[i]"]["="]("tipMine", "tipRock == myRock")
me.robots["[i]"]["="]("followTip", "!goCharge && !objects.comet.near && tipFresh && tipMine && !slips")
me.robots["[i]"]["="]("explore", "!goCharge && !shelter && !watchComet && !followTip")
me.robots["[i]"]["="]("inboxAge", "now - inboxAt")
me.robots["[i]"]["="]("acceptTip", "inboxAge <= maxAge && inboxRock == myRock && !tipFresh")
```

The rule text is the same; the facts differ (`mines`, `slips`, `studies`, `myRock`, what each one has seen), so the
same ice is fuel to Pip, a hazard to Tiko and a sample to Lua, and a tip from Pip is accepted by Tiko (same rock) but
only kept as "heard" by Lua (another rock).

**Pointers.** `robots[i].home -> rocks.<rock>` is read through (`me("robots.1.home.radius")`). No formula reads
through it: in this.me 4.1.0 a derived formula that reads through a pointer is not recomputed when the target changes
(CHANGELOG known issue #4). `verify.mjs` reproduces that and checks that the page's rules contain no pointer read.

**Who owns what.** Kernel: facts, derived values, k, explain(). Page/model (adapter): where a robot and a rock really
are, the real battery, walking, the radio (range 410, line of sight, one message every 6 simulated minutes, an outbox
of 3, travel time 1 min + distance / 30, a seeded chance of loss), the action taken from the flags, drawing and the
simulation clock. Each robot writes into its own kernel what its own sensors measure and what it hears.

**Bridge.** this.me@4.1.0 has no change events, and `me.subscribe(...)` on a kernel proxy would write a fact named
`subscribe`, so the page passes its own `subscribe` bridge to `GUI.createMeRuntime`. Readouts re-read their path when a
write reports it (the written fact + `explain().meta.recomputed`), batched to a 4 Hz UI tick. The runtime gets a read
facade over the three kernels: `robots.<id>.*` goes to that robot's kernel, `r<id>.objects.*` to that robot's view.

## Verify

```
node Demos/Robots/Space/verify.mjs            # downloads this.me@4.1.0 from jsDelivr, checks sha256
node Demos/Robots/Space/verify.mjs --kernel path/to/me.es.js
```

Scenarios: A the simulation by itself for 3,000 simulated minutes; B messages across the void; C B 325 held out of
range; D a drained battery; E a shared tip (Tiko accepts, Lua does not, an old tip is refused); F one object, three
meanings. Every 5 simulated minutes every derived value of every kernel is compared with a fresh kernel rebuilt from
the same facts and with the same rule written in plain JS; every write is checked to land in the writer's own kernel;
every delivered message is checked against an independently recomputed link. Result (Node 22, seed 7):
**207,992 checks, 0 mismatches** (137,403 rebuild/JS comparisons, 67,687 own-kernel writes, 2,794 radio checks, 108
scenario / meaning / isolation / pointer checks).

The page has a "Verify now" button (under the hood) that runs the same rebuild comparison in the browser (189 checks
per run).

## What this shows, and what it does not

- Each robot's decisions are its own kernel's derived values, recomputed on every write, and explain() shows the
  inputs. It does not make a robot's sensors correct, and a robot can act on old news (it shows how old).
- Communication is deliberately limited and lossy; a robot that hears nothing keeps deciding from what it knows.
  It is a simulation with stylized distances, speeds and battery rates, not a model of a real radio or mission.
- k and the per-write times are measured in the browser (and in Node by verify.mjs). O(k) here means a write
  recomputes only its dependents; it is not a hard real-time guarantee on any hardware.

## .GUI notes

Used as published: `GUI.mount`, `GUI.createMeRuntime`, `GUI.useMeValue`, `GUI.Theme`, `GUI.ThemesCatalog`,
`GUI.ThemeModeToggle`, `GUI.useThemeContext`, Atoms (`Box`, `Button`, `Typography`, `Link`, `TextField`, `Slider`) and
`Molecules.Menu` / `MenuItem`, and `GUI.Icon` (Material Symbols). Built page-side because 4.1.0 has no such component: the scene (an SVG with
the theme's colours: two rocks, spiders with animated legs, messages in flight), the battery gauge, the passage stepper,
and the explain() card (as on the Veracruz page).
