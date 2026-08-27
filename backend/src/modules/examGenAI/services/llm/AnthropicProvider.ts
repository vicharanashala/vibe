import { Anthropic } from '@anthropic-ai/sdk';
import { examGenAIConfig } from '#root/config/examGenAI.js';
import { LlmProvider, LlmCallResult, LlmProviderError } from './LlmProvider.js';

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
            throw new LlmProviderError('Anthropic call failed', err);
        }
    }
}
