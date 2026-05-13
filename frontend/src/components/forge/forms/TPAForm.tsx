import React from 'react';
import { Input, Button } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import CommonFields from '../CommonFields';
import { ForgeState, ForgeSubQuestion } from '../types';
import { iconProps } from '../iconProps';
import Section, { Field, Note } from '../Section';

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const TPAForm: React.FC<Props> = ({ state, onChange }) => {
  const sub: ForgeSubQuestion = state.subQuestions?.[0] || ({
    questionId: 'tpa',
    questionText: '',
    questionType: 'two_part_analysis',
    columnHeaders: ['', ''],
    rowOptions: [],
    correctTPA: ['', '']
  } as ForgeSubQuestion);

  const update = (patch: Partial<ForgeSubQuestion>) =>
    onChange({ subQuestions: [{ ...sub, ...patch }] });

  const headers = sub.columnHeaders || ['', ''];
  const rows = sub.rowOptions || [];
  const correct = sub.correctTPA || ['', ''];

  const setHeader = (idx: 0 | 1, value: string) => {
    const next: [string, string] = [...headers] as [string, string];
    next[idx] = value;
    update({ columnHeaders: next });
  };

  const setCorrect = (col: 0 | 1, rowIdx: string) => {
    const next: [string, string] = [...correct] as [string, string];
    next[col] = rowIdx;
    update({ correctTPA: next });
  };

  const addRow = () => update({ rowOptions: [...rows, ''] });
  const removeRow = (idx: number) =>
    update({
      rowOptions: rows.filter((_, i) => i !== idx),
      correctTPA: [
        correct[0] === String(idx) ? '' : correct[0],
        correct[1] === String(idx) ? '' : correct[1]
      ] as [string, string]
    });
  const setRow = (idx: number, val: string) =>
    update({ rowOptions: rows.map((r, i) => (i === idx ? val : r)) });

  return (
    <div className="space-y-6">
      <Note title="Two-Part Analysis">
        Define 2 column headers and N row options. The user picks one row in each column — mark the correct one for each.
      </Note>

      <CommonFields
        state={state}
        onChange={onChange}
        questionTextPlaceholder='e.g., "A car is travelling… Select values of v₀ and v₁₀ that are consistent with the information. Make only two selections, one in each column."'
      />

      <Section title="Column headers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Column 1">
            <Input value={headers[0]} onChange={e => setHeader(0, e.target.value)} placeholder="e.g. v₀" />
          </Field>
          <Field label="Column 2">
            <Input value={headers[1]} onChange={e => setHeader(1, e.target.value)} placeholder="e.g. v₁₀" />
          </Field>
        </div>
      </Section>

      <Section
        title="Row options"
        description={`${rows.length} row${rows.length === 1 ? '' : 's'}. Click a column letter to mark the correct row for that column.`}
        actions={
          <Button size="small" icon={<PlusOutlined {...iconProps} />} onClick={addRow}>
            Add row
          </Button>
        }
      >
        <div className="space-y-2">
          {rows.length === 0 && (
            <div className="text-sm text-gray-400 italic px-2 py-6 text-center border border-dashed border-gray-300 rounded-xl">
              No rows yet. Add at least 2 candidate values.
            </div>
          )}
          {rows.map((row, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 p-2 border border-gray-200 rounded-xl bg-white"
            >
              <button
                type="button"
                onClick={() => setCorrect(0, String(idx))}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold tracking-wider uppercase transition-colors ${
                  correct[0] === String(idx)
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700'
                }`}
                title={`Mark as correct for column 1 (${headers[0] || 'Col 1'})`}
              >
                {headers[0] || 'Col 1'}
              </button>
              <button
                type="button"
                onClick={() => setCorrect(1, String(idx))}
                className={`flex-shrink-0 px-3 py-2 rounded-lg text-[11px] font-semibold tracking-wider uppercase transition-colors ${
                  correct[1] === String(idx)
                    ? 'bg-rose-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-rose-100 hover:text-rose-700'
                }`}
                title={`Mark as correct for column 2 (${headers[1] || 'Col 2'})`}
              >
                {headers[1] || 'Col 2'}
              </button>
              <Input
                value={row}
                onChange={e => setRow(idx, e.target.value)}
                placeholder={`Row ${idx + 1}`}
                className="flex-1"
              />
              <Button danger icon={<DeleteOutlined {...iconProps} />} onClick={() => removeRow(idx)} />
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 items-center text-[12px]">
          <span className="text-gray-500">Correct pair:</span>
          <span className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-800 font-semibold">
            {headers[0] || 'Col 1'} = {correct[0] !== '' ? rows[Number(correct[0])] || '?' : '—'}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 font-semibold">
            {headers[1] || 'Col 2'} = {correct[1] !== '' ? rows[Number(correct[1])] || '?' : '—'}
          </span>
        </div>
      </Section>
    </div>
  );
};

export default TPAForm;
