import { examGenAIConfig, ExamGenAIProvider } from '#root/config/examGenAI.js';
import { LlmProvider } from './LlmProvider.js';
import { MiniMaxProvider } from './MiniMaxProvider.js';
import { GroqProvider } from './GroqProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';

const CONSTRUCTORS: Record<ExamGenAIProvider, () => LlmProvider> = {
    minimax: () => new MiniMaxProvider(),
    groq: () => new GroqProvider(),
    anthropic: () => new AnthropicProvider(),
};

function isConfigured(provider: ExamGenAIProvider): boolean {
    if (provider === 'minimax') return !!examGenAIConfig.minimax.apiKey;
    if (provider === 'groq') return !!examGenAIConfig.groq.apiKey;
    return !!examGenAIConfig.anthropic.apiKey;
}

let cachedChain: LlmProvider[] | null = null;

/**
 * Builds the ordered failover chain from EXAM_GENAI_PROVIDER_ORDER (default
 * "minimax,groq,anthropic"), dropping any provider whose API key isn't set —
 * so an unconfigured backup is silently skipped rather than attempted and
 * failing. LlmClient walks this chain per call, stopping at the first
 * provider that succeeds (see LlmClient.completeText).
 */
export function getLlmProviderChain(): LlmProvider[] {
    if (cachedChain) return cachedChain;
    cachedChain = examGenAIConfig.providerOrder.filter(isConfigured).map(p => CONSTRUCTORS[p]());
    return cachedChain;
}
