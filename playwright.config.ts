import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests',
    timeout: 30_000,
    retries: 1,
    globalSetup: './tests/global-setup.ts',
    use: {
        baseURL: 'http://127.0.0.1:3000', // Changed to localhost for local testing
        headless: true,
        viewport: { width: 1280, height: 800 },
        trace: 'on-first-retry',
    },
});
