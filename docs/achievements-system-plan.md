# Achievements System — Implementation Plan

## Overview

An achievements system that awards badges to users based on the number of courses they have completed. Fully integrated into the existing ViBe architecture — same module pattern, same DI container approach, same notification system.

---

## Achievement Tiers (Course Completion Based)

| Achievement | Tier | Required Completions | Badge Key |
|---|---|---|---|
| First Step | BRONZE | 1 | `first-step` |
| On a Roll | SILVER | 3 | `on-a-roll` |
| Dedicated Learner | GOLD | 5 | `dedicated-learner` |
| Knowledge Seeker | PLATINUM | 10 | `knowledge-seeker` |
| Master Learner | DIAMOND | 25 | `master-learner` |

Achievements are **definitions seeded to the DB once** + **user_achievements** records written when earned.

---

## Backend Architecture

### New Module: `backend/src/modules/achievements/`

```
achievements/
├── classes/
│   ├── validators/
│   │   └── AchievementValidators.ts       ← class-validator request bodies
│   └── transformers/
│       └── Achievement.ts                 ← response DTO classes
├── controllers/
│   └── AchievementController.ts
├── interfaces/
│   └── IAchievementRepository.ts
├── repositories/
│   └── AchievementRepository.ts
├── services/
│   └── AchievementService.ts
├── container.ts
├── index.ts
└── types.ts
```

### New Interfaces (add to `shared/interfaces/models.ts`)

```typescript
export type AchievementTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface IAchievement {
  _id?: string | ObjectId;
  slug: string;              // unique key e.g. 'first_step'
  title: string;
  description: string;
  tier: AchievementTier;
  requiredCourseCount: number;
  badgeKey: string;          // frontend maps this to an SVG/icon
  createdAt: Date;
}

export interface IUserAchievement {
  _id?: string | ObjectId;
  userId: string | ObjectId;
  achievementId: string | ObjectId;
  earnedAt: Date;
  courseCompletionCountAtTime: number;  // audit: how many they had when awarded
}
```

### MongoDB Collections

| Collection | Purpose |
|---|---|
| `achievements` | Definitions (seeded once, rarely changes) |
| `user_achievements` | Join table — one doc per user per achievement earned |

### MongoDB Indexes

```typescript
// achievements collection
achievementsCollection.createIndex({ slug: 1 }, { unique: true });

// user_achievements collection
userAchievementsCollection.createIndex({ userId: 1, achievementId: 1 }, { unique: true }); // prevents duplicates
userAchievementsCollection.createIndex({ userId: 1, earnedAt: -1 });
```

The unique compound index on `(userId, achievementId)` is the safety net — even if `checkAndAward` is called multiple times concurrently, no duplicate awards are possible.

---

## Trigger: How Completion Is Detected

The `IProgress` model has a `completed: boolean` field. The `ProgressService` is where this transitions from `false` to `true`.

**Integration point**: Inject `AchievementService` into `ProgressService`. After marking progress as complete, call:

```typescript
await this.achievementService.checkAndAward(userId, session);
```

This call:
1. Counts how many distinct courses the user has fully completed (`IProgress.completed === true`)
2. Fetches all `IAchievement` definitions whose `requiredCourseCount <= completedCount`
3. Fetches existing `IUserAchievement` records for this user
4. Awards only **newly unlocked** achievements (diff the two sets)
5. Inserts new `IUserAchievement` records
6. Fires a notification for each new achievement via the existing `NotificationService`

---

## Backend — File-by-File Spec

### `types.ts`

```typescript
const TYPES = {
  AchievementService: Symbol.for('AchievementService'),
  AchievementRepo:    Symbol.for('AchievementRepo'),
};
export { TYPES as ACHIEVEMENTS_TYPES };
```

---

### `interfaces/IAchievementRepository.ts`

