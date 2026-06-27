import { ApiError, apiClient } from './client';

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
  value: number;
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

// Formula Engine surface, mounted under /api/v1/formulas (plural) by the
// gateway. ListFunctions powers autocomplete; Validate powers live lint.
export const formulaApi = {
  listFunctions: () =>
    apiClient
      .get<{ items: FunctionDefinition[] }>('/formulas/functions')
      .then((r) => r.data.items ?? []),
  getFunction: (name: string) =>
    apiClient
      .get<{ function: FunctionDefinition }>(`/formulas/functions/${name}`)
      .then((r) => r.data.function),
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
};
