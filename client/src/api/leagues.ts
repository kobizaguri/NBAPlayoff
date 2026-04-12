import api from './client';
import { League, LeagueMember, LeaderboardEntry } from '../types';

interface CreateLeaguePayload {
  name: string;
  password?: string;
  isPublic?: boolean;
  maxMembers?: number;
  baseWinPoints?: number;
  exactScoreBonus?: number;
}

export const leaguesApi = {
  list: () => api.get<League[]>('/leagues'),

  get: (id: string) => api.get<League>(`/leagues/${id}`),

  create: (payload: CreateLeaguePayload) => api.post<League>('/leagues', payload),

  update: (id: string, payload: Partial<Pick<League, 'isPublic' | 'maxMembers'>>) =>
    api.put<League>(`/leagues/${id}`, payload),

  join: (inviteCode: string, password?: string) =>
    api.post<League>('/leagues/join', { inviteCode, password }),

  getMembers: (id: string) => api.get<LeagueMember[]>(`/leagues/${id}/members`),

  removeMember: (leagueId: string, userId: string) =>
    api.delete(`/leagues/${leagueId}/members/${userId}`),

  getLeaderboard: (id: string) => api.get<LeaderboardEntry[]>(`/leagues/${id}/leaderboard`),
};
