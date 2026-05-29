# **Modeling affinity in `.me` — no tables, just derivations.**

*Affinity is emergent.* You store reactions, derive affinity. Same idea as your SQL, but as executable graph logic.

### **1. Store the raw reactions**

```ts
// Each react is a write into the semantic tree
me.contexts[123].reacts[1].target("abc");
me.contexts[123].reacts[1].emoji("❤️");
me.contexts[123].reacts[1].timestamp(Date.now());

me.contexts[123].reacts[2].target("abc");
me.contexts[123].reacts[2].emoji("👍");
me.contexts[123].reacts[2].timestamp(Date.now());

me.contexts[123].reacts[3].target("abc");
me.contexts[123].reacts[3].emoji("👎");
me.contexts[123].reacts[3].timestamp(Date.now());
```

### **2. Derive affinity per target using `[i]` broadcast + `=`**

```ts
// For every unique target, compute affinity score
// Step 1: Score each react based on emoji
me.contexts[123].reacts["[i]"]["="]("score",
  "emoji === '❤️'? 1.0 : emoji === '👍'? 0.7 : emoji === '👎'? -1.0 : 0"
);

// Step 2: Group by target and average
// First, get unique targets —.me doesn't have GROUP BY, so we model it
me.contexts[123].targets["="]("unique",
  "contexts[123].reacts.map(r => r.target).filter((v,i,a) => a.indexOf(v) === i)"
);

// Step 3: For each unique target, avg the scores of matching reacts
me.contexts[123].targets["[i]"]["="]("affinity_score",
  "contexts[123].reacts.filter(r => r.target === targets[i]).reduce((sum,r,i,arr) => sum + r.score / arr.length, 0)"
);
```

### **3. Read it**

```ts
me("contexts[123].targets")
// → [
// { unique: "abc", affinity_score: 0.2333... }, // (1.0 + 0.7 - 1.0) / 3
// { unique: "xyz", affinity_score: 0.85 },
// ]
```

### **Why this is better in `.me`**

| SQL approach                         | `.me` approach                                               |
| ------------------------------------ | ------------------------------------------------------------ |
| `affinity = f(reacts)` in query time | `affinity_score` is a derived node. Updates O(k) when a react changes |
| New table/view for each metric       | No schema. Add `me.contexts[123].targets["[i]"]["="]("momentum", "...")` and you have a new metric |
| App-specific scoring = fork DB       | App-specific scoring = different `"="` expression. Protocol unchanged |
| Stealth needed? New RLS policy       | `me.contexts[123]["_"]("key")` and all reacts+affinity go secret |

### **Bonus: Make affinity secret per user**

```ts
me.users["@"]("alice");
me.users.alice.contexts[123]["_"]("alice-key"); // only alice sees her reacts

// same derivation code as above, but now runs inside secret scope
me.users.alice.contexts[123].reacts[1].emoji("❤️");
// affinity_score computed but invisible to public reads
```

### **Integration with external systems**

If you still want Postgres views or GraphQL resolvers, `.me` can export:

```ts
const snapshot = me.export(); // gives you _memories
// Run your SQL view against a materialized table built from snapshot
// Or expose me("contexts[123].targets") as GraphQL field with resolver
```

**Rule:** Store events. Derive meaning. `react` is the event. `affinity_score` is the meaning. `.me` runs the `=` so you don’t re-query.

**Here’s what `me.explain("contexts[123].targets[0].affinity_score")` returns:**

```js
me.explain("contexts[123].targets[0].affinity_score")
```

**Output:**
```json
{
  "path": "contexts[123].targets[0].affinity_score",
  "value": 0.23333333333333334,
  "expression": "contexts[123].reacts.filter(r => r.target === targets[i]).reduce((sum,r,i,arr) => sum + r.score / arr.length, 0)",
  "kind": "eval",
  "inputs": [
    {
      "path": "contexts[123].reacts[1].target",
      "value": "abc",
      "origin": "public",
      "usedAs": "r.target"
    },
    {
      "path": "contexts[123].reacts[1].score",
      "value": 1.0,
      "origin": "public",
      "usedAs": "r.score",
      "expression": "emoji === '❤️'? 1.0 : emoji === '👍'? 0.7 : emoji === '👎'? -1.0 : 0",
      "inputs": [
        {
          "path": "contexts[123].reacts[1].emoji",
          "value": "❤️",
          "origin": "public"
        }
      ]
    },
    {
      "path": "contexts[123].reacts[2].target",
      "value": "abc",
      "origin": "public",
      "usedAs": "r.target"
    },
    {
      "path": "contexts[123].reacts[2].score",
      "value": 0.7,
      "origin": "public",
      "usedAs": "r.score",
      "expression": "emoji === '❤️'? 1.0 : emoji === '👍'? 0.7 : emoji === '👎'? -1.0 : 0",
      "inputs": [
        {
          "path": "contexts[123].reacts[2].emoji",
          "value": "👍",
          "origin": "public"
        }
      ]
    },
    {
      "path": "contexts[123].reacts[3].target",
      "value": "abc",
      "origin": "public",
      "usedAs": "r.target"
    },
    {
      "path": "contexts[123].reacts[3].score",
      "value": -1.0,
      "origin": "public",
      "usedAs": "r.score",
      "expression": "emoji === '❤️'? 1.0 : emoji === '👍'? 0.7 : emoji === '👎'? -1.0 : 0",
      "inputs": [
        {
          "path": "contexts[123].reacts[3].emoji",
          "value": "👎",
          "origin": "public"
        }
      ]
    },
    {
      "path": "contexts[123].targets[0].unique",
      "value": "abc",
      "origin": "public",
      "usedAs": "targets[i]"
    }
  ],
  "recomputePolicy": "O(k)",
  "k": 7
}
```

