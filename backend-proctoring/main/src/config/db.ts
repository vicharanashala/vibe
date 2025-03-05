import { env } from '@utils/env';

export const dbConfig = {
    url: env('DB_URL') || "mongodb+srv://adityabmv:Aditya999927@vibe.cuyy5.mongodb.net/",
    dbName: env('DB_NAME') || "vibe",
};

