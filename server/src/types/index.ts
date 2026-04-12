// ─── Domain Types ────────────────────────────────────────────────────────────

export interface NotificationPreferences {
  leagueInvite: boolean;
  deadlineApproaching: boolean;
  seriesResult: boolean;
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
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
  passwordHash?: string;
  commissionerId: string;
  isPublic: boolean;
  maxMembers: number; // 20–30
  baseWinPoints: number;
  exactScoreBonus: number;
  createdAt: string;
}

export interface LeagueMember {
  leagueId: string;
  userId: string;
  joinedAt: string;
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
  finalSeriesScore?: string; // e.g. "4-2"
  deadline: string;
  isLockedManually: boolean;
}

export interface Prediction {
  id: string;
  userId: string;
  leagueId: string;
  seriesId: string;
  predictedWinnerId: string;
  predictedSeriesScore: string; // "4-0" | "4-1" | "4-2" | "4-3"
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

export interface RefreshToken {
  token: string;
  userId: string;
  expiresAt: string;
}

// ─── JWT Payload ─────────────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  isAdmin: boolean;
}
