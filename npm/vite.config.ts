import { defineConfig } from 'vite';
import path from 'node:path';
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
  ],
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  esbuild: {
    loader: 'ts',
    include: /src\/.*\.[tj]sx?$/,
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
        globals: {
          // Example: 'vue': 'Vue'
        },
      },
    },
  },
});
