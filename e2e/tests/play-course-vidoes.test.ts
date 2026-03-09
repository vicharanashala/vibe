import { test, expect, Locator, Page } from '@playwright/test';
import fs from 'fs';

const COURSE_NAME =
  process.env.COURSE_NAME ?? 'MERN Developer Sprint: For MERN developer team testing';

test('Test course video playback and quiz', async ({ page }) => {
  page.on('console', (msg) => {
    console.log(`[browser:${msg.type()}]`, msg.text());
  });

  page.on('pageerror', (err) => {
    console.error('[pageerror]', err.message);
  });

  page.on('requestfailed', (request) => {
    console.error('[requestfailed]', request.url(), request.failure()?.errorText);
  });

  await page.addInitScript(() => {
    (window as any).__E2E__ = true;
  });

  // --- Safety check ---
  if (!process.env.TEST_STUDENT_EMAIL || !process.env.TEST_STUDENT_PASSWORD) {
    throw new Error('Missing TEST_STUDENT_EMAIL or TEST_STUDENT_PASSWORD');
  }

  // --- 1. Open landing page ---
  await page.goto('/');
  console.log('current URL :', page.url());
  // --- 2. Login flow ---
  await page.getByRole('button', { name: /continue to login/i }).click();

  const emailInput = page.getByPlaceholder(/enter your email/i);
  const passwordInput = page.getByPlaceholder(/enter your password/i);

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await emailInput.fill(process.env.TEST_STUDENT_EMAIL);
  await passwordInput.fill(process.env.TEST_STUDENT_PASSWORD);

  await page.getByRole('button', { name: /sign in as learner/i }).click();

  // --- 3. Verify login ---
  await expect(page.getByText(/logout/i)).toBeVisible();
  console.log('URL after login:', page.url());

  // 4. Locate course title
  const courseTitle = page.getByRole('heading', {
    name: new RegExp(COURSE_NAME, 'i'),
    level: 3,
  });

  await expect(courseTitle).toBeVisible({ timeout: 30000 });

  // 5. Scope to THIS course card
  const courseCard = courseTitle.locator(
    'xpath=ancestor::div[contains(@class,"student-card-hover")]',
  );

  // 6. Find Start or Continue button
  const actionButton = courseCard.getByRole('button', {
    name: /^(start|continue)$/i,
  });

  // 7. Click
  await expect(actionButton).toBeVisible();
  await actionButton.click();

  // ---------------------------------------------
  // Helpers functions
  // ---------------------------------------------
  async function verifyWebcamStream_ifpresent(page: Page) {
    // 🔎 Check if Declaration is visible (short timeout so it doesn’t wait 30s)
    const declarationVisible = await page
      .getByText(/Declaration/i)
      .isVisible({ timeout: 30000 })
      .catch(() => false);

    if (!declarationVisible) {
      console.log('ℹ️ Declaration not found. Skipping webcam verification.');
      return; // 🚀 Exit function completely
    }

    console.log('✅ Declaration found');
    await page.getByRole('button', { name: /accept/i }).click();

    //  Locate video element
    const video = page.locator('video');
    await expect(video).toBeVisible();

    //  Wait for media stream to attach
    await page.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return v && v.readyState >= 2 && v.videoWidth > 0;
      },
      null,
      { timeout: 30_000 },
    );

    // Extract video metadata
    const info = await video.evaluate((v) => ({
      readyState: v.readyState,
      currentTime: v.currentTime,
      width: v.videoWidth,
      height: v.videoHeight,
    }));

    console.log('Video info:', info);

    // Basic validation
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);

    // verify frames are flowing
    const t1 = info.currentTime;
    await page.waitForTimeout(2000);
    const t2 = await video.evaluate((v) => v.currentTime);

    expect(t2).toBeGreaterThan(t1);
  }

  async function expandIfCollapsed(button: Locator) {
    await button.waitFor({ state: 'visible', timeout: 30_000 });

    const expanded = await button.getAttribute('aria-expanded');

    if (expanded === null) {
      throw new Error('aria-expanded attribute not found on expandable button');
    }

    if (expanded === 'false') {
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true', {
        timeout: 30_000,
      });
    }
  }

  function parseTimeToSeconds(time: string): number {
    const parts = time.split(':').map(Number);

    // supports mm:ss and hh:mm:ss
    if (parts.length === 2) {
      const [m, s] = parts;
      return m * 60 + s;
    }

    if (parts.length === 3) {
      const [h, m, s] = parts;
      return h * 3600 + m * 60 + s;
    }

    throw new Error(`Invalid time format: ${time}`);
  }

  async function playAndWaitForCompletion(page) {
    // Play button
    const playButton = page.getByRole('button', { name: /^play$/i });

    // ⏱ Time display like "mm:ss / mm:ss"
    const timeDisplay = page.locator('text=/\\d{1,2}:\\d{2}\\s*\\/\\s*\\d{1,2}:\\d{2}/');

    // Wait for player to be ready
    await expect(playButton).toBeVisible({ timeout: 30_000 });
    await expect(timeDisplay).toBeVisible({ timeout: 30_000 });

    // Increase speed to 2x
    const speedTrack = page.locator('[data-slot="slider"]').nth(1);
    await expect(speedTrack).toBeVisible();

    const box = await speedTrack.boundingBox();
    if (!box) throw new Error('No bounding box');

    // Click at extreme right edge
    await speedTrack.click({
      position: {
        x: box.width - 1,
        y: box.height / 2,
      },
    });

    const thumb = page.locator('[role="slider"]').nth(1);

    await expect
      .poll(async () => {
        return await thumb.getAttribute('aria-valuenow');
      })
      .toBe('2');

    console.log('✅ Speed set to ~2x');

    // ▶️ Click Play
    await playButton.click();
    console.log('▶ Play clicked');

    // Wait for playback to start
    const startTime = await timeDisplay.textContent();
    console.log(`startTime :${startTime}`);

    await expect
      .poll(async () => await timeDisplay.textContent(), {
        timeout: 60_000,
        message: 'Waiting for video playback to start',
      })
      .not.toBe(startTime);

    console.log('⏳ Playback started');

    // Wait for completion (1s tolerance)
    await expect
      .poll(
        async () => {
          const text = await timeDisplay.textContent();
          if (!text) return false;

          const [currentText, totalText] = text.split('/').map((t) => t.trim());

          const current = parseTimeToSeconds(currentText);
          const total = parseTimeToSeconds(totalText);

          return current >= total - 1;
        },
        {
          timeout: 6 * 60 * 1000,
          message: 'Waiting for video to complete',
        },
      )
      .toBe(true);

    console.log('✅ Video completed');
  }

