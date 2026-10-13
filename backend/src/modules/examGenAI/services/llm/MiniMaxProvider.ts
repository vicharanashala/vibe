import { examGenAIConfig } from '#root/config/examGenAI.js';
import { LlmProvider, LlmCallResult, LlmProviderError, LlmRateLimitError, parseRetryAfterMs } from './LlmProvider.js';
import { RateLimiter } from './RateLimiter.js';

/**
 * MiniMax-M3, served OpenAI-compatible chat/completions style (this team's
 * shared vLLM slot at https://api.minimax.io — see the dashboard: "10 RPS
 * per user · 9 cap"). One process-wide RateLimiter enforces both caps
 * client-side so this module degrades to queueing its own calls instead of
 * hammering the shared slot into 429s.
 */
export class MiniMaxProvider implements LlmProvider {
    readonly name = 'minimax' as const;

    // Shared across every MiniMaxProvider instance (there's only ever one,
    // via DI singleton scope, but module-level keeps the cap correct even if
    // that ever changes) — the RPS/concurrency limit is per API key, not per
    // instance.
    private static limiter = new RateLimiter(
        examGenAIConfig.minimax.maxConcurrent,
        examGenAIConfig.minimax.maxRps,
    );

    // The shared proxy (samagama.in) intermittently drops the connection
    // mid-response — observed as either a raw HTTP body that cuts off
    // mid-JSON ("Unterminated string in JSON at position N") or a 200 with
    // an empty `choices[0].message.content`. Neither is a real answer from
    // the model, so both are worth one same-provider retry before failing
    // over to the next provider in the chain — MiniMax otherwise never gets
    // a fair shot at carrying a whole job whenever this transient blip hits.
    // 429s are NOT retried here — LlmClient already owns backoff-and-retry
    // for rate limits, using the provider's own Retry-After.
    private static readonly MAX_ATTEMPTS = 3;
    private static readonly RETRY_BASE_MS = 800;

    async complete(
        model: string,
        system: string,
        prompt: string,
        temperature: number,
        endpoint?: 'generator' | 'judge' | 'final_judge',
    ): Promise<LlmCallResult> {
        const { apiKey, baseUrl } = examGenAIConfig.minimax;
        if (!apiKey) throw new LlmProviderError('MINIMAX_API_KEY is not set');

        // Originally this only disabled thinking for `judge` (a one-word
        // classification with no real need for it), keeping it enabled for
        // `generator`/`final_judge` on the theory they benefit from M3's
        // multi-step reasoning. In practice, observed live: the generator
        // call — this module's own course-materials + few-shot prompt is
        // long and detailed — CONSISTENTLY exhausted the full 8192-token
        // budget on <think> reasoning across repeated attempts and never
        // reached the JSON answer at all, not an occasional edge case.
        // Raising max_tokens further only makes a failing call slower, not
        // more likely to succeed. Disabling thinking for every role trades
        // whatever quality boost M3's exposed reasoning might otherwise
        // give for actually getting an answer back, reliably and in ~1-2s
        // (confirmed via direct API test) instead of failing over to Groq's
        // exhausted daily quota after minutes of retries.
        const disableThinking = true;

        const release = await MiniMaxProvider.limiter.acquire();
        try {
            let lastErr: unknown;
            for (let attempt = 1; attempt <= MiniMaxProvider.MAX_ATTEMPTS; attempt++) {
                try {
                    return await this.attemptOnce(model, system, prompt, temperature, apiKey, baseUrl, disableThinking);
                } catch (err) {
                    if (err instanceof LlmRateLimitError) throw err;
                    lastErr = err;
                    if (attempt < MiniMaxProvider.MAX_ATTEMPTS) {
                        console.warn(`[MiniMaxProvider] attempt ${attempt}/${MiniMaxProvider.MAX_ATTEMPTS} failed, retrying:`, (err as Error)?.message ?? err);
                        await new Promise(resolve => setTimeout(resolve, MiniMaxProvider.RETRY_BASE_MS * attempt));
                    }
                }
            }
            if (lastErr instanceof LlmProviderError) throw lastErr;
            throw new LlmProviderError('MiniMax call failed after retries', lastErr);
        } finally {
            release();
        }
    }

