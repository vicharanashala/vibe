import { test, expect } from '@playwright/test';
import { loginAsStudent } from './common-utils';

test('open chatbot, send message and assert response', async ({ page }) => {
  // Intercept the chatbot query API call to return a mock response.
  // This ensures the test is robust and runs successfully without needing a real Anthropic credentials key.
  await page.route('**/api/chatbot/query', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: 'This is a mock AI response about your enrolled course materials.' }),
    });
  });

  // Log browser-side signals for debugging test execution
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}]`, msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
  });

  await page.addInitScript(() => {
    (window as any).__E2E__ = true;
  });

  // 1. Navigate to the landing page
  await page.goto('/');

  // 2. Log in as a student using common-utils helper
  await loginAsStudent(page);

  // 3. Verify the Chatbot trigger button is visible in the sidebar actions row and click it
  const chatButton = page.getByRole('button', { name: /chat with ai/i });
  await expect(chatButton).toBeVisible({ timeout: 30000 });
  await chatButton.click();

  // 4. Verify the Chatbot drawer/Sheet opens and displays titles
  const title = page.getByText('Vibe Bot');
  await expect(title).toBeVisible();

  // 5. Fill input with a question and send it
  const inputField = page.getByPlaceholder('Ask a question...');
  await expect(inputField).toBeVisible();
  await inputField.fill('What is the course overview?');

  const sendButton = page.getByRole('button', { name: /send question/i });
  await expect(sendButton).toBeVisible();
  await sendButton.click();

  // 6. Verify assistant response bubble renders correctly
  // In ChatbotDrawer, the assistant bubble uses class 'self-start' and contains the AI's response text
  const assistantBubble = page.locator('div.self-start').filter({ hasText: 'This is a mock AI response' });
  await expect(assistantBubble).toBeVisible({ timeout: 15000 });

  const textContent = await assistantBubble.textContent();
  console.log('Received chatbot response bubble:', textContent);
  expect(textContent).toContain('This is a mock AI response');
});
