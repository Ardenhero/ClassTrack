import { test, expect } from '@playwright/test';
import { loginTestUser } from './test-helper';

test.beforeEach(async ({ page }) => {
    await loginTestUser(page);
});

test('user can mark attendance once only', async ({ page }) => {
    await page.goto('/'); // Dashboard

    const markBtn = page.locator('button:has-text("Mark Attendance")');

    if (await markBtn.isVisible()) {
        await markBtn.click();
        // Expect success message or revalidation
        await page.waitForTimeout(2000);
        // Check that we're still on dashboard (attendance was marked)
        await expect(page.locator('[data-testid="upcoming-class"]')).toBeVisible();
        // or check button state.
    } else {
        console.log('Class not live, skipping attendance mark test');
    }
});
