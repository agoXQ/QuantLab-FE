import { apiClient } from './client';
import type { BacktestJob, BacktestConfig, PerformanceReport, Trade, Position, Page } from '@/types';

export const backtestApi = {
  create: (data: { strategy_id: number; version_id: number; start_date: string; end_date: string }) =>
    apiClient.post<{ job_id: number }>('/backtests', data).then((r) => r.data.job_id),
  get: (id: number) =>
    apiClient
      .get<{ job: BacktestJob; config: BacktestConfig }>(`/backtests/${id}`)
      .then((r) => ({ job: r.data.job, config: r.data.config })),
  cancel: (id: number) => apiClient.post(`/backtests/${id}/cancel`).then((r) => r.data),
  getReport: (id: number) =>
    apiClient.get<{ report: PerformanceReport }>(`/backtests/${id}/report`).then((r) => r.data.report),
  getTrades: (id: number, params?: { limit?: number; cursor?: string }) =>
    apiClient.get<Page<Trade>>(`/backtests/${id}/trades`, { params }).then((r) => r.data),
  getPositions: (id: number, params?: { trade_date?: string }) =>
    apiClient
      .get<{ positions: Position[] }>(`/backtests/${id}/positions`, { params })
      .then((r) => r.data.positions ?? []),
  list: (params?: { user_id?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<BacktestJob>>('/backtests', { params }).then((r) => r.data),
};
