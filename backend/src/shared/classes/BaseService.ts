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
    const MAX_RETRIES = 3;
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
          await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Transaction failed after max retries');
  }
}
