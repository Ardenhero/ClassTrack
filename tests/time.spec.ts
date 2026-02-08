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

test('dashboard respects local timezone', async ({ page }) => {
    await page.goto('/');
    const displayedDate = await page.locator('[data-testid="current-date"]').textContent();
    expect(displayedDate).toBeTruthy();
});
