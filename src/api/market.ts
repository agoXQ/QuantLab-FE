import { apiClient } from './client';
import type { Page } from '@/types';

export interface Security {
  id: number;
  stock_code: string;
  stock_name: string;
  exchange: string;
  industry: string;
  listing_date: string;
  status: string;
}

export interface DataVersion {
  version: string;
  description: string;
  created_at: number;
}

export interface MarketBar {
  stock_code: string;
  trade_date: string;
  period?: string;
  open: number;
  open_price?: number;
  high: number;
  high_price?: number;
  low: number;
  low_price?: number;
  close: number;
  close_price?: number;
  volume: number;
  amount: number;
  adjustment: string;
}

// Market Data Service, mounted under /api/v1/markets by the gateway.
export const marketApi = {
  listSecurities: (params?: { limit?: number; cursor?: string; exchange?: string; market?: string; asset_type?: string }) =>
    apiClient.get<Page<Security>>('/markets/securities', { params }).then((r) => r.data),
  getSecurity: (code: string) =>
    apiClient.get<{ security: Security }>(`/markets/securities/${code}`).then((r) => r.data.security),
  getBars: (params: {
    stock_code: string;
    start_date?: string;
    end_date?: string;
    period?: string;
    adjustment?: string;
    limit?: number;
  }) =>
    apiClient.get<Page<MarketBar>>('/markets/bars', { params }).then((r) => r.data),
  listExchanges: () =>
    apiClient.get<{ items: string[] }>('/markets/exchanges').then((r) => r.data.items ?? []),
  listIndustries: () =>
    apiClient.get<{ items: string[] }>('/markets/industries').then((r) => r.data.items ?? []),
  listVersions: () =>
    apiClient.get<{ items: DataVersion[] }>('/markets/versions').then((r) => r.data.items ?? []),
};
