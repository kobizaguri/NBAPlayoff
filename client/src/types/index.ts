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

export type SeriesRound = 'playIn' | 'firstRound' | 'semis' | 'finals' | 'nbaFinals';

export type PerfectRoundBonuses = Partial<
  Record<Exclude<SeriesRound, 'playIn'>, number>
>;

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
  playInWinPoints: number;   // default 50
  mvpPoints: number;         // default 100
  mvpDeadline: string;       // ISO datetime
  finalsActualMvp?: string;
  perfectRoundBonuses?: PerfectRoundBonuses;
  championPickDeadline?: string | null;
  createdAt: string;
  /** From `GET /leagues` — whether you are a member (not set on single-league fetch). */
  isMember?: boolean;
}

export interface LeagueMember {
  userId: string;
  joinedAt: string;
  displayName: string;
  avatarUrl?: string;
  isCommissioner: boolean;
}

export type SeriesStatus = 'pending' | 'active' | 'complete';
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
  seriesMvpPoints: number;
  seriesMvpWinner?: string;
  winPoints?: number;        // per-series override; undefined = use league default
  deadline: string;
  isLockedManually: boolean;
}

export interface Prediction {
  id: string;
  userId: string;
  leagueId: string;
  seriesId: string;
  predictedWinnerId: string;
  predictedSeriesScore?: string;
  predictedSeriesMvp?: string;
  isLocked: boolean;
  winnerPoints: number;
  exactScorePoints: number;
  seriesMvpBonus: number;
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

export interface ChampionBoardResponse {
  championPickDeadline: string | null;
  championDeadlinePassed: boolean;
  playoffTeams: { teamId: string; teamName: string }[];
  teamPointsTable: { teamId: string; teamName: string; points: number }[];
  myPick: { teamId: string; pointsAwarded: number } | null;
  /** After the champion pick deadline (or for admins), every member's pick; before deadline, only the current user's. */
  memberPicks: { userId: string; teamId: string; pointsAwarded: number }[];
  nbaChampionTeamId: string | null;
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
