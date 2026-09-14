// Presentation filter for cached catalogs and locally saved formulas. The
// server's OHLCV capability guard is authoritative for validation/execution.
export const AVAILABLE_FUNCTIONS = new Set([
  'EMA', 'SMA', 'MACD', 'RSI', 'MA', 'WMA', 'STD', 'ROC', 'BOLL', 'CCI', 'WR', 'ABS', 'MAX', 'MIN',
  'SUM', 'AVG', 'COUNT', 'REF', 'HHV', 'LLV', 'HHVBARS', 'LLVBARS',
  'BARSLAST', 'CROSS', 'CROSSDOWN', 'LONGCROSS', 'EVERY', 'EXIST',
]);

const unavailableVariables = new Set([
  'PE', 'PB', 'PS', 'ROE', 'ROA', 'EPS', 'REVENUEGROWTH', 'PROFITGROWTH',
  'MARKETCAP', 'FLOATMARKETCAP',
]);

export function isAvailableFormula(expression: string): boolean {
  const tokens = expression.replace(/\/\/[^\n]*/g, '').match(/[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|:=|[^\s]/g) ?? [];
  const scopes: boolean[] = [];
  const logicalLocals = new Set<string>();
  let assignment: string | undefined;
  let statementHasLogic = false;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].toUpperCase();
    if (tokens[i + 1] === ':=') assignment = token;
    if (token === ';') {
      if (assignment) {
        if (statementHasLogic) logicalLocals.add(assignment);
        else logicalLocals.delete(assignment);
      }
      assignment = undefined;
      statementHasLogic = false;
    }
    const logical = ['AND', 'OR', 'NOT'].includes(token) || logicalLocals.has(token);
    statementHasLogic ||= logical;
    if (unavailableVariables.has(token)) return false;
    if (/^[A-Z_][A-Z_0-9]*$/.test(token) && tokens[i + 1] === '(' && !['NOT', 'AND', 'OR'].includes(token)) {
      if (!AVAILABLE_FUNCTIONS.has(token)) return false;
    }
    if (token === '(') {
      const previous = (tokens[i - 1] ?? '').toUpperCase();
      scopes.push(AVAILABLE_FUNCTIONS.has(previous) || scopes.includes(true));
    } else if (token === ')') scopes.pop();
    else if (logical && scopes.includes(true)) return false;
  }
  return true;
}
