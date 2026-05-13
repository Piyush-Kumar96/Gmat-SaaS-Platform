import React, { useMemo } from 'react';
import { ForgeState } from './types';
import { forgeToPreview } from './serializer';
import { DSQuestionCard } from '../DSQuestionCard';
import { GTQuestionCard } from '../GTQuestionCard';
import { MSRQuestionCard } from '../MSRQuestionCard';
import { TPAQuestionCard } from '../TPAQuestionCard';

interface Props {
  state: ForgeState;
}

const EmptyHint: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-6 py-12 text-center">
    <div className="mx-auto w-14 h-14 rounded-full bg-orange-100 flex items-center justify-center text-2xl text-orange-500 mb-3">
      ◌
    </div>
    <div className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">{message}</div>
  </div>
);

const PreviewPane: React.FC<Props> = ({ state }) => {
  const preview = useMemo(() => forgeToPreview(state), [state]);

  let body: React.ReactNode = null;

  if (!state.questionText && !(state.options && Object.values(state.options).some(v => v))) {
    body = (
      <EmptyHint message="Start typing in the editor — the live test-taker view will render here." />
    );
  } else {
    switch (state.forgeType) {
      case 'CLASSIC': {
        // No DI card to reuse — render a plain, accurate preview that mirrors
        // how the test-taker will see PS / DS / CR / RC. Kept lightweight on
        // purpose; the visual polish lives on the actual quiz pages.
        const sub = state.classicType || 'PS';
        const opts = state.options || { A: '', B: '', C: '', D: '', E: '' };
        body = (
          <div className="space-y-4 text-[14px] text-gray-800 leading-relaxed">
            <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-indigo-700">
              {sub === 'PS' ? 'Problem Solving'
                : sub === 'DS' ? 'Data Sufficiency'
                : sub === 'CR' ? 'Critical Reasoning'
                : 'Reading Comprehension'}
            </div>
            {(sub === 'RC' || sub === 'CR') && state.passageText && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 whitespace-pre-wrap">
                {state.passageText}
              </div>
            )}
            <div className="whitespace-pre-wrap font-medium">
              {state.questionText || <span className="text-gray-400">Question text…</span>}
            </div>
            {sub === 'DS' && (state.statement1 || state.statement2) && (
              <div className="space-y-1 text-[13px]">
                {state.statement1 && <div>(1) {state.statement1}</div>}
                {state.statement2 && <div>(2) {state.statement2}</div>}
              </div>
            )}
            <div className="space-y-2">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((l) => {
                const text = opts[l];
                if (!text) return null;
                const isCorrect = state.correctAnswer === l;
                return (
                  <div
                    key={l}
                    className={`flex items-start gap-3 p-2.5 rounded-lg border ${
                      isCorrect ? 'border-emerald-300 bg-emerald-50/60' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span
                      className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {l}
                    </span>
                    <span>{text}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
        break;
      }
      case 'DI-DS':
        body = (
          <DSQuestionCard
            question={preview as any}
            selectedAnswer={preview.correctAnswer}
            showAnswer={!!preview.correctAnswer}
            correctAnswer={preview.correctAnswer}
            explanation={preview.explanation}
          />
        );
        break;
      case 'DI-GT-MC':
        body = (
          <GTQuestionCard
            question={preview as any}
            selectedAnswer={preview.correctAnswer}
            showAnswer={!!preview.correctAnswer}
            correctAnswer={preview.correctAnswer}
            explanation={preview.explanation}
          />
        );
        break;
      case 'DI-GT-YESNO':
      case 'DI-GT-DROPDOWN':
        // GTQuestionCard now handles both YesNo and Dropdown shapes natively.
        body = (
          <GTQuestionCard
            question={preview as any}
            showAnswer={true}
            selectedSubAnswers={{}}
            explanation={preview.explanation}
          />
        );
        break;
      case 'DI-MSR':
        body = (
          <MSRQuestionCard
            question={preview as any}
            currentSubQuestionIndex={0}
            selectedAnswers={{}}
            showAnswer={true}
            correctAnswers={(preview.subQuestions || []).reduce((acc: any, sq: any) => {
              acc[sq.questionId] = sq.correctAnswer;
              return acc;
            }, {})}
          />
        );
        break;
      case 'DI-TPA': {
        const sub = preview.subQuestions?.[0];
        body = sub ? (
          <TPAQuestionCard
            question={preview as any}
            showAnswer={true}
            selectedAnswers={{}}
            correctAnswers={{ [sub.questionId]: sub.correctAnswer || ['', ''] }}
          />
        ) : null;
        break;
      }
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-xl shadow-gray-900/[0.04] overflow-hidden">
      {/* Faux browser chrome — gives the preview a "look how the user sees it" feel */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
          <span className="ml-2 text-[11px] uppercase tracking-[0.18em] font-semibold text-gray-500">
            Live preview
          </span>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {state.forgeType}
        </span>
      </div>

      <div className="p-5 max-h-[78vh] overflow-y-auto bg-[radial-gradient(circle_at_30%_-10%,rgba(251,146,60,0.08),transparent_50%)]">
        {body}
      </div>

      <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-500 flex items-center justify-between gap-2">
        <span>Highlighted answer reflects what you've marked as correct.</span>
        {state.correctAnswer && (
          <span className="font-semibold text-emerald-700">
            Correct: {state.correctAnswer}
          </span>
        )}
      </div>
    </div>
  );
};

export default PreviewPane;
