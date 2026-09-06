import { useMemo, type ReactNode } from 'react';
import { Button, Card, Divider, Space, Tag, Typography } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { formulaApi, type FormulaExample, type FunctionDefinition } from '@/api/formula';
import { CATEGORY_LABEL, compareCategoryNames, sortCategorizedItems } from '@/dsl/categories';
import { BUILTIN_VARIABLES } from '@/dsl/language';
import { useQuery } from '@tanstack/react-query';

const { Text, Paragraph } = Typography;

export const fallbackExamples: FormulaExample[] = [
  {
    id: 'tf-any-5m-trend',
    title: '日线内 5m 趋势确认',
    category: 'Timeframe',
    rule_type: 'stock_select',
    return_type: 'Boolean',
    expression: 'ANY_TF("5m", CLOSE > MA(CLOSE, 20))',
    description: '日线策略里，只要当日任意 5m 子K满足条件即触发。',
    tags: ['多周期', '5m', '趋势'],
  },
  {
    id: 'tf-every-30m-bullish',
    title: '当日 30m 全部收阳',
    category: 'Timeframe',
    rule_type: 'buy_rule',
    return_type: 'Boolean',
    expression: 'EVERY_TF("30m", CLOSE >= OPEN)',
    description: '当日所有 30m 子K均收阳。',
    tags: ['多周期', '30m', '买入'],
  },
  {
    id: 'tf-last-60m-rsi',
    title: '最新 60m RSI 强势过滤',
    category: 'Timeframe',
    rule_type: 'stock_select',
    return_type: 'Boolean',
    expression: 'LAST_TF("60m", RSI(CLOSE, 14)) > 60',
    description: '取最新 60m RSI 做精细过滤。',
    tags: ['多周期', '60m', 'RSI'],
  },
];

interface Props {
  functions: FunctionDefinition[];
  onApplyExample?: (example: FormulaExample) => void;
}

export default function DslReferencePanel({ functions, onApplyExample }: Props) {
  const { data: remoteExamples = [] } = useQuery<FormulaExample[]>({
    queryKey: ['formula-examples'],
    queryFn: () => formulaApi.listExamples(),
    staleTime: 600_000,
    retry: false,
  });

  const fnByCategory = useMemo(() => {
    const groups: Record<string, FunctionDefinition[]> = {};
    for (const fn of functions) (groups[fn.category] ??= []).push(fn);
    for (const [category, list] of Object.entries(groups)) groups[category] = sortCategorizedItems(list);
    return groups;
  }, [functions]);

  const varByCategory = useMemo(() => {
    const groups: Record<string, typeof BUILTIN_VARIABLES> = {};
    for (const v of BUILTIN_VARIABLES) (groups[v.category] ??= []).push(v);
    return groups;
  }, []);

  const examples = remoteExamples.length > 0 ? remoteExamples : fallbackExamples;

  const orderedFnGroups = Object.entries(fnByCategory).sort(([a], [b]) => compareCategoryNames(a, b));

  return (
    <Card title={<Space><ThunderboltOutlined /> DSL 参考</Space>} styles={{ body: { padding: 16 } }}>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        函数名大小写不敏感，规则间用 AND / OR / NOT 连接。输入时自动补全，Ctrl+Space 手动触发，Tab / Enter 确认。
      </Paragraph>

      <ReferenceGroup title="公式示例">
        {examples.map((item) => (
          <ReferenceItem
            key={item.id}
            code={item.expression}
            note={`${item.title} · ${item.description}`}
            ret={item.return_type}
            action={onApplyExample ? <Button size="small" type="link" onClick={() => onApplyExample(item)}>套用</Button> : undefined}
          />
        ))}
      </ReferenceGroup>

      {orderedFnGroups.map(([cat, fns]) => (
        <ReferenceGroup key={`fn-${cat}`} title={CATEGORY_LABEL[cat] ?? cat}>
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
        <ReferenceGroup key={`var-${cat}`} title={CATEGORY_LABEL[cat] ?? cat}>
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

function ReferenceGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <Text strong style={{ fontSize: 12, color: '#16c784' }}>{title}</Text>
      <div style={{ marginTop: 6 }}>{children}</div>
    </div>
  );
}

function ReferenceItem({ code, note, ret, action }: { code: string; note: string; ret?: string; action?: ReactNode }) {
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
      <Space size={4} style={{ flexShrink: 0 }}>
        {ret && <Tag bordered={false} style={{ fontSize: 10, margin: 0 }}>{ret}</Tag>}
        {action}
      </Space>
    </div>
  );
}
