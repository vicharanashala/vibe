import { env } from '@utils/env';

export const dbConfig = {
    url: env('DB_URL'),
    dbName: env('DB_NAME') || "vibe",
};

