import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Card, Descriptions, Empty, Space, Spin, Table, Tag, Typography, type TableColumnsType } from 'antd';
import { ArrowLeftOutlined, ShareAltOutlined } from '@ant-design/icons';
import { trainingApi } from '@/api/training';
import CommunityPublishModal from '@/components/CommunityPublishModal';
import EquityChart from '@/components/EquityChart';
import TrainingKLineChart from '@/components/TrainingKLineChart';
import type { TrainingOrder, TrainingSnapshot, TrainingTrade } from '@/types';

const { Title, Text } = Typography;

interface TrainingOrderLifecycle extends TrainingOrder {
  matchedTrades: TrainingTrade[];
  filledAmount: number;
  totalFee: number;
}

function stageText(stage?: number | string) {
  return stage === 'CLOSE_STAGE' || stage === 2 ? '收盘阶段' : '开盘阶段';
}

function sideText(side: number | string) {
  return side === 'SELL' || side === 2 ? '卖出' : '买入';
}

function orderTypeText(type: number | string) {
  if (type === 'TAKE_PROFIT' || type === 3) return '止盈';
  if (type === 'STOP_LOSS' || type === 4) return '止损';
  if (type === 'LIMIT' || type === 2) return '限价';
  return '市价';
}

function orderStatusText(status: number | string) {
  if (status === 'FILLED' || status === 2) return '已成交';
  if (status === 'CANCELLED_ORDER' || status === 3) return '已撤单';
  if (status === 'EXPIRED' || status === 4) return '已过期';
  if (status === 'REJECTED' || status === 5) return '已拒绝';
  return '委托中';
}

function formatMoney(value?: number) {
  return (value ?? 0).toFixed(2);
}

function formatCurrency(value?: number) {
  return `¥${formatMoney(value)}`;
}

function formatPercent(value?: number) {
  return `${((value ?? 0) * 100).toFixed(2)}%`;
}

function formatSignedMoney(value?: number) {
  const nextValue = value ?? 0;
  return `${nextValue >= 0 ? '+' : ''}${nextValue.toFixed(2)}`;
}

function yesNo(value?: boolean) {
  return value ? '开启' : '关闭';
}

function shortId(value?: string) {
  if (!value) return '--';
  return value.length > 10 ? `${value.slice(0, 8)}…` : value;
}

