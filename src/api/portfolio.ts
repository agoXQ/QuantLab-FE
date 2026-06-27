import { apiClient } from './client';
import type { Portfolio, PortfolioAnalytics, EquityPoint, Page } from '@/types';

// Portfolio Service — see doc/TD/QuantLab Portfolio Service TD.md.
// Endpoints live under /api/v1/portfolios. The gateway unwraps gRPC
// responses into the platform REST envelope { code, message, data };
// list collections are normalized to { items, cursor }.
export const portfolioApi = {
  list: (params?: { owner_id?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<Portfolio>>('/portfolios', { params }).then((r) => r.data),
  get: (id: number) =>
    apiClient.get<{ portfolio: Portfolio }>(`/portfolios/${id}`).then((r) => r.data.portfolio),
  create: (data: { name: string; description?: string; visibility?: number }) =>
    apiClient.post<{ portfolio_id: number }>('/portfolios', data).then((r) => r.data.portfolio_id),
  update: (id: number, data: { name?: string; description?: string; visibility?: number }) =>
    apiClient.put(`/portfolios/${id}`, data).then((r) => r.data),
  remove: (id: number) => apiClient.delete(`/portfolios/${id}`).then((r) => r.data),
  addItem: (id: number, data: { strategy_id: number; weight: number }) =>
    apiClient.post<{ item_id: number }>(`/portfolios/${id}/items`, data).then((r) => r.data.item_id),
  removeItem: (id: number, itemId: number) =>
    apiClient.delete(`/portfolios/${id}/items/${itemId}`).then((r) => r.data),
  updateWeights: (id: number, items: { strategy_id: number; weight: number }[]) =>
    apiClient.put(`/portfolios/${id}/weights`, { items }).then((r) => r.data),
  publish: (id: number) => apiClient.post(`/portfolios/${id}/publish`).then((r) => r.data),
  getAnalytics: (id: number) =>
    apiClient.get<{ analytics: PortfolioAnalytics }>(`/portfolios/${id}/analytics`).then(
      (r) => r.data.analytics,
    ),
  getEquityCurve: (id: number) =>
    apiClient
      .get<{ points?: EquityPoint[]; items?: EquityPoint[] }>(`/portfolios/${id}/equity-curve`)
      .then((r) => r.data.points ?? r.data.items ?? []),
};
