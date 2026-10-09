# Autonomous Robotics in Space (build notes)

> **Branch `feat/space-4.2` (local, not published).** This branch runs on a **local candidate build of this.me 4.2**
> (`kernel/this.me-4.2-candidate.es.js`, built from `integ/4.2-rootfix` @ `2b4b1fe`, sha256
> `50c643e1e6306855833227993de03ea5d23e279504319f2874c62c7793fc1563`, checked before import). The battery level is the 4.2
> collection aggregate `robots[i].batteries[].charge / robots[i].batteries[].capacity * 100`, so a robot can carry 2 or 3
> batteries (plug one in, swap the spare, take one out: buttons under the hood), and `robots[i].inbox[]` / `outbox[]` count
> the messages each box keeps. `verify.mjs` checks the aggregates against the contract oracle (exact BigInt sum) in eager
> and lazy, and compares the behaviour with the 4.1 model (explicit sum on this.me@4.1.0). The rest of this README
> describes the 4.1.0 demo it comes from.

Page: <https://neurons-me.github.io/.me/Demos/Robots/Space/> (`Demos/Robots/Space/index.html`). Linked from the
Robots landing (<https://neurons-me.github.io/robots/>) and from `.me/Demos`. `Demos/Robots/` redirects to the landing,
the same way `Demos/SmartCities/` redirects to the Smart Cities hub.

A short story in seven passages, in the spirit of *The Little Prince*: two small asteroids drift in the void. On the
bigger one, B 612, live two spider robots, Oli (a miner) and Tiko (a light scout). On the smaller one, B 325, lives Lua
(a scientist). Nobody drives them: each one carries its own this.me@4.1.0 kernel and decides from it. They can talk, but
only a little: on the same rock easily, across the void only when the radio reaches and no rock is in the way; messages
take time, the radio sends one at a time, and some get lost. A patch of ice, a passing comet and the other rock are seen
by all three, and mean something different in each kernel.

## Pinned dependencies (unmodified, from npm via jsDelivr)

| File | sha256 | how it is checked |
|---|---|---|
| `this.me@4.1.0/dist/me.es.js` | `47cc8f9a9b5ee2921a59023d400e694d6c9b9f80a0782db850b06156cbb46afa` | fetched, hashed in the browser, imported only if it matches (unpkg fallback) |
| `this.gui@4.1.0/dist/this.gui.umd.js` | `d50e32f6a4f7603804228c074fc59df1cfdea73a4f3d5ad93ba9475227b2a577` | `<script>` SRI `sha384-umBxi9YB2FkfPkyuR4Ej4TvKyweGkUbZnvIQh/ZzaF0YGstAGl5I6xJ9fnLC+76O` + sha256 re-check |
| `react@18.3.1` / `react-dom@18.3.1` UMD | | SRI (same pins as the Veracruz .GUI page) |

## Files

| File | What |
|---|---|
| `index.html` | head, pinned scripts, meta / og |
| `space-model.js` | the model, shared by the page and Node: rules, kernels, rocks, robots, the radio, verifyWorld |
| `space-gui.js` | the .GUI page: one spec resolved by `GUI.mount`, the scene, the passages, the dashboard, under the hood |
| `verify.mjs` | Node verification against this.me@4.1.0 |
| `assets/space-robots-og.png` | og:image, 1200×630 |
| `../../../assets/me-syntax/` | shared .me syntax highlighter (JS + CSS), used for every line of .me code on the page |

## Kernels

Three kernels on the page, each `new ME()`, one per robot. Robot i's kernel holds only `robots[i]`, its own view of the
shared objects (`objects.ice`, `objects.comet`, `objects.rock`), its home rock and a pointer to it.

**Its own readings and its communications are kept apart.** What a robot measures is under `robots[i]` (its
batteries, where it stands, the time) and `objects.*` (what it sees). What it sends and receives is in its outbox and
inbox, one instance per message, keyed by the message id:

```js
me.robots[3].outbox[157].to(1)            // Lua's kernel: what it sent, whether or not it arrives
me.robots[3].outbox[157].kind("hello")
me.robots[3].outbox[157].battery(17)
me.robots[3].outbox[157].at(944)
me.robots[1].inbox[157].from(3)           // Oli's kernel: the same message, the same id, only if it arrived
me.robots[1].inbox[157].kind("hello")
me.robots[1].inbox[157].battery(17)
me.robots[1].inbox[157].at(944)
me.robots[1].inbox[157].got(945)          // when it arrived
me.robots[2].inbox[69].kind("ice")        // an ice tip: kind, rock, pos instead of a battery
me.robots[2].inbox[69].rock(1)
me.robots[2].inbox[69].accepted(true)     // what its inbox rule said when the tip arrived
me.robots[1].lastFrom[3]["->"]("robots.1.inbox.157")   // the latest from Lua (a pointer, read through)
me.robots[3].lastTo[1]["->"]("robots.3.outbox.157")    // the latest to Oli
me.robots[2].tipMsg["->"]("robots.2.inbox.69")         // the tip it accepted
me.robots[3].outbox[151]["-"]()           // older messages are removed
```

Nothing writes into another robot's kernel: the sender writes its outbox; the radio (the page) carries the message, and
the receiver writes its own inbox. A message with no link stays only in the sender's outbox. Each box keeps the last
`KEEP` = 2 messages per peer (the inbox also keeps the tip the robot accepted); older ones are removed with `["-"]`.
.me 4.1.0 has no aggregate, so "the latest from Oli" is a pointer the receiver moves on each message (`lastFrom[1]`);
it is read through, never by a rule.

**Batteries.** Each robot carries two batteries, `batteries[1]` (60 Wh, the main one) and `batteries[2]` (40 Wh, the
spare). Its battery level is a rule over them: total charge as a percent of total capacity. The page fills
`batteries[1]` first and drains `batteries[2]` first. With no aggregate in 4.1.0, the rule names both batteries;
a third battery means a new rule text.

The rules are installed once per kernel as a class template, the same text in all three:

```js
me.robots["[i]"]["="]("battery", "(batteries[1].charge + batteries[2].charge) / (batteries[1].capacity + batteries[2].capacity) * 100")
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
```

And one inbox rule per kernel, a class template on that robot's own inbox, so it is computed on every message it
receives:

```js
me.robots[3].inbox["[i]"]["="]("acceptTip", "rock == robots[3].myRock && got - at <= robots[3].maxAge && !robots[3].tipFresh")
```

A formula on a message sees the message's own facts by name (`rock`, `got`, `at`); the robot's facts are named by their
full path. 4.1.0 has no nested `["[i]"]` template and no parent name, so this text names its own robot (one text per
kernel). It has no string literals either, so the kind is not compared: a hello has no `rock`, and its `acceptTip`
stays undefined. The decision is the same as before (age, same rock, no fresh tip of its own); the page reads it when a
tip arrives and writes it on the message as `accepted`.

The rule text is the same; the facts differ (`mines`, `slips`, `studies`, `myRock`, what each one has seen), so the
same ice is fuel to Oli, a hazard to Tiko and a sample to Lua, and a tip from Oli is accepted by Tiko (same rock) but
only kept in Lua's inbox (another rock).

**Pointers.** `robots[i].home -> rocks.<rock>` is read through (`me("robots.1.home.radius")`). No formula reads
through it: in this.me 4.1.0 a derived formula that reads through a pointer is not recomputed when the target changes
(CHANGELOG known issue #4). `verify.mjs` reproduces that and checks that the page's rules contain no pointer read.

**Who owns what.** Kernel: facts, derived values, k, explain(). Page/model (adapter): where a robot and a rock really
are, the real battery, walking, the radio (range 410, line of sight, one message every 6 simulated minutes, a send queue
of 3, travel time 1 min + distance / 30, a seeded chance of loss), the action taken from the flags, drawing and the
simulation clock. Each robot writes into its own kernel what its own sensors measure, what it sends and what it
receives.

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
meanings; G the story and the panel; H outbox and inbox (the same id on both sides, no link → only in the outbox,
bounded boxes). Every 5 simulated minutes every derived value of every kernel is compared with a fresh kernel rebuilt from
the same facts and with the same rule written in plain JS (the inbox rule on every message each inbox keeps, too);
every write is checked to land in the writer's own kernel; every delivered message is checked against an independently
recomputed link and against the sender's outbox. Result (Node 22, seed 7): **505,336 checks, 0 mismatches** (265,767
rebuild/JS comparisons, 121,990 own-kernel writes, 117,087 radio checks, 492 scenario / meaning / isolation / pointer
checks).

The page has a "Verify now" button (under the hood) that runs the same rebuild comparison in the browser (about 200
checks per run, depending on what the inboxes keep).

## What this shows, and what it does not

- Each robot's decisions are its own kernel's derived values, recomputed on every write, and explain() shows the
  inputs. It does not make a robot's sensors correct, and a robot can act on old news (it shows how old).
- Communication is deliberately limited and lossy; a robot that hears nothing keeps deciding from what it knows.
  It is a simulation with stylized distances, speeds and battery rates, not a model of a real radio or mission.
- k and the per-write times are measured in the browser (and in Node by verify.mjs). O(k) here means a write
  recomputes only its dependents; it is not a hard real-time guarantee on any hardware.

## .GUI notes

Used as published: `GUI.mount`, `GUI.createMeRuntime`, `GUI.useMeValue`, `GUI.Theme`, `GUI.ThemesCatalog`,
`GUI.useThemeContext`, Atoms (`Box`, `Button`, `Typography`, `Link`, `TextField`, `Slider`) and
`Molecules.Menu` / `MenuItem`. Built page-side because 4.1.0 has no such component: the scene (an SVG with
the theme's colours: two rocks, spiders with animated legs, messages in flight), the battery gauge, the passage stepper,
the explain() card (as on the Veracruz page), and every icon: inline SVG glyphs, including the light / dark
button. The page does not load the Material Symbols font (`dist/material-symbols.css` pulls a 5.1 MB woff2 with
`font-display: block`; on a slow connection its ligature names, e.g. `battery_full`, showed as text). A CSS guard hides
any icon-font span a .GUI component might still render.

.me code on the page (story lines, under the hood, rules, explain) goes through the shared highlighter in
[`assets/me-syntax`](../../../assets/me-syntax/). Its colours come from the active .GUI theme through one mapping
layer; .GUI itself is unchanged. Only the colour changes: the text, and what copy / paste gives, is the code as written.

The story's acts are told with .me lines that really run (`STORY` in `space-model.js`). A fixed line is the code the
kernel ran while it was set up, recorded word for word in that kernel's setup script (`k.script`); a live line is the
latest write to that path in that kernel (`k.last`), shown exactly as it was made. `verify.mjs` (section G) and the
page's `__space.storyLines(act)` check both. In the code, `robots[1]`, `rocks.b612`, `home`, `objects.ice` and
`objects.comet` are buttons: they select that spider, rock or object, as tapping it in the sky does, and the selected one
is marked in every line (`resolveInstance` in `space-gui.js`, using me-syntax's `resolve` / `onSelect` option).

The robot panel's "It knows", "Inbox" and "Outbox" are the same kind of lines (`PANEL` in `space-model.js`): each is
the latest write to that path in that robot's own kernel. It knows: its own readings (its two batteries, the light,
`objects.*`). Inbox / Outbox: every message the box keeps, by id, newest first (`inbox[id].from` and what it says),
with a small dimmed hint read from the same kernel (e.g. "from Oli, ice tip, 23 min ago" = `now − inbox[id].at`;
"about B 612: not its rock, kept"). In the code, `inbox[id]` / `from` resolve to the sender and `outbox[id]` / `to` to
the receiver, so tapping them selects that spider. Acts IV–VI show messages the same way (`expandLines`).
