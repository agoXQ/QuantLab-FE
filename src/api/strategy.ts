import { apiClient } from './client';
import type { Strategy, StrategyVersion, Page } from '@/types';

// The gateway normalizes all list responses to { items, cursor } (see
// doc/API). Single resources keep their wrapper field (e.g. { strategy }).
export const strategyApi = {
  list: (params?: { keyword?: string; sort?: string; limit?: number; cursor?: string }) =>
    apiClient.get<Page<Strategy>>('/strategies', { params }).then((r) => r.data),
  search: (params?: { keyword?: string; tag?: string; author?: number; category?: string; sort?: string; limit?: number }) =>
    apiClient.get<Page<Strategy>>('/strategies/search', { params }).then((r) => r.data),
  popular: (params?: { limit?: number }) =>
    apiClient.get<Page<Strategy>>('/strategies/popular', { params }).then((r) => r.data),
  get: (id: number) =>
    apiClient.get<{ strategy: Strategy }>(`/strategies/${id}`).then((r) => r.data.strategy),
  create: (data: { title: string; description?: string; category?: string; tags?: string[] }) =>
    apiClient.post<{ strategy_id: number }>('/strategies', data).then((r) => r.data.strategy_id),
  update: (id: number, data: { title?: string; description?: string; category?: string; tags?: string[] }) =>
    apiClient.put(`/strategies/${id}`, data).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/strategies/${id}`).then((r) => r.data),
  createVersion: (id: number, data: Partial<StrategyVersion>) =>
    apiClient.post<{ version_id: number }>(`/strategies/${id}/versions`, data).then((r) => r.data.version_id),
  listVersions: (id: number) =>
    apiClient.get<Page<StrategyVersion>>(`/strategies/${id}/versions`).then((r) => r.data.items ?? []),
  getVersion: (versionId: number) =>
    apiClient.get<{ version: StrategyVersion }>(`/strategies/versions/${versionId}`).then((r) => r.data.version),
  publish: (id: number, versionId: number) =>
    apiClient.post(`/strategies/${id}/publish`, { version_id: versionId }).then((r) => r.data),
  archive: (id: number) => apiClient.post(`/strategies/${id}/archive`).then((r) => r.data),
  fork: (id: number) =>
    apiClient.post<{ new_strategy_id: number }>(`/strategies/${id}/fork`).then((r) => r.data.new_strategy_id),
};
