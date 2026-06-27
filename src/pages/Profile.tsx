import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Avatar,
  Typography,
  Space,
  Button,
  Skeleton,
  Empty,
  Tag,
  Row,
  Col,
  Table,
  Statistic,
  App,
} from 'antd';
import { UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { userApi } from '@/api/user';
import { strategyApi } from '@/api/strategy';
import { useTokenStore } from '@/store/auth';
import { ApiError } from '@/api/client';
import type { Strategy } from '@/types';

const { Title, Text, Paragraph } = Typography;

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const uid = Number(id);
  const meId = useTokenStore((s) => s.userId);
  const isMe = meId === uid;

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', uid],
    queryFn: () => userApi.getProfile(uid),
    enabled: !!uid,
  });

  const { data: strategies } = useQuery({
    queryKey: ['user-strategies', uid],
    queryFn: () => userApi.listStrategies(uid, { limit: 50 }),
    enabled: !!uid,
  });

  const followMutation = useMutation({
    mutationFn: () => userApi.follow(uid),
    onSuccess: () => {
      message.success('已关注');
      qc.invalidateQueries({ queryKey: ['profile', uid] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!profile) return <Empty description="用户不存在" />;

  const u = profile.user;

  const columns = [
    {
      title: '策略',
      dataIndex: 'title',
      render: (title: string, r: Strategy) => (
        <a onClick={() => navigate(`/strategies/${r.id}`)} style={{ color: '#e6edf3', fontWeight: 500 }}>
          {title}
        </a>
      ),
    },
    { title: '分类', dataIndex: 'category', width: 100, render: (c: string) => c ? <Tag bordered={false}>{c}</Tag> : '—' },
    { title: '收藏', dataIndex: 'favorite_count', width: 80, align: 'right' as const },
    { title: 'Fork', dataIndex: 'fork_count', width: 80, align: 'right' as const },
    { title: '浏览', dataIndex: 'view_count', width: 80, align: 'right' as const },
    {
      title: '创建',
      dataIndex: 'created_at',
      width: 120,
      render: (t: number) => dayjs.unix(t).format('YYYY-MM-DD'),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#8b949e' }}>
        返回
      </Button>

      <Card>
        <Row gutter={24} align="middle">
          <Col>
            <Avatar size={72} style={{ background: '#1c2330', border: '1px solid #2a313c' }} icon={<UserOutlined />} />
          </Col>
          <Col flex="auto">
            <Space align="center" size={12}>
              <Title level={4} style={{ margin: 0 }}>{u.username}</Title>
              {u.verified_status === 2 && <Tag bordered={false} color="blue">已认证</Tag>}
              {u.creator_status === 2 && <Tag bordered={false} color="green">创作者</Tag>}
              {u.membership_tier && u.membership_tier !== 'FREE' && (
                <Tag bordered={false} color="gold">{u.membership_tier}</Tag>
              )}
            </Space>
            <Paragraph type="secondary" style={{ margin: '4px 0 0' }}>
              {u.bio || '这位创作者还没有留下简介'}
            </Paragraph>
            <Text style={{ fontSize: 12, color: '#484f58' }}>
              加入于 {dayjs.unix(u.created_at).format('YYYY-MM-DD')}
            </Text>
          </Col>
          <Col>
            <Row gutter={32}>
              <Col><Statistic title="策略" value={profile.strategy_count} /></Col>
              <Col><Statistic title="回测" value={profile.backtest_count} /></Col>
              <Col><Statistic title="粉丝" value={profile.follower_count} /></Col>
              <Col><Statistic title="关注" value={profile.following_count} /></Col>
            </Row>
          </Col>
          <Col>
            {!isMe && (
              <Button
                type="primary"
                loading={followMutation.isPending}
                onClick={() => followMutation.mutate()}
              >
                关注
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      <Card title={<Text strong>他的策略</Text>} styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={strategies?.items ?? []}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 10, size: 'small' }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无策略" /> }}
          onRow={(r) => ({ onClick: () => navigate(`/strategies/${r.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </Space>
  );
}
