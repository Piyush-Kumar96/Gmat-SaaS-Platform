import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getQuestionBagV2, deleteQuestionBagItem, updateQuestionBagV2, createQuestionBagItem } from '../services/api';
import { Question } from '../types/quiz';
import { Button, Card, Typography, Space, Tag, Pagination, Collapse, message, Form, Input, Radio, Tooltip, Modal, Select, Divider, Switch, Alert, Result } from 'antd';
import { DeleteOutlined, EditOutlined, SaveOutlined, CloseOutlined, LinkOutlined, PlusOutlined, FileAddOutlined, LockOutlined, UserOutlined, FileTextOutlined } from '@ant-design/icons';
import QuestionCard from '../components/QuestionCard';
import { useRoleAccess } from '../hooks/useRoleAccess';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;
const { TextArea } = Input;
const { Option } = Select;

// Use text labels instead of icons to avoid TypeScript errors
const EyeIcon: React.FC<{ visible: boolean }> = ({ visible }) => (
  <span className="mr-2">
    {visible ? '👁️' : '👁️'}
  </span>
);

// Custom DeleteIcon to avoid TypeScript errors
const DeleteIcon = () => (
  <span className="mr-2">
    <DeleteOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add EditIcon component
const EditIcon = () => (
  <span className="mr-2">
    <EditOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add SaveIcon component
const SaveIcon = () => (
  <span className="mr-2">
    <SaveOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add CancelIcon component
const CancelIcon = () => (
  <span className="mr-2">
    <CloseOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add LinkIcon component to match other icon components
const LinkIcon = () => (
  <span className="mr-2">
    <LinkOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add PlusIcon component to match the other icons
const PlusIcon = () => (
  <span className="mr-2">
    <PlusOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

// Add FileAddIcon component
const FileAddIcon = () => (
  <span className="mr-2">
    <FileAddOutlined onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  </span>
);

interface QueryParams {
  page: number;
  limit: number;
  category?: string;
  questionType?: string;
  difficulty?: number;
  search?: string;
  // Tri-state. 'all' (or unset) = no filter. Sent to the backend as
  // readyForQuiz=ready|notReady to gate the question-bank list view so an
  // admin can sweep through "needs review" docs.
  readyForQuiz?: 'all' | 'ready' | 'notReady';
}

interface QuestionBagResponse {
  questions: Question[];
  total: number;
  page: number;
  totalPages: number;
}

interface EditingQuestion {
  _id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  statement1?: string;
  statement2?: string;
  questionType?: string;
  /** CR argument or RC passage. The DB column is `passageText` for both. */
  passageText?: string;
  /** Editor flag: when on, the question is eligible for the opt-in quiz filter. */
  readyForQuiz?: boolean;
  topic?: string;
  subtopic?: string;
  /** Original metadata snapshot. Merged on save so DS statement1/2 and
   *  CR argument / RC passage stored under metadata aren't blown away. */
  originalMetadata?: Record<string, any>;
}

// New Question interface for creating a new question
interface NewQuestion {
  questionText: string;
  options: Record<string, string>;
  correctAnswer: string;
  explanation: string;
  questionType: string;
  category: string;
  difficulty: number;
  passage?: string;
  metadata?: {
    statement1?: string;
    statement2?: string;
  };
}

const ReviewPage: React.FC = () => {
  const { isAdmin } = useRoleAccess();
  
  // All hooks must be called before any conditional returns
  const [queryParams, setQueryParams] = useState<QueryParams>({
    page: 1,
    limit: 10,
  });
  const [visibleAnswers, setVisibleAnswers] = useState<{ [key: string]: boolean }>({});
  const [searchInput, setSearchInput] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<{ [key: string]: boolean }>({});
  const [editingQuestion, setEditingQuestion] = useState<EditingQuestion | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isAddingQuestion, setIsAddingQuestion] = useState<boolean>(false);
  const [newQuestion, setNewQuestion] = useState<NewQuestion>({
    questionText: '',
    options: { A: '', B: '', C: '', D: '', E: '' },
    correctAnswer: 'A',
    explanation: '',
    questionType: 'Problem Solving',
    category: 'Quantitative Reasoning',
    difficulty: 2,
    passage: '',
    metadata: {}
  });
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [form] = Form.useForm();

  const queryClient = useQueryClient();

  // Use React Query for data fetching
  const { data, isLoading, error } = useQuery<QuestionBagResponse>({
    queryKey: ['questions', queryParams],
    queryFn: () => getQuestionBagV2(queryParams)
  });

  // If user is not admin, show improved access denied message
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="container mx-auto px-4 max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <Title level={2} className="text-gray-800">Question Management System</Title>
          </div>

          {/* Restricted Access Box */}
          <div className="bg-gray-100 border border-gray-300 rounded-xl shadow-lg p-8">
            <div className="text-center">
              {/* Lock Icon */}
              <div className="mb-6">
                <LockOutlined 
                  className="text-6xl text-gray-500" 
                  onPointerEnterCapture={undefined} 
                  onPointerLeaveCapture={undefined} 
                />
              </div>

              {/* Main Message */}
              <Title level={3} className="text-gray-700 mb-4">
                Access Restricted
              </Title>
              <Text className="text-lg text-gray-600 block mb-6">
                Question Bank access is restricted to administrators only.
              </Text>

              {/* Admin Info Alert */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <UserOutlined 
                    className="text-blue-500 mt-1 mr-3 text-lg" 
                    onPointerEnterCapture={undefined} 
                    onPointerLeaveCapture={undefined} 
                  />
                  <div className="text-left">
                    <Text strong className="text-blue-800 block mb-2">
                      Admin Only Feature
                    </Text>
                    <Text className="text-blue-700 text-sm">
                      This section allows administrators to manage the question database, including adding, editing, and reviewing questions. Regular users will have access to a personalized review section in the future.
                    </Text>
                  </div>
                </div>
              </div>

              {/* Coming Soon Section */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <FileTextOutlined 
                    className="text-green-500 mt-1 mr-3 text-lg" 
                    onPointerEnterCapture={undefined} 
                    onPointerLeaveCapture={undefined} 
                  />
                  <div className="text-left">
                    <Text strong className="text-green-800 block mb-2">
                      Coming Soon: Personal Review Section
                    </Text>
                    <Text className="text-green-700 text-sm block mb-3">
                      We're working on a personalized review area where you'll be able to:
                    </Text>
                    <ul className="text-sm text-green-700 space-y-1 text-left">
                      <li className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                        Review all questions you've attempted
                      </li>
                      <li className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                        Revisit your mistakes and learn from them
                      </li>
                      <li className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                        Track your progress over time
                      </li>
                      <li className="flex items-center">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></span>
                        Focus on areas that need improvement
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Action Button */}
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

  const toggleAnswer = (questionId: string) => {
    setVisibleAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handlePageChange = (page: number) => {
    setQueryParams(prev => ({ ...prev, page }));
    // Reset visible answers when changing pages
    setVisibleAnswers({});
    // Scroll to top
    window.scrollTo(0, 0);
  };

  // Delete question without confirmation
  const handleDelete = async (questionId: string) => {
    setIsDeleting(prev => ({ ...prev, [questionId]: true }));
    
    try {
      await deleteQuestionBagItem(questionId);
      
      // Show success message
      message.success('Question deleted successfully');
      
      // Invalidate the questions query to refetch the data
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    } catch (error) {
      console.error('Error deleting question:', error);
      message.error('Failed to delete question. Please try again.');
    } finally {
      setIsDeleting(prev => ({ ...prev, [questionId]: false }));
    }
  };

  // Add startEditing function
  const startEditing = (question: Question) => {
    // Ensure we have at least 5 options (A-E)
    let options: string[] = [];
    
    // If the question has options, use them
    if (question.options && question.options.length > 0) {
      options = [...question.options];
    }
    
    // Fill in empty options until we have 5
    while (options.length < 5) {
      options.push('');
    }
    
    // Extract statement 1 and statement 2 for Data Sufficiency questions
    let statement1 = '';
    let statement2 = '';
    
    // Attempt to extract statements from question text for Data Sufficiency questions
    if (question.questionType === 'Data Sufficiency') {
      // Regular expression to find statement 1 and statement 2
      const statement1Regex = /\(1\)(.*?)(?=\(2\)|$)/;
      const statement2Regex = /\(2\)(.*?)(?=$)/;
      
      const statement1Match = question.questionText.match(statement1Regex);
      const statement2Match = question.questionText.match(statement2Regex);
      
      if (statement1Match) {
        statement1 = statement1Match[1].trim();
      }
      
      if (statement2Match) {
        statement2 = statement2Match[1].trim();
      }
    }
    
    setEditingQuestion({
      _id: question._id,
      questionText: question.questionText,
      options: options,
      correctAnswer: question.correctAnswer || '',
      explanation: question.explanation || '',
      statement1: statement1,
      statement2: statement2,
      questionType: question.questionType,
      passageText: (question as any).passageText || '',
      readyForQuiz: !!(question as any).readyForQuiz,
      topic: (question as any).metadata?.topic || '',
      subtopic: (question as any).metadata?.subtopic || '',
      originalMetadata: (question as any).metadata || {},
    });
  };

  // Add cancelEditing function
  const cancelEditing = () => {
    setEditingQuestion(null);
  };

  // Add handleOptionChange function
  const handleOptionChange = (index: number, value: string) => {
    if (!editingQuestion) return;
    
    const newOptions = [...editingQuestion.options];
    newOptions[index] = value;
    
    setEditingQuestion({
      ...editingQuestion,
      options: newOptions
    });
  };

  // Add handleCorrectAnswerChange function
  const handleCorrectAnswerChange = (value: string) => {
    if (!editingQuestion) return;
    
    setEditingQuestion({
      ...editingQuestion,
      correctAnswer: value
    });
  };

  // Add saveQuestion function
  const saveQuestion = async () => {
    if (!editingQuestion) return;
    
    setIsSaving(true);
    try {
      // Convert options array back to object format expected by the backend
      const optionsObject: Record<string, string> = {};
      editingQuestion.options.forEach((option, index) => {
        const key = String.fromCharCode(65 + index); // A, B, C, etc.
        optionsObject[key] = option;
      });
      
      // For Data Sufficiency questions, update the question text with statements
      let finalQuestionText = editingQuestion.questionText;
      
      if (editingQuestion.questionType === 'Data Sufficiency' && 
          (editingQuestion.statement1 || editingQuestion.statement2)) {
        
        // Extract the main question part (before statements)
        let mainQuestion = editingQuestion.questionText;
        
        // Remove existing statements if they exist
        const statementRegex = /\([1-2]\).*?(?=\([1-2]\)|$)/g;
        mainQuestion = mainQuestion.replace(statementRegex, '').trim();
        
        // Check if the question ends with question mark and add if missing
        if (!mainQuestion.endsWith('?')) {
          mainQuestion = mainQuestion.replace(/\s*\??\s*$/, '?');
        }
        
        // Reconstruct the question with updated statements
        finalQuestionText = `${mainQuestion} (1) ${editingQuestion.statement1 || ''} (2) ${editingQuestion.statement2 || ''}`;
      }
      
      const questionData: any = {
        questionText: finalQuestionText,
        options: optionsObject,
        correctAnswer: editingQuestion.correctAnswer,
        explanation: editingQuestion.explanation,
        readyForQuiz: !!editingQuestion.readyForQuiz,
        // Merge so other metadata fields on the doc (DS statement1/2,
        // CR argument, RC passage) aren't blown away by this partial update.
        metadata: {
          ...(editingQuestion.originalMetadata || {}),
          topic: editingQuestion.topic || '',
          subtopic: editingQuestion.subtopic || '',
        },
      };

      // Persist edited CR argument / RC passage. Same DB column for both.
      if (
        editingQuestion.questionType === 'Critical Reasoning' ||
        editingQuestion.questionType === 'Reading Comprehension'
      ) {
        questionData.passageText = editingQuestion.passageText || '';
      }

      await updateQuestionBagV2(editingQuestion._id, questionData);
      
      // Show success message
      message.success('Question updated successfully');
      
      // Invalidate the questions query to refetch the data
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      
      // Exit edit mode
      setEditingQuestion(null);
    } catch (error) {
      console.error('Error updating question:', error);
      message.error('Failed to update question. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Function to handle opening the Add Question modal
  const handleAddQuestionClick = () => {
    // Reset form when opening modal
    form.resetFields();
    setIsAddingQuestion(true);
  };

  // Define question renderer
  const renderQuestion = (question: Question) => (
    <Card 
      className="shadow-md hover:shadow-lg transition-shadow border border-gray-200 rounded-lg overflow-hidden mb-8"
      bodyStyle={{ padding: 0 }}
    >
      {/* Question Header with metadata */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <div className="flex flex-wrap gap-2 mb-2">
              <Tag color="blue" className="text-sm">{question.category}</Tag>
              <Tag color="green" className="text-sm">{question.questionType}</Tag>
              <Tag color="orange" className="text-sm">
                Difficulty: {['Easy', 'Medium', 'Hard'][question.difficulty - 1] || question.difficulty}
              </Tag>
              {question.source && (
                <Tag color="purple" className="text-sm">Source: {question.source}</Tag>
              )}
              {(question as any).readyForQuiz && (
                <Tag color="success" className="text-sm">Ready for Quiz</Tag>
              )}
              {(question as any).metadata?.topic && (
                <Tag color="geekblue" className="text-sm">
                  {(question as any).metadata.topic}
                  {(question as any).metadata.subtopic
                    ? ` › ${(question as any).metadata.subtopic}`
                    : ''}
                </Tag>
              )}
              {question.sourceDetails?.url && (
                <Tooltip title="Open source URL">
                  <a 
                    href={question.sourceDetails.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-blue-500 hover:text-blue-700"
                  >
                    <LinkIcon />
                  </a>
                </Tooltip>
              )}
            </div>
          </div>
          <div className="space-x-2">
            {editingQuestion && editingQuestion._id === question._id ? (
              <>
                <Button 
                  type="primary"
                  icon={<SaveIcon />}
                  onClick={() => saveQuestion()}
                  loading={isSaving}
                  disabled={isSaving}
                >
                  Save
                </Button>
                <Button 
                  icon={<CancelIcon />}
                  onClick={() => cancelEditing()}
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
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(question);
                  }}
                  disabled={!!editingQuestion}
                >
                  Edit
                </Button>
                <Button 
                  type="primary" 
                  danger 
                  icon={<DeleteIcon />} 
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(question._id);
                  }}
                  loading={isDeleting[question._id]}
                  disabled={isDeleting[question._id] || !!editingQuestion}
                >
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
        
      {/* Question Content */}
      <div className="p-5">
        {editingQuestion && editingQuestion._id === question._id ? (
          <div className="space-y-6 bg-white rounded-md p-4">
            <div className="border-b pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Question Text</label>
              <Input.TextArea
                value={editingQuestion.questionText}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, questionText: e.target.value })}
                rows={4}
                className="w-full"
              />
            </div>
            
            {/* CR argument / RC passage: same column (passageText) for both,
                surfaced here so the user can actually edit it.
                Inline HTML markup (<b>, <mark>) is preserved on save. */}
            {(editingQuestion.questionType === 'Critical Reasoning' ||
              editingQuestion.questionType === 'Reading Comprehension') && (
              <div className="border-b pb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {editingQuestion.questionType === 'Reading Comprehension' ? 'Passage' : 'Argument'}
                </label>
                <Input.TextArea
                  value={editingQuestion.passageText}
                  onChange={(e) =>
                    setEditingQuestion({ ...editingQuestion, passageText: e.target.value })
                  }
                  rows={editingQuestion.questionType === 'Reading Comprehension' ? 12 : 6}
                  className="w-full font-mono text-sm"
                  placeholder={`Enter the ${editingQuestion.questionType === 'Reading Comprehension' ? 'passage' : 'argument'} text. Inline <b>...</b> and <mark>...</mark> tags are preserved.`}
                />
                <div className="text-xs text-gray-500 mt-1">
                  Tip: wrap text in <code>&lt;b&gt;...&lt;/b&gt;</code> for bold, <code>&lt;mark&gt;...&lt;/mark&gt;</code> for highlight.
                </div>
              </div>
            )}

            {/* Add Data Sufficiency specific fields */}
            {editingQuestion.questionType === 'Data Sufficiency' && (
              <div className="border-b pb-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statement 1</label>
                  <Input.TextArea
                    value={editingQuestion.statement1}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, statement1: e.target.value })}
                    rows={2}
                    className="w-full"
                    placeholder="Enter Statement 1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Statement 2</label>
                  <Input.TextArea
                    value={editingQuestion.statement2}
                    onChange={(e) => setEditingQuestion({ ...editingQuestion, statement2: e.target.value })}
                    rows={2}
                    className="w-full"
                    placeholder="Enter Statement 2"
                  />
                </div>
              </div>
            )}
            
            <div className="border-b pb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              {editingQuestion.options.map((option, index) => (
                <div key={index} className="flex items-center mb-3 bg-gray-50 p-2 rounded">
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-2">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <Input
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    className="flex-1"
                  />
                  <Radio
                    checked={editingQuestion.correctAnswer === String.fromCharCode(65 + index)}
                    onChange={() => handleCorrectAnswerChange(String.fromCharCode(65 + index))}
                    className="ml-2"
                  />
                  <span className="ml-1 text-xs text-gray-500">Correct</span>
                </div>
              ))}
              <Button 
                type="dashed" 
                onClick={() => {
                  if (!editingQuestion) return;
                  setEditingQuestion({
                    ...editingQuestion,
                    options: [...editingQuestion.options, '']
                  });
                }}
                className="w-full mt-2"
                icon={<PlusIcon />}
              >
                Add Option
              </Button>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Explanation</label>
              <Input.TextArea
                value={editingQuestion.explanation}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                rows={4}
                className="w-full"
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              {/* Topic / sub-topic tagging — schema field is metadata.topic /
                  metadata.subtopic. Free-text on purpose; the bank already has
                  inconsistent topic vocab and we're not gating on it yet. */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Topic</label>
                  <Input
                    value={editingQuestion.topic}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, topic: e.target.value })
                    }
                    placeholder="e.g. Algebra, Number Properties, Inference"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sub-topic</label>
                  <Input
                    value={editingQuestion.subtopic}
                    onChange={(e) =>
                      setEditingQuestion({ ...editingQuestion, subtopic: e.target.value })
                    }
                    placeholder="e.g. Quadratics, Primes, Strengthen"
                  />
                </div>
              </div>

              {/* Ready-for-Quiz flag. Quiz pulls only respect this when the
                  client opts in via filters.onlyReadyForQuiz. */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={!!editingQuestion.readyForQuiz}
                  onChange={(checked) =>
                    setEditingQuestion({ ...editingQuestion, readyForQuiz: checked })
                  }
                />
                <div>
                  <div className="text-sm font-medium text-gray-700">Ready for Quiz</div>
                  <div className="text-xs text-gray-500">
                    When on, this question is eligible for quizzes that have the
                    "ready-only" filter enabled. Off by default.
                  </div>
                </div>
              </div>
            </div>
          </div>
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

        {/* Footer with actions */}
        <div className="flex justify-between items-center pt-2 mt-4 border-t border-gray-100 p-4 bg-gray-50">
          {!editingQuestion && (
            <>
              <Button
                type="primary"
                ghost
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAnswer(question._id);
                }}
                className="flex items-center"
              >
                <span className="inline-flex items-center">
                  <EyeIcon visible={visibleAnswers[question._id]} />
                  {visibleAnswers[question._id] ? 'Hide Answer' : 'Show Answer'}
                </span>
              </Button>
              
              {visibleAnswers[question._id] && question.correctAnswer && (
                <div className="flex items-center">
                  <div className="mr-2 text-green-600 font-semibold">
                    Correct Answer: 
                  </div>
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white font-bold">
                    {question.correctAnswer}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );

  // Filter options
  const filterOptions = {
    category: [
      { text: 'Quantitative Reasoning', value: 'Quantitative Reasoning' },
      { text: 'Verbal Reasoning', value: 'Verbal Reasoning' },
      { text: 'Data Insights', value: 'Data Insights' }
    ],
    questionType: [
      { text: 'Problem Solving', value: 'Problem Solving' },
      { text: 'Data Sufficiency', value: 'Data Sufficiency' },
      { text: 'Reading Comprehension', value: 'Reading Comprehension' },
      { text: 'Critical Reasoning', value: 'Critical Reasoning' },
      { text: 'Multi-Source Reasoning', value: 'Multi-Source Reasoning' },
      { text: 'Table Analysis', value: 'Table Analysis' },
      { text: 'Graphics Interpretation', value: 'Graphics Interpretation' },
      { text: 'Two-Part Analysis', value: 'Two-Part Analysis' }
    ],
    difficulty: [
      { text: 'Easy', value: 1 },
      { text: 'Medium', value: 2 },
      { text: 'Hard', value: 3 },
    ],
  };

  // Create new question(s).
  //
  // RC special-case: one passage can have N sub-questions. The form switches
  // to a `rcQuestions` Form.List in that mode, and we POST one DB doc per
  // sub-question — all sharing the same `passageText` + `rcNumber` so the
  // quiz pager later groups them as a passage.
  const createQuestion = async () => {
    try {
      setIsCreating(true);
      await form.validateFields();
      const values = form.getFieldsValue();

      // RC fan-out
      if (values.questionType === 'Reading Comprehension') {
        const rcSubs = (values.rcQuestions || []).filter((s: any) => s && s.questionText);
        if (rcSubs.length === 0) {
          message.error('Add at least one question for this passage.');
          return;
        }
        if (rcSubs.length > 4) {
          message.error('Real GMAT caps RC passages at 4 questions. Please remove some.');
          return;
        }
        const sharedRcNumber = `RC_${Date.now()}`;
        for (let i = 0; i < rcSubs.length; i++) {
          const sub = rcSubs[i];
          await createQuestionBagItem({
            questionText: sub.questionText,
            options: sub.options || { A: '', B: '', C: '', D: '', E: '' },
            correctAnswer: sub.correctAnswer,
            explanation: sub.explanation,
            questionType: 'Reading Comprehension',
            category: values.category,
            difficulty: values.difficulty,
            source: 'Added on the Platform',
            passageText: values.passage,
            rcNumber: sharedRcNumber,
            metadata: {
              passage: values.passage,
              topic: values.topic || '',
              subtopic: values.subtopic || '',
            },
            readyForQuiz: !!values.readyForQuiz,
          });
        }
        message.success(`Created ${rcSubs.length} question${rcSubs.length > 1 ? 's' : ''} for this passage.`);
        queryClient.invalidateQueries({ queryKey: ['questions'] });
        form.resetFields();
        setIsAddingQuestion(false);
        return;
      }

      // Single-question path (everything else)
      let metadata: any = {};
      if (values.questionType === 'Data Sufficiency') {
        metadata = {
          statement1: values.statement1 || '',
          statement2: values.statement2 || '',
        };
      } else if (values.questionType === 'Critical Reasoning') {
        metadata = { argument: values.passage || '' };
      }
      // Topic / sub-topic always set when provided.
      metadata.topic = values.topic || '';
      metadata.subtopic = values.subtopic || '';

      const additionalFields: any = {};
      if (values.questionType === 'Critical Reasoning' && values.passage) {
        additionalFields.passageText = values.passage;
      }

      const questionData = {
        questionText: values.questionText,
        options: values.options || { A: '', B: '', C: '', D: '', E: '' },
        correctAnswer: values.correctAnswer,
        explanation: values.explanation,
        questionType: values.questionType,
        category: values.category,
        difficulty: values.difficulty,
        source: 'Added on the Platform',
        metadata,
        readyForQuiz: !!values.readyForQuiz,
        ...additionalFields,
      };

      await createQuestionBagItem(questionData);
      message.success('Question created successfully');
      queryClient.invalidateQueries({ queryKey: ['questions'] });
      form.resetFields();
      setIsAddingQuestion(false);
    } catch (error) {
      console.error('Error creating question:', error);
      message.error('Failed to create question. Please check your inputs and try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="bg-white shadow-md rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center mb-6">
          <Title level={2}>Question Bank</Title>
          <div className="flex items-center space-x-4">
            <Button
              type="primary"
              size="large"
              onClick={handleAddQuestionClick}
              className="bg-blue-400 hover:bg-blue-500 border-blue-400 hover:border-blue-500 h-10 flex items-center px-4 py-2 rounded-lg shadow-md text-white"
            >
              Add New Question
            </Button>
            {!isLoading && !error && data?.total !== undefined && (
              <div className="flex items-center bg-gray-100 px-4 py-2 rounded-lg">
                <Text strong className="text-lg">{data.total}</Text>
                <Text className="ml-2">Questions Found</Text>
              </div>
            )}
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg mb-6 shadow-sm">
          <div className="flex flex-row items-center mb-3">
            <Input.Search
              allowClear
              placeholder="Search question, passage, or argument text..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onSearch={(value) => {
                setQueryParams(prev => ({
                  ...prev,
                  page: 1,
                  search: value.trim() ? value.trim() : undefined,
                }));
                setVisibleAnswers({});
              }}
              enterButton="Search"
              size="large"
              className="max-w-2xl"
            />
          </div>
          <div className="flex flex-row items-center space-x-4 flex-wrap">
            {Object.entries(filterOptions).map(([key, options]) => (
              <div key={key} className="flex items-center">
                <label className="mr-2 text-gray-600">{key.charAt(0).toUpperCase() + key.slice(1)}:</label>
                <select
                  className="border rounded p-2"
                  value={queryParams[key as keyof QueryParams]?.toString() || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQueryParams(prev => ({
                      ...prev,
                      [key]: key === 'difficulty' ? (value ? parseInt(value) : undefined) : value,
                      page: 1, // Reset to first page when filter changes
                    }));
                    setVisibleAnswers({}); // Reset visible answers when filters change
                  }}
                >
                  <option value="">All</option>
                  {options.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.text}
                    </option>
                  ))}
                </select>
              </div>
            ))}
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
                setVisibleAnswers({}); // Reset visible answers when clearing filters
              }}
              danger
              type="primary"
              className="hover:opacity-90 transition-opacity"
            >
              🗑️ Clear Filters
            </Button>
          </div>
        </div>
      </div>

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
                        <div className="bg-blue-500 text-white rounded px-3 py-1 font-bold">
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
              <div className="text-gray-500 text-lg">No questions found matching your filters.</div>
            </div>
          )}
        </>
      )}

      {/* Add Question Modal */}
      <Modal
        title={
          <div className="text-center text-xl font-bold text-indigo-700">
            Add New Question
          </div>
        }
        open={isAddingQuestion}
        onCancel={() => setIsAddingQuestion(false)}
        width={800}
        footer={[
          <Button key="cancel" onClick={() => setIsAddingQuestion(false)}>
            Cancel
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={isCreating}
            onClick={createQuestion}
            className="bg-indigo-600 hover:bg-indigo-700"
          >
            Create Question
          </Button>,
        ]}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            questionType: 'Problem Solving',
            category: 'Quantitative Reasoning',
            difficulty: 2,
            options: { A: '', B: '', C: '', D: '', E: '' },
            correctAnswer: 'A'
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Form.Item
              name="category"
              label="Category"
              rules={[{ required: true, message: 'Please select a category' }]}
            >
              <Select>
                {filterOptions.category.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.text}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="questionType"
              label="Question Type"
              rules={[{ required: true, message: 'Please select a question type' }]}
            >
              <Select>
                {filterOptions.questionType.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.text}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            
            <Form.Item
              name="difficulty"
              label="Difficulty"
              rules={[{ required: true, message: 'Please select a difficulty level' }]}
            >
              <Select>
                {filterOptions.difficulty.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.text}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          
          {/* Top-level question text. Hidden for RC — RC's questions live
              inside the per-passage Form.List below. */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.questionType !== curr.questionType}
          >
            {({ getFieldValue }) =>
              getFieldValue('questionType') !== 'Reading Comprehension' ? (
                <Form.Item
                  name="questionText"
                  label="Question Text"
                  rules={[{ required: true, message: 'Please enter the question text' }]}
                >
                  <TextArea rows={4} placeholder="Enter the question text here" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
          
          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => 
              prevValues.questionType !== currentValues.questionType
            }
          >
            {({ getFieldValue }) => {
              const questionType = getFieldValue('questionType');
              
              if (questionType === 'Data Sufficiency') {
                return (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="font-medium mb-2 text-indigo-700">Data Sufficiency Statements</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Form.Item
                        name="statement1"
                        label="Statement 1"
                        rules={[{ required: true, message: 'Please enter statement 1' }]}
                      >
                        <TextArea rows={2} placeholder="Enter statement 1" />
                      </Form.Item>
                      
                      <Form.Item
                        name="statement2"
                        label="Statement 2"
                        rules={[{ required: true, message: 'Please enter statement 2' }]}
                      >
                        <TextArea rows={2} placeholder="Enter statement 2" />
                      </Form.Item>
                    </div>
                  </div>
                );
              }
              
              if (questionType === 'Reading Comprehension' || questionType === 'Critical Reasoning') {
                return (
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <div className="font-medium mb-2 text-indigo-700">
                      {questionType === 'Reading Comprehension' ? 'Passage' : 'Argument'}
                    </div>
                    <Form.Item
                      name="passage"
                      rules={[{ required: true, message: `Please enter the ${questionType === 'Reading Comprehension' ? 'passage' : 'argument'}` }]}
                    >
                      <TextArea 
                        rows={6} 
                        placeholder={`Enter the ${questionType === 'Reading Comprehension' ? 'passage' : 'argument'} text here`} 
                      />
                    </Form.Item>
                  </div>
                );
              }
              
              return null;
            }}
          </Form.Item>
          
          {/* RC: per-passage list of question subforms. Up to 4 (real-GMAT cap). */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.questionType !== curr.questionType}
          >
            {({ getFieldValue }) =>
              getFieldValue('questionType') === 'Reading Comprehension' ? (
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <div className="font-medium mb-2 text-indigo-700">
                    Questions for this Passage <span className="text-xs text-gray-500 font-normal">(up to 4)</span>
                  </div>
                  <Form.List name="rcQuestions" initialValue={[{}]}>
                    {(fields, { add, remove }) => (
                      <div className="space-y-4">
                        {fields.map((field, idx) => (
                          <div key={field.key} className="bg-white p-4 rounded border border-gray-200">
                            <div className="flex justify-between items-center mb-3">
                              <div className="font-medium text-gray-700">Question {idx + 1}</div>
                              {fields.length > 1 && (
                                <Button
                                  type="text"
                                  danger
                                  size="small"
                                  onClick={() => remove(field.name)}
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                            <Form.Item
                              {...field}
                              key={`qtxt_${field.key}`}
                              name={[field.name, 'questionText']}
                              label="Question Text"
                              rules={[{ required: true, message: 'Question text is required' }]}
                            >
                              <TextArea rows={3} placeholder="Enter the question stem" />
                            </Form.Item>
                            {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                              <div key={letter} className="flex items-center mb-2">
                                <div className="w-7 h-7 flex items-center justify-center bg-gray-200 rounded-full mr-2 text-sm">
                                  {letter}
                                </div>
                                <Form.Item
                                  name={[field.name, 'options', letter]}
                                  className="flex-1 mb-0"
                                  rules={[{
                                    required: letter === 'A' || letter === 'B',
                                    message: `Option ${letter} is required`,
                                  }]}
                                >
                                  <Input placeholder={`Option ${letter}`} size="small" />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'correctAnswer']}
                                  noStyle
                                >
                                  <Radio.Group className="ml-2">
                                    <Radio value={letter} />
                                  </Radio.Group>
                                </Form.Item>
                                <span className="ml-1 text-xs text-gray-500">Correct</span>
                              </div>
                            ))}
                            <Form.Item
                              name={[field.name, 'explanation']}
                              label="Explanation"
                              className="mt-3"
                              rules={[{ required: true, message: 'Explanation is required' }]}
                            >
                              <TextArea rows={2} placeholder="Why is the correct option correct?" />
                            </Form.Item>
                          </div>
                        ))}
                        {fields.length < 4 && (
                          <Button
                            type="dashed"
                            onClick={() => add({})}
                            className="w-full"
                          >
                            + Add another question for this passage
                          </Button>
                        )}
                      </div>
                    )}
                  </Form.List>
                </div>
              ) : null
            }
          </Form.Item>

          {/* Single-question Answer Options + Explanation. Hidden for RC,
              which provides per-question fields inside the Form.List above. */}
          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.questionType !== curr.questionType}
          >
            {({ getFieldValue }) =>
              getFieldValue('questionType') !== 'Reading Comprehension' ? (
                <>
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="font-medium mb-2 text-indigo-700">Answer Options</div>
            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.questionType !== currentValues.questionType
              }
            >
              {({ getFieldValue }) => {
                const questionType = getFieldValue('questionType');

                if (questionType === 'Data Sufficiency') {
                  return (
                    <div>
                      <div className="mb-2 text-gray-600 text-sm">
                        Data Sufficiency standard options:
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div className="p-2 bg-white border rounded">A: Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.</div>
                        <div className="p-2 bg-white border rounded">B: Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.</div>
                        <div className="p-2 bg-white border rounded">C: BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.</div>
                        <div className="p-2 bg-white border rounded">D: EACH statement ALONE is sufficient.</div>
                        <div className="p-2 bg-white border rounded">E: Statements (1) and (2) TOGETHER are NOT sufficient.</div>
                      </div>
                      
                      <Form.Item
                        name="correctAnswer"
                        label="Correct Answer"
                        className="mt-4"
                        rules={[{ required: true, message: 'Please select the correct answer' }]}
                      >
                        <Radio.Group buttonStyle="solid">
                          <Radio.Button value="A">A</Radio.Button>
                          <Radio.Button value="B">B</Radio.Button>
                          <Radio.Button value="C">C</Radio.Button>
                          <Radio.Button value="D">D</Radio.Button>
                          <Radio.Button value="E">E</Radio.Button>
                        </Radio.Group>
                      </Form.Item>
                    </div>
                  );
                }
                
                return (
                  <div>
                    {['A', 'B', 'C', 'D', 'E'].map((letter) => (
                      <div key={letter} className="flex items-center mb-3">
                        <div className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded-full mr-2">
                          {letter}
                        </div>
                        <Form.Item
                          name={['options', letter]}
                          className="flex-1 mb-0"
                          rules={[{ required: letter === 'A' || letter === 'B', message: `Option ${letter} is required` }]}
                        >
                          <Input placeholder={`Option ${letter}`} />
                        </Form.Item>
                        <Form.Item name="correctAnswer" noStyle>
                          <Radio.Group className="ml-2">
                            <Radio value={letter} />
                          </Radio.Group>
                        </Form.Item>
                        <span className="ml-1 text-xs text-gray-500">Correct</span>
                      </div>
                    ))}
                  </div>
                );
              }}
            </Form.Item>
          </div>
          
          <Form.Item
            name="explanation"
            label="Explanation"
            rules={[{ required: true, message: 'Please provide an explanation' }]}
          >
            <TextArea rows={4} placeholder="Enter the explanation for the correct answer" />
          </Form.Item>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Form.Item name="topic" label="Topic">
              <Input placeholder="e.g. Algebra, Inference" />
            </Form.Item>
            <Form.Item name="subtopic" label="Sub-topic">
              <Input placeholder="e.g. Quadratics, Strengthen" />
            </Form.Item>
          </div>
          <Form.Item
            name="readyForQuiz"
            label="Ready for Quiz"
            valuePropName="checked"
            tooltip="When on, this question is eligible for quizzes that opt in to the ready-only filter."
          >
            <Switch />
          </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReviewPage;