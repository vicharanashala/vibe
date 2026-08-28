import { getContainer } from '#root/bootstrap/loadModules.js';
import { DUELS_TYPES } from '#root/modules/duels/types.js';
import { DuelRepository } from '#root/modules/duels/repositories/DuelRepository.js';
import { DuelService } from '#root/modules/duels/services/DuelService.js';
import cron from 'node-cron';

cron.schedule(
  '*/5 * * * *',
  async () => {
    console.log('🚀 Cron Job Started: resolve expired scheduled duels...');
    try {
      const container = getContainer();
      const duelRepo = container.get<DuelRepository>(DUELS_TYPES.DuelRepository);
      const duelService = container.get<DuelService>(DUELS_TYPES.DuelService);

      const now = new Date();
      const expiredDuels = await duelRepo.findUnresolvedExpiredScheduledDuels(now);
      
      console.log(`[duels-cron] Found ${expiredDuels.length} unresolved expired scheduled duels.`);
      for (const d of expiredDuels) {
        try {
          await duelService.resolveExpiredScheduledDuel(d._id!.toString());
          console.log(`[duels-cron] Resolved duel ${d._id} successfully.`);
        } catch (err: any) {
          console.error(`[duels-cron] Failed to resolve duel ${d._id}:`, err);
        }
      }

      // Sweep active in-progress duels for round timeouts
      const activeDuels = await duelRepo.findActiveInProgressDuels();
      console.log(`[duels-cron] Found ${activeDuels.length} active in-progress duels for timeout sweep.`);
      for (const d of activeDuels) {
        try {
          const activeRound = d.rounds.find(r => r.winnerUserId === undefined);
          if (activeRound && activeRound.revealedAt) {
            const age = now.getTime() - new Date(activeRound.revealedAt).getTime();
            if (age > 60 * 1000) {
              await duelService.checkAndApplyRoundTimeout(d._id!.toString());
              console.log(`[duels-cron] Applied round timeout for duel ${d._id} successfully.`);
            }
          }
        } catch (err: any) {
          console.error(`[duels-cron] Failed to apply round timeout for duel ${d._id}:`, err);
        }
      }
      
      console.log('🎉 Resolve expired duels & timeouts completed');
    } catch (err) {
      console.error('❌ Resolve expired scheduled duels cron failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
