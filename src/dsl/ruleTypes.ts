// The seven strategy rule slots, each with a DSL return-type semantics.
// This drives both the formula workshop (formula is authored against a
// specific type) and the strategy editor (each slot only accepts
// formulas of the matching type).

export type RuleType =
  | 'stock_select'
  | 'buy_rule'
  | 'sell_rule'
  | 'position_rule'
  | 'rebalance_rule'
  | 'risk_rule'
  | 'ranking_rule';

export interface RuleTypeDef {
  type: RuleType;
  field: string; // StrategyVersion field name
  label: string;
  returnType: string; // DSL return type
  required: boolean;
  hint: string;
  example: string;
}

export const RULE_TYPES: RuleTypeDef[] = [
  {
    type: 'stock_select',
    field: 'formula_text',
    label: '选股规则',
    returnType: 'Boolean',
    required: true,
    hint: '返回 Boolean，筛选符合条件的股票',
    example: 'CLOSE > MA(CLOSE,20)\nAND VOL > MA(VOL,5)',
  },
  {
    type: 'buy_rule',
    field: 'buy_rule',
    label: '买入规则',
    returnType: 'Signal',
    required: true,
    hint: '返回 Signal，触发买入信号',
    example: 'CROSS(MA(CLOSE,5), MA(CLOSE,20))',
  },
  {
    type: 'sell_rule',
    field: 'sell_rule',
    label: '卖出规则',
    returnType: 'Signal',
    required: true,
    hint: '返回 Signal，触发卖出信号',
    example: 'CLOSE < MA(CLOSE,20)',
  },
  {
    type: 'position_rule',
    field: 'position_rule',
    label: '仓位规则',
    returnType: 'Number',
    required: false,
    hint: '返回 Number（权重 0–1）',
    example: '0.1',
  },
  {
    type: 'rebalance_rule',
    field: 'rebalance_rule',
    label: '调仓规则',
    returnType: 'Boolean',
    required: false,
    hint: '返回 Boolean，是否触发调仓',
    example: 'BARSLAST(CLOSE < MA(CLOSE,20)) > 5',
  },
  {
    type: 'risk_rule',
    field: 'risk_rule',
    label: '风险规则',
    returnType: 'Boolean',
    required: false,
    hint: '返回 Boolean，是否触发风控',
    example: 'CLOSE < MA(CLOSE,20) * 0.97',
  },
  {
    type: 'ranking_rule',
    field: 'ranking_rule',
    label: '排序规则',
    returnType: 'Number',
    required: false,
    hint: '返回 Number，选股排序依据',
    example: 'ROC(CLOSE,20)',
  },
];

export const RULE_TYPE_MAP: Record<string, RuleTypeDef> = Object.fromEntries(
  RULE_TYPES.map((r) => [r.type, r]),
);

// Maps a StrategyVersion field name back to its rule type.
export const FIELD_TO_TYPE: Record<string, RuleType> = Object.fromEntries(
  RULE_TYPES.map((r) => [r.field, r.type]),
);
