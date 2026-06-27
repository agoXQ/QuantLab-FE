import { useMemo, useRef, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from '@codemirror/view';
import { linter, type Diagnostic } from '@codemirror/lint';
import { useQuery } from '@tanstack/react-query';
import { dslExtensions } from '@/dsl/language';
import { buildCompletionExtension } from '@/dsl/completion';
import { formulaApi, type FunctionDefinition } from '@/api/formula';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  height?: string;
  /** Disable live validation (e.g. while the formula is intentionally partial). */
  validate?: boolean;
}

// Parses the backend validate error "(pos:N)" marker to extract a
// zero-based character offset for the lint diagnostic.
function extractPosition(error?: string): number | null {
  if (!error) return null;
  const m = error.match(/pos:(\d+)/);
  return m ? Number(m[1]) : null;
}

export default function FormulaEditor({
  value,
  onChange,
  placeholder,
  height = '120px',
  validate = true,
}: Props) {
  const editorRef = useRef<EditorView | null>(null);

  // Fetch the function catalog once; it backs autocomplete. Stale for 10
  // min since the built-in function set rarely changes.
  const { data: functions = [] } = useQuery<FunctionDefinition[]>({
    queryKey: ['formula-functions'],
    queryFn: () => formulaApi.listFunctions(),
    staleTime: 600_000,
  });

  const completionExts = useMemo(() => buildCompletionExtension(functions), [functions]);

  // Async linter: debounces via CodeMirror's built-in delay, calls
  // POST /formulas/validate and maps the result to diagnostics. Empty
  // formulas are skipped so there's no noise while the user is thinking.
  const lintExt = useMemo(() => {
    if (!validate) return [];
    return linter(
      async (view): Promise<Diagnostic[]> => {
        const text = view.state.doc.toString().trim();
        if (!text) return [];
        try {
          const result = await formulaApi.validate(text);
          if (!result.valid && result.error) {
            const pos = extractPosition(result.error) ?? text.length;
            const safePos = Math.min(pos, text.length);
            return [
              {
                from: safePos,
                to: Math.min(safePos + 1, text.length),
                severity: 'error',
                message: result.error,
              },
            ];
          }
        } catch {
          // Network errors shouldn't block editing.
        }
        return [];
      },
      { delay: 600 },
    );
  }, [validate]);

  const extensions = useMemo(
    () => [...dslExtensions, ...completionExts, lintExt, EditorView.lineWrapping],
    [completionExts, lintExt],
  );

  const onCreateEditor = useCallback((view: EditorView) => {
    editorRef.current = view;
  }, []);

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      onCreateEditor={onCreateEditor}
      placeholder={placeholder}
      height={height}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        highlightActiveLineGutter: true,
        foldGutter: false,
        autocompletion: false,
        bracketMatching: true,
        closeBrackets: true,
        indentOnInput: true,
      }}
      style={{
        border: '1px solid #21262d',
        borderRadius: 6,
        overflow: 'hidden',
      }}
    />
  );
}
