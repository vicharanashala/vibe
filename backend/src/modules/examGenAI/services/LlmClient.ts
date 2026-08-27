import { injectable, inject } from 'inversify';
import { modelForRole, MODEL_COST_PER_1K_TOKENS, ExamGenAIProvider } from '#root/config/examGenAI.js';
import { EXAM_GENAI_TYPES } from '../types.js';
import { AiApiLogRepository } from '../repositories/providers/mongodb/AiApiLogRepository.js';
import { getLlmProviderChain } from './llm/llmProviderFactory.js';
import { LlmRateLimitError } from './llm/LlmProvider.js';

/** Upper bound on how long a single rate-limit backoff will wait before
 *  giving up on that provider and moving to the next one — a provider
 *  asking for a multi-minute wait isn't "temporarily busy" in any sense
 *  worth blocking a whole generation iteration for. */
const RATE_LIMIT_WAIT_CAP_MS = 30000;

export class LlmClientError extends Error {
    constructor(message: string, readonly cause?: unknown) {
        super(message);
        this.name = 'LlmClientError';
    }
}

/** Which provider/model actually answered a call — QuestionGenerationService
 *  forwards this into each SSE progress event so the admin UI can show
 *  what's currently doing the work (and that MiniMax being down doesn't mean
 *  the whole job is stuck — it just means every call is landing on Groq). */
export interface LlmTextResult {
    text: string;
    provider: ExamGenAIProvider;
    model: string;
}

export interface LlmJsonResult {
    data: Record<string, unknown>;
    provider: ExamGenAIProvider;
    model: string;
}

/**
 * Strips <think>...</think> reasoning blocks. MiniMax-M3 (and other
 * reasoning-style models) prepend these before the actual answer — left in,
 * they can wreck both call shapes this module relies on: the judge's plain
 * `/keep/i` substring match can hit the word "keep" inside the model's own
 * deliberation regardless of its actual verdict, and reasoning prose that
 * happens to contain `{`/`}` (e.g. discussing JSON structure) can throw off
 * completeJson's brace-matching. Non-reasoning providers never emit these
 * tags, so this is a no-op for them.
 */
function stripThinking(raw: string): string {
    return raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
}

/**
 * Strips ```json fences (and any leading prose / trailing commas) and parses
 * the first balanced JSON object in the text. Mirrors
 * studentQuestions/services/screening/ScreeningLlm.ts's parseJsonObject —
 * kept as a local copy rather than a cross-module import so this module has
 * no dependency on studentQuestions (see the module boundary note in
 * index.ts).
 */
function parseJsonObject(raw: string): Record<string, unknown> {
    if (!raw) throw new LlmClientError('empty LLM response');
    let txt = raw.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
    const start = txt.indexOf('{');
    const end = txt.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new LlmClientError(`no JSON object in response: ${txt.slice(0, 120)}`);
    }
    txt = txt.slice(start, end + 1).replace(/,\s*([}\]])/g, '$1');
    try {
        return JSON.parse(txt) as Record<string, unknown>;
    } catch (e) {
        throw new LlmClientError('LLM returned invalid JSON', e);
    }
}

/**
 * Provider-agnostic entry point for this module's three call shapes
 * (generator, per-question judge, final judge). Delegates the actual HTTP
 * call to the configured provider chain (MiniMax-M3 → Groq → Anthropic by
 * default — see config/examGenAI.ts + llmProviderFactory.ts) and adds
 * everything that's provider-independent: automatic failover to the next
 * provider on any call failure, backoff-and-retry-same-provider on a 429,
 * retry-once on unparseable JSON, and spend logging to `aiApiLogs`.
 *
 * Throws LlmClientError only once every configured provider has failed —
 * QuestionGenerationService treats that as a real infra problem (its
 * consecutive-failure circuit breaker), distinct from a provider succeeding
 * but writing a bad/rejected question, which is normal Generate→Judge→Refine
 * churn, not an error.
 */
@injectable()
export class LlmClient {
    constructor(
        @inject(EXAM_GENAI_TYPES.AiApiLogRepo)
        private readonly logRepo: AiApiLogRepository,
    ) {}

