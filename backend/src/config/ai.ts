import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: env('AI_SERVER_PORT') || 9017,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5h://localhost:1055',
    ANTHROPIC_CRED: env('ANTHROPIC_CRED') || null,
    ANTHROPIC_MODEL: env('ANTHROPIC_MODEL') || null,
    GEMINI_API_KEY: env('GEMINI_API_KEY') || null,
    GEMINI_MODEL: env('GEMINI_MODEL') || null,
    LLM_PROVIDER: env('LLM_PROVIDER') || 'minimax',
    MINIMAX_API_KEY: env('MINIMAX_API_KEY') || null,
    MINIMAX_MODEL: env('MINIMAX_MODEL') || null,
    GROQ_API_KEY: env('GROQ_API_KEY') || null,
    GROQ_MODEL: env('GROQ_MODEL') || null,
};
