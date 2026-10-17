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
    return {
      reasonCode: 'too_short',
      message: 'Your question is too short. Please write it out as a full question so others can understand what you’re asking.',
    };
  }

  // Gibberish = mostly non-alphanumeric symbols. Count over non-space chars so
  // maths like "what is 10+10" (digits and +) is NOT flagged.
  const nonSpace = [...q].filter(c => !/\s/.test(c));
  const alnum = nonSpace.filter(c => /[a-z0-9]/i.test(c)).length;
  if (nonSpace.length && alnum / nonSpace.length < 0.5) {
    return {
      reasonCode: 'gibberish',
      message: 'Your question contains too many symbols to read. Please rewrite it as a plain, clear sentence.',
    };
  }

  if (!/[a-z]/i.test(q)) {
    return {
      reasonCode: 'gibberish',
      message: 'Your question needs actual words, not just numbers or symbols. Please rephrase it as a proper question.',
    };
  }

  if (/(.)\1{5,}/.test(q)) {
    // 'aaaaaa', '!!!!!!'
    return {
      reasonCode: 'spam',
      message: 'Your question looks like spam because a character is repeated many times. Please rewrite it as a real question.',
    };
  }

  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 2 && new Set(words).size === 1) {
    return {
      reasonCode: 'spam',
      message: 'Your question just repeats the same word. Please write a complete, meaningful question.',
    };
  }

  // Keyboard-row mashing ("asdf jkl qwerty zxcv"): reject when MOST words are
  // keyboard-row fragments. 4-char fragments avoid real words ("answer" contains
  // "wer" but no 4-char row run). Conservative: needs ≥2 words and >60% matching.
  const ROW_FRAGMENTS = /qwer|wert|erty|rtyu|tyui|yuio|uiop|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm/;
  const alphaWords = words.filter(w => /^[a-z]+$/.test(w) && w.length >= 3);
  if (alphaWords.length >= 2) {
    const mashed = alphaWords.filter(w => ROW_FRAGMENTS.test(w));
    if (mashed.length / alphaWords.length > 0.6) {
      return {
        reasonCode: 'gibberish',
        message: 'Your question looks like random typing. Please write a real question.',
      };
    }
  }

  return null;
}
