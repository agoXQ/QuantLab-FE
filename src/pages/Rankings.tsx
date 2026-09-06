import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Typography, Space, Segmented, Empty, Skeleton } from 'antd';
import { TrophyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { rankingApi } from '@/api/ranking';
import MetricValue from '@/components/MetricValue';
import type { RankingItem, TrainingRankingItem } from '@/types';

const { Title, Text } = Typography;

type RankingScope = 'strategy' | 'training';

const strategyTypeOptions = [
  { label: '收益', value: 1 },
  { label: '夏普', value: 2 },
  { label: '胜率', value: 3 },
  { label: '回撤', value: 4 },
  { label: '综合', value: 6 },
];
const trainingTypeOptions = [
  { label: '累计收益', value: 1 },
  { label: '收益率', value: 2 },
  { label: '胜率', value: 3 },
  { label: '单局收益', value: 4 },
  { label: '回撤控制', value: 5 },
  { label: '活跃度', value: 6 },
  { label: '综合', value: 7 },
];
const periodOptions = [
  { label: '日榜', value: 1 },
  { label: '周榜', value: 2 },
  { label: '近1月', value: 3 },
  { label: '近3月', value: 4 },
  { label: '近1年', value: 5 },
  { label: '全部', value: 6 },
];

function numberValue(value?: number | null) {
  return Number.isFinite(value) ? value as number : 0;
}

function percentMetric(value?: number | null) {
  return <MetricValue value={numberValue(value) * 100} suffix="%" />;
}

function rankText(rank: number) {
  const color = rank === 1 ? '#f0b90b' : rank === 2 ? '#c0c0c0' : rank === 3 ? '#cd7f32' : '#8b949e';
  return <Text style={{ color, fontWeight: 700, fontFamily: 'monospace', fontSize: 15 }}>{rank}</Text>;
}

export default function Rankings() {
  const navigate = useNavigate();
  const [scope, setScope] = useState<RankingScope>('strategy');
  const [strategyType, setStrategyType] = useState(1);
  const [trainingType, setTrainingType] = useState(1);
  const [period, setPeriod] = useState(6);
  const type = scope === 'strategy' ? strategyType : trainingType;

  const { data: strategyData, isLoading: strategyLoading } = useQuery({
    queryKey: ['rankings', 'strategy', strategyType, period],
    queryFn: () => rankingApi.list({ type: strategyType, period, limit: 50 }),
    staleTime: 60_000,
    enabled: scope === 'strategy',
  });

  const { data: trainingData, isLoading: trainingLoading } = useQuery({
    queryKey: ['rankings', 'training', trainingType, period],
    queryFn: () => rankingApi.trainingList({ type: trainingType, period, limit: 50 }),
    staleTime: 60_000,
    enabled: scope === 'training',
  });

  const { data: trainingSnapshots } = useQuery({
    queryKey: ['rankings', 'training-snapshots', trainingType, period],
    queryFn: () => rankingApi.trainingSnapshots({ type: trainingType, period, limit: 6 }),
    staleTime: 60_000,
    enabled: scope === 'training',
  });

  const strategyColumns = [
    { title: '排名', dataIndex: 'rank', width: 64, render: rankText },
    {
      title: '策略',
      dataIndex: 'strategy_name',
      width: 220,
      ellipsis: true,
      render: (name: string, record: RankingItem) => (
        <a onClick={() => navigate(`/strategies/${record.strategy_id}`)} style={{ color: '#e6edf3' }}>{name}</a>
      ),
    },
    { title: '作者', dataIndex: 'author_name', width: 120, render: (name: string) => <Text style={{ color: '#8b949e' }}>{name || '匿名用户'}</Text> },
    { title: '综合评分', dataIndex: 'score', width: 100, align: 'right' as const, render: (value: number) => <Text style={{ fontFamily: 'monospace', fontWeight: 600 }}>{numberValue(value).toFixed(1)}</Text> },
    { title: '累计收益', dataIndex: 'total_return', width: 110, align: 'right' as const, sorter: (a: RankingItem, b: RankingItem) => numberValue(a.total_return) - numberValue(b.total_return), render: percentMetric },
    { title: '夏普', dataIndex: 'sharpe_ratio', width: 80, align: 'right' as const, render: (value: number) => <Text style={{ fontFamily: 'monospace' }}>{numberValue(value).toFixed(2)}</Text> },
    { title: '最大回撤', dataIndex: 'max_drawdown', width: 100, align: 'right' as const, render: percentMetric },
    { title: '胜率', dataIndex: 'win_rate', width: 80, align: 'right' as const, render: (value: number) => <Text style={{ fontFamily: 'monospace' }}>{(numberValue(value) * 100).toFixed(1)}%</Text> },
  ];

  const trainingColumns = [
    { title: '排名', dataIndex: 'rank', width: 64, render: rankText },
    { title: '用户', dataIndex: 'username', width: 160, ellipsis: true, render: (name: string, record: TrainingRankingItem) => <Text>{name || `用户 #${record.user_id}`}</Text> },
    { title: '训练次数', dataIndex: 'training_count', width: 90, align: 'right' as const },
    { title: '累计收益', dataIndex: 'total_profit', width: 110, align: 'right' as const, render: (value: number) => <MetricValue value={numberValue(value)} /> },
    { title: '平均收益率', dataIndex: 'avg_return_rate', width: 110, align: 'right' as const, render: percentMetric },
    { title: '胜率', dataIndex: 'win_rate', width: 90, align: 'right' as const, render: (value: number) => <Text style={{ fontFamily: 'monospace' }}>{(numberValue(value) * 100).toFixed(1)}%</Text> },
    { title: '最大回撤', dataIndex: 'max_drawdown', width: 100, align: 'right' as const, render: percentMetric },
    { title: '最佳单局', dataIndex: 'best_single_profit', width: 110, align: 'right' as const, render: (value: number) => <MetricValue value={numberValue(value)} /> },
    { title: '破产', dataIndex: 'bankrupt_count', width: 70, align: 'right' as const },
  ];

  const data = scope === 'strategy' ? strategyData : trainingData;
  const isLoading = scope === 'strategy' ? strategyLoading : trainingLoading;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <TrophyOutlined style={{ color: '#f0b90b', fontSize: 20 }} />
          <Title level={4} style={{ margin: 0 }}>排行榜</Title>
        </Space>
        <Space wrap>
          <Segmented value={scope} onChange={(value) => setScope(value as RankingScope)} options={[{ label: '策略排行', value: 'strategy' }, { label: '训练排行', value: 'training' }]} />
          <Segmented value={type} onChange={(value) => scope === 'strategy' ? setStrategyType(value as number) : setTrainingType(value as number)} options={scope === 'strategy' ? strategyTypeOptions : trainingTypeOptions} />
          <Segmented value={period} onChange={(value) => setPeriod(value as number)} options={periodOptions} />
        </Space>
      </div>
      {scope === 'training' && (
        <Card size="small">
          <Space wrap>
            <Text type="secondary">训练排行按所选周期实时聚合，最近快照：</Text>
            {(trainingSnapshots?.items ?? []).length > 0 ? (trainingSnapshots?.items ?? []).map((item) => (
              <Text key={item.id} style={{ fontFamily: 'monospace' }}>{dayjs.unix(item.snapshot_time).format('YYYY-MM-DD')}</Text>
            )) : <Text type="secondary">暂无快照</Text>}
          </Space>
        </Card>
      )}
      <Card styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 8 }} style={{ padding: 24 }} />
        ) : scope === 'strategy' && strategyData && strategyData.items.length > 0 ? (
          <Table<RankingItem>
            dataSource={strategyData.items}
            columns={strategyColumns}
            rowKey="strategy_id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            tableLayout="fixed"
            onRow={(record) => ({ onClick: () => navigate(`/strategies/${record.strategy_id}`), style: { cursor: 'pointer' } })}
          />
        ) : scope === 'training' && trainingData && trainingData.items.length > 0 ? (
          <Table<TrainingRankingItem>
            dataSource={trainingData.items}
            columns={trainingColumns}
            rowKey="user_id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            tableLayout="fixed"
          />
        ) : (
          <Empty description="暂无排行数据" style={{ padding: 48 }} />
        )}
      </Card>
    </Space>
  );
}
