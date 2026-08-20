import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: env('AI_SERVER_PORT') || 9017,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5h://localhost:1055',
    ANTHROPIC_CRED: env('ANTHROPIC_CRED') || null,
    ANTHROPIC_MODEL: env('ANTHROPIC_MODEL') || null,
    ASK_BETAL_DAILY_TOKEN_CAP: Number(env('ASK_BETAL_DAILY_TOKEN_CAP')) || 30000,
    MINIMAX_API_KEY: env('MINIMAX_API_KEY') || null,
    MINIMAX_MODEL: env('MINIMAX_MODEL') || 'MiniMax-M3',
    MINIMAX_BASE_URL: env('MINIMAX_BASE_URL') || 'https://api.minimax.io/v1'
};

