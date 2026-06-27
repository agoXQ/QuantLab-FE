// Shared domain types. These mirror the proto shapes exposed by the
// QuantLab API Gateway; the gateway unwraps the gRPC response into the
// platform's REST envelope { code, message, data, meta, request_id }.

export interface User {
  id: number
  username: string;
  email: string;
  avatar: string;
  bio: string;
  status: number;
  creator_status: number;
  verified_status: number;
  membership_tier: string;
  created_at: number;
}

export interface Profile {
  user: User;
  follower_count: number;
  following_count: number;
  strategy_count: number;
  backtest_count: number;
}

export type StrategyStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type Visibility = 'PRIVATE' | 'PUBLIC' | 'UNLISTED';

export interface Strategy {
  id: number;
  author_id: number;
  title: string;
  description: string;
  status: number;
  visibility: number;
  category: string;
  tags: string[];
  current_version_id: number;
  view_count: number;
  favorite_count: number;
  fork_count: number;
  created_at: number;
  updated_at: number;
}

export interface StrategyVersion {
  id: number;
  strategy_id: number;
  version_no: string;
  formula_text: string;
  buy_rule: string;
  sell_rule: string;
  risk_rule: string;
  position_rule: string;
  rebalance_rule: string;
  ranking_rule?: string;
  change_log: string;
  created_by: number;
  created_at: number;
}

export interface BacktestJob {
  id: number;
  strategy_id: number;
  version_id: number;
  user_id: number;
  status: string;
  start_date: string;
  end_date: string;
  benchmark: string;
  initial_capital: number;
  created_at: number;
  finished_at: number;
  name?: string;
  formula?: string;
  progress?: number;
  error_message?: string;
}

export interface PerformanceReport {
  job_id: number;
  annual_return: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  volatility: number;
  beta: number;
  alpha: number;
}

export interface Trade {
  id: number;
  order_id: number;
  stock_code: string;
  quantity: number;
  price: number;
  commission: number;
  trade_time: number;
}

export interface RankingItem {
  rank: number;
  strategy_id: number;
  strategy_name: string;
  author_id: number;
  author_name: string;
  score: number;
  trust_score: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  rank_change: number;
}

export interface Cursor {
  next_cursor: string;
  has_more: boolean;
}

export interface Page<T> {
  items: T[];
  cursor?: Cursor;
}

export interface PortfolioItem {
  id: number;
  strategy_id: number;
  weight: number;
  sort_order: number;
}

export interface RebalanceRule {
  frequency: string;
  method: string;
  threshold: number;
}

export interface Portfolio {
  id: number;
  owner_id: number;
  name: string;
  description: string;
  status: number;
  visibility: number;
  current_version: number;
  items: PortfolioItem[];
  rebalance_rule: RebalanceRule;
  created_at: number;
  updated_at: number;
}

export interface PortfolioAnalytics {
  annual_return: number;
  total_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  volatility: number;
  win_rate: number;
}

export interface EquityPoint {
  trade_date: string;
  nav: number;
  return_rate: number;
}

export interface BacktestConfig {
  job_id: number;
  commission_rate: number;
  slippage_rate: number;
  tax_rate: number;
  rebalance_period: string;
  max_position_count: number;
}

export interface Position {
  id: number;
  job_id: number;
  stock_code: string;
  quantity: number;
  cost_price: number;
  market_price: number;
  market_value: number;
  trade_date: string;
}
