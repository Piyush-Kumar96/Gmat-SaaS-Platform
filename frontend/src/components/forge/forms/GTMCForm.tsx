import React from 'react';
import { Input } from 'antd';
import CommonFields from '../CommonFields';
import ArtifactEditor from '../ArtifactEditor';
import { ForgeState } from '../types';
import Section, { Note } from '../Section';

const { TextArea } = Input;

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const GTMCForm: React.FC<Props> = ({ state, onChange }) => {
  const opts = state.options || { A: '', B: '', C: '', D: '', E: '' };
  const setOption = (letter: 'A' | 'B' | 'C' | 'D' | 'E', text: string) =>
    onChange({ options: { ...opts, [letter]: text } });

  return (
    <div className="space-y-6">
      <Note title="Graphs & Tables — Multiple Choice">
        Provide the chart/table artifact, the question text, and the 5 options. Mark the correct one.
      </Note>

      <Section title="Artifact" description="A data table, image (chart/graph), or both. Used as the visual context for the question.">
        <ArtifactEditor
          artifact={state.artifact || { imageUrls: [], tablesHtml: [], description: '' }}
          onChange={(next) => onChange({ artifact: next })}
        />
      </Section>

      <CommonFields state={state} onChange={onChange} />

      <Section
        title="Answer choices"
        description="Five options, A through E. Click the letter to mark a choice as correct."
      >
        <div className="space-y-2">
          {(['A', 'B', 'C', 'D', 'E'] as const).map(letter => {
            const selected = state.correctAnswer === letter;
            return (
              <div
                key={letter}
                className={`flex items-start gap-2 p-2 rounded-xl border transition-colors ${
                  selected ? 'border-emerald-300 bg-emerald-50/70' : 'border-gray-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => onChange({ correctAnswer: letter })}
                  className={`flex-shrink-0 w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                    selected
                      ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/40'
                      : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                  }`}
                  title="Mark as correct"
                >
                  {letter}
                </button>
                <TextArea
                  value={opts[letter]}
                  onChange={e => setOption(letter, e.target.value)}
                  placeholder={`Option ${letter}`}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  className="flex-1"
                />
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
};

export default GTMCForm;
