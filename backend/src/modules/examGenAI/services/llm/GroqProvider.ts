import { examGenAIConfig } from '#root/config/examGenAI.js';
import { LlmProvider, LlmCallResult, LlmProviderError, LlmRateLimitError, parseRetryAfterMs } from './LlmProvider.js';

/**
 * Backup provider — Groq's OpenAI-compatible chat/completions API. Used as
 * automatic failover when MiniMax-M3 (the primary) fails a call (see
 * llmProviderFactory.ts's provider chain). No shared-slot rate limiting here
 * (unlike MiniMaxProvider) since this is a normal per-account Groq key, not
 * a shared team slot with a published RPS/concurrency cap.
 */
export class GroqProvider implements LlmProvider {
    readonly name = 'groq' as const;

    async complete(model: string, system: string, prompt: string, temperature: number): Promise<LlmCallResult> {
        const { apiKey, baseUrl } = examGenAIConfig.groq;
        if (!apiKey) throw new LlmProviderError('GROQ_API_KEY is not set');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), examGenAIConfig.timeoutMs);
        try {
            const res = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({
                    model,
                    temperature,
                    max_tokens: 4096,
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: prompt },
                    ],
                }),
                signal: controller.signal,
            });

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                if (res.status === 429) {
                    throw new LlmRateLimitError(
                        `Groq rate limited: ${body.slice(0, 300)}`,
                        parseRetryAfterMs(res, body),
                    );
                }
                throw new LlmProviderError(`Groq call failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`);
            }

            const data: any = await res.json();
            const text = data?.choices?.[0]?.message?.content ?? '';
            const inputTokens = data?.usage?.prompt_tokens ?? 0;
            const outputTokens = data?.usage?.completion_tokens ?? 0;
            return { text, inputTokens, outputTokens };
        } catch (err) {
            if (err instanceof LlmProviderError) throw err;
            throw new LlmProviderError('Groq call failed', err);
        } finally {
            clearTimeout(timeout);
        }
    }
}
