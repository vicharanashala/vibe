import { env } from '@utils/env';

interface DbConfig {
    url: string;
    dbName: string; 
}

const dbConfig: DbConfig = {
    url: env('DB_URL') || "mongodb+srv://adityabmv:Aditya%401234@vibe.cuyy5.mongodb.net/",
    dbName: env('DB_NAME') || "vibe",
};

export { dbConfig };

