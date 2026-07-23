import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm} from './ScreeningLlm.js';
import {GroqScreeningLlm} from './GroqScreeningLlm.js';
import {AnthropicScreeningLlm} from './AnthropicScreeningLlm.js';

/** Pick the screening LLM implementation from config (demo: groq, prod: anthropic). */
export function createScreeningLlm(): ScreeningLlm {
  return screeningConfig.provider === 'anthropic'
    ? new AnthropicScreeningLlm()
    : new GroqScreeningLlm();
}
