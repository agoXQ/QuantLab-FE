import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Form,
  Input,
  Button,
  Typography,
  Space,
  Select,
  Row,
  Col,
  Tag,
  Divider,
  Skeleton,
  App,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  CodeOutlined,
  ThunderboltOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { strategyApi } from '@/api/strategy';
import { formulaApi, type FunctionDefinition } from '@/api/formula';
import { useFormulaStore, type SavedFormula } from '@/store/formula';
import { RULE_TYPES, RULE_TYPE_MAP } from '@/dsl/ruleTypes';
import { ApiError } from '@/api/client';
import FormulaEditor from '@/components/FormulaEditor';
import { BUILTIN_VARIABLES } from '@/dsl/language';

const { Title, Text, Paragraph } = Typography;

interface FormValues {
  title: string;
  description: string;
  category: string;
  tags: string[];
  formula_text: string;
  buy_rule: string;
  sell_rule: string;
  risk_rule: string;
  position_rule: string;
  rebalance_rule: string;
  ranking_rule: string;
  change_log: string;
}

export default function StrategyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { message } = App.useApp();
  const isEdit = !!id && id !== 'new';
  const sid = isEdit ? Number(id) : 0;
  const [form] = Form.useForm<FormValues>();
  const [rules, setRules] = useState<Record<string, string>>({});
  const formulaStore = useFormulaStore();

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', sid],
    queryFn: () => strategyApi.get(sid),
    enabled: isEdit,
  });

  const { data: versions } = useQuery({
    queryKey: ['strategy-versions', sid],
    queryFn: () => strategyApi.listVersions(sid),
    enabled: isEdit,
  });

  const { data: functions = [] } = useQuery<FunctionDefinition[]>({
    queryKey: ['formula-functions'],
    queryFn: () => formulaApi.listFunctions(),
    staleTime: 600_000,
  });

  const latest = useMemo(() => versions?.[0], [versions]);

  useEffect(() => {
    if (!isEdit) {
      const init: Record<string, string> = {
        formula_text: '',
        buy_rule: '',
        sell_rule: '',
        position_rule: '',
        rebalance_rule: '',
        risk_rule: '',
        ranking_rule: '',
      };
      setRules(init);
      form.setFieldsValue({ category: '选股' });
      return;
    }
    if (strategy) {
      form.setFieldsValue({
        title: strategy.title,
        description: strategy.description,
        category: strategy.category,
        tags: strategy.tags,
      });
    }
    if (latest) {
      const init: Record<string, string> = {
        formula_text: latest.formula_text ?? '',
        buy_rule: latest.buy_rule ?? '',
        sell_rule: latest.sell_rule ?? '',
        position_rule: latest.position_rule ?? '',
        rebalance_rule: latest.rebalance_rule ?? '',
        risk_rule: latest.risk_rule ?? '',
        ranking_rule: latest.ranking_rule ?? '',
      };
      setRules(init);
      form.setFieldsValue({ ...init, change_log: '' });
    }
  }, [isEdit, strategy, latest, form]);

  const saveMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      const ruleData = {
        formula_text: rules.formula_text ?? '',
        buy_rule: rules.buy_rule ?? '',
        sell_rule: rules.sell_rule ?? '',
        risk_rule: rules.risk_rule ?? '',
        position_rule: rules.position_rule ?? '',
        rebalance_rule: rules.rebalance_rule ?? '',
        ranking_rule: rules.ranking_rule ?? '',
      };
      if (!isEdit) {
        const newId = await strategyApi.create({
          title: v.title,
          description: v.description,
          category: v.category,
          tags: v.tags,
        });
        await strategyApi.createVersion(newId, { ...ruleData, change_log: v.change_log || '初始版本' });
        return newId;
      }
      await strategyApi.update(sid, {
        title: v.title,
        description: v.description,
        category: v.category,
        tags: v.tags,
      });
      await strategyApi.createVersion(sid, { ...ruleData, change_log: v.change_log || '更新版本' });
      return sid;
    },
    onSuccess: (newId) => {
      qc.invalidateQueries({ queryKey: ['strategies'] });
      qc.invalidateQueries({ queryKey: ['strategy', newId] });
      qc.invalidateQueries({ queryKey: ['strategy-versions', newId] });
      message.success(isEdit ? '版本已保存' : '策略已创建');
      navigate(`/strategies/${newId}`);
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : '保存失败');
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (v: FormValues) => saveMutation.mutateAsync(v).catch(() => null),
    onSuccess: async (targetId) => {
      if (!targetId) return;
      try {
        const vers = await strategyApi.listVersions(targetId);
        const latestId = vers[0]?.id;
        if (latestId) await strategyApi.publish(targetId, latestId);
        message.success('策略已发布');
        navigate(`/strategies/${targetId}`);
      } catch (e) {
        message.error(e instanceof ApiError ? e.message : '发布失败');
      }
    },
  });

  if (isEdit && isLoading) return <Skeleton active paragraph={{ rows: 10 }} />;

  const submitting = saveMutation.isPending || publishMutation.isPending;

  const updateRule = (field: string, val: string) => {
    setRules((prev) => ({ ...prev, [field]: val }));
    form.setFieldValue(field as keyof FormValues, val);
  };

  // When a saved formula is picked from the dropdown, write its expression
  // into the rule slot. The user can still edit inline afterwards.
  const pickFormula = (field: string, formulaId: string) => {
    const f = formulaStore.formulas.find((x) => x.id === formulaId);
    if (f) updateRule(field, f.expression);
  };

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: '#8b949e' }} />
          <Title level={4} style={{ margin: 0 }}>{isEdit ? '编辑策略' : '新建策略'}</Title>
        </Space>
        <Space>
          <Button icon={<SaveOutlined />} loading={saveMutation.isPending} onClick={() => form.validateFields().then((v) => saveMutation.mutate(v))}>
            保存草稿
          </Button>
          <Button type="primary" icon={<SendOutlined />} loading={publishMutation.isPending} disabled={submitting} onClick={() => form.validateFields().then((v) => publishMutation.mutate(v))}>
            保存并发布
          </Button>
        </Space>
      </div>

      <Row gutter={24}>
        <Col span={17}>
          <Card title={<Space><CodeOutlined /> 策略信息</Space>}>
            <Form form={form} layout="vertical" requiredMark>
              <Form.Item name="title" label="策略名称" rules={[{ required: true, message: '请输入策略名称' }, { max: 60 }]}>
                <Input placeholder="例如：ROE 价值选股" />
              </Form.Item>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="category" label="分类">
                    <Input placeholder="选股 / 趋势 / 套利" />
                  </Form.Item>
                </Col>
                <Col span={16}>
                  <Form.Item name="tags" label="标签">
                    <Select mode="tags" placeholder="回车添加标签" tokenSeparators={[',']} />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="description" label="策略描述">
                <Input.TextArea rows={2} placeholder="简述策略逻辑与适用场景" />
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={<Space><AppstoreOutlined /> 策略组合</Space>}
            style={{ marginTop: 16 }}
            extra={<Text type="secondary" style={{ fontSize: 12 }}>从公式库选择或直接编辑</Text>}
          >
            {RULE_TYPES.map((rt) => (
              <RuleSlot
                key={rt.type}
                def={rt}
                value={rules[rt.field] ?? ''}
                formulas={formulaStore.getByType(rt.type)}
                onChange={(val) => updateRule(rt.field, val)}
                onPick={(fid) => pickFormula(rt.field, fid)}
              />
            ))}
            <Divider style={{ margin: '12px 0' }} />
            <Form form={form} layout="vertical">
              <Form.Item name="change_log" label="变更说明">
                <Input placeholder="本次修改的要点" />
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col span={7}>
          <DslReferencePanel functions={functions} />
        </Col>
      </Row>
    </Space>
  );
}

