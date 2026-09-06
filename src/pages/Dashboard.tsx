import { useQuery } from '@tanstack/react-query';
import { Card, Table, Tag, Typography, Skeleton, Empty, Segmented, Row, Col, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, TrophyOutlined } from '@ant-design/icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rankingApi } from '@/api/ranking';
import { strategyApi } from '@/api/strategy';
import MetricValue from '@/components/MetricValue';
import type { RankingItem, Strategy } from '@/types';

const { Title, Text } = Typography;

const periodLabels: Record<string, number> = {
  '全部': 6,
  '近1年': 5,
  '近3月': 3,
};

function numberValue(value?: number | null) {
  return Number.isFinite(value) ? value as number : 0;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<string>('全部');

  const { data: ranking, isLoading: rankLoading } = useQuery({
    queryKey: ['ranking', period],
    queryFn: () => rankingApi.list({ type: 1, period: periodLabels[period], limit: 10 }),
    staleTime: 60_000,
  });

  const { data: hotStrategies } = useQuery({
    queryKey: ['strategies', 'hot'],
    queryFn: () => strategyApi.list({ sort: 'favorite_count', limit: 6 }),
    staleTime: 60_000,
  });

  const rankColumns = [
    {
      title: '#',
      dataIndex: 'rank',
      width: 50,
      render: (rank: number) => {
        const color = rank === 1 ? '#f0b90b' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#8b949e';
        return <Text style={{ color, fontWeight: 700, fontFamily: 'monospace' }}>{rank}</Text>;
      },
    },
    {
      title: '策略',
      dataIndex: 'strategy_name',
      width: 180,
      ellipsis: true,
      render: (name: string, record: RankingItem) => (
        <a onClick={() => navigate(`/strategies/${record.strategy_id}`)} style={{ color: '#e6edf3' }}>
          {name}
        </a>
      ),
    },
    {
      title: '作者',
      dataIndex: 'author_name',
      width: 120,
      render: (name: string) => <Text style={{ color: '#8b949e', fontSize: 12 }}>{name}</Text>,
    },
    {
      title: '累计收益',
      dataIndex: 'total_return',
      width: 110,
      align: 'right' as const,
      sorter: (a: RankingItem, b: RankingItem) => numberValue(a.total_return) - numberValue(b.total_return),
      render: (v: number) => <MetricValue value={v * 100} suffix="%" precision={2} />,
    },
    {
      title: '夏普',
      dataIndex: 'sharpe_ratio',
      width: 80,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{numberValue(v).toFixed(2)}</Text>,
    },
    {
      title: '最大回撤',
      dataIndex: 'max_drawdown',
      width: 100,
      align: 'right' as const,
      render: (v: number) => <MetricValue value={v * 100} suffix="%" precision={2} />,
    },
    {
      title: '胜率',
      dataIndex: 'win_rate',
      width: 80,
      align: 'right' as const,
      render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{(numberValue(v) * 100).toFixed(1)}%</Text>,
    },
    {
      title: '变动',
      dataIndex: 'rank_change',
      width: 60,
      align: 'center' as const,
      render: (change: number) =>
        change > 0 ? (
          <Text style={{ color: '#16c784' }}><ArrowUpOutlined />{change}</Text>
        ) : change < 0 ? (
          <Text style={{ color: '#ea3943' }}><ArrowDownOutlined />{-change}</Text>
        ) : (
          <Text style={{ color: '#484f58' }}>—</Text>
        ),
    },
  ];

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
      {/* Hero metrics strip */}
      <Row gutter={16}>
        {[
          { label: '活跃策略', value: '—', sub: '实时统计' },
          { label: '今日回测', value: '—', sub: '平台级' },
          { label: '社区创作者', value: '—', sub: '持续增长' },
          { label: '数据覆盖', value: '5000+', sub: 'A股全市场' },
        ].map((m) => (
          <Col span={6} key={m.label}>
            <Card size="small">
              <Text style={{ fontSize: 12, color: '#8b949e', display: 'block' }}>{m.label}</Text>
              <Text style={{ fontSize: 24, fontWeight: 700, fontFamily: 'monospace' }}>{m.value}</Text>
              <Text style={{ fontSize: 11, color: '#484f58', display: 'block' }}>{m.sub}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={24}>
        {/* Ranking table */}
        <Col span={16}>
          <Card
            title={
              <Space>
                <TrophyOutlined style={{ color: '#f0b90b' }} />
                <Title level={5} style={{ margin: 0 }}>
                  策略排行榜
                </Title>
              </Space>
            }
            extra={
              <Segmented
                size="small"
                value={period}
                onChange={(v) => setPeriod(v as string)}
                options={['全部', '近1年', '近3月']}
              />
            }
            styles={{ body: { padding: 0 } }}
          >
            {rankLoading ? (
              <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 24 }} />
            ) : ranking && ranking.items.length > 0 ? (
              <Table
                dataSource={ranking.items}
                columns={rankColumns}
                rowKey="strategy_id"
                pagination={false}
                size="middle"
                tableLayout="fixed"
                onRow={(r) => ({ onClick: () => navigate(`/strategies/${r.strategy_id}`), style: { cursor: 'pointer' } })}
              />
            ) : (
              <Empty description="暂无排行数据" style={{ padding: 48 }} />
            )}
          </Card>
        </Col>

        {/* Hot strategies sidebar */}
        <Col span={8}>
          <Card title={<Title level={5} style={{ margin: 0 }}>热门策略</Title>} styles={{ body: { padding: 12 } }}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              {(hotStrategies?.items ?? []).map((s: Strategy) => (
                <Card
                  key={s.id}
                  size="small"
                  hoverable
                  onClick={() => navigate(`/strategies/${s.id}`)}
                  style={{ background: '#11161d', border: '1px solid #21262d' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <Text strong ellipsis style={{ maxWidth: 160 }}>{s.title}</Text>
                    {s.category && <Tag bordered={false} color="green">{s.category}</Tag>}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', gap: 16 }}>
                    <Text style={{ fontSize: 11, color: '#8b949e' }}>收藏 {s.favorite_count}</Text>
                    <Text style={{ fontSize: 11, color: '#8b949e' }}>Fork {s.fork_count}</Text>
                    <Text style={{ fontSize: 11, color: '#8b949e' }}>浏览 {s.view_count}</Text>
                  </div>
                </Card>
              ))}
              {(hotStrategies?.items ?? []).length === 0 && (
                <Empty description="暂无策略" style={{ padding: 24 }} />
              )}
            </Space>
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
