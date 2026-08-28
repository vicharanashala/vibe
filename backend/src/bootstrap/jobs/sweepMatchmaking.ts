import { getContainer } from '#root/bootstrap/loadModules.js';
import { DUELS_TYPES } from '#root/modules/duels/types.js';
import { DuelService } from '#root/modules/duels/services/DuelService.js';
import cron from 'node-cron';

cron.schedule(
  '*/10 * * * * *',
  async () => {
    try {
      console.log('🚀 [matchmaking-cron] Sweep executing...');
      const container = getContainer();
      const duelService = container.get<DuelService>(DUELS_TYPES.DuelService);
      
      const matchCount = await duelService.performMatchmakingSweep();
      if (matchCount > 0) {
        console.log(`[matchmaking-cron] Matchmaking sweep finished: created ${matchCount} matches.`);
      }
    } catch (err) {
      console.error('❌ Matchmaking sweep cron failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
