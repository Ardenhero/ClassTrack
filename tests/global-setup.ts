import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
    console.log('Using existing test admin account: testadmin@playwright.test');
}

export default globalSetup;
