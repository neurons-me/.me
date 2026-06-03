# .me

###### Everything is just a hash of a knowledge unit
**100k encrypted vectors. 1.9 minutes. 146MB RAM.**

**Production-ready. O(1).**
**.me** conceptualizes a fundamental, binary-based "ontological operating system" where reality is constructed from basic, non-hierarchical distinctions (occupied/empty) rather than fixed physical laws. **By treating identity as an operator of distinction** within an "information-as-computation" framework, the project explores how **complex geometry emerges** from **repeated logical bifurcations**. More information about this approach to information structure can be found on the **npm package page.**

# 📦 Installation
```bash
npm install this.me
```

## What is neurons.me?

**[neurons.me](https://neurons.me)** is a sovereign semantic compute stack. It lets any person or machine own a cryptographic identity, bind it to a namespace, run it as an HTTP daemon, and render it as a user interface — without depending on any central service.

The full stack, from bottom to top:

| Layer | Package | Role |
|---|---|---|
| **Kernel** | [`this.me`](https://neurons-me.github.io/.me/) | Schema-free reactive memory. Derives identity from a seed. No server, no cloud. |
| **Identity** | [`cleaker`](https://neurons-me.github.io/Cleaker/) | Namespace resolver. Projects `.me` into a surface. *Who am I, here.* |
| **Runtime** | [`monad`](https://neurons-me.github.io/monad/) | HTTP daemon. Exposes a namespace over HTTP. Runs the mesh. |
| **Gateway** | [`netget`](https://neurons-me.github.io/netget/) | Routes incoming requests to the correct monad via OpenResty. |
| **Interface** | [`this.gui`](https://neurons-me.github.io/GUI/) | React component library. Renders the semantic surface. |

## This package: `this.me`

`this.me` is the **root kernel** of the neurons.me stack. Every other package depends on it.

It is a schema-free, reactive, cryptographic memory tree. You create one with a seed — two strings that derive a deterministic identity — and then write anything to it using infinite proxy syntax. It runs fully offline. There is no database, no schema, no server required.




