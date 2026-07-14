/**
 * Accuracy harness for the screening filter against the labelled set (brief §4/§8).
 *
 * Runs the REAL provider (Groq by default) over SCREENING_CASES, prints a
 * per-case report + overall agreement score, and asserts ≥ 90%.
 *
 * Skipped automatically when no key is set, so CI stays green without a key:
 *   GROQ_API_KEY=... npx vitest run src/modules/studentQuestions/tests/screening.accuracy.test.ts
 */
import {describe, it, expect} from 'vitest';
import {ScreeningService} from '../services/screening/ScreeningService.js';
import {SCREENING_CASES, Decision} from './screening.dataset.js';

const hasKey = !!process.env.GROQ_API_KEY || !!process.env.ANTHROPIC_CRED;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

describe.skipIf(!hasKey)('Screening accuracy (live LLM)', () => {
  it('agrees with human labels on ≥ 90% of the labelled set', async () => {
    const service = new ScreeningService();
    const rows: {id: string; trap: string; expect: Decision; got: Decision; ok: boolean}[] = [];

    for (const c of SCREENING_CASES) {
      const r = await service.screen({
        questionText: c.question,
        options: c.options,
        correctOptionIndex: c.correctOptionIndex,
        existingQuestions: c.existingQuestions,
        context: c.context,
      });
      const acceptable = new Set<Decision>([c.expect, ...(c.alsoOk ?? [])]);
      const ok = acceptable.has(r.decision);
      rows.push({id: c.id, trap: c.trap, expect: c.expect, got: r.decision, ok});
      await sleep(1200); // pace to stay under free-tier rate limits
    }

    const passed = rows.filter(r => r.ok).length;
    const score = passed / rows.length;

    // Human-readable report.
    console.log('\n──── Screening accuracy ────');
    for (const r of rows) {
      console.log(`${r.ok ? '✓' : '✗'}  ${r.id.padEnd(6)} ${r.trap.padEnd(22)} expect=${r.expect.padEnd(6)} got=${r.got}`);
    }
    console.log(`\nScore: ${passed}/${rows.length} = ${(score * 100).toFixed(1)}%`);
    const misses = rows.filter(r => !r.ok);
    if (misses.length) console.log('Misses:', misses.map(m => `${m.id}(${m.expect}→${m.got})`).join(', '));

    expect(score).toBeGreaterThanOrEqual(0.9);
    // Generous: on a free tier the run spends most of its wall-clock waiting out
    // 429s (the client honours Retry-After), not waiting on the model.
  }, 900_000);
});
