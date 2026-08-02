export const MYTHOLOGY_TYPES = {
  MythologyService: Symbol.for('MythologyService'),
  MythologyController: Symbol.for('MythologyController'),
};

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar: string;
  streak: number;
  karma: number;
  department?: string;
  track?: string;
  lastActive: string;
}

export interface ChatMessageHistory {
  role: string;
  text: string;
}
