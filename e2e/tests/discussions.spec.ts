import { expect, test } from "@playwright/test";

/**
 * Milestone B smoke test for the Cohort Discussion Board.
 *
 * Covers: login → open course → open Discussion → see list load → create
 * thread → verify it appears → reload → verify persistence. Reply /
 * moderation / cross-cohort coverage is deferred to the walkthrough milestone.
 *
 * If the env vars are missing the test is skipped — never fails the suite.
 */
const REQUIRED_ENV = ["TEST_STUDENT_EMAIL", "TEST_STUDENT_PASSWORD"];

function envOrSkip() {
    for (const key of REQUIRED_ENV) {
        if (!process.env[key]) {
            test.skip(true, `Missing env var ${key}`);
            return false;
        }
    }
    return true;
}

async function loginAsStudent(
    page: import("@playwright/test").Page,
): Promise<void> {
    await page.addInitScript(() => {
        (window as unknown as { __E2E__: boolean }).__E2E__ = true;
    });

    await page.goto("/");
    const continueBtn = page.getByRole("button", { name: /continue to login/i });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueBtn.click();
    }

    const emailInput = page.getByPlaceholder(/enter your email/i);
    const passwordInput = page.getByPlaceholder(/enter your password/i);
    await expect(emailInput).toBeVisible({ timeout: 30_000 });
    await expect(passwordInput).toBeVisible();

    await emailInput.fill(process.env.TEST_STUDENT_EMAIL!);
    await passwordInput.fill(process.env.TEST_STUDENT_PASSWORD!);

    await page.getByRole("button", { name: /sign in as learner/i }).click();

async function loginAsStudent(
    page: import("@playwright/test").Page,
): Promise<void> {
    await page.addInitScript(() => {
        (window as unknown as { __E2E__: boolean }).__E2E__ = true;
    });

    await page.goto("/");
    const continueBtn = page.getByRole("button", { name: /continue to login/i });
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await continueBtn.click();
    }

    const emailInput = page.getByPlaceholder(/enter your email/i);
    const passwordInput = page.getByPlaceholder(/enter your password/i);
    await expect(emailInput).toBeVisible({ timeout: 30_000 });
    await expect(passwordInput).toBeVisible();

    await emailInput.fill(process.env.TEST_STUDENT_EMAIL!);
    await passwordInput.fill(process.env.TEST_STUDENT_PASSWORD!);

    await page.getByRole("button", { name: /sign in as learner/i }).click();

    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible({
        timeout: 60_000,
    });
}

test.describe("Discussion board — Milestone B smoke", () => {
    test("student can open Discussion, create a thread, and reload to verify persistence", async ({
        page,
    }) => {
        if (!envOrSkip()) return;

        const listRequests: string[] = [];
        const createRequests: string[] = [];
        page.on("request", req => {
            const url = req.url();
            if (/\/course\/[^/]+\/discussions$/.test(url)) {
                if (req.method() === "GET") listRequests.push(url);
                if (req.method() === "POST") createRequests.push(url);
            }
        });

        await loginAsStudent(page);

        await page.goto("/student/courses");
        const firstCourseCard = page
            .locator(
                '[data-testid="course-card"], [data-testid="course-list-card"], a[href*="/student/learn"]',
            )
            .first();
        await expect(firstCourseCard).toBeVisible({ timeout: 30_000 });
        await firstCourseCard.click();
        await page.waitForURL(/\/student\/learn/, { timeout: 30_000 });

        const discussionLink = page.getByRole("link", { name: /^Discussion$/i });
        await expect(discussionLink).toBeVisible({ timeout: 30_000 });
        await discussionLink.click();

        await page.waitForURL(/\/student\/courses\/[^/]+\/discussions$/, {
            timeout: 30_000,
        });
        await expect(
            page.getByRole("heading", { name: /^Discussions$/i }),
        ).toBeVisible({ timeout: 30_000 });

        await expect
            .poll(() => listRequests.length, { timeout: 10_000 })
            .toBeGreaterThan(0);

        const uniqueTitle = `E2E test thread ${Date.now()}`;
        await page.getByTestId("discussion-create-button").click();
        await expect(page.getByTestId("create-discussion-dialog")).toBeVisible();

        await page.getByTestId("create-discussion-title").fill(uniqueTitle);
        await page
            .getByTestId("create-discussion-body")
            .fill("Body created by Playwright during the Milestone B smoke test.");

        await page.getByTestId("create-discussion-submit").click();

        await expect(page.getByTestId("create-discussion-dialog")).toBeHidden({
            timeout: 30_000,
        });
        await page.waitForURL(/\/student\/courses\/[^/]+\/discussions\/[^/]+$/, {
            timeout: 30_000,
        });

        await expect(page.getByTestId("discussion-thread-title")).toHaveText(
            uniqueTitle,
            { timeout: 30_000 },
        );
        await expect(page.getByTestId("discussion-thread-body")).toContainText(
            "Body created by Playwright",
        );

        await page.getByTestId("discussion-back-to-list").click();
        await page.waitForURL(/\/student\/courses\/[^/]+\/discussions$/, {
            timeout: 30_000,
        });
        await expect(
            page.getByRole("heading", { name: uniqueTitle }),
        ).toBeVisible({ timeout: 30_000 });

        await page.reload();
        await expect(
            page.getByRole("heading", { name: uniqueTitle }),
        ).toBeVisible({ timeout: 30_000 });

        expect(createRequests.length).toBeGreaterThan(0);
    });

    test("empty state renders when the cohort has zero threads", async ({ page }) => {
        if (!envOrSkip()) return;

        await loginAsStudent(page);

        await page.route("**/course/*/discussions", async route => {
            if (route.request().method() === "GET") {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify([]),
                });
            } else {
                await route.continue();
            }
        });

        await page.goto("/student/courses/000000000000000000000001/discussions");
        await expect(page.getByTestId("discussion-list-empty")).toBeVisible({
            timeout: 30_000,
        });
        await expect(
            page.getByText(/Start the first discussion in your cohort/i),
        ).toBeVisible();
    });
});

    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible({
        timeout: 60_000,
    });
}
