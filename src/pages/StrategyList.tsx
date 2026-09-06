import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, Table, Input, Tag, Typography, Space, Segmented, Empty, Button } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { strategyApi } from '@/api/strategy';
import { useTokenStore } from '@/store/auth';
import type { Strategy } from '@/types';

const { Link, Text, Title } = Typography;

const statusLabels: Record<number, { text: string; color: string }> = {
  1: { text: '草稿', color: 'default' },
  2: { text: '已发布', color: 'green' },
  3: { text: '已归档', color: 'orange' },
};

const visibilityLabels: Record<number, { text: string; color: string }> = {
  1: { text: '私有', color: 'default' },
  2: { text: '公开', color: 'green' },
  3: { text: '不列出', color: 'orange' },
};

export default function StrategyList() {
  const navigate = useNavigate();
  const userId = useTokenStore((state) => state.userId);
  const [keyword, setKeyword] = useState('');
  const [sort, setSort] = useState<string>('favorite_count');
  const [scope, setScope] = useState<'square' | 'mine'>('square');

  const { data, isLoading } = useQuery({
    queryKey: ['strategies', scope, userId, keyword, sort],
    queryFn: () => strategyApi.list({ keyword, sort, author_id: scope === 'mine' && userId ? userId : undefined, limit: 50 }),
    staleTime: 30_000,
  });

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'title',
      render: (title: string, r: Strategy) => (
        <a onClick={() => navigate(`/strategies/${r.id}`)} style={{ color: '#e6edf3', fontWeight: 500 }}>
          {title}
        </a>
      ),
    },
    {
      title: '作者',
      dataIndex: 'author_name',
      width: 140,
      ellipsis: true,
      render: (name: string, r: Strategy) =>
        r.author_id ? (
          <Link
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/u/${r.author_id}`);
            }}
          >
            {name || `用户 #${r.author_id}`}
          </Link>
        ) : (
          <Text type="secondary">匿名用户</Text>
        ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      width: 100,
      render: (c: string) => (c ? <Tag bordered={false}>{c}</Tag> : <span style={{ color: '#484f58' }}>—</span>),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[]) =>
        tags?.length ? (
          <Space size={4} wrap>
            {tags.slice(0, 3).map((t) => (
              <Tag key={t} bordered={false} color="cyan" style={{ fontSize: 11 }}>{t}</Tag>
            ))}
          </Space>
        ) : (
          <span style={{ color: '#484f58' }}>—</span>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (s: number) => {
        const meta = statusLabels[s] ?? { text: '未知', color: 'default' };
        return <Tag bordered={false} color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      width: 90,
      render: (v: number) => {
        const meta = visibilityLabels[v] ?? { text: '—', color: 'default' };
        return <Tag bordered={false} color={meta.color}>{meta.text}</Tag>;
      },
    },
    { title: '收藏', dataIndex: 'favorite_count', width: 80, align: 'right' as const, sorter: (a: Strategy, b: Strategy) => a.favorite_count - b.favorite_count },
    { title: 'Fork', dataIndex: 'fork_count', width: 80, align: 'right' as const },
    { title: '浏览', dataIndex: 'view_count', width: 80, align: 'right' as const },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space direction="vertical" size={2}>
          <Title level={4} style={{ margin: 0 }}>{scope === 'square' ? '策略广场' : '我的策略'}</Title>
          <Text type="secondary">{scope === 'square' ? '发现公开策略，查看表现、Fork 到自己的研究空间。' : '管理草稿、私有策略和已发布策略。'}</Text>
        </Space>
        <Space>
          <Segmented
            value={scope}
            onChange={(v) => setScope(v as 'square' | 'mine')}
            options={[
              { label: '策略广场', value: 'square' },
              { label: '我的策略', value: 'mine' },
            ]}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/strategies/new')}>新建策略</Button>
          <Input
            placeholder="搜索策略名称、标签..."
            prefix={<SearchOutlined style={{ color: '#484f58' }} />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Segmented
            value={sort}
            onChange={(v) => setSort(v as string)}
            options={[
              { label: '最热', value: 'favorite_count' },
              { label: '最新', value: 'created_at' },
              { label: '浏览', value: 'view_count' },
            ]}
          />
        </Space>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={data?.items ?? []}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无策略" /> }}
          onRow={(r) => ({ onClick: () => navigate(`/strategies/${r.id}`), style: { cursor: 'pointer' } })}
        />
      </Card>
    </Space>
  );
}
