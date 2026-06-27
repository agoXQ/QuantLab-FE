import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Table,
  Divider,
  InputNumber,
  Input,
  App,
  Popconfirm,
  Descriptions,
} from 'antd';
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import { portfolioApi } from '@/api/portfolio';
import { strategyApi } from '@/api/strategy';
import MetricCard from '@/components/MetricCard';
import EquityChart from '@/components/EquityChart';
import { ApiError } from '@/api/client';
import type { Portfolio, PortfolioItem } from '@/types';

const { Title, Text } = Typography;

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const pid = Number(id);

  const [addStrategyId, setAddStrategyId] = useState<number | null>(null);
  const [addWeight, setAddWeight] = useState<number>(0);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio', pid],
    queryFn: () => portfolioApi.get(pid),
    enabled: !!pid,
  });

  const { data: analytics } = useQuery({
    queryKey: ['portfolio-analytics', pid],
    queryFn: () => portfolioApi.getAnalytics(pid),
    enabled: !!pid,
  });

  const { data: equity } = useQuery({
    queryKey: ['portfolio-equity', pid],
    queryFn: () => portfolioApi.getEquityCurve(pid),
    enabled: !!pid,
  });

  const addItem = useMutation({
    mutationFn: () => {
      if (!addStrategyId) throw new Error('请输入策略 ID');
      return portfolioApi.addItem(pid, { strategy_id: addStrategyId, weight: addWeight });
    },
    onSuccess: () => {
      message.success('已添加策略');
      setAddStrategyId(null);
      setAddWeight(0);
      qc.invalidateQueries({ queryKey: ['portfolio', pid] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '添加失败'),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: number) => portfolioApi.removeItem(pid, itemId),
    onSuccess: () => {
      message.success('已移除');
      qc.invalidateQueries({ queryKey: ['portfolio', pid] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '移除失败'),
  });

  const publish = useMutation({
    mutationFn: () => portfolioApi.publish(pid),
    onSuccess: () => {
      message.success('组合已发布');
      qc.invalidateQueries({ queryKey: ['portfolio', pid] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '发布失败'),
  });

  const { data: stratMeta } = useQuery({
    queryKey: ['strategy', addStrategyId],
    queryFn: () => strategyApi.get(addStrategyId!),
    enabled: !!addStrategyId,
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!portfolio) return <Empty description="组合不存在" />;

  const items = portfolio.items ?? [];

  const columns = [
    { title: '#', dataIndex: 'sort_order', width: 50, render: (n: number, _r: PortfolioItem, i: number) => i + 1 },
    {
      title: '策略',
      dataIndex: 'strategy_id',
      render: (sid: number) => (
        <a onClick={() => navigate(`/strategies/${sid}`)} style={{ color: '#16c784' }}>策略 #{sid}</a>
      ),
    },
    { title: '权重', dataIndex: 'weight', width: 140, align: 'right' as const, render: (w: number) => <Text style={{ fontFamily: 'monospace' }}>{w}%</Text> },
    {
      title: '',
      width: 60,
      render: (_: unknown, r: PortfolioItem) => (
        <Popconfirm title="移除该策略？" onConfirm={() => removeItem.mutate(r.id)}>
          <Button type="text" danger icon={<DeleteOutlined />} size="small" />
        </Popconfirm>
      ),
    },
  ];

  const totalWeight = items.reduce((s, it) => s + (it.weight ?? 0), 0);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/portfolios')} style={{ color: '#8b949e' }}>
          返回组合
        </Button>
        <Button type="primary" icon={<SendOutlined />} loading={publish.isPending} onClick={() => publish.mutate()}>
          发布组合
        </Button>
      </div>

      <Card>
        <Space align="center" size={12}>
          <Title level={4} style={{ margin: 0 }}>{portfolio.name}</Title>
          {portfolio.description && <Text type="secondary">{portfolio.description}</Text>}
        </Space>
        <Divider style={{ margin: '16px 0' }} />
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="策略数">{items.length}</Descriptions.Item>
          <Descriptions.Item label="权重合计">
            <Text style={{ color: Math.abs(totalWeight - 100) < 0.01 ? '#16c784' : '#f0b90b', fontFamily: 'monospace' }}>
              {totalWeight}%
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="当前版本">v{portfolio.current_version}</Descriptions.Item>
          <Descriptions.Item label="更新">
            {portfolio.updated_at ? new Date(portfolio.updated_at * 1000).toISOString().slice(0, 10) : '—'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {analytics && (
        <Row gutter={16}>
          <Col span={6}><MetricCard title="累计收益" value={analytics.total_return * 100} precision={2} suffix="%" valueColor={analytics.total_return >= 0 ? '#16c784' : '#ea3943'} /></Col>
          <Col span={6}><MetricCard title="年化收益" value={analytics.annual_return * 100} precision={2} suffix="%" valueColor={analytics.annual_return >= 0 ? '#16c784' : '#ea3943'} /></Col>
          <Col span={6}><MetricCard title="夏普比率" value={analytics.sharpe_ratio} precision={2} valueColor={analytics.sharpe_ratio >= 1 ? '#16c784' : '#e6edf3'} /></Col>
          <Col span={6}><MetricCard title="最大回撤" value={analytics.max_drawdown * 100} precision={2} suffix="%" valueColor="#ea3943" /></Col>
        </Row>
      )}

      <Card title={<Text strong>净值曲线</Text>}>
        {equity && equity.length > 0 ? (
          <EquityChart points={equity} />
        ) : (
          <Empty description="暂无净值数据" style={{ padding: 32 }} />
        )}
      </Card>

      <Card
        title={<Text strong>持仓策略</Text>}
        extra={
          <Space>
            <Input
              placeholder="策略 ID"
              style={{ width: 120 }}
              type="number"
              value={addStrategyId ?? ''}
              onChange={(e) => setAddStrategyId(e.target.value ? Number(e.target.value) : null)}
            />
            {stratMeta && <Text style={{ fontSize: 11, color: '#8b949e' }}>{stratMeta.title}</Text>}
            <InputNumber
              placeholder="权重"
              min={0}
              max={100}
              style={{ width: 90 }}
              value={addWeight}
              onChange={(v) => setAddWeight(v ?? 0)}
              addonAfter="%"
            />
            <Button type="primary" icon={<PlusOutlined />} loading={addItem.isPending} onClick={() => addItem.mutate()}>
              添加
            </Button>
          </Space>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          dataSource={items}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="middle"
          locale={{ emptyText: <Empty description="尚未添加策略" /> }}
        />
      </Card>
    </Space>
  );
}
