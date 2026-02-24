import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 60_000,
    retries: 1,
    workers: 1,
    globalSetup: './tests/global-setup.ts',
    use: {
        baseURL: 'http://127.0.0.1:3000',
        headless: true,
        viewport: { width: 1280, height: 800 },
        trace: 'on-first-retry',
    },
    webServer: {
        command: 'npm run dev',
        url: 'http://127.0.0.1:3000',
        reuseExistingServer: true,
        timeout: 30_000,
    },
});
