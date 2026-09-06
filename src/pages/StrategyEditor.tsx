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
  AppstoreOutlined,
} from '@ant-design/icons';
import { strategyApi } from '@/api/strategy';
import { formulaApi, type FormulaExample, type FunctionDefinition } from '@/api/formula';
import { useFormulaStore, type SavedFormula } from '@/store/formula';
import { RULE_TYPES, RULE_TYPE_MAP } from '@/dsl/ruleTypes';
import { ApiError } from '@/api/client';
import FormulaEditor from '@/components/FormulaEditor';
import DslReferencePanel from '@/components/DslReferencePanel';
import FormulaExplainPanel from '@/components/FormulaExplainPanel';

const { Title, Text } = Typography;

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

  const { data: remoteFormulas = [] } = useQuery({
    queryKey: ['saved-formulas'],
    queryFn: () => formulaApi.listSaved({ limit: 200 }),
    retry: false,
  });

  const savedFormulas: SavedFormula[] = remoteFormulas.length > 0 ? remoteFormulas : formulaStore.formulas;

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
    const f = savedFormulas.find((x) => x.id === formulaId);
    if (f) updateRule(field, f.expression);
  };

  const applyExample = (example: FormulaExample) => {
    const rule = RULE_TYPES.find((item) => item.type === example.rule_type);
    if (!rule) {
      message.warning('该示例暂不匹配当前策略槽位');
      return;
    }
    updateRule(rule.field, example.expression);
    message.success(`已套用到${rule.label}`);
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
                formulas={savedFormulas.filter((f) => f.rule_type === rt.type)}
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
          <DslReferencePanel functions={functions} onApplyExample={applyExample} />
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
      <FormulaExplainPanel formula={value} buttonText="解释规则" compact />
    </div>
  );
}
