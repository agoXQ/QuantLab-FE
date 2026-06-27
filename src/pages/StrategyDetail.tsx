import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Row, Col, Card, Typography, Tag, Space, Button, Skeleton, Empty, Descriptions, Divider, Timeline, App } from 'antd';
import { ArrowLeftOutlined, ForkOutlined, StarOutlined, PlayCircleOutlined, EditOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { strategyApi } from '@/api/strategy';
import { ApiError } from '@/api/client';
import dayjs from 'dayjs';

const { Title, Paragraph, Text } = Typography;

const statusLabels: Record<number, { text: string; color: string }> = {
  1: { text: '草稿', color: 'default' },
  2: { text: '已发布', color: 'green' },
  3: { text: '已归档', color: 'orange' },
};

export default function StrategyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const sid = Number(id);

  const forkMutation = useMutation({
    mutationFn: () => strategyApi.fork(sid),
    onSuccess: (newId) => {
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

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;
  if (!strategy) return <Empty description="策略不存在" />;

  const statusMeta = statusLabels[strategy.status] ?? { text: '未知', color: 'default' };

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
            <Button icon={<EditOutlined />} onClick={() => navigate(`/strategies/${sid}/edit`)}>
              编辑
            </Button>
            <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => navigate(`/strategies/${sid}/backtest`)}>
              回测
            </Button>
          </Space>
        </div>
        <Divider style={{ margin: '16px 0' }} />
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="收藏">{strategy.favorite_count}</Descriptions.Item>
          <Descriptions.Item label="Fork">{strategy.fork_count}</Descriptions.Item>
          <Descriptions.Item label="浏览">{strategy.view_count}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{dayjs.unix(strategy.created_at).format('YYYY-MM-DD')}</Descriptions.Item>
        </Descriptions>
      </Card>

      <Row gutter={24}>
        <Col span={14}>
          <Card title={<Text strong>版本历史</Text>}>
            {versions && versions.length > 0 ? (
              <Timeline
                items={versions.map((v) => ({
                  color: '#16c784',
                  children: (
                    <div>
                      <Space>
                        <Text strong>v{v.version_no || v.id}</Text>
                        <Text style={{ fontSize: 12, color: '#8b949e' }}>
                          {dayjs.unix(v.created_at).format('YYYY-MM-DD HH:mm')}
                        </Text>
                      </Space>
                      {v.change_log && (
                        <Paragraph style={{ margin: '4px 0 0', color: '#8b949e', fontSize: 12 }}>
                          {v.change_log}
                        </Paragraph>
                      )}
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty description="暂无版本" />
            )}
          </Card>
        </Col>
        <Col span={10}>
          <Card title={<Text strong>公式预览</Text>}>
            {versions && versions[0] ? (
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
                  whiteSpace: 'pre-wrap',
                }}
              >
                {versions[0].formula_text || '// 暂无公式'}
              </pre>
            ) : (
              <Empty description="暂无公式" />
            )}
          </Card>
        </Col>
      </Row>
    </Space>
  );
}
