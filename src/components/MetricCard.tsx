import { Card, Statistic } from 'antd';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: number;
  precision?: number;
  suffix?: string;
  prefix?: ReactNode;
  valueColor?: string;
}

export default function MetricCard({ title, value, precision = 2, suffix, prefix, valueColor }: Props) {
  return (
    <Card size="small" style={{ height: '100%' }}>
      <Statistic
        title={<span style={{ fontSize: 12, color: '#8b949e' }}>{title}</span>}
        value={value}
        precision={precision}
        suffix={suffix}
        prefix={prefix}
        styles={{ content: { color: valueColor ?? '#e6edf3', fontSize: 22, fontFamily: "'JetBrains Mono', monospace" } }}
      />
    </Card>
  );
}
