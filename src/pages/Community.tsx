import { type ReactNode, useMemo, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Empty,
  List,
  Space,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  CommentOutlined,
  ExperimentOutlined,
  FunctionOutlined,
  HeartOutlined,
  LikeOutlined,
  PlusOutlined,
  ReloadOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { communityApi } from '@/api/community';
import { ApiError } from '@/api/client';
import CommunityPublishModal from '@/components/CommunityPublishModal';
import type { CommunityContent, CommunityFeedItem } from '@/types';

const { Paragraph, Text, Title } = Typography;

const contentTypeMeta: Record<string, { label: string; color: string }> = {
  strategy: { label: '策略', color: 'green' },
  backtest: { label: '回测', color: 'blue' },
  portfolio: { label: '组合', color: 'purple' },
  formula: { label: '公式', color: 'cyan' },
  training: { label: '训练', color: 'gold' },
  post: { label: '动态', color: 'default' },
};

const visualMeta: Record<string, { icon: ReactNode; accent: string; bg: string; title: string }> = {
  strategy: {
    icon: <ExperimentOutlined />,
    accent: '#16c784',
    bg: 'linear-gradient(135deg, rgba(22,199,132,0.16), rgba(22,199,132,0.03))',
    title: '策略分享',
  },
  formula: {
    icon: <FunctionOutlined />,
    accent: '#13c2c2',
    bg: 'linear-gradient(135deg, rgba(19,194,194,0.16), rgba(19,194,194,0.03))',
    title: '公式讨论',
  },
  training: {
    icon: <BarChartOutlined />,
    accent: '#f0b90b',
    bg: 'linear-gradient(135deg, rgba(240,185,11,0.16), rgba(240,185,11,0.03))',
    title: '训练复盘',
  },
  post: {
    icon: <RocketOutlined />,
    accent: '#8b949e',
    bg: 'linear-gradient(135deg, rgba(139,148,158,0.14), rgba(139,148,158,0.03))',
    title: '社区动态',
  },
};

function typeMeta(type: string) {
  return contentTypeMeta[type] ?? { label: type || '内容', color: 'default' };
}

function objectPath(content: CommunityContent) {
  if (!content.object_id) return '';
  if (content.content_type === 'strategy') return `/strategies/${content.object_id}`;
  if (content.content_type === 'backtest') return `/backtests/${content.object_id}`;
  if (content.content_type === 'portfolio') return `/portfolios/${content.object_id}`;
  if (content.content_type === 'training') return `/trainings/records/${content.object_id}`;
  return '';
}

function visualFor(type: string) {
  return visualMeta[type] ?? visualMeta.post;
}

function summaryLines(summary: string) {
  return summary.split('\n').map((line) => line.trim()).filter(Boolean);
}

function renderContentPreview(content: CommunityContent) {
  if (content.content_type === 'formula') {
    const lines = summaryLines(content.summary);
    const code = lines.slice(-1)[0] ?? content.summary;
    return (
      <pre
        style={{
          margin: 0,
          padding: '10px 12px',
          borderRadius: 8,
          background: '#0d1117',
          border: '1px solid #21262d',
          color: '#16c784',
          fontSize: 12,
          maxHeight: 88,
          overflow: 'hidden',
          whiteSpace: 'pre-wrap',
        }}
      >
        {code || '// 暂无公式摘要'}
      </pre>
    );
  }
  if (content.content_type === 'training') {
    return (
      <Space size={8} wrap>
        {summaryLines(content.summary).slice(0, 4).map((line) => (
          <Tag key={line} bordered={false} color={line.includes('收益') ? 'green' : line.includes('回撤') ? 'orange' : 'default'}>
            {line}
          </Tag>
        ))}
      </Space>
    );
  }
  return (
    <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
      {content.summary || '这个作者很神秘，什么摘要都没写。'}
    </Paragraph>
  );
}

export default function Community() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const [publishOpen, setPublishOpen] = useState(false);

  const feedQuery = useInfiniteQuery({
    queryKey: ['community-feed'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => communityApi.getFeed({ limit: 20, cursor: pageParam || undefined }),
    getNextPageParam: (lastPage) => (lastPage.cursor?.has_more ? lastPage.cursor.next_cursor : undefined),
    staleTime: 15_000,
  });

  const items = useMemo(
    () => feedQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [feedQuery.data],
  );

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: number; action: 'like' | 'favorite' }) =>
      action === 'like' ? communityApi.like(id) : communityApi.favorite(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-feed'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  const renderItem = (item: CommunityFeedItem) => {
    const content = item.content;
    const meta = typeMeta(content.content_type);
    const target = objectPath(content);
    const visual = visualFor(content.content_type);
    return (
      <List.Item style={{ padding: 0, borderBlockEnd: 'none' }}>
        <Card
          hoverable
          style={{ width: '100%' }}
          onClick={() => navigate(`/community/${content.id}`)}
        >
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div
              style={{
                margin: '-8px -8px 0',
                padding: '12px 14px',
                borderRadius: 10,
                background: visual.bg,
                border: `1px solid ${visual.accent}33`,
              }}
            >
              <Space style={{ justifyContent: 'space-between', width: '100%' }}>
                <Space>
                  <span style={{ color: visual.accent, fontSize: 18 }}>{visual.icon}</span>
                  <Text style={{ color: visual.accent }}>{visual.title}</Text>
                </Space>
                <Text type="secondary">热度 {item.score.toFixed(0)}</Text>
              </Space>
            </div>
            <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
              <Space size={8} wrap>
                <Tag bordered={false} color={meta.color}>{meta.label}</Tag>
                <Text type="secondary">用户 #{content.author_id}</Text>
                <Text type="secondary">{dayjs.unix(content.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                {target && <Tag bordered={false}>关联 #{content.object_id}</Tag>}
              </Space>
            </Space>

            <div>
              <Title level={5} style={{ margin: 0 }}>{content.title}</Title>
              <div style={{ marginTop: 8 }}>{renderContentPreview(content)}</div>
            </div>

            <Space split={<span style={{ color: '#30363d' }}>|</span>} wrap>
              <Button
                type="text"
                size="small"
                icon={<LikeOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  actionMutation.mutate({ id: content.id, action: 'like' });
                }}
              >
                {content.like_count}
              </Button>
              <Button
                type="text"
                size="small"
                icon={<HeartOutlined />}
                onClick={(event) => {
                  event.stopPropagation();
                  actionMutation.mutate({ id: content.id, action: 'favorite' });
                }}
              >
                {content.favorite_count}
              </Button>
              <Button type="text" size="small" icon={<CommentOutlined />}>
                {content.comment_count}
              </Button>
              {target && (
                <Button
                  type="link"
                  size="small"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(target);
                  }}
                >
                  查看原对象
                </Button>
              )}
            </Space>
          </Space>
        </Card>
      </List.Item>
    );
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card>
        <Space style={{ justifyContent: 'space-between', width: '100%' }} align="center">
          <div>
            <Space align="center">
              <RocketOutlined style={{ color: '#16c784', fontSize: 20 }} />
              <Title level={4} style={{ margin: 0 }}>社区</Title>
            </Space>
            <Text type="secondary">分享策略、公式、回测洞察，让好想法长出第二条腿。</Text>
          </div>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => feedQuery.refetch()}>
              刷新
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setPublishOpen(true)}>
              发布内容
            </Button>
          </Space>
        </Space>
      </Card>

      <Space size={16} align="start" style={{ width: '100%' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <List
            loading={feedQuery.isLoading}
            dataSource={items}
            renderItem={renderItem}
            locale={{ emptyText: <Empty description="社区还没有内容，来抢第一帖吧" /> }}
            split={false}
            style={{ display: 'grid', gap: 12 }}
          />
          {feedQuery.hasNextPage && (
            <Button
              block
              style={{ marginTop: 12 }}
              loading={feedQuery.isFetchingNextPage}
              onClick={() => feedQuery.fetchNextPage()}
            >
              加载更多
            </Button>
          )}
        </div>

        <Card style={{ width: 280 }} title="社区概览">
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Statistic title="当前加载内容" value={items.length} suffix="条" />
            <Paragraph type="secondary" style={{ margin: 0 }}>
              当前版本优先打通内容发布、信息流、评论和互动。后续可以加热门榜、关注流和审核队列。
            </Paragraph>
          </Space>
        </Card>
      </Space>

      <CommunityPublishModal
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublished={(contentId) => navigate(`/community/${contentId}`)}
      />
    </Space>
  );
}
