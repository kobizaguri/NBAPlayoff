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
  playInWinPoints: number;   // default 50
  mvpPoints: number;         // default 100
  mvpDeadline: string;       // ISO datetime
  finalsActualMvp?: string;  // set by admin after Finals
  perfectRoundBonuses: PerfectRoundBonuses;
  championPickDeadline?: string | null;
  createdAt: string;
  /** Present on `GET /leagues` list only — whether the current user is in `league_members`. */
  isMember?: boolean;
}

export interface LeagueMember {
  leagueId: string;
  userId: string;
  joinedAt: string;
}

export type SeriesStatus = 'pending' | 'active' | 'complete';
export type SeriesRound = 'playIn' | 'firstRound' | 'semis' | 'finals' | 'nbaFinals';
export type Conference = 'east' | 'west' | 'finals';

/** Bonus points if a member picks every winner correctly in that round (both conferences). */
export type PerfectRoundBonuses = Partial<
  Record<Exclude<SeriesRound, 'playIn'>, number>
>;

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
  finalSeriesScore?: string; // e.g. "4-2" (not used for playIn)
  seriesMvpPoints: number;   // default 0 (0 = disabled)
  seriesMvpWinner?: string;
  winPoints?: number;        // per-series override; null = use league default
  deadline: string;
  isLockedManually: boolean;
}

export interface Prediction {
  id: string;
  userId: string;
  leagueId: string;
  seriesId: string;
  predictedWinnerId: string;
  predictedSeriesScore?: string; // "4-0" | "4-1" | "4-2" | "4-3" — not applicable for playIn
  predictedSeriesMvp?: string;   // free-text player name, only when seriesMvpPoints > 0
  isLocked: boolean;
  winnerPoints: number;
  exactScorePoints: number;
  seriesMvpBonus: number;        // default 0
  totalPoints: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeagueMVPPick {
  id: string;
  leagueId: string;
  userId: string;
  playerName: string;
  isLocked: boolean;
  pointsAwarded: number;
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
