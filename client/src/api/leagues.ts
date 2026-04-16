import api from './client';
import {
  League,
  LeagueMember,
  LeaderboardEntry,
  LeagueMVPPick,
  PerfectRoundBonuses,
  ChampionBoardResponse,
} from '../types';

interface CreateLeaguePayload {
  name: string;
  password?: string;
  isPublic?: boolean;
  maxMembers?: number;
  baseWinPoints?: number;
  exactScoreBonus?: number;
  playInWinPoints?: number;
  mvpPoints?: number;
  mvpDeadline: string;
  perfectRoundBonuses?: PerfectRoundBonuses;
  championPickDeadline?: string | null;
}

export const leaguesApi = {
  list: () => api.get<League[]>('/leagues'),

  getMvpPlayerOptions: () => api.get<{ players: string[] }>('/leagues/mvp-player-options'),

  get: (id: string) => api.get<League>(`/leagues/${id}`),

  create: (payload: CreateLeaguePayload) => api.post<League>('/leagues', payload),

  update: (
    id: string,
    payload: Partial<
      Pick<League, 'isPublic' | 'maxMembers' | 'perfectRoundBonuses' | 'championPickDeadline'>
    >,
  ) => api.put<League>(`/leagues/${id}`, payload),

  join: (inviteCode: string, password?: string) =>
    api.post<League>('/leagues/join', { inviteCode, password }),

  getMembers: (id: string) => api.get<LeagueMember[]>(`/leagues/${id}/members`),

  removeMember: (leagueId: string, userId: string) =>
    api.delete(`/leagues/${leagueId}/members/${userId}`),

  leave: (leagueId: string) => api.post(`/leagues/${leagueId}/leave`),

  deleteLeague: (leagueId: string) => api.delete(`/leagues/${leagueId}`),

  getLeaderboard: (id: string) => api.get<LeaderboardEntry[]>(`/leagues/${id}/leaderboard`),

  getMvpPicks: (id: string) => api.get<LeagueMVPPick[]>(`/leagues/${id}/mvp-pick`),

  submitMvpPick: (id: string, playerName: string) =>
    api.post<LeagueMVPPick>(`/leagues/${id}/mvp-pick`, { playerName }),

  getChampionBoard: (id: string) => api.get<ChampionBoardResponse>(`/leagues/${id}/champion`),

  submitChampionPick: (id: string, teamId: string) =>
    api.post(`/leagues/${id}/champion-pick`, { teamId }),

  setChampionTeamPoints: (id: string, rows: { teamId: string; points: number }[]) =>
    api.put(`/leagues/${id}/champion-team-points`, { rows }),
};
