export type ActivityType = 'video' | 'quiz' | 'spaced-rep' | 'confusion' | 'question';

export interface Activity {
  id: string;
  name: string;
  type: ActivityType;
  description: string;
  pointsAwarded: number;
}

export interface Badge {
  id: string;
  name: string;
  daysRequired: number;
  significance: string;
  lore: string;
  colorFrom: string;
  colorTo: string;
}

export interface Course {
  id: string;
  name: string;
  instructor: string;
  progress: number;
}

export interface ActivityLog {
  date: string; // YYYY-MM-DD
  activityId: string;
  activityName: string;
  activityType: ActivityType;
  timestamp: string; // HH:MM
}

export interface UserStreakState {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: string | null; // YYYY-MM-DD
  karmaPoints: number;
  unlockedBadges: string[]; // Badge IDs
  systemDate: string; // YYYY-MM-DD
  activitiesLoggedToday: string[]; // Activity IDs completed on systemDate
  logs: ActivityLog[];
  unlockedFlairs?: string[];
  activeFlair?: string | null;
  streakFreezes?: number;
  riddleDifficulty?: 'mortal' | 'siddha' | 'yaksha';
  soundEnabled?: boolean;
  department?: string;
  track?: string;
  avatar?: string;
}
