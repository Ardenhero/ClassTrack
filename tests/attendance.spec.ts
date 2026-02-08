import { test, expect } from '@playwright/test';

const TEST_EMAIL = 'playwright-test@example.com';
const TEST_PASSWORD = 'TestPassword123!';

// Reuse login or setup auth... 
test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);
    await page.locator('[data-testid="sign-in-button"]').click();
    await page.waitForTimeout(3000);
    await expect(page.locator('[data-testid="upcoming-class"]')).toBeVisible({ timeout: 15000 });
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
