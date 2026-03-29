import { Page, expect } from '@playwright/test';

export const TEST_EMAIL = 'testadmin@playwright.test';
export const TEST_PASSWORD = 'r4iolbv6pl';

export async function loginTestUser(page: Page) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    // Wait for the email input to be visible and interactive (hydration complete)
    await page.locator('[data-testid="email-input"]').waitFor({ state: 'visible', timeout: 15000 });

    await page.locator('[data-testid="email-input"]').fill(TEST_EMAIL);
    await page.locator('[data-testid="password-input"]').fill(TEST_PASSWORD);

    // Click the sign-in button instead of pressing Enter
    await page.locator('[data-testid="sign-in-button"]').click();

    // Wait for navigation away from login page (either to select-profile or dashboard)
    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 20000 });

    // If an error message appeared on the page, print it to help debugging
    const errorMsg = await page.locator('.text-red-700, .bg-red-50').first().textContent({ timeout: 1000 }).catch(() => null);
    if (errorMsg) {
        console.log("----- LOGIN ERROR EXTRACTED FROM UI -----", errorMsg.trim());
    }

    // Handle the profile selector page
    if (page.url().includes('select-profile')) {
        console.log("On select-profile page, selecting the first profile...");
        // Wait for profile cards to render
        const profileCard = page.locator('.group.cursor-pointer').first();
        await profileCard.waitFor({ state: 'visible', timeout: 10000 });
        await profileCard.click();

        // Wait for navigation to dashboard after profile selection
        await page.waitForURL('/', { timeout: 15000 });
    }

    // Handle pending-approval redirect
    if (page.url().includes('pending-approval')) {
        throw new Error('Test account is pending approval. Please ensure the test admin account has an approved instructor profile.');
    }

    // We should be on dashboard now
    await expect(page).toHaveURL('/');
}
