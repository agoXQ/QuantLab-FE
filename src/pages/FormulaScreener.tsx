import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, App, Button, Card, Col, DatePicker, Empty, Form, Input, InputNumber, Modal, Row, Select, Space, Statistic, Table, Tag, Typography } from 'antd';
import { AppstoreOutlined, ExperimentOutlined, FilterOutlined, PlayCircleOutlined, SaveOutlined, StockOutlined } from '@ant-design/icons';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import dayjs, { type Dayjs } from 'dayjs';
import FormulaEditor from '@/components/FormulaEditor';
import { formulaApi, type ScreenResult } from '@/api/formula';
import { marketApi, type MarketBar } from '@/api/market';
import { strategyApi } from '@/api/strategy';
import { useFormulaStore } from '@/store/formula';
import { ApiError } from '@/api/client';
import { useSearchParams } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;

type UniverseMode = 'filtered' | 'manual';

interface SaveFormulaForm {
  name: string;
  description: string;
}

interface ScreenerRow {
  key: string;
  rank: number;
  stock_code: string;
  stock_name: string;
  exchange: string;
  industry: string;
  score?: number;
}

const exchangeLabel: Record<string, string> = {
  SSE: '上交所',
  SZSE: '深交所',
  BSE: '北交所',
};

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function parseManualCodes(raw: string) {
  return Array.from(
    new Set(
      raw
        .split(/[\s,，;；]+/)
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export default function FormulaScreener() {
  const { message } = App.useApp();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const sourceStrategyId = Number(searchParams.get('strategy_id') || 0);
  const sourceVersionId = Number(searchParams.get('version_id') || 0);
  const formulaStore = useFormulaStore();
  const [expr, setExpr] = useState('CLOSE > MA(CLOSE,20) AND VOL > MA(VOL,5)');
  const [asOf, setAsOf] = useState<Dayjs | null>(dayjs());
  const [mode, setMode] = useState<UniverseMode>('filtered');
  const [exchange, setExchange] = useState<string | undefined>();
  const [industry, setIndustry] = useState<string | undefined>();
  const [manualCodes, setManualCodes] = useState('');
  const [maxUniverse, setMaxUniverse] = useState<number>(500);
  const [saveOpen, setSaveOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<ScreenerRow | null>(null);
  const [form] = Form.useForm<SaveFormulaForm>();
  const hasStrategySource = sourceStrategyId > 0 && sourceVersionId > 0;

  const { data: exchangeOptions = [] } = useQuery({
    queryKey: ['market-exchanges'],
    queryFn: () => marketApi.listExchanges(),
    staleTime: 300_000,
  });

  const { data: industryOptions = [] } = useQuery({
    queryKey: ['market-industries'],
    queryFn: () => marketApi.listIndustries(),
    staleTime: 300_000,
  });

  const { data: remoteFormulas = [] } = useQuery({
    queryKey: ['saved-formulas'],
    queryFn: () => formulaApi.listSaved({ rule_type: 'stock_select', limit: 200 }),
    retry: false,
  });

  const { data: sourceStrategy } = useQuery({
    queryKey: ['screener-source-strategy', sourceStrategyId],
    queryFn: () => strategyApi.get(sourceStrategyId),
    enabled: hasStrategySource,
    staleTime: 60_000,
  });

  const { data: sourceVersion } = useQuery({
    queryKey: ['screener-source-version', sourceVersionId],
    queryFn: () => strategyApi.getVersion(sourceVersionId),
    enabled: hasStrategySource,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!hasStrategySource || !sourceVersion) return;
    const formula = sourceVersion.formula_text?.trim();
    if (!formula) {
      message.warning('该策略版本未返回可用于选股的公式');
      return;
    }
    setExpr(formula);
  }, [hasStrategySource, message, sourceVersion]);

  const savedStockSelectFormulas = remoteFormulas.length > 0
    ? remoteFormulas
    : formulaStore.getByType('stock_select');

  const exchanges = useMemo(() => uniqueSorted(exchangeOptions), [exchangeOptions]);
  const industries = useMemo(() => uniqueSorted(industryOptions), [industryOptions]);

  const universe = useMemo(() => {
    if (mode === 'manual') return parseManualCodes(manualCodes).slice(0, maxUniverse);
    return [];
  }, [manualCodes, maxUniverse, mode]);

  const evaluateMutation = useMutation({
    mutationFn: () => {
      const formula = expr.trim();
      if (!formula) throw new Error('请输入选股公式');
      if (mode === 'manual' && universe.length === 0) throw new Error('请输入手工股票代码');
      return formulaApi.screen({
        formula,
        as_of_date: asOf ? asOf.format('YYYY-MM-DD') : undefined,
        limit: maxUniverse,
        universe_filter: mode === 'manual'
          ? { stock_codes: universe }
          : { exchange, industry },
      });
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '选股失败');
    },
  });

  const result = evaluateMutation.data;
  const rows = useMemo(() => buildRows(result), [result]);

  const selectedDate = asOf ? asOf.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
  const [klineQuery, setKlineQuery] = useState<{ direction: 'backward' | 'forward'; anchorDate: string } | undefined>();
  const [klineRightBoundary, setKlineRightBoundary] = useState<string | undefined>();
  const [klineBars, setKlineBars] = useState<MarketBar[]>([]);

  useEffect(() => {
    if (!selectedStock) return;
    setKlineQuery({ direction: 'backward', anchorDate: selectedDate });
    setKlineRightBoundary(selectedDate);
    setKlineBars([]);
  }, [selectedDate, selectedStock]);

  const { data: barsData, isLoading: barsLoading, isFetching: barsFetching } = useQuery({
    queryKey: ['screener-bars', selectedStock?.stock_code, klineQuery?.direction, klineQuery?.anchorDate],
    queryFn: () => marketApi.getBars({
      stock_code: selectedStock!.stock_code,
      start_date: klineQuery?.direction === 'forward' ? klineQuery.anchorDate : undefined,
      end_date: klineQuery?.direction === 'backward' ? klineQuery.anchorDate : undefined,
      period: 'day',
      adjustment: 'pre',
      limit: KLINE_QUERY_LIMIT,
    }),
    enabled: !!selectedStock && !!klineQuery,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!barsData?.items?.length) return;
    setKlineBars((prev) => mergeMarketBars(prev, barsData.items));
  }, [barsData]);

  const handleLoadEarlier = useCallback((anchorDate: string) => {
    setKlineQuery((prev) => prev?.direction === 'backward' && prev.anchorDate === anchorDate ? prev : { direction: 'backward', anchorDate });
  }, []);

  const handleUnlockNextBar = useCallback((anchorDate: string) => {
    setKlineQuery((prev) => prev?.direction === 'forward' && prev.anchorDate === anchorDate ? prev : { direction: 'forward', anchorDate });
  }, []);

  const handleSaveFormula = async () => {
    const values = await form.validateFields();
    if (!expr.trim()) {
      message.error('请输入选股公式');
      return;
    }
    try {
      await formulaApi.createSaved({
        name: values.name,
        description: values.description,
        expression: expr,
        rule_type: 'stock_select',
      });
      qc.invalidateQueries({ queryKey: ['saved-formulas'] });
    } catch (e) {
      formulaStore.add({
        name: values.name,
        description: values.description,
        expression: expr,
        rule_type: 'stock_select',
      });
      message.warning(e instanceof ApiError ? `后端保存失败，已暂存本地：${e.message}` : '后端保存失败，已暂存本地');
      setSaveOpen(false);
      form.resetFields();
      return;
    }
    setSaveOpen(false);
    form.resetFields();
    message.success('选股公式已保存');
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <FilterOutlined style={{ fontSize: 20, color: '#16c784' }} />
          <Title level={4} style={{ margin: 0 }}>公式选股</Title>
        </Space>
        <Space>
          <Button icon={<SaveOutlined />} onClick={() => setSaveOpen(true)}>保存公式</Button>
          <Button type="primary" icon={<PlayCircleOutlined />} loading={evaluateMutation.isPending} onClick={() => evaluateMutation.mutate()}>
            开始选股
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        <Col span={15}>
          <Card title={<Space><ExperimentOutlined /> 选股公式</Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              {hasStrategySource && (
                <Alert
                  showIcon
                  type="info"
                  message="使用策略版本选股"
                  description={`来源：${sourceStrategy?.title || `策略 #${sourceStrategyId}`} · ${sourceVersion ? `v${sourceVersion.version_no || sourceVersion.id}` : `版本 #${sourceVersionId}`}`}
                />
              )}
              <Select
                placeholder="从公式库加载选股公式"
                style={{ width: 320 }}
                allowClear
                suffixIcon={<AppstoreOutlined />}
                options={savedStockSelectFormulas.map((f) => ({ label: f.name, value: f.id }))}
                onChange={(id) => {
                  const formula = savedStockSelectFormulas.find((f) => f.id === id);
                  if (formula) setExpr(formula.expression);
                }}
              />
              <FormulaEditor value={expr} onChange={setExpr} height="160px" placeholder="CLOSE > MA(CLOSE,20) AND VOL > MA(VOL,5)" />
              <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
                选股公式应返回 Boolean，系统会对股票池逐只执行，并展示命中的股票。
              </Paragraph>
            </Space>
          </Card>
        </Col>
        <Col span={9}>
          <Card title={<Space><StockOutlined /> 股票池</Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Select
                  value={mode}
                  onChange={setMode}
                  style={{ width: '100%' }}
                  options={[{ label: '筛选股票池', value: 'filtered' }, { label: '手工代码', value: 'manual' }]}
                />
                {mode === 'filtered' ? (
                  <>
                    <Select allowClear placeholder="交易所" value={exchange} onChange={setExchange} style={{ width: '100%' }} options={exchanges.map((x) => ({ label: exchangeLabel[x] ?? x, value: x }))} />
                    <Select showSearch allowClear placeholder="行业（可不选）" value={industry} onChange={setIndustry} style={{ width: '100%' }} options={industries.map((x) => ({ label: x, value: x }))} />
                  </>
                ) : (
                  <Input.TextArea rows={4} value={manualCodes} onChange={(e) => setManualCodes(e.target.value)} placeholder="例如：600519 000001 300750" />
                )}
                <DatePicker value={asOf} onChange={setAsOf} style={{ width: '100%' }} />
                <InputNumber min={1} max={1000} value={maxUniverse} onChange={(v) => setMaxUniverse(v ?? 500)} style={{ width: '100%' }} addonBefore="最多返回" addonAfter="只" />
                <Row gutter={12}>
                  <Col span={12}><Statistic title="返回上限" value={maxUniverse} suffix="只" /></Col>
                  <Col span={12}><Statistic title="命中" value={rows.length} suffix="只" /></Col>
                </Row>
              </Space>
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><Text strong>选股结果</Text>{result && <Tag bordered={false}>{result.plan_type}</Tag>}</Space>}
        extra={result?.formula_hash ? <Text style={{ color: '#8b949e', fontSize: 11 }}>hash: {result.formula_hash.slice(0, 16)}...</Text> : null}
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="key"
          dataSource={rows}
          onRow={(row) => ({ onClick: () => setSelectedStock(row), style: { cursor: 'pointer' } })}
          columns={[
            { title: '#', dataIndex: 'rank', width: 64, render: (v: number) => <Text style={{ fontFamily: 'monospace', color: v <= 3 ? '#f0b90b' : '#8b949e' }}>{v}</Text> },
            { title: '股票代码', dataIndex: 'stock_code', width: 120, render: (v: string) => <Text style={{ fontFamily: 'monospace' }}>{v}</Text> },
            { title: '名称', dataIndex: 'stock_name', width: 160 },
            { title: '交易所', dataIndex: 'exchange', width: 100, render: (v: string) => <Tag bordered={false}>{exchangeLabel[v] ?? v}</Tag> },
            { title: '行业', dataIndex: 'industry', ellipsis: true },
            { title: '分数', dataIndex: 'score', width: 120, align: 'right' as const, render: (v?: number) => v == null ? <Text type="secondary">-</Text> : <Text style={{ fontFamily: 'monospace', color: '#16c784' }}>{v.toFixed(4)}</Text> },
          ]}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: <Empty description="执行选股后查看结果" style={{ padding: 32 }} /> }}
        />
      </Card>

      <Modal
        title={selectedStock ? `${selectedStock.stock_code} ${selectedStock.stock_name}` : 'K线'}
        open={!!selectedStock}
        onCancel={() => setSelectedStock(null)}
        footer={null}
        width={860}
        destroyOnHidden
      >
        <KLineChart
          key={`${selectedStock?.stock_code ?? 'stock'}-${selectedDate}`}
          bars={klineBars}
          selectedDate={selectedDate}
          rightBoundaryDate={klineRightBoundary}
          loading={barsLoading || barsFetching}
          onLoadEarlier={handleLoadEarlier}
          onUnlockNext={handleUnlockNextBar}
          onRightBoundaryChange={setKlineRightBoundary}
        />
      </Modal>

      <Modal title="保存选股公式" open={saveOpen} onCancel={() => setSaveOpen(false)} onOk={handleSaveFormula} okText="保存" destroyOnHidden>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="公式名称" rules={[{ required: true, message: '请输入公式名称' }, { max: 40 }]}> 
            <Input placeholder="例如：价量趋势" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="一句话说明选股逻辑" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}

function buildRows(result: ScreenResult | undefined): ScreenerRow[] {
  if (!result) return [];
  return (result.items ?? []).map((item, i) => ({
    key: item.stock_code,
    rank: i + 1,
    stock_code: item.stock_code,
    stock_name: item.stock_name || '-',
    exchange: item.exchange || '-',
    industry: item.industry || '-',
    score: item.score,
  }));
}

function mergeMarketBars(current: MarketBar[], incoming: MarketBar[]) {
  const byDate = new Map<string, MarketBar>();
  current.forEach((bar) => {
    const date = normalizeTradeDate(bar.trade_date);
    if (date) byDate.set(date, bar);
  });
  incoming.forEach((bar) => {
    const date = normalizeTradeDate(bar.trade_date);
    if (date) byDate.set(date, bar);
  });
  return Array.from(byDate.values()).sort((a, b) => {
    const left = normalizeTradeDate(a.trade_date) ?? '';
    const right = normalizeTradeDate(b.trade_date) ?? '';
    return left.localeCompare(right);
  });
}

function barOpen(bar: MarketBar) { return bar.open ?? bar.open_price ?? 0; }
function barHigh(bar: MarketBar) { return bar.high ?? bar.high_price ?? 0; }
function barLow(bar: MarketBar) { return bar.low ?? bar.low_price ?? 0; }
function barClose(bar: MarketBar) { return bar.close ?? bar.close_price ?? 0; }
function barVolume(bar: MarketBar) { return Number(bar.volume ?? 0); }

const DEFAULT_VISIBLE_BARS = 120;
const MIN_VISIBLE_BARS = 40;
const PRELOAD_BAR_THRESHOLD = 80;
const KLINE_QUERY_LIMIT = 320;
const IS_DEV = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV);

type PendingNextBar = {
  anchorDate: string;
  targetDate?: string;
  visibleSpan: number;
};

type ChartBar = {
  source: MarketBar;
  tradeDate: string;
  time: Time;
};

const normalizeTradeDate = (value: string | undefined) => {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const prefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
};

const tradeDateToBusinessDay = (tradeDate: string) => {
  const [year, month, day] = tradeDate.split('-').map(Number);
  return { year, month, day };
};

const formatChartTime = (time: Time) => {
  if (typeof time === 'string') return normalizeTradeDate(time) ?? time;
  if (typeof time === 'number') return dayjs.unix(time).format('YYYY-MM-DD');
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
};

const normalizeMarketBars = (bars: MarketBar[]): ChartBar[] => {
  const byDate = new Map<string, ChartBar>();
  bars.forEach((bar) => {
    const tradeDate = normalizeTradeDate(bar.trade_date);
    if (tradeDate) byDate.set(tradeDate, { source: bar, tradeDate, time: tradeDateToBusinessDay(tradeDate) });
  });
  return Array.from(byDate.values()).sort((a, b) => a.tradeDate.localeCompare(b.tradeDate));
};

const nextDateIndexAfter = (dates: string[], anchorDate: string | null) => {
  if (!anchorDate) return -1;
  return dates.findIndex((date) => date > anchorDate);
};

const nearestTradingDayIndex = (dates: string[], selectedDate: string) => {
  if (dates.length === 0) return 0;
  const exact = dates.indexOf(selectedDate);
  if (exact >= 0) return exact;
  const firstAfter = dates.findIndex((d) => d > selectedDate);
  if (firstAfter < 0) return dates.length - 1;
  return Math.max(0, firstAfter - 1);
};

const initialRightBoundaryDate = (bars: ChartBar[], selectedDate: string) => {
  if (bars.length === 0) return null;
  const dates = bars.map((bar) => bar.tradeDate);
  return dates[nearestTradingDayIndex(dates, selectedDate)] ?? bars[bars.length - 1].tradeDate;
};

const visibleRightDate = (bars: ChartBar[], range: LogicalRange | null) => {
  if (bars.length === 0) return undefined;
  if (!range) return bars[bars.length - 1].tradeDate;
  const index = Math.max(0, Math.min(bars.length - 1, Math.floor(range.to)));
  return bars[index]?.tradeDate ?? bars[bars.length - 1].tradeDate;
};

const buildSelectedDateMarker = (bars: ChartBar[], selectedDate: string): SeriesMarker<Time>[] => {
  if (bars.length === 0) return [];
  const dates = bars.map((bar) => bar.tradeDate);
  const index = nearestTradingDayIndex(dates, selectedDate);
  const markerBar = bars[index];
  if (!markerBar) return [];
  return [{
    id: 'selected-date',
    time: markerBar.time,
    position: 'aboveBar',
    shape: 'arrowDown',
    color: '#f0b90b',
    text: markerBar.tradeDate === selectedDate ? '选股日' : `选股日 ${selectedDate}`,
  }];
};

const scrollToRightEdge = (chart: IChartApi) => {
  requestAnimationFrame(() => {
    chart.timeScale().scrollToRealTime();
    chart.timeScale().scrollToPosition(0, false);
  });
  window.setTimeout(() => {
    chart.timeScale().scrollToRealTime();
    chart.timeScale().scrollToPosition(0, true);
  }, 32);
  window.setTimeout(() => {
    chart.timeScale().scrollToRealTime();
    chart.timeScale().scrollToPosition(0, false);
  }, 120);
};

const moveVisibleRightToIndex = (chart: IChartApi, index: number, visibleSpan: number, snapToRightEdge = false) => {
  const span = Math.max(MIN_VISIBLE_BARS, Math.round(visibleSpan));
  const to = Math.max(0, index);
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, to - span),
    to,
  });
  if (snapToRightEdge) scrollToRightEdge(chart);
};


