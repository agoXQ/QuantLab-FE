// Presentation filter for cached catalogs and locally saved formulas. The
// server's OHLCV capability guard is authoritative for validation/execution.
export const AVAILABLE_FUNCTIONS = new Set([
  'MACD_DIF', 'MACD_DEA', 'MACD_HIST', 'BOLL_MID', 'BOLL_UP', 'BOLL_DOWN', 'TR', 'ATR', 'EMA', 'SMA', 'MACD', 'RSI', 'MA', 'WMA', 'STD', 'ROC', 'BOLL', 'CCI', 'WR', 'ABS', 'MAX', 'MIN',
  'SUM', 'AVG', 'COUNT', 'REF', 'HHV', 'LLV', 'HHVBARS', 'LLVBARS',
  'BARSLAST', 'CROSS', 'CROSSDOWN', 'LONGCROSS', 'EVERY', 'EXIST',
]);

const unavailableVariables = new Set([
  'PE', 'PB', 'PS', 'ROE', 'ROA', 'EPS', 'REVENUEGROWTH', 'PROFITGROWTH',
  'MARKETCAP', 'FLOATMARKETCAP',
]);

export function isAvailableFormula(expression: string): boolean {
  const tokens = expression.replace(/\/\/[^\n]*/g, '').match(/[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|:=|[^\s]/g) ?? [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toUpperCase();
    if (unavailableVariables.has(token)) return false;
    if (/^[A-Z_][A-Z_0-9]*$/.test(token) && tokens[i + 1] === '(' && !['NOT', 'AND', 'OR'].includes(token)) {
      if (!AVAILABLE_FUNCTIONS.has(token)) return false;
    }

  }
  return true;
}
