import { useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Form,
  Input,
  DatePicker,
  Button,
  Typography,
  Space,
  Skeleton,
  Empty,
  Descriptions,
  App,
  Row,
  Col,
  Radio,
  Select,
} from 'antd';
import { ArrowLeftOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { strategyApi } from '@/api/strategy';
import { backtestApi } from '@/api/backtest';
import { ApiError } from '@/api/client';

const { Title, Text, Paragraph } = Typography;

const { RangePicker } = DatePicker;

interface RangeValues {
  range: [Dayjs, Dayjs];
  execution_mode: 'trading' | 'rebalance';
  rebalance_period: 'daily' | 'weekly' | 'monthly';
}

export default function BacktestCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const sid = Number(id);
  const requestedVersionId = Number(searchParams.get('version_id') || 0);
  const [form] = Form.useForm<RangeValues>();

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

  const latestVersion = useMemo(
    () => versions?.find((version) => version.id === requestedVersionId) ?? versions?.[0],
    [requestedVersionId, versions],
  );

  const createMutation = useMutation({
    mutationFn: async (v: RangeValues) => {
      if (!latestVersion) throw new Error('该策略暂无可用版本');
      const start = v.range[0].format('YYYY-MM-DD');
      const end = v.range[1].format('YYYY-MM-DD');
      const jobId = await backtestApi.create({
        strategy_id: sid,
        version_id: latestVersion.id,
        start_date: start,
        end_date: end,
        execution_mode: v.execution_mode ?? 'trading',
        rebalance_period: v.rebalance_period ?? 'weekly',
      });
      if (!jobId || jobId <= 0) {
        throw new Error('回测任务创建失败，后端未返回有效任务 ID');
      }
      return jobId;
    },
    onSuccess: (jobId) => {
      qc.invalidateQueries({ queryKey: ['backtests'] });
      message.success('回测任务已创建');
      navigate(`/backtests/${jobId}`);
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '创建失败');
    },
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!strategy) return <Empty description="策略不存在" />;

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#8b949e' }}>
        返回
      </Button>

      <Row gutter={24}>
        <Col span={15}>
          <Card title={<Title level={5} style={{ margin: 0 }}>新建回测</Title>}>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              选择回测区间和执行模型。默认交易型策略只在买入/卖出信号触发时交易；组合轮动模式按调仓频率做目标池再平衡。
            </Paragraph>
            <Form
              form={form}
              layout="vertical"
              requiredMark
              initialValues={{
                range: [dayjs().subtract(3, 'year'), dayjs()],
                execution_mode: 'trading',
                rebalance_period: 'weekly',
              }}
            >
              <Form.Item
                name="range"
                label="回测区间"
                rules={[{ required: true, message: '请选择回测区间' }]}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
              <Form.Item
                name="execution_mode"
                label="回测模型"
                tooltip="交易型适合形态/买卖信号策略；组合轮动适合因子选股和定期调仓策略。"
                rules={[{ required: true, message: '请选择回测模型' }]}
              >
                <Radio.Group
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { label: '交易型策略（默认）', value: 'trading' },
                    { label: '组合轮动/再平衡', value: 'rebalance' },
                  ]}
                />
              </Form.Item>
              <Form.Item shouldUpdate={(prev, cur) => prev.execution_mode !== cur.execution_mode} noStyle>
                {({ getFieldValue }) => (
                  <Form.Item
                    name="rebalance_period"
                    label="调仓频率"
                    tooltip="仅组合轮动/再平衡模式生效。"
                  >
                    <Select
                      disabled={getFieldValue('execution_mode') !== 'rebalance'}
                      options={[
                        { label: '每日', value: 'daily' },
                        { label: '每周', value: 'weekly' },
                        { label: '每月', value: 'monthly' },
                      ]}
                    />
                  </Form.Item>
                )}
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={createMutation.isPending}
                  disabled={!latestVersion}
                  onClick={() => form.validateFields().then((v) => createMutation.mutate(v))}
                >
                  开始回测
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={9}>
          <Card title={<Text strong>策略概览</Text>}>
            <Descriptions size="small" column={1}>
              <Descriptions.Item label="名称">{strategy.title}</Descriptions.Item>
              <Descriptions.Item label="分类">{strategy.category || '—'}</Descriptions.Item>
              <Descriptions.Item label={requestedVersionId ? '指定版本' : '最新版本'}>
                {latestVersion ? `v${latestVersion.version_no ?? latestVersion.id}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs.unix(strategy.created_at).format('YYYY-MM-DD')}
              </Descriptions.Item>
            </Descriptions>
            {latestVersion?.can_view_formula === false ? (
              <Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
                暂无权限查看该版本公式明文，但可以按版本权限创建回测任务。
              </Paragraph>
            ) : latestVersion?.formula_text && (
              <>
                <Text strong style={{ display: 'block', margin: '12px 0 6px' }}>
                  公式预览
                </Text>
                <pre
                  style={{
                    background: '#0d1117',
                    border: '1px solid #21262d',
                    borderRadius: 6,
                    padding: 12,
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: '#16c784',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {latestVersion.formula_text}
                </pre>
              </>
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
