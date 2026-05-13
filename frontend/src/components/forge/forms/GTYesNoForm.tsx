import React from 'react';
import { Input, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import CommonFields from '../CommonFields';
import ArtifactEditor from '../ArtifactEditor';
import { ForgeState, ForgeSubQuestion } from '../types';
import { iconProps } from '../iconProps';
import Section, { Field, Note } from '../Section';

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const GTYesNoForm: React.FC<Props> = ({ state, onChange }) => {
  const sq: ForgeSubQuestion = state.subQuestions?.[0] || ({
    questionId: 'gt_yn',
    questionText: '',
    questionType: 'yes_no_table',
    columnHeaders: ['Supported', 'Not supported'],
    statements: [],
    correctYesNo: []
  } as ForgeSubQuestion);

  const update = (patch: Partial<ForgeSubQuestion>) =>
    onChange({ subQuestions: [{ ...sq, ...patch }] });

  const headers = sq.columnHeaders || ['Supported', 'Not supported'];
  const statements = sq.statements || [];
  const correct = sq.correctYesNo || [];

  const setHeader = (idx: 0 | 1, value: string) => {
    const next: [string, string] = [...headers] as [string, string];
    next[idx] = value;
    update({ columnHeaders: next });
  };

  const addStatement = () => {
    update({
      statements: [...statements, { text: '' }],
      correctYesNo: [...correct, '']
    });
  };

  const removeStatement = (idx: number) => {
    update({
      statements: statements.filter((_, i) => i !== idx),
      correctYesNo: correct.filter((_, i) => i !== idx)
    });
  };

  const setStatementText = (idx: number, text: string) => {
    update({ statements: statements.map((s, i) => (i === idx ? { text } : s)) });
  };

  const setCorrect = (idx: number, colIdx: '0' | '1') => {
    update({ correctYesNo: correct.map((c, i) => (i === idx ? colIdx : c)) });
  };

  return (
    <div className="space-y-6">
      <Note title="Graphs & Tables — Yes / No">
        Provide an artifact, a lead-in instruction (e.g., "For each conclusion, select Supported if supported by the table…"),
        the two column headers, and N statements. Mark the correct column for each statement.
      </Note>

      <Section title="Artifact" description="The data the user reads to answer the statements.">
        <ArtifactEditor
          artifact={state.artifact || { imageUrls: [], tablesHtml: [], description: '' }}
          onChange={(next) => onChange({ artifact: next })}
        />
      </Section>

      <CommonFields
        state={state}
        onChange={onChange}
        questionTextLabel="Lead-in instruction"
        questionTextPlaceholder="For each of the following statements, select Supported if it is supported by the information; otherwise select Not supported."
      />

      <Section title="Column headers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Column 1">
            <Input value={headers[0]} onChange={e => setHeader(0, e.target.value)} placeholder="Supported" />
          </Field>
          <Field label="Column 2">
            <Input value={headers[1]} onChange={e => setHeader(1, e.target.value)} placeholder="Not supported" />
          </Field>
        </div>
      </Section>

      <Section
        title={`Statements`}
        description={`${statements.length} statement${statements.length === 1 ? '' : 's'} — ${statements.length < 2 ? 'add at least 2.' : 'looking good.'}`}
        actions={
          <Button icon={<PlusOutlined {...iconProps} />} size="small" onClick={addStatement}>
            Add statement
          </Button>
        }
      >
        {statements.length === 0 && (
          <div className="text-sm text-gray-400 italic px-2 py-6 text-center border border-dashed border-gray-300 rounded-xl">
            No statements yet. Add at least 2 to define the question.
          </div>
        )}
        <div className="space-y-2">
          {statements.map((s, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2 p-3 border border-gray-200 rounded-xl bg-white"
            >
              <div className="flex flex-col gap-1 min-w-[90px] pt-0.5">
                <button
                  type="button"
                  onClick={() => setCorrect(idx, '0')}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                    correct[idx] === '0'
                      ? 'bg-emerald-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-emerald-100 hover:text-emerald-700'
                  }`}
                >
                  {headers[0] || 'Col 1'}
                </button>
                <button
                  type="button"
                  onClick={() => setCorrect(idx, '1')}
                  className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                    correct[idx] === '1'
                      ? 'bg-rose-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-700 hover:bg-rose-100 hover:text-rose-700'
                  }`}
                >
                  {headers[1] || 'Col 2'}
                </button>
              </div>
              <Input.TextArea
                value={s.text}
                onChange={e => setStatementText(idx, e.target.value)}
                placeholder={`Statement #${idx + 1}`}
                autoSize={{ minRows: 1, maxRows: 4 }}
                className="flex-1"
              />
              <Button danger icon={<DeleteOutlined {...iconProps} />} onClick={() => removeStatement(idx)} />
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default GTYesNoForm;
