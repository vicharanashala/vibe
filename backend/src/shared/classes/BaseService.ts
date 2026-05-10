import {MongoDatabase} from '#shared/database/index.js';
import {
  ClientSession,
  ReadPreference,
  ReadConcern,
  WriteConcern,
} from 'mongodb';

export abstract class BaseService {
  constructor(private readonly db: MongoDatabase) {}

  protected async _withTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
    label?: string,
  ): Promise<T> {
    const client = await this.db.getClient();
    // Five attempts with exponential backoff + jitter. The previous budget (3
    // attempts, fixed 50/100ms) was too tight under concurrent writes from the
    // student flow (stop + start of next item, double-clicked submit, nested
    // save() transaction inside submit()) — competing transactions kept losing
    // in lockstep and surfacing as 500s. Jitter breaks the lockstep; the
    // longer total budget (~1s worst case) is invisible to the user but covers
    // the window where contending writers finish and clear the conflict.
    const MAX_RETRIES = 5;
    const txOptions = {
      readPreference: ReadPreference.primary,
      readConcern: new ReadConcern('snapshot'),
      writeConcern: new WriteConcern('majority'),
    };

    // Per-call name used for slow-tx logs. Falls back to subclass name so
    // existing callers don't need to pass anything.
    const txLabel = label || this.constructor?.name || 'tx';
    // Anything over this threshold gets logged as a "slow transaction"
    // entry — we want to see attempt count and per-attempt latency in the
    // logs without spamming on healthy stops.
    const SLOW_TX_MS = 1000;
    const callStart = Date.now();
    const attemptDurationsMs: number[] = [];
    let retries = 0;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const session = client.startSession();
      const attemptStart = Date.now();
      try {
        session.startTransaction(txOptions);
        const result = await operation(session);
        await session.commitTransaction();
        await session.endSession();
        attemptDurationsMs.push(Date.now() - attemptStart);
        const totalMs = Date.now() - callStart;
        if (totalMs >= SLOW_TX_MS) {
          console.warn('[tx] slow transaction', {
            label: txLabel,
            totalMs,
            attempts: attempt + 1,
            retries,
            attemptDurationsMs,
          });
        }
        return result;
      } catch (error: any) {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
        attemptDurationsMs.push(Date.now() - attemptStart);
        // TransientTransactionError: driver-level label for safe-to-retry errors.
        // WriteConflict (code 112): concurrent transactions modifying the same document —
        // the driver does not always label this as TransientTransactionError, so we check
        // explicitly. Both are safe to retry after a brief backoff.
        const isTransient =
          (Array.isArray(error?.errorLabels) && error.errorLabels.includes('TransientTransactionError')) ||
          error?.code === 112 ||
          (typeof error?.message === 'string' && error.message.includes('Write conflict'));
        if (isTransient && attempt < MAX_RETRIES - 1) {
          retries++;
          // 50, 100, 200, 400 ms base + 0–50 ms jitter.
          const baseMs = 50 * Math.pow(2, attempt);
          const jitterMs = Math.floor(Math.random() * 50);
          await new Promise(resolve => setTimeout(resolve, baseMs + jitterMs));
          continue;
        }
        const totalMs = Date.now() - callStart;
        console.warn('[tx] transaction failed', {
          label: txLabel,
          totalMs,
          attempts: attempt + 1,
          retries,
          attemptDurationsMs,
          code: error?.code,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    throw new Error('Transaction failed after max retries');
  }
}
