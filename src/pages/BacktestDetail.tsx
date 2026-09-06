import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Row,
  Col,
  Card,
  Typography,
  Space,
  Button,
  Tag,
  Skeleton,
  Empty,
  Descriptions,
  Table,
  Divider,
  Tabs,
  Alert,
  Progress,
} from 'antd';
import { ArrowLeftOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { backtestApi } from '@/api/backtest';
import MetricCard from '@/components/MetricCard';
import MetricValue from '@/components/MetricValue';
import EquityChart from '@/components/EquityChart';
import type { BacktestOrder, Trade, Position, BacktestExplanation } from '@/types';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  COMPLETED: 'green',
  RUNNING: 'processing',
  QUEUED: 'default',
  FAILED: 'red',
  CANCELLED: 'orange',
};

function finiteNumber(value: unknown): number | null {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function formatNumber(value: unknown, precision = 2): string {
  const num = finiteNumber(value);
  return num === null ? '—' : num.toFixed(precision);
}

function formatInteger(value: unknown): string {
  const num = finiteNumber(value);
  return num === null ? '—' : Math.round(num).toLocaleString();
}

function formatTimestamp(value: unknown): string {
  const num = finiteNumber(value);
  return num === null || num <= 0 ? '—' : dayjs.unix(num).format('YYYY-MM-DD HH:mm');
}

export default function BacktestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const jobId = Number(id);

  const { data: jobBundle, isLoading } = useQuery({
    queryKey: ['backtest', jobId],
    queryFn: () => backtestApi.get(jobId),
    enabled: !!jobId,
    refetchInterval: (q) => {
      const st = q.state.data?.job.status;
      return st === 'RUNNING' || st === 'QUEUED' ? 3000 : false;
    },
  });

  const { data: report } = useQuery({
    queryKey: ['backtest-report', jobId],
    queryFn: () => backtestApi.getReport(jobId),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  const { data: tradesPage } = useQuery({
    queryKey: ['backtest-trades', jobId],
    queryFn: () => backtestApi.getTrades(jobId, { limit: 100 }),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  const { data: ordersPage } = useQuery({
    queryKey: ['backtest-orders', jobId],
    queryFn: () => backtestApi.getOrders(jobId, { limit: 200 }),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  const { data: positions } = useQuery({
    queryKey: ['backtest-positions', jobId],
    queryFn: () => backtestApi.getPositions(jobId),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  const { data: explanations } = useQuery({
    queryKey: ['backtest-explanations', jobId],
    queryFn: () => backtestApi.getExplanations(jobId, { limit: 500 }),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  const retryMutation = useMutation({
    mutationFn: () => backtestApi.retry(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtest', jobId] });
      qc.invalidateQueries({ queryKey: ['backtests'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => backtestApi.cancel(jobId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['backtest', jobId] });
      qc.invalidateQueries({ queryKey: ['backtests'] });
    },
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  const job = jobBundle?.job;
  if (!job) return <Empty description="回测任务不存在" />;

  const done = job.status === 'COMPLETED';
  const running = job.status === 'RUNNING' || job.status === 'QUEUED';
  const failed = job.status === 'FAILED' || job.status === 'CANCELLED';
  const progress = Math.min(100, Math.max(0, Math.round((job.progress ?? 0) * 1000) / 10));
  const executionMode = jobBundle?.config.execution_mode === 'rebalance' ? '组合轮动/再平衡' : '交易型策略';

  const tradeColumns = [
    { title: '交易时间', dataIndex: 'trade_time', width: 160, render: formatTimestamp },
    { title: '代码', dataIndex: 'stock_code', width: 100, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c || '—'}</Text> },
    { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const, render: (q: number) => <Text style={{ fontFamily: 'monospace' }}>{formatInteger(q)}</Text> },
    { title: '价格', dataIndex: 'price', width: 100, align: 'right' as const, render: (p: number) => <Text style={{ fontFamily: 'monospace' }}>{formatNumber(p)}</Text> },
    { title: '手续费', dataIndex: 'commission', width: 100, align: 'right' as const, render: (c: number) => <Text style={{ fontFamily: 'monospace', color: '#8b949e' }}>{formatNumber(c)}</Text> },
  ];

  const backtestOrderColumns = [
    { title: '提交时间', dataIndex: 'submitted_at', width: 160, render: formatTimestamp },
    { title: '代码', dataIndex: 'stock_code', width: 100, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c || '—'}</Text> },
    { title: '方向', dataIndex: 'side', width: 80, render: (v: string) => <Tag color={v === 'BUY' ? 'green' : 'red'}>{v || '—'}</Tag> },
    { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const, render: (q: number) => <Text style={{ fontFamily: 'monospace' }}>{formatInteger(q)}</Text> },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => <Tag color={v === 'FILLED' ? 'green' : v === 'REJECTED' ? 'red' : v === 'PENDING' ? 'gold' : 'default'}>{v || '—'}</Tag>,
    },
    { title: '成交价', dataIndex: 'filled_price', width: 100, align: 'right' as const, render: (v: number) => formatNumber(v) },
    { title: '成交数', dataIndex: 'filled_qty', width: 100, align: 'right' as const, render: formatInteger },
    { title: '成交时间', dataIndex: 'filled_at', width: 160, render: formatTimestamp },
    { title: '原因', dataIndex: 'reason', render: (v: string) => v || '—' },
  ];

  const positionColumns = [
    { title: '代码', dataIndex: 'stock_code', width: 110, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c || '—'}</Text> },
    { title: '持仓', dataIndex: 'quantity', width: 110, align: 'right' as const, render: (q: number) => <Text style={{ fontFamily: 'monospace' }}>{formatInteger(q)}</Text> },
    { title: '成本价', dataIndex: 'cost_price', width: 100, align: 'right' as const, render: (v: number) => formatNumber(v) },
    { title: '市价', dataIndex: 'market_price', width: 100, align: 'right' as const, render: (v: number) => formatNumber(v) },
    { title: '市值', dataIndex: 'market_value', width: 130, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{formatInteger(v)}</Text> },
    {
      title: '浮盈',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, r: Position) => {
        const costPrice = finiteNumber(r.cost_price);
        const marketPrice = finiteNumber(r.market_price);
        const quantity = finiteNumber(r.quantity);
        if (costPrice === null || marketPrice === null || quantity === null || quantity <= 0) return '—';
        const pnl = (marketPrice - costPrice) * quantity;
        return <MetricValue value={pnl} precision={0} />;
      },
    },
    { title: '日期', dataIndex: 'trade_date', width: 120 },
  ];

  const signalColumns = [
    { title: '代码', dataIndex: 'stock_code', width: 110, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c || '—'}</Text> },
    { title: '动作', dataIndex: 'action', width: 90, render: (v: string) => <Tag color={v === 'BUY' ? 'green' : v === 'SELL' ? 'red' : 'default'}>{v || '—'}</Tag> },
    { title: '分数', dataIndex: 'score', width: 100, align: 'right' as const, render: (v: number) => formatNumber(v, 4) },
    { title: '来源', dataIndex: 'reason', width: 120, render: (v: string) => v || '—' },
  ];

  const orderColumns = [
    { title: '代码', dataIndex: 'stock_code', width: 110, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c || '—'}</Text> },
    { title: '方向', dataIndex: 'side', width: 80, render: (v: string) => <Tag color={v === 'BUY' ? 'green' : 'red'}>{v || '—'}</Tag> },
    { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const, render: formatInteger },
    { title: '价格', dataIndex: 'price', width: 100, align: 'right' as const, render: (v: number) => formatNumber(v) },
    { title: '状态', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={v === 'FILLED' ? 'green' : v === 'REJECTED' ? 'red' : 'default'}>{v || '—'}</Tag> },
    { title: '原因', dataIndex: 'reason', render: (v: string) => v || '—' },
  ];

  const explanationColumns = [
    { title: '交易日', dataIndex: 'trade_date', width: 120 },
    { title: '评估', dataIndex: 'evaluated', width: 90, render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '已评估' : '跳过'}</Tag> },
    { title: '触发原因', dataIndex: 'rebalance_reason', width: 150, render: (v: string) => v || '—' },
    { title: '股票池', dataIndex: 'universe_size', width: 90, align: 'right' as const, render: formatInteger },
    { title: '买入信号', width: 100, align: 'right' as const, render: (_: unknown, r: BacktestExplanation) => formatInteger(r.buy_signals?.length ?? 0) },
    { title: '提交订单', width: 100, align: 'right' as const, render: (_: unknown, r: BacktestExplanation) => formatInteger(r.submitted_orders?.length ?? 0) },
    { title: '当日成交', width: 100, align: 'right' as const, render: (_: unknown, r: BacktestExplanation) => formatInteger(r.trades?.length ?? 0) },
    { title: '总资产', width: 130, align: 'right' as const, render: (_: unknown, r: BacktestExplanation) => <Text style={{ fontFamily: 'monospace' }}>{formatInteger(r.portfolio_snapshot?.total_asset)}</Text> },
  ];

  const renderExplanation = (record: BacktestExplanation) => (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Descriptions size="small" column={4}>
        <Descriptions.Item label="现金">{formatInteger(record.portfolio_snapshot?.cash)}</Descriptions.Item>
        <Descriptions.Item label="市值">{formatInteger(record.portfolio_snapshot?.market_value)}</Descriptions.Item>
        <Descriptions.Item label="总资产">{formatInteger(record.portfolio_snapshot?.total_asset)}</Descriptions.Item>
        <Descriptions.Item label="持仓数">{formatInteger(record.portfolio_snapshot?.position_count)}</Descriptions.Item>
      </Descriptions>
      <Table
        title={() => <Text strong>信号（买入 / 卖出 / 排名）</Text>}
        dataSource={[...(record.buy_signals ?? []), ...(record.sell_signals ?? []), ...(record.ranking_signals ?? [])]}
        columns={signalColumns}
        rowKey={(_, index) => `signal-${record.trade_date}-${index}`}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="当日无信号" /> }}
      />
      <Table
        title={() => <Text strong>订单（提交 / 匹配）</Text>}
        dataSource={[...(record.submitted_orders ?? []), ...(record.matched_orders ?? [])]}
        columns={orderColumns}
        rowKey={(_, index) => `order-${record.trade_date}-${index}`}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="当日无订单" /> }}
      />
    </Space>
  );

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/backtests')} style={{ color: '#8b949e' }}>
          返回列表
        </Button>
        <Space>
          {running && (
            <Button danger size="small" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
              取消任务
            </Button>
          )}
          {failed && (
            <Button type="primary" size="small" loading={retryMutation.isPending} onClick={() => retryMutation.mutate()}>
              重试任务
            </Button>
          )}
          <Tag bordered={false} color={statusColor[job.status] ?? 'default'} style={{ fontSize: 12 }}>
            {job.status}
          </Tag>
        </Space>
      </div>

      <Card>
        <Space align="center" size={12}>
          <LineChartOutlined style={{ color: '#16c784', fontSize: 18 }} />
          <Title level={5} style={{ margin: 0 }}>回测 #{job.id}</Title>
          <Text style={{ color: '#8b949e', fontSize: 12 }}>
            策略 <a onClick={() => navigate(`/strategies/${job.strategy_id}`)} style={{ color: '#16c784' }}>#{job.strategy_id}</a>
            {' · '}版本 #{job.version_id}
          </Text>
        </Space>
        <Divider style={{ margin: '16px 0' }} />
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="区间">{job.start_date} → {job.end_date}</Descriptions.Item>
          <Descriptions.Item label="基准">{job.benchmark || '沪深300'}</Descriptions.Item>
          <Descriptions.Item label="模型">{executionMode}</Descriptions.Item>
          <Descriptions.Item label="初始资金">{job.initial_capital?.toLocaleString() ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="创建">{job.created_at ? dayjs.unix(job.created_at).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
        </Descriptions>
        {running && (
          <div style={{ marginTop: 16 }}>
            <Progress percent={progress} status="active" strokeColor="#16c784" />
            <Text type="secondary" style={{ fontSize: 12 }}>
              回测执行中，页面每 3 秒自动刷新。当前进度来自后端交易日回放进度。
            </Text>
          </div>
        )}
      </Card>

      {done && report ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col span={6}><MetricCard title="累计收益" value={report.total_return * 100} precision={2} suffix="%" valueColor={report.total_return >= 0 ? '#16c784' : '#ea3943'} /></Col>
            <Col span={6}><MetricCard title="年化收益" value={report.annual_return * 100} precision={2} suffix="%" valueColor={report.annual_return >= 0 ? '#16c784' : '#ea3943'} /></Col>
            <Col span={6}><MetricCard title="夏普比率" value={report.sharpe_ratio} precision={2} valueColor={report.sharpe_ratio >= 1 ? '#16c784' : '#e6edf3'} /></Col>
            <Col span={6}><MetricCard title="最大回撤" value={report.max_drawdown * 100} precision={2} suffix="%" valueColor="#ea3943" /></Col>
            <Col span={6} style={{ marginTop: 16 }}><MetricCard title="胜率" value={report.win_rate * 100} precision={1} suffix="%" /></Col>
            <Col span={6} style={{ marginTop: 16 }}><MetricCard title="波动率" value={report.volatility * 100} precision={2} suffix="%" /></Col>
            <Col span={6} style={{ marginTop: 16 }}><MetricCard title="Alpha" value={report.alpha} precision={2} valueColor={report.alpha >= 0 ? '#16c784' : '#ea3943'} /></Col>
            <Col span={6} style={{ marginTop: 16 }}><MetricCard title="Beta" value={report.beta} precision={2} /></Col>
          </Row>
          <Card title={<Text strong>净值曲线</Text>}>
            {report.equity_curve?.length ? (
              <EquityChart points={report.equity_curve} height={280} />
            ) : (
              <Empty description="暂无净值曲线" />
            )}
          </Card>
        </Space>
      ) : (
        !done && (
          <Card>
            {job.status === 'FAILED' ? (
              <Alert
                type="error"
                showIcon
                message="回测失败"
                description={job.error_message || '未知错误'}
                action={<Button size="small" type="primary" loading={retryMutation.isPending} onClick={() => retryMutation.mutate()}>重试</Button>}
                style={{ margin: '16px 0' }}
              />
            ) : job.status === 'CANCELLED' ? (
              <Alert
                type="warning"
                showIcon
                message="回测已取消"
                description={job.error_message || '可以点击重试重新排队执行'}
                action={<Button size="small" type="primary" loading={retryMutation.isPending} onClick={() => retryMutation.mutate()}>重试</Button>}
                style={{ margin: '16px 0' }}
              />
            ) : (
              <Empty description={job.status === 'RUNNING' ? '回测运行中，自动刷新中…' : '等待执行…'} style={{ padding: 32 }} />
            )}
          </Card>
        )
      )}

      {done && (
        <Card styles={{ body: { padding: '8px 0 0' } }}>
          <Tabs
            defaultActiveKey="trades"
            items={[
              {
                key: 'trades',
                label: `交易记录 (${tradesPage?.items.length ?? 0})`,
                children: (
                  <Table
                    dataSource={tradesPage?.items ?? []}
                    columns={tradeColumns}
                    rowKey={(r: Trade) => `${r.id}-${r.stock_code}`}
                    pagination={{ pageSize: 10, size: 'small' }}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无交易" /> }}
                  />
                ),
              },
              {
                key: 'orders',
                label: `订单流水 (${ordersPage?.items.length ?? 0})`,
                children: (
                  <Table
                    dataSource={ordersPage?.items ?? []}
                    columns={backtestOrderColumns}
                    rowKey={(r: BacktestOrder) => `${r.id}-${r.stock_code}`}
                    pagination={{ pageSize: 10, size: 'small' }}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无订单" /> }}
                  />
                ),
              },
              {
                key: 'positions',
                label: `期末持仓 (${positions?.length ?? 0})`,
                children: (
                  <Table
                    dataSource={positions ?? []}
                    columns={positionColumns}
                    rowKey={(r: Position) => `${r.job_id}-${r.trade_date}-${r.stock_code}`}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无持仓" /> }}
                  />
                ),
              },
              {
                key: 'explanations',
                label: `解释日志 (${explanations?.length ?? 0})`,
                children: (
                  <Table
                    dataSource={explanations ?? []}
                    columns={explanationColumns}
                    rowKey={(r: BacktestExplanation) => `${r.job_id}-${r.trade_date}`}
                    expandable={{ expandedRowRender: renderExplanation }}
                    pagination={{ pageSize: 12, size: 'small' }}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无解释日志" /> }}
                  />
                ),
              },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
