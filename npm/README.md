<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1769890772/this.me.png" />
  <img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" alt=".me Logo" width="144" />
</picture>

# .me
###### **Your personal semantic kernel.**

Define who you are, **what you own**, and how everything connects — once.  
Then use it everywhere: apps, websites, dashboards, tickets, and more.

```bash
npm install this.me
```

## In 30 seconds

```ts
import Me from "this.me";
const me = new Me();

me["@"]("jabellae");                    // Your identity

me.profile.name("Abella");
me.profile.bio("Building the semantic web.");

me.users.ana.name("Ana");
me.users.ana.age(22);

me.friends.ana["->"]("users.ana");      // Create relationships

// Automatic logic
me.friends["[i]"]["="]("is_adult", "age >= 18");

console.log(me("friends.ana.is_adult"));        // → true
console.log(me("friends[age > 18].name"));      // → { ana: "Ana" }
```

### What is .me?

- An **infinite semantic tree** where you define the rules.
- Create data, relationships, formulas, and private universes.
- Everything is **reactive** — change one value and everything that depends on it updates automatically.
- Secrets are **structural**: entire branches can be hidden and encrypted by design.
- Export your entire state and restore it anywhere — it works exactly the same.

### Why people like it

- No schemas needed — if you can imagine a path, it exists.
- Real privacy — not promises, but built into the structure.
- Define once, use everywhere — stop repeating code across projects.
- Full transparency — `me.explain("path")` shows exactly how any value was computed.

### Quick secret test

```ts
me.wallet["_"]("my-secret-key");      // Create a hidden universe
me.wallet.balance(5000);
me.wallet.note("Travel savings");

console.log(me("wallet"));            // → undefined (root is hidden)
console.log(me("wallet.balance"));    // → 5000 (leaf is still accessible)
```

### Who is .me for?

Developers and creators who want to:

- Stop repeating the same infrastructure across multiple apps
- Own and control their digital identity
- Have real structural privacy
- Build clean, scalable systems without the usual mess

### Installation

```bash
npm install this.me
```

[✍ Read the Docs →](https://neurons-me.github.io/.me/npm/docs/)

---

**MIT License** © 2025 [neurons.me](https://neurons.me)
Made in Veracruz, Mexico.
**∴ Witness our seal**  
**suiGn**
```
