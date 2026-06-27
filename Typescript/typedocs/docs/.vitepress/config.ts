import { defineConfig } from 'vitepress'

export default defineConfig({
  title: '.me',
  description: 'Documentation for .me',
  base: '/.me/Typescript/typedocs/',
  outDir: '..',
  lang: 'en-US',
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: 'https://res.cloudinary.com/dkwnxf6gm/image/upload/v1760915741/this.me-removebg-preview_1_nrj6pe.png' }],
    ['meta', { name: 'author', content: 'neurons.me' }],
    ['meta', { name: 'keywords', content: '.me, this.me, semantic identity, identity runtime, semantic paths' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: '.me — Documentation' }],
    ['meta', { property: 'og:url', content: 'https://neurons-me.github.io/.me/Typescript/typedocs/' }],
  ],

  themeConfig: {
    nav: [
      { text: 'Home', link: 'https://neurons-me.github.io/.me/' },
      { text: 'npm', link: 'https://www.npmjs.com/package/this.me' },
      { text: 'API', link: '/api/README' },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Quick Start', link: '/QuickStart' },
          { text: 'Installation', link: '/Installation' },
        ]
      },
      {
        text: 'Core Concepts',
        items: [
          { text: '𓋹 The Axioms of .me', link: '/Axioms' },
          { text: 'Algebra of Contexts', link: '/Algebra-of-Contexts' },
          { text: 'Operators & Logic', link: '/Operators' },
          { text: 'Syntax', link: '/Syntax' },
          { text: 'Proxy Calls', link: '/Proxy-Calls' },
          { text: 'Runtime Surface', link: '/Runtime-Surface' },
          { text: 'Memory', link: '/Memory' },
          { text: 'Shared Meaning', link: '/Shared-Meaning' },
        ]
      },
      {
        text: 'Kernel',
        items: [
          { text: 'Kernel Phases (0–8)', link: '/Phases' },
          { text: 'Builds', link: '/Builds' },
          { text: 'Core', link: '/kernel/Core' },
          { text: 'Benchmarks', link: '/kernel/Benchmarks' },
          { text: 'O(k) Intelligence', link: '/kernel/Intelligence' },
        ]
      },
      {
        text: 'Examples',
        items: [
          { text: 'Robots Understanding Context', link: '/examples/Robots_Contexts' },
          { text: 'Smart Cities', link: '/examples/Social_Graph' },
          { text: 'Affinity Model', link: '/examples/Affinity-Model' },
          { text: 'Shops Admin', link: '/examples/Shops_Admin' },
          { text: 'Wallet Split', link: '/examples/WalletSplit' },
        ]
      },
      {
        text: 'Tests',
        items: [
          { text: 'Overview', link: '/tests/Overview' },
          { text: 'Axioms & Phases', link: '/tests/Axioms-and-Phases' },
          { text: 'Build Compatibility', link: '/tests/Build-Compatibility' },
          { text: 'Examples & Contracts', link: '/tests/Examples-and-Contracts' },
          { text: 'Performance', link: '/tests/Performance' },
        ]
      },
      {
        text: 'En Español',
        items: [
          { text: 'La Lógica de Derivación', link: '/es/La Logica de Derivacion' },
          { text: 'Fractalismo de Privacidad', link: '/es/Fractalismo' },
          { text: 'Espacios Semánticos', link: '/es/Espacios Semanticos' },
        ]
      },
      {
        text: 'API Reference',
        items: [
          { text: 'Full API', link: '/api/README' },
        ]
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/neurons-me/.me' },
    ],

    footer: {
      message: 'Human owns meaning. Everything else asks.',
      copyright: 'neurons.me'
    }
  }
})
