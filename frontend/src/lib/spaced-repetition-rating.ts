/**
 * Knob 8b (Phase D prep, 2026-07-22) — honest quality gating on MCQs.
 *
 * After Knob 8, the review screen shows green/red feedback for selected MCQ
 * options. But the three rate buttons (`Got it` / `Unsure` / `Missed`)
 * remained enabled regardless of correctness, which meant a student who
 * picked a wrong option could still tap `Got it` and SM-2 would record
 * q=5 — a corrupt confidence signal that inflated EF and pushed the next
 * review out by days.
 *
 * This helper gates only `Got it`. When the student's MCQ pick was
 * definitively wrong (`isCorrect === false` on the last response), the
 * `Got it` button is disabled and the keyboard `1` shortcut is a no-op.
 *
 * Why `Missed` stays enabled on right picks, and `Unsure` always:
 *   `Unsure` — honest under-confidence is a real signal even after a
 *     right pick ("I got it but I'm not sure I'll remember next week").
 *   `Missed` — a student who got it right but doesn't trust the feedback
 *     (e.g. thinks the green was wrong) should be able to over-rate. The
 *     honesty gain from allowing this outweighs the consistency cost.
 *
 * `Unsure` is mapped to keyboard `2`, `Missed` to keyboard `3`; those
 * shortcuts are never gated by this helper.
 *
 * Pure function. No React, no side effects. Easy to unit-test.
 */

/** Question-type discriminator used inside `ReviewSession.tsx`. */
export type McqQuestionType =
  | 'SELECT_ONE_IN_LOT'
  | 'SELECT_MANY_IN_LOT'
  | 'NUMERIC_ANSWER';

/**
 * Whether the `Got it` rate button should be enabled.
 *
 * @param questionType  `SELECT_ONE_IN_LOT` / `SELECT_MANY_IN_LOT` / `NUMERIC_ANSWER`.
 *   NUMERIC_ANSWER has no green/red feedback, so the gate never applies
 *   there — we return `true` (always allowed).
 * @param isCorrect  Result of the most recent server-side MCQ correctness
 *   evaluation. `true` = student picked right. `false` = student picked
 *   wrong. `undefined` = not applicable (numeric/descriptive, no selection
 *   sent, or backend fail-open) — we return `true` (no gate).
 * @returns `false` only when the question is MCQ AND the student's pick
 *   was definitively wrong. All other combinations return `true`.
 */
export function canRateAsGotIt(
  questionType: McqQuestionType | string | undefined,
  isCorrect: boolean | undefined,
): boolean {
  // No MCQ correctness to gate against → always allow.
  if (isCorrect !== false) return true;
  // isCorrect === false. Gate applies only on MCQ types; numeric/descriptive
  // questions don't have green/red feedback, so this branch shouldn't
  // realistically fire for them (the backend wouldn't set isCorrect=false
  // on a NAT), but we guard defensively to avoid surprising the UI.
  if (questionType === 'NUMERIC_ANSWER') return true;
  return false;
}

/**
 * Test cases (no Jest/Vitest installed in frontend; covered manually in
 * `test.md` §Knob 8b smoke test):
 *
 *   1. canRateAsGotIt('SELECT_ONE_IN_LOT', false)  === false  ← THE GATE
 *      (wrong pick → Got it disabled)
 *   2. canRateAsGotIt('SELECT_MANY_IN_LOT', false) === false  ← THE GATE
 *      (SML wrong pick → Got it disabled)
 *   3. canRateAsGotIt('SELECT_ONE_IN_LOT', true)   === true   (right pick,
 *      Got it allowed — natural choice)
 *   4. canRateAsGotIt('SELECT_MANY_IN_LOT', true)  === true   (right pick)
 *   5. canRateAsGotIt('SELECT_ONE_IN_LOT', undefined) === true (no feedback
 *      yet, e.g. question just loaded — Got it allowed subject to the
 *      existing "answered first" gate from Knob 8)
 *   6. canRateAsGotIt('NUMERIC_ANSWER', false)     === true   (defensive
 *      — NAT shouldn't carry isCorrect=false, but if it did, no gate)
 *   7. canRateAsGotIt('NUMERIC_ANSWER', undefined) === true   (NAT default)
 *   8. canRateAsGotIt(undefined, false)             === false  (unknown
 *      type but isCorrect=false — defensive; gate fires, button disabled.
 *      Safe because the surrounding render only calls us when a question
 *      is loaded.)
 *   9. canRateAsGotIt(undefined, undefined)         === true   (no question
 *      loaded — should never hit the JSX, but pure function returns true)
 */
