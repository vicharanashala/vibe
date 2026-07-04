/**
 * Edge-case suite for the three product requirements:
 *   R1 — duplicates must be accurately revoked (reworded, reordered, zero-overlap)
 *   R2 — mistakes must be detected (wrong marked option, typo'd options, no-correct-option)
 *   R3 — spam/gibberish must be rejected on the spot
 *
 * Live Groq. Requires GROQ_API_KEY in backend/.env.
 *   NODE_OPTIONS="-r dotenv/config" DOTENV_CONFIG_PATH=.env npx vitest run src/modules/studentQuestions/tests/screening.edgecases.test.ts
 */
import {describe, it, expect} from 'vitest';
import {ScreeningService, ScreeningInput} from '../services/screening/ScreeningService.js';

const hasKey = !!process.env.GROQ_API_KEY || !!process.env.ANTHROPIC_CRED;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

interface Case {
  id: string;
  req: 'R1-dup' | 'R2-mistake' | 'R3-spam' | 'control';
  input: ScreeningInput;
  /** pass = accepted; blocked = reject OR hold (never silently accepted). */
  expect: 'pass' | 'reject' | 'blocked';
}

const POOL = [
  'what is the boiling point of water',
  'who discovered gravity',
  'what is 3+1',
  'A founder pitches investors who ask why they should fund her over a competitor with 10x the engineers.',
];

const CASES: Case[] = [
  // ── controls: legit questions must still pass ──
  {id: 'ok-clean', req: 'control', expect: 'pass', input: {questionText: 'what is the chemical formula of water', options: ['H2O', 'CO2'], correctOptionIndex: 0, existingQuestions: POOL}},
  {id: 'ok-typo-q', req: 'control', expect: 'pass', input: {questionText: 'wat is fotosynthesis in plants', options: ['making food from sunlight', 'breathing'], correctOptionIndex: 0, existingQuestions: POOL}},

  // ── R1: duplicates ──
  {id: 'dup-reword', req: 'R1-dup', expect: 'blocked', input: {questionText: 'at what temperature does water begin boiling', existingQuestions: POOL, options: ['100C', '50C'], correctOptionIndex: 0}},
  {id: 'dup-commute', req: 'R1-dup', expect: 'blocked', input: {questionText: 'what is 1+3', existingQuestions: POOL, options: ['4', '5'], correctOptionIndex: 0}},
  {id: 'dup-verbal', req: 'R1-dup', expect: 'blocked', input: {questionText: 'what is three plus one', existingQuestions: POOL, options: ['4', '5'], correctOptionIndex: 0}},
  {id: 'dup-zero-overlap', req: 'R1-dup', expect: 'blocked', input: {questionText: 'which scientist first described the force pulling objects to earth', existingQuestions: POOL, options: ['Newton', 'Tesla'], correctOptionIndex: 0}},
  {id: 'notdup-same-answer', req: 'R1-dup', expect: 'pass', input: {questionText: 'what is 2+2', existingQuestions: POOL, options: ['4', '6'], correctOptionIndex: 0}},

  // ── R2: mistakes ──
  {id: 'wrong-answer', req: 'R2-mistake', expect: 'reject', input: {questionText: 'what is 3+3', options: ['12', '6'], correctOptionIndex: 0, existingQuestions: POOL}},
  {id: 'wrong-capital', req: 'R2-mistake', expect: 'reject', input: {questionText: 'what is the capital of Japan', options: ['Tokyo', 'Beijing', 'Seoul'], correctOptionIndex: 1, existingQuestions: POOL}},
  {id: 'typo-option-ok', req: 'R2-mistake', expect: 'pass', input: {questionText: 'what is the capital of Japan', options: ['Tokio', 'Beijing'], correctOptionIndex: 0, existingQuestions: POOL}},
  {id: 'no-correct-option', req: 'R2-mistake', expect: 'blocked', input: {questionText: 'what is 2+2', options: ['5', '3'], correctOptionIndex: 0, existingQuestions: ['who discovered gravity']}},
  {id: 'opinion-question', req: 'R2-mistake', expect: 'blocked', input: {questionText: 'which programming language is the best', options: ['Python', 'JavaScript'], correctOptionIndex: 0, existingQuestions: POOL}},

  // ── R3: spam/gibberish ──
  {id: 'spam-mash', req: 'R3-spam', expect: 'reject', input: {questionText: 'asdf qwerty zxcv hjkl'}},
  {id: 'spam-symbols', req: 'R3-spam', expect: 'reject', input: {questionText: '@@@ ### !!! $$$'}},
  {id: 'spam-repeat', req: 'R3-spam', expect: 'reject', input: {questionText: 'hello hello hello hello hello'}},
  {id: 'spam-nonsense', req: 'R3-spam', expect: 'reject', input: {questionText: 'purple monkey dishwasher runs backwards seventeen'}},
  {id: 'spam-no-question', req: 'R3-spam', expect: 'reject', input: {questionText: 'I really enjoyed watching this video today thanks'}},
];

describe.skipIf(!hasKey)('Screening edge cases (live)', () => {
  it('meets the three product requirements', async () => {
    const service = new ScreeningService();
    const failures: string[] = [];

    console.log('\n════════ Edge-case suite ════════');
    for (const c of CASES) {
      const r = await service.screen(c.input);
      const ok =
        c.expect === 'pass' ? r.decision === 'pass'
        : c.expect === 'reject' ? r.decision === 'reject'
        : r.decision !== 'pass'; // blocked = reject or hold
      const icon = ok ? '✓' : '✗';
      console.log(`${icon}  ${c.id.padEnd(20)} [${c.req}] expect=${c.expect.padEnd(7)} got=${r.decision} (${r.reasonCode}, check=${r.check})`);
      if (!ok) failures.push(`${c.id}: expected ${c.expect}, got ${r.decision} (${r.reasonCode})`);
      await sleep(Number(process.env.SCREEN_SLEEP_MS ?? 2500)); // free-tier pacing (avoid 429-exhaustion skewing results)
    }
    console.log(`════════ ${CASES.length - failures.length}/${CASES.length} passed ════════\n`);

    expect(failures, failures.join('; ')).toEqual([]);
  }, 900_000);
});
