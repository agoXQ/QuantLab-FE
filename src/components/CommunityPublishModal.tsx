import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { App, Form, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { communityApi } from '@/api/community';
import { strategyApi } from '@/api/strategy';
import { formulaApi } from '@/api/formula';
import { trainingApi } from '@/api/training';
import { ApiError } from '@/api/client';
import { useFormulaStore, type SavedFormula } from '@/store/formula';
import type { Strategy, TrainingResult } from '@/types';

const { Text } = Typography;

export type CommunityPublishType = 'post' | 'strategy' | 'formula' | 'training' | 'backtest' | 'portfolio';

export interface CommunityPublishTarget {
  contentType: CommunityPublishType;
  objectId?: number;
  objectKey?: string;
  visibility?: number;
  currentVersionId?: number;
  label?: string;
  title?: string;
  summary?: string;
}

interface CommunityObjectOption {
  key: string;
  label: string;
  description?: string;
  objectId?: number;
  visibility?: number;
  currentVersionId?: number;
  title?: string;
  summary?: string;
}

interface PublishForm {
  content_type: CommunityPublishType;
  object_key?: string;
  title: string;
  summary?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTarget?: CommunityPublishTarget | null;
  onPublished?: (contentId: number) => void;
}

const contentTypeOptions = [
  { label: '动态', value: 'post' },
  { label: '策略', value: 'strategy' },
  { label: '公式', value: 'formula' },
  { label: '训练结果', value: 'training' },
];

function numericObjectID(value?: string | number) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : undefined;
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function strategyOption(item: Strategy): CommunityObjectOption {
  return {
    key: `strategy:${item.id}`,
    objectId: item.id,
    visibility: item.visibility,
    currentVersionId: item.current_version_id,
    label: item.title || `策略 #${item.id}`,
    description: item.description || `作者 #${item.author_id}`,
    title: `分享策略：${item.title || `#${item.id}`}`,
    summary: item.description || `我分享了一个策略 #${item.id}，欢迎一起讨论。`,
  };
}

function formulaOption(item: SavedFormula): CommunityObjectOption {
  const objectId = numericObjectID(item.id);
  return {
    key: `formula:${item.id}`,
    objectId,
    visibility: item.visibility,
    label: item.name,
    description: item.description || item.expression.slice(0, 80),
    title: `分享公式：${item.name}`,
    summary: `${item.description ? `${item.description}\n\n` : ''}${item.expression}`,
  };
}

function trainingOption(item: TrainingResult): CommunityObjectOption {
  const name = item.security_name || item.symbol || item.session_id;
  return {
    key: `training:${item.session_id}`,
    objectId: numericObjectID(item.session_id),
    label: `${name} · ${(item.return_rate * 100).toFixed(2)}%`,
    description: `${item.start_trade_date} → ${item.end_trade_date}，收益 ${item.profit_amount?.toFixed?.(2) ?? item.profit_amount}`,
    title: `分享训练结果：${name}`,
    summary: [
      `训练标的：${name}`,
      `区间：${item.start_trade_date} → ${item.end_trade_date}`,
      `收益：${item.profit_amount?.toFixed?.(2) ?? item.profit_amount}（${(item.return_rate * 100).toFixed(2)}%）`,
      `最大回撤：${(item.max_drawdown * 100).toFixed(2)}%，交易次数：${item.trade_count}`,
      `训练 Session：${item.session_id}`,
    ].join('\n'),
  };
}

export default function CommunityPublishModal({ open, onOpenChange, initialTarget, onPublished }: Props) {
  const [form] = Form.useForm<PublishForm>();
  const qc = useQueryClient();
  const { message, modal } = App.useApp();
  const [search, setSearch] = useState('');
  const [selectedObject, setSelectedObject] = useState<CommunityObjectOption | undefined>();
  const localFormulas = useFormulaStore((state) => state.formulas);
  const contentType = Form.useWatch('content_type', form) ?? initialTarget?.contentType ?? 'post';

  const strategiesQuery = useQuery({
    queryKey: ['community-publish-strategies', search],
    queryFn: () => strategyApi.list({ keyword: search || undefined, limit: 20 }),
    enabled: open && contentType === 'strategy',
    staleTime: 30_000,
  });

  const formulasQuery = useQuery({
    queryKey: ['community-publish-formulas'],
    queryFn: () => formulaApi.listSaved({ limit: 200 }),
    enabled: open && contentType === 'formula',
    retry: false,
  });

  const trainingQuery = useQuery({
    queryKey: ['community-publish-training', search],
    queryFn: () => trainingApi.listRecords({ page: 1, page_size: 30, symbol: search || undefined }),
    enabled: open && contentType === 'training',
    staleTime: 30_000,
  });

  const objectOptions = useMemo(() => {
    if (contentType === 'strategy') return (strategiesQuery.data?.items ?? []).map(strategyOption);
    if (contentType === 'formula') {
      const remote = formulasQuery.data ?? [];
      const pool = remote.length > 0 ? remote : localFormulas;
      const keyword = search.trim().toLowerCase();
      return pool
        .filter((item) => !keyword || item.name.toLowerCase().includes(keyword) || item.description.toLowerCase().includes(keyword))
        .map(formulaOption);
    }
    if (contentType === 'training') return (trainingQuery.data?.items ?? []).map(trainingOption);
    return [];
  }, [contentType, formulasQuery.data, localFormulas, search, strategiesQuery.data?.items, trainingQuery.data?.items]);

  const mergedOptions = useMemo(() => {
    if (!selectedObject) return objectOptions;
    return objectOptions.some((item) => item.key === selectedObject.key)
      ? objectOptions
      : [selectedObject, ...objectOptions];
  }, [objectOptions, selectedObject]);

  useEffect(() => {
    if (!open) return;
    const initialObject = initialTarget?.objectKey || initialTarget?.objectId
      ? {
          key: initialTarget.objectKey ?? `${initialTarget.contentType}:${initialTarget.objectId}`,
          objectId: initialTarget.objectId,
          visibility: initialTarget.visibility,
          currentVersionId: initialTarget.currentVersionId,
          label: initialTarget.label ?? `#${initialTarget.objectId}`,
          title: initialTarget.title,
          summary: initialTarget.summary,
        }
      : undefined;
    setSelectedObject(initialObject);
    form.setFieldsValue({
      content_type: initialTarget?.contentType ?? 'post',
      object_key: initialObject?.key,
      title: initialTarget?.title ?? '',
      summary: initialTarget?.summary ?? '',
    });
  }, [form, initialTarget, open]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      await confirmPublicExposure(values.content_type);
      return communityApi.createContent({
        content_type: values.content_type,
        object_id: selectedObject?.objectId,
        title: values.title,
        summary: values.summary,
      });
    },
    onSuccess: (contentId) => {
      if (!contentId || contentId <= 0) {
        message.error('发布接口未返回有效内容 ID，请重启/更新 community 后端服务后重试');
        return;
      }
      message.success('已发布到社区');
      qc.invalidateQueries({ queryKey: ['community-feed'] });
      qc.invalidateQueries({ queryKey: ['saved-formulas'] });
      onOpenChange(false);
      onPublished?.(contentId);
    },
    onError: (e) => {
      if (e instanceof Error && e.message === 'cancelled') return;
      message.error(e instanceof ApiError ? e.message : '发布失败');
    },
  });

  async function confirmPublicExposure(contentTypeValue: CommunityPublishType) {
    if (contentTypeValue === 'strategy' && selectedObject?.objectId && selectedObject.visibility !== 2) {
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title: '发布后策略会公开',
          content: '这个策略当前不是公开状态。发布到社区前，系统会先把该策略当前版本发布并设为公开，其他用户可查看、讨论和 Fork。',
          okText: '确认公开并发布',
          cancelText: '取消',
          onOk: async () => {
            if (!selectedObject.currentVersionId) {
              message.error('该策略暂无可发布版本，请先保存一个版本');
              reject(new Error('strategy version is required'));
              return;
            }
            await strategyApi.publish(selectedObject.objectId!, selectedObject.currentVersionId);
            selectedObject.visibility = 2;
            resolve();
          },
          onCancel: () => reject(new Error('cancelled')),
        });
      });
      return;
    }
    if (contentTypeValue === 'formula' && selectedObject?.objectId && selectedObject.visibility !== 2) {
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title: '发布后公式会公开',
          content: '这个公式当前不是公开状态。发布到社区前，系统会先把该公式设为公开，其他用户可在公式广场查看、复用和讨论。',
          okText: '确认公开并发布',
          cancelText: '取消',
          onOk: async () => {
            await formulaApi.publishSaved(String(selectedObject.objectId));
            setSelectedObject((current) => current ? { ...current, visibility: 2 } : current);
            resolve();
          },
          onCancel: () => reject(new Error('cancelled')),
        });
      });
      return;
    }
    if (contentTypeValue === 'formula') {
      await new Promise<void>((resolve, reject) => {
        modal.confirm({
          title: '公式内容将公开',
          content: '发布到社区后，标题和摘要里的公式表达式会对社区用户可见。请确认不包含你不想公开的私有因子或交易细节。',
          okText: '确认发布',
          cancelText: '取消',
          onOk: () => resolve(),
          onCancel: () => reject(new Error('cancelled')),
        });
      });
    }
  }

  return (
    <Modal
      title="发布到社区"
      open={open}
      onCancel={() => onOpenChange(false)}
      onOk={() => publishMutation.mutate()}
      confirmLoading={publishMutation.isPending}
      destroyOnHidden
      width={620}
    >
      <Form form={form} layout="vertical" initialValues={{ content_type: 'post' }}>
        <Form.Item name="content_type" label="内容类型" rules={[{ required: true, message: '请选择内容类型' }]}>
          <Select
            options={contentTypeOptions}
            onChange={() => {
              setSearch('');
              setSelectedObject(undefined);
              form.setFieldsValue({ object_key: undefined });
            }}
          />
        </Form.Item>
        {contentType !== 'post' && (
          <Form.Item name="object_key" label="关联对象">
            <Select
              showSearch
              allowClear
              placeholder="搜索并选择要关联的对象"
              filterOption={false}
              onSearch={setSearch}
              loading={strategiesQuery.isFetching || formulasQuery.isFetching || trainingQuery.isFetching}
              options={mergedOptions.map((item) => ({
                value: item.key,
                label: (
                  <Space direction="vertical" size={0}>
                    <Space size={6}>
                      <Text>{item.label}</Text>
                      {item.objectId ? <Tag bordered={false}>#{item.objectId}</Tag> : <Tag bordered={false} color="orange">摘要关联</Tag>}
                    </Space>
                    {item.description && <Text type="secondary" style={{ fontSize: 12 }}>{item.description}</Text>}
                  </Space>
                ),
              }))}
              onChange={(key) => {
                const option = mergedOptions.find((item) => item.key === key);
                setSelectedObject(option);
                if (option) {
                  form.setFieldsValue({
                    title: option.title || form.getFieldValue('title'),
                    summary: option.summary || form.getFieldValue('summary'),
                  });
                }
              }}
            />
          </Form.Item>
        )}
        <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }, { max: 120 }]}>
          <Input showCount maxLength={120} placeholder="一句话说清楚你要分享什么" />
        </Form.Item>
        <Form.Item name="summary" label="摘要">
          <Input.TextArea rows={6} showCount maxLength={1500} placeholder="补充背景、结论、参数或你的思考" />
        </Form.Item>
        {selectedObject && !selectedObject.objectId && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            当前对象不是数字 ID，本次会把对象信息写入摘要；后端补充 object_ref 后可升级为真实深链。
          </Text>
        )}
      </Form>
    </Modal>
  );
}
