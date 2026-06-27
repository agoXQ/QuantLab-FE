import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
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
} from 'antd';
import { ArrowLeftOutlined, LineChartOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { backtestApi } from '@/api/backtest';
import MetricCard from '@/components/MetricCard';
import MetricValue from '@/components/MetricValue';
import type { Trade, Position } from '@/types';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  COMPLETED: 'green',
  RUNNING: 'processing',
  QUEUED: 'default',
  FAILED: 'red',
  CANCELLED: 'orange',
};

export default function BacktestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const { data: positions } = useQuery({
    queryKey: ['backtest-positions', jobId],
    queryFn: () => backtestApi.getPositions(jobId),
    enabled: !!jobId && jobBundle?.job.status === 'COMPLETED',
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  const job = jobBundle?.job;
  if (!job) return <Empty description="回测任务不存在" />;

  const done = job.status === 'COMPLETED';

  const tradeColumns = [
    { title: '交易时间', dataIndex: 'trade_time', width: 160, render: (t: number) => dayjs.unix(t).format('YYYY-MM-DD HH:mm') },
    { title: '代码', dataIndex: 'stock_code', width: 100, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c}</Text> },
    { title: '数量', dataIndex: 'quantity', width: 100, align: 'right' as const, render: (q: number) => <Text style={{ fontFamily: 'monospace' }}>{q.toLocaleString()}</Text> },
    { title: '价格', dataIndex: 'price', width: 100, align: 'right' as const, render: (p: number) => <Text style={{ fontFamily: 'monospace' }}>{p.toFixed(2)}</Text> },
    { title: '手续费', dataIndex: 'commission', width: 100, align: 'right' as const, render: (c: number) => <Text style={{ fontFamily: 'monospace', color: '#8b949e' }}>{c.toFixed(2)}</Text> },
  ];

  const positionColumns = [
    { title: '代码', dataIndex: 'stock_code', width: 110, render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c}</Text> },
    { title: '持仓', dataIndex: 'quantity', width: 110, align: 'right' as const, render: (q: number) => <Text style={{ fontFamily: 'monospace' }}>{q.toLocaleString()}</Text> },
    { title: '成本价', dataIndex: 'cost_price', width: 100, align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '市价', dataIndex: 'market_price', width: 100, align: 'right' as const, render: (v: number) => v.toFixed(2) },
    { title: '市值', dataIndex: 'market_value', width: 130, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v.toLocaleString(undefined, { maximumFractionDigits: 0 })}</Text> },
    {
      title: '浮盈',
      width: 110,
      align: 'right' as const,
      render: (_: unknown, r: Position) => {
        if (!r.cost_price || !r.quantity) return '—';
        const pnl = (r.market_price - r.cost_price) * r.quantity;
        return <MetricValue value={pnl} precision={0} />;
      },
    },
    { title: '日期', dataIndex: 'trade_date', width: 120 },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/backtests')} style={{ color: '#8b949e' }}>
          返回列表
        </Button>
        <Tag bordered={false} color={statusColor[job.status] ?? 'default'} style={{ fontSize: 12 }}>
          {job.status}
        </Tag>
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
          <Descriptions.Item label="初始资金">{job.initial_capital?.toLocaleString() ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="创建">{job.created_at ? dayjs.unix(job.created_at).format('YYYY-MM-DD HH:mm') : '—'}</Descriptions.Item>
        </Descriptions>
      </Card>

      {done && report ? (
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
      ) : (
        !done && (
          <Card>
            {job.status === 'FAILED' ? (
              <Alert
                type="error"
                showIcon
                message="回测失败"
                description={job.error_message || '未知错误'}
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
                key: 'positions',
                label: `期末持仓 (${positions?.length ?? 0})`,
                children: (
                  <Table
                    dataSource={positions ?? []}
                    columns={positionColumns}
                    rowKey={(r: Position) => `${r.stock_code}-${r.id}`}
                    pagination={false}
                    size="small"
                    locale={{ emptyText: <Empty description="暂无持仓" /> }}
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
