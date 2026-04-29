import { defineConfig } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import dts from 'vite-plugin-dts';
export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      include: ['src', 'index.ts'],
      exclude: ['tests', '**/*.test.*'],
    }),
    {
      name: 'patch-default-exports',
      closeBundle() {
        const cjsPath = path.resolve(__dirname, 'dist/me.cjs');
        if (fs.existsSync(cjsPath)) {
          const cjs = fs.readFileSync(cjsPath, 'utf8');
          if (!cjs.includes('module.exports = exports')) {
            fs.appendFileSync(cjsPath, '\nmodule.exports = exports["default"] ?? exports;\n');
          }
        }
        const umdPath = path.resolve(__dirname, 'dist/me.umd.js');
        if (fs.existsSync(umdPath)) {
          const umd = fs.readFileSync(umdPath, 'utf8');
          if (!umd.includes('Me.ME=')) {
            fs.appendFileSync(
              umdPath,
              ';(function(g){var e=g.Me;if(e&&typeof e["default"]==="function")e.ME=e["default"];})(typeof globalThis!=="undefined"?globalThis:typeof window!=="undefined"?window:self);\n',
            );
          }
        }
      },
    },
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  esbuild: {
    loader: 'ts',
    include: /(?:src\/.*|index\.ts)$/,
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'index.ts'),
      name: 'Me',
      fileName: (format) => {
        if (format === "cjs") return "me.cjs";       // Proper CJS extension
        if (format === "es") return "me.es.js";
        if (format === "umd") return "me.umd.js";
        return `me.${format}.js`;
      },
      formats: ['es', 'cjs', 'umd'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
        globals: {
          // Example: 'vue': 'Vue'
        },
      },
    },
  },
});
