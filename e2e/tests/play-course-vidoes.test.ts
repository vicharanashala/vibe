import { test, expect, Locator, Page } from '@playwright/test';

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
  // --- 2. Login flow ---
  await page.getByRole('button', { name: /continue to login/i }).click();

  const emailInput = page.getByPlaceholder(/enter your email/i);
  const passwordInput = page.getByPlaceholder(/enter your password/i);

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await emailInput.fill(process.env.TEST_STUDENT_EMAIL);
  await passwordInput.fill(process.env.TEST_STUDENT_PASSWORD);

  await page.getByRole('button', { name: /sign in as student/i }).click();

  // --- 3. Verify login ---
  await expect(page.getByText(/logout/i)).toBeVisible();
  console.log('URL after login:', page.url());

  // 4. Locate course title
  const courseTitle = page.getByRole('heading', {
    name: new RegExp(COURSE_NAME, 'i'),
    level: 3,
  });

  await expect(courseTitle).toBeVisible({ timeout: 15_000 });

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
  // Not being used currently as proctoring is disabled for MERN course.
  async function verifyWebcamStream_ifpresent(page: Page) {
    // 🔎 Check if Declaration is visible (short timeout so it doesn’t wait 30s)
    const declarationVisible = await page
      .getByText(/Declaration/i)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!declarationVisible) {
      console.log('ℹ️ Declaration not found. Skipping webcam verification.');
      return; // 🚀 Exit function completely
    }

    console.log('✅ Declaration found. Verifying webcam stream...');
    await page.getByRole('button', { name: /accept/i }).click();

    // 2️⃣ Locate video element
    const video = page.locator('video');
    await expect(video).toBeVisible();

    // 3️⃣ Wait for media stream to attach
    await page.waitForFunction(
      () => {
        const v = document.querySelector('video');
        return v && v.readyState >= 2 && v.videoWidth > 0;
      },
      null,
      { timeout: 30_000 },
    );

    // 4️⃣ Extract video metadata
    const info = await video.evaluate((v) => ({
      readyState: v.readyState,
      currentTime: v.currentTime,
      width: v.videoWidth,
      height: v.videoHeight,
    }));

    console.log('Video info:', info);

    // 5️⃣ Basic validation
    expect(info.width).toBeGreaterThan(0);
    expect(info.height).toBeGreaterThan(0);

    // 6️⃣ Optional: verify frames are flowing
    const t1 = info.currentTime;
    await page.waitForTimeout(2000);
    const t2 = await video.evaluate((v) => v.currentTime);

    expect(t2).toBeGreaterThan(t1);
  }

  async function expandIfCollapsed(button: Locator) {
    await button.waitFor({ state: 'visible', timeout: 15_000 });

    const expanded = await button.getAttribute('aria-expanded');

    if (expanded === null) {
      throw new Error('aria-expanded attribute not found on expandable button');
    }

    if (expanded === 'false') {
      await button.click();
      await expect(button).toHaveAttribute('aria-expanded', 'true', {
        timeout: 5_000,
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
    // 🎯 YouTube embedded Play button
    const playButton = page.getByRole('button', { name: /^play$/i });

    // ⏱ Time display like "1:39 / 2:20"
    const timeDisplay = page.locator('text=/\\d:\\d{2}\\s*\\/\\s*\\d:\\d{2}/');

    // Wait for player to be ready
    await expect(playButton).toBeVisible({ timeout: 30_000 });
    await expect(timeDisplay).toBeVisible({ timeout: 30_000 });

    // ▶️ Click Play
    await playButton.click();
    console.log('▶ Play clicked');

    // Wait for playback to start
    const startTime = await timeDisplay.textContent();
    console.log(`startTime :${startTime}`);

    await expect
      .poll(async () => await timeDisplay.textContent(), {
        timeout: 30_000,
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

  async function waitForVideolist(sectionButton) {
    const videoList = sectionButton.locator('xpath=following-sibling::ul[1]');

    // Wait for the videos container to appear
    await videoList.waitFor({ state: 'visible', timeout: 10_000 });

    // Wait until at least one video button is present
    await videoList.locator('li > button').first().waitFor({
      state: 'visible',
      timeout: 10_000,
    });
  }

  async function handleStopVideoError(page: Page) {
    // Anchor on the error text
    const errorDialog = page
      .getByText('Failed to stop video')
      .locator('..') // paragraph → inner container
      .locator('..'); // inner container → dialog box

    try {
      await errorDialog.waitFor({ state: 'visible', timeout: 3000 });
      console.warn('⚠️ "Failed to stop video" dialog detected');

      const continueButton = page
        .getByText('Failed to stop video')
        .locator('xpath=ancestor::div[.//button[text()="Continue"]]')
        .getByRole('button', { name: 'Continue' });

      await continueButton.waitFor({ state: 'visible', timeout: 3000 });
      await continueButton.click();

      console.log('✅ Clicked Continue inside error dialog');
    } catch (err) {
      console.error('❌ Dialog detected but Continue could not be clicked', err);
    }
  }

  async function scrollToLoadAllModules(page: Page) {
    const modules = page.locator('button:has-text("sections")');

    // 1️⃣ Wait for at least ONE module to appear
    await modules.first().waitFor({ state: 'visible', timeout: 10_000 });

    let previousCount = await modules.count();
    let stableIterations = 0;
    const MAX_STABLE_ITERATIONS = 3;

    console.log(`🔎 Initial modules visible: ${previousCount}`);

    while (stableIterations < MAX_STABLE_ITERATIONS) {
      // Scroll last known module
      await modules.nth(previousCount - 1).scrollIntoViewIfNeeded();

      // Give React time to lazy-load
      await page.waitForTimeout(1000);

      const currentCount = await modules.count();
      console.log(`🔎 Modules visible so far: ${currentCount}`);

      if (currentCount === previousCount) {
        stableIterations++;
        console.log(`⏳ No new modules detected (${stableIterations}/${MAX_STABLE_ITERATIONS})`);
      } else {
        stableIterations = 0; // reset if new modules appear
        previousCount = currentCount;
      }
    }

    console.log('✅ All modules loaded');
  }

  async function attemptQuiz(page: Page) {
    // 1️⃣ Ensure we are on the Quiz page
    await expect(page.getByText(/^quiz\s+\d+$/i)).toBeVisible({ timeout: 10_000 });

    console.log('✅ Quiz heading detected');

    // Loop until quiz is completed
    let current = 0;
    let total = 1;

    while (current < total) {
      const questionBadge = page.getByText(/Question\s+\d+\s+of\s+\d+/i);
      await expect(questionBadge).toBeVisible();

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
    await expect(completedHeading).toBeVisible({ timeout: 10_000 });
    console.log('🎉 Quiz completed successfully');
  }

  async function waitForQuizAndAttempt(page: Page) {
    const quizHeading = page.locator('main').getByText(/^quiz\s+\d+$/i);

    // ⏳ Wait until the quiz heading becomes visible
    await quizHeading.waitFor({
      state: 'visible',
      timeout: 30_000,
    });

    console.log('🎯 Quiz visible. Starting quiz attempt...');
    await attemptQuiz(page);
  }

  async function waitForVideo(page: Page, expectedVideoName: string) {
    // 1️⃣ Wait for correct heading (top of page, not sidebar)
    console.log(`⏳ Waiting for heading: ${expectedVideoName}`);

    await expect(page.locator('main')).toContainText(expectedVideoName, { timeout: 15000 });

    console.log(`✅ Heading matched: ${expectedVideoName}`);

    // 2️⃣ Wait for Play button (like before)
    const playButton = page.getByRole('button', { name: 'Play' });

    try {
      await playButton.waitFor({ state: 'visible', timeout: 120_000 });
      console.log('▶ Play button detected');
      return 'video';
    } catch {
      console.log('⚠ Play button not found');
      return 'none';
    }
  }

  /* ----------------------------------------------------------------------
   // --- 10. Load all modules and loop through all of them ---
---------------------------------------------------------------------- */
  await verifyWebcamStream_ifpresent(page);

  await scrollToLoadAllModules(page);

  const moduleButtons = page.locator('button:has-text("sections")');

  const moduleCount = await moduleButtons.count();
  console.log(`📦 Found ${moduleCount} modules`);

  // Print module names
  for (let m = 0; m < moduleCount; m++) {
    const moduleButton = moduleButtons.nth(m);

    await moduleButton.scrollIntoViewIfNeeded();
    await expect(moduleButton).toBeVisible();

    const moduleName = (await moduleButton.textContent())?.trim();

    console.log(`📦 Module [${m}]: ${moduleName}`);
  }

  console.log(`📦 ===== END MODULE LIST =====\n`);

  for (let m = 0; m < moduleCount; m++) {
    const moduleButton = moduleButtons.nth(m);
    const moduleName = (await moduleButton.textContent())?.trim();

    console.log(`📦 Module [${m}]: ${moduleName}`);
    await moduleButton.scrollIntoViewIfNeeded();
    await expect(moduleButton).toBeVisible();
    await expandIfCollapsed(moduleButton);

    /* ----------------------------------------------------------------
    11. Detect SECTIONS (auto-detected) and loop through them
---------------------------------------------------------------- */
    const sectionButtons = moduleButton.locator('xpath=following-sibling::ul[1]/li/button');

    const sectionCount = await sectionButtons.count();
    console.log(`📂 Found ${sectionCount} sections in module`);

    for (let i = 0; i < sectionCount; i++) {
      const sectionButton = sectionButtons.nth(i);
      const sectionName = (await sectionButton.textContent())?.trim();

      console.log(`📂 Section [${i}]: ${sectionName}`);

      await expandIfCollapsed(sectionButton);

      // ✅ wait for async UI update
      await waitForVideolist(sectionButton);
      /* --------------------------------------------------
      3️⃣ VIDEOS INSIDE SECTION
    -------------------------------------------------- */
      const videoButtons = sectionButton.locator('xpath=following-sibling::ul[1]/li/button');

      /* ----------------------------------------------------------------
      12. Detect videos (auto-detected) and loop through them
  ---------------------------------------------------------------- */
      const videoCount = await videoButtons.count();
      console.log(`   ▶ Found ${videoCount} videos`);

      for (let v = 0; v < videoCount; v++) {
        const fullText = (await videoButtons.nth(v).textContent())?.trim() || '';

        const match = fullText.match(/video\s+\d+/i);
        const videoName = match ? match[0] : '';
        console.log(`      🎬 Video [${v}]: ${videoName} Play\n`);
        const video = videoButtons.nth(v);

        // Click on current video
        await video.click();

        const lessonType = await waitForVideo(page, videoName);

        if (lessonType === 'video') {
          console.log('🎬 Video detected');
          await playAndWaitForCompletion(page);
          console.log(`      🎬 Video [${v}]: ${videoName} completed\n`);

          // Small buffer before moving on
          await page.waitForTimeout(1500);

          await handleStopVideoError(page);

          console.log(`🎬 Video [${v}]: ${videoName} check for quiz\n`);

          await waitForQuizAndAttempt(page);

          console.log(`🎬 Video [${v}]: ${videoName} finished quiz\n`);
        } else {
          console.log('ℹ️ No video  detected. Skipping.');
        }
      }
    }
  }
  console.log('✅ Course video playback verified');
});
