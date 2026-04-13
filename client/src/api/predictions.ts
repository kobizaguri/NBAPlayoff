import api from './client';
import { Prediction } from '../types';

export const predictionsApi = {
  forLeague: (leagueId: string) =>
    api.get<Prediction[]>(`/leagues/${leagueId}/predictions`),

  upsert: (
    leagueId: string,
    seriesId: string,
    predictedWinnerId: string,
    predictedSeriesScore?: string,
    predictedSeriesMvp?: string,
  ) =>
    api.post<Prediction>(`/leagues/${leagueId}/predictions`, {
      seriesId,
      predictedWinnerId,
      ...(predictedSeriesScore ? { predictedSeriesScore } : {}),
      ...(predictedSeriesMvp !== undefined ? { predictedSeriesMvp } : {}),
    }),

  delete: (leagueId: string, predictionId: string) =>
    api.delete(`/leagues/${leagueId}/predictions/${predictionId}`),
};
