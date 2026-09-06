import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Row,
  Col,
  Card,
  Typography,
  Tag,
  Space,
  Button,
  Skeleton,
  Empty,
  Descriptions,
  Divider,
  App,
  Statistic,
  Table,
  Select,
  type TableColumnsType,
} from 'antd';
import { ArrowLeftOutlined, ForkOutlined, StarOutlined, PlayCircleOutlined, EditOutlined, ThunderboltOutlined, ShareAltOutlined, FilterOutlined } from '@ant-design/icons';
import { strategyApi } from '@/api/strategy';
import { backtestApi } from '@/api/backtest';
import { trainingApi } from '@/api/training';
import { ApiError } from '@/api/client';
import CommunityPublishModal from '@/components/CommunityPublishModal';
import { useTokenStore } from '@/store/auth';
import type { BacktestJob, StrategyVersion, TrainingResult } from '@/types';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

const statusLabels: Record<number, { text: string; color: string }> = {
  1: { text: '草稿', color: 'default' },
  2: { text: '已发布', color: 'green' },
  3: { text: '已归档', color: 'orange' },
};

type VersionStats = {
  version: StrategyVersion;
  backtestCount: number;
  completedBacktestCount: number;
  trainingCount: number;
  winCount: number;
  winRate: number;
  totalProfit: number;
  avgReturn: number;
  maxDrawdown: number;
};

function formatPercent(value?: number) {
  return `${(((value ?? 0) * 100)).toFixed(2)}%`;
}

function formatMoney(value?: number) {
  const amount = value ?? 0;
  return `${amount >= 0 ? '+' : ''}${amount.toFixed(2)}`;
}

function backtestStatusColor(status?: string) {
  if (status === 'SUCCESS' || status === 'COMPLETED') return 'green';
  if (status === 'FAILED') return 'red';
  if (status === 'RUNNING' || status === 'QUEUED') return 'processing';
  if (status === 'CANCELLED') return 'orange';
  return 'default';
}

function isCompletedBacktest(status?: string) {
  return status === 'SUCCESS' || status === 'COMPLETED';
}

function calcTrainingStats(items: TrainingResult[]) {
  const count = items.length;
  const winCount = items.filter((item) => item.is_win).length;
  const totalProfit = items.reduce((sum, item) => sum + (item.profit_amount ?? 0), 0);
  const avgReturn = count ? items.reduce((sum, item) => sum + (item.return_rate ?? 0), 0) / count : 0;
  const maxDrawdown = items.reduce((max, item) => Math.max(max, item.max_drawdown ?? 0), 0);
  return { count, winCount, totalProfit, avgReturn, maxDrawdown, winRate: count ? winCount / count : 0 };
}

