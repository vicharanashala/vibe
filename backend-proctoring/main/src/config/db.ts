import { env } from '@utils/env';

interface DbConfig {
    url: string;
}

const dbConfig: DbConfig = {
    url: env('DB_URL')
};

export default dbConfig;

