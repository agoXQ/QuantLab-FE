import { apiClient } from './client';
import type { RankingItem, Page } from '@/types';

export const rankingApi = {
  list: (params?: { type?: number; period?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<RankingItem>>('/rankings', { params }).then((r) => r.data),
};
