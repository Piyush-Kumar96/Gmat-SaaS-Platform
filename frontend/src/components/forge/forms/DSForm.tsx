import React from 'react';
import CommonFields from '../CommonFields';
import { ForgeState } from '../types';
import { DS_OPTIONS } from '../templates';
import { Note } from '../Section';

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const DSForm: React.FC<Props> = ({ state, onChange }) => {
  return (
    <div className="space-y-6">
      <Note title="Data Sufficiency">
        Type the question stem (with the two numbered statements). The 5 answer choices are canonical
        and locked — you only pick which one is correct.
      </Note>

      <CommonFields
        state={state}
        onChange={onChange}
        questionTextLabel="Question stem (with statements)"
        questionTextPlaceholder={'e.g.\nIs x > 0?\n\n(1) x² = 9\n(2) x is a positive integer.'}
      />

      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-[13px] font-semibold text-gray-800">Answer choices</span>
          <span className="text-[11px] uppercase tracking-wider text-gray-400">canonical · read-only</span>
        </div>
        <div className="space-y-2">
          {(['A', 'B', 'C', 'D', 'E'] as const).map(letter => {
            const selected = state.correctAnswer === letter;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => onChange({ correctAnswer: letter })}
                className={`w-full text-left flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
                  selected
                    ? 'border-emerald-300 bg-emerald-50/70 ring-1 ring-emerald-200'
                    : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50/40'
                }`}
              >
                <span
                  className={`flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                    selected
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-100 text-gray-600 group-hover:bg-orange-100'
                  }`}
                >
                  {letter}
                </span>
                <span className={`flex-1 text-sm leading-relaxed ${selected ? 'text-emerald-900 font-medium' : 'text-gray-700'}`}>
                  {DS_OPTIONS[letter]}
                </span>
                {selected && (
                  <span className="flex-shrink-0 text-[11px] uppercase tracking-wider text-emerald-700 font-semibold">
                    Correct
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!state.correctAnswer && (
          <div className="mt-3 text-[12px] text-amber-600">Pick the correct answer to continue.</div>
        )}
      </div>
    </div>
  );
};

export default DSForm;
