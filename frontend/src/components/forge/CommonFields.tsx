import React from 'react';
import { Input, Select, Switch, Tag } from 'antd';
import { ForgeState, DIFFICULTIES } from './types';
import { Field } from './Section';

const { TextArea } = Input;

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
  /** Hide the questionText field — useful when a form provides its own composer (e.g. dropdown blanks). */
  hideQuestionText?: boolean;
  /** Override the questionText label and placeholder per type. */
  questionTextLabel?: string;
  questionTextPlaceholder?: string;
}

const CommonFields: React.FC<Props> = ({
  state,
  onChange,
  hideQuestionText,
  questionTextLabel = 'Question text',
  questionTextPlaceholder = 'Enter the question prompt. LaTeX/MathJax allowed.'
}) => {
  return (
    <div className="space-y-5">
      {!hideQuestionText && (
        <Field label={questionTextLabel} required>
          <TextArea
            value={state.questionText}
            onChange={e => onChange({ questionText: e.target.value })}
            placeholder={questionTextPlaceholder}
            autoSize={{ minRows: 4, maxRows: 12 }}
            className="!rounded-xl !border-gray-300 hover:!border-orange-300 focus:!border-orange-400 focus:!shadow-[0_0_0_3px_rgba(251,146,60,0.15)] !text-[14px]"
          />
        </Field>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Difficulty" required>
          <Select
            value={state.difficulty}
            onChange={(v: string) => onChange({ difficulty: v })}
            options={DIFFICULTIES.map(d => ({ value: d, label: d }))}
            className="w-full"
          />
        </Field>
        <Field label="Topic">
          <Input
            value={state.topic}
            onChange={e => onChange({ topic: e.target.value })}
            placeholder="optional"
          />
        </Field>
        <Field label="Subtopic">
          <Input
            value={state.subtopic}
            onChange={e => onChange({ subtopic: e.target.value })}
            placeholder="optional"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Source"
          hint="Where the content came from — e.g., GMAT OG, GMAT Club. Defaults to 'Manual entry'."
        >
          <Input
            value={state.source}
            onChange={e => onChange({ source: e.target.value })}
            placeholder="Manual entry"
          />
        </Field>
        <Field label="Source URL">
          <Input
            value={state.sourceUrl}
            onChange={e => onChange({ sourceUrl: e.target.value })}
            placeholder="https://… (optional)"
          />
        </Field>
      </div>

      <Field label="Tags">
        <Select
          mode="tags"
          value={state.tags}
          onChange={(next: string[]) => onChange({ tags: next })}
          placeholder="Type and press Enter"
          className="w-full"
          tagRender={({ label, closable, onClose }) => (
            <Tag color="orange" closable={closable} onClose={onClose} className="!mr-1 !rounded-full !border-0 !px-2.5">
              {label}
            </Tag>
          )}
        />
      </Field>

      <Field label="Explanation" hint="Optional. Shown after the user answers.">
        <TextArea
          value={state.explanation}
          onChange={e => onChange({ explanation: e.target.value })}
          placeholder="Optional explanation of the correct answer."
          autoSize={{ minRows: 3, maxRows: 8 }}
        />
      </Field>

      <Field
        label="Ready for Quiz"
        hint="When on, this question is eligible for quizzes that opt in to the ready-only filter. Off by default."
      >
        <Switch
          checked={!!state.readyForQuiz}
          onChange={(checked) => onChange({ readyForQuiz: checked })}
        />
      </Field>
    </div>
  );
};

export default CommonFields;
