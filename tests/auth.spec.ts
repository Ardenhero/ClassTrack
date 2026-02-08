import { test, expect } from '@playwright/test';

// Use a single test account for all tests
const TEST_EMAIL = 'playwright-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

test('user can log in and persist session', async ({ page }) => {
    await page.goto('/login');

    // Fill and submit login form
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="sign-in-button"]').click();

    // Wait for redirect and verify dashboard loaded
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="upcoming-class"]')).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL('/');

    // Reload to verify session persistence
    await page.reload();
    await expect(page).toHaveURL('/');
});

test('unauthenticated users are redirected', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
});
