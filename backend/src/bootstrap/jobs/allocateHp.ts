import { allocatePenalty } from "#root/modules/hpSystem/utils/allocatePenality.js";
import { allocateReward } from "#root/modules/hpSystem/utils/allocateReward.js";
import { appConfig } from '#root/config/app.js';
import { dbConfig } from '#root/config/db.js';

import cron from 'node-cron';

cron.schedule(
    '*/1 * * * *',
    // "*/5 * * * * *",
    async () => {

        try {
            const ENABLE_HP_JOB = appConfig.ENABLE_HP_JOB;
            if (ENABLE_HP_JOB) {
                console.log('Cron job started for hp system checks...');
                try {

                    console.log('🎯 About to run milestone reward allocation job...');
                    await allocateReward();
                    console.log('✅ Milestone reward allocation job completed');

                    console.log('⚡ Running penalty allocation job...');
                    await allocatePenalty();
                    console.log('✅ Penalty allocation job completed');


                } catch (error) {
                    console.error('❌ HP allocation job failed:', error);
                }
            }
        } catch (err) {
            console.error('❌ Backup Failed:', err);
        }
    },
    {
        timezone: 'Asia/Kolkata',
    },
);
