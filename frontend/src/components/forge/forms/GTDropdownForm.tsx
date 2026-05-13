import React, { useMemo } from 'react';
import { Input, Button } from 'antd';
import { PlusOutlined, DeleteOutlined, CheckOutlined } from '@ant-design/icons';
import CommonFields from '../CommonFields';
import ArtifactEditor from '../ArtifactEditor';
import { ForgeState, ForgeSubQuestion } from '../types';
import { uid } from '../templates';
import { iconProps } from '../iconProps';
import Section, { Note } from '../Section';

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const GTDropdownForm: React.FC<Props> = ({ state, onChange }) => {
  const subs = state.subQuestions || [];

  const blanks = useMemo(() => {
    const matches = (state.questionText || '').match(/\[\[(\d+)\]\]/g) || [];
    return matches.length;
  }, [state.questionText]);

  const setSub = (idx: number, patch: Partial<ForgeSubQuestion>) => {
    onChange({ subQuestions: subs.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
  };

  const setSubOption = (subIdx: number, optIdx: number, text: string) => {
    const sub = subs[subIdx];
    const next = (sub.options || []).map((o, i) => (i === optIdx ? { ...o, text } : o));
    setSub(subIdx, { options: next });
  };

  const addSubOption = (subIdx: number) => {
    const sub = subs[subIdx];
    const next = [...(sub.options || [])];
    const letter = String.fromCharCode(65 + next.length);
    next.push({ value: letter, text: '' });
    setSub(subIdx, { options: next });
  };

  const removeSubOption = (subIdx: number, optIdx: number) => {
    const sub = subs[subIdx];
    const next = (sub.options || []).filter((_, i) => i !== optIdx).map((o, i) => ({
      ...o,
      value: String.fromCharCode(65 + i)
    }));
    setSub(subIdx, { options: next });
  };

  const addBlank = () => {
    const nextNum = subs.length + 1;
    onChange({
      questionText: (state.questionText || '') + ` [[${nextNum}]]`,
      subQuestions: [
        ...subs,
        {
          questionId: uid(`gt_blank_${nextNum}`),
          questionText: `blank #${nextNum}`,
          questionType: 'multiple_choice',
          options: [
            { value: 'A', text: '' },
            { value: 'B', text: '' }
          ],
          correctMC: ''
        }
      ]
    });
  };

  const removeBlank = (idx: number) => {
    onChange({ subQuestions: subs.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      <Note tone="warning" title="Graphs & Tables — Dropdown Fill-in (saver only)">
        Use markers like <code className="px-1 py-0.5 rounded bg-amber-200/60 text-amber-900 font-mono text-[12px]">[[1]]</code>,{' '}
        <code className="px-1 py-0.5 rounded bg-amber-200/60 text-amber-900 font-mono text-[12px]">[[2]]</code> in the
        question text — each marker maps to a blank with its own dropdown options. Note: rendering for this shape is a
        follow-up; the editor saves the correct shape today.
      </Note>

      <Section title="Artifact" description="Optional chart or table for the user to read.">
        <ArtifactEditor
          artifact={state.artifact || { imageUrls: [], tablesHtml: [], description: '' }}
          onChange={(next) => onChange({ artifact: next })}
        />
      </Section>

      <CommonFields
        state={state}
        onChange={onChange}
        questionTextLabel="Question text (with [[N]] markers)"
        questionTextPlaceholder="The data show that the value is [[1]] and the trend is [[2]]."
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <span className="px-2.5 py-1 rounded-full bg-cyan-100 text-cyan-800 font-semibold">
          Blanks detected: {blanks}
        </span>
        <span className="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-semibold">
          Sub-questions: {subs.length}
        </span>
        {blanks !== subs.length && (
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold">
            ⚠ Mismatch — they must match
          </span>
        )}
      </div>

      {subs.map((sub, idx) => (
        <Section
          key={sub.questionId}
          title={
            <span>
              Blank #{idx + 1}{' '}
              <code className="ml-2 text-[11px] font-mono px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-800">
                [[{idx + 1}]]
              </code>
            </span>
          }
          actions={
            <Button danger size="small" icon={<DeleteOutlined {...iconProps} />} onClick={() => removeBlank(idx)}>
              Remove
            </Button>
          }
          tone="subtle"
        >
          <div className="space-y-2">
            {(sub.options || []).map((opt, optIdx) => {
              const isCorrect = sub.correctMC === opt.value;
              return (
                <div key={optIdx} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSub(idx, { correctMC: opt.value })}
                    className={`flex-shrink-0 w-9 h-9 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${
                      isCorrect
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-300'
                    }`}
                    title="Mark as correct"
                  >
                    {isCorrect ? <CheckOutlined {...iconProps} /> : opt.value}
                  </button>
                  <Input
                    value={opt.text}
                    onChange={e => setSubOption(idx, optIdx, e.target.value)}
                    placeholder={`Option ${opt.value}`}
                    className="flex-1"
                  />
                  <Button
                    size="small"
                    danger
                    icon={<DeleteOutlined {...iconProps} />}
                    onClick={() => removeSubOption(idx, optIdx)}
                    disabled={(sub.options || []).length <= 2}
                  />
                </div>
              );
            })}
            <Button size="small" icon={<PlusOutlined {...iconProps} />} onClick={() => addSubOption(idx)}>
              Add option
            </Button>
          </div>
        </Section>
      ))}

      <div className="flex justify-center">
        <Button size="large" icon={<PlusOutlined {...iconProps} />} onClick={addBlank}>
          Add another blank
        </Button>
      </div>
    </div>
  );
};

export default GTDropdownForm;
