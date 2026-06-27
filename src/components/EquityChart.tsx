import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

// Register only the pieces we use so the echarts vendor chunk stays small.
echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);

interface Point {
  trade_date: string;
  nav: number;
  return_rate: number;
}

interface Props {
  points: Point[];
  height?: number;
}

// Renders a portfolio / backtest equity (NAV) curve. Green area fill
// reinforces positive-return semantics; the curve is the primary
// performance signal on detail pages.
export default function EquityChart({ points, height = 320 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    chartRef.current ??= echarts.init(ref.current, 'dark');
    const chart = chartRef.current;

    const option: EChartsOption = {
      backgroundColor: 'transparent',
      grid: { left: 48, right: 24, top: 16, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1c2330',
        borderColor: '#2a313c',
        textStyle: { color: '#e6edf3', fontSize: 12 },
        valueFormatter: (v) => (typeof v === 'number' ? v.toFixed(4) : String(v ?? '')),
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.trade_date),
        boundaryGap: false,
        axisLine: { lineStyle: { color: '#2a313c' } },
        axisLabel: { color: '#8b949e', fontSize: 11 },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        axisLine: { show: false },
        splitLine: { lineStyle: { color: '#21262d' } },
        axisLabel: { color: '#8b949e', fontSize: 11 },
      },
      series: [
        {
          type: 'line',
          data: points.map((p) => p.nav),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#16c784', width: 2 },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(22,199,132,0.25)' },
                { offset: 1, color: 'rgba(22,199,132,0.02)' },
              ],
            },
          },
        },
      ],
    };

    chart.setOption(option, true);

    const onResize = () => chart.resize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [points]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div ref={ref} style={{ width: '100%', height }} />;
}
