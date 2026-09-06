import { apiClient } from './client';
import type {
  Page,
  TrainingAccount,
  TrainingHeatmapItem,
  TrainingOpportunity,
  TrainingOrder,
  TrainingOverview,
  TrainingResult,
  TrainingSession,
  TrainingSnapshot,
  TrainingTrade,
} from '@/types';

export interface CreateTrainingPayload {
  mode?: 'BLIND_RANDOM' | 'SPECIFIED_DATE';
  formula_id?: string;
  formula_text?: string;
  market?: string;
  exchange?: string;
  selected_date?: string;
  adjustment_type?: string;
  bar_count: number;
  fee_config?: {
    buy_commission_rate?: number;
    sell_commission_rate?: number;
    stamp_tax_rate?: number;
    transfer_fee_rate?: number;
    min_commission?: number;
  };
  order_config?: {
    enable_limit_order?: boolean;
    default_time_in_force?: number;
    enable_take_profit_stop_loss?: boolean;
  };
  source_strategy_id?: number;
  source_version_id?: number;
}

export interface TrainingReplayPayload {
  session?: TrainingSession;
  bars: TrainingSession['revealed_bars'];
  orders: TrainingOrder[];
  trades: TrainingTrade[];
  snapshots: TrainingSnapshot[];
  result?: TrainingResult;
}

export const trainingApi = {
  create: (data: CreateTrainingPayload) =>
    apiClient
      .post<{ batch_id: string; opportunities: TrainingOpportunity[] }>('/trainings', data)
      .then((r) => r.data),
  listOpportunities: (batchId: string) =>
    apiClient
      .get<{ items: TrainingOpportunity[] }>(`/trainings/batches/${batchId}/opportunities`)
      .then((r) => r.data.items ?? []),
  startSession: (opportunityId: string) =>
    apiClient
      .post<{ session: TrainingSession }>(`/trainings/opportunities/${opportunityId}/sessions`)
      .then((r) => normalizeSession(r.data.session)),
  getSession: (sessionId: string) =>
    apiClient.get<{ session: TrainingSession }>(`/trainings/sessions/${sessionId}`).then((r) => normalizeSession(r.data.session)),
  listSessionBars: (sessionId: string, params: { before_bar_index: number; limit?: number }) =>
    apiClient
      .get<{ bars: TrainingSession['revealed_bars']; has_more: boolean }>(`/trainings/sessions/${sessionId}/bars`, { params })
      .then((r) => ({ bars: normalizeBars(r.data.bars ?? []), has_more: r.data.has_more })),
  advance: (sessionId: string) =>
    apiClient
      .post<{ session: TrainingSession; result?: TrainingResult }>(`/trainings/sessions/${sessionId}/advance`)
      .then((r) => ({ ...r.data, session: normalizeSession(r.data.session) })),
  placeOrder: (sessionId: string, data: { side: 'BUY' | 'SELL'; order_type?: 'MARKET' | 'LIMIT' | 'TAKE_PROFIT' | 'STOP_LOSS'; price?: number; hand_count: number; time_in_force?: 'STAGE' | 'DAY' | 'GTC' }) =>
    apiClient
      .post<{ order: TrainingOrder; trade?: TrainingTrade; session: TrainingSession }>(`/trainings/sessions/${sessionId}/orders`, data)
      .then((r) => ({ ...r.data, session: normalizeSession(r.data.session) })),
  cancelOrder: (sessionId: string, orderId: string) =>
    apiClient
      .post<{ order: TrainingOrder; session: TrainingSession }>(`/trainings/orders/${orderId}/cancel`, { session_id: sessionId })
      .then((r) => ({ ...r.data, session: normalizeSession(r.data.session) })),
  complete: (sessionId: string) =>
    apiClient.post<{ result: TrainingResult }>(`/trainings/sessions/${sessionId}/complete`).then((r) => r.data.result),
  getResult: (sessionId: string) =>
    apiClient.get<{ result: TrainingResult }>(`/trainings/sessions/${sessionId}/result`).then((r) => r.data.result),
  getReplay: (sessionId: string) =>
    apiClient
      .get<TrainingReplayPayload>(`/trainings/sessions/${sessionId}/replay`)
      .then((r) => normalizeReplay(r.data)),
  getAccount: () => apiClient.get<{ account: TrainingAccount }>('/trainings/account').then((r) => r.data.account),
  getOverview: (params?: { limit?: number }) =>
    apiClient.get<TrainingOverview>('/trainings/overview', { params }).then((r) => normalizeOverview(r.data)),
  resetAccount: () => apiClient.post<{ account: TrainingAccount }>('/trainings/account/reset').then((r) => r.data.account),
  listRecords: (params?: { page?: number; page_size?: number; symbol?: string; start_date?: string; end_date?: string; only_win?: boolean; source_strategy_id?: number; source_version_id?: number }) =>
    apiClient.get<Page<TrainingResult>>('/trainings/records', { params }).then((r) => {
      const meta = (r as unknown as { meta?: { total?: number; page?: number; page_size?: number } }).meta;
      return { ...r.data, total: meta?.total, page: meta?.page, page_size: meta?.page_size };
    }),
  heatmap: (params?: { limit?: number }) =>
    apiClient.get<{ items: TrainingHeatmapItem[] }>('/trainings/records/heatmap', { params }).then((r) => r.data.items ?? []),
};

function normalizeOverview(overview: TrainingOverview): TrainingOverview {
  return {
    ...overview,
    recent_records: overview.recent_records ?? [],
    summary: overview.summary ?? {
      sample_count: 0,
      win_count: 0,
      win_rate: 0,
      total_profit: 0,
      avg_return: 0,
      avg_holding_days: 0,
      avg_trade_count: 0,
      max_drawdown: 0,
      best_record: null,
      worst_record: null,
    },
  };
}

function normalizeSession(session: TrainingSession): TrainingSession {
  const revealedBars = normalizeBars(session.revealed_bars ?? []);
  const firstBarIndex = revealedBars[0]?.bar_index ?? 0;
  return {
    ...session,
    current_bar_index: session.current_bar_index ?? revealedBars[revealedBars.length - 1]?.bar_index ?? firstBarIndex,
    revealed_bars: revealedBars,
    orders: (session.orders ?? []).map((order) => ({ ...order, bar_index: order.bar_index ?? firstBarIndex })),
    trades: (session.trades ?? []).map((trade) => ({ ...trade, bar_index: trade.bar_index ?? firstBarIndex })),
  };
}

function normalizeReplay(replay: TrainingReplayPayload): TrainingReplayPayload {
  const bars = normalizeBars(replay.bars ?? []);
  const firstBarIndex = bars[0]?.bar_index ?? 0;
  return {
    ...replay,
    session: replay.session ? normalizeSession(replay.session) : undefined,
    bars,
    orders: (replay.orders ?? []).map((order) => ({ ...order, bar_index: order.bar_index ?? firstBarIndex })),
    trades: (replay.trades ?? []).map((trade) => ({ ...trade, bar_index: trade.bar_index ?? firstBarIndex })),
    snapshots: normalizeBars(replay.snapshots ?? []),
  };
}

function normalizeBars<T extends { bar_index: number }>(bars: T[]): T[] {
  return bars.map((bar, index) => ({
    ...bar,
    bar_index: bar.bar_index ?? index,
  }));
}
