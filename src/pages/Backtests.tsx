import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Empty, Progress, Space, Table, Tag, Typography } from 'antd';
import { LineChartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { backtestApi } from '@/api/backtest';
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
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['backtests'],
    queryFn: () => backtestApi.list({ limit: 100 }),
    staleTime: 30_000,
    refetchInterval: (q) => {
      const items = q.state.data?.items ?? [];
      return items.some((item) => item.status === 'RUNNING' || item.status === 'QUEUED') ? 3000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => backtestApi.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backtests'] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => backtestApi.retry(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['backtests'] }),
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
    {
      title: '进度',
      dataIndex: 'progress',
      width: 180,
      render: (_: unknown, r: BacktestJob) => {
        const percent = Math.min(100, Math.max(0, Math.round((r.progress ?? 0) * 1000) / 10));
        if (r.status === 'COMPLETED') return <Progress percent={100} size="small" />;
        if (r.status === 'FAILED' || r.status === 'CANCELLED') return <Text type="secondary" ellipsis>{r.error_message || '—'}</Text>;
        return <Progress percent={percent} size="small" status={r.status === 'RUNNING' ? 'active' : 'normal'} />;
      },
    },
    { title: '初始资金', dataIndex: 'initial_capital', width: 120, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v?.toLocaleString() ?? '—'}</Text> },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      width: 160,
      render: (t: number) => (t ? dayjs.unix(t).format('YYYY-MM-DD HH:mm') : '—'),
    },
    {
      title: '操作',
      width: 150,
      render: (_: unknown, r: BacktestJob) => {
        const running = r.status === 'RUNNING' || r.status === 'QUEUED';
        const retryable = r.status === 'FAILED' || r.status === 'CANCELLED';
        return (
          <Space onClick={(event) => event.stopPropagation()}>
            {running && (
              <Button danger size="small" loading={cancelMutation.isPending} onClick={() => cancelMutation.mutate(r.id)}>
                取消
              </Button>
            )}
            {retryable && (
              <Button type="primary" size="small" loading={retryMutation.isPending} onClick={() => retryMutation.mutate(r.id)}>
                重试
              </Button>
            )}
            <Button size="small" onClick={() => navigate(`/backtests/${r.id}`)}>详情</Button>
          </Space>
        );
      },
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
