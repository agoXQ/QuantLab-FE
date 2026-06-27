import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Typography,
  Space,
  Button,
  Empty,
  Skeleton,
  Tag,
  Modal,
  Form,
  Input,
  App,
} from 'antd';
import { FundOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { portfolioApi } from '@/api/portfolio';
import { useTokenStore } from '@/store/auth';
import { ApiError } from '@/api/client';
import type { Portfolio } from '@/types';

const { Title, Text } = Typography;

const visibilityLabels: Record<number, { text: string; color: string }> = {
  1: { text: '私密', color: 'default' },
  2: { text: '公开', color: 'green' },
  3: { text: '不列出', color: 'orange' },
};

export default function Portfolios() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const userId = useTokenStore((s) => s.userId);
  const { message } = App.useApp();
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm<{ name: string; description: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['portfolios', userId],
    queryFn: () => portfolioApi.list({ owner_id: userId ?? undefined, limit: 50 }),
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: (v: { name: string; description?: string }) =>
      portfolioApi.create({ name: v.name, description: v.description, visibility: 1 }),
    onSuccess: (pid) => {
      qc.invalidateQueries({ queryKey: ['portfolios'] });
      message.success('组合已创建');
      setCreateOpen(false);
      form.resetFields();
      navigate(`/portfolios/${pid}`);
    },
    onError: (e) => message.error(e instanceof ApiError ? e.message : '创建失败'),
  });

  const columns = [
    {
      title: '组合名称',
      dataIndex: 'name',
      render: (name: string, r: Portfolio) => (
        <a onClick={() => navigate(`/portfolios/${r.id}`)} style={{ color: '#e6edf3', fontWeight: 500 }}>
          {name}
        </a>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      ellipsis: true,
      render: (d: string) => <Text style={{ color: '#8b949e' }}>{d || '—'}</Text>,
    },
    {
      title: '策略数',
      dataIndex: 'items',
      width: 90,
      align: 'right' as const,
      render: (items: Portfolio['items']) => items?.length ?? 0,
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
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 150,
      render: (t: number) => (t ? dayjs.unix(t).format('YYYY-MM-DD') : '—'),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <FundOutlined style={{ fontSize: 20, color: '#16c784' }} />
          <Title level={4} style={{ margin: 0 }}>我的组合</Title>
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建组合
        </Button>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        {isLoading ? (
          <Skeleton active paragraph={{ rows: 6 }} style={{ padding: 24 }} />
        ) : data && data.items.length > 0 ? (
          <Table
            dataSource={data.items}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            onRow={(r) => ({ onClick: () => navigate(`/portfolios/${r.id}`), style: { cursor: 'pointer' } })}
          />
        ) : (
          <Empty description="暂无组合，点击右上角创建" style={{ padding: 48 }} />
        )}
      </Card>

      <Modal
        title="新建组合"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={createMutation.isPending}
        onOk={() => form.validateFields().then((v) => createMutation.mutate(v))}
        okText="创建"
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="name" label="组合名称" rules={[{ required: true, message: '请输入组合名称' }, { max: 60 }]}>
            <Input placeholder="例如：价值成长组合" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={2} placeholder="组合投资目标" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
