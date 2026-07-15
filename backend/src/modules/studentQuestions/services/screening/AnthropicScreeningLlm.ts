import {Anthropic} from '@anthropic-ai/sdk';
import {screeningConfig} from '#root/config/screening.js';
import {
  ScreeningLlm,
  ScreeningLlmError,
  ModelTier,
  parseJsonObject,
} from './ScreeningLlm.js';

/**
 * Anthropic (Claude) implementation — the intended production path (reuses the
 * SDK already in the project). Enabled by SCREENING_PROVIDER=anthropic.
 *
 * The prompts already instruct "reply ONLY with JSON"; we set a tiny system
 * prompt reinforcing that and parse defensively (JSON schema is enforced by the
 * shared verdict validators upstream). Timeout + retries via the SDK.
 */
export class AnthropicScreeningLlm implements ScreeningLlm {
  readonly provider = 'anthropic';
  readonly model = screeningConfig.anthropic.model;

  modelFor(tier: ModelTier): string {
    return tier === 'fast'
      ? screeningConfig.anthropic.fastModel
      : screeningConfig.anthropic.model;
  }

  async askJson(
    prompt: string,
    tier: ModelTier = 'reasoning',
  ): Promise<Record<string, unknown>> {
    const {apiKey} = screeningConfig.anthropic;
    if (!apiKey) throw new ScreeningLlmError('ANTHROPIC_CRED not set');

    const client = new Anthropic({apiKey});
    try {
      const res = await client.messages.create(
        {
          model: this.modelFor(tier),
          max_tokens: 400,
          temperature: 0,
          system: 'You are a strict screening classifier. Reply with ONLY a single JSON object — no prose, no code fences.',
          messages: [{role: 'user', content: [{type: 'text', text: prompt}]}],
        },
        {timeout: screeningConfig.timeoutMs, maxRetries: screeningConfig.maxRetries},
      );
      const text = res.content?.map(c => ('text' in c ? c.text : '')).join('') ?? '';
      return parseJsonObject(text);
    } catch (err) {
      if (err instanceof ScreeningLlmError) throw err;
      throw new ScreeningLlmError('anthropic call failed', err);
    }
  }
}
