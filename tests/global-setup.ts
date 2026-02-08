import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
    console.log('Creating test user account...');

    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        await page.goto('http://127.0.0.1:3000/login');

        // Toggle to signup
        await page.click('button:text("Don\'t have an account?")');

        // Fill signup form
        await page.fill('[data-testid="email-input"]', 'playwright-test@example.com');
        await page.fill('[data-testid="password-input"]', 'TestPassword123!');
        await page.click('[data-testid="sign-in-button"]');

        // Wait for signup to complete
        await page.waitForTimeout(6000);

        console.log('Test user created successfully');
    } catch (error) {
        console.log('Test user may already exist or signup failed:', error);
    } finally {
        await browser.close();
    }
}

export default globalSetup;
