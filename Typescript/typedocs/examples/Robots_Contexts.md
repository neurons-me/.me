# Robots Understanding Context ​

This example shows a practical `.me` pattern for robot reasoning:

- one shared world object
- multiple robot-specific contexts
- pointers from each robot to the same object and its current context
- broadcast derivations that turn context into action policy
- `explain()` to audit why each robot decided to act

## Full Script ​

```ts
import ME from "this.me";

const me = new ME();

me["@"]("robot-context-lab");

// Shared object
me.objects.canister7.name("Blue canister");
me.objects.canister7.massKg(6);
me.objects.canister7.fragile(true);
me.objects.canister7.sterile(false);

// Contexts
me.contexts.warehouse.pickupZone(true);
me.contexts.warehouse.sterileZone(false);
me.contexts.warehouse.movingVehicles(false);

me.contexts.hospital.pickupZone(false);
me.contexts.hospital.sterileZone(true);
me.contexts.hospital.movingVehicles(false);

me.contexts.street.pickupZone(false);
me.contexts.street.sterileZone(false);
me.contexts.street.movingVehicles(true);

// Robots
me.robots.loader.name("Loader-1");
me.robots.loader.liftCapacityKg(20);
me.robots.loader.target["->"]("objects.canister7");
me.robots.loader.context["->"]("contexts.warehouse");

me.robots.nurse.name("NurseBot-2");
me.robots.nurse.liftCapacityKg(12);
me.robots.nurse.target["->"]("objects.canister7");
me.robots.nurse.context["->"]("contexts.hospital");

me.robots.courier.name("Courier-3");
me.robots.courier.liftCapacityKg(18);
me.robots.courier.target["->"]("objects.canister7");
me.robots.courier.context["->"]("contexts.street");

// Broadcast context-aware understanding
me.robots["[i]"]["="]("canLift", "target.massKg "]("objects.canister7");
me.robots.nurse.target["->"]("objects.canister7");
me.robots.courier.target["->"]("objects.canister7");
```

All robots point to the same object. `.me` does not duplicate the world model just because multiple agents observe it.

### 2) Context lives in structure ​

```ts
me.robots.loader.context["->"]("contexts.warehouse");
me.robots.nurse.context["->"]("contexts.hospital");
me.robots.courier.context["->"]("contexts.street");
```

The difference is not hidden in imperative branching code. It is explicit in the graph:

- warehouse context makes fragility relevant to grip
- hospital context makes sterility relevant to handling
- street context makes traffic relevant to motion

### 3) One policy can fan out to every robot ​

```ts
me.robots["[i]"]["="]("needsSterileHandling", "context.sterileZone && !target.sterile");
```

The derivation is declared once and automatically specialized for each robot through its local pointers.

### 4) Meaning changes when context changes ​

The same canister is:

- cargo for `Loader-1`
- a sterile-risk object for `NurseBot-2`
- a yield-sensitive object for `Courier-3`

If the object becomes sterile or the traffic clears, the interpretation updates without rewriting the robot logic.

### 5) You can audit the decision ​

```ts
me.explain("robots.nurse.canProceed");
```

This makes the robot's decision inspectable:

- what expression was used
- which dependencies were read
- which context fields affected the outcome

## Mental Model ​

`.me` is useful for robotics because it lets you model:

- shared world state
- subjective robot viewpoints
- context-specific policy
- explainable action flags

with one reactive tree instead of scattered conditionals.

## Run ​

```bash
node tests/Demos/Robots_Contexts.ts
```

## Where To Go Next ​

- [Algebra of Contexts](./../Algebra-of-Contexts.html)
- [Shared Meaning](./../Shared-Meaning.html)
- [Runtime Surface](./../Runtime-Surface.html)
- [Syntax](./../Syntax.html)