import { defineConfig, devices } from '@playwright/test'

// BASE_URL=https://folio.devops-monk.com/ runs the suite against the live site.
const live = process.env.BASE_URL

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: live ?? 'http://localhost:4173/',
    // Uses the locally installed Chrome; CI can switch to the bundled Chromium.
    channel: process.env.CI ? undefined : 'chrome',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.CI ? undefined : 'chrome' } },
    { name: 'mobile', use: { ...devices['Pixel 7'], channel: process.env.CI ? undefined : 'chrome' } },
  ],
  webServer: live
    ? undefined
    : {
        command: 'npm run build && npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173/',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
})
