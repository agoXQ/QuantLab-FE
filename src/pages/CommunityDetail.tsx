import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  App,
  Button,
  Card,
  Empty,
  Input,
  List,
  Popconfirm,
  Skeleton,
  Space,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowLeftOutlined,
  CommentOutlined,
  DeleteOutlined,
  HeartOutlined,
  LikeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { communityApi } from '@/api/community';
import { ApiError } from '@/api/client';
import { useTokenStore } from '@/store/auth';
import type { CommunityContent } from '@/types';

const { Paragraph, Text, Title } = Typography;

const contentTypeMeta: Record<string, { label: string; color: string }> = {
  strategy: { label: '策略', color: 'green' },
  backtest: { label: '回测', color: 'blue' },
  portfolio: { label: '组合', color: 'purple' },
  formula: { label: '公式', color: 'cyan' },
  training: { label: '训练', color: 'gold' },
  post: { label: '动态', color: 'default' },
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

export default function CommunityDetail() {
  const { id } = useParams<{ id: string }>();
  const contentId = Number(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const meId = useTokenStore((state) => state.userId);
  const [body, setBody] = useState('');

  const contentQuery = useQuery({
    queryKey: ['community-content', contentId],
    queryFn: () => communityApi.getContent(contentId),
    enabled: !!contentId,
  });

  const commentsQuery = useInfiniteQuery({
    queryKey: ['community-comments', contentId],
    initialPageParam: '',
    queryFn: ({ pageParam }) => communityApi.listComments(contentId, { limit: 30, cursor: pageParam || undefined }),
    getNextPageParam: (lastPage) => (lastPage.cursor?.has_more ? lastPage.cursor.next_cursor : undefined),
    enabled: !!contentId,
  });

  const comments = useMemo(
    () => commentsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [commentsQuery.data],
  );

  const actionMutation = useMutation({
    mutationFn: (action: 'like' | 'favorite') =>
      action === 'like' ? communityApi.like(contentId) : communityApi.favorite(contentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['community-content', contentId] });
      qc.invalidateQueries({ queryKey: ['community-feed'] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '操作失败'),
  });

  const commentMutation = useMutation({
    mutationFn: () => communityApi.createComment(contentId, { body }),
    onSuccess: () => {
      message.success('评论已发布');
      setBody('');
      qc.invalidateQueries({ queryKey: ['community-content', contentId] });
      qc.invalidateQueries({ queryKey: ['community-comments', contentId] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '评论失败'),
  });

  const deleteMutation = useMutation({
    mutationFn: (commentId: number) => communityApi.deleteComment(commentId),
    onSuccess: () => {
      message.success('评论已删除');
      qc.invalidateQueries({ queryKey: ['community-content', contentId] });
      qc.invalidateQueries({ queryKey: ['community-comments', contentId] });
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '删除失败'),
  });

  if (contentQuery.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
  if (!contentQuery.data) return <Empty description="内容不存在" />;

  const content = contentQuery.data;
  const meta = typeMeta(content.content_type);
  const target = objectPath(content);

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/community')} style={{ color: '#8b949e' }}>
        返回社区
      </Button>

      <Card>
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
            <Space size={8} wrap>
              <Tag bordered={false} color={meta.color}>{meta.label}</Tag>
              <Text type="secondary">用户 #{content.author_id}</Text>
              <Text type="secondary">{dayjs.unix(content.created_at).format('YYYY-MM-DD HH:mm')}</Text>
              {target && <Tag bordered={false}>关联 #{content.object_id}</Tag>}
            </Space>
            {target && <Button onClick={() => navigate(target)}>查看原对象</Button>}
          </Space>

          <div>
            <Title level={3} style={{ marginTop: 0 }}>{content.title}</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap', fontSize: 15 }}>
              {content.summary || '暂无摘要'}
            </Paragraph>
          </div>

          <Space wrap>
            <Button
              icon={<LikeOutlined />}
              loading={actionMutation.isPending}
              onClick={() => actionMutation.mutate('like')}
            >
              点赞 {content.like_count}
            </Button>
            <Button
              icon={<HeartOutlined />}
              loading={actionMutation.isPending}
              onClick={() => actionMutation.mutate('favorite')}
            >
              收藏 {content.favorite_count}
            </Button>
            <Button icon={<CommentOutlined />}>评论 {content.comment_count}</Button>
          </Space>
        </Space>
      </Card>

      <Card title="评论区">
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Input.TextArea
            rows={4}
            value={body}
            maxLength={1000}
            showCount
            placeholder="写下你的看法：可以是交易逻辑、风险提醒，也可以是一个漂亮的疑问。"
            onChange={(event) => setBody(event.target.value)}
          />
          <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
            <Button
              type="primary"
              disabled={!body.trim()}
              loading={commentMutation.isPending}
              onClick={() => commentMutation.mutate()}
            >
              发布评论
            </Button>
          </Space>

          <List
            loading={commentsQuery.isLoading}
            dataSource={comments}
            locale={{ emptyText: <Empty description="暂无评论" /> }}
            renderItem={(comment) => (
              <List.Item
                actions={[
                  meId === comment.user_id ? (
                    <Popconfirm
                      key="delete"
                      title="删除这条评论？"
                      okText="删除"
                      cancelText="取消"
                      onConfirm={() => deleteMutation.mutate(comment.id)}
                    >
                      <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                        删除
                      </Button>
                    </Popconfirm>
                  ) : null,
                ].filter(Boolean)}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text>用户 #{comment.user_id}</Text>
                      <Text type="secondary">{dayjs.unix(comment.created_at).format('YYYY-MM-DD HH:mm')}</Text>
                    </Space>
                  }
                  description={<Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{comment.body}</Paragraph>}
                />
              </List.Item>
            )}
          />
          {commentsQuery.hasNextPage && (
            <Button block loading={commentsQuery.isFetchingNextPage} onClick={() => commentsQuery.fetchNextPage()}>
              加载更多评论
            </Button>
          )}
        </Space>
      </Card>
    </Space>
  );
}
