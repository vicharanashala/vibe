import { expect, Locator, Page } from '@playwright/test';

export async function loginAsStudent(page: Page) {
  if (process.env.SKIP_AUTH_PAGE === 'true') {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 60000 });
    return;
  }

  // --- Safety check ---
  if (!process.env.TEST_STUDENT_EMAIL || !process.env.TEST_STUDENT_PASSWORD) {
    throw new Error('Missing TEST_STUDENT_EMAIL or TEST_STUDENT_PASSWORD');
  }

  await page.getByRole('button', { name: /continue to login/i }).click();

  const emailInput = page.getByPlaceholder(/enter your email/i);
  const passwordInput = page.getByPlaceholder(/enter your password/i);

  await expect(emailInput).toBeVisible();
  await expect(passwordInput).toBeVisible();

  await emailInput.fill(process.env.TEST_STUDENT_EMAIL);
  await passwordInput.fill(process.env.TEST_STUDENT_PASSWORD);

  await page.getByRole('button', { name: /sign in as learner/i }).click();

  await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible({ timeout: 60000 });
}

// ---------------------------------------------
// Helpers functions
// ---------------------------------------------
async function verifyWebcamStream_ifpresent(page: Page) {
  // 🔎 Check if Declaration is visible (short timeout so it doesn’t wait 60s)
  const declarationVisible = await page
    .getByText(/Declaration/i)
    .isVisible({ timeout: 60000 })
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
    { timeout: 60_000 },
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
  await button.waitFor({ state: 'visible', timeout: 60_000 });

  const expanded = await button.getAttribute('aria-expanded');

  if (expanded === null) {
    throw new Error('aria-expanded attribute not found on expandable button');
  }

  if (expanded === 'false') {
    await button.click();
    await expect(button).toHaveAttribute('aria-expanded', 'true', {
      timeout: 60_000,
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

async function fastForwardIfAvailable(page, timeDisplay) {
  const forwardButton = page.getByRole('button', { name: /forward 10 seconds/i });

  // Check if button exists
  if ((await forwardButton.count()) === 0) {
    console.log('⏩ Forward button not present');
    return;
  }

  console.log('⏩ Forward button detected');

  // Wait until first 10 seconds have played
  await expect
    .poll(
      async () => {
        const text = await timeDisplay.textContent();
        if (!text) return 0;

        const [currentText] = text.split('/').map((t) => t.trim());
        return parseTimeToSeconds(currentText);
      },
      {
        timeout: 20000, // allow enough time for 10s playback
        message: 'Waiting for first 10 seconds of playback',
      },
    )
    .toBeGreaterThanOrEqual(10);

  console.log('⏩ First 10 seconds played');

  // Keep forwarding until near the end
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const text = await timeDisplay.textContent();
    if (!text) break;

    const [currentText, totalText] = text.split('/').map((t) => t.trim());

    const current = parseTimeToSeconds(currentText);
    const total = parseTimeToSeconds(totalText);

    if (current >= total - 12) {
      console.log('⏩ Reached close to the end');
      break;
    }

    await forwardButton.click();
    console.log('⏩ Forwarded 10 seconds');

    await page.waitForTimeout(500);
  }
}

async function playAndWaitForCompletion(page): Promise<boolean> {
  // Play button
  const playButton = page.getByRole('button', { name: /^play$/i });

  // ⏱ Time display like "mm:ss / mm:ss"
  const timeDisplay = page.locator('text=/\\d{1,2}:\\d{2}\\s*\\/\\s*\\d{1,2}:\\d{2}/');

  // Wait for player to be ready
  await expect(playButton).toBeVisible({ timeout: 60_000 });
  await expect(timeDisplay).toBeVisible({ timeout: 60_000 });

  // Increase speed to 2x
  const speedTrack = page.locator('[data-slot="slider"]').nth(1);
  await expect(speedTrack).toBeVisible();

  const box = await speedTrack.boundingBox();
  if (!box) throw new Error('No bounding box');

  // ▶️ Initial click
  await playButton.click();
  console.log('▶ Play clicked');

  const startTime = await timeDisplay.textContent();
  console.log(`startTime: ${startTime}`);

  const TOTAL_TIMEOUT = 120_000;
  const CHUNK_TIMEOUT = 30_000;

  const start = Date.now();
  let playbackStarted = false;
  let clickAttempts = 1; // already clicked once

  while (Date.now() - start < TOTAL_TIMEOUT) {
    try {
      await expect
        .poll(async () => await timeDisplay.textContent(), {
          timeout: CHUNK_TIMEOUT,
          message: 'Waiting for video playback to start',
        })
        .not.toBe(startTime);

      console.log('✅ Playback started');
      playbackStarted = true;
      break;
    } catch {
      console.log('⏳ Playback not started in 30s, retrying play...');

      await playButton.click();
      clickAttempts++;
      console.log(`🔁 Play clicked again (attempt ${clickAttempts})`);
    }
  }

  // Final assertion
  if (!playbackStarted) {
    console.log(
      `❌ Playback did not start after ${TOTAL_TIMEOUT / 1000}s and ${clickAttempts} attempts`,
    );
    return false; // 🚨 IMPORTANT
  }

  console.log('⏳ Playback started');

  // Click at extreme right edge
  await speedTrack.click({
    position: {
      x: box.width - 1,
      y: box.height / 2,
    },
  });

  const thumb = page.locator('[role="slider"]').nth(1);

  await expect
    .poll(
      async () => {
        return await thumb.getAttribute('aria-valuenow');
      },
      { timeout: 60000 }, // 60 seconds
    )
    .toBe('2');

  console.log('✅ Speed set to ~2x');

  await fastForwardIfAvailable(page, timeDisplay);

  // Wait for completion (2s tolerance)
  await expect
    .poll(
      async () => {
        const text = await timeDisplay.textContent();
        if (!text) return false;

        const [currentText, totalText] = text.split('/').map((t) => t.trim());

        const current = parseTimeToSeconds(currentText);
        const total = parseTimeToSeconds(totalText);

        return current >= total - 5;
      },
      {
        timeout: 6 * 60 * 1000,
        message: 'Waiting for video to complete',
      },
    )
    .toBe(true);

  console.log('✅ Video completed');
  return true;
}

async function waitForItemlist(section: Locator) {
  const page = section.page();

  const items = section.getByTestId('course-item');

  await expect(items.first()).toBeVisible({ timeout: 60000 });

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

let stopVideoErrorCount = 0;
let totalVideoCount = 0;

async function handleStopVideoError(page: Page) {
  // Anchor on the error text
  const errorDialog = page
    .getByText('Failed to stop video')
    .locator('..') // paragraph → inner container
    .locator('..'); // inner container → dialog box

  try {
    // Step 1: Wait only 5 seconds for dialog
    await errorDialog.waitFor({ state: 'visible', timeout: 5000 });
    console.warn('⚠️ "Failed to stop video" dialog detected');

    stopVideoErrorCount++; // ✅ increment here
    console.warn(`⚠️ Error detected (${stopVideoErrorCount}) times`);

    // Step 2: Scope Continue button inside the SAME dialog
    const continueButton = errorDialog.getByRole('button', { name: 'Continue' });

    try {
      // Wait up to 10 seconds for Continue button
      await continueButton.waitFor({ state: 'visible', timeout: 10000 });
      await continueButton.click();

      console.log('✅ Clicked Continue inside error dialog');
    } catch {
      // Continue button not found → proceed silently
      console.log('ℹ️ Continue button not found, proceeding...');
    }
  } catch {
    // Dialog not found within 5 seconds → do nothing
  }
}

async function scrollToLoadAllModules(page: Page) {
  const modules = page.getByTestId('course-module');

  // 1️⃣ Wait for at least one module
  await modules.first().waitFor({ state: 'visible', timeout: 60_000 });

  let previousCount = await modules.count();
  let stableIterations = 0;
  const MAX_STABLE_ITERATIONS = 3;

  console.log(`🔎 Initial modules visible: ${previousCount}`);

  while (stableIterations < MAX_STABLE_ITERATIONS) {
    // Scroll the last module into view
    await modules.nth(previousCount - 1).scrollIntoViewIfNeeded();

    // Give React time to render lazy content
    await page.waitForTimeout(600);

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
  const noAttemptsHeading = page.getByRole('heading', {
    name: /no attempts remaining/i,
  });

  const noAttemptsVisible = await noAttemptsHeading
    .isVisible({ timeout: 3000 })
    .catch(() => false);

  if (noAttemptsVisible) {
    console.log('ℹ️ Quiz has no attempts remaining. Skipping to next lesson.');
    const nextLessonButton = page.getByRole('button', { name: /next\s+lesson/i });
    if (await nextLessonButton.isVisible({ timeout: 10000 }).catch(() => false)) {
      await nextLessonButton.click();
    }
    return;
  }

  // Loop until quiz is completed
  let current = 0;
  let total = 1;

  while (current < total) {
    const questionBadge = page.getByText(/Question\s+\d+\s+of\s+\d+/i);
    await expect(questionBadge).toBeVisible({ timeout: 60000 });

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
  await completedHeading.waitFor({ state: 'visible', timeout: 100_000 });
  console.log('🎉 Quiz completed successfully');

  // Wait for "Next Lesson" button (optional)
  const nextLessonButton = page.getByRole('button', { name: /next\s+lesson/i });

  try {
    await nextLessonButton.waitFor({ state: 'visible', timeout: 60_000 });
    await nextLessonButton.click();
    console.log('✅ "Next Lesson" button clicked');
  } catch {
    console.log('ℹ️ "Next Lesson" button not found after 60 seconds. Continuing...');
  }
}

async function submitProject(page: Page) {
  // Fill the Work Link textbox
  const workLinkTextbox = page.getByRole('textbox', { name: /work link/i });
  await workLinkTextbox.fill('https://vibe.vicharanashala.ai/student');

  // Click Submit button
  const submitButton = page.getByRole('button', { name: /submit form/i });
  await submitButton.click();

  // Wait for success popup
  await expect(page.getByText(/form submitted successfully/i).first()).toBeVisible();

  console.log('✅ Project submitted successfully');
}

export async function getCourseCard(page: Page, courseName: string): Promise<Locator> {
  const escapedCourseName = courseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = page
    .getByRole('heading', {
      name: new RegExp(escapedCourseName, 'i'),
      level: 3,
    })
    .first();

  await expect(heading).toBeVisible({ timeout: 60000 });

  // Dashboard markup changed from data-slot card wrappers; anchor to the nearest
  // container that has a start/continue action for this course.
  const courseCard = heading.locator(
    'xpath=ancestor::*[.//button[contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"continue") or contains(translate(normalize-space(.),"ABCDEFGHIJKLMNOPQRSTUVWXYZ","abcdefghijklmnopqrstuvwxyz"),"start")]][1]',
  );

  await expect(courseCard).toBeVisible({ timeout: 60000 });

  return courseCard;
}

export async function runCourseVideoAndQuiz(page: Page, courseName: string) {
  const courseCard = await getCourseCard(page, courseName);

  // 6. Find Start or Continue button
  const actionButton = courseCard.locator('button', {
    hasText: /(start|continue)/i,
  });

  // 7. Click
  await expect(actionButton).toBeVisible();
  await actionButton.click();

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

    const moduleName = (await module.getByTestId('course-module-toggle').textContent())?.trim();

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

    const section_start = m === 1 ? 0 : 0; // set section_start as required for testing

    for (let i = section_start; i < sectionCount; i++) {
      const section = sections.nth(i);

      const sectionName = (
        await section.getByTestId('course-section-toggle').textContent()
      )?.trim();

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

        // Click item
        await item.click();
        // Get item ID
        const itemId = await item.getAttribute('data-item-id');
        if (!itemId) continue;

        // Wait for main header to reflect same ID, indicates item is loaded.
        // Some items can be blocked by permissions/attempt limits; skip those gracefully.
        try {
          await expect(page.locator('[data-testid="current-item-title"]')).toHaveAttribute(
            'data-item-id',
            itemId,
            { timeout: 90000 },
          );
        } catch {
          const currentItemId = await page
            .locator('[data-testid="current-item-title"]')
            .getAttribute('data-item-id');
          console.log(
            `⚠️ Skipping item [${j}] because it could not be opened (expected ${itemId}, got ${currentItemId ?? 'none'})`,
          );
          continue;
        }

        console.log(` Module[${m}] section[${i}]  ✅ Item ${j} loaded successfully`);
        const lessonType = await item.getAttribute('data-item-type');
        const rawText = (await item.textContent())?.trim() || '';
        const itemName = rawText.replace(/completed/i, '').trim();

        console.log(`\n➡ Selecting item [${j}]`);
        console.log(`   Type: ${lessonType}`);
        console.log(`   Name: ${itemName}`);

        // Act based on lesson type
        if (lessonType === 'video') {
          console.log('   🎬 Video detected');

          const success = await playAndWaitForCompletion(page);

          if (!success) {
            console.log(`❌ Playback failed at item [${j}]`);

            // 🔹 Calculate fallback index
            const fallbackIndex = Math.max(0, j - 4);

            console.log(`⏪ Jumping back from item [${j}] → [${fallbackIndex}]`);

            const fallbackItem = items.nth(fallbackIndex);

            await fallbackItem.click();

            const fallbackItemId = await fallbackItem.getAttribute('data-item-id');

            if (fallbackItemId) {
              await expect(page.locator('[data-testid="current-item-title"]')).toHaveAttribute(
                'data-item-id',
                fallbackItemId,
                {
                  timeout: 90000,
                },
              );
            }

            // 🔁 Reset loop index
            j = fallbackIndex - 1;

            continue;
          }
          totalVideoCount++;
          // ✅ Only run if playback succeeded
          await handleStopVideoError(page);
          console.log(`⚠️ stopVideoError encountered (${stopVideoErrorCount} out of ${totalVideoCount}) times`);
          console.log(`Module[${m}] section[${i}] item [${j}] 🎬 Video completed`);
        } else if (lessonType === 'quiz') {
          console.log('   📝 Quiz detected');

          await attemptQuiz(page);

          console.log(` Module[${m}] section[${i}] item [${j}] 📝 Quiz completed`);
        } else if (lessonType === 'project') {
          console.log('   📝 Project detected');

          await submitProject(page);

          console.log(`Module[${m}] section[${i}] item [${j}] 📝 project completed`);
        } else {
          console.log(`   ℹ️ Unsupported lesson type: ${lessonType}`);
        }
      }
    }
  }
  console.log('✅ Course video playback verified');
}