function KLineChart({
  bars,
  selectedDate,
  rightBoundaryDate,
  loading,
  onLoadEarlier,
  onUnlockNext,
  onRightBoundaryChange,
}: {
  bars: MarketBar[];
  selectedDate: string;
  rightBoundaryDate?: string;
  loading: boolean;
  onLoadEarlier: (endDate: string) => void;
  onUnlockNext: (startDate: string) => void;
  onRightBoundaryChange: (date: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markerRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const loadingRef = useRef(loading);
  const loadingEarlierRef = useRef(false);
  const pendingFirstDateRef = useRef<string | null>(null);
  const preserveLogicalRangeRef = useRef<{ rightDate: string; visibleSpan: number } | null>(null);
  const pendingNextBarRef = useRef<PendingNextBar | null>(null);
  const hasInitializedRangeRef = useRef(false);
  const lastEarlierRequestAtRef = useRef(0);
  const lastLogicalRangeRef = useRef<LogicalRange | null>(null);
  const lastRangeFromRef = useRef<number | null>(null);
  const userInteractedRef = useRef(false);
  const allBarsRef = useRef<ChartBar[]>([]);
  const barsRef = useRef<ChartBar[]>([]);
  const onLoadEarlierRef = useRef(onLoadEarlier);
  const onUnlockNextRef = useRef(onUnlockNext);
  const onRightBoundaryChangeRef = useRef(onRightBoundaryChange);

  const selectedTradeDate = useMemo(() => normalizeTradeDate(selectedDate) ?? selectedDate, [selectedDate]);
  const explicitRightBoundary = useMemo(() => normalizeTradeDate(rightBoundaryDate), [rightBoundaryDate]);
  const allBars = useMemo(() => normalizeMarketBars(bars), [bars]);
  const selectedRightDate = useMemo(() => initialRightBoundaryDate(allBars, selectedTradeDate), [allBars, selectedTradeDate]);
  const effectiveRightDate = explicitRightBoundary ?? selectedRightDate;
  const chartBars = useMemo(
    () => effectiveRightDate ? allBars.filter((bar) => bar.tradeDate <= effectiveRightDate) : allBars,
    [allBars, effectiveRightDate],
  );
  const candleData = useMemo<CandlestickData<Time>[]>(
    () => chartBars.map((bar) => ({
      time: bar.time,
      open: barOpen(bar.source),
      high: barHigh(bar.source),
      low: barLow(bar.source),
      close: barClose(bar.source),
    })),
    [chartBars],
  );
  const volumeData = useMemo<HistogramData<Time>[]>(
    () => chartBars.map((bar) => ({
      time: bar.time,
      value: barVolume(bar.source),
      color: barClose(bar.source) >= barOpen(bar.source) ? 'rgba(22, 199, 132, 0.55)' : 'rgba(234, 57, 67, 0.55)',
    })),
    [chartBars],
  );

  useEffect(() => {
    onLoadEarlierRef.current = onLoadEarlier;
  }, [onLoadEarlier]);

  useEffect(() => {
    onUnlockNextRef.current = onUnlockNext;
  }, [onUnlockNext]);

  useEffect(() => {
    onRightBoundaryChangeRef.current = onRightBoundaryChange;
  }, [onRightBoundaryChange]);

  useEffect(() => {
    loadingRef.current = loading;
    if (!loading) loadingEarlierRef.current = false;
  }, [loading]);

  const requestEarlier = useCallback(() => {
    const firstBar = barsRef.current[0];
    if (loadingRef.current || loadingEarlierRef.current || !firstBar) return;
    const now = Date.now();
    if (now - lastEarlierRequestAtRef.current < 800) return;
    loadingEarlierRef.current = true;
    lastEarlierRequestAtRef.current = now;
    pendingFirstDateRef.current = firstBar.tradeDate;
    const logicalRange = chartRef.current?.timeScale().getVisibleLogicalRange() ?? lastLogicalRangeRef.current;
    preserveLogicalRangeRef.current = {
      rightDate: visibleRightDate(barsRef.current, logicalRange) ?? barsRef.current[barsRef.current.length - 1]?.tradeDate ?? firstBar.tradeDate,
      visibleSpan: logicalRange ? Math.max(MIN_VISIBLE_BARS, logicalRange.to - logicalRange.from) : DEFAULT_VISIBLE_BARS,
    };
    if (IS_DEV) {
      console.debug('[KLineChart] load earlier', { firstDate: firstBar.tradeDate, logicalRange, preserve: preserveLogicalRangeRef.current });
    }
    onLoadEarlierRef.current(dayjs(firstBar.tradeDate).subtract(1, 'day').format('YYYY-MM-DD'));
  }, []);

  const maybeRequestEarlier = useCallback((range: LogicalRange | null) => {
    if (!range) return;
    const previousFrom = lastRangeFromRef.current;
    lastRangeFromRef.current = range.from;
    lastLogicalRangeRef.current = range;
    if (!userInteractedRef.current) return;
    if (previousFrom != null && range.from >= previousFrom) return;
    const visibleSpan = Math.max(1, range.to - range.from);
    const threshold = Math.max(20, Math.min(PRELOAD_BAR_THRESHOLD, Math.ceil(visibleSpan * 0.35)));
    const barsInfo = candleSeriesRef.current?.barsInLogicalRange(range);
    const barsBefore = barsInfo?.barsBefore ?? range.from;
    const shouldLoad = barsBefore <= threshold || range.from <= threshold;
    if (IS_DEV && shouldLoad) {
      console.debug('[KLineChart] preload threshold', { range, barsBefore, threshold });
    }
    if (shouldLoad) requestEarlier();
  }, [requestEarlier]);

  const handleUnlockNext = useCallback(() => {
    const chart = chartRef.current;
    const currentBars = barsRef.current;
    const allDates = allBarsRef.current.map((bar) => bar.tradeDate);
    const logicalRange = chart?.timeScale().getVisibleLogicalRange() ?? lastLogicalRangeRef.current;
    const anchorDate = currentBars[currentBars.length - 1]?.tradeDate ?? selectedTradeDate;
    const visibleSpan = logicalRange ? Math.max(MIN_VISIBLE_BARS, logicalRange.to - logicalRange.from) : DEFAULT_VISIBLE_BARS;
    const nextIndex = nextDateIndexAfter(allDates, anchorDate);

    if (nextIndex >= 0) {
      pendingNextBarRef.current = { anchorDate, targetDate: allDates[nextIndex], visibleSpan };
      if (IS_DEV) console.debug('[KLineChart] unlock next local', pendingNextBarRef.current);
      onRightBoundaryChangeRef.current(allDates[nextIndex]);
      return;
    }

    const startDate = dayjs(anchorDate).add(1, 'day').format('YYYY-MM-DD');
    pendingNextBarRef.current = { anchorDate, visibleSpan };
    if (IS_DEV) console.debug('[KLineChart] request next bars', pendingNextBarRef.current);
    onUnlockNextRef.current(startDate);
  }, [selectedTradeDate]);

  useEffect(() => {
    const container = ref.current;
    if (!container) return undefined;

    const chart = createChart(container, {
      autoSize: true,
      height: 460,
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#8b949e',
        fontSize: 11,
      },
      localization: {
        locale: 'zh-CN',
        dateFormat: 'yyyy-MM-dd',
        timeFormatter: formatChartTime,
      },
      grid: {
        vertLines: { color: '#21262d' },
        horzLines: { color: '#21262d' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6e7681', labelBackgroundColor: '#30363d' },
        horzLine: { color: '#6e7681', labelBackgroundColor: '#30363d' },
      },
      rightPriceScale: {
        borderColor: '#2a313c',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#2a313c',
        rightOffset: 0,
        barSpacing: 7,
        minBarSpacing: 3,
        fixLeftEdge: true,
        fixRightEdge: true,
        rightBarStaysOnScroll: false,
        tickMarkFormatter: (time: Time) => formatChartTime(time),
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: false,
      },
      handleScale: {
        axisPressedMouseMove: true,
        mouseWheel: true,
        pinch: true,
      },
    });
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderUpColor: '#16c784',
      borderDownColor: '#ea3943',
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
      priceLineVisible: false,
    }, 0);
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);
    chart.panes()[0]?.setStretchFactor(4);
    chart.panes()[1]?.setStretchFactor(1);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    markerRef.current = createSeriesMarkers(candleSeries, []);

    const handleLogicalRangeChange = (range: LogicalRange | null) => maybeRequestEarlier(range);
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
    const handlePointerBoundaryCheck = () => {
      userInteractedRef.current = true;
      requestAnimationFrame(() => maybeRequestEarlier(chart.timeScale().getVisibleLogicalRange()));
    };
    const markInteracted = () => {
      userInteractedRef.current = true;
    };
    container.addEventListener('pointerdown', markInteracted);
    container.addEventListener('mouseup', handlePointerBoundaryCheck);
    container.addEventListener('touchend', handlePointerBoundaryCheck);
    container.addEventListener('wheel', handlePointerBoundaryCheck, { passive: true });

    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleLogicalRangeChange);
      container.removeEventListener('pointerdown', markInteracted);
      container.removeEventListener('mouseup', handlePointerBoundaryCheck);
      container.removeEventListener('touchend', handlePointerBoundaryCheck);
      container.removeEventListener('wheel', handlePointerBoundaryCheck);
      markerRef.current?.detach();
      markerRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      chartRef.current?.remove();
      chartRef.current = null;
    };
  }, [maybeRequestEarlier]);

  useEffect(() => {
    allBarsRef.current = allBars;
    const pendingNext = pendingNextBarRef.current;
    if (!pendingNext) return;
    const allDates = allBars.map((bar) => bar.tradeDate);
    const nextIndex = nextDateIndexAfter(allDates, pendingNext.anchorDate);
    if (nextIndex >= 0) {
      pendingNextBarRef.current = { ...pendingNext, targetDate: allDates[nextIndex] };
      onRightBoundaryChangeRef.current(allDates[nextIndex]);
    }
  }, [allBars]);

  useEffect(() => {
    barsRef.current = chartBars;
    const chart = chartRef.current;
    const candleSeries = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    if (!chart || !candleSeries || !volumeSeries) return;

    candleSeries.setData(candleData);
    volumeSeries.setData(volumeData);
    chart.timeScale().applyOptions({ fixLeftEdge: true, fixRightEdge: true, rightOffset: 0 });
    markerRef.current?.setMarkers(buildSelectedDateMarker(chartBars, selectedTradeDate));

    if (chartBars.length === 0) return;

    const pendingFirstDate = pendingFirstDateRef.current;
    if (pendingFirstDate) {
      pendingFirstDateRef.current = null;
      loadingEarlierRef.current = false;
    }

    const dates = chartBars.map((bar) => bar.tradeDate);
    const pendingNext = pendingNextBarRef.current;
    if (pendingNext) {
      const nextIndex = pendingNext.targetDate ? dates.indexOf(pendingNext.targetDate) : nextDateIndexAfter(dates, pendingNext.anchorDate);
      if (nextIndex >= 0) {
        moveVisibleRightToIndex(chart, chartBars.length - 1, pendingNext.visibleSpan, true);
        pendingNextBarRef.current = null;
        return;
      }
    }

    const preservedRange = preserveLogicalRangeRef.current;
    if (preservedRange) {
      const rightIndex = dates.indexOf(preservedRange.rightDate);
      if (rightIndex >= 0) moveVisibleRightToIndex(chart, rightIndex, preservedRange.visibleSpan);
      preserveLogicalRangeRef.current = null;
      return;
    }

    if (!hasInitializedRangeRef.current) {
      const selectedIndex = nearestTradingDayIndex(dates, selectedTradeDate);
      moveVisibleRightToIndex(chart, selectedIndex, DEFAULT_VISIBLE_BARS);
      hasInitializedRangeRef.current = true;
    }
  }, [candleData, chartBars, maybeRequestEarlier, selectedTradeDate, volumeData]);

  return (
    <div style={{ position: 'relative', width: '100%', height: 460 }}>
      <div ref={ref} style={{ width: '100%', height: '100%', overscrollBehavior: 'contain' }} />
      <Button
        size="small"
        loading={loading}
        onClick={handleUnlockNext}
        style={{ position: 'absolute', top: 8, right: 8, zIndex: 2, background: 'rgba(13, 17, 23, 0.88)' }}
      >
        下一根K线
      </Button>
      {bars.length === 0 && (
        <Empty description={loading ? 'K线加载中...' : '暂无K线数据'} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }} />
      )}
    </div>
  );
}
