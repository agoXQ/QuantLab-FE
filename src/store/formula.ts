import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RuleType } from '@/dsl/ruleTypes';

export interface SavedFormula {
  id: string;
  name: string;
  rule_type: RuleType;
  expression: string;
  description: string;
  created_at: number;
  updated_at: number;
}

interface FormulaStore {
  formulas: SavedFormula[];
  add: (f: Omit<SavedFormula, 'id' | 'created_at' | 'updated_at'>) => string;
  update: (id: string, patch: Partial<Omit<SavedFormula, 'id' | 'created_at'>>) => void;
  remove: (id: string) => void;
  getByType: (type: RuleType) => SavedFormula[];
}

// Client-side formula library. The backend has no formula entity today
// (the formula engine only validates/compiles; strategy versions store
// rules as strings). This store gives us the workshop UX now; when the
// backend adds a formula CRUD service, the store API swaps underneath
// with no page changes.
const seedFormulas: SavedFormula[] = [
  {
    id: 'seed-roe-value',
    name: '高ROE低估值',
    rule_type: 'stock_select',
    expression: 'ROE > 15\nAND PE < 20\nAND MarketCap > 5e9',
    description: 'ROE 大于 15 且 PE 小于 20 且市值大于 50 亿',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 'seed-ma-cross-buy',
    name: '均线金叉买入',
    rule_type: 'buy_rule',
    expression: 'CROSS(MA(CLOSE,5), MA(CLOSE,20))',
    description: '5 日均线上穿 20 日均线',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 'seed-ma-sell',
    name: '跌破均线卖出',
    rule_type: 'sell_rule',
    expression: 'CLOSE < MA(CLOSE,20)',
    description: '收盘价跌破 20 日均线',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 'seed-equal-weight',
    name: '等权仓位',
    rule_type: 'position_rule',
    expression: '0.1',
    description: '每只股票 10% 仓位',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
  {
    id: 'seed-roe-growth-rank',
    name: 'ROE×增长排序',
    rule_type: 'ranking_rule',
    expression: 'ROE * ProfitGrowth',
    description: 'ROE 乘以利润增长率作为排序权重',
    created_at: Date.now(),
    updated_at: Date.now(),
  },
];

function uid() {
  return `f-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useFormulaStore = create<FormulaStore>()(
  persist(
    (set, get) => ({
      formulas: seedFormulas,
      add: (f) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          formulas: [
            ...s.formulas,
            { ...f, id, created_at: now, updated_at: now },
          ],
        }));
        return id;
      },
      update: (id, patch) =>
        set((s) => ({
          formulas: s.formulas.map((f) =>
            f.id === id ? { ...f, ...patch, updated_at: Date.now() } : f,
          ),
        })),
      remove: (id) =>
        set((s) => ({ formulas: s.formulas.filter((f) => f.id !== id) })),
      getByType: (type) => get().formulas.filter((f) => f.rule_type === type),
    }),
    { name: 'quantlab-formulas' },
  ),
);
