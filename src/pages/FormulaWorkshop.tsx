import { useState } from 'react';
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
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useFormulaStore, type SavedFormula } from '@/store/formula';
import { useNavigate } from 'react-router-dom';
import { RULE_TYPES, RULE_TYPE_MAP, type RuleType } from '@/dsl/ruleTypes';
import FormulaEditor from '@/components/FormulaEditor';

const { Title, Text } = Typography;

interface EditForm {
  name: string;
  rule_type: RuleType;
  description: string;
}

export default function FormulaWorkshop() {
  const { formulas, add, update, remove } = useFormulaStore();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [filter, setFilter] = useState<string>('all');
  const [editing, setEditing] = useState<SavedFormula | null>(null);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<EditForm>();
  const [expr, setExpr] = useState('');

  const filtered = filter === 'all' ? formulas : formulas.filter((f) => f.rule_type === filter);

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

  const handleSave = async () => {
    const v = await form.validateFields();
    if (!expr.trim()) {
      message.error('请输入公式表达式');
      return;
    }
    if (editing) {
      update(editing.id, {
        name: v.name,
        rule_type: v.rule_type,
        expression: expr,
        description: v.description,
      });
      message.success('公式已更新');
    } else {
      add({
        name: v.name,
        rule_type: v.rule_type,
        expression: expr,
        description: v.description,
      });
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
      width: 80,
      render: (_: unknown, r: SavedFormula) => (
        <Space size={4}>
          <Button type="text" icon={<EditOutlined />} size="small" onClick={() => openEdit(r)} />
          <Popconfirm title="删除该公式？" onConfirm={() => { remove(r.id); message.success('已删除'); }}>
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
          <Title level={4} style={{ margin: 0 }}>公式工作台</Title>
        </Space>
        <Space>
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

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          pagination={{ pageSize: 20, showSizeChanger: false }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无公式，点击右上角创建" /> }}
        />
      </Card>

      <Modal
        title={editing ? '编辑公式' : '新建公式'}
        open={creating || !!editing}
        onCancel={() => { setCreating(false); setEditing(null); }}
        onOk={handleSave}
        okText="保存"
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark>
          <Form.Item name="name" label="公式名称" rules={[{ required: true, message: '请输入名称' }, { max: 40 }]}>
            <Input placeholder="例如：高ROE低估值" />
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
          <Form.Item name="description" label="描述">
            <Input placeholder="一句话说明公式用途" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
