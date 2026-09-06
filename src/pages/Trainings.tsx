import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  Modal,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  type TableColumnsType,
  Tag,
  Typography,
} from 'antd';
import { PlayCircleOutlined, ThunderboltOutlined, TrophyOutlined, ShareAltOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { marketApi } from '@/api/market';
import type { TradingCalendarDay } from '@/api/market';
import { strategyApi } from '@/api/strategy';
import { trainingApi, type CreateTrainingPayload, type TrainingReplayPayload } from '@/api/training';
import MetricCard from '@/components/MetricCard';
import CommunityPublishModal, { type CommunityPublishTarget } from '@/components/CommunityPublishModal';
import TrainingKLineChart from '@/components/TrainingKLineChart';
import { useTokenStore } from '@/store/auth';
import { useFormulaStore } from '@/store/formula';
import type { KLineBar, TrainingHeatmapItem, TrainingOpportunity, TrainingOrder, TrainingResult, TrainingSession, TrainingTrade } from '@/types';

const { Title, Text, Paragraph } = Typography;
const emptyTrades: TrainingTrade[] = [];
const emptyRecords: TrainingResult[] = [];
const emptyHeatmap: TrainingHeatmapItem[] = [];
type TrainingOrderType = 'MARKET' | 'LIMIT' | 'TAKE_PROFIT' | 'STOP_LOSS';

type CreateForm = {
  mode: 'BLIND_RANDOM' | 'SPECIFIED_DATE';
  formula_id?: string;
  formula_text?: string;
  exchange?: string;
  selected_date?: dayjs.Dayjs;
  adjustment_type: string;
  bar_count: number;
  buy_commission_rate: number;
  sell_commission_rate: number;
  stamp_tax_rate: number;
  min_commission: number;
};

type OrderForm = {
  order_type: TrainingOrderType;
  price?: number;
  hand_count: number;
};

type RecordFilterForm = {
  symbol?: string;
  outcome?: 'ALL' | 'WIN';
  date_range?: [Dayjs, Dayjs];
  source_strategy_id?: number;
};

type RecordFilters = {
  symbol?: string;
  start_date?: string;
  end_date?: string;
  only_win?: boolean;
  source_strategy_id?: number;
};

type ReplayState = TrainingReplayPayload & {
  session_id: string;
  opportunity_id?: string;
  display_name: string;
  training_start_bar_index?: number;
};

type CompletionSummary = {
  session_id: string;
  result: TrainingResult;
  replay?: TrainingReplayPayload;
};

function stageText(stage?: number | string) {
  if (stage === 'CLOSE_STAGE' || stage === 2) return '收盘阶段';
  return '开盘阶段';
}

function statusColor(status?: string) {
  if (status === 'COMPLETED') return 'green';
  if (status === 'RUNNING') return 'processing';
  if (status === 'BANKRUPT_SETTLED') return 'red';
  return 'default';
}

function sideText(side: number | string) {
  return side === 'SELL' || side === 2 ? '卖出' : '买入';
}

function orderTypeText(type: number | string) {
  if (type === 'TAKE_PROFIT' || type === 3) return '止盈';
  if (type === 'STOP_LOSS' || type === 4) return '止损';
  return type === 'LIMIT' || type === 2 ? '限价' : '市价';
}

function isConditionalOrderType(type?: TrainingOrderType | number | string) {
  return type === 'TAKE_PROFIT' || type === 'STOP_LOSS' || type === 3 || type === 4;
}

function isPricedOrderType(type?: TrainingOrderType | number | string) {
  return type === 'LIMIT' || type === 2 || isConditionalOrderType(type);
}

function orderStatusText(status: number | string) {
  if (status === 'FILLED' || status === 2) return '已成交';
  if (status === 'CANCELLED_ORDER' || status === 3) return '已撤单';
  if (status === 'EXPIRED' || status === 4) return '已过期';
  if (status === 'REJECTED' || status === 5) return '已拒绝';
  return '委托中';
}

function pendingOrder(status: number | string) {
  return status === 'PENDING' || status === 1;
}

function isOpportunityLocked(status: number | string) {
  return status === 'LOCKED' || status === 1;
}

function isOpportunityUnlocked(status: number | string) {
  return status === 'UNLOCKED' || status === 2;
}

function isOpportunityInProgress(status: number | string) {
  return status === 'IN_PROGRESS' || status === 3;
}

function isOpportunityCompleted(status: number | string) {
  return status === 'OPPORTUNITY_COMPLETED' || status === 'COMPLETED' || status === 4;
}

function opportunityStatusText(status: number | string) {
  if (isOpportunityLocked(status)) return '待解锁';
  if (isOpportunityUnlocked(status)) return '可训练';
  if (isOpportunityInProgress(status)) return '训练中';
  if (isOpportunityCompleted(status)) return '已完成';
  return String(status || '未知');
}

function maxAffordableHands(cash: number, price?: number) {
  if (!price || price <= 0) return 0;
  return Math.max(0, Math.floor(cash / (price * 100)));
}

function calendarTradeDate(day: TradingCalendarDay) {
  const raw = day.trade_date ?? day.tradeDate;
  if (!raw) return undefined;
  const parsed = dayjs(raw, ['YYYY-MM-DD', 'YYYYMMDD']);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : raw;
}

function normalizeDate(value?: string) {
  if (!value) return undefined;
  const parsed = dayjs(value, ['YYYY-MM-DD', 'YYYYMMDD']);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : value.slice(0, 10);
}

function findTrainingStartBarIndex(bars: KLineBar[] = [], result?: TrainingResult) {
  const startDate = normalizeDate(result?.start_trade_date);
  if (startDate) {
    const matched = bars.find((bar) => normalizeDate(bar.trade_date) === startDate);
    if (matched) return matched.bar_index;
  }
  return bars[120]?.bar_index ?? bars[0]?.bar_index;
}

function toReplayState(sessionId: string, replay: TrainingReplayPayload, displayName?: string, opportunityId?: string): ReplayState {
  return {
    ...replay,
    session_id: sessionId,
    opportunity_id: opportunityId,
    display_name: displayName || replay.result?.security_name || replay.result?.symbol || '训练复盘',
    training_start_bar_index: findTrainingStartBarIndex(replay.bars, replay.result),
  };
}

function formatMoney(value?: number) {
  return (value ?? 0).toFixed(2);
}

function formatCurrency(value?: number) {
  return `¥${formatMoney(value)}`;
}

function formatPercent(value?: number) {
  return `${((value ?? 0) * 100).toFixed(2)}%`;
}

function formatSignedMoney(value?: number) {
  const nextValue = value ?? 0;
  return `${nextValue >= 0 ? '+' : ''}${nextValue.toFixed(2)}`;
}

function formatDateTime(seconds?: number) {
  if (!seconds) return '--';
  const parsed = dayjs.unix(seconds);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm') : '--';
}

function liquidationText(result?: TrainingResult) {
  if (!result) return '--';
  if (result.forced_liquidation) return '结束时按最后收盘价强平';
  return '无强平';
}

function isCalendarOpen(day: TradingCalendarDay) {
  return day.is_open ?? day.isOpen ?? false;
}

function mergeBars(incoming: KLineBar[] = [], current: KLineBar[] = []) {
  const byIndex = new Map<number, KLineBar>();
  [...incoming, ...current].forEach((bar, index) => {
    const barIndex = bar.bar_index ?? index;
    byIndex.set(barIndex, { ...bar, bar_index: barIndex });
  });
  return Array.from(byIndex.values()).sort((left, right) => left.bar_index - right.bar_index);
}

function firstBarIndex(bars: KLineBar[] = []) {
  return bars.length ? Math.min(...bars.map((bar, index) => bar.bar_index ?? index)) : 0;
}

function mergeSessionBars(next: TrainingSession, previousBars?: KLineBar[], previousHasMore = false): TrainingSession {
  const mergedBars = previousBars?.length ? mergeBars(previousBars, next.revealed_bars) : next.revealed_bars;
  return {
    ...next,
    revealed_bars: mergedBars,
    has_more_history: previousHasMore || firstBarIndex(mergedBars) > 0,
  };
}

function mergeOrders(left: TrainingOrder[] = [], right: TrainingOrder[] = []) {
  const byId = new Map<string, TrainingOrder>();
  [...left, ...right].forEach((order) => byId.set(order.order_id, order));
  return Array.from(byId.values()).sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
}

function mergeTrades(left: TrainingTrade[] = [], right: TrainingTrade[] = []) {
  const byId = new Map<string, TrainingTrade>();
  [...left, ...right].forEach((trade) => byId.set(trade.trade_id, trade));
  return Array.from(byId.values()).sort((a, b) => (a.created_at ?? 0) - (b.created_at ?? 0));
}

function replayTitle(record?: TrainingResult) {
  if (!record) return '--';
  return `${record.security_name || record.symbol} · ${record.start_trade_date} → ${record.end_trade_date}`;
}

function numericObjectID(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function trainingPublishTarget(record: TrainingResult): CommunityPublishTarget {
  const name = record.security_name || record.symbol;
  return {
    contentType: 'training',
    objectId: numericObjectID(record.session_id),
    objectKey: `training:${record.session_id}`,
    label: name,
    title: `分享训练结果：${name}`,
    summary: [
      `训练标的：${name}`,
      `区间：${record.start_trade_date} → ${record.end_trade_date}`,
      `收益：${formatSignedMoney(record.profit_amount)}（${formatPercent(record.return_rate)}）`,
      `最大回撤：${formatPercent(record.max_drawdown)}，交易次数：${record.trade_count}`,
      `训练 Session：${record.session_id}`,
    ].join('\n'),
  };
}

type TradeBreakdown = {
  buyAmount: number;
  sellAmount: number;
  grossTradingPnl: number;
  netProfit: number;
  commission: number;
  stampTax: number;
  transferFee: number;
  totalFee: number;
  buyTradeCount: number;
  sellTradeCount: number;
};

function sumTrades(trades: TrainingTrade[], selector: (trade: TrainingTrade) => number | undefined) {
  return trades.reduce((sum, trade) => sum + (selector(trade) ?? 0), 0);
}

function buildTradeBreakdown(result?: TrainingResult, trades: TrainingTrade[] = []): TradeBreakdown {
  const buyTrades = trades.filter((trade) => sideText(trade.side) === '买入');
  const sellTrades = trades.filter((trade) => sideText(trade.side) === '卖出');
  const buyAmount = sumTrades(buyTrades, (trade) => trade.amount);
  const sellAmount = sumTrades(sellTrades, (trade) => trade.amount);
  const commission = sumTrades(trades, (trade) => trade.commission);
  const stampTax = sumTrades(trades, (trade) => trade.stamp_tax);
  const transferFee = sumTrades(trades, (trade) => trade.transfer_fee);
  const tradeTotalFee = sumTrades(trades, (trade) => trade.total_fee);
  const totalFee = trades.length ? tradeTotalFee : result?.total_fee ?? 0;

  return {
    buyAmount,
    sellAmount,
    grossTradingPnl: sellAmount - buyAmount,
    netProfit: result?.profit_amount ?? sellAmount - buyAmount - totalFee,
    commission,
    stampTax,
    transferFee,
    totalFee,
    buyTradeCount: buyTrades.length,
    sellTradeCount: sellTrades.length,
  };
}

function renderTradeBreakdownCards(breakdown: TradeBreakdown) {
  return (
    <Card size="small" title="收益/费用拆解">
      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12} lg={8}>
          <Statistic title="买入成交额" value={breakdown.buyAmount} precision={2} prefix="¥" />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Statistic title="卖出成交额" value={breakdown.sellAmount} precision={2} prefix="¥" />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Statistic
            title="交易毛盈亏"
            value={Math.abs(breakdown.grossTradingPnl)}
            precision={2}
            prefix={breakdown.grossTradingPnl >= 0 ? '+¥' : '-¥'}
            styles={{ content: { color: breakdown.grossTradingPnl >= 0 ? '#16c784' : '#ea3943' } }}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Statistic title="费用合计" value={breakdown.totalFee} precision={2} prefix="¥" styles={{ content: { color: '#ea3943' } }} />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Statistic
            title="净收益"
            value={Math.abs(breakdown.netProfit)}
            precision={2}
            prefix={breakdown.netProfit >= 0 ? '+¥' : '-¥'}
            styles={{ content: { color: breakdown.netProfit >= 0 ? '#16c784' : '#ea3943' } }}
          />
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Statistic title="买/卖笔数" value={`${breakdown.buyTradeCount} / ${breakdown.sellTradeCount}`} />
        </Col>
      </Row>
      <Descriptions size="small" column={3} style={{ marginTop: 12 }}>
        <Descriptions.Item label="佣金">{formatCurrency(breakdown.commission)}</Descriptions.Item>
        <Descriptions.Item label="印花税">{formatCurrency(breakdown.stampTax)}</Descriptions.Item>
        <Descriptions.Item label="过户费">{formatCurrency(breakdown.transferFee)}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

function heatmapColor(value: number) {
  if (value > 0.08) return '#0b8f59';
  if (value > 0.03) return '#16c784';
  if (value > 0) return '#83d9b2';
  if (value < -0.08) return '#b4232a';
  if (value < -0.03) return '#ea3943';
  if (value < 0) return '#f5a3a9';
  return '#d9d9d9';
}

function renderTrainingHeatmap(items: TrainingHeatmapItem[]) {
  const sortedItems = [...items]
    .sort((left, right) => left.start_trade_date.localeCompare(right.start_trade_date))
    .slice(-100);

  return (
    <Card size="small" title="最近训练收益热力图">
      {!sortedItems.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无热力图数据" /> : (
        <Space orientation="vertical" size={10} style={{ width: '100%' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(18px, 1fr))', gap: 6 }}>
            {sortedItems.map((item) => (
              <div
                key={item.unique_key}
                title={`${item.security_name || item.symbol} · ${item.start_trade_date} · ${formatSignedMoney(item.profit_amount)} (${formatPercent(item.return_rate)})`}
                style={{
                  height: 18,
                  borderRadius: 4,
                  background: heatmapColor(item.return_rate),
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              />
            ))}
          </div>
          <Space size={8} wrap>
            <Text type="secondary">最近 {sortedItems.length} 次训练，颜色按单次收益率映射</Text>
            <Tag color="green">盈利</Tag>
            <Tag color="red">亏损</Tag>
            <Tag>持平</Tag>
          </Space>
        </Space>
      )}
    </Card>
  );
}

function yesNo(value?: boolean) {
  return value ? '开启' : '关闭';
}

function renderReplayParameters(replay?: TrainingReplayPayload) {
  const session = replay?.session;
  if (!session) return null;
  const fee = session.fee_config;
  const order = session.order_config;
  const margin = session.margin_config;

  return (
    <Card size="small" title="训练参数快照">
      <Descriptions size="small" column={3} bordered>
        <Descriptions.Item label="训练K线数">{session.bar_count ?? '--'}</Descriptions.Item>
        <Descriptions.Item label="训练起点">{session.start_trade_date || replay?.result?.start_trade_date || '--'}</Descriptions.Item>
        <Descriptions.Item label="训练终点">{session.end_trade_date || replay?.result?.end_trade_date || '--'}</Descriptions.Item>
        <Descriptions.Item label="买佣金率">{formatPercent(fee?.buy_commission_rate)}</Descriptions.Item>
        <Descriptions.Item label="卖佣金率">{formatPercent(fee?.sell_commission_rate)}</Descriptions.Item>
        <Descriptions.Item label="最低佣金">{formatCurrency(fee?.min_commission)}</Descriptions.Item>
        <Descriptions.Item label="印花税率">{formatPercent(fee?.stamp_tax_rate)}</Descriptions.Item>
        <Descriptions.Item label="过户费率">{formatPercent(fee?.transfer_fee_rate)}</Descriptions.Item>
        <Descriptions.Item label="限价单">{yesNo(order?.enable_limit_order)}</Descriptions.Item>
        <Descriptions.Item label="止盈止损">{yesNo(order?.enable_take_profit_stop_loss)}</Descriptions.Item>
        <Descriptions.Item label="融资">{yesNo(margin?.margin_enabled)}</Descriptions.Item>
        <Descriptions.Item label="融券">{yesNo(margin?.short_enabled)}</Descriptions.Item>
      </Descriptions>
    </Card>
  );
}

export default function Trainings() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<CreateForm>();
  const [orderForm] = Form.useForm<OrderForm>();
  const [recordFilterForm] = Form.useForm<RecordFilterForm>();
  const mode = Form.useWatch('mode', form);
  const orderType = Form.useWatch('order_type', orderForm);
  const orderPrice = Form.useWatch('price', orderForm);
  const isAuthenticated = useTokenStore((state) => state.isAuthenticated);
  const accessToken = useTokenStore((state) => state.accessToken);
  const canLoadTraining = isAuthenticated && !!accessToken;
  const sourceStrategyId = Number(searchParams.get('strategy_id') || 0);
  const sourceVersionId = Number(searchParams.get('version_id') || 0);
  const hasStrategySource = sourceStrategyId > 0 && sourceVersionId > 0;
  const formulas = useFormulaStore((state) => state.formulas);
  const formulaOptions = useMemo(
    () => formulas
      .filter((formula) => formula.rule_type === 'stock_select')
      .map((formula) => ({
        label: formula.name,
        value: formula.expression,
      })),
    [formulas],
  );
  const [batchId, setBatchId] = useState('');
  const [opportunities, setOpportunities] = useState<TrainingOpportunity[]>([]);
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [replay, setReplay] = useState<ReplayState | null>(null);
  const [detailReplay, setDetailReplay] = useState<ReplayState | null>(null);
  const [completionSummary, setCompletionSummary] = useState<CompletionSummary | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [trainingStartBarIndex, setTrainingStartBarIndex] = useState<number | undefined>();
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(8);
  const [recordFilters, setRecordFilters] = useState<RecordFilters>({});
  const [publishTarget, setPublishTarget] = useState<CommunityPublishTarget | null>(null);

  const { data: sourceStrategy } = useQuery({
    queryKey: ['training-source-strategy', sourceStrategyId],
    queryFn: () => strategyApi.get(sourceStrategyId),
    enabled: hasStrategySource,
    staleTime: 60_000,
  });

  const { data: sourceVersion } = useQuery({
    queryKey: ['training-source-version', sourceVersionId],
    queryFn: () => strategyApi.getVersion(sourceVersionId),
    enabled: hasStrategySource,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!hasStrategySource) return;
    form.setFieldsValue({
      formula_id: String(sourceVersionId),
      formula_text: undefined,
    });
  }, [form, hasStrategySource, sourceVersionId]);

  const { data: overview, refetch: refetchOverview } = useQuery({
    queryKey: ['training-overview', canLoadTraining],
    queryFn: () => trainingApi.getOverview({ limit: 100 }),
    enabled: canLoadTraining,
    staleTime: 30_000,
  });

  const { data: recordsPage, isFetching: recordsFetching, refetch: refetchRecords } = useQuery({
    queryKey: ['training-records', canLoadTraining, recordPage, recordPageSize, recordFilters],
    queryFn: () => trainingApi.listRecords({ page: recordPage, page_size: recordPageSize, ...recordFilters }),
    enabled: canLoadTraining,
    staleTime: 15_000,
  });

  const { data: heatmapItems = emptyHeatmap, refetch: refetchHeatmap } = useQuery({
    queryKey: ['training-heatmap', canLoadTraining],
    queryFn: () => trainingApi.heatmap({ limit: 100 }),
    enabled: canLoadTraining,
    staleTime: 30_000,
  });

  const account = overview?.account;

  const { data: calendarDays } = useQuery({
    queryKey: ['training-calendar'],
    queryFn: () => marketApi.getCalendar({
      start_date: dayjs().subtract(15, 'year').format('YYYY-MM-DD'),
      end_date: dayjs().format('YYYY-MM-DD'),
    }),
    staleTime: 300_000,
  });

  const openDateSet = useMemo(
    () => new Set((calendarDays ?? [])
      .filter((day) => isCalendarOpen(day))
      .map((day) => calendarTradeDate(day))
      .filter((date): date is string => !!date)),
    [calendarDays],
  );
  const openDates = useMemo(
    () => (calendarDays ?? [])
      .filter((day) => isCalendarOpen(day))
      .map((day) => calendarTradeDate(day))
      .filter((date): date is string => !!date)
      .sort(),
    [calendarDays],
  );

  const createMutation = useMutation({
    mutationFn: async (values: CreateForm) => {
      if (!canLoadTraining) throw new Error('请先登录后再创建训练');
      const payload: CreateTrainingPayload = {
        mode: values.mode,
        formula_id: values.formula_text ? undefined : hasStrategySource ? String(sourceVersionId) : values.formula_id,
        formula_text: values.formula_text,
        market: 'CN_A',
        exchange: values.exchange,
        selected_date: values.selected_date?.format('YYYY-MM-DD'),
        adjustment_type: values.adjustment_type,
        bar_count: values.bar_count,
        fee_config: {
          buy_commission_rate: values.buy_commission_rate,
          sell_commission_rate: values.sell_commission_rate,
          stamp_tax_rate: values.stamp_tax_rate,
          min_commission: values.min_commission,
        },
        order_config: { enable_limit_order: true, enable_take_profit_stop_loss: true },
        source_strategy_id: hasStrategySource ? sourceStrategyId : undefined,
        source_version_id: hasStrategySource ? sourceVersionId : undefined,
      };
      return trainingApi.create(payload);
    },
    onSuccess: (data) => {
      setBatchId(data.batch_id);
      setOpportunities(data.opportunities ?? []);
      setSession(null);
      setReplay(null);
      setCompletionSummary(null);
      setResultModalOpen(false);
      setTrainingStartBarIndex(undefined);
      message.success('训练机会已生成');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '创建训练失败'),
  });

  const startMutation = useMutation({
    mutationFn: trainingApi.startSession,
    onSuccess: (s) => {
      setSession({ ...s, has_more_history: firstBarIndex(s.revealed_bars) > 0 });
      setReplay(null);
      setTrainingStartBarIndex(s.current_bar_index);
      message.success('训练开始');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '开始训练失败'),
  });

  const refreshOpportunities = async (currentBatchId = batchId) => {
    if (!currentBatchId) return [];
    const items = await trainingApi.listOpportunities(currentBatchId);
    setOpportunities(items);
    return items;
  };

  const showCompletionSummary = async (sessionId: string, result?: TrainingResult) => {
    let replayData: TrainingReplayPayload | undefined;
    let finalResult = result;
    try {
      replayData = await trainingApi.getReplay(sessionId);
      finalResult = replayData.result ?? finalResult ?? await trainingApi.getResult(sessionId);
    } catch {
      if (!finalResult) finalResult = await trainingApi.getResult(sessionId);
    }
    if (!finalResult) return;
    setCompletionSummary({ session_id: sessionId, result: finalResult, replay: replayData });
    setSession(null);
    setTrainingStartBarIndex(undefined);
    setResultModalOpen(true);
    await refreshOpportunities();
    refetchOverview();
    refetchRecords();
    refetchHeatmap();
  };

  const advanceMutation = useMutation({
    mutationFn: () => trainingApi.advance(session!.session_id),
    onSuccess: async (data) => {
      setSession((current) => mergeSessionBars(data.session, current?.revealed_bars, current?.has_more_history));
      if (data.result) {
        message.success('训练已完成');
        await showCompletionSummary(data.session.session_id, data.result);
      }
      refetchOverview();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '推进失败'),
  });

  const orderMutation = useMutation({
    mutationFn: async (payload: { side: 'BUY' | 'SELL'; order_type: TrainingOrderType; price?: number; hand_count: number }) => {
      const placed = await trainingApi.placeOrder(session!.session_id, {
        ...payload,
        time_in_force: isConditionalOrderType(payload.order_type) ? 'GTC' : payload.order_type === 'LIMIT' ? 'DAY' : 'STAGE',
      });
      const advanced = await trainingApi.advance(placed.session.session_id);
      return { placed, advanced };
    },
    onSuccess: async ({ placed, advanced }) => {
      const nextSession = {
        ...advanced.session,
        orders: mergeOrders(placed.session.orders, advanced.session.orders),
        trades: mergeTrades(placed.session.trades, advanced.session.trades),
      };
      setSession((current) => mergeSessionBars(nextSession, current?.revealed_bars, current?.has_more_history));
      if (advanced.result) {
        message.success('训练已完成');
        await showCompletionSummary(advanced.session.session_id, advanced.result);
      } else {
        message.success(placed.trade ? '成交成功，已进入下一阶段' : '委托已提交，已进入下一阶段');
      }
      refetchOverview();
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '下单失败'),
  });

  const cancelOrderMutation = useMutation({
    mutationFn: (orderId: string) => trainingApi.cancelOrder(session!.session_id, orderId),
    onSuccess: (data) => {
      setSession((current) => mergeSessionBars(data.session, current?.revealed_bars, current?.has_more_history));
      message.success('撤单成功');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '撤单失败'),
  });

  const completeMutation = useMutation({
    mutationFn: () => trainingApi.complete(session!.session_id),
    onSuccess: async (result) => {
      const latest = await trainingApi.getSession(session!.session_id);
      setSession((current) => mergeSessionBars(latest, current?.revealed_bars, current?.has_more_history));
      await showCompletionSummary(latest.session_id, result);
      refetchOverview();
      message.success('训练已结束');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '结束训练失败'),
  });

  const replayMutation = useMutation({
    mutationFn: async (item: TrainingOpportunity) => {
      if (!item.session_id) throw new Error('该训练机会暂无复盘记录');
      const data = await trainingApi.getReplay(item.session_id);
      return toReplayState(item.session_id, data, item.display_name || item.security_name || item.symbol, item.opportunity_id);
    },
    onSuccess: (state) => {
      setReplay(state);
      setSession(null);
      setTrainingStartBarIndex(state.training_start_bar_index);
      message.success('已进入复盘模式');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '加载复盘失败'),
  });

  const recordReplayMutation = useMutation({
    mutationFn: async (record: TrainingResult) => {
      if (!record.session_id) throw new Error('该训练记录暂无复盘会话');
      const data = await trainingApi.getReplay(record.session_id);
      return toReplayState(record.session_id, data, record.security_name || record.symbol);
    },
    onSuccess: (state) => {
      setReplay(state);
      setSession(null);
      setTrainingStartBarIndex(state.training_start_bar_index);
      message.success('已进入复盘模式');
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '加载复盘失败'),
  });

  const recordDetailMutation = useMutation({
    mutationFn: async (record: TrainingResult) => {
      if (!record.session_id) throw new Error('该训练记录暂无详情');
      const data = await trainingApi.getReplay(record.session_id);
      return toReplayState(record.session_id, data, record.security_name || record.symbol);
    },
    onSuccess: (state) => setDetailReplay(state),
    onError: (e) => message.error(e instanceof Error ? e.message : '加载详情失败'),
  });

  const latestBar = session?.revealed_bars?.[session.revealed_bars.length - 1];
  const loadHistoryMutation = useMutation({
    mutationFn: (beforeBarIndex: number) => trainingApi.listSessionBars(session!.session_id, { before_bar_index: beforeBarIndex, limit: 80 }),
    onSuccess: (data) => {
      setSession((current) => current ? ({ ...current, revealed_bars: mergeBars(data.bars, current.revealed_bars), has_more_history: data.has_more }) : current);
    },
    onError: (e) => message.error(e instanceof Error ? e.message : '加载历史K线失败'),
  });
  const completed = session?.status === 'COMPLETED' || session?.status === 'BANKRUPT_SETTLED';
  const currentPrice = latestBar?.partial ? latestBar.open : latestBar?.close ?? latestBar?.open ?? 0;
  const availableHands = Math.floor((session?.position?.available_quantity ?? 0) / 100);
  const orderIsConditional = isConditionalOrderType(orderType);
  const orderPriceForMax = orderType === 'LIMIT' ? Number(orderPrice) : currentPrice;
  const maxBuyHands = useMemo(() => maxAffordableHands(session?.current_cash ?? 0, orderPriceForMax), [orderPriceForMax, session?.current_cash]);
  const returnRate = useMemo(() => {
    if (!session?.initial_asset) return 0;
    return (session.current_asset - session.initial_asset) / session.initial_asset;
  }, [session]);

  const submitOrder = (side: 'BUY' | 'SELL', hands: number, values?: Partial<OrderForm>) => {
    const orderTypeValue = (values?.order_type ?? orderForm.getFieldValue('order_type') ?? 'MARKET') as TrainingOrderType;
    const price = values?.price ?? orderForm.getFieldValue('price');
    const handCount = Math.max(1, Math.floor(hands));
    const maxHands = maxAffordableHands(session?.current_cash ?? 0, orderTypeValue === 'LIMIT' ? Number(price) : currentPrice);
    if (!session || completed) return;
    if (side === 'BUY' && handCount > maxHands) {
      message.warning('可用资金不足');
      return;
    }
    if (side === 'SELL' && handCount > availableHands) {
      message.warning('可卖持仓不足');
      return;
    }
    if (isPricedOrderType(orderTypeValue) && (!price || price <= 0)) {
      message.warning(isConditionalOrderType(orderTypeValue) ? '请输入有效触发价' : '请输入有效委托价');
      return;
    }
    orderMutation.mutate({
      side,
      order_type: orderTypeValue,
      price: isPricedOrderType(orderTypeValue) ? price : undefined,
      hand_count: handCount,
    });
  };

  const tradeColumns = useMemo<TableColumnsType<TrainingTrade>>(() => [
    { title: '方向', dataIndex: 'side', width: 70, render: (v: number | string) => <Tag color={sideText(v) === '买入' ? 'green' : 'red'}>{sideText(v)}</Tag> },
    { title: '价格', dataIndex: 'price', width: 90, align: 'right' as const, render: (v: number) => v?.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' as const },
    { title: '成交额', dataIndex: 'amount', width: 100, align: 'right' as const, render: (v: number) => formatMoney(v) },
    { title: '费用', dataIndex: 'total_fee', width: 90, align: 'right' as const, render: (v: number) => formatMoney(v) },
    { title: '阶段', dataIndex: 'stage', width: 90, render: stageText },
    { title: 'K线', dataIndex: 'bar_index', width: 70 },
    { title: '日期', dataIndex: 'trade_date', width: 110, render: (v?: string) => v || '--' },
  ], []);

  const orderColumns = useMemo<TableColumnsType<TrainingOrder>>(() => [
    { title: '方向', dataIndex: 'side', width: 70, render: (v: number | string) => <Tag color={sideText(v) === '买入' ? 'green' : 'red'}>{sideText(v)}</Tag> },
    { title: '类型', dataIndex: 'order_type', width: 70, render: orderTypeText },
    { title: '价格', dataIndex: 'price', width: 90, align: 'right' as const, render: (v: number) => v ? v.toFixed(2) : '市价' },
    { title: '手数', dataIndex: 'hand_count', width: 70, align: 'right' as const },
    { title: '冻结资金', dataIndex: 'frozen_cash', width: 100, align: 'right' as const, render: (v: number) => v ? formatMoney(v) : '--' },
    { title: '冻结股数', dataIndex: 'frozen_quantity', width: 90, align: 'right' as const, render: (v: number) => v || '--' },
    { title: '状态', dataIndex: 'status', width: 90, render: (v: number | string) => <Tag>{orderStatusText(v)}</Tag> },
    { title: '拒绝/备注', dataIndex: 'reject_reason', width: 140, ellipsis: true, render: (v?: string) => v || '--' },
    {
      title: '操作', width: 70, render: (_, record) => pendingOrder(record.status)
        ? <Button type="link" size="small" loading={cancelOrderMutation.isPending} onClick={() => cancelOrderMutation.mutate(record.order_id)}>撤单</Button>
        : null,
    },
  ], [cancelOrderMutation]);

  const compactRecordColumns = useMemo<TableColumnsType<TrainingResult>>(() => [
    {
      title: '训练记录',
      dataIndex: 'security_name',
      render: (value: string, record) => (
        <Space orientation="vertical" size={2} style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Text ellipsis style={{ maxWidth: 130 }}>{value || record.symbol}</Text>
            <Text style={{ color: (record.profit_amount ?? 0) >= 0 ? '#16c784' : '#ea3943' }}>{formatSignedMoney(record.profit_amount)}</Text>
          </Space>
          <Space size={6} wrap>
            <Tag color={record.is_win ? 'green' : 'red'}>{record.is_win ? '盈利' : '亏损'}</Tag>
            {record.source_strategy_id ? <Tag color="blue">策略#{record.source_strategy_id}</Tag> : null}
            <Text type="secondary" style={{ fontSize: 12 }}>{formatPercent(record.return_rate)}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>{record.start_trade_date}</Text>
          </Space>
        </Space>
      ),
    },
    {
      title: '操作',
      width: 136,
      render: (_, record) => (
        <Space size={0}>
          <Button type="link" size="small" loading={recordDetailMutation.isPending} onClick={() => recordDetailMutation.mutate(record)}>详情</Button>
          <Button type="link" size="small" loading={recordReplayMutation.isPending} onClick={() => recordReplayMutation.mutate(record)}>复盘</Button>
          <Button type="link" size="small" icon={<ShareAltOutlined />} onClick={() => setPublishTarget(trainingPublishTarget(record))}>发布</Button>
        </Space>
      ),
    },
  ], [recordDetailMutation, recordReplayMutation]);

  const trades = session?.trades ?? emptyTrades;
  const nextOpportunity = useMemo(() => opportunities.find((item) => isOpportunityUnlocked(item.status)), [opportunities]);
  const activeResult = completionSummary?.result;
  const maxPosition = useMemo(
    () => Math.max(0, ...(completionSummary?.replay?.snapshots ?? []).map((snapshot) => snapshot.position_quantity ?? 0)),
    [completionSummary],
  );
  const recordItems = overview?.recent_records ?? emptyRecords;
  const filteredRecordItems = recordsPage?.items ?? recordItems;
  const recordTotal = recordsPage?.total ?? filteredRecordItems.length;
  const recentStats = overview?.summary ?? {
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
  };
  const closeCompletionModal = () => {
    setResultModalOpen(false);
    setSession(null);
    setTrainingStartBarIndex(undefined);
  };
  const startNextOpportunity = () => {
    if (!nextOpportunity) {
      message.info('当前批次暂无可训练机会');
      return;
    }
    setResultModalOpen(false);
    startMutation.mutate(nextOpportunity.opportunity_id);
  };
  const viewCompletionReplay = async () => {
    if (!completionSummary) return;
    try {
      const replayData = completionSummary.replay ?? await trainingApi.getReplay(completionSummary.session_id);
      setReplay(toReplayState(completionSummary.session_id, replayData, completionSummary.result.security_name || completionSummary.result.symbol));
      setSession(null);
      setTrainingStartBarIndex(findTrainingStartBarIndex(replayData.bars, replayData.result ?? completionSummary.result));
      setResultModalOpen(false);
    } catch (e) {
      message.error(e instanceof Error ? e.message : '加载复盘失败');
    }
  };
  const enterDetailReplay = () => {
    if (!detailReplay) return;
    setReplay(detailReplay);
    setSession(null);
    setTrainingStartBarIndex(detailReplay.training_start_bar_index);
    setDetailReplay(null);
  };
  const disabledTrainingDate = (date: dayjs.Dayjs) => {
    if (date.isAfter(dayjs(), 'day')) return true;
    if (!openDates.length) return false;
    const tradeDate = date.format('YYYY-MM-DD');
    if (!openDateSet.has(tradeDate)) return true;
    return false;
  };
  const applyRecordFilters = (values: RecordFilterForm) => {
    setRecordPage(1);
    setRecordFilters({
      symbol: values.symbol?.trim().toUpperCase() || undefined,
      start_date: values.date_range?.[0]?.format('YYYY-MM-DD'),
      end_date: values.date_range?.[1]?.format('YYYY-MM-DD'),
      only_win: values.outcome === 'WIN' ? true : undefined,
      source_strategy_id: values.source_strategy_id,
    });
  };
  const resetRecordFilters = () => {
    recordFilterForm.resetFields();
    setRecordPage(1);
    setRecordFilters({});
  };

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Modal
        title={<Space><TrophyOutlined /> 本局训练结果</Space>}
        open={resultModalOpen}
        onCancel={closeCompletionModal}
        footer={[
          <Button key="exit" onClick={closeCompletionModal}>退出训练</Button>,
          <Button key="replay" onClick={() => { void viewCompletionReplay(); }}>查看复盘</Button>,
          <Button key="next" type="primary" disabled={!nextOpportunity} loading={startMutation.isPending} onClick={startNextOpportunity}>开启下一局</Button>,
        ]}
      >
        {activeResult ? (
          <Space orientation="vertical" size={12} style={{ width: '100%' }}>
            <Alert
              showIcon
              type={activeResult.is_win ? 'success' : activeResult.bankrupt_after_completed ? 'error' : 'warning'}
              message={activeResult.is_win ? '本局盈利' : activeResult.bankrupt_after_completed ? '本局结束后账户破产' : '本局亏损'}
              description={`${liquidationText(activeResult)}；可进入复盘查看完整委托、成交、费用和买卖点。`}
            />
            <Descriptions size="small" column={2} bordered>
              <Descriptions.Item label="标的">{activeResult.security_name || activeResult.symbol}</Descriptions.Item>
              <Descriptions.Item label="区间">{activeResult.start_trade_date} → {activeResult.end_trade_date}</Descriptions.Item>
              <Descriptions.Item label="期初资产">{formatCurrency(activeResult.initial_asset)}</Descriptions.Item>
              <Descriptions.Item label="期末资产">{formatCurrency(activeResult.final_asset)}</Descriptions.Item>
              <Descriptions.Item label="收益">
                <Text style={{ color: activeResult.profit_amount >= 0 ? '#16c784' : '#ea3943' }}>{formatSignedMoney(activeResult.profit_amount)}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="收益率">{formatPercent(activeResult.return_rate)}</Descriptions.Item>
              <Descriptions.Item label="最大回撤">{formatPercent(activeResult.max_drawdown)}</Descriptions.Item>
              <Descriptions.Item label="交易胜率">{activeResult.success_rate == null ? '--' : formatPercent(activeResult.success_rate)}</Descriptions.Item>
              <Descriptions.Item label="交易次数">{activeResult.trade_count}</Descriptions.Item>
              <Descriptions.Item label="最大持仓">{maxPosition}</Descriptions.Item>
              <Descriptions.Item label="持仓天数">{activeResult.holding_days}</Descriptions.Item>
              <Descriptions.Item label="总费用">{formatCurrency(activeResult.total_fee)}</Descriptions.Item>
              <Descriptions.Item label="强平状态">{liquidationText(activeResult)}</Descriptions.Item>
              <Descriptions.Item label="完成时间">{formatDateTime(activeResult.completed_at)}</Descriptions.Item>
            </Descriptions>
            {renderTradeBreakdownCards(buildTradeBreakdown(activeResult, completionSummary?.replay?.trades ?? []))}
          </Space>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无结果" />}
        {nextOpportunity && <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>下一局：{nextOpportunity.display_name || `训练机会 ${nextOpportunity.sequence_no}`}</Paragraph>}
      </Modal>
      <Modal
        title={detailReplay ? `${detailReplay.display_name} · 训练详情` : '训练详情'}
        open={!!detailReplay}
        width={980}
        onCancel={() => setDetailReplay(null)}
        footer={[
          <Button key="close" onClick={() => setDetailReplay(null)}>关闭</Button>,
          <Button key="detail" onClick={() => detailReplay && navigate(`/trainings/records/${detailReplay.session_id}`)}>打开详情页</Button>,
          <Button key="replay" type="primary" onClick={enterDetailReplay}>进入复盘</Button>,
        ]}
      >
        {detailReplay ? (
          <Space orientation="vertical" size={14} style={{ width: '100%' }}>
            <Descriptions size="small" column={3} bordered>
              <Descriptions.Item label="标的">{detailReplay.result?.security_name || detailReplay.result?.symbol || '已揭晓'}</Descriptions.Item>
              <Descriptions.Item label="区间">{detailReplay.result ? `${detailReplay.result.start_trade_date} → ${detailReplay.result.end_trade_date}` : '--'}</Descriptions.Item>
              <Descriptions.Item label="收益率">{formatPercent(detailReplay.result?.return_rate)}</Descriptions.Item>
              <Descriptions.Item label="收益"><Text style={{ color: (detailReplay.result?.profit_amount ?? 0) >= 0 ? '#16c784' : '#ea3943' }}>{formatSignedMoney(detailReplay.result?.profit_amount)}</Text></Descriptions.Item>
              <Descriptions.Item label="最大回撤">{formatPercent(detailReplay.result?.max_drawdown)}</Descriptions.Item>
              <Descriptions.Item label="交易次数">{detailReplay.result?.trade_count ?? detailReplay.trades.length}</Descriptions.Item>
            </Descriptions>
            {renderReplayParameters(detailReplay)}
            {renderTradeBreakdownCards(buildTradeBreakdown(detailReplay.result, detailReplay.trades ?? []))}
            <Table rowKey="order_id" size="small" columns={orderColumns} dataSource={detailReplay.orders ?? []} pagination={false} locale={{ emptyText: '暂无委托' }} />
            <Table rowKey="trade_id" size="small" columns={tradeColumns} dataSource={detailReplay.trades ?? []} pagination={false} locale={{ emptyText: '暂无成交' }} />
          </Space>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无详情" />}
      </Modal>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Space>
          <ThunderboltOutlined style={{ fontSize: 20, color: '#16c784' }} />
          <Title level={4} style={{ margin: 0 }}>K线训练</Title>
        </Space>
        {(session || replay) && (
          <Space>
            {session ? <Tag color={statusColor(session.status)}>{session.status}</Tag> : <Tag color="blue">复盘模式</Tag>}
            {session && <Tag>{stageText(session.current_stage)}</Tag>}
          </Space>
        )}
      </div>

      <Row gutter={16}>
        <Col span={6}><MetricCard title="训练账户资产" value={account?.total_asset ?? 0} precision={2} /></Col>
        <Col span={6}><MetricCard title="累计胜率" value={(account?.win_rate ?? 0) * 100} precision={2} suffix="%" /></Col>
        <Col span={6}><MetricCard title="训练次数" value={account?.training_count ?? 0} precision={0} /></Col>
        <Col span={6}><MetricCard title="破产次数" value={account?.bankrupt_count ?? 0} precision={0} valueColor="#ea3943" /></Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}><MetricCard title="累计收益" value={account?.cumulative_profit ?? 0} precision={2} valueColor={(account?.cumulative_profit ?? 0) >= 0 ? '#16c784' : '#ea3943'} /></Col>
        <Col span={6}><MetricCard title="累计收益率" value={(account?.cumulative_return ?? 0) * 100} precision={2} suffix="%" valueColor={(account?.cumulative_return ?? 0) >= 0 ? '#16c784' : '#ea3943'} /></Col>
        <Col span={6}><MetricCard title="最大回撤" value={(account?.max_drawdown ?? 0) * 100} precision={2} suffix="%" valueColor="#ea3943" /></Col>
        <Col span={6}><MetricCard title="总交易次数" value={account?.total_trade_count ?? 0} precision={0} /></Col>
      </Row>

      <Card title="个人训练统计" size="small">
        <Row gutter={16}>
          <Col span={4}><Statistic title="最近复盘数" value={recentStats.sample_count} /></Col>
          <Col span={4}><Statistic title="最近胜率" value={recentStats.win_rate * 100} precision={2} suffix="%" /></Col>
          <Col span={4}><Statistic title="最近收益" value={recentStats.total_profit} precision={2} valueStyle={{ color: recentStats.total_profit >= 0 ? '#16c784' : '#ea3943' }} /></Col>
          <Col span={4}><Statistic title="平均收益率" value={recentStats.avg_return * 100} precision={2} suffix="%" /></Col>
          <Col span={4}><Statistic title="平均持仓" value={recentStats.avg_holding_days} precision={1} suffix="天" /></Col>
          <Col span={4}><Statistic title="最近最大回撤" value={recentStats.max_drawdown * 100} precision={2} suffix="%" valueStyle={{ color: '#ea3943' }} /></Col>
        </Row>
        <Row gutter={16} style={{ marginTop: 12 }}>
          <Col span={12}>
            <Text type="secondary">最佳单局：</Text>
            <Text style={{ color: '#16c784' }}>{recentStats.best_record ? `${replayTitle(recentStats.best_record)} · ${formatSignedMoney(recentStats.best_record.profit_amount)} (${formatPercent(recentStats.best_record.return_rate)})` : '--'}</Text>
          </Col>
          <Col span={12}>
            <Text type="secondary">最大亏损：</Text>
            <Text style={{ color: '#ea3943' }}>{recentStats.worst_record ? `${replayTitle(recentStats.worst_record)} · ${formatSignedMoney(recentStats.worst_record.profit_amount)} (${formatPercent(recentStats.worst_record.return_rate)})` : '--'}</Text>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} align="top">
        <Col span={7}>
          <Card title="创建训练" size="small">
            {hasStrategySource && (
              <Alert
                showIcon
                type="info"
                style={{ marginBottom: 12 }}
                message="策略选股训练"
                description={
                  <Space orientation="vertical" size={2}>
                    <Text>使用「{sourceStrategy?.title || `策略 #${sourceStrategyId}`}」的选股公式生成训练机会。</Text>
                    <Text type="secondary">版本：{sourceVersion ? `v${sourceVersion.version_no || sourceVersion.id}` : `#${sourceVersionId}`}；训练过程仍由你手动买卖。</Text>
                  </Space>
                }
              />
            )}
            <Form<CreateForm>
              form={form}
              layout="vertical"
              initialValues={{
                mode: 'BLIND_RANDOM', adjustment_type: 'pre', bar_count: 30,
                buy_commission_rate: 0.0003, sell_commission_rate: 0.0003, stamp_tax_rate: 0.001, min_commission: 5,
              }}
              onFinish={(values) => createMutation.mutate(values)}
            >
              <Form.Item name="mode" label="训练模式">
                <Select options={[{ label: '双盲随机', value: 'BLIND_RANDOM' }, { label: '指定日期', value: 'SPECIFIED_DATE' }]} />
              </Form.Item>
              <Form.Item name="formula_text" label="选择本地选股公式">
                <Select
                  allowClear
                  showSearch
                  disabled={hasStrategySource}
                  optionFilterProp="label"
                  placeholder={hasStrategySource ? '已使用策略版本中的选股公式' : '可选；不选则双盲随机'}
                  options={formulaOptions}
                  notFoundContent="暂无本地选股公式"
                />
              </Form.Item>
              <Form.Item
                name="formula_id"
                label={hasStrategySource ? '来源策略版本ID' : '或输入策略版本ID'}
                extra={hasStrategySource ? '后端会按该策略版本的选股公式执行选股。' : undefined}
              >
                <Input disabled={hasStrategySource} placeholder="可选；未选择本地公式时由后端解析" />
              </Form.Item>
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="exchange" label="交易所" style={{ width: '50%' }}>
                  <Select allowClear options={[{ label: '上交所', value: 'SSE' }, { label: '深交所', value: 'SZSE' }, { label: '北交所', value: 'BSE' }]} />
                </Form.Item>
                <Form.Item name="bar_count" label="K线数" style={{ width: '50%' }}>
                  <Select options={[30, 60, 120, 240].map((v) => ({ label: `${v}根`, value: v }))} />
                </Form.Item>
              </Space.Compact>
              {mode === 'SPECIFIED_DATE' && (
                <Form.Item
                  name="selected_date"
                  label="选股日期"
                  extra="优先选择交易日；后端会按实际标的校验前120根和后续训练K线是否充足。"
                  rules={[{ required: true, message: '请选择日期' }]}
                >
                  <DatePicker disabledDate={disabledTrainingDate} style={{ width: '100%' }} />
                </Form.Item>
              )}
              <Space.Compact style={{ width: '100%' }}>
                <Form.Item name="buy_commission_rate" label="买佣" style={{ width: '50%' }}><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item>
                <Form.Item name="stamp_tax_rate" label="印花税" style={{ width: '50%' }}><InputNumber min={0} step={0.0001} style={{ width: '100%' }} /></Form.Item>
              </Space.Compact>
              <Button block type="primary" htmlType="submit" icon={<PlayCircleOutlined />} loading={createMutation.isPending}>生成训练机会</Button>
            </Form>
          </Card>

          <Card title="训练机会" size="small" style={{ marginTop: 16, minHeight: 220 }}>
            {!opportunities.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无训练机会" /> : (
              <List
                size="small"
                dataSource={opportunities}
                renderItem={(item) => (
                  <List.Item
                    actions={[
                      isOpportunityCompleted(item.status)
                        ? <Button size="small" type="link" loading={replayMutation.isPending} onClick={() => replayMutation.mutate(item)}>复盘</Button>
                        : <Button size="small" type="link" disabled={isOpportunityLocked(item.status)} loading={startMutation.isPending} onClick={() => startMutation.mutate(item.opportunity_id)}>{isOpportunityInProgress(item.status) ? '继续' : '开始'}</Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Space><Text>{item.display_name || `训练机会 ${item.sequence_no}`}</Text><Tag>{opportunityStatusText(item.status)}</Tag></Space>}
                      description={`${item.symbol ? `${item.symbol} · ` : ''}${item.bar_count} 根K线 · ${item.exchange || '全部交易所'}`}
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>

        </Col>

        <Col span={17}>
          <Card
            title={replay ? `${replay.display_name} · 训练复盘` : session ? `${session.display_name} · ${stageText(session.current_stage)} · 第 ${session.current_bar_index + 1} 根` : '训练复盘中心'}
            extra={replay
              ? <Button onClick={() => setReplay(null)}>返回训练看板</Button>
              : session && <Button danger disabled={completed} onClick={() => completeMutation.mutate()} loading={completeMutation.isPending}>结束训练</Button>}
          >
            {replay ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <TrainingKLineChart
                  bars={replay.bars ?? []}
                  trades={replay.trades ?? []}
                  trainingStartBarIndex={replay.training_start_bar_index}
                  height={430}
                />
                <Descriptions size="small" column={4} bordered>
                  <Descriptions.Item label="标的">{replay.result?.security_name || replay.result?.symbol || '已揭晓'}</Descriptions.Item>
                  <Descriptions.Item label="区间">{replay.result ? `${replay.result.start_trade_date} → ${replay.result.end_trade_date}` : '--'}</Descriptions.Item>
                  <Descriptions.Item label="期初资产">{formatCurrency(replay.result?.initial_asset)}</Descriptions.Item>
                  <Descriptions.Item label="期末资产">{formatCurrency(replay.result?.final_asset)}</Descriptions.Item>
                  <Descriptions.Item label="收益">
                    <Text style={{ color: (replay.result?.profit_amount ?? 0) >= 0 ? '#16c784' : '#ea3943' }}>{formatSignedMoney(replay.result?.profit_amount)}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="收益率">{formatPercent(replay.result?.return_rate)}</Descriptions.Item>
                  <Descriptions.Item label="最大回撤">{formatPercent(replay.result?.max_drawdown)}</Descriptions.Item>
                  <Descriptions.Item label="交易次数">{replay.result?.trade_count ?? replay.trades.length}</Descriptions.Item>
                  <Descriptions.Item label="胜率">{replay.result?.success_rate == null ? '--' : formatPercent(replay.result.success_rate)}</Descriptions.Item>
                  <Descriptions.Item label="最大持仓">{Math.max(0, ...(replay.snapshots ?? []).map((snapshot) => snapshot.position_quantity ?? 0))}</Descriptions.Item>
                  <Descriptions.Item label="持仓天数">{replay.result?.holding_days ?? '--'}</Descriptions.Item>
                  <Descriptions.Item label="总费用">{formatCurrency(replay.result?.total_fee)}</Descriptions.Item>
                  <Descriptions.Item label="强平状态">{liquidationText(replay.result)}</Descriptions.Item>
                  <Descriptions.Item label="完成时间">{formatDateTime(replay.result?.completed_at)}</Descriptions.Item>
                </Descriptions>
                {renderReplayParameters(replay)}
                {renderTradeBreakdownCards(buildTradeBreakdown(replay.result, replay.trades ?? []))}
                <Table rowKey="order_id" size="small" columns={orderColumns} dataSource={replay.orders ?? []} pagination={false} locale={{ emptyText: '暂无委托' }} />
                <Table rowKey="trade_id" size="small" columns={tradeColumns} dataSource={replay.trades ?? []} pagination={false} locale={{ emptyText: '暂无成交' }} />
              </Space>
            ) : !session ? (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <Row gutter={16}>
                  <Col span={6}><Statistic title="复盘样本收益" value={recentStats.total_profit} precision={2} valueStyle={{ color: recentStats.total_profit >= 0 ? '#16c784' : '#ea3943' }} /></Col>
                  <Col span={6}><Statistic title="复盘样本胜率" value={recentStats.win_rate * 100} precision={2} suffix="%" /></Col>
                  <Col span={6}><Statistic title="平均交易次数" value={recentStats.avg_trade_count} precision={1} /></Col>
                  <Col span={6}><Statistic title="最大回撤" value={recentStats.max_drawdown * 100} precision={2} suffix="%" /></Col>
                </Row>
                {renderTrainingHeatmap(heatmapItems)}
                <Card size="small" title="复盘筛选">
                  <Form<RecordFilterForm>
                    form={recordFilterForm}
                    layout="inline"
                    initialValues={{ outcome: 'ALL' }}
                    onFinish={applyRecordFilters}
                  >
                    <Form.Item name="symbol" label="标的">
                      <Input allowClear placeholder="如 600000" style={{ width: 140 }} />
                    </Form.Item>
                    <Form.Item name="date_range" label="训练区间">
                      <DatePicker.RangePicker allowClear style={{ width: 250 }} />
                    </Form.Item>
                    <Form.Item name="outcome" label="结果">
                      <Select style={{ width: 110 }} options={[{ label: '全部', value: 'ALL' }, { label: '盈利', value: 'WIN' }]} />
                    </Form.Item>
                    <Form.Item name="source_strategy_id" label="策略ID">
                      <InputNumber min={1} precision={0} style={{ width: 110 }} />
                    </Form.Item>
                    <Form.Item>
                      <Space>
                        <Button type="primary" htmlType="submit" loading={recordsFetching}>查询</Button>
                        <Button onClick={resetRecordFilters}>重置</Button>
                      </Space>
                    </Form.Item>
                  </Form>
                </Card>
                <Table
                  rowKey="result_id"
                  dataSource={filteredRecordItems}
                  loading={recordsFetching}
                  pagination={{
                    current: recordPage,
                    pageSize: recordPageSize,
                    total: recordTotal,
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条训练记录`,
                    onChange: (page, pageSize) => {
                      setRecordPage(page);
                      setRecordPageSize(pageSize);
                    },
                  }}
                  size="small"
                  columns={compactRecordColumns}
                  tableLayout="fixed"
                  locale={{ emptyText: '暂无训练记录；创建训练并完成后可在这里复盘' }}
                />
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  这里用于快速回看最近训练：K线、训练起点、BS买卖点、委托和成交明细会在点击复盘后完整还原。
                </Paragraph>
              </Space>
            ) : (
              <Space orientation="vertical" size={16} style={{ width: '100%' }}>
                <TrainingKLineChart
                  bars={session.revealed_bars ?? []}
                  trades={session.trades ?? []}
                  trainingStartBarIndex={trainingStartBarIndex}
                  hasMoreHistory={!!session.has_more_history}
                  loadingHistory={loadHistoryMutation.isPending}
                  onLoadEarlier={(beforeBarIndex) => loadHistoryMutation.mutate(beforeBarIndex)}
                />
                <Row gutter={16}>
                  <Col span={6}><Statistic title="当前价格" value={currentPrice} precision={2} /></Col>
                  <Col span={6}><Statistic title="现金" value={session.current_cash} precision={2} /></Col>
                  <Col span={6}><Statistic title="持仓" value={session.position?.total_quantity ?? 0} precision={0} /></Col>
                  <Col span={6}><Statistic title="本轮收益率" value={returnRate * 100} precision={2} suffix="%" styles={{ content: { color: returnRate >= 0 ? '#16c784' : '#ea3943' } }} /></Col>
                </Row>
                {!completed && (
                  <Card size="small" title="交易下单">
                    <Form<OrderForm>
                      form={orderForm}
                      layout="inline"
                      initialValues={{ order_type: 'MARKET', hand_count: 1 }}
                      onFinish={(values) => submitOrder(isConditionalOrderType(values.order_type) ? 'SELL' : 'BUY', values.hand_count, values)}
                    >
                      <Form.Item name="order_type" label="类型">
                        <Select
                          style={{ width: 110 }}
                          options={[
                            { label: '市价', value: 'MARKET' },
                            { label: '限价', value: 'LIMIT' },
                            { label: '止盈', value: 'TAKE_PROFIT' },
                            { label: '止损', value: 'STOP_LOSS' },
                          ]}
                        />
                      </Form.Item>
                      {isPricedOrderType(orderType) && (
                        <Form.Item name="price" label={orderIsConditional ? '触发价' : '委托价'} rules={[{ required: true, message: orderIsConditional ? '请输入触发价' : '请输入委托价' }]}> 
                          <InputNumber min={0.01} step={0.01} precision={2} style={{ width: 110 }} />
                        </Form.Item>
                      )}
                      <Form.Item
                        name="hand_count"
                        label="手数"
                        rules={[
                          { required: true, message: '请输入手数' },
                          {
                            validator: async (_, value) => {
                              if (!value) return;
                              const maxHands = Math.max(maxBuyHands, availableHands);
                              if (maxHands > 0 && value > maxHands) throw new Error(`最大可输入 ${maxHands} 手`);
                            },
                          },
                        ]}
                      >
                        <InputNumber min={1} max={Math.max(maxBuyHands, availableHands) || undefined} precision={0} style={{ width: 100 }} />
                      </Form.Item>
                      <Form.Item>
                        <Space wrap>
                          {!orderIsConditional && <Button type="primary" disabled={maxBuyHands < 1} loading={orderMutation.isPending} onClick={() => submitOrder('BUY', Math.max(1, Math.floor(maxBuyHands / 2)))}>半仓买入</Button>}
                          {!orderIsConditional && <Button type="primary" disabled={maxBuyHands < 1} loading={orderMutation.isPending} onClick={() => submitOrder('BUY', maxBuyHands)}>全仓买入</Button>}
                          <Button type={orderIsConditional ? 'default' : 'primary'} danger={orderIsConditional} disabled={orderIsConditional && availableHands < 1} loading={orderMutation.isPending} htmlType="submit">{orderIsConditional ? '设置条件单' : '按手数买入'}</Button>
                          {!orderIsConditional && <Button danger disabled={availableHands < 1} loading={orderMutation.isPending} onClick={() => submitOrder('SELL', orderForm.getFieldValue('hand_count') ?? 1)}>按手数卖出</Button>}
                          {!orderIsConditional && <Button danger disabled={availableHands < 1} loading={orderMutation.isPending} onClick={() => submitOrder('SELL', availableHands)}>全仓卖出</Button>}
                          <Button loading={advanceMutation.isPending} onClick={() => advanceMutation.mutate()}>下一阶段</Button>
                        </Space>
                      </Form.Item>
                    </Form>
                    <Text type="secondary">按当前{orderType === 'LIMIT' ? '委托价' : '阶段价'}可买约 {maxBuyHands} 手，可卖 {availableHands} 手；限价单当日有效，止盈/止损为长期有效条件卖单。</Text>
                  </Card>
                )}
                <Table rowKey="order_id" size="small" columns={orderColumns} dataSource={session.orders ?? []} pagination={false} locale={{ emptyText: '暂无委托' }} />
                <Table rowKey="trade_id" size="small" columns={tradeColumns} dataSource={trades} pagination={false} locale={{ emptyText: '暂无成交' }} />
              </Space>
            )}
          </Card>
        </Col>
      </Row>

      {batchId && <Paragraph type="secondary" style={{ marginTop: -4, marginBottom: 0 }}>当前批次：{batchId}</Paragraph>}
      <CommunityPublishModal
        open={!!publishTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPublishTarget(null);
        }}
        initialTarget={publishTarget}
        onPublished={(contentId) => navigate(`/community/${contentId}`)}
      />
    </Space>
  );
}