async function waitForItemlist(section: Locator) {
  const page = section.page();

  const items = section.getByTestId('course-item');

  await expect(items.first()).toBeVisible({ timeout: 30000 });

  let previousCount = 0;
  let stableIterations = 0;
  const MAX_STABLE_ITERATIONS = 3;

  while (stableIterations < MAX_STABLE_ITERATIONS) {
    const currentCount = await items.count();

    if (currentCount === previousCount) {
      stableIterations++;
    } else {
      stableIterations = 0;
      previousCount = currentCount;
    }

    await page.waitForTimeout(200);
  }

  console.log(`✅ All items loaded. Total: ${previousCount}`);
}

  async function handleStopVideoError(page: Page) {
    // Anchor on the error text
    const errorDialog = page
      .getByText('Failed to stop video')
      .locator('..') // paragraph → inner container
      .locator('..'); // inner container → dialog box

    try {
      await errorDialog.waitFor({ state: 'visible', timeout: 30_000 });
      console.warn('⚠️ "Failed to stop video" dialog detected');

      const continueButton = page
        .getByText('Failed to stop video')
        .locator('xpath=ancestor::div[.//button[text()="Continue"]]')
        .getByRole('button', { name: 'Continue' });

      await continueButton.waitFor({ state: 'visible', timeout: 30_000 });
      await continueButton.click();

      console.log('✅ Clicked Continue inside error dialog');
    } catch (err) {
      console.error('❌ Dialog detected but Continue could not be clicked', err);
    }
  }