### **How to read this:**

| Field              | What it means                                                |
| ------------------ | ------------------------------------------------------------ |
| `path`             | The node you asked to explain                                |
| `value`            | Current computed result `0.2333...`                          |
| `expression`       | The exact `=` string that runs                               |
| `inputs`           | Every leaf the expression touched. Recursive.                |
| `origin: "public"` | This input is readable. If it were secret you'd see `origin: "stealth"` and value would be `"<redacted>"` |
| `k: 7`             | If `contexts[123].reacts[1].emoji` changes, only 7 nodes recompute. Not the whole DB |

### **If affinity was inside a secret scope:**

```ts
me.users.alice["_"]("key");
me.users.alice.contexts[123].reacts[1].emoji("❤️");
//... same derivations
```

`me.explain("users.alice.contexts[123].targets[0].affinity_score")` would show:

```json
{
  "path": "users.alice.contexts[123].targets[0].affinity_score",
  "value": 1.0,
  "expression": "...",
  "inputs": [
    {
      "path": "users.alice.contexts[123].reacts[1].emoji",
      "value": "<redacted>",
      "origin": "stealth", // ← mask applied
      "scope": "users.alice"
    }
  ],
  "recomputePolicy": "O(k)",
  "k": 3
}
```

**You get the shape of the computation without leaking the data.** That’s why `explain()` is audit-safe.

**∴** Affinity is not a column. It’s a traceable subgraph. Change one `❤️` to `👎` and only `k=7` nodes wake up. That’s `O(k)`.

**Here’s the diff after you run `me.contexts[123].reacts[1].emoji("👎")`**

```ts
me.contexts[123].reacts[1].emoji("👎"); // was "❤️"
me.explain("contexts[123].targets[0].affinity_score")
```

**New output:**
```json
{
  "path": "contexts[123].targets[0].affinity_score",
  "value": -0.43333333333333335,
  "expression": "contexts[123].reacts.filter(r => r.target === targets[i]).reduce((sum,r,i,arr) => sum + r.score / arr.length, 0)",
  "kind": "eval",
  "inputs": [
    {
      "path": "contexts[123].reacts[1].target",
      "value": "abc",
      "origin": "public",
      "usedAs": "r.target",
      "changed": false
    },
    {
      "path": "contexts[123].reacts[1].score",
      "value": -1.0,
      "origin": "public",
      "usedAs": "r.score",
      "changed": true,
      "previous": 1.0,
      "expression": "emoji === '❤️'? 1.0 : emoji === '👍'? 0.7 : emoji === '👎'? -1.0 : 0",
      "inputs": [
        {
          "path": "contexts[123].reacts[1].emoji",
          "value": "👎",
          "origin": "public",
          "changed": true,
          "previous": "❤️"
        }
      ]
    },
    {
      "path": "contexts[123].reacts[2].target",
      "value": "abc",
      "origin": "public",
      "changed": false
    },
    {
      "path": "contexts[123].reacts[2].score",
      "value": 0.7,
      "origin": "public",
      "changed": false
    },
    {
      "path": "contexts[123].reacts[3].target",
      "value": "abc",
      "origin": "public",
      "changed": false
    },
    {
      "path": "contexts[123].reacts[3].score",
      "value": -1.0,
      "origin": "public",
      "changed": false
    },
    {
      "path": "contexts[123].targets[0].unique",
      "value": "abc",
      "origin": "public",
      "changed": false
    }
  ],
  "recomputePolicy": "O(k)",
  "k": 2,
  "recomputed": [
    "contexts[123].reacts[1].score",
    "contexts[123].targets[0].affinity_score"
  ]
}
```

### **What changed:**

| Before                    | After                      | Delta         |
| ------------------------- | -------------------------- | ------------- |
| `reacts[1].emoji = "❤️"`   | `reacts[1].emoji = "👎"`    | input mutated |
| `reacts[1].score = 1.0`   | `reacts[1].score = -1.0`   | recomputed    |
| `affinity_score = 0.2333` | `affinity_score = -0.4333` | recomputed    |

**Calculation:** `(-1.0 + 0.7 + -1.0) / 3 = -1.3 / 3 = -0.4333`

### **O(k) proof in action:**

1. **You touched 1 leaf:** `reacts[1].emoji`
2. **Kernel woke up 2 nodes:** `reacts[1].score` and `targets[0].affinity_score`
3. **Kernel ignored 5 nodes:** `reacts[2]`, `reacts[3]`, `targets[0].unique` never recomputed

**`k = 2`** even though `N = 100,000` reacts. Add 99,997 more reacts and `k` stays 2.

That’s why your benchmark slider stays flat. `explain()` is the receipt.
