import { AVAILABLE_FUNCTIONS, isAvailableFormula } from '@/dsl/availability';
import { ApiError, apiClient } from './client';
import { sortCategorizedItems } from '@/dsl/categories';
import type { RuleType } from '@/dsl/ruleTypes';

export interface FunctionParam {
  name: string;
  param_type: string;
}

export interface FunctionDefinition {
  name: string;
  category: string;
  return_type: string;
  description: string;
  params: FunctionParam[];
}

export interface FormulaExample {
  id: string;
  title: string;
  category: string;
  rule_type: RuleType;
  return_type: string;
  expression: string;
  description: string;
  tags: string[];
}

export interface FormulaExplainFunction {
  name: string;
  category: string;
  return_type: string;
  description: string;
  params: FunctionParam[];
}

export interface FormulaExplainTimeframe {
  function: string;
  timeframe: string;
  expression: string;
}

export interface FormulaExplainAssignment {
  name: string;
  expression: string;
}

export interface FormulaExplainResult {
  formula_hash: string;
  valid: boolean;
  error_code?: number;
  error?: string;
  plan_type?: string;
  summary?: string;
  variables?: string[];
  functions?: FormulaExplainFunction[];
  timeframes?: FormulaExplainTimeframe[];
  assignments?: FormulaExplainAssignment[];
}

interface FunctionParamDTO {
  name: string;
  param_type?: string;
  arg_type?: string;
}

interface FunctionDefinitionDTO {
  name: string;
  category: string;
  return_type: string;
  description: string;
  params?: FunctionParamDTO[];
  args?: FunctionParamDTO[];
}

export interface ValidationResult {
  valid: boolean;
  error_code?: number;
  error?: string;
}

export interface EvaluateRankingItem {
  stock_code: string;
  score: number;
}

export interface EvaluateValueItem {
  stock_code: string;
  value: number | null;
}

export interface EvaluateResult {
  formula_hash: string;
  plan_type: string; // FILTER | SIGNAL | SORT | VALUE
  selection?: string[];
  ranking?: EvaluateRankingItem[];
  values?: EvaluateValueItem[];
}

export interface ScreenUniverseFilter {
  market?: string;
  exchange?: string;
  industry?: string;
  asset_type?: string;
  status?: string;
  stock_codes?: string[];
}

export interface ScreenItem {
  stock_code: string;
  stock_name: string;
  exchange: string;
  industry: string;
  score?: number;
  selected: boolean;
}

export interface ScreenResult {
  formula_hash: string;
  plan_type: string;
  data_version: string;
  universe_size: number;
  items: ScreenItem[];
}

export interface SavedFormula {
  id: string;
  owner_id?: number;
  name: string;
  rule_type: RuleType;
  expression: string;
  description: string;
  visibility: number;
  created_at: number;
  updated_at: number;
}

interface SavedFormulaDTO {
  id: number | string;
  owner_id?: number;
  name: string;
  rule_type: RuleType;
  expression: string;
  description?: string;
  visibility?: number;
  created_at: string | number;
  updated_at: string | number;
}

function toMillis(value: string | number): number {
  if (typeof value === 'number') return value > 10_000_000_000 ? value : value * 1000;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeSavedFormula(f: SavedFormulaDTO): SavedFormula {
  return {
    id: String(f.id),
    owner_id: f.owner_id,
    name: f.name,
    rule_type: f.rule_type,
    expression: f.expression,
    description: f.description ?? '',
    visibility: f.visibility ?? 1,
    created_at: toMillis(f.created_at),
    updated_at: toMillis(f.updated_at),
  };
}

function normalizeFunction(fn: FunctionDefinitionDTO): FunctionDefinition {
  const params = fn.params ?? fn.args ?? [];
  return {
    name: fn.name,
    category: fn.category,
    return_type: fn.return_type,
    description: fn.description,
    params: params.map((p) => ({
      name: p.name,
      param_type: p.param_type ?? p.arg_type ?? 'Any',
    })),
  };
}

// Formula Engine surface, mounted under /api/v1/formulas (plural) by the
// gateway. ListFunctions powers autocomplete; Validate powers live lint.
export const formulaApi = {
  listFunctions: () =>
    apiClient
      .get<{ items?: FunctionDefinitionDTO[]; functions?: FunctionDefinitionDTO[] }>('/formulas/functions')
      .then((r) => sortCategorizedItems((r.data.items ?? r.data.functions ?? []).map(normalizeFunction).filter((f) => AVAILABLE_FUNCTIONS.has(f.name.toUpperCase())))),
  getFunction: (name: string) =>
    apiClient
      .get<{ function: FunctionDefinitionDTO }>(`/formulas/functions/${name}`)
      .then((r) => normalizeFunction(r.data.function)),
  listExamples: () =>
    apiClient
      .get<{ items?: FormulaExample[]; examples?: FormulaExample[] }>('/formulas/examples')
      .then((r) => (r.data.items ?? r.data.examples ?? []).filter((f) => isAvailableFormula(f.expression))),
  validate: (formula: string) =>
    apiClient
      .post<ValidationResult>('/formulas/validate', { formula })
      .then((r) => r.data),
  compile: (formula: string) =>
    apiClient
      .post<{ ast_json: string; plan_json: string; valid: boolean; error_code?: number; error?: string }>(
        '/formulas/compile',
        { formula },
      )
      .then((r) => r.data),
  explain: (formula: string) =>
    apiClient
      .post<FormulaExplainResult>('/formulas/explain', { formula })
      .then((r) => r.data),
  evaluate: (data: {
    formula: string;
    universe: string[];
    as_of_date?: string;
    lookback_bars?: number;
    data_version?: string;
  }) =>
    apiClient
      .post<EvaluateResult>('/formulas/evaluate', data)
      .then((r) => r.data),
  screen: (data: {
    formula: string;
    as_of_date?: string;
    lookback_bars?: number;
    universe_filter?: ScreenUniverseFilter;
    limit?: number;
  }) =>
    apiClient
      .post<ScreenResult>('/formulas/screen', data)
      .then((r) => r.data)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 404) {
          throw new ApiError(404, '公式选股接口未部署，请重启 gateway 和 formula 服务后重试', 404);
        }
        throw e;
      }),
  listSaved: (params?: { rule_type?: RuleType; scope?: 'mine' | 'public'; limit?: number; offset?: number }) =>
    apiClient
      .get<{ items: SavedFormulaDTO[] }>('/formulas/library', { params })
      .then((r) => (r.data.items ?? []).map(normalizeSavedFormula).filter((f) => isAvailableFormula(f.expression))),
  createSaved: (data: { name: string; rule_type: RuleType; expression: string; description?: string }) =>
    apiClient
      .post<{ formula: SavedFormulaDTO }>('/formulas/library', data)
      .then((r) => normalizeSavedFormula(r.data.formula)),
  updateSaved: (id: string, data: { name: string; rule_type: RuleType; expression: string; description?: string }) =>
    apiClient
      .put<{ formula: SavedFormulaDTO }>(`/formulas/library/${id}`, data)
      .then((r) => normalizeSavedFormula(r.data.formula)),
  publishSaved: (id: string) =>
    apiClient
      .post<{ formula: SavedFormulaDTO }>(`/formulas/library/${id}/publish`)
      .then((r) => normalizeSavedFormula(r.data.formula)),
  deleteSaved: (id: string) => apiClient.delete(`/formulas/library/${id}`).then((r) => r.data),
};
