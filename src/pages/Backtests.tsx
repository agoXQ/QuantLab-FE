import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Space, Empty, Tag } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtestApi } from '@/api/backtest';
import { useTokenStore } from '@/store/auth';
import dayjs from 'dayjs';
import type { BacktestJob } from '@/types';

const { Title, Text } = Typography;

const statusColor: Record<string, string> = {
  COMPLETED: 'green',
  RUNNING: 'processing',
  QUEUED: 'default',
  FAILED: 'red',
  CANCELLED: 'orange',
};

export default function Backtests() {
  const navigate = useNavigate();
  const userId = useTokenStore((s) => s.userId);

  const { data, isLoading } = useQuery({
    queryKey: ['backtests', userId],
    queryFn: () => backtestApi.list({ user_id: userId ?? undefined, limit: 50 }),
    staleTime: 30_000,
  });

  const columns = [
    {
      title: '任务 ID',
      dataIndex: 'id',
      width: 80,
      render: (id: number) => <Text style={{ fontFamily: 'monospace' }}>#{id}</Text>,
    },
    {
      title: '策略',
      dataIndex: 'strategy_id',
      render: (sid: number) => (
        <a onClick={() => navigate(`/strategies/${sid}`)} style={{ color: '#16c784' }}>策略 #{sid}</a>
      ),
    },
    { title: '回测区间', width: 220, render: (_: unknown, r: BacktestJob) => `${r.start_date} → ${r.end_date}` },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (s: string) => <Tag bordered={false} color={statusColor[s] ?? 'default'}>{s}</Tag>,
    },
    { title: '初始资金', dataIndex: 'initial_capital', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v?.toLocaleString() ?? '—'}</Text> },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (t: number) => (t ? dayjs.unix(t).format('YYYY-MM-DD HH:mm') : '—'),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Space>
        <LineChartOutlined style={{ fontSize: 20, color: '#16c784' }} />
        <Title level={4} style={{ margin: 0 }}>我的回测</Title>
      </Space>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无回测记录" /> }}
          onRow={(r) => ({ onClick: () => navigate(`/backtests/${r.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </Space>
  );
}
