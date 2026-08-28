import { test, expect } from '@playwright/test';

test.describe('Honeypot Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as any).__E2E__ = true;
    });
    await page.goto('/');
  });

  test('honeypot button should be hidden from view', async ({ page }) => {
    const honeypotButton = page.locator('[data-honeypot="true"]');

    // Button should exist in DOM
    await expect(honeypotButton).toBeInTheDOM();

    // Button should be hidden via CSS
    const isVisible = await honeypotButton.isVisible();
    expect(isVisible).toBe(false);

    // Verify the button has the correct hiding styles
    const opacity = await honeypotButton.evaluate((el) =>
      window.getComputedStyle(el).opacity,
    );
    expect(opacity).toBe('0');
  });

  test('honeypot button should not be in tab order', async ({ page }) => {
    const honeypotButton = page.locator('[data-honeypot="true"]');

    const tabIndex = await honeypotButton.evaluate((el) =>
      el.getAttribute('tabindex'),
    );
    expect(tabIndex).toBe('-1');
  });

  test('honeypot button should be hidden from screen readers', async ({ page }) => {
    const honeypotButton = page.locator('[data-honeypot="true"]');

    const ariaHidden = await honeypotButton.evaluate((el) =>
      el.getAttribute('aria-hidden'),
    );
    expect(ariaHidden).toBe('true');
  });

  test('honeypot button click should trigger honeypot API call', async ({
    page,
  }) => {
    // Intercept API call
    const honeypotRequest = page.waitForResponse((response) =>
      response.url().includes('/api/security/honeypot-triggered') &&
      response.request().method() === 'POST',
    );

    const honeypotButton = page.locator('[data-honeypot="true"]');

    // Click the button programmatically (user cannot see/click it)
    await honeypotButton.evaluate((el) => (el as HTMLButtonElement).click());

    // Wait for and verify API call
    const response = await honeypotRequest;
    expect(response.status()).toBe(200);

    const responseBody = await response.json();
    expect(responseBody.status).toBe('success');
  });

  test('honeypot API should include route information', async ({ page }) => {
    let capturedRequest: any = null;

    // Intercept the request to capture payload
    await page.route('**/api/security/honeypot-triggered', (route) => {
      capturedRequest = route.request().postDataJSON();
      route.abort(); // Abort to avoid actual backend call in tests
    });

    const honeypotButton = page.locator('[data-honeypot="true"]');
    await honeypotButton.evaluate((el) => (el as HTMLButtonElement).click());

    // Wait a moment for request to be captured
    await page.waitForTimeout(100);

    // Verify request payload
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.currentRoute).toBe('/');
    expect(capturedRequest.timestamp).toBeDefined();
  });

  test('honeypot button should not interfere with page functionality', async ({
    page,
  }) => {
    // The page should still be functional
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Verify main content is still accessible
    const mainContent = page.locator('body > *');
    const elementCount = await mainContent.count();
    expect(elementCount).toBeGreaterThan(1); // HoneypotButton + main content
  });
});
