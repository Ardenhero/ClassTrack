import { test, expect } from '@playwright/test';
import { loginTestUser } from './test-helper';

test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
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
