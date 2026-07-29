/**
 * Provider-agnostic LLM boundary for the screening filter.
 *
 * A single method: send a prompt, get back parsed JSON. Implementations force
 * JSON output, enforce a hard timeout, and retry transient/rate-limit errors.
 * The screening service never touches a provider SDK directly, so swapping
 * Groq (demo) → Anthropic (prod) is a one-line factory change.
 */
export interface ScreeningLlm {
  /** The concrete model id in use (for logging / verdict provenance). */
  readonly model: string;
  readonly provider: string;
  /** Send `prompt`, return the model's response parsed as a JSON object. Throws on failure. */
  askJson(prompt: string): Promise<Record<string, unknown>>;
}

/** Thrown when the provider is unreachable/fails after retries — callers fail-closed. */
export class ScreeningLlmError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ScreeningLlmError';
  }
}

/**
 * Extract the first balanced JSON object from raw model text and parse it.
 * Defensive: tolerates ```json fences, leading prose, and trailing commas.
 */
export function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw) throw new ScreeningLlmError('empty LLM response');
  let txt = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  const start = txt.indexOf('{');
  const end = txt.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    throw new ScreeningLlmError(`no JSON object in response: ${txt.slice(0, 120)}`);
  }
  txt = txt.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1'); // strip trailing commas
  try {
    return JSON.parse(txt) as Record<string, unknown>;
  } catch (e) {
    throw new ScreeningLlmError('LLM returned invalid JSON', e);
  }
}
