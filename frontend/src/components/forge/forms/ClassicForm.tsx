import React, { useRef } from 'react';
import { Input, Select } from 'antd';
import CommonFields from '../CommonFields';
import { ForgeState, ClassicSubType } from '../types';
import { DS_OPTIONS } from '../templates';
import { Field, Note } from '../Section';

const { TextArea } = Input;

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

// Unicode math glyphs that mimic handwritten notation. Insertion is plain
// Unicode — no MathJax/KaTeX rendering layer needed, so existing question
// cards display these as-is.
const MATH_OPS: Array<{ char: string; label: string; hint?: string }> = [
  { char: '√', label: '√', hint: 'square root' },
  { char: '∛', label: '∛', hint: 'cube root' },
  { char: '∜', label: '∜', hint: 'fourth root' },
  { char: '²', label: 'x²' },
  { char: '³', label: 'x³' },
  { char: '⁴', label: 'x⁴' },
  { char: '⁵', label: 'x⁵' },
  { char: 'ⁿ', label: 'xⁿ' },
  { char: '⁻¹', label: 'x⁻¹' },
  { char: '½', label: '½' },
  { char: '⅓', label: '⅓' },
  { char: '¼', label: '¼' },
  { char: '×', label: '×' },
  { char: '÷', label: '÷' },
  { char: '±', label: '±' },
  { char: '≤', label: '≤' },
  { char: '≥', label: '≥' },
  { char: '≠', label: '≠' },
  { char: '≈', label: '≈' },
  { char: 'π', label: 'π' },
  { char: '°', label: '°' },
  { char: '∞', label: '∞' },
  { char: '∑', label: '∑' },
  { char: '∫', label: '∫' },
  { char: '→', label: '→' },
  { char: '·', label: '·' }
];

const TYPE_LABELS: Record<ClassicSubType, string> = {
  PS: 'Problem Solving',
  DS: 'Data Sufficiency',
  CR: 'Critical Reasoning',
  RC: 'Reading Comprehension'
};

const CATEGORY_FOR: Record<ClassicSubType, string> = {
  PS: 'Quantitative',
  DS: 'Quantitative',
  CR: 'Verbal',
  RC: 'Verbal'
};