```typescript
export interface IAchievementRepository {
  findAll(): Promise<IAchievement[]>;
  findBySlug(slug: string): Promise<IAchievement | null>;
  seedDefinitions(definitions: IAchievement[]): Promise<void>; // idempotent upsert

  createUserAchievement(record: IUserAchievement, session?: ClientSession): Promise<string>;
  findUserAchievements(userId: string): Promise<(IUserAchievement & { achievement: IAchievement })[]>;
  findEarnedSlugs(userId: string): Promise<string[]>;         // for fast diff check
  countCompletedCourses(userId: string): Promise<number>;     // from IProgress collection
}
```

---

### `repositories/AchievementRepository.ts` — Key Methods

| Method | Implementation Notes |
|---|---|
| `findAll()` | Simple collection scan on `achievements` |
| `seedDefinitions()` | `bulkWrite` with `upsert: true` keyed on `slug` |
| `findUserAchievements()` | `$lookup` join to `achievements` collection |
| `findEarnedSlugs()` | Project only `slug` from joined `achievements` |
| `countCompletedCourses(userId)` | Query `progress` collection: `{ userId, completed: true }`, `countDocuments()` |

---

### `services/AchievementService.ts` — Core Logic

```typescript
async checkAndAward(userId: string, session?: ClientSession): Promise<void> {
  const completedCount = await this.repo.countCompletedCourses(userId);
  const allDefinitions = await this.repo.findAll();
  const alreadyEarned = await this.repo.findEarnedSlugs(userId);

  const alreadyEarnedSet = new Set(alreadyEarned);
  const toAward = allDefinitions.filter(
    a => a.requiredCourseCount <= completedCount && !alreadyEarnedSet.has(a.slug)
  );

  for (const achievement of toAward) {
    await this.repo.createUserAchievement({
      userId: new ObjectId(userId),
      achievementId: achievement._id,
      earnedAt: new Date(),
      courseCompletionCountAtTime: completedCount,
    }, session);

    await this.notificationService.notifyAchievementEarned(
      userId,
      achievement.title,
      achievement.tier,
      session,
    );
  }
}

async getUserAchievements(userId: string) { ... }
async getAllDefinitions() { ... }
```

---

### `controllers/AchievementController.ts` — Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/achievements` | `@Authorized()` | All definitions with earned status for current user |
| `GET` | `/achievements/me` | `@Authorized()` | Current user's earned achievements |
| `GET` | `/achievements/users/:userId` | `@Authorized()` (admin/instructor) | Any user's achievements |

**Response shape for `GET /achievements`:**

```json
[
  {
    "slug": "first_step",
    "title": "First Step",
    "tier": "BRONZE",
    "requiredCourseCount": 1,
    "badgeKey": "first-step",
    "earned": true,
    "earnedAt": "2026-01-15T10:00:00Z"
  },
  {
    "slug": "on_a_roll",
    "title": "On a Roll",
    "tier": "SILVER",
    "requiredCourseCount": 3,
    "badgeKey": "on-a-roll",
    "earned": false,
    "earnedAt": null
  }
]
```

---

### Notification Extension (`NotificationService.ts`)

Add new notification type `achievement_earned` to `INotification`:

```typescript
// In INotification type union
type: 'achievement_earned'

// Example notification document
{
  title: "Achievement Unlocked: First Step 🥉",
  message: "You completed your first course and earned the First Step badge!",
  metadata: {
    achievementSlug: "first_step",
    achievementTier: "BRONZE",
    badgeKey: "first-step"
  }
}
```

---

### Achievement Definitions Seed Data

Add a `seedAchievements()` call in the app startup (`index.ts` / `bootstrap`) that runs the idempotent upsert. Definitions are code-driven — no manual DB work needed.

