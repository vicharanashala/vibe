import { allocatePenality } from "#root/modules/hpSystem/utils/allocatePenality.js";
import { dbConfig } from '#root/config/db.js';
import cron from 'node-cron';
import { appConfig } from "#root/config/app.js";

cron.schedule(
    '*/5 * * * *',  // every 5 minutes
    async () => {
        console.log('Cron job started for hp system checks...');

        const URI = dbConfig.url;
        const DB = dbConfig.dbName;
        try {
            const ENABLE_HP_JOB = appConfig.ENABLE_HP_JOB;
            
            if (ENABLE_HP_JOB) {
                console.log('⚡ Running penalty allocation job...');
                await allocatePenality();
                console.log('✅ Penalty allocation job completed');
            } 
        } catch (err) {
            console.error('❌ Penalty allocation job failed:', err);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