export default function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const sid = Number(id);
  const meId = useTokenStore((state) => state.userId);
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>();
  const [publishOpen, setPublishOpen] = useState(false);

  const forkMutation = useMutation({
    mutationFn: () => strategyApi.fork(sid),
    onSuccess: (newId) => {
      if (!newId) {
        message.error('Fork 成功但后端未返回新策略 ID，请刷新策略列表确认');
        return;
      }
      message.success('已 Fork 到我的策略');
      qc.invalidateQueries({ queryKey: ['strategies'] });
      navigate(`/strategies/${newId}/edit`);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : 'Fork 失败'),
  });

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', sid],
    queryFn: () => strategyApi.get(sid),
    enabled: !!sid,
  });

  const { data: versions } = useQuery({
    queryKey: ['strategy-versions', sid],
    queryFn: () => strategyApi.listVersions(sid),
    enabled: !!sid,
  });

  const latestVersion = useMemo(() => versions?.[0], [versions]);
  const activeVersion = useMemo(
    () => versions?.find((version) => version.id === selectedVersionId) ?? latestVersion,
    [latestVersion, selectedVersionId, versions],
  );

  const { data: backtests } = useQuery({
    queryKey: ['strategy-backtests', sid],
    queryFn: () => backtestApi.list({ strategy_id: sid, limit: 100 }),
    enabled: !!sid,
    staleTime: 30_000,
  });

  const { data: trainingRecords } = useQuery({
    queryKey: ['strategy-training-records', sid],
    queryFn: () => trainingApi.listRecords({ source_strategy_id: sid, page: 1, page_size: 100 }),
    enabled: !!sid,
    staleTime: 30_000,
  });

  const backtestItems = backtests?.items ?? [];
  const trainingItems = trainingRecords?.items ?? [];
  const visibleBacktestItems = selectedVersionId ? backtestItems.filter((item) => item.version_id === selectedVersionId) : backtestItems;
  const visibleTrainingItems = selectedVersionId ? trainingItems.filter((item) => item.source_version_id === selectedVersionId) : trainingItems;

  const trainingStats = useMemo(() => calcTrainingStats(visibleTrainingItems), [visibleTrainingItems]);

  const completedBacktests = useMemo(
    () => visibleBacktestItems.filter((item) => isCompletedBacktest(item.status)),
    [visibleBacktestItems],
  );

  const versionStats = useMemo<VersionStats[]>(() => (versions ?? []).map((version) => {
    const versionBacktests = backtestItems.filter((item) => item.version_id === version.id);
    const versionTraining = trainingItems.filter((item) => item.source_version_id === version.id);
    const stats = calcTrainingStats(versionTraining);
    return {
      version,
      backtestCount: versionBacktests.length,
      completedBacktestCount: versionBacktests.filter((item) => isCompletedBacktest(item.status)).length,
      trainingCount: stats.count,
      winCount: stats.winCount,
      winRate: stats.winRate,
      totalProfit: stats.totalProfit,
      avgReturn: stats.avgReturn,
      maxDrawdown: stats.maxDrawdown,
    };
  }), [backtestItems, trainingItems, versions]);

  const backtestColumns = useMemo<TableColumnsType<BacktestJob>>(() => [
    { title: '任务', dataIndex: 'id', width: 80, render: (value: number) => `#${value}` },
    { title: '版本', dataIndex: 'version_id', width: 80, render: (value: number) => value ? `v${versions?.find((item) => item.id === value)?.version_no || value}` : '--' },
    { title: '状态', dataIndex: 'status', width: 110, render: (value: string) => <Tag color={backtestStatusColor(value)}>{value || 'UNKNOWN'}</Tag> },
    { title: '区间', render: (_, record) => `${record.start_date} → ${record.end_date}` },
    { title: '进度', dataIndex: 'progress', width: 100, align: 'right' as const, render: (value?: number) => formatPercent(value ?? 0) },
    { title: '创建时间', dataIndex: 'created_at', width: 120, render: (value: number) => value ? dayjs.unix(value).format('YYYY-MM-DD') : '--' },
    { title: '操作', width: 80, render: (_, record) => <Button type="link" size="small" onClick={() => navigate(`/backtests/${record.id}`)}>详情</Button> },
  ], [navigate, versions]);

  const trainingColumns = useMemo<TableColumnsType<TrainingResult>>(() => [
    { title: '训练标的', render: (_, record) => record.security_name || record.symbol || '--' },
    { title: '版本', dataIndex: 'source_version_id', width: 80, render: (value: number) => value ? `v${versions?.find((item) => item.id === value)?.version_no || value}` : '--' },
    { title: '收益', dataIndex: 'profit_amount', width: 110, align: 'right' as const, render: (value: number) => <Text style={{ color: value >= 0 ? '#16c784' : '#ea3943' }}>{formatMoney(value)}</Text> },
    { title: '收益率', dataIndex: 'return_rate', width: 100, align: 'right' as const, render: (value: number) => formatPercent(value) },
    { title: '胜负', dataIndex: 'is_win', width: 80, render: (value: boolean) => <Tag color={value ? 'green' : 'red'}>{value ? '胜' : '负'}</Tag> },
    { title: '训练日期', dataIndex: 'start_trade_date', width: 120 },
    { title: '完成时间', dataIndex: 'completed_at', width: 120, render: (value: number) => value ? dayjs.unix(value).format('YYYY-MM-DD') : '--' },
    { title: '操作', width: 80, render: () => <Button type="link" size="small" onClick={() => navigate('/trainings')}>去复盘</Button> },
  ], [navigate, versions]);

  const versionColumns = useMemo<TableColumnsType<VersionStats>>(() => [
    {
      title: '版本',
      dataIndex: ['version', 'version_no'],
      width: 90,
      render: (_, record) => <Text strong>v{record.version.version_no || record.version.id}</Text>,
    },
    { title: '创建时间', width: 120, render: (_, record) => dayjs.unix(record.version.created_at).format('YYYY-MM-DD') },
    { title: '回测', dataIndex: 'backtestCount', width: 80, align: 'right' as const, render: (_, record) => `${record.completedBacktestCount}/${record.backtestCount}` },
    { title: '训练', dataIndex: 'trainingCount', width: 80, align: 'right' as const },
    { title: '胜率', dataIndex: 'winRate', width: 90, align: 'right' as const, render: (value: number) => formatPercent(value) },
    { title: '均收益', dataIndex: 'avgReturn', width: 90, align: 'right' as const, render: (value: number) => formatPercent(value) },
    { title: '累计收益', dataIndex: 'totalProfit', width: 110, align: 'right' as const, render: (value: number) => <Text style={{ color: value >= 0 ? '#16c784' : '#ea3943' }}>{formatMoney(value)}</Text> },
    { title: '最大回撤', dataIndex: 'maxDrawdown', width: 95, align: 'right' as const, render: (value: number) => formatPercent(value) },
    {
      title: '操作',
      width: 260,
      render: (_, record) => (
        <Space size={4}>
          <Button type="link" size="small" onClick={() => setSelectedVersionId(record.version.id)}>筛选</Button>
          <Button type="link" size="small" disabled={record.version.can_execute_strategy === false} onClick={() => navigate(`/formulas/screener?strategy_id=${sid}&version_id=${record.version.id}`)}>选股</Button>
          <Button type="link" size="small" onClick={() => navigate(`/strategies/${sid}/backtest?version_id=${record.version.id}`)}>回测</Button>
          <Button type="link" size="small" disabled={record.version.can_execute_strategy === false} onClick={() => navigate(`/trainings?strategy_id=${sid}&version_id=${record.version.id}`)}>训练</Button>
        </Space>
      ),
    },
  ], [navigate, sid]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!strategy) return <Empty description="策略不存在" />;

  const statusMeta = statusLabels[strategy.status] ?? { text: '未知', color: 'default' };
  const isOwner = !!meId && meId === strategy.author_id;
  const authorText = strategy.author_name || (strategy.author_id ? `用户 #${strategy.author_id}` : '匿名用户');
  const activeScopeText = selectedVersionId
    ? `当前仅统计 v${activeVersion?.version_no || selectedVersionId}`
    : '当前统计全部版本';

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/strategies')} style={{ color: '#8b949e' }}>
        返回列表
      </Button>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <Space align="center" size={12}>
              <Title level={4} style={{ margin: 0 }}>{strategy.title}</Title>
              <Tag bordered={false} color={statusMeta.color}>{statusMeta.text}</Tag>
              {isOwner && <Tag bordered={false} color="blue">我的策略</Tag>}
              {latestVersion?.can_view_formula === false && <Tag bordered={false} color="orange">公式受保护</Tag>}
              {strategy.category && <Tag bordered={false}>{strategy.category}</Tag>}
            </Space>
            <Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, maxWidth: 600 }}>
              {strategy.description || '暂无描述'}
            </Paragraph>
          </div>
          <Space>
            <Button icon={<StarOutlined />}>收藏</Button>
            <Button icon={<ForkOutlined />} loading={forkMutation.isPending} onClick={() => forkMutation.mutate()}>
              Fork
            </Button>
            {isOwner && (
              <Button icon={<EditOutlined />} onClick={() => navigate(`/strategies/${sid}/edit`)}>
                编辑
              </Button>
            )}
            <Button icon={<ShareAltOutlined />} onClick={() => setPublishOpen(true)}>
              发布到社区
            </Button>
            <Button
              icon={<FilterOutlined />}
              disabled={!latestVersion || latestVersion.can_execute_strategy === false}
              onClick={() => navigate(`/formulas/screener?strategy_id=${sid}&version_id=${latestVersion?.id}`)}
            >
              用此策略选股
            </Button>
            <Button
              icon={<ThunderboltOutlined />}
              disabled={!latestVersion || latestVersion.can_execute_strategy === false}
              onClick={() => navigate(`/trainings?strategy_id=${sid}&version_id=${latestVersion?.id}`)}
            >
              用此策略选股训练
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              disabled={!latestVersion}
              onClick={() => navigate(`/strategies/${sid}/backtest?version_id=${latestVersion!.id}`)}
            >
              用此策略回测
            </Button>
          </Space>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="作者">
            {strategy.author_id ? <a onClick={() => navigate(`/u/${strategy.author_id}`)}>{authorText}</a> : authorText}
          </Descriptions.Item>
          <Descriptions.Item label="收藏">{strategy.favorite_count}</Descriptions.Item>
          <Descriptions.Item label="Fork">{strategy.fork_count}</Descriptions.Item>
          <Descriptions.Item label="浏览">{strategy.view_count}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs.unix(strategy.created_at).format('YYYY-MM-DD')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Card
        title={<Space><Text strong>策略表现中心</Text><Tag color={selectedVersionId ? 'blue' : 'default'}>{activeScopeText}</Tag></Space>}
        extra={
          <Space>
            <Select
              allowClear
              placeholder="筛选版本"
              style={{ width: 180 }}
              value={selectedVersionId}
              onChange={setSelectedVersionId}
              options={(versions ?? []).map((version) => ({ label: `v${version.version_no || version.id}`, value: version.id }))}
            />
            {selectedVersionId && <Button size="small" onClick={() => setSelectedVersionId(undefined)}>查看全部</Button>}
          </Space>
        }
      >
        <Row gutter={16}>
          <Col span={4}><Statistic title="关联回测" value={visibleBacktestItems.length} /></Col>
          <Col span={4}><Statistic title="完成回测" value={completedBacktests.length} /></Col>
          <Col span={4}><Statistic title="关联训练" value={trainingStats.count} /></Col>
          <Col span={4}><Statistic title="训练胜率" value={trainingStats.winRate * 100} precision={2} suffix="%" /></Col>
          <Col span={4}><Statistic title="训练累计收益" value={trainingStats.totalProfit} precision={2} valueStyle={{ color: trainingStats.totalProfit >= 0 ? '#16c784' : '#ea3943' }} /></Col>
          <Col span={4}><Statistic title="训练最大回撤" value={trainingStats.maxDrawdown * 100} precision={2} suffix="%" valueStyle={{ color: '#ea3943' }} /></Col>
        </Row>
        <Paragraph type="secondary" style={{ margin: '12px 0 0' }}>
          表现中心可按版本过滤，用于判断每次公式修改后的回测验证和人工训练执行效果。
        </Paragraph>
      </Card>

      <Row gutter={24} align="stretch">
        <Col span={14} style={{ display: 'flex' }}>
          <Card title={<Text strong>版本表现对比</Text>} style={{ width: '100%' }}>
            <Table
              rowKey={(record) => record.version.id}
              size="small"
              columns={versionColumns}
              dataSource={versionStats}
              pagination={false}
              locale={{ emptyText: '暂无版本' }}
            />
          </Card>
        </Col>
        <Col span={10} style={{ display: 'flex' }}>
          <Card
            title={<Text strong>公式预览</Text>}
            style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}
            styles={{ body: { display: 'flex', flex: 1, minHeight: 0 } }}
          >
            {activeVersion?.can_view_formula === false ? (
              <Empty
                description={
                  <Space direction="vertical" size={4}>
                    <Text>暂无权限查看完整公式</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>你仍可在权限允许时使用该版本进行回测或训练，公式明文不会返回前端。</Text>
                  </Space>
                }
              />
            ) : activeVersion ? (
              <pre
                style={{
                  background: '#0d1117',
                  border: '1px solid #21262d',
                  borderRadius: 6,
                  padding: 16,
                  fontSize: 13,
                  fontFamily: "'JetBrains Mono', monospace",
                  color: '#16c784',
                  overflow: 'auto',
                  margin: 0,
                  width: '100%',
                  boxSizing: 'border-box',
                  flex: 1,
                  whiteSpace: 'pre-wrap',
                  minHeight: 0,
                  maxHeight: 360,
                }}
              >
                {activeVersion.formula_text || '// 暂无公式'}
              </pre>
            ) : (
              <Empty description="暂无公式" />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={24}>
        <Col span={12}>
          <Card title={<Text strong>关联回测记录</Text>}>
            <Table
              rowKey="id"
              size="small"
              columns={backtestColumns}
              dataSource={visibleBacktestItems}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              locale={{ emptyText: '暂无关联回测记录' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<Text strong>关联训练记录</Text>}>
            <Table
              rowKey="result_id"
              size="small"
              columns={trainingColumns}
              dataSource={visibleTrainingItems}
              pagination={{ pageSize: 5, showSizeChanger: false }}
              locale={{ emptyText: '暂无关联训练记录' }}
            />
          </Card>
        </Col>
      </Row>
      <CommunityPublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        initialTarget={{
          contentType: 'strategy',
          objectId: strategy.id,
          visibility: strategy.visibility,
          currentVersionId: strategy.current_version_id,
          label: strategy.title,
          title: `分享策略：${strategy.title}`,
          summary: strategy.description || `我分享了策略 #${strategy.id}，欢迎一起讨论它的公式、回测和训练表现。`,
        }}
        onPublished={(contentId) => navigate(`/community/${contentId}`)}
      />
    </Space>
  );
}
