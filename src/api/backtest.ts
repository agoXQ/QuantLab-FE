import { apiClient } from './client';
import type { BacktestJob, BacktestConfig, PerformanceReport, BacktestOrder, Trade, Position, BacktestExplanation, Page } from '@/types';

const emptyReport = (jobId: number): PerformanceReport => ({
  job_id: jobId,
  annual_return: 0,
  total_return: 0,
  sharpe_ratio: 0,
  max_drawdown: 0,
  win_rate: 0,
  volatility: 0,
  beta: 0,
  alpha: 0,
  equity_curve: [],
});

function normalizeReport(jobId: number, report?: Partial<PerformanceReport> | null): PerformanceReport {
  return { ...emptyReport(jobId), ...(report ?? {}) };
}

export const backtestApi = {
  create: (data: {
    strategy_id: number;
    version_id: number;
    start_date: string;
    end_date: string;
    execution_mode?: 'trading' | 'rebalance';
    rebalance_period?: 'daily' | 'weekly' | 'monthly';
  }) =>
    apiClient.post<{ job_id: number }>('/backtests', data).then((r) => r.data.job_id),
  get: (id: number) =>
    apiClient
      .get<{ job: BacktestJob; config: BacktestConfig }>(`/backtests/${id}`)
      .then((r) => ({ job: r.data.job, config: r.data.config })),
  cancel: (id: number) => apiClient.delete(`/backtests/${id}`).then((r) => r.data),
  retry: (id: number) => apiClient.post<{ job: BacktestJob }>(`/backtests/${id}/retry`).then((r) => r.data.job),
  getReport: (id: number) =>
    apiClient.get<{ report: Partial<PerformanceReport> | null }>(`/backtests/${id}/report`).then((r) => normalizeReport(id, r.data.report)),
  getOrders: (id: number, params?: { limit?: number; cursor?: string }) =>
    apiClient.get<Page<BacktestOrder>>(`/backtests/${id}/orders`, { params }).then((r) => r.data),
  getTrades: (id: number, params?: { limit?: number; cursor?: string }) =>
    apiClient.get<Page<Trade>>(`/backtests/${id}/trades`, { params }).then((r) => r.data),
  getPositions: (id: number, params?: { trade_date?: string }) =>
    apiClient
      .get<{ positions?: Position[]; items?: Position[] }>(`/backtests/${id}/positions`, { params })
      .then((r) => r.data.positions ?? r.data.items ?? []),
  getExplanations: (id: number, params?: { limit?: number }) =>
    apiClient
      .get<{ items?: BacktestExplanation[] }>(`/backtests/${id}/explanations`, { params })
      .then((r) => r.data.items ?? []),
  list: (params?: { user_id?: number; strategy_id?: number; version_id?: number; limit?: number; cursor?: string }) =>
    apiClient.get<Page<BacktestJob>>('/backtests', { params }).then((r) => r.data),
};
