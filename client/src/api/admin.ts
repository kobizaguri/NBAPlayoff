import api from './client';
import { PlayoffSeries, User } from '../types';

interface CreateSeriesPayload {
  round: PlayoffSeries['round'];
  conference: PlayoffSeries['conference'];
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  homeTeamSeed: number;
  awayTeamSeed: number;
  homeOdds: number;
  awayOdds: number;
  deadline: string;
  seriesMvpPoints?: number;
}

export const adminApi = {
  listUsers: () => api.get<User[]>('/admin/users'),

  resetPassword: (userId: string, newPassword: string) =>
    api.put(`/admin/users/${userId}/password`, { newPassword }),

  createSeries: (payload: CreateSeriesPayload) =>
    api.post<PlayoffSeries>('/admin/series', payload),

  updateSeries: (id: string, payload: Partial<CreateSeriesPayload>) =>
    api.put<PlayoffSeries>(`/admin/series/${id}`, payload),

  updateScore: (id: string, homeWins: number, awayWins: number) =>
    api.put<PlayoffSeries>(`/admin/series/${id}/score`, { homeWins, awayWins }),

  completeSeries: (
    id: string,
    winnerId: string,
    finalSeriesScore?: string,
    seriesMvpWinner?: string,
  ) =>
    api.put<PlayoffSeries>(`/admin/series/${id}/complete`, {
      winnerId,
      ...(finalSeriesScore ? { finalSeriesScore } : {}),
      ...(seriesMvpWinner ? { seriesMvpWinner } : {}),
    }),

  lockSeries: (id: string, locked: boolean) =>
    api.put<PlayoffSeries>(`/admin/series/${id}/lock`, { locked }),

  deleteSeries: (id: string) => api.delete(`/admin/series/${id}`),

  setLeagueFinalsMvp: (leagueId: string, playerName: string) =>
    api.put(`/admin/leagues/${leagueId}/finals-mvp`, { playerName }),
};
