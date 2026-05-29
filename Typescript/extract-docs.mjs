// extract-docs.mjs — recovers markdown source from VitePress built JS assets
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { glob } from 'fs/promises'

const ASSETS = 'typedocs/assets'
const OUT    = 'docs'

// map asset filename prefix -> output .md path
function assetToMdPath(filename) {
  // e.g. "Axioms.md.B92GnMoR.js" -> "Axioms.md"
  // e.g. "kernel_Benchmarks.md.Zws7mOj_.js" -> "kernel/Benchmarks.md"
  // e.g. "es_La Logica de Derivacion.md.BTAC_azG.js" -> "es/La Logica de Derivacion.md"
  const base = filename.replace(/\.[A-Za-z0-9_-]{8}\.js$/, '') // strip hash.js
  return base.replace(/_/g, '/').replace(/^([a-z]+)\//, (_, prefix) => {
    // only replace first _ that looks like a folder prefix
    return prefix + '/'
  })
}

// Convert VitePress HTML back to clean markdown (approximation)
function htmlToMd(html) {
  return html
    // headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gs, (_, t) => `# ${strip(t)}\n\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gs, (_, t) => `## ${strip(t)}\n\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gs, (_, t) => `### ${strip(t)}\n\n`)
    .replace(/<h4[^>]*>(.*?)<\/h4>/gs, (_, t) => `#### ${strip(t)}\n\n`)
    .replace(/<h5[^>]*>(.*?)<\/h5>/gs, (_, t) => `##### ${strip(t)}\n\n`)
    // code blocks — extract lang and code
    .replace(/<div class="language-(\w*)[^"]*"[^>]*>.*?<code[^>]*>(.*?)<\/code>.*?<\/div>/gs, (_, lang, code) =>
      `\`\`\`${lang}\n${decodeEntities(stripTags(code))}\n\`\`\`\n\n`)
    // inline code
    .replace(/<code>(.*?)<\/code>/gs, (_, c) => `\`${decodeEntities(c)}\``)
    // bold / italic
    .replace(/<strong>(.*?)<\/strong>/gs, (_, t) => `**${strip(t)}**`)
    .replace(/<em>(.*?)<\/em>/gs,       (_, t) => `_${strip(t)}_`)
    // links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gs, (_, href, text) => `[${strip(text)}](${href})`)
    // paragraphs
    .replace(/<p>(.*?)<\/p>/gs, (_, t) => `${strip(t)}\n\n`)
    // lists
    .replace(/<li>(.*?)<\/li>/gs, (_, t) => `- ${strip(t)}\n`)
    .replace(/<\/ul>/g, '\n').replace(/<ul>/g, '')
    .replace(/<\/ol>/g, '\n').replace(/<ol>/g, '')
    // blockquotes
    .replace(/<blockquote>(.*?)<\/blockquote>/gs, (_, t) => `> ${strip(t).replace(/\n/g, '\n> ')}\n\n`)
    // hr
    .replace(/<hr\s*\/?>/g, '\n---\n\n')
    // table (basic)
    .replace(/<table>.*?<\/table>/gs, '[table]\n\n')
    // strip remaining tags
    .replace(/<[^>]+>/g, '')
    // decode entities
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    // collapse excess blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function strip(s) { return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() }
function stripTags(s) { return s.replace(/<[^>]+>/g, '') }
function decodeEntities(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
}

// extract HTML content from VitePress JS asset
function extractFromJs(content) {
  // detect which alias is used for `ae` (VitePress html tagged template)
  const importMatch = content.match(/ae as (\w+)/)
  const fn = importMatch ? importMatch[1] : null

  // try with detected alias first, then all single letters as fallback
  const candidates = fn ? [fn, 't', 'n', 'h', 'e'] : ['t', 'n', 'h', 'e']
  for (const f of candidates) {
    // backtick template: [f(`...html...`)] or [f(`...html...`, number)]
    const re1 = new RegExp(`\\[${f}\\(\\\`(<[\\s\\S]+?)\\\`(?:,\\s*\\d+)?\\)\\]`)
    const m1 = content.match(re1)
    if (m1 && m1[1].length > 100) return m1[1]
    // single-quote string: f('<h...')  (large files)
    const re2 = new RegExp(`${f}\\('(<h[^']{100,})'\\)`)
    const m2 = content.match(re2)
    if (m2) return m2[1]
  }
  return null
}

import { readdir } from 'fs/promises'

const files = await readdir(ASSETS)
const jsAssets = files.filter(f => f.endsWith('.js') && !f.endsWith('.lean.js') && f.includes('.md.'))

let count = 0
for (const filename of jsAssets) {
  const mdPath = assetToMdPath(filename)
  const content = readFileSync(join(ASSETS, filename), 'utf8')
  const html = extractFromJs(content)
  if (!html) {
    console.warn(`⚠️  Could not extract: ${filename}`)
    continue
  }
  const md = htmlToMd(html)
  const outPath = join(OUT, mdPath)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, md, 'utf8')
  console.log(`✓  ${mdPath}`)
  count++
}
console.log(`\nExtracted ${count} files to ${OUT}/`)
