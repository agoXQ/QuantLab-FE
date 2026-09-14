import { StreamLanguage, type StreamParser, HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags as t } from '@lezer/highlight';

// Built-in variables from app/formula/infrastructure/variable/registry.go.
// Functions come from the live API; variables are not exposed over HTTP
// so we mirror the registry here.
export interface DslVariable {
  name: string;
  type: string;
  category: string;
  description: string;
}

export const BUILTIN_VARIABLES: DslVariable[] = [
  { name: 'OPEN', type: 'Series', category: '行情', description: '开盘价' },
  { name: 'HIGH', type: 'Series', category: '行情', description: '最高价' },
  { name: 'LOW', type: 'Series', category: '行情', description: '最低价' },
  { name: 'CLOSE', type: 'Series', category: '行情', description: '收盘价' },
  { name: 'VOL', type: 'Series', category: '行情', description: '成交量' },
  { name: 'AMOUNT', type: 'Series', category: '行情', description: '成交额' },
  { name: 'C', type: 'Series', category: '别名', description: 'CLOSE 简写' },
  { name: 'O', type: 'Series', category: '别名', description: 'OPEN 简写' },
  { name: 'H', type: 'Series', category: '别名', description: 'HIGH 简写' },
  { name: 'L', type: 'Series', category: '别名', description: 'LOW 简写' },
  { name: 'V', type: 'Series', category: '别名', description: 'VOL 简写' },
];

export const DSL_KEYWORDS = ['AND', 'OR', 'NOT', 'TRUE', 'FALSE'];

// --- StreamLanguage tokenizer ---
// StreamLanguage.token returns a string tag name (not a Lezer Tag object).
// The string is resolved to a highlight tag via @codemirror/language's
// TokenTable. Valid strings are property names of @lezer/highlight's
// `tags` object: "lineComment", "string", "number", "keyword",
// "variableName", "operator", "paren", "separator", etc.
interface DslState {}

const dslStreamParser: StreamParser<DslState> = {
  token(stream) {
    if (stream.eatSpace()) return null;

    // Line comment: // ...
    if (stream.match('//')) {
      stream.skipToEnd();
      return 'lineComment';
    }

    // String literal: "..."
    if (stream.match('"')) {
      while (!stream.eol()) {
        const ch = stream.next()!;
        if (ch === '\\' && !stream.eol()) stream.next();
        else if (ch === '"') break;
      }
      return 'string';
    }

    // Number: integer or float, including scientific notation (5e9)
    if (stream.match(/^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/)) {
      return 'number';
    }

    // Identifier — variable or function call (if followed by '(')
    if (stream.match(/^[A-Za-z_][A-Za-z0-9_]*/)) {
      const upper = stream.current().toUpperCase();
      if (stream.match(/^\s*\(/, false)) {
        // Function name — use typeName to get a distinct color from variables.
        return 'typeName';
      }
      if (DSL_KEYWORDS.includes(upper)) {
        return 'keyword';
      }
      return 'variableName';
    }

    // Two-char operators
    if (stream.match('<=') || stream.match('>=') || stream.match('==') || stream.match('!=')) {
      return 'operator';
    }

    // Single-char operators
    const ch = stream.next()!;
    if ('+-*/%><=!'.includes(ch)) return 'operator';
    if (ch === '(' || ch === ')') return 'paren';
    if (ch === ',') return 'separator';
    return null;
  },
  startState: (): DslState => ({}),
  copyState: (s: DslState): DslState => ({ ...s }),
};

export const dslLanguage = StreamLanguage.define(dslStreamParser);

// --- Highlight style (QuantLab dark theme) ---
export const dslHighlightStyle = HighlightStyle.define([
  { tag: t.lineComment, color: '#484f58', fontStyle: 'italic' },
  { tag: t.string, color: '#a5d6ff' },
  { tag: t.number, color: '#f0b90b' },
  { tag: t.keyword, color: '#ff7b72', fontWeight: 'bold' },
  { tag: t.typeName, color: '#d2a8ff' },
  { tag: t.variableName, color: '#79c0ff' },
  { tag: t.operator, color: '#16c784' },
  { tag: t.paren, color: '#8b949e' },
  { tag: t.separator, color: '#8b949e' },
]);

// Bundled extensions: language + highlighting + editor theme.
export const dslExtensions = [
  dslLanguage,
  syntaxHighlighting(dslHighlightStyle),
  EditorView.theme({
    '&': {
      backgroundColor: '#0d1117',
      color: '#e6edf3',
      fontSize: '13px',
    },
    '.cm-content': {
      fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
      padding: '12px',
      caretColor: '#16c784',
    },
    '.cm-gutters': {
      backgroundColor: '#0d1117',
      border: 'none',
      color: '#484f58',
    },
    '.cm-activeLine': { backgroundColor: 'rgba(22,199,132,0.04)' },
    '.cm-activeLineGutter': { backgroundColor: 'rgba(22,199,132,0.06)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'rgba(22,199,132,0.15) !important',
    },
    '.cm-cursor': { borderLeftColor: '#16c784' },
    '.cm-tooltip': {
      backgroundColor: '#1c2330',
      border: '1px solid #2a313c',
      borderRadius: '4px',
    },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
      backgroundColor: 'rgba(22,199,132,0.2)',
      color: '#e6edf3',
    },
    '.cm-tooltip-autocomplete ul li .cm-completionIcon': { color: '#16c784' },
    '.cm-lintRange-error': { textDecoration: 'underline wavy #ea3943' },
    '.cm-diagnostic-error': { borderLeft: '3px solid #ea3943' },
    '.cm-diagnostic': {
      backgroundColor: '#1c2330',
      color: '#ea3943',
      border: 'none',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '12px',
    },
  }),
];
