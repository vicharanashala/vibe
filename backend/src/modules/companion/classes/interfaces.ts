/** Supported companion animal types */
type CompanionAnimal = 'panda' | 'fox' | 'penguin' | 'dog' | 'cat';

/**
 * Companion growth stage.
 * 0 = Egg/Start, 5 = Fully Grown.
 * Derived from realProgress via SI() function.
 */
type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Companion mood state.
 * Derived from realProgress + idleDays via AMOOD() function.
 *
 * Emotion policy — review-not-punish:
 *   - Wrong answers → concerned (never harsh)
 *   - Idle < 3 days → mood follows progress only
 *   - Idle 3-6 days  → worried (gentle nudge)
 *   - Idle > 7 days  → sleeping (companion waiting, not upset)
 *   - 100% progress  → celebrating (milestone!)
 */
type CompanionMood =
  | 'neutral'     // progress 0-30%
  | 'studying'    // progress 30-70%
  | 'happy'       // progress >70% and active
  | 'excited'     // milestone reached
  | 'concerned'   // wrong answer / struggling
  | 'worried'     // idle 3-6 days (gentle nudge)
  | 'sleeping';   // idle > 7 days (companion waiting)

/** Lightweight companion state returned to the frontend */
interface ICompanion {
  userId: string;
  animal: CompanionAnimal;
  /** Overall progress 0-100 */
  realProgress: number;
  /** Average quiz score 0-100 */
  realQuizScore: number;
  /** Days since last activity */
  idleDays: number;
  /** 0-5 growth stage */
  stage: GrowthStage;
  /** Current mood */
  mood: CompanionMood;
  /** Unix timestamp of last activity */
  lastActiveAt: Date;
  createdAt: Date;
}

export {CompanionAnimal, GrowthStage, CompanionMood, ICompanion};