const ClassicForm: React.FC<Props> = ({ state, onChange }) => {
  const classicType: ClassicSubType = state.classicType || 'PS';
  // The math toolbar inserts at the question textarea cursor. Capture the
  // ref so we can both read the selection and move the caret after insert.
  const questionTextRef = useRef<any>(null);

  const handleTypeChange = (next: ClassicSubType) => {
    onChange({
      classicType: next,
      category: CATEGORY_FOR[next],
      // DS lockstep: re-fill canonical option text on every switch INTO DS so
      // a user who explored other types and came back doesn't see stale text.
      ...(next === 'DS'
        ? { options: { ...DS_OPTIONS } }
        : classicType === 'DS'
          ? { options: { A: '', B: '', C: '', D: '', E: '' } }
          : {})
    });
  };

  const insertMath = (ch: string) => {
    const ta = questionTextRef.current?.resizableTextArea?.textArea as HTMLTextAreaElement | undefined;
    const current = state.questionText || '';
    if (!ta) {
      onChange({ questionText: current + ch });
      return;
    }
    const start = ta.selectionStart ?? current.length;
    const end = ta.selectionEnd ?? current.length;
    const next = current.slice(0, start) + ch + current.slice(end);
    onChange({ questionText: next });
    // Restore caret after React re-render.
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + ch.length;
      ta.setSelectionRange(pos, pos);
    });
  };

  return (
    <div className="space-y-6">
      <Note title="Quant & Verbal — single-answer types">
        One tile for all four non-DI types. Pick the type below; the form adapts. PS gets a math
        symbol toolbar (Unicode — what you click is what students see). DS&apos;s 5 answer choices are
        canonical and locked. RC and CR get a passage / argument field.
      </Note>

      <Field label="Question type" required>
        <Select
          value={classicType}
          onChange={(v: ClassicSubType) => handleTypeChange(v)}
          options={(['PS', 'DS', 'CR', 'RC'] as ClassicSubType[]).map((t) => ({
            value: t,
            label: `${t} — ${TYPE_LABELS[t]}`
          }))}
          className="w-full"
        />
      </Field>

      {(classicType === 'RC' || classicType === 'CR') && (
        <Field
          label={classicType === 'RC' ? 'Passage' : 'Argument / stimulus'}
          required
        >
          <TextArea
            value={state.passageText || ''}
            onChange={(e) => onChange({ passageText: e.target.value })}
            placeholder={classicType === 'RC'
              ? 'Paste the reading passage here.'
              : 'Paste the CR argument / stimulus here.'}
            autoSize={{ minRows: 5, maxRows: 16 }}
            className="!rounded-xl !border-gray-300 !text-[14px]"
          />
        </Field>
      )}

      {classicType === 'DS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Statement (1)" required>
            <TextArea
              value={state.statement1 || ''}
              onChange={(e) => onChange({ statement1: e.target.value })}
              placeholder="Statement 1"
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </Field>
          <Field label="Statement (2)" required>
            <TextArea
              value={state.statement2 || ''}
              onChange={(e) => onChange({ statement2: e.target.value })}
              placeholder="Statement 2"
              autoSize={{ minRows: 2, maxRows: 6 }}
            />
          </Field>
        </div>
      )}

      {classicType === 'PS' && (
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] font-semibold text-gray-500 mb-2">
            Math symbols · click to insert at the cursor
          </div>
          <div className="flex flex-wrap gap-1.5 mb-3 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100">
            {MATH_OPS.map((op) => (
              <button
                key={op.char + op.label}
                type="button"
                onClick={() => insertMath(op.char)}
                title={op.hint || op.label}
                className="px-2.5 py-1 rounded-md bg-white border border-indigo-200 text-sm font-medium text-indigo-800 hover:bg-indigo-100 hover:border-indigo-300 transition-colors min-w-[36px]"
              >
                {op.label}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-500 mb-2">
            Tip: combine glyphs — e.g. <code className="px-1 bg-gray-100 rounded">x² + y² ≤ √25</code>.
            Place the cursor where you want the symbol, then click.
          </div>
        </div>
      )}

      <Field label="Question text" required>
        <TextArea
          ref={questionTextRef}
          value={state.questionText}
          onChange={(e) => onChange({ questionText: e.target.value })}
          placeholder={
            classicType === 'PS'
              ? 'e.g. If x² + 3x = 10, what is x?'
              : classicType === 'DS'
                ? 'The question stem (without statements — those go in the fields above).'
                : classicType === 'CR'
                  ? 'The CR question (e.g. "Which of the following best supports the argument above?").'
                  : 'The RC question (e.g. "The passage suggests which of the following?").'
          }
          autoSize={{ minRows: 4, maxRows: 12 }}
          className="!rounded-xl !border-gray-300 !text-[14px]"
        />
      </Field>

      <CommonFields state={state} onChange={onChange} hideQuestionText />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-gray-800">Answer choices</span>
          {classicType === 'DS' && (
            <span className="text-[11px] uppercase tracking-wider text-gray-400">canonical · read-only</span>
          )}
        </div>
        <div className="space-y-2">
          {(['A', 'B', 'C', 'D', 'E'] as const).map((letter) => {
            const value = state.options?.[letter] ?? '';
            const selected = state.correctAnswer === letter;
            const locked = classicType === 'DS';
            return (
              <div
                key={letter}
                className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                  selected
                    ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange({ correctAnswer: letter })}
                  className={`flex-shrink-0 mt-1 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    selected ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-indigo-100'
                  }`}
                  title="Mark as correct answer"
                >
                  {letter}
                </button>
                {locked ? (
                  <span className="flex-1 text-sm leading-relaxed text-gray-700">
                    {DS_OPTIONS[letter]}
                  </span>
                ) : (
                  <Input
                    value={value}
                    onChange={(e) =>
                      onChange({
                        options: {
                          A: state.options?.A || '',
                          B: state.options?.B || '',
                          C: state.options?.C || '',
                          D: state.options?.D || '',
                          E: state.options?.E || '',
                          [letter]: e.target.value
                        }
                      })
                    }
                    placeholder={`Option ${letter}${letter === 'E' ? ' (optional)' : ''}`}
                    className="flex-1"
                  />
                )}
                {selected && (
                  <span className="flex-shrink-0 text-[11px] uppercase tracking-wider text-emerald-700 font-semibold mt-1.5">
                    Correct
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {!state.correctAnswer && (
          <div className="mt-3 text-[12px] text-amber-600">
            Pick the correct answer to continue.
          </div>
        )}
      </div>
    </div>
  );
};

export default ClassicForm;
