/**
 * In-memory caches for the public (no-auth) course leaderboard.
 *
 * The endpoint is public and identical for every viewer, and for a large
 * course rebuilding it is expensive — rebuilding it on every request is what
 * ran the Cloud Run instance out of memory. Two layers:
 *
 *   - Settled finishers: a student at 100% with a completion date has a row
 *     that will not change, so it is built once and reused. Each rebuild still
 *     checks the student is enrolled and at 100%, and drops the row otherwise
 *     (unenrolled, or the course grew and their percentage fell).
 *   - Whole responses: the ranked list is reused for RESPONSE_TTL_MS, and
 *     concurrent requests for the same course version share one rebuild.
 *
 * Both are per instance; a new instance starts empty and fills on first use.
 */

export const RESPONSE_TTL_MS = 5 * 60 * 1000;

/** One student's leaderboard row, before ranking. */
export interface NoAuthLeaderboardRow {
  userId: string;
  userName: string;
  email: string;
  completionPercentage: number;
  /** Raw completion time for sorting; null when not completed. */
  completedAtMs: number | null;
  /** Display strings, as the endpoint has always returned them. */
  completedAt: string;
  enrolledAt: string;
}

export interface RankedNoAuthLeaderboardRow {
  rank: number;
  userId: string;
  userName: string;
  email: string;
  completionPercentage: number;
  completedAt: string;
  enrolledAt: string;
}

export interface NoAuthLeaderboard {
  course: string;
  version: string;
  data: RankedNoAuthLeaderboardRow[];
}

export class NoAuthLeaderboardCache {
  private finishers = new Map<string, Map<string, NoAuthLeaderboardRow>>();
  private responses = new Map<
    string,
    { expiresAt: number; value: NoAuthLeaderboard }
  >();
  private inFlight = new Map<string, Promise<NoAuthLeaderboard>>();

  constructor(
    private readonly ttlMs: number = RESPONSE_TTL_MS,
    private readonly now: () => number = Date.now,
  ) {}

  /** Settled finisher rows for one course version, keyed by userId. */
  finishersFor(key: string): Map<string, NoAuthLeaderboardRow> {
    let rows = this.finishers.get(key);
    if (!rows) {
      rows = new Map();
      this.finishers.set(key, rows);
    }
    return rows;
  }

  async getOrCompute(
    key: string,
    compute: () => Promise<NoAuthLeaderboard>,
  ): Promise<NoAuthLeaderboard> {
    const hit = this.responses.get(key);
    if (hit && hit.expiresAt > this.now()) return hit.value;

    const pending = this.inFlight.get(key);
    if (pending) return pending;

    // Failures are not cached: the next request tries again.
    const promise = compute()
      .then(value => {
        this.pruneExpired();
        this.responses.set(key, { expiresAt: this.now() + this.ttlMs, value });
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }

  private pruneExpired(): void {
    const now = this.now();
    for (const [key, entry] of this.responses) {
      if (entry.expiresAt <= now) this.responses.delete(key);
    }
  }
}
