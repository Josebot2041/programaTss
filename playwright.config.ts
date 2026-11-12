/**
 * Pruebas de extremo a extremo (npm run test:e2e). Levantan su propia API (:4100, con un límite
 * de envíos de encuestas alto) y el frontend en :3100 apuntando a esa API, para no chocar con
 * npm run dev (:3000 / :4000); si ya están en marcha, los reutilizan.
 * Necesitan la base de .env con db:init y db:seed aplicados, y el navegador:
 *   npx playwright install chromium
 */
import { defineConfig, devices } from '@playwright/test';

const PUERTO_WEB = Number(process.env.E2E_PUERTO_WEB ?? 3100);
const PUERTO_API = Number(process.env.E2E_PUERTO_API ?? 4100);

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
      url: `http://localhost:${PUERTO_API}/api/health`,
      env: { PORT: String(PUERTO_API), LIMITE_ENCUESTAS_POR_HORA: '1000' },
      reuseExistingServer: true,
      timeout: 60_000
    },
    {
      command: `npx vite --port=${PUERTO_WEB} --strictPort`,
      url: `http://localhost:${PUERTO_WEB}`,
      env: { API_PUERTO: String(PUERTO_API) },
      reuseExistingServer: true,
      timeout: 60_000
    }
  ]
});
