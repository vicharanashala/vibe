import { injectable, inject } from 'inversify';
import { Collection } from 'mongodb';
import { GLOBAL_TYPES } from '#root/types.js';
import { MongoDatabase } from '#shared/database/providers/mongo/MongoDatabase.js';
import { IUser } from '#root/shared/interfaces/models.js';

/**
 * Tiny read-only repository that resolves display names for a batch of
 * Firebase UIDs.
 *
 * Why a dedicated repo instead of reusing the shared `IUserRepository`?
 *  - The shared `IUserRepository.getUserNamesByIds()` keys by Mongo `_id`,
 *    not by `firebaseUID`, and additionally calls `admin.auth().getUser()`
 *    per row (slow, makes an external round trip).
 *  - The motivation module needs *just* the display name for a list of
 *    student IDs in one batched query. No auth lookups, no role checks,
 *    no write paths.
 *  - Mirrors the `StudentSRStatusRepository` pattern (cross-module access
 *    narrowed to a single file with a single responsibility).
 *
 * Storage note:
 *  - `firebaseUID` is the canonical student identifier in our schema
 *    (matches what the SR module uses for `student_id`).
 *  - Documents without a matching user row return `''` from the map
 *    (fail-open — UI can show a fallback like "Unknown student").
 *
 * Added 2026-07-25 for motivation Day 3 Plan A2 (student-name resolution
 * in the leaderboard + mentor view). Replaces the previous placeholder
 * where `studentName: studentId` was hardcoded at three controller sites.
 */
@injectable()
class UserDirectoryRepository {
  private usersCollection: Collection<IUser>;

  constructor(
    @inject(GLOBAL_TYPES.Database)
    private db: MongoDatabase,
  ) {}

  private async init() {
    this.usersCollection = await this.db.getCollection<IUser>('users');
  }

  /**
   * Build a `firebaseUID -> displayName` map for a batch of UIDs.
   * Single round trip via `$in`. Display name = `firstName` when no
   * `lastName`, else `firstName + ' ' + lastName` (trimmed).
   * Returns an empty Map for an empty input (no DB call).
   * Missing UIDs are absent from the map (caller falls back to '').
   */
  async getDisplayNamesByFirebaseUIDs(
    firebaseUIDs: string[],
  ): Promise<Map<string, string>> {
    if (firebaseUIDs.length === 0) {
      return new Map();
    }
    await this.init();
    const docs = await this.usersCollection
      .find(
        { firebaseUID: { $in: firebaseUIDs } },
        { projection: { firebaseUID: 1, firstName: 1, lastName: 1 } },
      )
      .toArray();
    const map = new Map<string, string>();
    for (const d of docs) {
      const first = (d.firstName ?? '').trim();
      const last = (d.lastName ?? '').trim();
      const display = last ? `${first} ${last}` : first;
      if (d.firebaseUID) {
        map.set(d.firebaseUID, display);
      }
    }
    return map;
  }
}

export { UserDirectoryRepository };