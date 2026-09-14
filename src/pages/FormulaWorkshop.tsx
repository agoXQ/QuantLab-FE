import { isAvailableFormula } from '@/dsl/availability';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Typography,
  Space,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Empty,
  Popconfirm,
  App,
  Segmented,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  FunctionOutlined,
  FilterOutlined,
  ShareAltOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useFormulaStore, type SavedFormula } from '@/store/formula';
import { useNavigate } from 'react-router-dom';
import { RULE_TYPES, RULE_TYPE_MAP, type RuleType } from '@/dsl/ruleTypes';
import FormulaEditor from '@/components/FormulaEditor';
import { formulaApi, type FormulaExample } from '@/api/formula';
import { ApiError } from '@/api/client';
import DslReferencePanel from '@/components/DslReferencePanel';
import FormulaExplainPanel from '@/components/FormulaExplainPanel';
import CommunityPublishModal, { type CommunityPublishTarget } from '@/components/CommunityPublishModal';

const { Title, Text } = Typography;

interface EditForm {
  name: string;
  rule_type: RuleType;
  description: string;
}

export default function FormulaWorkshop() {
  const { formulas: localFormulas, add, update, remove } = useFormulaStore();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [scope, setScope] = useState<'square' | 'mine'>('mine');
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<SavedFormula | null>(null);
  const [creating, setCreating] = useState(false);
  const [publishTarget, setPublishTarget] = useState<CommunityPublishTarget | null>(null);
  const [form] = Form.useForm<EditForm>();
  const [expr, setExpr] = useState('');

  const { data: functions = [] } = useQuery({
    queryKey: ['formula-functions'],
    queryFn: () => formulaApi.listFunctions(),
    staleTime: 600_000,
  });

  const { data: remoteFormulas = [], isFetching } = useQuery({
    queryKey: ['saved-formulas', 'mine'],
    queryFn: () => formulaApi.listSaved({ limit: 200, scope: 'mine' }),
    retry: false,
  });

  const { data: publicFormulas = [], isFetching: isFetchingPublic } = useQuery({
    queryKey: ['saved-formulas', 'public'],
    queryFn: () => formulaApi.listSaved({ limit: 200, scope: 'public' }),
    retry: false,
  });

  const { data: examples = [] } = useQuery({
    queryKey: ['formula-examples'],
    queryFn: () => formulaApi.listExamples(),
    staleTime: 600_000,
  });

  const formulas = (remoteFormulas.length > 0 ? remoteFormulas : localFormulas).filter((f) => isAvailableFormula(f.expression));
  const filtered = filter === 'all' ? formulas : formulas.filter((f) => f.rule_type === filter);
  const publicFiltered = filter === 'all' ? publicFormulas : publicFormulas.filter((f) => f.rule_type === filter);
  const exampleFiltered = filter === 'all' ? examples : examples.filter((f) => f.rule_type === filter);

  const saveFormula = useMutation({
    mutationFn: (payload: { id?: string; name: string; rule_type: RuleType; expression: string; description?: string }) =>
      payload.id && !payload.id.startsWith('seed-') && !payload.id.startsWith('f-')
        ? formulaApi.updateSaved(payload.id, payload)
        : formulaApi.createSaved(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-formulas'] });
    },
  });

  const deleteFormula = useMutation({
    mutationFn: (id: string) => formulaApi.deleteSaved(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-formulas'] });
    },
  });

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setExpr('');
    form.resetFields();
    form.setFieldsValue({ rule_type: 'stock_select' });
  };

  const openEdit = (f: SavedFormula) => {
    setEditing(f);
    setCreating(false);
    setExpr(f.expression);
    form.setFieldsValue({
      name: f.name,
      rule_type: f.rule_type,
      description: f.description,
    });
  };

  const applyExample = (example: FormulaExample) => {
    setEditing(null);
    setCreating(true);
    setExpr(example.expression);
    form.resetFields();
    form.setFieldsValue({
      name: example.title,
      rule_type: example.rule_type,
      description: example.description,
    });
    message.success('已套用示例公式');
  };

  const handleSave = async () => {
    const v = await form.validateFields();
    if (!expr.trim()) {
      message.error('请输入公式表达式');
      return;
    }
    const validation = await formulaApi.validate(expr);
    if (!validation.valid) {
      message.error(validation.error || '该公式包含已下架或暂不支持的能力');
      return;
    }
    if (editing) {
      if (editing.id.startsWith('seed-') || editing.id.startsWith('f-')) {
        update(editing.id, {
          name: v.name,
          rule_type: v.rule_type,
          expression: expr,
          description: v.description,
        });
      } else {
        await saveFormula.mutateAsync({
          id: editing.id,
          name: v.name,
          rule_type: v.rule_type,
          expression: expr,
          description: v.description,
        });
      }
      message.success('公式已更新');
    } else {
      try {
        await saveFormula.mutateAsync({
          name: v.name,
          rule_type: v.rule_type,
          expression: expr,
          description: v.description,
        });
      } catch (e) {
        if (e instanceof ApiError && e.status >= 400 && e.status < 500) {
          message.error(e.message);
          return;
        }
        add({
          name: v.name,
          rule_type: v.rule_type,
          expression: expr,
          description: v.description,
        });
        message.warning(e instanceof ApiError ? `后端保存失败，已暂存本地：${e.message}` : '后端保存失败，已暂存本地');
        setEditing(null);
        setCreating(false);
        return;
      }
      message.success('公式已保存');
    }
    setEditing(null);
    setCreating(false);
  };

  const currentType = Form.useWatch('rule_type', form) as RuleType | undefined;
  const typeDef = currentType ? RULE_TYPE_MAP[currentType] : undefined;

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      render: (name: string, r: SavedFormula) => (
        <Space direction="vertical" size={0}>
          <Text strong>{name}</Text>
          {r.description && <Text style={{ fontSize: 11, color: '#8b949e' }}>{r.description}</Text>}
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'rule_type',
      width: 120,
      render: (t: RuleType) => {
        const def = RULE_TYPE_MAP[t];
        return def ? (
          <Tag bordered={false} color="green">{def.label}</Tag>
        ) : (
          <Tag>{t}</Tag>
        );
      },
    },
    {
      title: '返回类型',
      dataIndex: 'rule_type',
      width: 90,
      render: (t: RuleType) => {
        const def = RULE_TYPE_MAP[t];
        return <Text style={{ fontFamily: 'monospace', fontSize: 11, color: '#8b949e' }}>{def?.returnType ?? '—'}</Text>;
      },
    },
    {
      title: '可见性',
      dataIndex: 'visibility',
      width: 90,
      render: (v: number) => (
        <Tag bordered={false} color={v === 2 ? 'green' : 'default'}>{v === 2 ? '公开' : '私有'}</Tag>
      ),
    },
    {
      title: '表达式',
      dataIndex: 'expression',
      ellipsis: true,
      render: (e: string) => (
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#16c784' }}>
          {e.replace(/\n/g, ' ').slice(0, 60)}
          {e.length > 60 ? '…' : ''}
        </code>
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      width: 120,
      render: (t: number) => <Text style={{ fontSize: 11, color: '#8b949e' }}>{dayjs(t).format('MM-DD HH:mm')}</Text>,
    },
    {
      title: '',
      width: 112,
      render: (_: unknown, r: SavedFormula) => (
        <Space size={4}>
          <Button
            type="text"
            icon={<ShareAltOutlined />}
            size="small"
            onClick={() => setPublishTarget({
              contentType: 'formula',
              objectId: Number.isInteger(Number(r.id)) ? Number(r.id) : undefined,
              objectKey: `formula:${r.id}`,
              visibility: r.visibility,
              label: r.name,
              title: `分享公式：${r.name}`,
              summary: `${r.description ? `${r.description}\n\n` : ''}${r.expression}`,
            })}
          />
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          <Popconfirm title="删除该公式？" onConfirm={async () => {
            if (r.id.startsWith('seed-') || r.id.startsWith('f-')) {
              remove(r.id);
            } else {
              await deleteFormula.mutateAsync(r.id);
            }
            message.success('已删除');
          }}>
            <Button type="text" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <FunctionOutlined style={{ fontSize: 20, color: '#16c784' }} />
          <Space direction="vertical" size={2}>
            <Title level={4} style={{ margin: 0 }}>{scope === 'square' ? '公式广场' : '我的公式'}</Title>
            <Text type="secondary">{scope === 'square' ? '浏览平台示例公式，快速试用或发布讨论。' : '维护自己的选股、买卖、仓位和风控公式。'}</Text>
          </Space>
        </Space>
        <Space>
          <Segmented
            value={scope}
            onChange={(v) => setScope(v as 'square' | 'mine')}
            options={[
              { label: '公式广场', value: 'square' },
              { label: '我的公式', value: 'mine' },
            ]}
          />
          <Button icon={<FilterOutlined />} onClick={() => navigate('/formulas/screener')}>
            公式选股
          </Button>
          <Button icon={<ExperimentOutlined />} onClick={() => navigate('/formulas/sandbox')}>
            公式试算
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建公式
          </Button>
        </Space>
      </div>

      <Segmented
        value={filter}
        onChange={(v) => setFilter(v as string)}
        options={[
          { label: '全部', value: 'all' },
          ...RULE_TYPES.map((r) => ({ label: r.label, value: r.type })),
        ]}
      />

      {scope === 'square' ? (
        <Card>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {isFetchingPublic ? <Text type="secondary">正在加载公开公式...</Text> : null}
            {publicFiltered.map((formula) => (
              <Card key={`public-${formula.id}`} size="small" style={{ background: '#0d1117', borderColor: '#16352d' }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
                    <Space wrap>
                      <Text strong>{formula.name}</Text>
                      <Tag bordered={false} color="green">公开公式</Tag>
                      <Tag bordered={false} color="cyan">{RULE_TYPE_MAP[formula.rule_type]?.label ?? formula.rule_type}</Tag>
                      {formula.owner_id ? <Text type="secondary">用户 #{formula.owner_id}</Text> : null}
                    </Space>
                    <Space>
                      <Button size="small" onClick={() => {
                        setEditing(null);
                        setCreating(true);
                        setExpr(formula.expression);
                        form.resetFields();
                        form.setFieldsValue({
                          name: `${formula.name} 副本`,
                          rule_type: formula.rule_type,
                          description: formula.description,
                        });
                        message.success('已复制到编辑区');
                      }}>
                        复用
                      </Button>
                      <Button
                        size="small"
                        icon={<ShareAltOutlined />}
                        onClick={() => setPublishTarget({
                          contentType: 'formula',
                          objectId: Number(formula.id),
                          objectKey: `formula:${formula.id}`,
                          visibility: formula.visibility,
                          label: formula.name,
                          title: `讨论公式：${formula.name}`,
                          summary: `${formula.description ? `${formula.description}\n\n` : ''}${formula.expression}`,
                        })}
                      >
                        发布讨论
                      </Button>
                    </Space>
                  </Space>
                  {formula.description && <Text type="secondary">{formula.description}</Text>}
                  <pre style={{ margin: 0, color: '#16c784', whiteSpace: 'pre-wrap', fontSize: 12 }}>{formula.expression}</pre>
                </Space>
              </Card>
            ))}
            {publicFiltered.length === 0 && !isFetchingPublic ? <Empty description="暂无公开公式，先从我的公式发布一条吧" /> : null}

            <Text type="secondary">平台示例模板</Text>
            {exampleFiltered.length === 0 ? <Empty description="暂无公式示例" /> : exampleFiltered.map((example) => (
              <Card key={example.id} size="small" style={{ background: '#0d1117' }}>
                <Space direction="vertical" size={8} style={{ width: '100%' }}>
                  <Space style={{ justifyContent: 'space-between', width: '100%' }} align="start">
                    <Space>
                      <Text strong>{example.title}</Text>
                      <Tag bordered={false} color="cyan">{RULE_TYPE_MAP[example.rule_type]?.label ?? example.rule_type}</Tag>
                      <Tag bordered={false}>{example.category}</Tag>
                    </Space>
                    <Space>
                      <Button size="small" onClick={() => applyExample(example)}>套用</Button>
                      <Button
                        size="small"
                        icon={<ShareAltOutlined />}
                        onClick={() => setPublishTarget({
                          contentType: 'formula',
                          objectKey: `formula-example:${example.id}`,
                          label: example.title,
                          title: `讨论公式：${example.title}`,
                          summary: `${example.description}\n\n${example.expression}`,
                        })}
                      >
                        发布讨论
                      </Button>
                    </Space>
                  </Space>
                  <Text type="secondary">{example.description}</Text>
                  <pre style={{ margin: 0, color: '#16c784', whiteSpace: 'pre-wrap', fontSize: 12 }}>{example.expression}</pre>
                </Space>
              </Card>
            ))}
          </Space>
        </Card>
      ) : (
        <Card styles={{ body: { padding: 0 } }}>
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            loading={isFetching}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            size="middle"
            locale={{ emptyText: <Empty description="暂无公式，点击右上角创建" /> }}
          />
        </Card>
      )}

      <DslReferencePanel functions={functions} onApplyExample={applyExample} />

      <Modal
        title={editing ? '编辑公式' : '新建公式'}
        open={creating || !!editing}
        onCancel={() => { setCreating(false); setEditing(null); }}
        onOk={handleSave}
        confirmLoading={saveFormula.isPending}
        okText="保存"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="name" label="公式名称" rules={[{ required: true, message: '请输入名称' }, { max: 40 }]}>
            <Input placeholder="例如：价量趋势选股" />
          </Form.Item>
          <Form.Item name="rule_type" label="公式类型" rules={[{ required: true }]}>
            <Select
              options={RULE_TYPES.map((r) => ({
                label: `${r.label}（${r.returnType}）`,
                value: r.type,
              }))}
            />
          </Form.Item>
          {typeDef && (
            <div style={{ marginBottom: 12, padding: '8px 12px', background: '#0d1117', borderRadius: 6, border: '1px solid #21262d' }}>
              <Space size={8}>
                <ExperimentOutlined style={{ color: '#16c784' }} />
                <Text style={{ fontSize: 12, color: '#8b949e' }}>{typeDef.hint}</Text>
              </Space>
              <pre style={{ margin: '4px 0 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#16c784' }}>
                {typeDef.example}
              </pre>
            </div>
          )}
          <Form.Item label="公式表达式" required>
            <FormulaEditor
              value={expr}
              onChange={setExpr}
              placeholder="输入 DSL 表达式..."
              height="100px"
            />
          </Form.Item>
          <FormulaExplainPanel formula={expr} />
          <Form.Item name="description" label="描述">
            <Input placeholder="一句话说明公式用途" />
          </Form.Item>
        </Form>
      </Modal>
      <CommunityPublishModal
        open={!!publishTarget}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setPublishTarget(null);
        }}
        initialTarget={publishTarget}
        onPublished={(contentId) => navigate(`/community/${contentId}`)}
      />
    </Space>
  );
}
