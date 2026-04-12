export interface IDatabase<T = unknown> {
  database: T | null;
  disconnect(): Promise<T | null>;
  isConnected(): boolean;
}
