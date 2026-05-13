import React, { useState } from 'react';
import { Input, Button, Select, Tabs } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import CommonFields from '../CommonFields';
import ArtifactEditor from '../ArtifactEditor';
import { ForgeState, ForgeMSRSource, ForgeSubQuestion } from '../types';
import { uid } from '../templates';
import { iconProps } from '../iconProps';
import Section, { Field, Note } from '../Section';

const { TextArea } = Input;
const { TabPane } = Tabs;

interface Props {
  state: ForgeState;
  onChange: (patch: Partial<ForgeState>) => void;
}

const MSRForm: React.FC<Props> = ({ state, onChange }) => {
  const sources = state.msrSources || [];
  const subs = state.subQuestions || [];
  const [activeTab, setActiveTab] = useState('0');

  // Sources
  const setSource = (idx: number, patch: Partial<ForgeMSRSource>) =>
    onChange({ msrSources: sources.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });

  const addSource = () => {
    const next = [...sources, { tabName: `Source ${sources.length + 1}`, content: '', imageUrls: [], tablesHtml: [] }];
    onChange({ msrSources: next });
    setActiveTab(String(next.length - 1));
  };

  const removeSource = (idx: number) => {
    const next = sources.filter((_, i) => i !== idx);
    onChange({ msrSources: next });
    setActiveTab(String(Math.max(0, idx - 1)));
  };

  // Sub-questions
  const setSub = (idx: number, patch: Partial<ForgeSubQuestion>) =>
    onChange({ subQuestions: subs.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });

  const addSub = () =>
    onChange({
      subQuestions: [
        ...subs,
        {
          questionId: uid('msr_q'),
          questionText: '',
          questionType: 'multiple_choice',
          options: [
            { value: 'A', text: '' }, { value: 'B', text: '' },
            { value: 'C', text: '' }, { value: 'D', text: '' }, { value: 'E', text: '' }
          ],
          correctMC: ''
        }
      ]
    });

  const removeSub = (idx: number) =>
    onChange({ subQuestions: subs.filter((_, i) => i !== idx) });

  const switchSubType = (idx: number, type: 'multiple_choice' | 'yes_no_table') => {
    if (type === 'multiple_choice') {
      setSub(idx, {
        questionType: 'multiple_choice',
        options: [
          { value: 'A', text: '' }, { value: 'B', text: '' },
          { value: 'C', text: '' }, { value: 'D', text: '' }, { value: 'E', text: '' }
        ],
        correctMC: '',
        statements: undefined,
        columnHeaders: undefined,
        correctYesNo: undefined
      });
    } else {
      setSub(idx, {
        questionType: 'yes_no_table',
        columnHeaders: ['Yes', 'No'],
        statements: [{ text: '' }, { text: '' }, { text: '' }],
        correctYesNo: ['', '', ''],
        options: undefined,
        correctMC: undefined
      });
    }
  };

  return (
    <div className="space-y-6">
      <Note title="Multi-Source Reasoning">
        Define 2–3 source tabs (text + optional tables/images) shared across N sub-questions.
        Each sub-question is either Multiple Choice or a Yes/No table.
      </Note>

      <CommonFields
        state={state}
        onChange={onChange}
        questionTextLabel="Scenario / intro"
        questionTextPlaceholder="Optional intro shown above the source tabs."
      />

      <Section
        title={`Sources · ${sources.length}`}
        description="Each tab is a chunk of context (an email, a memo, a chart, etc.)"
        actions={
          <Button size="small" icon={<PlusOutlined {...iconProps} />} onClick={addSource}>
            Add source
          </Button>
        }
      >
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          type="editable-card"
          hideAdd
          onEdit={(key, action) => {
            if (action === 'remove') removeSource(Number(key));
          }}
        >
          {sources.map((src, idx) => (
            <TabPane tab={src.tabName || `Source ${idx + 1}`} key={String(idx)} closable>
              <div className="space-y-4 pt-2">
                <Field label="Tab name">
                  <Input value={src.tabName} onChange={e => setSource(idx, { tabName: e.target.value })} placeholder="e.g. Email 1" />
                </Field>
                <Field label="Content">
                  <TextArea
                    value={src.content}
                    onChange={e => setSource(idx, { content: e.target.value })}
                    autoSize={{ minRows: 4, maxRows: 12 }}
                    placeholder="Paste / type the source text content."
                  />
                </Field>
                <Field label="Images & tables">
                  <ArtifactEditor
                    artifact={{ imageUrls: src.imageUrls, tablesHtml: src.tablesHtml, description: '' }}
                    onChange={a => setSource(idx, { imageUrls: a.imageUrls, tablesHtml: a.tablesHtml })}
                  />
                </Field>
              </div>
            </TabPane>
          ))}
        </Tabs>
      </Section>

      <Section
        title={`Sub-questions · ${subs.length}`}
        description="3 sub-questions is typical. Mix MC and Yes/No as needed."
        actions={
          <Button size="small" icon={<PlusOutlined {...iconProps} />} onClick={addSub}>
            Add sub-question
          </Button>
        }
      >
        <div className="space-y-3">
          {subs.map((sub, idx) => (
            <div key={sub.questionId} className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 bg-gradient-to-r from-purple-50/60 to-fuchsia-50/40">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-purple-500 text-white text-xs font-bold">
                    Q{idx + 1}
                  </span>
                  <Select<'multiple_choice' | 'yes_no_table'>
                    size="small"
                    value={sub.questionType === 'two_part_analysis' ? 'multiple_choice' : sub.questionType}
                    onChange={(t) => switchSubType(idx, t)}
                    options={[
                      { value: 'multiple_choice', label: 'Multiple Choice' },
                      { value: 'yes_no_table', label: 'Yes/No table' }
                    ]}
                    style={{ minWidth: 180 }}
                  />
                </div>
                <Button danger size="small" icon={<DeleteOutlined {...iconProps} />} onClick={() => removeSub(idx)} />
              </div>
              <div className="p-4 space-y-3">
                <TextArea
                  value={sub.questionText}
                  onChange={e => setSub(idx, { questionText: e.target.value })}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  placeholder="Sub-question text"
                />

                {sub.questionType === 'multiple_choice' && (
                  <div className="space-y-2">
                    {(sub.options || []).map((opt, oi) => {
                      const isCorrect = sub.correctMC === opt.value;
                      return (
                        <div key={oi} className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSub(idx, { correctMC: opt.value })}
                            className={`flex-shrink-0 w-9 h-9 rounded-lg text-sm font-bold transition-all ${
                              isCorrect
                                ? 'bg-emerald-500 text-white shadow-sm'
                                : 'bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700'
                            }`}
                          >
                            {opt.value}
                          </button>
                          <Input
                            value={opt.text}
                            onChange={e => {
                              const next = (sub.options || []).map((o, j) => j === oi ? { ...o, text: e.target.value } : o);
                              setSub(idx, { options: next });
                            }}
                            placeholder={`Option ${opt.value}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {sub.questionType === 'yes_no_table' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        value={(sub.columnHeaders || ['', ''])[0]}
                        onChange={e => {
                          const ch: [string, string] = [...(sub.columnHeaders || ['', ''])] as [string, string];
                          ch[0] = e.target.value;
                          setSub(idx, { columnHeaders: ch });
                        }}
                        addonBefore="Col 1"
                      />
                      <Input
                        value={(sub.columnHeaders || ['', ''])[1]}
                        onChange={e => {
                          const ch: [string, string] = [...(sub.columnHeaders || ['', ''])] as [string, string];
                          ch[1] = e.target.value;
                          setSub(idx, { columnHeaders: ch });
                        }}
                        addonBefore="Col 2"
                      />
                    </div>
                    {(sub.statements || []).map((s, si) => (
                      <div key={si} className="flex items-start gap-2 p-2 rounded-xl bg-gray-50/70">
                        <div className="flex flex-col gap-1 min-w-[80px]">
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(sub.correctYesNo || [])];
                              next[si] = '0';
                              setSub(idx, { correctYesNo: next });
                            }}
                            className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                              (sub.correctYesNo || [])[si] === '0'
                                ? 'bg-emerald-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-emerald-50'
                            }`}
                          >
                            {(sub.columnHeaders || [])[0] || 'Col 1'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...(sub.correctYesNo || [])];
                              next[si] = '1';
                              setSub(idx, { correctYesNo: next });
                            }}
                            className={`text-[11px] font-semibold px-2 py-1 rounded-lg transition-colors ${
                              (sub.correctYesNo || [])[si] === '1'
                                ? 'bg-rose-500 text-white'
                                : 'bg-white border border-gray-200 text-gray-700 hover:bg-rose-50'
                            }`}
                          >
                            {(sub.columnHeaders || [])[1] || 'Col 2'}
                          </button>
                        </div>
                        <Input.TextArea
                          value={s.text}
                          autoSize={{ minRows: 1, maxRows: 3 }}
                          onChange={e => {
                            const next = (sub.statements || []).map((st, j) => j === si ? { text: e.target.value } : st);
                            setSub(idx, { statements: next });
                          }}
                          placeholder={`Statement ${si + 1}`}
                          className="flex-1"
                        />
                        <Button
                          danger
                          size="small"
                          icon={<DeleteOutlined {...iconProps} />}
                          onClick={() => {
                            const ns = (sub.statements || []).filter((_, j) => j !== si);
                            const nc = (sub.correctYesNo || []).filter((_, j) => j !== si);
                            setSub(idx, { statements: ns, correctYesNo: nc });
                          }}
                        />
                      </div>
                    ))}
                    <Button
                      size="small"
                      icon={<PlusOutlined {...iconProps} />}
                      onClick={() => {
                        const ns = [...(sub.statements || []), { text: '' }];
                        const nc = [...(sub.correctYesNo || []), ''];
                        setSub(idx, { statements: ns, correctYesNo: nc });
                      }}
                    >
                      Add statement
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
};

export default MSRForm;
