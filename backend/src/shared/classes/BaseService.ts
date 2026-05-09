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

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const session = client.startSession();
      try {
        session.startTransaction(txOptions);
        const result = await operation(session);
        await session.commitTransaction();
        await session.endSession();
        return result;
      } catch (error: any) {
        if (session.inTransaction()) await session.abortTransaction();
        await session.endSession();
        // TransientTransactionError: driver-level label for safe-to-retry errors.
        // WriteConflict (code 112): concurrent transactions modifying the same document —
        // the driver does not always label this as TransientTransactionError, so we check
        // explicitly. Both are safe to retry after a brief backoff.
        const isTransient =
          (Array.isArray(error?.errorLabels) && error.errorLabels.includes('TransientTransactionError')) ||
          error?.code === 112 ||
          (typeof error?.message === 'string' && error.message.includes('Write conflict'));
        if (isTransient && attempt < MAX_RETRIES - 1) {
          // 50, 100, 200, 400 ms base + 0–50 ms jitter.
          const baseMs = 50 * Math.pow(2, attempt);
          const jitterMs = Math.floor(Math.random() * 50);
          await new Promise(resolve => setTimeout(resolve, baseMs + jitterMs));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Transaction failed after max retries');
  }
}
