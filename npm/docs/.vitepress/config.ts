import { defineConfig } from "vitepress";
const base = process.env.VITEPRESS_BASE || "/.me/npm/typedocs/";
export default defineConfig({
  title: ".me",
  description: "Documentation for .me",
  base,
  outDir: "../typedocs",
  appearance: "force-dark",
  head: [
    ["link", { rel: "icon", href: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png" }],
    ["link", { rel: "apple-touch-icon", href: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png" }],
    ["meta", { name: "theme-color", content: "#0f1115" }],
    ["meta", { name: "author", content: "neurons.me" }],
    ["meta", { name: "keywords", content: ".me, this.me, semantic identity, identity runtime, semantic paths" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: ".me — Documentation" }],
    ["meta", { property: "og:description", content: "Documentation for .me" }],
    ["meta", { property: "og:url", content: "https://neurons-me.github.io/.me/npm/typedocs/" }],
    ["meta", { property: "og:image", content: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1772172708/a0cada53852af28361f6203f0878f43b7ce1063b750f60d1c43eebfd263a8a0c_cxctzx.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: ".me — Documentation" }],
    ["meta", { name: "twitter:description", content: "Documentation for .me" }],
    ["meta", { name: "twitter:image", content: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1772172708/a0cada53852af28361f6203f0878f43b7ce1063b750f60d1c43eebfd263a8a0c_cxctzx.png" }],
  ],
  themeConfig: {
    logo: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png",
    nav: [
      { text: "Home", link: "/" },
      { text: "API", link: "/api/" },
      { text: "Runtime", link: "/Runtime-Surface" },
      { text: "Space", link: "/Space-Algebra" },
      { text: "Installation", link: "/Builds" },
      { text: "Operators", link: "/Operators" },
      { text: "Syntax", link: "/Syntax" },
      { text: "Secrets", link: "/guides/Secrets" },
      { text: "Shared Meaning", link: "/Shared-Meaning" },
      { text: "Tests", link: "/tests/Overview" },
      { text: "Axioms", link: "/Axioms" },
      { text: "Phases", link: "/Phases" }],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Home", link: "/" },
          { text: "API Overview", link: "/api/" },
          { text: "Runtime Surface", link: "/Runtime-Surface" },
          { text: "Space Algebra", link: "/Space-Algebra" },
          { text: "Proxy Calls", link: "/Proxy-Calls" },
          { text: "Installation", link: "/Builds" },
          { text: "Operators", link: "/Operators" },
          { text: "Syntax", link: "/Syntax" },
          { text: "Secrets", link: "/guides/Secrets" },
          { text: "Shared Meaning", link: "/Shared-Meaning" },
          { text: "Axioms", link: "/Axioms" },
          { text: "Phases", link: "/Phases" }],
      },
      {
        text: "Runtime",
        items: [
          { text: "Runtime Surface", link: "/Runtime-Surface" },
          { text: "Space Algebra", link: "/Space-Algebra" },
          { text: "Proxy Calls", link: "/Proxy-Calls" },
          { text: "Operators", link: "/Operators" },
          { text: "Syntax", link: "/Syntax" }
        ],
      },
      {
        text: "API Reference",
        items: [
          { text: "Overview", link: "/api/" },
          {
            text: "ME Class",
            link: "/api/classes/ME",
            items: [
              { text: "Constructor", link: "/api/classes/ME#constructor" },
              { text: "memories", link: "/api/classes/ME#memories" },
              { text: "explain()", link: "/api/classes/ME#explain" },
              { text: "exportSnapshot()", link: "/api/classes/ME#exportsnapshot" },
              { text: "getRecomputeMode()", link: "/api/classes/ME#getrecomputemode" },
              { text: "importSnapshot()", link: "/api/classes/ME#importsnapshot" },
              { text: "inspect()", link: "/api/classes/ME#inspect" },
              { text: "learn()", link: "/api/classes/ME#learn" },
              { text: "rehydrate()", link: "/api/classes/ME#rehydrate" },
              { text: "replayMemories()", link: "/api/classes/ME#replaymemories" },
              { text: "setRecomputeMode()", link: "/api/classes/ME#setrecomputemode" },
            ],
          }
        ],
      },
      {
        text: "Examples",
        items: [
        { text: "Social Graph", link: "/examples/Social_Graph" },
        { text: "CoffeeShops", link: "/examples/Shops_Admin" },
        { text: "Wallet Split", link: "/examples/WalletSplit" }],
      },
      {
        text: "Kernel",
        items: [{ text: "Core", link: "/kernel/Core" }, 
        { text: "Intelligence", link: "/kernel/Intelligence" },
        { text: "Benchmarks", link: "/kernel/Benchmarks" }]
      },
      {
        text: "Tests",
        items: [
          { text: "Overview", link: "/tests/Overview" },
          { text: "Axioms & Phases", link: "/tests/Axioms-and-Phases" },
          { text: "Build Compatibility", link: "/tests/Build-Compatibility" },
          { text: "Examples & Contracts", link: "/tests/Examples-and-Contracts" },
          { text: "Performance", link: "/tests/Performance" },
          { text: "Memory", link: "/Memory" }
        ],
      }]
  }
});
