# Achievements System — Implementation Plan

> **Status**: Phase 1 (Backend Core) ✅ Complete | Phase 3 (Frontend Core) ✅ Complete | Phase 2 (Polish) ⏳ Pending

---

## Overview

An achievements system that awards badges to users based on the number of courses they have completed. Fully integrated into the existing ViBe architecture — same module pattern, same DI container approach, same notification system.

---

## Achievement Tiers (Course Completion Based)

| Achievement | Tier | Required Completions | Badge Key | Emoji |
|---|---|---|---|---|
| First Step | BRONZE | 1 | `first-step` | 🥉 |
| On a Roll | SILVER | 3 | `on-a-roll` | 🥈 |
| Dedicated Learner | GOLD | 5 | `dedicated-learner` | 🥇 |
| Knowledge Seeker | PLATINUM | 10 | `knowledge-seeker` | 💎 |
| Master Learner | DIAMOND | 25 | `master-learner` | 👑 |

Achievements are **definitions seeded to the DB once** + **user_achievements** records written when earned.

---

## Backend Architecture

### Module: `backend/src/modules/achievements/`

```
achievements/
├── classes/
│   ├── validators/
│   │   └── AchievementValidators.ts       ← class-validator request params
│   └── transformers/
│       └── Achievement.ts                 ← AchievementsListResponse DTO
├── controllers/
│   └── AchievementController.ts
├── interfaces/
│   └── IAchievementRepository.ts
├── repositories/
│   └── AchievementRepository.ts
├── seeds/
│   └── achievementDefinitions.ts          ← static definitions array
├── services/
│   └── AchievementService.ts
├── container.ts
├── index.ts
└── types.ts
```

### Interfaces (`shared/interfaces/models.ts`)

```typescript
export type AchievementTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | 'DIAMOND';

export interface IAchievement {
  _id?: string | ObjectId | null;
  slug: string;
  title: string;
  description: string;
  tier: AchievementTier;
  requiredCourseCount: number;
  badgeKey: string;
  createdAt: Date;
}

export interface IUserAchievement {
  _id?: string | ObjectId | null;
  userId: string | ObjectId;
  achievementId: string | ObjectId;
  earnedAt: Date;
  courseCompletionCountAtTime: number;
}
```

### MongoDB Collections

| Collection | Purpose |
|---|---|
| `achievements` | Definitions (seeded on startup via idempotent upsert) |
| `user_achievements` | Join table — one doc per user per achievement earned |

### MongoDB Indexes

```typescript
// achievements collection
achievementsCollection.createIndex({ slug: 1 }, { unique: true });

// user_achievements collection
userAchievementsCollection.createIndex({ userId: 1, achievementId: 1 }, { unique: true }); // prevents duplicates
userAchievementsCollection.createIndex({ userId: 1, earnedAt: -1 });
```

The unique compound index on `(userId, achievementId)` is the safety net — even if `checkAndAward` is called multiple times concurrently, no duplicate awards are possible at the DB level.

---

## Trigger: How Completion Is Detected

The `IProgress` model has a `completed: boolean` field. `ProgressService` is where this transitions from `false` to `true`. Three integration points:

1. `updateProgress` — when `isCompleted = true`
2. `handleQuizeProgressAfterSubmission` — when quiz completes a course
3. `skipItem` — when skipping the last item completes a course

**Pattern — fire-and-forget outside the transaction:**

```typescript
// Hoisted flag set inside _withTransaction when course completes
let courseJustCompleted = false;
// ... inside transaction: courseJustCompleted = true

// After transaction — fire-and-forget, never crashes the progress flow
if (courseJustCompleted) {
  this.getAchievementService().checkAndAward(userId).catch(err =>
    console.error('[ProgressService] Achievement check failed:', err?.message),
  );
}
```

`AchievementService` is resolved lazily via `getContainer().get(ACHIEVEMENTS_TYPES.AchievementService)` to avoid circular DI (same pattern used for `CourseSettingService`).

---

## Backend — File-by-File

### `types.ts`

```typescript
const TYPES = {
  AchievementService: Symbol.for('AchievementService'),
  AchievementRepo:    Symbol.for('AchievementRepo'),
};
export { TYPES as ACHIEVEMENTS_TYPES };
```

---

### `services/AchievementService.ts` — Core Logic

```typescript
// Fetches counts + definitions + earned slugs in parallel for efficiency
async checkAndAward(userId: string): Promise<void> {
  const [completedCount, allDefinitions, earnedSlugs] = await Promise.all([
    this.repo.countCompletedCourses(userId),
    this.repo.findAll(),
    this.repo.findEarnedSlugs(userId),
  ]);

  const earnedSet = new Set(earnedSlugs);
  const toAward = allDefinitions.filter(
    def => def.requiredCourseCount <= completedCount && !earnedSet.has(def.slug)
  );

  for (const achievement of toAward) {
    try {
      await this.repo.createUserAchievement({ ... });
      await this.notificationService.notifyAchievementEarned(userId, achievement.title, achievement.tier);
    } catch (err: any) {
      if (err?.code !== 11000) { // 11000 = duplicate key — already awarded, safe to ignore
        console.error(...);
      }
    }
  }
}

// Dev/test only — directly awards all achievements to a user
async devSeedForUser(userId: string): Promise<void> { ... }
```

---

### `controllers/AchievementController.ts` — Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/achievements` | `@Authorized()` | All definitions with earned status for current user |
| `GET` | `/achievements/users/:userId` | `@Authorized()` | Any user's achievements (admin or same user) |
| `POST` | `/achievements/dev/seed` | `@Authorized()` | Award all achievements to current user — **dev/staging blocked in production** |