function RuleSlot({
  def,
  value,
  formulas,
  onChange,
  onPick,
}: {
  def: (typeof RULE_TYPES)[number];
  value: string;
  formulas: SavedFormula[];
  onChange: (val: string) => void;
  onPick: (formulaId: string) => void;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Space size={6}>
          <Text strong>{def.label}</Text>
          <Tag bordered={false} style={{ fontSize: 10 }}>{def.returnType}</Tag>
          {!def.required && <Tag bordered={false} style={{ fontSize: 10 }}>可选</Tag>}
        </Space>
        {formulas.length > 0 && (
          <Select
            size="small"
            placeholder="从公式库选择…"
            style={{ width: 180 }}
            value={undefined}
            suffixIcon={<AppstoreOutlined />}
            options={formulas.map((f) => ({
              label: f.name,
              value: f.id,
            }))}
            onChange={onPick}
          />
        )}
      </div>
      <FormulaEditor
        value={value}
        onChange={onChange}
        placeholder={def.example}
        height="72px"
        validate={!!value}
      />
    </div>
  );
}

function DslReferencePanel({ functions }: { functions: FunctionDefinition[] }) {
  const fnByCategory = useMemo(() => {
    const groups: Record<string, FunctionDefinition[]> = {};
    for (const fn of functions) (groups[fn.category] ??= []).push(fn);
    return groups;
  }, [functions]);

  const varByCategory = useMemo(() => {
    const groups: Record<string, typeof BUILTIN_VARIABLES> = {};
    for (const v of BUILTIN_VARIABLES) (groups[v.category] ??= []).push(v);
    return groups;
  }, []);

  const categoryLabel: Record<string, string> = {
    Technical: '技术指标函数',
    Math: '数学函数',
    TimeSeries: '时序函数',
    Signal: '信号函数',
    行情: '行情变量',
    财务: '财务变量',
    成长: '成长变量',
    市值: '市值变量',
    别名: '变量别名',
  };

  return (
    <Card title={<Space><ThunderboltOutlined /> DSL 参考</Space>} styles={{ body: { padding: 16 } }}>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        函数名大小写不敏感，规则间用 AND / OR / NOT 连接。输入时自动补全，Ctrl+Space 手动触发，Tab / Enter 确认。
      </Paragraph>

      {Object.entries(fnByCategory).map(([cat, fns]) => (
        <ReferenceGroup key={`fn-${cat}`} title={categoryLabel[cat] ?? cat}>
          {fns.map((fn) => (
            <ReferenceItem
              key={fn.name}
              code={fn.params.length ? `${fn.name}(${fn.params.map((p) => p.name).join(', ')})` : `${fn.name}()`}
              note={fn.description}
              ret={fn.return_type}
            />
          ))}
        </ReferenceGroup>
      ))}

      {Object.entries(varByCategory).map(([cat, vars]) => (
        <ReferenceGroup key={`var-${cat}`} title={categoryLabel[cat] ?? cat}>
          {vars.map((v) => (
            <ReferenceItem key={v.name} code={v.name} note={v.description} ret={v.type} />
          ))}
        </ReferenceGroup>
      ))}

      <Divider style={{ margin: '10px 0' }} />
      <Space size={4} wrap>
        <Tag bordered={false} color="green">AND OR NOT</Tag>
        <Tag bordered={false} color="blue">TRUE FALSE</Tag>
        <Tag bordered={false} color="orange">+ - * / %</Tag>
        <Tag bordered={false} color="orange">&gt; &lt; &gt;= &lt;= == !=</Tag>
      </Space>
    </Card>
  );
}

function ReferenceGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Text strong style={{ fontSize: 12, color: '#16c784' }}>{title}</Text>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function ReferenceItem({ code, note, ret }: { code: string; note: string; ret?: string }) {
  return (
    <div
      style={{
        padding: '4px 0',
        borderBottom: '1px solid #21262d',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        gap: 8,
      }}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: '#e6edf3', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {code}
        </code>
        <Text style={{ fontSize: 10, color: '#8b949e' }}>{note}</Text>
      </div>
      {ret && <Tag bordered={false} style={{ fontSize: 10, flexShrink: 0, margin: 0 }}>{ret}</Tag>}
    </div>
  );
}
