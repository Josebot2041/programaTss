/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {configDefaults} from 'vitest/config';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // La API (server/) corre en el puerto 4000 durante el desarrollo.
      proxy: {
        '/api': 'http://localhost:4000',
      },
    },
    test: {
      // tests/ tiene las pruebas de Playwright (npm run test:e2e), no de Vitest
      exclude: [...configDefaults.exclude, 'tests/**'],
    },
  };
});
