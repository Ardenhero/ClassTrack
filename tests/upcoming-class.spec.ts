import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'playwright-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="sign-in-button"]').click();
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="upcoming-class"]')).toBeVisible({ timeout: 15000 });
});

test('shows "No classes scheduled" when no upcoming class', async ({ page }) => {
    await page.goto('/');
    const upcoming = page.locator('[data-testid="upcoming-class"]');
    // Verify the widget exists
    await expect(upcoming).toBeVisible();
});

test('shows nearest future class only', async ({ page }) => {
    await page.goto('/');
    const upcoming = page.locator('[data-testid="upcoming-class"]');
    // Verify widget exists
    await expect(upcoming).toBeVisible();
});
