import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  type Logical,
  type LogicalRange,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts';
import dayjs from 'dayjs';
import type { KLineBar, TrainingTrade } from '@/types';

interface Props {
  bars: KLineBar[];
  trades?: TrainingTrade[];
  trainingStartBarIndex?: number;
  hasMoreHistory?: boolean;
  loadingHistory?: boolean;
  onLoadEarlier?: (beforeBarIndex: number) => void;
  height?: number;
}

type ChartBar = {
  source: KLineBar;
  tradeDate: string;
  time: Time;
};

const DEFAULT_VISIBLE_BARS = 120;
const MIN_VISIBLE_BARS = 40;
const HISTORY_LOAD_CHUNK = 80;
const LEFT_LOAD_THRESHOLD = 8;

function normalizeTradeDate(value: string | undefined) {
  if (!value) return undefined;
  const raw = String(value).trim();
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{8}$/.test(raw)) return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  const prefix = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (prefix) return prefix[1];
  const parsed = dayjs(raw);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

function tradeDateToBusinessDay(tradeDate: string) {
  const [year, month, day] = tradeDate.split('-').map(Number);
  return { year, month, day };
}

function formatChartTime(time: Time) {
  if (typeof time === 'string') return normalizeTradeDate(time) ?? time;
  if (typeof time === 'number') return dayjs.unix(time).format('YYYY-MM-DD');
  return `${time.year}-${String(time.month).padStart(2, '0')}-${String(time.day).padStart(2, '0')}`;
}

function fallbackTradeDate(barIndex: number) {
  return dayjs('2000-01-01').add(barIndex, 'day').format('YYYY-MM-DD');
}

function normalizeBars(bars: KLineBar[]): ChartBar[] {
  return bars
    .map((bar, index) => {
      const barIndex = Number.isFinite(bar.bar_index) ? bar.bar_index : index;
      const tradeDate = normalizeTradeDate(bar.trade_date) ?? fallbackTradeDate(barIndex);
      return { source: { ...bar, bar_index: barIndex }, tradeDate, time: tradeDateToBusinessDay(tradeDate) };
    })
    .sort((left, right) => left.source.bar_index - right.source.bar_index);
}

function sideOf(side: number | string): 'BUY' | 'SELL' {
  if (side === 'SELL' || side === 2) return 'SELL';
  return 'BUY';
}

function moveVisibleRightToIndex(chart: IChartApi, index: number, visibleSpan: number) {
  const span = Math.max(MIN_VISIBLE_BARS, Math.round(visibleSpan));
  const rightIndex = Math.max(0, index);
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, rightIndex - span),
    to: rightIndex,
  });
}

function clampLeftBoundary(chart: IChartApi, range: LogicalRange | null) {
  if (!range || range.from >= 0) return;
  chart.timeScale().setVisibleLogicalRange({
    from: 0,
    to: Math.max(MIN_VISIBLE_BARS, range.to - range.from),
  });
}

