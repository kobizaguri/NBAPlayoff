// ─── Shared client-side types (mirrors server types) ─────────────────────────

export interface NotificationPreferences {
  leagueInvite: boolean;
  deadlineApproaching: boolean;
  seriesResult: boolean;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  isAdmin: boolean;
  notificationPreferences: NotificationPreferences;
  createdAt: string;
}

export interface League {
  id: string;
  name: string;
  inviteCode: string;
  hasPassword: boolean;
  commissionerId: string;
  isPublic: boolean;
  maxMembers: number;
  baseWinPoints: number;
  exactScoreBonus: number;
  createdAt: string;
}

export interface LeagueMember {
  userId: string;
  joinedAt: string;
  displayName: string;
  avatarUrl?: string;
  isCommissioner: boolean;
}

export type SeriesStatus = 'pending' | 'active' | 'complete';
export type SeriesRound = 'firstRound' | 'semis' | 'finals' | 'nbaFinals';
export type Conference = 'east' | 'west' | 'finals';

export interface PlayoffSeries {
  id: string;
  round: SeriesRound;
  conference: Conference;
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSeed: number;
  awayTeamSeed: number;
  homeOdds: number;
  awayOdds: number;
  oddsLockedAt?: string;
  homeWins: number;
  awayWins: number;
  status: SeriesStatus;
  winnerId?: string;
  finalSeriesScore?: string;
  deadline: string;
  isLockedManually: boolean;
}

export interface Prediction {
  id: string;
  userId: string;
  leagueId: string;
  seriesId: string;
  predictedWinnerId: string;
  predictedSeriesScore: string;
  isLocked: boolean;
  winnerPoints: number;
  exactScorePoints: number;
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = 'leagueInvite' | 'deadlineApproaching' | 'seriesResult';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt?: string;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  totalPoints: number;
  correctWinners: number;
  correctExactScores: number;
}

export interface UserStats {
  userId: string;
  totalPoints: number;
  correctWinners: number;
  correctExactScores: number;
  pointsByRound: Record<string, number>;
  pointsByLeague: { leagueId: string; leagueName: string; points: number }[];
}
