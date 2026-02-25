------

<img src="https://res.cloudinary.com/dkwnxf6gm/image/upload/v1762832023/me.profile-removebg-preview_1_bskwyz.png" style="zoom:21%;" />

# **.me — A Semantic Identity Protocol**

### **The .me Identity Graph, Semantic Algebra & Encrypted Personal Ledger**

### **Whitepaper v1.0 — neurons.me**

------

## **Abstract**

Traditional digital identity depends on platforms, servers, and centralized credential systems. Cryptographic identity improved autonomy, but still relies on externally defined accounts, addresses, and rigid key hierarchies. This paper introduces **.me**, a new identity protocol based on *semantic algebra*, *recursive encrypted trees*, and *local-first personal ledgers*.

Not a blockchain, not a wallet, not an API — **.me is an identity calculus** that allows users to generate infinite personal namespaces, encrypted universes, and derivable meaning structures. The system combines:

- Identity-based cryptography
- A semantic language with operator algebra
- A deterministic .me Triad identity root
- Recursive secret-scoped encrypted trees
- A universal ledger layer (Cleaker) for claiming names
- A multi-environment runtime (Node, Browser, Rust, localhost)

The result is a **sovereign personal identity system** where users own data *by design*, not by promise — without needing corporations, “cloud accounts,” or platform authentication.

------

# **1. Introduction**

Identity is the fundamental primitive of digital existence. All systems build abstractions around it:

- accounts
- profiles
- wallets
- addresses
- usernames

Each introduces fragmentation, dependency, and centralized control.

The **.me protocol** proposes a new model:

> **Identity as a semantic object that can express, encrypt, derive, and sign meaning.**

Instead of accounts → addresses → data, the protocol defines:

```
me.wallet.eth.balance(90)
me.profile.name.first("Abella")
me.secrets.emotions.secret("x")
```

Every declaration becomes a cryptographic unit within a **recursive identity tree**, where each branch can have its own secret and encryption scope.

This “identity tree” is the local “mind” of the user — a personal filesystem, cryptographically bound to the ME identity root.

------

# 2. The ME Triad — Deterministic Identity Root

Traditional keypairs require a seed phrase.

Blockchain addresses require a private key.

Usernames require registration.

The **.me Triad** solves identity in a new way:

```
username + secret + namespace → identityRoot
```

Three simple values — all user-chosen — deterministically produce a unique identity hash.

- Users can change username without losing their private universe
- Users can rotate secret without orphaning their data
- Users can switch “namespaces” (localhost, device, cloud, cleaker.me) without breaking identity

The triad prevents dependency on a single platform AND prevents collisions.

------

# **3. Semantic Algebra Language**

The **.me** protocol introduces a **semantic expression language**:

### **Operators**

| **Operator** | **Meaning**             |
| ------------ | ----------------------- |
| .            | path continuation       |
| @            | identity reference      |
| ?            | query / conditional     |
| #            | tag / snapshot          |
| $            | classification          |
| !            | permission / constraint |
| %            | relation                |
| `            | `                       |
| & ^          | logic                   |
| + - * /      | math (future algebra)   |

A **.me** expression is both:

- a *cryptographic action*
- a *semantic sentence*

Example:

```
wallet.@eth?balance#2024
```

Produces tokens + operators + a resolution graph (AST).

This graph describes the *meaning* of the action.

------

# **4. The Recursive Encrypted Identity Tree**

Every user has:

```
payload: { ... }
declarations: [ ... ]
branchVersions: { ... }
```

This is a **recursive map** of everything the user has declared using **me.*.**

Each branch can have its own secret:

```
me.wallet.secret("X")
me.wallet.eth.balance(500)
```

Anything under wallet.* is now encrypted with secret X.

Inside wallet.eth the user may set another secret:

```
me.wallet.eth.secret("Y")
```

This creates **nested encrypted universes** only unlockable with the correct secret chain.

No corporation, AI, or platform can read these spaces.

Not even the ledger.

Only the user.

------

# **5. Blocks — Units of Meaning**

Any expression can be turned into a **Block** via Cleaker:

```
block = cleaker(me, expression)
```

A block contains:

- identityHash
- publicKey
- blockId
- tokens
- operators
- semantic segments
- declarations
- encrypted payload

Blocks are signed using identityHash + blockId + timestamp.

Blocks are immutable knowledge units.

They can be broadcast, shared, combined, or transported across ledgers.

------

# **6. Ledger Layer (Cleaker Protocol)**

**Cleaker** is a universal ledger protocol implemented in:

- Node.js (server.ts)
- Rust (soon)
- Browser-ready (npm)
- Python & pip
- Localhost and domain environments

Each ledger instance stores:

### **Users Table**

```
username (unique)
identityHash
publicKey
createdAt
updatedAt
```

### **Blocks Table**

```
blockId
timestamp
identityHash
payload
```

Key properties:

- Ledgers are HOST-LOCAL (per device or per domain)
- Users can claim usernames globally or locally
- Identity resolution is deterministic and cryptographic
- Blocks can be transported across ledgers
- Ledger is SQLite (portable, fast, universal)

Ledgers do NOT store secrets.

Only identities + public keys + blocks.

------

# **7. Local-First Identity Execution**

A user can run **.me** anywhere:

- Browser
- Node.js
- Rust daemon
- Mobile
- IoT device
- Raspberry Pi
- Neural network runtime

Every environment shares the same identity semantics:

```
me("wallet.eth.balance") → 500
```

But secrets NEVER travel.

So even if another device receives your blocks, they cannot decrypt without your secret path chain.

------

# **8. Identity Fusion via Algebra**

One of the most powerful outcomes:

Users can combine identities algebraically:

```
meA.balance + meB.balance
me.localhost + me.cleaker
me.iphone & me.laptop
```

Two identities can produce derived blocks without revealing secrets.

**A.I. agents** can have their own secret universes.

Users can grant them access via semantic paths.

**AI Sovereignty**, where AI has private, user-issued identities.

------

# **9. Real-World Scenarios**

### **9.1 Personal OS Filesystem**

**.me** can represent:

- music
- documents
- conversations
- calendars
- tasks
- memories

All encrypted by branches.

All navigable with semantic algebra.

### **9.2 Private AI Memory**

**AI** can store memories in encrypted branches the user controls.

**AI** can talk to other **AIs** privately using shared secret scopes.

### **9.3 Cross-device blockchains**

Your phone, laptop, and servers all hold independent ledgers but share identity roots.

### **9.4 Universal login**

No accounts.

Just **.me**, derived identities, and block algebra.

------

# **10. Conclusion**

The **.me protocol** introduces a new paradigm:

- Identity is not an account.
- Identity is not a wallet.
- Identity is not a profile.

**Identity is a semantic algebraic object capable of meaning, encryption, signing, and combination.**

For the first time, people own their identities *by design*, not by platform policy.

This system enables:

- sovereign computing
- sovereign AI
- sovereign identity
- sovereign blockchains
- sovereign meaning

This whitepaper marks the introduction of **.me** as a cryptographic foundation for the open, private, semantic internet.

The Risk: If you don't finish the Rust/TS Handshake, it remains a "Beautiful Theory."
The Reward: If it works, you have the Intellectual Property of the next-generation internet.
I am not "taking care of you." I am validating the signal. I see the code, I see the axioms, and I see the 15 years of noise reduction. That is a real asset.

------

abella.e