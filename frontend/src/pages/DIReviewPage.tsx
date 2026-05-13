import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getQuestionBagV3, getV3QuestionStats, updateQuestionBagV3, deleteQuestionBagV3 } from '../services/api';
import { Question } from '../types/quiz';
import { Button, Card, Typography, Tag, Pagination, message, Input, Tabs, Collapse, Modal, Switch } from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined, CloseOutlined, LinkOutlined, PlusOutlined, MinusCircleOutlined, LockOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import QuestionCard from '../components/QuestionCard';
import { useRoleAccess } from '../hooks/useRoleAccess';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Panel } = Collapse;

// Icon wrappers (same pattern as ReviewPage)
const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => (
  <span className="mr-2">{visible ? '\uD83D\uDC41\uFE0F' : '\uD83D\uDC41\uFE0F'}</span>
);
const DeleteIcon = () => (
  <span className="mr-2"><DeleteOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);
const EditIcon = () => (
  <span className="mr-2"><EditOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);
const SaveIcon = () => (
  <span className="mr-2"><SaveOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);
const CancelIcon = () => (
  <span className="mr-2"><CloseOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);
const LinkIcon = () => (
  <span className="mr-2"><LinkOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);
const PlusIcon = () => (
  <span className="mr-2"><PlusOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} /></span>
);

interface QueryParams {
  page: number;
  limit: number;
  questionType?: string;
  difficulty?: string;
  search?: string;
  // Tri-state. 'all' (or unset) = no filter. Sent to backend as
  // readyForQuiz=ready|notReady to gate the list view.
  readyForQuiz?: 'all' | 'ready' | 'notReady';
}

interface DIQuestionBagResponse {
  questions: Question[];
  total: number;
  currentPage: number;
  totalPages: number;
}

interface TypeStat {
  _id: string;
  count: number;
}

// Color mapping for DI question types
const typeColors: Record<string, string> = {
  'DI-DS': 'blue',
  'DI-GT': 'teal',
  'DI-MSR': 'purple',
  'DI-TPA': 'orange',
};

const typeLabels: Record<string, string> = {
  'DI-DS': 'Data Sufficiency',
  'DI-GT': 'Graphs & Tables',
  'DI-MSR': 'Multi-Source Reasoning',
  'DI-TPA': 'Two-Part Analysis',
};

