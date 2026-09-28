import { defineConfig, devices } from "@playwright/test";
import { cameraLaunchArgs } from "./e2e/camera";

const PORT = Number(process.env.E2E_PORT ?? 5199);

/**
 * E2E runs the SPA in Demo Mode (no Supabase env), where the Event Management
 * router + service run in-browser over localStorage — the same code the Edge
 * function runs in Connected Mode.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["camera", "clipboard-read", "clipboard-write"],
    launchOptions: { args: cameraLaunchArgs },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: { VITE_SUPABASE_URL: "", VITE_SUPABASE_PUBLISHABLE_KEY: "", VITE_PUBLIC_SITE_URL: `http://localhost:${PORT}` },
    timeout: 60_000,
  },
});
