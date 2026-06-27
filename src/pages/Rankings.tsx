import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Space, Segmented, Empty, Skeleton } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { rankingApi } from '@/api/ranking';
import MetricValue from '@/components/MetricValue';
import type { RankingItem } from '@/types';

const { Title, Text } = Typography;

const typeOptions = [
  { label: '收益', value: 1 },
  { label: '夏普', value: 2 },
  { label: '胜率', value: 3 },
  { label: '回撤', value: 4 },
];
const periodOptions = [
  { label: '近1月', value: 3 },
  { label: '近1年', value: 5 },
  { label: '全部', value: 6 },
];

export default function Rankings() {
  const navigate = useNavigate();
  const [type, setType] = useState(1);
  const [period, setPeriod] = useState(6);

  const { data, isLoading } = useQuery({
    queryKey: ['rankings', type, period],
    queryFn: () => rankingApi.list({ type, period, limit: 50 }),
    staleTime: 60_000,
  });

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      width: 64,
      render: (rank: number) => {
        const color = rank === 1 ? '#f0b90b' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#8b949e';
        return <Text style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{rank}</Text>;
      },
    },
    {
      title: '策略',
      dataIndex: 'strategy_name',
      render: (name: string, r: RankingItem) => (
        <a onClick={() => navigate(`/strategies/${r.strategy_id}`)} style={{ color: '#e6edf3' }}>{name}</a>
      ),
    },
    { title: '作者', dataIndex: 'author_name', width: 120, render: (n: string) => <Text style={{ color: '#8b949e' }}>{n}</Text> },
    { title: '综合评分', dataIndex: 'score', width: 100, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace', fontWeight: 600 }}>{v.toFixed(1)}</Text> },
    { title: '累计收益', dataIndex: 'total_return', width: 110, align: 'right' as const, sorter: (a: RankingItem, b: RankingItem) => a.total_return - b.total_return, render: (v: number) => <MetricValue value={v * 100} suffix="%" /> },
    { title: '夏普', dataIndex: 'sharpe_ratio', width: 80, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}</Text> },
    { title: '最大回撤', dataIndex: 'max_drawdown', width: 100, align: 'right' as const, render: (v: number) => <MetricValue value={v * 100} suffix="%" /> },
    { title: '胜率', dataIndex: 'win_rate', width: 80, align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{(v * 100).toFixed(1)}%</Text> },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <TrophyOutlined style={{ color: '#f0b90b', fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>排行榜</Title>
        </Space>
        <Space>
          <Segmented value={type} onChange={(v) => setType(v as number)} options={typeOptions} />
          <Segmented value={period} onChange={(v) => setPeriod(v as number)} options={periodOptions} />
        </Space>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 24 }} />
        ) : data && data.items.length > 0 ? (
          <Table
            dataSource={data.items}
            columns={columns}
            rowKey="strategy_id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            onRow={(r) => ({ onClick: () => navigate(`/strategies/${r.strategy_id}`), style: { cursor: 'pointer' } })}
          />
        ) : (
          <Empty description="暂无排行数据" style={{ padding: 48 }} />
        )}
      </Card>
    </Space>
  );
}