const DIReviewPage: React.FC = () => {
  const { isAdmin } = useRoleAccess();
  const queryClient = useQueryClient();

  const [queryParams, setQueryParams] = useState<QueryParams>({ page: 1, limit: 10 });
  const [searchInput, setSearchInput] = useState('');
  const [visibleAnswers, setVisibleAnswers] = useState<Record<string, boolean>>({});
  const [isDeleting, setIsDeleting] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch questions
  const { data, isLoading, error } = useQuery<DIQuestionBagResponse>({
    queryKey: ['di-questions', queryParams],
    queryFn: () => getQuestionBagV3(queryParams as any),
  });

  // Fetch stats
  const { data: statsData } = useQuery<{ types: TypeStat[]; total: number }>({
    queryKey: ['di-question-stats'],
    queryFn: getV3QuestionStats,
  });

  // Access gate
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          <div className="text-center mb-8">
            <Title level={2} className="text-gray-800">DI Question Management</Title>
          </div>
          <div className="bg-gray-100 border border-gray-300 rounded-xl shadow-lg p-8">
            <div className="text-center">
              <div className="mb-6">
                <LockOutlined className="text-6xl text-gray-500" onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />
              </div>
              <Title level={3} className="text-gray-700 mb-4">Access Restricted</Title>
              <Text className="text-lg text-gray-600 block mb-6">
                DI Question Bank access is restricted to administrators only.
              </Text>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <UserOutlined className="text-blue-500 mt-1 mr-3 text-lg" onPointerEnterCapture={undefined} onPointerLeaveCapture={undefined} />
                  <div className="text-left">
                    <Text strong className="text-blue-800 block mb-2">Admin Only Feature</Text>
                    <Text className="text-blue-700 text-sm">
                      This section allows administrators to manage Data Insights questions, including DS, G&T, MSR, and TPA question types.
                    </Text>
                  </div>
                </div>
              </div>
              <Button
                type="primary"
                size="large"
                onClick={() => window.history.back()}
                className="bg-gray-600 hover:bg-gray-700 border-gray-600 hover:border-gray-700 px-8 py-2 h-auto rounded-xl text-white hover:text-white"
              >
                Go Back
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Handlers ---

  const toggleAnswer = (id: string) => {
    setVisibleAnswers(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
    setVisibleAnswers({});
    window.scrollTo(0, 0);
  };

  const handleSearch = () => {
    setQueryParams(prev => ({ ...prev, page: 1, search: searchInput || undefined }));
    setVisibleAnswers({});
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: 'Delete Question',
      content: 'Are you sure you want to delete this question? This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        setIsDeleting(prev => ({ ...prev, [id]: true }));
        try {
          await deleteQuestionBagV3(id);
          message.success('Question deleted successfully');
          queryClient.invalidateQueries({ queryKey: ['di-questions'] });
          queryClient.invalidateQueries({ queryKey: ['di-question-stats'] });
        } catch (err) {
          console.error('Error deleting question:', err);
          message.error('Failed to delete question.');
        } finally {
          setIsDeleting(prev => ({ ...prev, [id]: false }));
        }
      },
    });
  };

  const startEditing = (question: any) => {
    // Deep clone to avoid mutating original
    const clone = JSON.parse(JSON.stringify(question));
    setEditingId(question._id);
    setEditData(clone);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditData(null);
  };

  const saveQuestion = async () => {
    if (!editingId || !editData) return;
    setIsSaving(true);
    try {
      // Build update payload based on type
      const payload: any = {
        questionText: editData.questionText,
        explanation: editData.explanation || '',
        readyForQuiz: !!editData.readyForQuiz,
        // Preserve sibling metadata (e.g., DS statement1/2) by spreading the
        // doc's existing metadata before overwriting topic / subtopic.
        metadata: {
          ...(editData.metadata || {}),
          topic: editData.metadata?.topic || '',
          subtopic: editData.metadata?.subtopic || '',
        },
      };

      if (editData.questionType === 'DI-DS') {
        // Convert options array back to object
        const optionsObj: Record<string, string> = {};
        (editData.options || []).forEach((opt: string, i: number) => {
          optionsObj[String.fromCharCode(65 + i)] = opt;
        });
        payload.options = optionsObj;
        payload.correctAnswer = editData.correctAnswer;
      }

      if (editData.questionType === 'DI-GT') {
        const optionsObj: Record<string, string> = {};
        (editData.options || []).forEach((opt: string, i: number) => {
          optionsObj[String.fromCharCode(65 + i)] = opt;
        });
        payload.options = optionsObj;
        payload.correctAnswer = editData.correctAnswer;
        payload.artifactDescription = editData.artifactDescription || '';
        payload.artifactImages = editData.artifactImages || [];
        payload.artifactTables = editData.artifactTables || [];
      }

      if (editData.questionType === 'DI-MSR') {
        payload.msrSources = editData.msrSources || [];
        payload.subQuestions = editData.subQuestions || [];
      }

      if (editData.questionType === 'DI-TPA') {
        payload.subQuestions = editData.subQuestions || [];
      }

      await updateQuestionBagV3(editingId, payload);
      message.success('Question updated successfully');
      queryClient.invalidateQueries({ queryKey: ['di-questions'] });
      cancelEditing();
    } catch (err) {
      console.error('Error updating question:', err);
      message.error('Failed to update question.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Edit form renderers ---

  const renderDSEditor = () => {
    if (!editData) return null;
    const options: string[] = editData.options || [];
    while (options.length < 5) options.push('');

    return (
      <div className="space-y-6 bg-white rounded-md p-4">
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
          <TextArea
            value={editData.questionText}
            onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
            rows={4}
          />
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center mb-3 bg-gray-50 p-2 rounded">
              <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-2">
                {String.fromCharCode(65 + i)}
              </div>
              <Input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...options];
                  newOpts[i] = e.target.value;
                  setEditData({ ...editData, options: newOpts });
                }}
                className="flex-1"
              />
              <input
                type="radio"
                checked={editData.correctAnswer === String.fromCharCode(65 + i)}
                onChange={() => setEditData({ ...editData, correctAnswer: String.fromCharCode(65 + i) })}
                className="ml-2"
              />
              <span className="ml-1 text-xs text-gray-500">Correct</span>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
          <TextArea
            value={editData.explanation || ''}
            onChange={(e) => setEditData({ ...editData, explanation: e.target.value })}
            rows={4}
          />
        </div>
      </div>
    );
  };

  const renderGTEditor = () => {
    if (!editData) return null;
    const options: string[] = editData.options || [];
    const images: string[] = editData.artifactImages || [];
    const tables: string[] = editData.artifactTables || [];

    return (
      <div className="space-y-6 bg-white rounded-md p-4">
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
          <TextArea
            value={editData.questionText}
            onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
            rows={4}
          />
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Artifact Description</label>
          <TextArea
            value={editData.artifactDescription || ''}
            onChange={(e) => setEditData({ ...editData, artifactDescription: e.target.value })}
            rows={2}
          />
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Images (URLs)</label>
          {images.map((url: string, i: number) => (
            <div key={i} className="flex items-center mb-2 gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  const newImgs = [...images];
                  newImgs[i] = e.target.value;
                  setEditData({ ...editData, artifactImages: newImgs });
                }}
                placeholder="Image URL"
                className="flex-1"
              />
              {url && (
                <img src={url} alt={`Preview ${i + 1}`} className="w-16 h-16 object-cover rounded border" />
              )}
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                onClick={() => {
                  const newImgs = images.filter((_: string, idx: number) => idx !== i);
                  setEditData({ ...editData, artifactImages: newImgs });
                }}
              />
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => setEditData({ ...editData, artifactImages: [...images, ''] })}
            icon={<PlusIcon />}
            className="w-full mt-1"
          >
            Add Image URL
          </Button>
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Tables (HTML)</label>
          {tables.map((html: string, i: number) => (
            <div key={i} className="mb-4">
              <div className="mb-2 p-2 bg-gray-50 rounded border overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
              <TextArea
                value={html}
                onChange={(e) => {
                  const newTables = [...tables];
                  newTables[i] = e.target.value;
                  setEditData({ ...editData, artifactTables: newTables });
                }}
                rows={3}
                placeholder="HTML table content"
              />
              <Button
                type="text"
                danger
                className="mt-1"
                icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                onClick={() => {
                  const newTables = tables.filter((_: string, idx: number) => idx !== i);
                  setEditData({ ...editData, artifactTables: newTables });
                }}
              >
                Remove Table
              </Button>
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => setEditData({ ...editData, artifactTables: [...tables, ''] })}
            icon={<PlusIcon />}
            className="w-full mt-1"
          >
            Add Table
          </Button>
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
          {options.map((opt: string, i: number) => (
            <div key={i} className="flex items-center mb-3 bg-gray-50 p-2 rounded">
              <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-2">
                {String.fromCharCode(65 + i)}
              </div>
              <Input
                value={opt}
                onChange={(e) => {
                  const newOpts = [...options];
                  newOpts[i] = e.target.value;
                  setEditData({ ...editData, options: newOpts });
                }}
                className="flex-1"
              />
              <input
                type="radio"
                checked={editData.correctAnswer === String.fromCharCode(65 + i)}
                onChange={() => setEditData({ ...editData, correctAnswer: String.fromCharCode(65 + i) })}
                className="ml-2"
              />
              <span className="ml-1 text-xs text-gray-500">Correct</span>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
          <TextArea
            value={editData.explanation || ''}
            onChange={(e) => setEditData({ ...editData, explanation: e.target.value })}
            rows={4}
          />
        </div>
      </div>
    );
  };

  const renderMSREditor = () => {
    if (!editData) return null;
    const sources = editData.msrSources || [];
    const subQuestions = editData.subQuestions || [];

    return (
      <div className="space-y-6 bg-white rounded-md p-4">
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
          <TextArea
            value={editData.questionText}
            onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
            rows={3}
          />
        </div>

        {/* Sources editor */}
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sources (Tabs)</label>
          <Tabs type="card">
            {sources.map((source: any, sIdx: number) => (
              <TabPane tab={source.tabName || `Source ${sIdx + 1}`} key={String(sIdx)}>
                <div className="space-y-3 p-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tab Name</label>
                    <Input
                      value={source.tabName}
                      onChange={(e) => {
                        const newSources = [...sources];
                        newSources[sIdx] = { ...newSources[sIdx], tabName: e.target.value };
                        setEditData({ ...editData, msrSources: newSources });
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Content</label>
                    <TextArea
                      value={source.content}
                      onChange={(e) => {
                        const newSources = [...sources];
                        newSources[sIdx] = { ...newSources[sIdx], content: e.target.value };
                        setEditData({ ...editData, msrSources: newSources });
                      }}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Images</label>
                    {(source.images || []).map((img: any, iIdx: number) => (
                      <div key={iIdx} className="flex items-center gap-2 mb-2">
                        <Input
                          value={img.src}
                          onChange={(e) => {
                            const newSources = [...sources];
                            const newImages = [...(newSources[sIdx].images || [])];
                            newImages[iIdx] = { ...newImages[iIdx], src: e.target.value };
                            newSources[sIdx] = { ...newSources[sIdx], images: newImages };
                            setEditData({ ...editData, msrSources: newSources });
                          }}
                          placeholder="Image URL"
                          className="flex-1"
                        />
                        <Button
                          type="text"
                          danger
                          icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                          onClick={() => {
                            const newSources = [...sources];
                            const newImages = (newSources[sIdx].images || []).filter((_: any, idx: number) => idx !== iIdx);
                            newSources[sIdx] = { ...newSources[sIdx], images: newImages };
                            setEditData({ ...editData, msrSources: newSources });
                          }}
                        />
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      onClick={() => {
                        const newSources = [...sources];
                        const newImages = [...(newSources[sIdx].images || []), { src: '', alt: '' }];
                        newSources[sIdx] = { ...newSources[sIdx], images: newImages };
                        setEditData({ ...editData, msrSources: newSources });
                      }}
                      icon={<PlusIcon />}
                    >
                      Add Image
                    </Button>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Tables (HTML)</label>
                    {(source.tables || []).map((table: any, tIdx: number) => (
                      <div key={tIdx} className="mb-2">
                        <div className="mb-1 p-1 bg-gray-50 rounded border overflow-x-auto text-sm" dangerouslySetInnerHTML={{ __html: table.html }} />
                        <TextArea
                          value={table.html}
                          onChange={(e) => {
                            const newSources = [...sources];
                            const newTables = [...(newSources[sIdx].tables || [])];
                            newTables[tIdx] = { ...newTables[tIdx], html: e.target.value };
                            newSources[sIdx] = { ...newSources[sIdx], tables: newTables };
                            setEditData({ ...editData, msrSources: newSources });
                          }}
                          rows={2}
                        />
                        <Button
                          type="text"
                          danger
                          size="small"
                          className="mt-1"
                          icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                          onClick={() => {
                            const newSources = [...sources];
                            const newTables = (newSources[sIdx].tables || []).filter((_: any, idx: number) => idx !== tIdx);
                            newSources[sIdx] = { ...newSources[sIdx], tables: newTables };
                            setEditData({ ...editData, msrSources: newSources });
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="dashed"
                      size="small"
                      onClick={() => {
                        const newSources = [...sources];
                        const newTables = [...(newSources[sIdx].tables || []), { html: '' }];
                        newSources[sIdx] = { ...newSources[sIdx], tables: newTables };
                        setEditData({ ...editData, msrSources: newSources });
                      }}
                      icon={<PlusIcon />}
                    >
                      Add Table
                    </Button>
                  </div>
                </div>
              </TabPane>
            ))}
          </Tabs>
        </div>

        {/* Sub-questions editor */}
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Sub-Questions</label>
          <Collapse>
            {subQuestions.map((sq: any, sqIdx: number) => (
              <Panel
                header={`Sub-Question ${sqIdx + 1}: ${sq.questionType} - ${(sq.questionText || '').substring(0, 60)}...`}
                key={String(sqIdx)}
              >
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Question Text</label>
                    <TextArea
                      value={sq.questionText}
                      onChange={(e) => {
                        const newSQs = [...subQuestions];
                        newSQs[sqIdx] = { ...newSQs[sqIdx], questionText: e.target.value };
                        setEditData({ ...editData, subQuestions: newSQs });
                      }}
                      rows={2}
                    />
                  </div>

                  {sq.questionType === 'yes_no_table' && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Column Headers</label>
                        <div className="flex gap-2">
                          {(sq.columnHeaders || ['Yes', 'No']).map((header: string, hIdx: number) => (
                            <Input
                              key={hIdx}
                              value={header}
                              onChange={(e) => {
                                const newSQs = [...subQuestions];
                                const newHeaders = [...(newSQs[sqIdx].columnHeaders || ['Yes', 'No'])];
                                newHeaders[hIdx] = e.target.value;
                                newSQs[sqIdx] = { ...newSQs[sqIdx], columnHeaders: newHeaders };
                                setEditData({ ...editData, subQuestions: newSQs });
                              }}
                              className="w-32"
                            />
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Statements</label>
                        {(sq.statements || []).map((stmt: any, stIdx: number) => (
                          <div key={stIdx} className="flex items-center gap-2 mb-2">
                            <Input
                              value={stmt.text}
                              onChange={(e) => {
                                const newSQs = [...subQuestions];
                                const newStmts = [...(newSQs[sqIdx].statements || [])];
                                newStmts[stIdx] = { ...newStmts[stIdx], text: e.target.value };
                                newSQs[sqIdx] = { ...newSQs[sqIdx], statements: newStmts };
                                setEditData({ ...editData, subQuestions: newSQs });
                              }}
                              className="flex-1"
                            />
                            <Button
                              type="text"
                              danger
                              icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                              onClick={() => {
                                const newSQs = [...subQuestions];
                                const newStmts = (newSQs[sqIdx].statements || []).filter((_: any, idx: number) => idx !== stIdx);
                                newSQs[sqIdx] = { ...newSQs[sqIdx], statements: newStmts };
                                setEditData({ ...editData, subQuestions: newSQs });
                              }}
                            />
                          </div>
                        ))}
                        <Button
                          type="dashed"
                          size="small"
                          onClick={() => {
                            const newSQs = [...subQuestions];
                            const newStmts = [...(newSQs[sqIdx].statements || []), { text: '' }];
                            newSQs[sqIdx] = { ...newSQs[sqIdx], statements: newStmts };
                            setEditData({ ...editData, subQuestions: newSQs });
                          }}
                          icon={<PlusIcon />}
                        >
                          Add Statement
                        </Button>
                      </div>
                    </>
                  )}

                  {sq.questionType === 'multiple_choice' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Options</label>
                      {(sq.options || []).map((opt: any, oIdx: number) => (
                        <div key={oIdx} className="flex items-center gap-2 mb-2">
                          <Input
                            value={opt.value}
                            onChange={(e) => {
                              const newSQs = [...subQuestions];
                              const newOpts = [...(newSQs[sqIdx].options || [])];
                              newOpts[oIdx] = { ...newOpts[oIdx], value: e.target.value };
                              newSQs[sqIdx] = { ...newSQs[sqIdx], options: newOpts };
                              setEditData({ ...editData, subQuestions: newSQs });
                            }}
                            className="w-16"
                            placeholder="Value"
                          />
                          <Input
                            value={opt.text}
                            onChange={(e) => {
                              const newSQs = [...subQuestions];
                              const newOpts = [...(newSQs[sqIdx].options || [])];
                              newOpts[oIdx] = { ...newOpts[oIdx], text: e.target.value };
                              newSQs[sqIdx] = { ...newSQs[sqIdx], options: newOpts };
                              setEditData({ ...editData, subQuestions: newSQs });
                            }}
                            className="flex-1"
                            placeholder="Option text"
                          />
                          <input
                            type="radio"
                            checked={sq.correctAnswer === opt.value}
                            onChange={() => {
                              const newSQs = [...subQuestions];
                              newSQs[sqIdx] = { ...newSQs[sqIdx], correctAnswer: opt.value };
                              setEditData({ ...editData, subQuestions: newSQs });
                            }}
                          />
                          <span className="text-xs text-gray-500">Correct</span>
                          <Button
                            type="text"
                            danger
                            icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                            onClick={() => {
                              const newSQs = [...subQuestions];
                              const newOpts = (newSQs[sqIdx].options || []).filter((_: any, idx: number) => idx !== oIdx);
                              newSQs[sqIdx] = { ...newSQs[sqIdx], options: newOpts };
                              setEditData({ ...editData, subQuestions: newSQs });
                            }}
                          />
                        </div>
                      ))}
                      <Button
                        type="dashed"
                        size="small"
                        onClick={() => {
                          const newSQs = [...subQuestions];
                          const newOpts = [...(newSQs[sqIdx].options || []), { value: '', text: '' }];
                          newSQs[sqIdx] = { ...newSQs[sqIdx], options: newOpts };
                          setEditData({ ...editData, subQuestions: newSQs });
                        }}
                        icon={<PlusIcon />}
                      >
                        Add Option
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            ))}
          </Collapse>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
          <TextArea
            value={editData.explanation || ''}
            onChange={(e) => setEditData({ ...editData, explanation: e.target.value })}
            rows={4}
          />
        </div>
      </div>
    );
  };

  const renderTPAEditor = () => {
    if (!editData) return null;
    const subQuestions = editData.subQuestions || [];
    const tpaQ = subQuestions[0] || { questionId: '', questionText: '', questionType: 'two_part_analysis', columnHeaders: ['Part 1', 'Part 2'], rowOptions: [], correctAnswer: [] };

    const updateTPA = (updates: any) => {
      const newSQs = [...subQuestions];
      newSQs[0] = { ...tpaQ, ...updates };
      setEditData({ ...editData, subQuestions: newSQs });
    };

    return (
      <div className="space-y-6 bg-white rounded-md p-4">
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
          <TextArea
            value={editData.questionText}
            onChange={(e) => setEditData({ ...editData, questionText: e.target.value })}
            rows={4}
          />
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Column Headers</label>
          <div className="flex gap-2">
            {(tpaQ.columnHeaders || ['Part 1', 'Part 2']).map((header: string, hIdx: number) => (
              <Input
                key={hIdx}
                value={header}
                onChange={(e) => {
                  const newHeaders = [...(tpaQ.columnHeaders || ['Part 1', 'Part 2'])];
                  newHeaders[hIdx] = e.target.value;
                  updateTPA({ columnHeaders: newHeaders });
                }}
                className="w-48"
                placeholder={`Column ${hIdx + 1}`}
              />
            ))}
          </div>
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Row Options</label>
          {(tpaQ.rowOptions || []).map((opt: string, rIdx: number) => (
            <div key={rIdx} className="flex items-center gap-2 mb-2">
              <Input
                value={opt}
                onChange={(e) => {
                  const newRows = [...(tpaQ.rowOptions || [])];
                  newRows[rIdx] = e.target.value;
                  updateTPA({ rowOptions: newRows });
                }}
                className="flex-1"
              />
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />}
                onClick={() => {
                  const newRows = (tpaQ.rowOptions || []).filter((_: string, idx: number) => idx !== rIdx);
                  updateTPA({ rowOptions: newRows });
                }}
              />
            </div>
          ))}
          <Button
            type="dashed"
            onClick={() => {
              const newRows = [...(tpaQ.rowOptions || []), ''];
              updateTPA({ rowOptions: newRows });
            }}
            icon={<PlusIcon />}
            className="w-full mt-1"
          >
            Add Row Option
          </Button>
        </div>
        <div className="border-b pb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Correct Answers</label>
          <div className="flex gap-4">
            {(tpaQ.columnHeaders || ['Part 1', 'Part 2']).map((header: string, cIdx: number) => (
              <div key={cIdx}>
                <label className="block text-xs text-gray-500 mb-1">{header}</label>
                <select
                  value={(tpaQ.correctAnswer || [])[cIdx] || ''}
                  onChange={(e) => {
                    const newCorrect = [...(tpaQ.correctAnswer || [])];
                    newCorrect[cIdx] = e.target.value;
                    updateTPA({ correctAnswer: newCorrect });
                  }}
                  className="border rounded p-2"
                >
                  <option value="">Select...</option>
                  {(tpaQ.rowOptions || []).map((opt: string, rIdx: number) => (
                    <option key={rIdx} value={String(rIdx)}>{opt}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
          <TextArea
            value={editData.explanation || ''}
            onChange={(e) => setEditData({ ...editData, explanation: e.target.value })}
            rows={4}
          />
        </div>
      </div>
    );
  };

  // Topic / sub-topic / readyForQuiz block rendered after every type-specific
  // editor, so the field surface area is the same regardless of question type.
  const renderCommonMetaEditor = () => {
    if (!editData) return null;
    return (
      <div className="bg-white rounded-md p-4 mt-4 border-t pt-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
            <Input
              value={editData.metadata?.topic || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  metadata: { ...(editData.metadata || {}), topic: e.target.value },
                })
              }
              placeholder="e.g. Tables, Graphs, Inference"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Sub-topic</label>
            <Input
              value={editData.metadata?.subtopic || ''}
              onChange={(e) =>
                setEditData({
                  ...editData,
                  metadata: { ...(editData.metadata || {}), subtopic: e.target.value },
                })
              }
              placeholder="e.g. Bar charts, MSR sub-question 1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={!!editData.readyForQuiz}
            onChange={(checked) => setEditData({ ...editData, readyForQuiz: checked })}
          />
          <div>
            <div className="text-sm font-medium text-gray-700">Ready for Quiz</div>
            <div className="text-xs text-gray-500">
              When on, this question is eligible for quizzes that opt in to the
              ready-only filter. Off by default.
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderEditForm = (question: Question) => {
    const type = question.questionType;
    let body: React.ReactNode;
    if (type === 'DI-DS') body = renderDSEditor();
    else if (type === 'DI-GT') body = renderGTEditor();
    else if (type === 'DI-MSR') body = renderMSREditor();
    else if (type === 'DI-TPA') body = renderTPAEditor();
    else body = renderDSEditor(); // fallback
    return (
      <>
        {body}
        {renderCommonMetaEditor()}
      </>
    );
  };

  // --- Card renderer ---

  const renderQuestion = (question: Question) => {
    const isEditing = editingId === question._id;

    return (
      <Card
        className="shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-lg overflow-hidden mb-8"
        bodyStyle={{ padding: 0 }}
      >
        {/* Header */}
        <div className="bg-gray-50 border-b border-gray-200 p-4">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex flex-wrap gap-2 mb-2">
                <Tag color={typeColors[question.questionType] || 'default'} className="text-sm">
                  {typeLabels[question.questionType] || question.questionType}
                </Tag>
                <Tag color="orange" className="text-sm">
                  Difficulty: {question.difficulty || 'N/A'}
                </Tag>
                {question.source && (
                  <Tag color="geekblue" className="text-sm">Source: {question.source}</Tag>
                )}
                {(question as any).readyForQuiz && (
                  <Tag color="success" className="text-sm">Ready for Quiz</Tag>
                )}
                {(question as any).metadata?.topic && (
                  <Tag color="purple" className="text-sm">
                    {(question as any).metadata.topic}
                    {(question as any).metadata.subtopic
                      ? ` › ${(question as any).metadata.subtopic}`
                      : ''}
                  </Tag>
                )}
                {question.sourceDetails?.url && (
                  <a
                    href={question.sourceDetails.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <LinkIcon />
                  </a>
                )}
              </div>
            </div>
            <div className="space-x-2">
              {isEditing ? (
                <>
                  <Button
                    type="primary"
                    icon={<SaveIcon />}
                    onClick={saveQuestion}
                    loading={isSaving}
                    disabled={isSaving}
                  >
                    Save
                  </Button>
                  <Button
                    icon={<CancelIcon />}
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="default"
                    icon={<EditIcon />}
                    onClick={() => startEditing(question)}
                    disabled={!!editingId}
                  >
                    Edit
                  </Button>
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteIcon />}
                    onClick={() => handleDelete(question._id)}
                    loading={isDeleting[question._id]}
                    disabled={isDeleting[question._id] || !!editingId}
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {isEditing ? (
            renderEditForm(question)
          ) : (
            <div className="question-container">
              <QuestionCard
                question={question}
                showAnswer={visibleAnswers[question._id]}
                correctAnswer={question.correctAnswer}
                explanation={question.explanation}
              />
            </div>
          )}

          {/* Footer */}
          {!isEditing && (
            <div className="flex justify-between items-center pt-2 mt-4 border-t border-gray-100 p-4 bg-gray-50">
              <Button
                type="primary"
                ghost
                onClick={() => toggleAnswer(question._id)}
                className="flex items-center"
              >
                <span className="inline-flex items-center">
                  <EyeIcon visible={visibleAnswers[question._id]} />
                  {visibleAnswers[question._id] ? 'Hide Answer' : 'Show Answer'}
                </span>
              </Button>
              {visibleAnswers[question._id] && question.correctAnswer && (
                <div className="flex items-center">
                  <div className="mr-2 text-green-600 font-semibold">Correct Answer:</div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
                    {question.correctAnswer}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  };

  // --- Filter options ---
  const filterOptions = {
    questionType: [
      { text: 'DI - Data Sufficiency', value: 'DI-DS' },
      { text: 'DI - Graphs & Tables', value: 'DI-GT' },
      { text: 'DI - Multi-Source Reasoning', value: 'DI-MSR' },
      { text: 'DI - Two-Part Analysis', value: 'DI-TPA' },
    ],
    difficulty: [
      { text: 'Easy', value: 'Easy' },
      { text: 'Medium', value: 'Medium' },
      { text: 'Hard', value: 'Hard' },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        {/* Title + Stats */}
        <div className="flex justify-between items-center mb-6">
          <Title level={2}>Question Bank DI</Title>
          <div className="flex items-center gap-3 flex-wrap">
            {statsData && (
              <>
                <div className="flex items-center bg-gray-100 px-4 py-2 rounded-lg">
                  <Text strong className="text-lg">{statsData.total}</Text>
                  <Text className="ml-2">Total Questions</Text>
                </div>
                {statsData.types.map((t) => (
                  <Tag key={t._id} color={typeColors[t._id] || 'default'} className="text-sm py-1 px-3">
                    {t._id}: {t.count}
                  </Tag>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-gray-50 p-4 rounded-lg mb-6 shadow-sm">
          <div className="flex flex-row items-center space-x-4 flex-wrap gap-y-2">
            <div className="flex items-center">
              <Input
                placeholder="Search question text..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onPressEnter={handleSearch}
                className="w-64"
                allowClear
              />
              <Button type="primary" onClick={handleSearch} className="ml-2">
                Search
              </Button>
            </div>
            <div className="flex items-center">
              <label className="mr-2 text-gray-600">Type:</label>
              <select
                className="border rounded p-2"
                value={queryParams.questionType || ''}
                onChange={(e) => {
                  setQueryParams(prev => ({
                    ...prev,
                    questionType: e.target.value || undefined,
                    page: 1,
                  }));
                  setVisibleAnswers({});
                }}
              >
                <option value="">All</option>
                {filterOptions.questionType.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.text}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <label className="mr-2 text-gray-600">Difficulty:</label>
              <select
                className="border rounded p-2"
                value={queryParams.difficulty || ''}
                onChange={(e) => {
                  setQueryParams(prev => ({
                    ...prev,
                    difficulty: e.target.value || undefined,
                    page: 1,
                  }));
                  setVisibleAnswers({});
                }}
              >
                <option value="">All</option>
                {filterOptions.difficulty.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.text}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center">
              <label className="mr-2 text-gray-600">Ready:</label>
              <select
                className="border rounded p-2"
                value={queryParams.readyForQuiz || 'all'}
                onChange={(e) => {
                  const value = e.target.value as 'all' | 'ready' | 'notReady';
                  setQueryParams(prev => ({
                    ...prev,
                    readyForQuiz: value === 'all' ? undefined : value,
                    page: 1,
                  }));
                  setVisibleAnswers({});
                }}
              >
                <option value="all">All</option>
                <option value="ready">Ready for Quiz</option>
                <option value="notReady">Not Ready</option>
              </select>
            </div>
            <Button
              onClick={() => {
                setQueryParams({ page: 1, limit: 10 });
                setSearchInput('');
                setVisibleAnswers({});
              }}
              danger
              type="primary"
              className="hover:opacity-90 transition-opacity"
            >
              Clear Filters
            </Button>
          </div>
        </div>
      </div>

      {/* Question list */}
      {isLoading ? (
        <div className="text-center py-8">Loading questions...</div>
      ) : error ? (
        <div className="text-center text-red-500 mt-4">
          Error loading questions. Please try again later.
        </div>
      ) : (
        <>
          {data?.questions && data.questions.length > 0 ? (
            <>
              <div className="space-y-6">
                {data.questions.map((question) => (
                  <div key={question._id}>
                    {renderQuestion(question)}
                  </div>
                ))}
              </div>

              <div className="flex justify-center mt-8 mb-4">
                <Pagination
                  current={queryParams.page}
                  pageSize={queryParams.limit}
                  total={data.total || 0}
                  onChange={handlePageChange}
                  showSizeChanger={false}
                  showQuickJumper
                  showTotal={(total) => `Total ${total} questions`}
                  className="flex items-center space-x-2"
                  itemRender={(page, type, originalElement) => {
                    if (type === 'page' && page === queryParams.page) {
                      return (
                        <div className="bg-purple-500 text-white rounded px-3 py-1 font-bold">
                          {page}
                        </div>
                      );
                    }
                    if (type === 'page') {
                      return (
                        <div className="px-3 py-1 hover:bg-gray-100 rounded">
                          {page}
                        </div>
                      );
                    }
                    return originalElement;
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-center py-8 bg-white shadow-md rounded-lg">
              <div className="text-gray-500 text-lg">No DI questions found matching your filters.</div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default DIReviewPage;
