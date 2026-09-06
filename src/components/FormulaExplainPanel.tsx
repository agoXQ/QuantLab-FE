import { useEffect, useState } from 'react';
import { App, Button, Card, Space, Tag, Typography } from 'antd';
import { BulbOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { formulaApi, type FormulaExplainResult } from '@/api/formula';

const { Text } = Typography;

interface Props {
  formula: string;
  buttonText?: string;
  compact?: boolean;
}

export default function FormulaExplainPanel({ formula, buttonText = '解释公式', compact = false }: Props) {
  const { message } = App.useApp();
  const [explanation, setExplanation] = useState<FormulaExplainResult | null>(null);

  useEffect(() => {
    setExplanation(null);
  }, [formula]);

  const explainFormula = useMutation({
    mutationFn: (expr: string) => formulaApi.explain(expr),
    onSuccess: (result) => setExplanation(result),
  });

  return (
    <Space direction="vertical" size={8} style={{ width: '100%', marginTop: compact ? 6 : 0, marginBottom: compact ? 0 : 16 }}>
      <Button
        size="small"
        icon={<BulbOutlined />}
        loading={explainFormula.isPending}
        onClick={() => {
          if (!formula.trim()) {
            message.warning('请先输入公式表达式');
            return;
          }
          explainFormula.mutate(formula);
        }}
      >
        {buttonText}
      </Button>
      {explanation && (
        <Card size="small" styles={{ body: { padding: compact ? 8 : 12 } }}>
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Text type={explanation.valid ? undefined : 'danger'} style={{ fontSize: compact ? 12 : undefined }}>
              {explanation.valid ? explanation.summary : explanation.error}
            </Text>
            {explanation.valid && (
              <>
                <Space size={4} wrap>
                  {explanation.plan_type && <Tag bordered={false} color="green">{explanation.plan_type}</Tag>}
                  {(explanation.variables ?? []).map((name) => <Tag key={name}>{name}</Tag>)}
                </Space>
                {(explanation.timeframes?.length ?? 0) > 0 && (
                  <Space size={4} wrap>
                    {explanation.timeframes?.map((tf) => (
                      <Tag key={`${tf.function}-${tf.timeframe}-${tf.expression}`} color="blue">
                        {tf.function} · {tf.timeframe}
                      </Tag>
                    ))}
                  </Space>
                )}
              </>
            )}
          </Space>
        </Card>
      )}
    </Space>
  );
}
