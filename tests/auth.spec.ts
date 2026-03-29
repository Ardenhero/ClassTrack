import { test, expect } from '@playwright/test';
import { loginTestUser, TEST_EMAIL, TEST_PASSWORD } from './test-helper';

test('user can log in and persist session', async ({ page }) => {
    await loginTestUser(page);

    // Verify we reached the dashboard
    await expect(page).toHaveURL('/');

    // Reload to verify session persistence
    await page.reload();
    await expect(page).toHaveURL('/');
});

test('unauthenticated users are redirected', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
});
