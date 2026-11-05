/**
 * Extract JSON from a chat model's reply.
 *
 * MiniMax has no documented JSON mode, and its reasoning models may emit a
 * <think>…</think> block before the answer. This strips that block and any
 * ```json fences, then parses the first balanced object or array.
 */
export class ModelJsonError extends Error {}

export function parseModelJson(raw: string): unknown {
  if (!raw || !raw.trim()) throw new ModelJsonError('empty model response');

  const text = stripReasoning(raw)
    .replace(/```(?:json)?/gi, '')
    .trim();

  const start = text.search(/[[{]/);
  if (start === -1) {
    throw new ModelJsonError(
      `no JSON in model response: ${text.slice(0, 120)}`,
    );
  }
  const candidate = balancedSlice(text, start);
  if (!candidate) {
    throw new ModelJsonError(
      'model response JSON is incomplete (likely truncated)',
    );
  }
  try {
    return JSON.parse(candidate.replace(/,\s*([}\]])/g, '$1'));
  } catch (error) {
    throw new ModelJsonError(
      `model returned invalid JSON: ${(error as Error).message}`,
    );
  }
}

/**
 * Drop <think>…</think> blocks; an unterminated block drops the rest. Plain
 * index scanning, since a lazy regex over many unclosed tags is quadratic.
 */
function stripReasoning(raw: string): string {
  const lower = raw.toLowerCase();
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const open = lower.indexOf('<think>', i);
    if (open === -1) {
      out += raw.slice(i);
      break;
    }
    out += raw.slice(i, open);
    const close = lower.indexOf('</think>', open + 7);
    if (close === -1) break;
    i = close + 8;
  }
  return out;
}

/** The substring from `start` to its matching closing bracket, string-aware. */
function balancedSlice(text: string, start: number): string | null {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{' || ch === '[') stack.push(ch === '{' ? '}' : ']');
    else if (ch === '}' || ch === ']') {
      if (stack.pop() !== ch) return null;
      if (stack.length === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}
