/**
 * Transient transaction errors (e.g. write conflicts between concurrent
 * operations touching the same document) must reach BaseService._withTransaction
 * unwrapped, with their errorLabels intact, so the transaction is retried
 * instead of surfacing as a failure.
 */
export function isTransientTransactionError(error: unknown): boolean {
  return (
    Array.isArray((error as any)?.errorLabels) &&
    (error as any).errorLabels.includes('TransientTransactionError')
  );
}
