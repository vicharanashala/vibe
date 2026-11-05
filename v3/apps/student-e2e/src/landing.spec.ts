import { expect, test } from '@playwright/test';

test('landing page shows the hero and has no horizontal scroll', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Learn it. Prove it. Then move on.',
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test('theme defaults to light and can be toggled', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');
  await expect(html).toHaveClass(/light/);

  await page.getByRole('button', { name: 'Switch to dark theme' }).first().click();
  await expect(html).toHaveClass(/dark/);
});

test('FAQ answers expand', async ({ page }) => {
  await page.goto('/#faq');
  const question = page.getByRole('button', { name: 'Who builds ViBe?' });
  await question.click();
  await expect(question).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('The Vicharanashala Lab for Education Design at IIT Ropar.')).toBeVisible();
});
