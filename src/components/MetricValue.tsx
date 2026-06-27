// Colors a numeric value by sign: green for positive (returns), red
// for negative, muted for zero. The platform's semantic palette.
import { Typography } from 'antd';

const { Text } = Typography;

interface Props {
  value: number;
  suffix?: string;
  precision?: number;
  prefix?: string;
}

export default function MetricValue({ value, suffix, precision = 2, prefix }: Props) {
  const color = value > 0 ? '#16c784' : value < 0 ? '#ea3943' : '#8b949e';
  const sign = value > 0 ? '+' : '';
  return (
    <Text style={{ color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace" }}>
      {prefix}
      {sign}
      {value.toFixed(precision)}
      {suffix}
    </Text>
  );
}
