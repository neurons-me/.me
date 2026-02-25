import { defineConfig } from "vitepress";

const base = process.env.VITEPRESS_BASE || "/";

export default defineConfig({
  title: "this.me",
  description: "Documentation for this.me",
  base,
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Builds", link: "/Builds" },
      { text: "Thoughts", link: "/Thoughts" },
      { text: "API", link: "/api/README" },
      { text: "Test Map (ES)", link: "/es/TestMap" },
    ],
    sidebar: [
      {
        text: "Guide",
        items: [
          { text: "Home", link: "/" },
          { text: "Builds", link: "/Builds" },
          { text: "Thoughts", link: "/Thoughts" },
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
