import { Anthropic } from '@anthropic-ai/sdk';
import { examGenAIConfig } from '#root/config/examGenAI.js';
import { LlmProvider, LlmCallResult, LlmProviderError, LlmRateLimitError } from './LlmProvider.js';

/** Same fallback used by GroqProvider's `parseRetryAfterMs` when a provider
 *  gives no usable `retry-after` header. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 5000;

/** Fallback/alt provider — see AnthropicClient's original implementation
 *  this was extracted from, and studentQuestions/services/screening/
 *  AnthropicScreeningLlm.ts for the same pattern used elsewhere in this app. */
export class AnthropicProvider implements LlmProvider {
    readonly name = 'anthropic' as const;

    async complete(model: string, system: string, prompt: string, temperature: number): Promise<LlmCallResult> {
        const { apiKey } = examGenAIConfig.anthropic;
        if (!apiKey) throw new LlmProviderError('ANTHROPIC_CRED is not set');

        try {
            const client = new Anthropic({ apiKey });
            const res = await client.messages.create(
                {
                    model,
                    max_tokens: 1024,
                    temperature,
                    system,
                    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
                },
                { timeout: examGenAIConfig.timeoutMs, maxRetries: 0 },
            );
            const text = res.content?.map(c => ('text' in c ? c.text : '')).join('') ?? '';
            return {
                text,
                inputTokens: res.usage?.input_tokens ?? 0,
                outputTokens: res.usage?.output_tokens ?? 0,
            };
        } catch (err) {
            if (err instanceof LlmProviderError) throw err;
            // Unlike Groq/MiniMax (each a raw `fetch` checking `res.status ===
            // 429` directly), every Anthropic call went through the generic
            // `catch` below and got wrapped as a plain LlmProviderError —
            // even a 429. That skipped LlmClient's rate-limit
            // backoff-and-retry entirely, sending a plain throttling response
            // straight to the failover chain / consecutive-failure circuit
            // breaker instead.
            if (err instanceof Anthropic.RateLimitError) {
                const retryAfterHeader = err.headers?.get?.('retry-after');
                const retryAfterMs =
                    retryAfterHeader && /^\d+(\.\d+)?$/.test(retryAfterHeader.trim())
                        ? Math.round(parseFloat(retryAfterHeader) * 1000)
                        : DEFAULT_RATE_LIMIT_WAIT_MS;
                throw new LlmRateLimitError(`Anthropic rate limited: ${err.message}`, retryAfterMs, err);
            }
            throw new LlmProviderError('Anthropic call failed', err);
        }
    }
}
