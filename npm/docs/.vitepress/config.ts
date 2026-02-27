import { defineConfig } from "vitepress";

const base = process.env.VITEPRESS_BASE || "/.me/docs/";

export default defineConfig({
  title: ".me",
  description: "Documentation for this.me",
  base,
  head: [
    ["link", { rel: "icon", href: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" }],
    ["link", { rel: "apple-touch-icon", href: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png" }],
    ["meta", { name: "theme-color", content: "#0f1115" }],
    ["meta", { name: "author", content: "neurons.me" }],
    ["meta", { name: "keywords", content: ".me, this.me, semantic identity, sovereign identity, identity runtime, semantic paths" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: ".me — Documentation" }],
    ["meta", { property: "og:description", content: "Documentation for this.me" }],
    ["meta", { property: "og:url", content: "https://neurons-me.github.io/.me/docs/" }],
    ["meta", { property: "og:image", content: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1772172708/a0cada53852af28361f6203f0878f43b7ce1063b750f60d1c43eebfd263a8a0c_cxctzx.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:title", content: ".me — Documentation" }],
    ["meta", { name: "twitter:description", content: "Documentation for this.me" }],
    ["meta", { name: "twitter:image", content: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149344/this.me_kx1ura.jpg" }],
  ],
  themeConfig: {
    logo: "https://res.cloudinary.com/dkwnxf6gm/image/upload/v1761149332/this.me-removebg-preview_2_j1eoiy.png",
    nav: [
      { text: "Home", link: "/" },
      { text: "Builds", link: "/Builds" },
      { text: "Thoughts", link: "/Thoughts" },
      { text: "Phases", link: "/Phases" },
      { text: "Kernel", link: "/Kernel" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Home", link: "/" },
          { text: "Builds", link: "/Builds" },
          { text: "Thoughts", link: "/Thoughts" },
          { text: "Phases", link: "/Phases" },
          { text: "Kernel", link: "/Kernel" },

        ],
      },
      {
        text: "Validation",
        items: [{ text: "Test Map (ES)", link: "/es/TestMap" }],
      },
      {
        text: "API",
        items: [{ text: "API Reference", link: "/api/README" }],
      },
    ],
  },
});
