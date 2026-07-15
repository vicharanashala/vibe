import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm, ScreeningLlmError} from './ScreeningLlm.js';
import {GroqScreeningLlm} from './GroqScreeningLlm.js';
import {AnthropicScreeningLlm} from './AnthropicScreeningLlm.js';
import {GeminiScreeningLlm} from './GeminiScreeningLlm.js';
import {FallbackScreeningLlm} from './FallbackScreeningLlm.js';
import {RateLimitedScreeningLlm} from './RateLimitedScreeningLlm.js';

function one(name: string): ScreeningLlm {
  switch (name.trim().toLowerCase()) {
    case 'anthropic':
      return new AnthropicScreeningLlm();
    case 'gemini':
      return new GeminiScreeningLlm();
    case 'groq':
      return new GroqScreeningLlm();
    default:
      throw new ScreeningLlmError(`unknown screening provider: "${name}"`);
  }
}

/**
 * Build the screening LLM from config.
 *
 * `SCREENING_PROVIDER` takes a single name ("groq") or a comma-separated FALLBACK
 * CHAIN ("groq,gemini"). A chain matters because rate limits are per-vendor: two
 * vendors' free quotas add up, so a burst that exhausts the first spills into the
 * second rather than degrading every submission to a manual-review hold.
 */
export function createScreeningLlm(): ScreeningLlm {
  const names = screeningConfig.provider
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  // Pace each provider independently: a fallback chain's whole point is that each
  // vendor has its OWN budget, so each gets its own bucket. The fallback then trips
  // only on a real outage, not on a queue we could have waited out.
  const providers = names.map(n => new RateLimitedScreeningLlm(one(n)));
  return providers.length === 1 ? providers[0] : new FallbackScreeningLlm(providers);
}
