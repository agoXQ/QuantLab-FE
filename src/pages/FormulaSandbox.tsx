import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Card,
  Typography,
  Space,
  Button,
  Table,
  Tag,
  DatePicker,
  Select,
  Empty,
  Skeleton,
  Input,
  Row,
  Col,
  Alert,
  App,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  ThunderboltOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useNavigate } from 'react-router-dom';
import FormulaEditor from '@/components/FormulaEditor';
import { formulaApi, type EvaluateResult } from '@/api/formula';
import { marketApi, type Security } from '@/api/market';
import { useFormulaStore } from '@/store/formula';
import { RULE_TYPES } from '@/dsl/ruleTypes';
import { ApiError } from '@/api/client';

const { Title, Text, Paragraph } = Typography;

export default function FormulaSandbox() {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const formulaStore = useFormulaStore();

  const [expr, setExpr] = useState('');
  const [asOf, setAsOf] = useState<Dayjs | null>(dayjs());
  const [selectedUniverse, setSelectedUniverse] = useState<string[]>([]);
  const [universeSearch, setUniverseSearch] = useState('');
  const [presetFormula, setPresetFormula] = useState<string | undefined>();

  // Load securities for the universe picker. Paginated behind a search
  // input; the user can also type stock codes directly.
  const { data: securitiesData, isLoading: secLoading } = useQuery({
    queryKey: ['securities', universeSearch, 200],
    queryFn: () => marketApi.listSecurities({ limit: 200 }),
    staleTime: 300_000,
  });

  const allSecurities = securitiesData?.items ?? [];
  const filteredSecurities = useMemo(() => {
    if (!universeSearch) return allSecurities;
    const q = universeSearch.toLowerCase();
    return allSecurities.filter(
      (s) =>
        s.stock_code.toLowerCase().includes(q) ||
        s.stock_name.toLowerCase().includes(q),
    );
  }, [allSecurities, universeSearch]);

  const evaluateMutation = useMutation({
    mutationFn: () => {
      const formula = expr.trim();
      if (!formula) throw new Error('请输入公式表达式');
      if (selectedUniverse.length === 0) throw new Error('请选择股票池');
      return formulaApi.evaluate({
        formula,
        universe: selectedUniverse,
        as_of_date: asOf ? asOf.format('YYYY-MM-DD') : undefined,
      });
    },
    onError: (e) => {
      message.error(e instanceof ApiError ? e.message : e instanceof Error ? e.message : '执行失败');
    },
  });

  const result = evaluateMutation.data;
  const planTypeLabel: Record<string, { text: string; color: string }> = {
    FILTER: { text: '选股筛选', color: 'green' },
    SIGNAL: { text: '交易信号', color: 'blue' },
    SORT: { text: '排序', color: 'gold' },
    VALUE: { text: '计算值', color: 'purple' },
  };

  const pickPresetFormula = (formulaId: string) => {
    const f = formulaStore.formulas.find((x) => x.id === formulaId);
    if (f) {
      setExpr(f.expression);
      setPresetFormula(formulaId);
    }
  };

  const universeOptions = filteredSecurities.map((s: Security) => ({
    label: `${s.stock_code} ${s.stock_name}`,
    value: s.stock_code,
  }));

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/formulas')} style={{ color: '#8b949e' }} />
          <ExperimentOutlined style={{ fontSize: 20, color: '#16c784' }} />
          <Title level={4} style={{ margin: 0 }}>公式试算</Title>
        </Space>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          loading={evaluateMutation.isPending}
          onClick={() => evaluateMutation.mutate()}
          size="large"
        >
          执行试算
        </Button>
      </div>

      <Row gutter={24}>
        <Col span={14}>
          <Card title={<Space><ThunderboltOutlined /> 公式输入</Space>}>
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, marginRight: 8 }}>
                  从公式库加载：
                </Text>
                <Select
                  size="small"
                  placeholder="选择已保存的公式…"
                  style={{ width: 260 }}
                  value={presetFormula}
                  onChange={pickPresetFormula}
                  options={formulaStore.formulas.map((f) => ({
                    label: `${f.name}（${RULE_TYPES.find((r) => r.type === f.rule_type)?.label ?? f.rule_type}）`,
                    value: f.id,
                  }))}
                  allowClear
                />
              </div>
              <FormulaEditor
                value={expr}
                onChange={setExpr}
                placeholder="输入 DSL 公式表达式，例如：ROE > 15 AND PE < 20"
                height="120px"
              />
              <Paragraph type="secondary" style={{ fontSize: 11, margin: 0 }}>
                公式将针对下方选中的股票池在指定日期执行。选股规则返回筛选结果，排序规则返回排名，表达式返回计算值。
              </Paragraph>
            </Space>
          </Card>
        </Col>

        <Col span={10}>
          <Card title={<Space><ExperimentOutlined /> 执行参数</Space>}>
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>试算日期</Text>
                <DatePicker
                  value={asOf}
                  onChange={setAsOf}
                  style={{ width: '100%' }}
                  placeholder="选择日期"
                />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  股票池（已选 {selectedUniverse.length} 只）
                </Text>
                <Input
                  placeholder="搜索股票代码或名称…"
                  value={universeSearch}
                  onChange={(e) => setUniverseSearch(e.target.value)}
                  style={{ marginBottom: 8 }}
                  allowClear
                />
                <Select
                  mode="multiple"
                  placeholder="选择股票加入股票池"
                  value={selectedUniverse}
                  onChange={setSelectedUniverse}
                  options={universeOptions}
                  style={{ width: '100%' }}
                  maxTagCount={5}
                  loading={secLoading}
                  showSearch={false}
                  filterSort={(a, b) => String(a.value).localeCompare(String(b.value))}
                />
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {evaluateMutation.isError && (
        <Alert
          type="error"
          message="试算失败"
          description={evaluateMutation.error instanceof Error ? evaluateMutation.error.message : '未知错误'}
          showIcon
        />
      )}

      {result && (
        <Card
          title={
            <Space>
              <Text strong>试算结果</Text>
              <Tag bordered={false} color={planTypeLabel[result.plan_type]?.color ?? 'default'}>
                {planTypeLabel[result.plan_type]?.text ?? result.plan_type}
              </Tag>
            </Space>
          }
          extra={<Text style={{ fontSize: 11, color: '#8b949e' }}>hash: {result.formula_hash?.slice(0, 16)}…</Text>}
        >
          <ResultTable result={result} />
        </Card>
      )}
    </Space>
  );
}

