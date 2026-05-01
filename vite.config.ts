import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  base: '/ff-e-builder/',

  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },

  plugins: [
    react(),
    {
      name: 'github-pages-stale-asset-compat',
      writeBundle() {
        const currentBundle = join('dist', 'assets', 'index.js');
        const legacyBundle = join('dist', 'assets', 'index-BD_UO_br.js');

        if (existsSync(currentBundle) && !existsSync(legacyBundle)) {
          copyFileSync(currentBundle, legacyBundle);
        }
      },
    },
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
  },
});
