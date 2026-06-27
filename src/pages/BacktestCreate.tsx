import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
}

export default function BacktestCreate() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const sid = Number(id);
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

  const latestVersion = useMemo(() => versions?.[0], [versions]);

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
              选择回测区间。回测将以最新版本（v{latestVersion?.version_no ?? latestVersion?.id ?? '—'}）的公式规则执行，
              采用日线频率，扣除手续费与滑点。
            </Paragraph>
            <Form
              form={form}
              layout="vertical"
              requiredMark
              initialValues={{
                range: [dayjs().subtract(3, 'year'), dayjs()],
              }}
            >
              <Form.Item
                name="range"
                label="回测区间"
                rules={[{ required: true, message: '请选择回测区间' }]}
              >
                <RangePicker style={{ width: '100%' }} />
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
              <Descriptions.Item label="最新版本">
                {latestVersion ? `v${latestVersion.version_no ?? latestVersion.id}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {dayjs.unix(strategy.created_at).format('YYYY-MM-DD')}
              </Descriptions.Item>
            </Descriptions>
            {latestVersion?.formula_text && (
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
