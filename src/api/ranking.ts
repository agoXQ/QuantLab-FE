import { apiClient } from './client';
import type { RankingItem, Page, RankingSnapshot, TrainingRankingItem } from '@/types';

export const rankingApi = {
  list: (params?: { type?: number; period?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<RankingItem>>('/rankings', { params }).then((r) => r.data),
  trainingList: (params?: { type?: number; period?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<TrainingRankingItem>>('/rankings/trainings', { params }).then((r) => r.data),
  trainingSnapshots: (params?: { type?: number; period?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<RankingSnapshot>>('/rankings/trainings/snapshots', { params }).then((r) => r.data),
};
