/**
 * Free, local pre-filters — catch obvious junk with zero LLM cost.
 * Ported from the prototype's `check_spam`. Returns a reason when it should be
 * rejected, or null to continue to the (paid) LLM checks.
 */
export interface LocalReject {
  reasonCode: 'too_short' | 'gibberish' | 'spam';
  message: string;
}

export function localSpamCheck(question: string): LocalReject | null {
  const q = (question || '').trim();

  if (q.length < 6) {
    return {reasonCode: 'too_short', message: 'Question is too short.'};
  }

  // Gibberish = mostly non-alphanumeric symbols. Count over non-space chars so
  // maths like "what is 10+10" (digits and +) is NOT flagged.
  const nonSpace = [...q].filter(c => !/\s/.test(c));
  const alnum = nonSpace.filter(c => /[a-z0-9]/i.test(c)).length;
  if (nonSpace.length && alnum / nonSpace.length < 0.5) {
    return {reasonCode: 'gibberish', message: 'Too many symbols — please rephrase.'};
  }

  if (!/[a-z]/i.test(q)) {
    return {reasonCode: 'gibberish', message: 'Please include words, not just numbers/symbols.'};
  }

  if (/(.)\1{5,}/.test(q)) {
    // 'aaaaaa', '!!!!!!'
    return {reasonCode: 'spam', message: 'Looks like spam (repeated characters).'};
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 2 && new Set(words).size === 1) {
    return {reasonCode: 'spam', message: 'Repeated single word.'};
  }

  return null;
}
