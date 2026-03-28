# Space Algebra

`.me` thinks in **spaces**.

Not schemas. Not tables. Not object classes.

A **space** is a region of meaning that can contain other spaces.

Everything else follows from set laws.

## Core Rule

A space can contain spaces.

```txt
space ⊇ subspace ⊇ subspace ⊇ subspace
```

Examples:

- `profile` is a space
- `profile.contact` is a subspace of `profile`
- `wallet.hidden` is a subspace of `wallet`
- `friends[age > 18]` is a selected subspace of `friends`

In `.me`, paths are how we navigate nested spaces:

```ts
me.profile.name("Abella");
me.profile.contact.email("abella@neurons.me");
me.wallet["_"]("vault-key");
me.wallet.hidden.note("private");
```

## Namespace

A **namespace** is a named space.

Examples:

- `self`
- `kernel`
- `ana`
- `family.photos`

In protocol form:

```txt
me://self:read/profile
me://kernel:export/snapshot
me://family.photos:read/2026.vacation.cover
```

So:

- `namespace` names the space
- `selector` states the operation
- `path` identifies the subspace

## Set View

We can describe a space by the sets that act on it:

- `A` = audience set
- `T` = topology set
- `C` = capability set
- `P` = path / subspace set

These are not different ontologies.
They are different views of the same space.

## Space Predicates

The common adjectives are just set statements:

- **public space**: the readable audience is broadly open
- **private space**: the audience is tightly bounded, often `{self}`
- **shared space**: the audience contains more than one principal
- **encrypted space**: readable membership is enforced cryptographically
- **replicated space**: the topology has multiple carriers

Examples:

- `wallet` may be a **private encrypted space**
- `family.photos` may be a **shared replicated encrypted space**
- `profile.public` may be a **public space**

No new noun is required beyond `space`.

## Refinement

More specific spaces are subsets of less specific spaces.

```txt
profile.contact.email ⊆ profile.contact ⊆ profile
wallet.hidden ⊆ wallet
```

This same law appears across the system:

- deeper path -> smaller semantic region
- tighter audience -> smaller readable set
- tighter context -> smaller resolution set
- tighter capability -> smaller action set

## Encryption As Membership

Encryption does not create a different universe.
It creates a stricter readable membership over a space.

Examples:

- a private space may have `A = {self}`
- a shared encrypted space may have `A = {me ∪ wife}`

The topology can be large while the readable audience stays small:

```txt
T = {home-daemon, office-daemon, phone}
A = {me, wife}
```

That means the same space may be replicated widely without becoming readable widely.

## Why This Matters

This gives `.me` one ontology instead of many.

- `.me` declares, creates, and navigates spaces
- `cleaker` records, routes, and transports spaces
- `monad.ai` serves, resolves, and persists spaces

The system stays unified because everything still reduces to:

```txt
space inside space inside space
```

And all of it follows set law.