**Response shape for `GET /achievements`:**

```json
{
  "achievements": [
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
}
```

---

### Notification Extension (`NotificationService.ts`)

`achievement_earned` added to `NotificationType` union in `INotification.ts`.

```typescript
async notifyAchievementEarned(userId, achievementTitle, tier): Promise<void> {
  const tierEmoji = { BRONZE: '🥉', SILVER: '🥈', GOLD: '🥇', PLATINUM: '💎', DIAMOND: '👑' };
  await this.notificationRepo.create({
    type: 'achievement_earned',
    title: `Achievement Unlocked: ${achievementTitle} ${tierEmoji[tier]}`,
    message: `Congratulations! You earned the "${achievementTitle}" achievement.`,
    extra: { achievementTitle, tier },
    ...
  });
}
```

---

### Startup Seeding (`startCron.ts`)

`seedAchievements()` is called on every startup — idempotent `$setOnInsert` upsert means it's always safe to run.

```typescript
const achievementService = getContainer().get<AchievementService>(ACHIEVEMENTS_TYPES.AchievementService);
await achievementService.seedAchievements();
```

---

## Frontend Architecture

### Files

```
frontend/src/
├── app/
│   ├── pages/student/
│   │   └── achievements.tsx              ← Achievements page (badge grid)
│   └── routes/
│       └── router.tsx                    ← /student/achievements route added
├── hooks/
│   └── achievement-hooks.ts             ← useGetAchievements hook (manual fetch)
├── layouts/
│   └── student-layout.tsx               ← Achievements nav link (desktop + mobile)
├── components/
│   └── inviteDropDown.tsx               ← Trophy icon + yellow colors for achievement_earned
└── types/
    └── notification.types.ts            ← achievement_earned in SystemNotificationType
```

### Achievements Page (`/student/achievements`)

- Responsive grid: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- **Earned badge**: full tier color, border, checkmark, earned date
- **Unearned badge**: grayed out, locked icon
- Skeleton loading states
- Refresh button
- Tier colors: BRONZE=amber, SILVER=slate, GOLD=yellow, PLATINUM=cyan, DIAMOND=violet

### Hook (`useGetAchievements`)

Uses the manual fetch pattern (same as `announcement-hooks.ts`), not openapi-react-query, because the `/achievements` endpoint is not in the generated OpenAPI spec yet.

### Notification Bell

`achievement_earned` notifications appear in the existing `InviteDropdown` with:
- Icon: `Trophy` (lucide-react), yellow
- Colors: `bg-yellow-100 dark:bg-yellow-900/40`

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Definitions seeded to DB (not hardcoded) | Allows adding new achievements without a code deploy in future |
| Unique DB index as duplicate guard | More reliable than application-level checks under concurrent load |
| Fire-and-forget `checkAndAward` | Achievement check never crashes the progress save flow |
| Lazy DI resolution for AchievementService in ProgressService | Avoids circular dependency (same pattern as CourseSettingService) |
| `checkAndAward` called in ProgressService (3 places) | Single source of truth for completion — no polling/cron needed |
| `courseCompletionCountAtTime` stored | Audit trail — know exactly what state triggered each award |
| Emojis instead of SVG assets | Faster to ship; visual distinction is clear; no asset pipeline needed |
| No event emitter / no queue | Consistent with existing codebase pattern; achievements are low-volume |
| `badgeKey` string (not URL) | Frontend owns the asset mapping — no backend asset storage needed |
| Dev seed endpoint (`POST /achievements/dev/seed`) | Easy testing without manual DB writes; blocked in production |

---

## Implementation Status

### ✅ Phase 1 — Backend Core (Complete)
- [x] `IAchievement` + `IUserAchievement` added to `shared/interfaces/models.ts`
- [x] `achievement_earned` added to `NotificationType`
- [x] Achievements module created (types, repo interface, repo, service, controller, container, index, seeds)
- [x] `seedAchievements()` called in `startCron.ts` on startup
- [x] `notifyAchievementEarned()` added to `NotificationService`
- [x] `checkAndAward()` integrated into `ProgressService` (3 trigger points, fire-and-forget)
- [x] Duplicate binding bug fixed in `container.ts`
- [x] `startCron.ts` symbol key fix (was using constructor instead of Symbol)

### ✅ Phase 3 — Frontend Core (Complete)
- [x] `achievement_earned` added to `SystemNotificationType` and `SystemNotification.extra`
- [x] `useGetAchievements` hook created
- [x] Achievements page with badge grid, loading skeletons, earned/locked states
- [x] Route registered in TanStack Router (`router.tsx`)
- [x] Nav link added to student layout (desktop + mobile)
- [x] `InviteDropdown` updated with Trophy icon + yellow colors
- [x] `student-layout.tsx` infinite loop bug fixed (array reference deps → stable ID key)

### ⏳ Phase 2 — Backend Polish (Pending)
- [ ] Unit tests for `checkAndAward()` (especially duplicate prevention and concurrent calls)
- [ ] OpenAPI decorators + regenerate frontend types (so hook can use `api.useQuery` pattern)
- [ ] Audit trail logging for achievement award events

### ⏳ Remaining Frontend (Pending)
- [ ] Achievement toast on course completion (pop-up when new achievement earned)
- [ ] Progress indicator on unearned badges ("2/3 courses completed")
- [ ] Dashboard widget — earned badge count strip on student dashboard