    private async attemptOnce(
        model: string,
        system: string,
        prompt: string,
        temperature: number,
        apiKey: string,
        baseUrl: string,
        disableThinking: boolean,
    ): Promise<LlmCallResult> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), examGenAIConfig.timeoutMs);
        try {
            const res = await fetch(`${baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    temperature,
                    // Confirmed via direct API test: MiniMax honors this
                    // (NOT the OpenAI-style `enable_thinking` flag, which it
                    // silently ignores) — a disabled-thinking call returns
                    // reasoning_tokens: 0 and the answer directly, no
                    // <think> block at all.
                    ...(disableThinking ? { thinking: { type: 'disabled' } } : {}),
                    // M3 is a reasoning model — it spends tokens on a
                    // <think>...</think> block (stripped by LlmClient)
                    // before its actual answer. 4096 was not enough: for
                    // this module's generator/judge prompts (full course
                    // materials + few-shot examples), M3 was observed
                    // spending the ENTIRE budget on reasoning, closing
                    // </think> right at the token limit and never emitting
                    // the actual answer — stripThinking() then correctly
                    // strips the closed-but-empty-after think block, and
                    // LlmClient sees a genuinely empty response (not a
                    // truncation/parse error, so the attemptOnce retry logic
                    // above never saw a reason to retry it). Large headroom
                    // fixes this at the source rather than chasing the
                    // symptom downstream.
                    max_tokens: 8192,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt },
                    ],
                }),
                signal: controller.signal,
            });

            const bodyText = await res.text().catch(() => '');

            if (!res.ok) {
                if (res.status === 429) {
                    throw new LlmRateLimitError(
                        `MiniMax rate limited: ${bodyText.slice(0, 300)}`,
                        parseRetryAfterMs(res, bodyText),
                    );
                }
                throw new LlmProviderError(`MiniMax call failed: ${res.status} ${res.statusText} — ${bodyText.slice(0, 300)}`);
            }

            let data: any;
            try {
                data = JSON.parse(bodyText);
            } catch (parseErr) {
                // The proxy cut the connection mid-stream — this is a
                // malformed HTTP body, not the model's fault. Retryable.
                throw new LlmProviderError(`MiniMax returned a truncated/malformed response body (${bodyText.length} bytes)`, parseErr);
            }

            const text = data?.choices?.[0]?.message?.content ?? '';
            if (!text) {
                // A 200 with no content is the other shape this proxy fails
                // in — also worth a retry rather than treating it as the
                // model's real (empty) answer.
                throw new LlmProviderError('MiniMax returned an empty completion');
            }
            // Same failure as above, one level deeper: the model spent its
            // whole budget on <think>...</think> reasoning and closed the
            // tag with nothing left over for the real answer. LlmClient's
            // stripThinking() would reduce this to an empty string further
            // up the chain — catch it here instead, where a retry (a fresh
            // sampling pass, possibly reasoning more concisely) is still an
            // option instead of just failing over to Groq's exhausted quota.
            if (!text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()) {
                throw new LlmProviderError('MiniMax spent the entire token budget on <think> reasoning with no answer left over');
            }
            const inputTokens = data?.usage?.prompt_tokens ?? 0;
            const outputTokens = data?.usage?.completion_tokens ?? 0;
            return { text, inputTokens, outputTokens };
        } catch (err) {
            if (err instanceof LlmProviderError || err instanceof LlmRateLimitError) throw err;
            throw new LlmProviderError('MiniMax call failed', err);
        } finally {
            clearTimeout(timeout);
        }
    }
}
