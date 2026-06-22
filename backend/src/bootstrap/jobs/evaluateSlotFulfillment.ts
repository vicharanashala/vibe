import {appConfig} from '#root/config/app.js';
import {getContainer} from '#root/bootstrap/loadModules.js';
import {SETTING_TYPES} from '#root/modules/setting/types.js';
import type {FulfillmentService} from '#root/modules/setting/services/FulfillmentService.js';
import cron from 'node-cron';

// Phase 3 of the commitment scheme: the fulfillment evaluator.
//
// Every booked window, once it has ended, is judged FULFILLED or UNFULFILLED by
// comparing the student's active watchTime within the window against the
// course's fulfillmentThresholdPct (default 90%). A FULFILLED window is what
// grants a same-day bonus booking when bonusOnFulfillment is enabled.
//
// Runs every 15 minutes so a window is evaluated soon after it closes (bonuses
// are then usable the same calendar day). Idempotent: it only ever flips
// still-BOOKED rows, so reruns are safe. Gate with ENABLE_FULFILLMENT_JOB.
cron.schedule(
  '*/15 * * * *',
  async () => {
    if (!appConfig.ENABLE_FULFILLMENT_JOB) {
      console.log(
        'Skipped slot fulfillment evaluation ENABLE_FULFILLMENT_JOB==',
        appConfig.ENABLE_FULFILLMENT_JOB,
      );
      return;
    }

    console.log('🚀 Cron Job Started: slot fulfillment evaluation...');
    try {
      const fulfillmentService = getContainer().get<FulfillmentService>(
        SETTING_TYPES.FulfillmentService,
      );
      const summary = await fulfillmentService.evaluateDueBookings();
      console.log(
        `[fulfillment] evaluated=${summary.evaluated} ` +
          `fulfilled=${summary.fulfilled} unfulfilled=${summary.unfulfilled} ` +
          `skipped=${summary.skipped}`,
      );
      console.log('🎉 Slot fulfillment evaluation completed');
    } catch (err) {
      console.error('❌ Slot fulfillment evaluation failed:', err);
    }
  },
  {
    timezone: 'Asia/Kolkata',
  },
);
