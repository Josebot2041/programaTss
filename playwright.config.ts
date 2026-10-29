/**
 * Pruebas de extremo a extremo (npm run test:e2e). Levantan la API (:4000) y el frontend en un
 * puerto propio (:3100, para no chocar con npm run dev); si ya están en marcha, los reutilizan.
 * Necesitan la base de .env con db:init y db:seed aplicados, y el navegador:
 *   npx playwright install chromium
 */
import { defineConfig, devices } from '@playwright/test';

const PUERTO_WEB = Number(process.env.E2E_PUERTO_WEB ?? 3100);

export default defineConfig({
  testDir: 'tests',
  // Las pruebas comparten la base de datos: una a la vez
  workers: 1,
  timeout: 30_000,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PUERTO_WEB}`,
    locale: 'es-BO',
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx server/index.ts',
      url: 'http://localhost:4000/api/health',
      reuseExistingServer: true,
      timeout: 60_000
    },
    {
      command: `npx vite --port=${PUERTO_WEB} --strictPort`,
      url: `http://localhost:${PUERTO_WEB}`,
      reuseExistingServer: true,
      timeout: 60_000
    }
  ]
});