async function scrollToLoadAllModules(page: Page) {
  const modules = page.getByTestId('course-module');

  // 1️⃣ Wait for at least one module
  await modules.first().waitFor({ state: 'visible', timeout: 30_000 });

  let previousCount = await modules.count();
  let stableIterations = 0;
  const MAX_STABLE_ITERATIONS = 3;

  console.log(`🔎 Initial modules visible: ${previousCount}`);

  while (stableIterations < MAX_STABLE_ITERATIONS) {
    // Scroll the last module into view
    await modules.nth(previousCount - 1).scrollIntoViewIfNeeded();

    // Give React time to render lazy content
    await page.waitForTimeout(300); 

    const currentCount = await modules.count();
    console.log(`🔎 Modules visible so far: ${currentCount}`);

    if (currentCount === previousCount) {
      stableIterations++;
      console.log(`⏳ No new modules detected (${stableIterations}/${MAX_STABLE_ITERATIONS})`);
    } else {
      stableIterations = 0;
      previousCount = currentCount;
    }
  }

  console.log('✅ All modules loaded');
}

  async function attemptQuiz(page: Page) {
    // Loop until quiz is completed
    let current = 0;
    let total = 1;

    while (current < total) {
      const questionBadge = page.getByText(/Question\s+\d+\s+of\s+\d+/i);
      await expect(questionBadge).toBeVisible({ timeout: 30000 });

      const badgeText = await questionBadge.textContent();
      if (!badgeText) {
        throw new Error('Unable to read question progress text');
      }

      const match = badgeText.match(/Question\s+(\d+)\s+of\s+(\d+)/i);
      if (!match) {
        throw new Error(`Unexpected question format: ${badgeText}`);
      }

      current = Number(match[1]);
      total = Number(match[2]);

      console.log(`📝 Answering question ${current} of ${total}`);

      const radioOptions = page.getByRole('radio');
      const checkboxOptions = page.getByRole('checkbox');

      if ((await radioOptions.count()) > 0) {
        console.log('🔘 Single-select question detected');
        await radioOptions.first().click();
      } else if ((await checkboxOptions.count()) > 0) {
        console.log('☑️ Multi-select question detected');
        await checkboxOptions.first().click();
      } else {
        const textbox = page.getByRole('textbox');
        if ((await textbox.count()) > 0) {
          console.log('✍️ Text-based question detected');
          await textbox.first().fill('test');
        }
      }

      if (current === total) {
        const finishButton = page.getByRole('button', { name: /^finish$/i });
        await expect(finishButton).toBeEnabled();
        console.log('🏁 Finishing quiz');
        await finishButton.click();
      } else {
        const nextButton = page.getByRole('button', { name: /^next$/i });
        await expect(nextButton).toBeEnabled();
        await nextButton.click();
      }
    }

    const completedHeading = page.getByText(/quiz\s+completed/i);
    await completedHeading.waitFor({ state: 'visible', timeout: 30_000 });
    console.log('🎉 Quiz completed successfully');

    //Wait for "Next Lesson" button
    const nextLessonButton = page.getByRole('button', { name: /next\s+lesson/i });
    await nextLessonButton.waitFor({ state: 'visible', timeout: 30_000 });

    //Click it
    await nextLessonButton.click();
  }

  /* ----------------------------------------------------------------------
   //  Load all modules and loop through all of them ---
---------------------------------------------------------------------- */
  await verifyWebcamStream_ifpresent(page);

  await scrollToLoadAllModules(page);

// Get all module containers
const modules = page.getByTestId('course-module');

const moduleCount = await modules.count();
console.log(`📦 Found ${moduleCount} modules`);


for (let m = 0; m < moduleCount; m++) {

  const module = modules.nth(m);

  await module.scrollIntoViewIfNeeded();
  await expect(module).toBeVisible();

  const moduleName = (await module
    .getByTestId('course-module-toggle')
    .textContent())?.trim();

  console.log(`📦 Module [${m}] | Name: ${moduleName}`);

  // Expand module 
  const moduleToggle = module.getByTestId('course-module-toggle');
  await moduleToggle.click();
  await expandIfCollapsed(moduleToggle);

  /* ----------------------------------------------------------------
     🔹 Detect SECTIONS
  ---------------------------------------------------------------- */

  const sections = module.getByTestId('course-section');
  const sectionCount = await sections.count();

  console.log(`📂 Found ${sectionCount} sections in module`);

  for (let i = 0; i < sectionCount; i++) {

    const section = sections.nth(i);

    const sectionName = (await section
      .getByTestId('course-section-toggle')
      .textContent())?.trim();

    console.log(`📂 Section [${i}]  | Name: ${sectionName}`);

    const sectionToggle = section.getByTestId('course-section-toggle');

    await sectionToggle.click();
    await expandIfCollapsed(sectionToggle);

    await waitForItemlist(section);

    const items = section.getByTestId('course-item');
    const itemCount = await items.count();

    console.log(` ▶ Found ${itemCount} items`);


    for (let j = 0; j < itemCount; j++) {
      const item = items.nth(j);

      // Get item ID
      const itemId = await item.getAttribute('data-item-id');
      if (!itemId) continue;
      // Click item
      await item.click();

      // Wait for main header to reflect same ID, indicates item is loaded
      await expect(
        page.locator('[data-testid="current-item-title"]')
      ).toHaveAttribute('data-item-id', itemId, { timeout: 30000 });

      console.log(`   ✅ Item ${j} loaded successfully`);
      const lessonType = await item.getAttribute('data-item-type');
      const rawText = (await item.textContent())?.trim() || '';
      const itemName = rawText.replace(/completed/i, '').trim();

      console.log(`\n➡ Selecting item [${j}]`);
      console.log(`   Type: ${lessonType}`);
      console.log(`   Name: ${itemName}`);      

      // Act based on lesson type
      if (lessonType === 'video') {
        console.log('   🎬 Video detected');

        await playAndWaitForCompletion(page); 
        await handleStopVideoError(page);

        console.log(`item [${j}] 🎬 Video completed`);
      } 
      else if (lessonType === 'quiz') {
        console.log('   📝 Quiz detected');

        await attemptQuiz(page);

        console.log(` item [${j}] 📝 Quiz completed`);
      } 
      else {
        console.log(`   ℹ️ Unsupported lesson type: ${lessonType}`);
      }
    } 
    }
  }
  console.log('✅ Course video playback verified');
});
