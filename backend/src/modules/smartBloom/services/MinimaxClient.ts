import {injectable} from 'inversify';
import {smartBloomConfig} from '#root/config/smartBloom.js';
import {parseModelJson} from '../utils/ModelJson.js';

export class MinimaxError extends Error {
  constructor(
    message: string,
    readonly retriable = false,
  ) {
    super(message);
  }
}

/**
 * MiniMax chat-completions client for the Smart Bloom direct path
 * (OpenAI-compatible endpoint). Separate from the screening client because
 * question generation needs a much longer deadline than a screening check.
 */
@injectable()
export class MinimaxClient {
  isConfigured(): boolean {
    return Boolean(smartBloomConfig.minimax.apiKey);
  }

  /** Send one prompt and parse the JSON the model returns. */
  async askJson(
    system: string,
    user: string,
    maxTokens = 8000,
  ): Promise<unknown> {
    const {apiKey, url, model} = smartBloomConfig.minimax;
    if (!apiKey)
      throw new MinimaxError('MINIMAX_API_KEY is not set on the server');

    const body = JSON.stringify({
      model,
      messages: [
        {role: 'system', content: system},
        {role: 'user', content: user},
      ],
      temperature: 0.4,
      max_tokens: maxTokens,
    });

    let lastError: unknown;
    for (
      let attempt = 0;
      attempt <= smartBloomConfig.llmMaxRetries;
      attempt++
    ) {
      const controller = new AbortController();
      const timer = setTimeout(
        () => controller.abort(),
        smartBloomConfig.llmTimeoutMs,
      );
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body,
          signal: controller.signal,
        });
        if (res.status === 429 || res.status >= 500) {
          throw new MinimaxError(`MiniMax is busy (HTTP ${res.status})`, true);
        }
        if (!res.ok) {
          throw new MinimaxError(
            `MiniMax rejected the request (HTTP ${res.status}): ${(await res.text()).slice(0, 200)}`,
          );
        }
        const json = (await res.json()) as any;
        // MiniMax reports some failures inside a 200 response.
        const statusCode = json?.base_resp?.status_code;
        if (statusCode && statusCode !== 0) {
          throw new MinimaxError(
            `MiniMax error ${statusCode}: ${json?.base_resp?.status_msg ?? 'unknown'}`,
          );
        }
        const content: string = json?.choices?.[0]?.message?.content ?? '';
        return parseModelJson(content);
      } catch (error) {
        lastError = error;
        const retriable =
          (error as Error)?.name === 'AbortError' ||
          (error instanceof MinimaxError && error.retriable);
        if (!retriable || attempt === smartBloomConfig.llmMaxRetries) break;
        await new Promise(resolve => setTimeout(resolve, 1500 * (attempt + 1)));
      } finally {
        clearTimeout(timer);
      }
    }
    if ((lastError as Error)?.name === 'AbortError') {
      throw new MinimaxError('MiniMax did not respond in time');
    }
    throw lastError instanceof Error
      ? lastError
      : new MinimaxError('MiniMax call failed');
  }
}
