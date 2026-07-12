/** Supported companion animal types */
type CompanionAnimal = 'panda' | 'fox' | 'penguin' | 'dog' | 'cat';

/**
 * Companion growth stage.
 * 0 = Egg/Start, 5 = Fully Grown.
 * Derived from realProgress via SI() function.
 */
type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Companion mood state — mirrors prototype AMOOD() exactly.
 * Priority (highest first): celebrating > sleeping > angry > sad > excited > happy.
 * studying is a LIVE SIGNAL pushed by the frontend; never auto-derived.
 *
 * Prototype AMOOD logic:
 *   p >= 100 → celebrating
 *   i >= 5   → sleeping
 *   i >= 3   → angry
 *   i >= 1   → sad
 *   p >= 40  → excited
 *   else     → happy
 */
type CompanionMood =
  | 'happy'       // progress 0-39%, idle 0 days
  | 'sad'         // idle 1-2 days
  | 'angry'       // idle 3-4 days
  | 'sleeping'    // idle ≥ 5 days
  | 'celebrating' // progress === 100
  | 'excited'     // progress 40-99%, not idle
  | 'studying'   // live signal only (frontend push)
  | 'neutral';   // brand-new student — no enrollments, no activity

/** Lightweight companion state returned to the frontend */
interface ICompanion {
  userId: string;
  animal: CompanionAnimal;
  /** Overall progress 0-100, averaged across all enrollments */
  realProgress: number;
  /** Days since last completed lesson (completing resets to 0) */
  idleDays: number;
  /** 0-5 growth stage */
  stage: GrowthStage;
  /** Current mood */
  mood: CompanionMood;
  /** True when the student is currently in an active lesson (studyingAt fresh < 5 min) */
  studying: boolean;
  /** Latest quiz score 0-100 (most recent quiz, not average) */
  quizScore: number;
  /** Graduation cap shown when quizScore > 85 */
  graduationCap: boolean;
  /** Unix timestamp of last activity */
  lastActiveAt: Date;
  createdAt: Date;
  /**
   * True when a new enrollment drops the average progress by ≥15 points
   * vs the last known state. Frontend shows a "new journey" message once,
   * then the flag is cleared on the next poll or via PATCH /me/new-journey-seen.
   */
  newJourney: boolean;
}

export {CompanionAnimal, GrowthStage, CompanionMood, ICompanion};