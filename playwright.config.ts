import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:5173', headless: true, launchOptions: {executablePath: process.env.E2E_BROWSER_EXECUTABLE || undefined} },
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
})