function numericObjectID(value?: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function findTrainingStartBarIndex(bars: { bar_index: number; trade_date?: string }[] = [], startDate?: string) {
  if (startDate) {
    const matched = bars.find((bar) => bar.trade_date?.slice(0, 10) === startDate.slice(0, 10));
    if (matched) return matched.bar_index;
  }
  return bars[120]?.bar_index ?? bars[0]?.bar_index;
}

export default function TrainingRecordDetail() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams();
  const [publishOpen, setPublishOpen] = useState(false);
  const { data: replay, isLoading } = useQuery({
    queryKey: ['training-record-detail', sessionId],
    queryFn: () => trainingApi.getReplay(sessionId),
    enabled: !!sessionId,
  });

  const result = replay?.result;
  const session = replay?.session;
  const startBarIndex = useMemo(() => findTrainingStartBarIndex(replay?.bars ?? [], result?.start_trade_date), [replay?.bars, result?.start_trade_date]);
  const equityPoints = useMemo(() => {
    const initialAsset = result?.initial_asset || session?.initial_asset || 0;
    return (replay?.snapshots ?? []).map((snapshot) => ({
      trade_date: `${snapshot.trade_date || `#${snapshot.bar_index}`} ${stageText(snapshot.stage).replace('阶段', '')}`,
      nav: initialAsset > 0 ? snapshot.total_asset / initialAsset : snapshot.total_asset,
      return_rate: initialAsset > 0 ? snapshot.total_asset / initialAsset - 1 : 0,
    }));
  }, [replay?.snapshots, result?.initial_asset, session?.initial_asset]);

  const orderLifecycle = useMemo(() => {
    const tradesByOrder = new Map<string, TrainingTrade[]>();
    (replay?.trades ?? []).forEach((trade) => {
      const items = tradesByOrder.get(trade.order_id) ?? [];
      items.push(trade);
      tradesByOrder.set(trade.order_id, items);
    });
    return (replay?.orders ?? []).map((order) => {
      const matchedTrades = tradesByOrder.get(order.order_id) ?? [];
      const filledAmount = matchedTrades.reduce((sum, trade) => sum + (trade.amount ?? 0), 0);
      const totalFee = matchedTrades.reduce((sum, trade) => sum + (trade.total_fee ?? 0), 0);
      return { ...order, matchedTrades, filledAmount, totalFee };
    });
  }, [replay?.orders, replay?.trades]);

  const orderColumns = useMemo<TableColumnsType<TrainingOrderLifecycle>>(() => [
    { title: '委托', dataIndex: 'order_id', width: 110, render: shortId },
    { title: '方向', dataIndex: 'side', width: 70, render: (value: number | string) => <Tag color={sideText(value) === '买入' ? 'green' : 'red'}>{sideText(value)}</Tag> },
    { title: '类型', dataIndex: 'order_type', width: 70, render: orderTypeText },
    { title: '价格', dataIndex: 'price', width: 90, align: 'right' as const, render: (value: number) => value ? value.toFixed(2) : '市价' },
    { title: '手数', dataIndex: 'hand_count', width: 70, align: 'right' as const },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: number | string) => <Tag>{orderStatusText(value)}</Tag> },
    { title: '冻结资金', dataIndex: 'frozen_cash', width: 100, align: 'right' as const, render: formatMoney },
    { title: '冻结股数', dataIndex: 'frozen_quantity', width: 100, align: 'right' as const },
    { title: '阶段', dataIndex: 'stage', width: 90, render: stageText },
    { title: '日期', dataIndex: 'trade_date', width: 110, render: (value?: string) => value || '--' },
  ], []);

  const tradeColumns = useMemo<TableColumnsType<TrainingTrade>>(() => [
    { title: '成交', dataIndex: 'trade_id', width: 110, render: shortId },
    { title: '方向', dataIndex: 'side', width: 70, render: (value: number | string) => <Tag color={sideText(value) === '买入' ? 'green' : 'red'}>{sideText(value)}</Tag> },
    { title: '价格', dataIndex: 'price', width: 90, align: 'right' as const, render: (value: number) => value?.toFixed(2) },
    { title: '数量', dataIndex: 'quantity', width: 90, align: 'right' as const },
    { title: '成交额', dataIndex: 'amount', width: 100, align: 'right' as const, render: formatMoney },
    { title: '费用', dataIndex: 'total_fee', width: 90, align: 'right' as const, render: formatMoney },
    { title: '阶段', dataIndex: 'stage', width: 90, render: stageText },
    { title: '日期', dataIndex: 'trade_date', width: 110, render: (value?: string) => value || '--' },
  ], []);

  const snapshotColumns = useMemo<TableColumnsType<TrainingSnapshot>>(() => [
    { title: '阶段', dataIndex: 'stage', width: 90, render: stageText },
    { title: '日期', dataIndex: 'trade_date', width: 110, render: (value?: string) => value || '--' },
    { title: 'K线', dataIndex: 'bar_index', width: 70, align: 'right' as const },
    { title: '总资产', dataIndex: 'total_asset', width: 110, align: 'right' as const, render: formatMoney },
    { title: '现金', dataIndex: 'cash', width: 110, align: 'right' as const, render: formatMoney },
    { title: '持仓市值', dataIndex: 'market_value', width: 110, align: 'right' as const, render: formatMoney },
    { title: '持仓股数', dataIndex: 'position_quantity', width: 100, align: 'right' as const },
    { title: '回撤', dataIndex: 'drawdown', width: 90, align: 'right' as const, render: formatPercent },
  ], []);

  if (isLoading) return <Spin />;
  if (!replay || !result) return <Empty description="暂无训练详情" />;

  return (
    <Space orientation="vertical" size={16} style={{ width: '100%' }}>
      <Space style={{ justifyContent: 'space-between', width: '100%' }}>
        <Title level={4} style={{ margin: 0 }}>{result.security_name || result.symbol} · 训练详情</Title>
        <Space>
          <Button icon={<ShareAltOutlined />} onClick={() => setPublishOpen(true)}>发布到社区</Button>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/trainings')}>返回训练中心</Button>
        </Space>
      </Space>
      <TrainingKLineChart bars={replay.bars ?? []} trades={replay.trades ?? []} trainingStartBarIndex={startBarIndex} height={430} />
      <Card size="small" title="资产曲线">
        {equityPoints.length > 0 ? <EquityChart points={equityPoints} height={260} /> : <Empty description="暂无资产快照" />}
      </Card>
      <Card size="small" title="结果摘要">
        <Descriptions size="small" column={3} bordered>
          <Descriptions.Item label="标的">{result.security_name || result.symbol}</Descriptions.Item>
          <Descriptions.Item label="区间">{result.start_trade_date} → {result.end_trade_date}</Descriptions.Item>
          <Descriptions.Item label="收益"><Text style={{ color: result.profit_amount >= 0 ? '#16c784' : '#ea3943' }}>{formatSignedMoney(result.profit_amount)}</Text></Descriptions.Item>
          <Descriptions.Item label="收益率">{formatPercent(result.return_rate)}</Descriptions.Item>
          <Descriptions.Item label="最大回撤">{formatPercent(result.max_drawdown)}</Descriptions.Item>
          <Descriptions.Item label="总费用">{formatCurrency(result.total_fee)}</Descriptions.Item>
          <Descriptions.Item label="交易次数">{result.trade_count}</Descriptions.Item>
          <Descriptions.Item label="持仓天数">{result.holding_days}</Descriptions.Item>
          <Descriptions.Item label="胜负">{result.is_win ? <Tag color="green">盈利</Tag> : <Tag color="red">亏损</Tag>}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card size="small" title="训练参数快照">
        <Descriptions size="small" column={3} bordered>
          <Descriptions.Item label="训练K线数">{session?.bar_count ?? '--'}</Descriptions.Item>
          <Descriptions.Item label="限价单">{yesNo(session?.order_config?.enable_limit_order)}</Descriptions.Item>
          <Descriptions.Item label="止盈止损">{yesNo(session?.order_config?.enable_take_profit_stop_loss)}</Descriptions.Item>
          <Descriptions.Item label="买佣金率">{formatPercent(session?.fee_config?.buy_commission_rate)}</Descriptions.Item>
          <Descriptions.Item label="卖佣金率">{formatPercent(session?.fee_config?.sell_commission_rate)}</Descriptions.Item>
          <Descriptions.Item label="印花税率">{formatPercent(session?.fee_config?.stamp_tax_rate)}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card size="small" title="阶段账户快照">
        <Table rowKey="snapshot_id" size="small" columns={snapshotColumns} dataSource={replay.snapshots ?? []} pagination={{ pageSize: 8, size: 'small' }} locale={{ emptyText: '暂无账户快照' }} />
      </Card>
      <Table
        rowKey="order_id"
        size="small"
        columns={orderColumns}
        dataSource={orderLifecycle}
        pagination={false}
        locale={{ emptyText: '暂无委托' }}
        expandable={{
          expandedRowRender: (record) => (
            <Descriptions size="small" column={3}>
              <Descriptions.Item label="成交笔数">{record.matchedTrades.length}</Descriptions.Item>
              <Descriptions.Item label="成交额">{formatCurrency(record.filledAmount)}</Descriptions.Item>
              <Descriptions.Item label="成交费用">{formatCurrency(record.totalFee)}</Descriptions.Item>
              <Descriptions.Item label="拒绝原因">{record.reject_reason || '--'}</Descriptions.Item>
            </Descriptions>
          ),
          rowExpandable: (record) => record.matchedTrades.length > 0 || !!record.reject_reason,
        }}
      />
      <Table rowKey="trade_id" size="small" columns={tradeColumns} dataSource={replay.trades ?? []} pagination={false} locale={{ emptyText: '暂无成交' }} />
      <CommunityPublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        initialTarget={{
          contentType: 'training',
          objectId: numericObjectID(result.session_id),
          objectKey: `training:${result.session_id}`,
          label: result.security_name || result.symbol,
          title: `分享训练结果：${result.security_name || result.symbol}`,
          summary: [
            `训练标的：${result.security_name || result.symbol}`,
            `区间：${result.start_trade_date} → ${result.end_trade_date}`,
            `收益：${formatSignedMoney(result.profit_amount)}（${formatPercent(result.return_rate)}）`,
            `最大回撤：${formatPercent(result.max_drawdown)}，交易次数：${result.trade_count}`,
            `训练 Session：${result.session_id}`,
          ].join('\n'),
        }}
        onPublished={(contentId) => navigate(`/community/${contentId}`)}
      />
    </Space>
  );
}
