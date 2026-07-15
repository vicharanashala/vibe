/**
 * Live demo runner for the screening filter — for showing it works, by hand.
 *
 * Runs the REAL provider (Groq). Two modes:
 *   1. Your own question via env vars (SCREEN_Q, …) — screens just that one.
 *   2. No env → a curated "demo reel" covering every outcome.
 *
 * PowerShell:
 *   $env:SCREEN_Q="describe ai"; $env:SCREEN_EXISTING="what is the meaning of ai"
 *   npx vitest run src/modules/studentQuestions/tests/screening.demo.test.ts
 *
 *   # or just the reel:
 *   npx vitest run src/modules/studentQuestions/tests/screening.demo.test.ts
 *
 * (Requires GROQ_API_KEY in backend/.env.)
 */
import {describe, it} from 'vitest';
import {ScreeningService, ScreeningInput} from '../services/screening/ScreeningService.js';

const hasKey = !!process.env.GROQ_API_KEY || !!process.env.ANTHROPIC_CRED;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

function fromEnv(): ScreeningInput | null {
  const q = process.env.SCREEN_Q;
  if (!q) return null;
  return {
    questionText: q,
    options: process.env.SCREEN_OPTS ? process.env.SCREEN_OPTS.split(',').map(s => s.trim()) : undefined,
    correctOptionIndex: process.env.SCREEN_CORRECT ? Number(process.env.SCREEN_CORRECT) : undefined,
    context: process.env.SCREEN_CONTEXT || undefined,
    existingQuestions: process.env.SCREEN_EXISTING ? process.env.SCREEN_EXISTING.split('|').map(s => s.trim()) : undefined,
  };
}

const AI_CTX = 'Introduction to Artificial Intelligence — what AI is, machine learning, neural networks, training data.';

const REEL: {label: string; input: ScreeningInput}[] = [
  {label: 'clean, unique, on-topic', input: {questionText: 'what is supervised learning in machine learning', context: AI_CTX, existingQuestions: ['what is ai']}},
  {label: 'gibberish', input: {questionText: 'r5ytrwe5twe45tw3456tw4'}},
  {label: 'vague', input: {questionText: 'explain'}},
  {label: 'duplicate (no word overlap)', input: {questionText: 'at what temperature does water start to boil', existingQuestions: ['what is the boiling point of water', 'who discovered gravity']}},
  {label: 'shared words but NOT duplicate', input: {questionText: 'who invented ai', existingQuestions: ['what is ai'], context: AI_CTX}},
  {label: 'off-topic', input: {questionText: 'what is the offside rule in football', context: AI_CTX}},
  {label: 'wrong marked answer', input: {questionText: 'what is the capital of japan', options: ['Tokyo', 'Beijing', 'Seoul', 'Osaka'], correctOptionIndex: 1}},
];

function print(label: string, input: ScreeningInput, r: Awaited<ReturnType<ScreeningService['screen']>>) {
  const icon = r.decision === 'pass' ? '🟢' : r.decision === 'hold' ? '🟡' : '🔴';
  console.log(`\n${icon} ${r.decision.toUpperCase()}  —  ${label}`);
  console.log(`   Q: ${input.questionText}`);
  if (input.existingQuestions?.length) console.log(`   vs existing: ${input.existingQuestions.join(' | ')}`);
  console.log(`   reason: ${r.reasonCode}  (check: ${r.check})`);
  console.log(`   message: ${r.message}`);
  if (r.matchQuestion) console.log(`   matched: "${r.matchQuestion}"`);
  console.log(`   [${r.provider}/${r.model}, ${r.latencyMs}ms]`);
}

describe.skipIf(!hasKey)('Screening demo (live)', () => {
  it('screens a question (or the demo reel)', async () => {
    const service = new ScreeningService();
    const custom = fromEnv();

    if (custom) {
      print('your question', custom, await service.screen(custom));
      return;
    }

    console.log('\n════════ Screening demo reel ════════');
    for (const c of REEL) {
      print(c.label, c.input, await service.screen(c.input));
      await sleep(1000); // pace under free-tier limits
    }
    console.log('\n═════════════════════════════════════\n');
  }, 180_000);
});
