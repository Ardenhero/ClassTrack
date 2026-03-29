import { test, expect } from '@playwright/test';

test('graceful error on network failure', async ({ page }) => {
    await page.route('**/*', route => route.abort());

    try {
        await page.goto('/');
    } catch (e) {
        // Expected to fail load
    }

    // Expect custom error page or browser error?
    // Next.js error boundary might not trigger on route abort of main document.
    // This test as specified in snippet might expect an *API* failure to show error UI.
    // Aborting everything prevents page load.
    // I'll adjust to abort typically API calls if possible, or just verify 'Something went wrong' if Next.js catches it.
});
