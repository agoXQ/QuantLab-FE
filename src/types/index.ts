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
  author_name?: string;
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
  can_view_formula?: boolean;
  can_execute_strategy?: boolean;
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
  equity_curve?: EquityPoint[];
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

export interface BacktestOrder {
  id: number;
  job_id: number;
  stock_code: string;
  side: 'BUY' | 'SELL' | string;
  quantity: number;
  limit_price?: number;
  status: 'PENDING' | 'FILLED' | 'REJECTED' | 'CANCELED' | string;
  reason?: string;
  submitted_at: number;
  filled_at?: number;
  filled_price?: number;
  filled_qty?: number;
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

export interface TrainingRankingItem {
  rank: number;
  user_id: number;
  username: string;
  score: number;
  training_count: number;
  win_count: number;
  win_rate: number;
  total_profit: number;
  avg_return_rate: number;
  max_drawdown: number;
  best_single_profit: number;
  bankrupt_count: number;
  rank_change: number;
}

export interface RankingSnapshot {
  id: number;
  ranking_type: number;
  ranking_period: number;
  snapshot_time: number;
}

export interface Cursor {
  next_cursor: string;
  has_more: boolean;
}

export interface Page<T> {
  items: T[];
  cursor?: Cursor;
  total?: number;
  page?: number;
  page_size?: number;
}

export interface CommunityContent {
  id: number;
  content_type: string;
  object_id: number;
  author_id: number;
  title: string;
  summary: string;
  visibility: number;
  status: number;
  like_count: number;
  favorite_count: number;
  comment_count: number;
  view_count: number;
  created_at: number;
}

export interface CommunityFeedItem {
  content: CommunityContent;
  score: number;
  created_at: number;
}

export interface CommunityComment {
  id: number;
  content_id: number;
  user_id: number;
  parent_id: number;
  body: string;
  status: string;
  created_at: number;
}

export interface CommunityProfile {
  user_id: number;
  nickname: string;
  avatar_url: string;
  bio: string;
  follower_count: number;
  following_count: number;
  content_count: number;
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
  execution_mode?: 'trading' | 'rebalance' | string;
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

export interface BacktestExplanationSignal {
  stock_code: string;
  action: string;
  score: number;
  reason?: string;
}

export interface BacktestExplanationOrder {
  stock_code: string;
  side: string;
  quantity: number;
  price?: number;
  status: string;
  reason?: string;
}

export interface BacktestExplanationTrade {
  stock_code: string;
  side: string;
  quantity: number;
  price: number;
  commission?: number;
}

export interface BacktestExplanationPortfolio {
  cash: number;
  market_value: number;
  total_asset: number;
  position_count: number;
}

export interface BacktestExplanation {
  job_id: number;
  trade_date: string;
  universe_size: number;
  evaluated: boolean;
  execution_mode: string;
  rebalance_reason?: string;
  buy_signals?: BacktestExplanationSignal[];
  sell_signals?: BacktestExplanationSignal[];
  ranking_signals?: BacktestExplanationSignal[];
  submitted_orders?: BacktestExplanationOrder[];
  matched_orders?: BacktestExplanationOrder[];
  trades?: BacktestExplanationTrade[];
  portfolio_snapshot?: BacktestExplanationPortfolio;
}

export type TrainingMode = 'BLIND_RANDOM' | 'SPECIFIED_DATE';
export type KLineStage = 'OPEN_STAGE' | 'CLOSE_STAGE';
export type OrderSide = 'BUY' | 'SELL';
export type TrainingSessionStatus = 'CREATED' | 'RUNNING' | 'COMPLETED' | 'BANKRUPT_SETTLED' | string;

export interface TrainingOpportunity {
  opportunity_id: string;
  batch_id: string;
  display_name: string;
  symbol?: string;
  security_name?: string;
  market: string;
  exchange: string;
  start_trade_date?: string;
  end_trade_date?: string;
  bar_count: number;
  sequence_no: number;
  blind_mode: boolean;
  status: string;
  session_id?: string;
}

export interface KLineBar {
  bar_index: number;
  trade_date?: string;
  open: number;
  close?: number;
  high?: number;
  low?: number;
  volume?: number;
  amount?: number;
  pct_change?: number;
  limit_up?: number;
  limit_down?: number;
  limit_status?: string;
  tradable: boolean;
  partial: boolean;
}

export interface TrainingPosition {
  symbol?: string;
  total_quantity: number;
  available_quantity: number;
  frozen_quantity: number;
  today_buy_quantity: number;
  avg_cost_price: number;
  market_value: number;
  unrealized_pnl: number;
  realized_pnl: number;
}

export interface TrainingFeeConfig {
  buy_commission_rate: number;
  sell_commission_rate: number;
  stamp_tax_rate: number;
  transfer_fee_rate: number;
  min_commission: number;
}

export interface TrainingOrderConfig {
  enable_limit_order: boolean;
  default_time_in_force: number | string;
  enable_take_profit_stop_loss: boolean;
}

export interface TrainingMarginConfig {
  margin_enabled: boolean;
  short_enabled: boolean;
  max_leverage: number;
  margin_interest_rate: number;
  short_fee_rate: number;
  maintenance_margin_ratio: number;
  warning_margin_ratio: number;
}

export interface TrainingOrder {
  order_id: string;
  session_id: string;
  side: number | string;
  order_type: number | string;
  price: number;
  quantity: number;
  hand_count: number;
  stage: number | string;
  bar_index: number;
  trade_date?: string;
  time_in_force: number | string;
  status: number | string;
  frozen_cash: number;
  frozen_quantity: number;
  reject_reason?: string;
  created_at: number;
}

export interface TrainingTrade {
  trade_id: string;
  order_id: string;
  session_id: string;
  side: number | string;
  price: number;
  quantity: number;
  amount: number;
  commission: number;
  stamp_tax: number;
  transfer_fee: number;
  total_fee: number;
  stage: number | string;
  bar_index: number;
  trade_date?: string;
  created_at: number;
}

export interface TrainingSnapshot {
  snapshot_id: string;
  bar_index: number;
  stage: number | string;
  trade_date?: string;
  cash: number;
  frozen_cash: number;
  position_quantity: number;
  available_quantity: number;
  frozen_quantity: number;
  market_value: number;
  total_asset: number;
  drawdown: number;
  created_at: number;
}

export interface TrainingSession {
  session_id: string;
  opportunity_id: string;
  display_name: string;
  symbol?: string;
  security_name?: string;
  status: TrainingSessionStatus;
  mode: number | TrainingMode;
  blind_mode: boolean;
  current_bar_index: number;
  current_stage: number | KLineStage;
  initial_asset: number;
  current_cash: number;
  frozen_cash: number;
  current_asset: number;
  position?: TrainingPosition;
  revealed_bars: KLineBar[];
  orders: TrainingOrder[];
  trades: TrainingTrade[];
  account_snapshot?: TrainingSnapshot;
  has_more_history?: boolean;
  source_strategy_id?: number;
  source_version_id?: number;
  start_trade_date?: string;
  end_trade_date?: string;
  bar_count?: number;
  fee_config?: TrainingFeeConfig;
  order_config?: TrainingOrderConfig;
  margin_config?: TrainingMarginConfig;
}

export interface TrainingResult {
  result_id: string;
  session_id: string;
  symbol: string;
  security_name: string;
  start_trade_date: string;
  end_trade_date: string;
  initial_asset: number;
  final_asset: number;
  profit_amount: number;
  return_rate: number;
  is_win: boolean;
  max_drawdown: number;
  trade_count: number;
  holding_days: number;
  profit_loss_ratio?: number;
  success_rate?: number;
  total_fee: number;
  forced_liquidation: boolean;
  bankrupt_after_completed: boolean;
  source_strategy_id?: number;
  source_version_id?: number;
  completed_at: number;
}

export interface TrainingAccount {
  cash: number;
  frozen_cash: number;
  total_asset: number;
  cumulative_profit: number;
  cumulative_return: number;
  training_count: number;
  win_count: number;
  win_rate: number;
  bankrupt_count: number;
  max_drawdown: number;
  total_trade_count: number;
  avg_holding_days: number;
  profit_loss_ratio?: number;
  status: string;
}

export interface TrainingOverviewSummary {
  sample_count: number;
  win_count: number;
  win_rate: number;
  total_profit: number;
  avg_return: number;
  avg_holding_days: number;
  avg_trade_count: number;
  max_drawdown: number;
  best_record?: TrainingResult | null;
  worst_record?: TrainingResult | null;
}

export interface TrainingOverview {
  account: TrainingAccount;
  recent_records: TrainingResult[];
  summary: TrainingOverviewSummary;
}

export interface TrainingHeatmapItem {
  unique_key: string;
  symbol: string;
  security_name: string;
  start_trade_date: string;
  profit_amount: number;
  return_rate: number;
}
