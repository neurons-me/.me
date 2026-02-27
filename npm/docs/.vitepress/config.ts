import { defineConfig } from "vitepress";

const base = process.env.VITEPRESS_BASE || "/.me/docs/";

export default defineConfig({
  title: ".me",
  description: "Documentation for this.me",
  base,
  themeConfig: {
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