    /** Free-text completion (used for the Keep/Remove judge, which returns a bare word, not JSON). */
    async completeText(
        endpoint: 'generator' | 'judge' | 'final_judge',
        system: string,
        prompt: string,
    ): Promise<LlmTextResult> {
        const chain = getLlmProviderChain();
        if (chain.length === 0) {
            throw new LlmClientError('No LLM provider is configured — set MINIMAX_API_KEY, GROQ_API_KEY, or ANTHROPIC_CRED');
        }
        const temperature = endpoint === 'judge' ? 0 : 0.7;

        let lastErr: unknown;
        for (const provider of chain) {
            const model = modelForRole(provider.name, endpoint);
            try {
                const result = await provider.complete(model, system, prompt, temperature, endpoint);
                void this.logUsage(endpoint, model, result.inputTokens, result.outputTokens);
                return { text: stripThinking(result.text), provider: provider.name, model };
            } catch (err) {
                if (err instanceof LlmRateLimitError) {
                    // Not an outage — this account's quota on this provider
                    // is temporarily exhausted (a single generator call with
                    // full course materials can burn through Groq's free-tier
                    // 8000 TPM cap on its own). Worth one backoff-and-retry on
                    // the SAME provider before writing it off — jumping
                    // straight to the next provider (or the circuit breaker)
                    // for what's really just normal throttling wastes the
                    // other providers' quota for no reason.
                    const waitMs = Math.min(RATE_LIMIT_WAIT_CAP_MS, err.retryAfterMs);
                    console.warn(`[LlmClient] ${endpoint} rate limited on ${provider.name}, waiting ${waitMs}ms then retrying it once:`, err.message);
                    await new Promise(resolve => setTimeout(resolve, waitMs));
                    try {
                        const result = await provider.complete(model, system, prompt, temperature, endpoint);
                        void this.logUsage(endpoint, model, result.inputTokens, result.outputTokens);
                        return { text: stripThinking(result.text), provider: provider.name, model };
                    } catch (err2) {
                        console.warn(`[LlmClient] ${endpoint} failed again on ${provider.name} after backoff, trying next provider:`, err2);
                        lastErr = err2;
                        continue;
                    }
                }
                console.warn(`[LlmClient] ${endpoint} call failed on ${provider.name}, trying next provider:`, err);
                lastErr = err;
            }
        }
        throw new LlmClientError(`${endpoint} call failed on every configured provider (${chain.map(p => p.name).join(', ')})`, lastErr);
    }

    /** JSON completion (generator + final judge). Walks the same provider
     *  failover chain as completeText, and separately retries once (on
     *  whichever provider it ultimately succeeded on) if the response can't
     *  be parsed as JSON even after fence-stripping — the model occasionally
     *  wraps its answer in prose despite instructions. */
    async completeJson(
        endpoint: 'generator' | 'judge' | 'final_judge',
        system: string,
        prompt: string,
    ): Promise<LlmJsonResult> {
        const result = await this.completeText(endpoint, system, prompt);
        try {
            return { data: parseJsonObject(result.text), provider: result.provider, model: result.model };
        } catch (parseErr) {
            console.warn(`[LlmClient] ${endpoint} JSON parse failed, retrying once:`, parseErr);
            const retry = await this.completeText(
                endpoint,
                system,
                `${prompt}\n\nYour previous reply could not be parsed as JSON. Reply again with ONLY the raw JSON object — no markdown fences, no prose before or after it.`,
            );
            return { data: parseJsonObject(retry.text), provider: retry.provider, model: retry.model };
        }
    }

    private async logUsage(
        endpoint: 'generator' | 'judge' | 'final_judge',
        model: string,
        inputTokens: number,
        outputTokens: number,
    ): Promise<void> {
        const rate = MODEL_COST_PER_1K_TOKENS[model];
        const costEstimate = rate
            ? (inputTokens / 1000) * rate.input + (outputTokens / 1000) * rate.output
            : 0;
        try {
            await this.logRepo.log({ endpoint, model, inputTokens, outputTokens, costEstimate, createdAt: Date.now() });
        } catch (err) {
            // Spend logging must never take down generation.
            console.warn('[LlmClient] failed to write ai_api_logs entry:', err);
        }
    }
}
