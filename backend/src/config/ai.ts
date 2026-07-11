import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: env('AI_SERVER_PORT') || 9017,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5h://localhost:1055',
    ANTHROPIC_CRED: env('ANTHROPIC_CRED') || null,
    ANTHROPIC_MODEL: env('ANTHROPIC_MODEL') || null,
    // Kill switch for the concept-map pipeline task. When 'false', new jobs are
    // created without a conceptMap status field and follow the legacy task
    // chain untouched.
    CONCEPT_MAP_ENABLED: env('CONCEPT_MAP_ENABLED') !== 'false',
};
