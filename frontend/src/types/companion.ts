export type CompanionAnimal = 'panda' | 'fox' | 'penguin' | 'dog' | 'cat';
export type GrowthStage = 0 | 1 | 2 | 3 | 4 | 5;
export type CompanionMood =
  | 'happy'
  | 'sad'
  | 'angry'
  | 'sleeping'
  | 'celebrating'
  | 'excited'
  | 'studying'
  | 'neutral'
  | 'newJourney';

// Mirrors backend CompanionMood — kept in sync with
// backend src/modules/companion/classes/interfaces.ts.
// Priority: celebrating > sleeping > angry > sad > excited > happy.
// studying is a LIVE SIGNAL pushed by the frontend; never auto-derived.
export interface CompanionState {
  userId: string;
  animal: CompanionAnimal;
  realProgress: number;
  idleDays: number;
  stage: GrowthStage;
  mood: CompanionMood;
  studying: boolean;
  quizScore: number;
  lastActiveAt: string;
  createdAt: string;
  newJourney: boolean;
}