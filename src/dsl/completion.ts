import {
  type CompletionContext,
  type CompletionResult,
  autocompletion,
  acceptCompletion,
  snippetCompletion,
} from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import { sortCategorizedItems } from '@/dsl/categories';
import { DSL_KEYWORDS, BUILTIN_VARIABLES, type DslVariable } from './language';
import type { FunctionDefinition } from '@/api/formula';

// Shared completion source: functions (from live API), built-in variables,
// keywords (AND/OR/NOT/TRUE/FALSE), and the TRUE/FALSE constants. The
// function/variable lists are injected so the editor stays in sync with
// whatever the backend reports without re-fetching on every keystroke.
export function buildCompletionSource(
  functions: FunctionDefinition[],
  variables: DslVariable[] = BUILTIN_VARIABLES,
) {
  const fnCompletions = sortCategorizedItems(functions).map((fn) => {
    const signature = `${fn.name}(${fn.params.map((p) => p.name).join(', ')})`;
    const snippet =
      fn.params.length > 0
        ? `${fn.name}(${fn.params.map((p, index) => `\${${index + 1}:${p.name}}`).join(', ')})`
        : `${fn.name}()`;
    return snippetCompletion(snippet, {
      label: fn.name,
      type: 'function' as const,
      detail: `${fn.return_type} · ${signature}`,
      info: `${fn.description}\n${fn.params.map((p) => `  ${p.name}: ${p.param_type}`).join('\n')}`,
    });
  });

  const varCompletions = variables.map((v) => ({
    label: v.name,
    type: 'variable' as const,
    detail: v.type,
    info: `${v.category} · ${v.description}`,
  }));

  const keywordCompletions = DSL_KEYWORDS.map((kw) => ({
    label: kw,
    type: 'keyword' as const,
  }));

  const all = [...fnCompletions, ...varCompletions, ...keywordCompletions];

  return (context: CompletionContext): CompletionResult | null => {
    const word = context.matchBefore(/[A-Za-z_][A-Za-z0-9_]*/);
    if (!word) return null;
    if (word.from === word.to && !context.explicit) return null;

    return {
      from: word.from,
      to: word.to,
      options: all,
      validFor: /^[A-Za-z_][A-Za-z0-9_]*$/,
    };
  };
}

export function buildCompletionExtension(functions: FunctionDefinition[]): Extension[] {
  return [
    autocompletion({
      override: [buildCompletionSource(functions)],
      activateOnTyping: true,
      closeOnBlur: true,
      maxRenderedOptions: 30,
      // Default is true; keep cursor in the editor while typing filters
      // the list (so "cl" highlights CLOSE without a manual selection).
      aboveCursor: false,
    }),
    // Tab and Enter both confirm the highlighted completion. acceptCompletion
    // returns false when no tooltip is open, so Enter falls through to a
    // normal newline and Tab falls through to default tab behavior.
    keymap.of([
      { key: 'Tab', run: acceptCompletion },
      { key: 'Enter', run: acceptCompletion },
    ]),
  ];
}
