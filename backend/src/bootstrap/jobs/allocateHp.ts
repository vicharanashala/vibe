import { getContainer } from "../loadModules.js";


import { appConfig } from '#root/config/app.js';
import { dbConfig } from '#root/config/db.js';
import { createLocalBackup } from '#root/utils/backup-cron.js';
import cron from 'node-cron';

cron.schedule(
    '2 * * * *',
    async () => {
        console.log('Cron job started for hp system checks...');

        const URI = dbConfig.url;
        const DB = dbConfig.dbName;
        try {
            const ENABLE_HP_JOB = appConfig.ENABLE_HP_JOB;
            if (ENABLE_HP_JOB) {

            } else {
                console.log('Skipped backup ENABLE_DB_BACKUP==', ENABLE_HP_JOB);
            }
        } catch (err) {
            console.error('❌ Backup Failed:', err);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
