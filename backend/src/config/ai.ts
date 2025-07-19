import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP'),
    serverPort: env('AI_SERVER_PORT')
};
