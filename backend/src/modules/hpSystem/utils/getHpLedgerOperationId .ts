export const getHpLedgerOperationId = (action: string): string => {
    return `${action}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};