---
layout: readme
title: Robots That Understand Context
---


# Robots That Understand Context

<img src="./assets/robots.png" alt="Robots" width="120" align="right" style="margin-left:24px;" />

This demo teaches one simple idea:
> The same thing can mean different things depending on who is looking at it and where they are.

For humans, this is obvious. A **blue canister** in a warehouse is cargo. 
The same **blue canister** inside a hospital corridor may be a sterile risk. 
On a street crossing, it may be a traffic problem. 
In an operating room, it may require precision handling.

[`.me Docs`](https://neurons-me.github.io/.me) lets you model that kind of meaning directly.
[.me Repository](https://github.com/neurons-me/.me/) / [Robots Demo Source Code](https://github.com/neurons-me/.me/blob/main/Typescript/tests/Demos/Robots_Contexts.ts)

---

## The Tiny Mental Model

<img src="./assets/robots-context.png" alt="Robot Context" width="220" align="left" style="margin-right:24px;margin-bottom:8px;" />

Think of [`.me`](https://neurons-me.github.io/.me) as a living notebook made of paths.

```ts
me.objects.canister7.massKg(6)
me.objects.canister7.fragile(true)
me.contexts.hospital.sterileZone(true)
```

Each path stores one small fact.

<br clear="left" />

### Then you can connect facts:

```ts
me.robots.nurse.target["->"]("objects.canister7")
me.robots.nurse.context["->"]("contexts.hospital")
```

And finally you can teach the graph rules:

```ts
me.robots["[i]"]["="]("canProceed", "canLift && softGripReady && !needsHumanReview")
```

That rule is not just a value. It is a live derivation. When the canister changes, the robots update.

---

## What The Demo Builds
The demo has three kinds of things:

| Thing | Example | What it means |
| --- | --- | --- |
| Object | `objects.canister7` | The physical item everyone sees |
| Context | `contexts.hospital` | The environment around the item |
| Robot | `robots.nurse` | The agent trying to act |

The important part is that every robot points to the same object:

```ts
me.robots.loader.target["->"]("objects.canister7")
me.robots.nurse.target["->"]("objects.canister7")
me.robots.courier.target["->"]("objects.canister7")
me.robots.surgeon.target["->"]("objects.canister7")
```

There are not four canisters. There is one canister with four interpretations.

---

## Step 1: Describe The Object

Start with the shared physical thing:

```ts
me.objects.canister7.name("Blue Canister")
me.objects.canister7.massKg(6)
me.objects.canister7.fragile(true)
me.objects.canister7.sterile(false)
```

For dummies version:

The canister is blue, light enough for many robots, fragile, and not sterile yet.

Nothing smart has happened yet. We only gave the graph facts.

---

## Step 2: Describe The Places

Now give the world different rooms.

```ts
me.contexts.warehouse.name("Warehouse Inbound")
me.contexts.warehouse.pickupZone(true)
me.contexts.warehouse.sterileZone(false)
me.contexts.warehouse.movingVehicles(false)

me.contexts.hospital.name("Hospital Sterile Corridor")
me.contexts.hospital.sterileZone(true)

me.contexts.street.name("Street Crossing")
me.contexts.street.movingVehicles(true)

me.contexts.operatingRoom.name("Operating Room")
me.contexts.operatingRoom.sterileZone(true)
me.contexts.operatingRoom.precisionZone(true)
```

For dummies version:

The warehouse cares about pickup. The hospital cares about sterility. The street cares about moving vehicles. The operating room cares about sterility and precision.

The object did not change. The meaning around it changed.

---

## Step 3: Give Each Robot A Context

Each robot gets its own view of the same canister.

```ts
me.robots.loader.context["->"]("contexts.warehouse")
me.robots.nurse.context["->"]("contexts.hospital")
me.robots.courier.context["->"]("contexts.street")
me.robots.surgeon.context["->"]("contexts.operatingRoom")
```

Now the graph can answer questions like:

```ts
me("robots.nurse.target.name")
me("robots.nurse.context.name")
```

For dummies version:

The nurse robot sees the blue canister from inside a hospital corridor. The courier sees the exact same canister from a street crossing. Same object, different situation.

---

## Step 4: Teach The Rules Once

The demo applies policies to every robot with `[i]`.

```ts
me.robots["[i]"]["="]("canLift", "target.massKg < liftCapacityKg")
```

Read that as:

> For every robot, `canLift` is true when the target mass is below that robot's lift capacity.

Then more rules:

```ts
me.robots["[i]"]["="](
  "needsSoftGrip",
  "target.fragile && (context.pickupZone || context.precisionZone || requiresPrecisionGrip)",
)

me.robots["[i]"]["="]("needsSterileHandling", "context.sterileZone && !target.sterile")
me.robots["[i]"]["="]("mustYield", "context.movingVehicles")
```

For dummies version:

If the canister is fragile and the place requires care, use a soft grip. If the place is sterile but the canister is not, stop for review. If vehicles are moving, yield.

The final decision is also a rule:

```ts
me.robots["[i]"]["="](
  "canProceed",
  "canLift && softGripReady && !needsHumanReview && contextAllowsMotion",
)
```

The robot can proceed only when all the smaller decisions agree.

---

## Step 5: Watch Meaning Change Live

At first:

| Robot | Context | Why it behaves differently |
| --- | --- | --- |
| Loader | Warehouse | Can lift, has soft grip, no sterile problem |
| NurseBot | Hospital | Needs sterile handling because the canister is not sterile |
| Courier | Street | Must yield because vehicles are moving |
| SurgeonBot | Operating Room | Needs sterile target and precision handling |

Then the world changes:

```ts
me.objects.canister7.sterile(true)
me.contexts.street.movingVehicles(false)
```

The canister becomes sterile. The street clears.

Now the graph recomputes the affected robot decisions. No new imperative code is needed. You do not write "update nurse, update courier, update surgeon." The dependencies already know what changed.

---

## Why This Is Different From A Normal App

In a normal app, you often write logic like this:

```ts
if (robot.type === "nurse") {
  checkHospitalRules()
}

if (robot.type === "courier") {
  checkTrafficRules()
}
```

That grows into scattered conditionals.

In `.me`, the knowledge lives in the graph:

- The object owns its facts.
- The context owns its facts.
- The robot points to both.
- The policy reads the paths.
- The result explains itself.

This is why the demo is not only "robots moving objects." It is a tiny model of contextual intelligence.

---

## Explainability

The demo can ask:

```ts
me.explain("robots.surgeon.canProceed")
```

That gives a trace of the decision:

- the final value,
- the expression used,
- the input values,
- and the paths it depended on.

For dummies version:

The robot does not only say "yes" or "no." It can show why.

That matters because an intelligent system should be auditable. If the graph makes a decision, you can inspect the chain of meaning behind it.

---

## Build It Yourself

You can rebuild the demo in this order:

1. Create the object.
2. Create the contexts.
3. Create the robots.
4. Point every robot to the same object.
5. Point every robot to a different context.
6. Add the policies with `[i]`.
7. Change the world.
8. Ask `.me` what changed and why.

Run the real demo from the package:

```bash
cd npm
npm install
node tests/Demos/Robots_Contexts.ts
```

To run every demo in the folder:

```bash
npm run test:demos:run-all
```

---

## The Big Idea

Context is not decoration. Context changes meaning.

`.me` gives you a way to model that directly:

```text
same object + different context + explainable policy = different behavior
```

That is what "Robots That Understand Context" means.

---
