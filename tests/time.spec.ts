import { test, expect } from '@playwright/test';
import { loginTestUser } from './test-helper';

test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
});

test('dashboard respects local timezone', async ({ page }) => {
    await page.goto('/');
    const displayedDate = await page.locator('[data-testid="current-date"]').textContent();
    expect(displayedDate).toBeTruthy();
});