```typescript
const ACHIEVEMENT_DEFINITIONS: IAchievement[] = [
  {
    slug: 'first_step',
    title: 'First Step',
    tier: 'BRONZE',
    requiredCourseCount: 1,
    badgeKey: 'first-step',
    description: 'Complete your first course',
    createdAt: new Date(),
  },
  {
    slug: 'on_a_roll',
    title: 'On a Roll',
    tier: 'SILVER',
    requiredCourseCount: 3,
    badgeKey: 'on-a-roll',
    description: 'Complete 3 courses',
    createdAt: new Date(),
  },
  {
    slug: 'dedicated_learner',
    title: 'Dedicated Learner',
    tier: 'GOLD',
    requiredCourseCount: 5,
    badgeKey: 'dedicated-learner',
    description: 'Complete 5 courses',
    createdAt: new Date(),
  },
  {
    slug: 'knowledge_seeker',
    title: 'Knowledge Seeker',
    tier: 'PLATINUM',
    requiredCourseCount: 10,
    badgeKey: 'knowledge-seeker',
    description: 'Complete 10 courses',
    createdAt: new Date(),
  },
  {
    slug: 'master_learner',
    title: 'Master Learner',
    tier: 'DIAMOND',
    requiredCourseCount: 25,
    badgeKey: 'master-learner',
    description: 'Complete 25 courses',
    createdAt: new Date(),
  },
];
```

---

## Frontend Architecture

### New Files

```
frontend/src/
├── app/pages/student/achievements.tsx        ← Achievements page
├── components/achievements/
│   ├── AchievementBadge.tsx                  ← Single badge card
│   ├── AchievementGrid.tsx                   ← Grid of all badges
│   └── AchievementToast.tsx                  ← Pop-up on earn
├── hooks/achievement-hooks.ts                ← React Query hooks
└── assets/badges/
    ├── first-step.svg
    ├── on-a-roll.svg
    ├── dedicated-learner.svg
    ├── knowledge-seeker.svg
    └── master-learner.svg
```

### UX Behaviour

- **Achievements page** (`/student/achievements`): Grid of all 5 badges. Earned = full colour + earned date. Unearned = greyed out with progress indicator (e.g. "2/3 courses completed").
- **Achievement toast**: When a new achievement is detected (checked after course completion), show a brief animated toast: *"Achievement Unlocked: On a Roll 🥈"*
- **Dashboard widget**: Small badge strip on the student dashboard showing earned badge count.
- **Notification bell**: Achievement notifications appear in the existing notification system.

---

## Implementation Order

### Phase 1 — Backend Core
1. Add `IAchievement` + `IUserAchievement` to `shared/interfaces/models.ts`
2. Create achievements module (`types`, repo interface, repo, service, controller, container, index)
3. Add `seedAchievements()` call to app startup
4. Add `notifyAchievementEarned()` to `NotificationService`
5. Inject `AchievementService` into `ProgressService`, call `checkAndAward()` on completion

### Phase 2 — Backend Polish
6. Add OpenAPI decorators to controller (for schema auto-generation)
7. Write unit tests for `checkAndAward()` logic (especially duplicate prevention)
8. Add AuditTrail logging for achievement award events

### Phase 3 — Frontend
9. Regenerate OpenAPI types
10. Create `achievement-hooks.ts` with `useGetAchievements()` + `useGetMyAchievements()`
11. Build `AchievementBadge` + `AchievementGrid` components
12. Build achievements page and add route
13. Add achievement toast on course completion
14. Add badge strip to student dashboard

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Definitions seeded to DB (not hardcoded) | Allows adding new achievements without a code deploy in future |
| Unique index as duplicate guard | More reliable than application-level checks under concurrent load |
| `checkAndAward` called in ProgressService | Single source of truth for completion — no separate polling/cron needed |
| `courseCompletionCountAtTime` stored | Audit trail — know exactly what state triggered each award |
| No event emitter / no queue | Consistent with existing codebase pattern; achievements are low-volume |
| `badgeKey` string (not URL) | Frontend owns the asset mapping — no backend asset storage needed |