function ResultTable({ result }: { result: EvaluateResult }) {
  // FILTER / SIGNAL → selection list; SORT → ranking with scores;
  // VALUE → computed values.
  if (result.selection && result.selection.length > 0) {
    const data = result.selection.map((code, i) => ({ key: code, rank: i + 1, stock_code: code }));
    return (
      <Table
        dataSource={data}
        columns={[
          { title: '#', dataIndex: 'rank', width: 60, render: (r: number) => <Text style={{ fontFamily: 'monospace', color: r <= 3 ? '#f0b90b' : '#8b949e' }}>{r}</Text> },
          { title: '股票代码', dataIndex: 'stock_code', render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c}</Text> },
        ]}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="无选股结果" /> }}
      />
    );
  }

  if (result.ranking && result.ranking.length > 0) {
    return (
      <Table
        dataSource={result.ranking.map((r, i) => ({ ...r, key: r.stock_code, rank: i + 1 }))}
        columns={[
          { title: '排名', dataIndex: 'rank', width: 60, render: (r: number) => <Text style={{ fontFamily: 'monospace', color: r <= 3 ? '#f0b90b' : '#8b949e' }}>{r}</Text> },
          { title: '股票代码', dataIndex: 'stock_code', render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c}</Text> },
          { title: '评分', dataIndex: 'score', align: 'right' as const, render: (s: number) => <Text style={{ fontFamily: 'monospace', color: '#16c784' }}>{s.toFixed(4)}</Text> },
        ]}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="无排序结果" /> }}
      />
    );
  }

  if (result.values && result.values.length > 0) {
    return (
      <Table
        dataSource={result.values.map((v) => ({ ...v, key: v.stock_code }))}
        columns={[
          { title: '股票代码', dataIndex: 'stock_code', render: (c: string) => <Text style={{ fontFamily: 'monospace' }}>{c}</Text> },
          { title: '计算值', dataIndex: 'value', align: 'right' as const, render: (v: number) => <Text style={{ fontFamily: 'monospace' }}>{v.toFixed(4)}</Text> },
        ]}
        pagination={false}
        size="small"
        locale={{ emptyText: <Empty description="无计算结果" /> }}
      />
    );
  }

  return <Empty description="公式执行完成，但无结果返回" style={{ padding: 32 }} />;
}
