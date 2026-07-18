import {MongoDatabase} from '#shared/database/index.js';
import {
  ClientSession,
  ReadPreference,
  ReadConcern,
  WriteConcern,
} from 'mongodb';

// MongoDB error code / message for standalone (non-replica-set) servers
const REPLICA_SET_REQUIRED_MSG =
  'Transaction numbers are only allowed on a replica set member or mongos';

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

        // ── Dev-mode fallback ────────────────────────────────────────────
        // Standalone MongoDB (no replica set) does not support multi-document
        // transactions.  In a local development environment we fall back to
        // running the operation without transactional guarantees so the app
        // still works.  This path is NEVER reached in production because
        // production MongoDB is always a replica set / Atlas cluster.
        if (
          typeof error?.message === 'string' &&
          error.message.includes(REPLICA_SET_REQUIRED_MSG)
        ) {
          console.warn(
            '[BaseService] Standalone MongoDB detected – running operation ' +
              'without a transaction (dev-mode only).',
          );
          return operation(null as unknown as ClientSession);
        }
        // ────────────────────────────────────────────────────────────────

        const isTransient =
          Array.isArray(error?.errorLabels) &&
          error.errorLabels.includes('TransientTransactionError');
        if (isTransient && attempt < MAX_RETRIES - 1) {
          continue;
        }
        throw error;
      }
    }

    throw new Error('Transaction failed after max retries');
  }
}