export default function TrainingKLineChart({ bars, trades = [], trainingStartBarIndex, hasMoreHistory = false, loadingHistory = false, onLoadEarlier, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const hasInitializedRangeRef = useRef(false);
  const lastBarIndexRef = useRef<number | null>(null);
  const loadingOlderRef = useRef(false);
  const pendingPrependCountRef = useRef(0);
  const lastVisibleRangeRef = useRef<LogicalRange | null>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const onLoadEarlierRef = useRef(onLoadEarlier);
  const hasMoreHistoryRef = useRef(hasMoreHistory);
  const loadingHistoryRef = useRef(loadingHistory);
  const firstVisibleBarIndexRef = useRef<number | null>(null);
  const previousFirstBarIndexRef = useRef<number | null>(null);
  const effectiveVisibleStartIndexRef = useRef(0);
  const updateDividerRef = useRef<() => void>(() => undefined);
  const [visibleStartIndex, setVisibleStartIndex] = useState(0);

  const allChartBars = useMemo(() => normalizeBars(bars), [bars]);
  const initialVisibleStartIndex = 0;
  const effectiveVisibleStartIndex = hasInitializedRangeRef.current ? visibleStartIndex : initialVisibleStartIndex;
  const chartBars = useMemo(
    () => allChartBars.slice(effectiveVisibleStartIndex),
    [allChartBars, effectiveVisibleStartIndex],
  );
  const trainingStartVisibleIndex = useMemo(() => {
    if (trainingStartBarIndex == null) return -1;
    return chartBars.findIndex((bar) => bar.source.bar_index === trainingStartBarIndex);
  }, [chartBars, trainingStartBarIndex]);
  const candleData = useMemo<CandlestickData<Time>[]>(
    () => chartBars.map((bar) => ({
      time: bar.time,
      open: bar.source.open,
      high: bar.source.partial ? bar.source.open : bar.source.high ?? bar.source.open,
      low: bar.source.partial ? bar.source.open : bar.source.low ?? bar.source.open,
      close: bar.source.partial ? bar.source.open : bar.source.close ?? bar.source.open,
    })),
    [chartBars],
  );
  const volumeData = useMemo<HistogramData<Time>[]>(
    () => chartBars
      .filter((bar) => !bar.source.partial)
      .map((bar) => ({
        time: bar.time,
        value: bar.source.volume ?? 0,
        color: (bar.source.close ?? bar.source.open) >= bar.source.open ? 'rgba(22,199,132,0.35)' : 'rgba(234,57,67,0.35)',
      })),
    [chartBars],
  );
  const markers = useMemo<SeriesMarker<Time>[]>(() => {
    const barsByIndex = new Map(chartBars.map((bar) => [bar.source.bar_index, bar]));
    const nextMarkers: SeriesMarker<Time>[] = [];
    if (trainingStartVisibleIndex >= 0) {
      nextMarkers.push({
        id: 'training-start',
        time: chartBars[trainingStartVisibleIndex].time,
        position: 'aboveBar',
        color: '#f0b90b',
        shape: 'circle',
        text: '训练开始',
      });
    }
    trades.forEach((trade) => {
      const bar = barsByIndex.get(trade.bar_index);
      if (!bar) return;
      const side = sideOf(trade.side);
      nextMarkers.push({
        id: trade.trade_id,
        time: bar.time,
        position: side === 'BUY' ? 'belowBar' : 'aboveBar',
        color: side === 'BUY' ? '#16c784' : '#ea3943',
        shape: 'circle',
        text: side === 'BUY' ? 'B' : 'S',
      });
    });
    return nextMarkers;
  }, [chartBars, trades, trainingStartVisibleIndex]);

  const updateDivider = useCallback(() => {
    const chart = chartRef.current;
    const divider = dividerRef.current;
    if (!chart || !divider || trainingStartVisibleIndex < 0) {
      if (divider) divider.style.display = 'none';
      return;
    }
    const coordinate = chart.timeScale().logicalToCoordinate(trainingStartVisibleIndex as Logical);
    if (coordinate == null || coordinate < 0 || coordinate > (containerRef.current?.clientWidth ?? 0)) {
      divider.style.display = 'none';
      return;
    }
    divider.style.display = 'block';
    divider.style.transform = `translateX(${coordinate}px)`;
  }, [trainingStartVisibleIndex]);

  useEffect(() => {
    updateDividerRef.current = updateDivider;
  }, [updateDivider]);

  useEffect(() => {
    onLoadEarlierRef.current = onLoadEarlier;
  }, [onLoadEarlier]);

  useEffect(() => {
    hasMoreHistoryRef.current = hasMoreHistory;
    loadingHistoryRef.current = loadingHistory;
  }, [hasMoreHistory, loadingHistory]);

  useEffect(() => {
    firstVisibleBarIndexRef.current = chartBars[0]?.source.bar_index ?? null;
  }, [chartBars]);

  useEffect(() => {
    effectiveVisibleStartIndexRef.current = effectiveVisibleStartIndex;
  }, [effectiveVisibleStartIndex]);

  const loadOlderHistory = useCallback((range: LogicalRange | null) => {
    lastVisibleRangeRef.current = range;
    updateDividerRef.current();
    const currentStartIndex = effectiveVisibleStartIndexRef.current;
    if (!range || loadingOlderRef.current || range.from > LEFT_LOAD_THRESHOLD) return;
    loadingOlderRef.current = true;
    previousFirstBarIndexRef.current = firstVisibleBarIndexRef.current;
    if (currentStartIndex > 0) {
      const nextStartIndex = Math.max(0, currentStartIndex - HISTORY_LOAD_CHUNK);
      pendingPrependCountRef.current = currentStartIndex - nextStartIndex;
      setVisibleStartIndex(nextStartIndex);
      return;
    }
    const beforeBarIndex = firstVisibleBarIndexRef.current;
    if (beforeBarIndex != null && beforeBarIndex > 0 && hasMoreHistoryRef.current && !loadingHistoryRef.current && onLoadEarlierRef.current) {
      pendingPrependCountRef.current = HISTORY_LOAD_CHUNK;
      onLoadEarlierRef.current(beforeBarIndex);
      return;
    }
    loadingOlderRef.current = false;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const chart = createChart(container, {
      autoSize: true,
      height,
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
      grid: { vertLines: { color: '#21262d' }, horzLines: { color: '#21262d' } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#6e7681', labelBackgroundColor: '#30363d' },
        horzLine: { color: '#6e7681', labelBackgroundColor: '#30363d' },
      },
      rightPriceScale: { borderColor: '#2a313c', scaleMargins: { top: 0.08, bottom: 0.08 } },
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
    const candle = chart.addSeries(CandlestickSeries, {
      upColor: '#16c784',
      downColor: '#ea3943',
      borderUpColor: '#16c784',
      borderDownColor: '#ea3943',
      wickUpColor: '#16c784',
      wickDownColor: '#ea3943',
      priceLineVisible: false,
    }, 0);
    const volume = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceLineVisible: false,
      lastValueVisible: false,
    }, 1);
    chart.panes()[0]?.setStretchFactor(4);
    chart.panes()[1]?.setStretchFactor(1);
    const handleRangeChange = (range: LogicalRange | null) => {
      clampLeftBoundary(chart, range);
      loadOlderHistory(range);
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(handleRangeChange);
    chartRef.current = chart;
    candleRef.current = candle;
    volumeRef.current = volume;
    markersRef.current = createSeriesMarkers(candle, []);
    return () => {
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      markersRef.current?.detach();
      chart.remove();
      chartRef.current = null;
      candleRef.current = null;
      volumeRef.current = null;
      markersRef.current = null;
      hasInitializedRangeRef.current = false;
      lastBarIndexRef.current = null;
      loadingOlderRef.current = false;
      pendingPrependCountRef.current = 0;
      lastVisibleRangeRef.current = null;
    };
  }, [height, loadOlderHistory]);

  useEffect(() => {
    setVisibleStartIndex(initialVisibleStartIndex);
    hasInitializedRangeRef.current = false;
    lastBarIndexRef.current = null;
    loadingOlderRef.current = false;
    pendingPrependCountRef.current = 0;
    lastVisibleRangeRef.current = null;
  }, [initialVisibleStartIndex]);

  useEffect(() => {
    const candle = candleRef.current;
    const volume = volumeRef.current;
    const chart = chartRef.current;
    if (!candle || !volume || !chart) return;
    candle.setData(candleData);
    volume.setData(volumeData);
    markersRef.current?.setMarkers(markers);
    chart.timeScale().applyOptions({ fixLeftEdge: true, fixRightEdge: true, rightOffset: 0 });
    if (chartBars.length === 0) return;

    const prependCount = pendingPrependCountRef.current;
    if (prependCount > 0) {
      const previousRange = lastVisibleRangeRef.current ?? chart.timeScale().getVisibleLogicalRange();
      const previousFirstBarIndex = previousFirstBarIndexRef.current;
      const actualPrependCount = previousFirstBarIndex == null ? prependCount : Math.max(0, chartBars.findIndex((bar) => bar.source.bar_index === previousFirstBarIndex));
      if (previousRange) {
        chart.timeScale().setVisibleLogicalRange({
          from: previousRange.from + actualPrependCount,
          to: previousRange.to + actualPrependCount,
        });
      }
      pendingPrependCountRef.current = 0;
      previousFirstBarIndexRef.current = null;
      loadingOlderRef.current = false;
      updateDivider();
      return;
    }

    const latestBarIndex = chartBars[chartBars.length - 1]?.source.bar_index ?? null;
    const range = chart.timeScale().getVisibleLogicalRange();
    const visibleSpan = range ? Math.max(MIN_VISIBLE_BARS, range.to - range.from) : DEFAULT_VISIBLE_BARS;
    if (!hasInitializedRangeRef.current) {
      moveVisibleRightToIndex(chart, chartBars.length - 1, DEFAULT_VISIBLE_BARS);
      hasInitializedRangeRef.current = true;
    } else if (latestBarIndex !== lastBarIndexRef.current) {
      moveVisibleRightToIndex(chart, chartBars.length - 1, visibleSpan);
    }
    lastBarIndexRef.current = latestBarIndex;
    updateDivider();
  }, [candleData, chartBars, markers, updateDivider, volumeData]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height, overscrollBehavior: 'contain' }}>
      <div
        ref={dividerRef}
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          zIndex: 2,
          display: 'none',
          width: 1,
          borderLeft: '1px dashed #f0b90b',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
