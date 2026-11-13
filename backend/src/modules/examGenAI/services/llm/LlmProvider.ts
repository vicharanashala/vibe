/**
 * Provider-agnostic LLM boundary, same idea as
 * studentQuestions/services/screening/ScreeningLlm.ts's provider interface —
 * QuestionGenerationService/LlmClient never touch a provider SDK/API
 * directly, so switching MiniMax (default) <-> Anthropic (fallback) is a
 * config change, not a code change (see llmProviderFactory.ts).
 */
export interface LlmCallResult {
    text: string;
    inputTokens: number;
    outputTokens: number;
}

export interface LlmProvider {
    readonly name: 'minimax' | 'groq' | 'anthropic';
    /** `endpoint` is a hint, not a contract — most providers ignore it.
     *  MiniMaxProvider uses it to disable its `<think>` reasoning mode for
     *  the `judge` role (a one-word Keep/Remove classification that doesn't
     *  need it), since that reasoning was observed occasionally consuming
     *  the model's entire response budget with no answer left over. */
    complete(model: string, system: string, prompt: string, temperature: number, endpoint?: 'generator' | 'judge' | 'final_judge'): Promise<LlmCallResult>;
}

/** Thrown when the provider is unreachable/fails — callers (LlmClient) move to the next provider in the chain. */
export class LlmProviderError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = 'LlmProviderError';
    }
}

/**
 * Thrown specifically for HTTP 429 (rate limited), with how long the
 * provider says to wait. This is NOT the same failure class as a real outage
 * (502/timeout/etc) — the provider is fine, it's just this account's quota
 * that's temporarily exhausted, so LlmClient backs off and retries the SAME
 * provider once instead of immediately burning through the failover chain
 * and the circuit breaker on what's really just normal throttling (observed
 * on Groq's free tier: an 8000 TPM cap that a single generator call with
 * full course materials can nearly exhaust on its own).
 */
export class LlmRateLimitError extends LlmProviderError {
    constructor(message: string, readonly retryAfterMs: number, cause?: unknown) {
        super(message, cause);
        this.name = 'LlmRateLimitError';
    }
}

/** Extracts a wait duration from a 429 response: the standard `Retry-After`
 *  header first (seconds, or an HTTP-date — only the seconds form is
 *  handled since that's what every provider seen so far sends), falling
 *  back to parsing "...try again in 24.8s" out of the response body (Groq's
 *  shape). Defaults to 5s if neither is present, since *some* backoff before
 *  retrying a 429 is always safer than none. Capped by the caller. */
export function parseRetryAfterMs(res: Response, bodyText: string): number {
    const header = res.headers.get('retry-after');
    if (header && /^\d+(\.\d+)?$/.test(header.trim())) {
        return Math.round(parseFloat(header) * 1000);
    }
    const match = bodyText.match(/try again in\s+([\d.]+)\s*s/i);
    if (match) return Math.round(parseFloat(match[1]) * 1000);
    return 5000;
}
