import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm} from './ScreeningLlm.js';
import {GroqScreeningLlm} from './GroqScreeningLlm.js';
import {AnthropicScreeningLlm} from './AnthropicScreeningLlm.js';
import {MinimaxScreeningLlm} from './MinimaxScreeningLlm.js';

/** Pick the screening LLM implementation from config (default: minimax). */
export function createScreeningLlm(): ScreeningLlm {
  switch (screeningConfig.provider) {
    case 'anthropic':
      return new AnthropicScreeningLlm();
    case 'groq':
      return new GroqScreeningLlm();
    default:
      return new MinimaxScreeningLlm();
  }
}
