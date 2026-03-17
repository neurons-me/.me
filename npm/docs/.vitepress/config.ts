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
          { text: "Installation", link: "/Builds" },
          { text: "Operators", link: "/Operators" },
          { text: "Syntax", link: "/Syntax" },
          { text: "Secrets", link: "/guides/Secrets" },
          { text: "Shared Meaning", link: "/Shared-Meaning" },
          { text: "Axioms", link: "/Axioms" },
          { text: "Phases", link: "/Phases" }],
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
