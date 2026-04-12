import api from './client';
import { PlayoffSeries, Prediction } from '../types';

export const seriesApi = {
  getAll: () => api.get<PlayoffSeries[]>('/series'),

  get: (id: string) => api.get<PlayoffSeries>(`/series/${id}`),

  getPredictions: (seriesId: string) =>
    api.get<Prediction[]>(`/series/${seriesId}/predictions`),
};
