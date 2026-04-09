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

// Create your semantic kernel
const me = new Me();

me["@"]("jabellae");                    // Your digital identity

// Simple data
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// Relationships
me.users.ana.name("Ana");
me.users.ana.age(22);

me.friends.ana["->"]("users.ana");      // Ana is my friend

// Automatic derived logic — no hooks, no reducers
me.friends["[i]"]["="]("isAdult", "age >= 18");

// Query naturally
console.log(me("friends.ana.isAdult"));           // → true

// Powerful queries in one line
console.log(me("friends[age >= 18].name"));       // → { ana: "Ana" }

// Explain anything
console.log(me.explain("friends.ana.isAdult"));
// → {
//     result: true,
//     dependsOn: ["users.ana.age"],
//     formula: "age >= 18"
//   }
```

## What is .me?
- An **infinite semantic tree** where you define the rules.
- Create data, relationships, formulas, and private universes.
- Everything is **reactive** — change one value and everything that depends on it updates automatically.
- Secrets are **structural**: entire branches can be hidden and encrypted by design.
- Export your entire state and restore it anywhere — it works exactly the same.

## Why people like it
- No schemas needed — if you can imagine a path, it exists.
- Real privacy — not promises, but built into the structure.
- Define once, use everywhere — stop repeating code across projects.
- Full transparency — `me.explain("path")` shows exactly how any value was computed.

## Quick secret test

```ts
import Me from "this.me";

const me = new Me();

me["@"]("jabellae");

// === Public Profile ===
me.profile.name("José Abella");
me.profile.bio("Building the semantic web.");

// === Secret Wallet (Hidden Universe) ===
me.wallet["_"]("my-secret-key");           // Create a hidden universe

me.wallet.balance(12480);
me.wallet.transactions[0] = { 
  amount: 5000, 
  to: "rent", 
  date: "2026-04-01" 
};

me.wallet.transactions[1] = { 
  amount: -320, 
  to: "groceries", 
  date: "2026-04-05" 
};

me.wallet.note("Remember to renew passport");

// === Secret Chat with Ana (completely hidden) ===
me.chats.ana["_"]("our-secret-key");
me.chats.ana.messages[0] = { from: "me", text: "Hey, did you get the documents?" };
me.chats.ana.messages[1] = { from: "ana", text: "Yes, sending them now 🔥" };

// === What the outside world sees ===
console.log(me("profile"));                    
// → { name: "José Abella", bio: "Building the semantic web." }

console.log(me("wallet"));                     
// → undefined   (the entire wallet is hidden)

console.log(me("wallet.balance"));             
// → 12480       (you can still access specific leaves if you know the path)

console.log(me("chats.ana"));                  
// → undefined   (the whole chat is hidden)

// Explain what's happening under the hood
console.log(me.explain("wallet.balance"));
// → Shows the derivation path and that it's inside a secret scope
```

## Who is .me for?
Developers and creators who want to:

- Stop repeating the same infrastructure across multiple apps
- Own and control their digital identity
- Have real structural privacy
- Build clean, scalable systems without the usual mess

## Installation

```bash
npm install this.me
```

## Social Network Demo

```ts
import Me from "this.me";

const me = new Me();

me["@"]("jabellae");

// ====================== PUBLIC PROFILE ======================
me.profile.name("José Abella");
me.profile.bio("Building the semantic web • Privacy maximalist");
me.profile.location("Córdoba, Veracruz");

// ====================== SOCIAL GRAPH ======================
me.following.ana["->"]("users.ana");
me.following.luis["->"]("users.luis");

me.followers.ana["->"]("users.jabellae");

// ====================== SECRET GROUPS ======================
me.groups["trip-to-oaxaca"]["_"]("secret-trip-key");     // Hidden group
me.groups["trip-to-oaxaca"].members.ana["->"]("users.ana");
me.groups["trip-to-oaxaca"].date = "2026-05-15";
me.groups["trip-to-oaxaca"].note = "Don't tell anyone yet";

// Public group (visible)
me.groups["veracruz-devs"].isPublic = true;
me.groups["veracruz-devs"].members.jabellae["->"]("users.jabellae");

// ====================== POSTS WITH SELECTIVE PRIVACY ======================
me.posts[0] = {
  text: "Working on something new...",
  visibility: "public"
};

me.posts[1] = {
  text: "Found an amazing beach in Oaxaca",
  visibility: "friends-only"     // Only people I follow can see it
};

me.posts[2] = {
  text: "Secret trip planning 👀",
  visibility: "group:trip-to-oaxaca"   // Only members of that hidden group
};

// ====================== PRIVATE MESSAGES ======================
me.chats.ana["_"]("our-secret-chat-key");
me.chats.ana.messages[0] = { from: "me", text: "Hey, did you see the new prototype?" };
me.chats.ana.messages[1] = { from: "ana", text: "Yes! It's insane 🔥" };

// ====================== SHARED PLACES ======================
me.places.secretBeach["_"]("beach-key");
me.places.secretBeach.location = "Oaxaca coast";
me.places.secretBeach.note = "Only for close friends";

// ====================== WHAT THE OUTSIDE WORLD SEES ======================
console.log(me("profile"));                    // Public profile
console.log(me("groups.veracruz-devs"));       // Public group
console.log(me("groups.trip-to-oaxaca"));      // → undefined (hidden)
console.log(me("posts[visibility=public]"));   // Only public posts
console.log(me("chats.ana"));                  // → undefined (private chat)
```

[✍ Read the Docs →](https://neurons-me.github.io/.me/npm/docs/)

---

**MIT License** © 2025 [neurons.me](https://neurons.me)

**∴ Witness our seal**  

**suiGn**