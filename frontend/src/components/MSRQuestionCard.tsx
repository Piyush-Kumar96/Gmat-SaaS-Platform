import React, { useEffect, useState } from 'react';
import { Typography, Tabs, Divider, Radio, Space, Image } from 'antd';
import '../styles/question-cards.css';

const { Text, Paragraph } = Typography;
const { TabPane } = Tabs;

interface MSRSource {
  tabName: string;
  content: string;
  images?: Array<{ src: string; alt?: string }>;
  tables?: Array<{ html: string; rows?: number; cols?: number }>;
}

interface SubQuestion {
  questionId: string;
  questionText: string;
  questionType: 'multiple_choice' | 'yes_no_table' | 'two_part_analysis';
  options?: Array<{ value: string; text: string }>;
  statements?: Array<{ text: string }>;
  columnHeaders?: string[];
  rowOptions?: string[];
  correctAnswer?: string | string[];
}

interface MSRQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
    msrSources?: MSRSource[];
    subQuestions?: SubQuestion[];
    artifactImages?: string[];
    artifactTables?: string[];
  };
  currentSubQuestionIndex?: number;
  selectedAnswers?: Record<string, string | string[]>;
  showAnswer?: boolean;
  correctAnswers?: Record<string, string | string[]>;
  onAnswerSelect?: (subQuestionId: string, answer: string | string[]) => void;
  onSubQuestionChange?: (index: number) => void;
}

export const MSRQuestionCard: React.FC<MSRQuestionCardProps> = ({
  question,
  currentSubQuestionIndex = 0,
  selectedAnswers = {},
  showAnswer = false,
  correctAnswers = {},
  onAnswerSelect,
  onSubQuestionChange,
}) => {
  const [activeSourceTab, setActiveSourceTab] = useState('0');

  // The card instance is reused across MSR sets; reset the tab on each new set
  // so the next set always opens on its first information tab.
  useEffect(() => {
    setActiveSourceTab('0');
  }, [question._id]);

  const sources = question.msrSources || [];
  const subQuestions = question.subQuestions || [];
  const currentSubQuestion = subQuestions[currentSubQuestionIndex];

  // Render source content with images and tables
  const renderSourceContent = (source: MSRSource) => {
    return (
      <div className="p-4">
        {/* Text content */}
        <Paragraph className="whitespace-pre-line text-base leading-relaxed">
          {source.content}
        </Paragraph>

        {/* Images */}
        {source.images && source.images.length > 0 && (
          <div className="mt-4 space-y-4">
            {source.images.map((img, idx) => (
              <div key={idx} className="flex justify-center">
                <Image
                  src={img.src}
                  alt={img.alt || `Source image ${idx + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '400px' }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                />
              </div>
            ))}
          </div>
        )}

        {/* Tables */}
        {source.tables && source.tables.length > 0 && (
          <div className="mt-4 space-y-4">
            {source.tables.map((table, idx) => (
              <div
                key={idx}
                className="overflow-x-auto border rounded-lg"
                dangerouslySetInnerHTML={{ __html: table.html }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render multiple choice sub-question
  const renderMultipleChoice = (subQ: SubQuestion) => {
    const selectedValue = selectedAnswers[subQ.questionId] as string | undefined;
    const correctValue = correctAnswers[subQ.questionId] as string | undefined;

    return (
      <div className="space-y-3">
        {subQ.options?.map((option, index) => {
          const isSelected = selectedValue === option.value;
          const isCorrect = showAnswer && correctValue === option.value;

          return (
            <div
              key={index}
              className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                isSelected
                  ? 'border-2 border-blue-500 bg-blue-100 shadow-md'
                  : isCorrect
                  ? 'border-2 border-green-500 bg-green-50'
                  : 'border border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
              onClick={() => onAnswerSelect && onAnswerSelect(subQ.questionId, option.value)}
            >
              <div className="flex items-center">
                <div className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : isCorrect
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}>
                  {option.value}
                </div>
                <Text className={isSelected ? 'font-medium text-blue-800' : ''}>
                  {option.text}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render yes/no table sub-question
  const renderYesNoTable = (subQ: SubQuestion) => {
    const selectedValues = (selectedAnswers[subQ.questionId] as string[]) || [];
    const correctValues = (correctAnswers[subQ.questionId] as string[]) || [];
    const headers = subQ.columnHeaders || ['Yes', 'No'];

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              {headers.map((header, idx) => (
                <th key={idx} className="border border-gray-300 p-2 text-center w-20">
                  {header}
                </th>
              ))}
              <th className="border border-gray-300 p-2 text-left">Statement</th>
            </tr>
          </thead>
          <tbody>
            {subQ.statements?.map((statement, rowIdx) => {
              const rowAnswer = selectedValues[rowIdx];
              const rowCorrect = correctValues[rowIdx];

              return (
                <tr key={rowIdx} className="hover:bg-gray-50">
                  {headers.map((header, colIdx) => {
                    const value = `${rowIdx}_${colIdx}`;
                    const isSelected = rowAnswer === String(colIdx);
                    const isCorrect = showAnswer && rowCorrect === String(colIdx);

                    return (
                      <td key={colIdx} className="border border-gray-300 p-2 text-center">
                        <Radio
                          checked={isSelected}
                          onChange={() => {
                            const newAnswers = [...selectedValues];
                            newAnswers[rowIdx] = String(colIdx);
                            onAnswerSelect && onAnswerSelect(subQ.questionId, newAnswers);
                          }}
                          className={isCorrect ? 'text-green-500' : ''}
                        />
                      </td>
                    );
                  })}
                  <td className="border border-gray-300 p-3 text-left">
                    {statement.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Render current sub-question
  const renderSubQuestion = () => {
    if (!currentSubQuestion) {
      return (
        <div className="p-4 text-gray-500">
          No sub-questions available for this MSR question.
        </div>
      );
    }

    return (
      <div className="p-4">
        {/* GMAT shows ONE sub-question at a time, no jumping, no sibling
            count. The pill nav is only rendered when an explicit
            onSubQuestionChange is provided (admin Question Bank preview);
            in the quiz it stays hidden so the main pager owns navigation. */}
        {subQuestions.length > 1 && onSubQuestionChange && (
          <div className="mb-4 flex items-center gap-2">
            <Text strong>Question {currentSubQuestionIndex + 1} of {subQuestions.length}</Text>
            <div className="flex gap-1 ml-4">
              {subQuestions.map((_, idx) => (
                <button
                  key={idx}
                  className={`w-8 h-8 rounded-full text-sm ${
                    idx === currentSubQuestionIndex
                      ? 'bg-blue-600 text-white'
                      : selectedAnswers[subQuestions[idx].questionId]
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                  onClick={() => onSubQuestionChange(idx)}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Sub-question text */}
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <Text className="text-base">{currentSubQuestion.questionText}</Text>
        </div>

        {/* Sub-question options based on type */}
        {currentSubQuestion.questionType === 'multiple_choice' && renderMultipleChoice(currentSubQuestion)}
        {currentSubQuestion.questionType === 'yes_no_table' && renderYesNoTable(currentSubQuestion)}
      </div>
    );
  };

  return (
    <div className="msr-question-card">
      {/* Instructions */}
      <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
        <Text strong className="text-purple-800">Multi-Source Reasoning (MSR)</Text>
        <Text className="block mt-1 text-sm text-purple-600">
          Review the information in each tab carefully before answering the questions.
        </Text>
      </div>

      {/* Two-column layout: Sources on left, Question on right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Source Tabs */}
        <div className="border rounded-lg bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-2">
            <Text strong>Information Sources</Text>
          </div>

          {sources.length > 0 ? (
            <Tabs
              activeKey={activeSourceTab}
              onChange={setActiveSourceTab}
              type="card"
              className="msr-source-tabs"
            >
              {sources.map((source, idx) => (
                <TabPane tab={source.tabName} key={String(idx)}>
                  {renderSourceContent(source)}
                </TabPane>
              ))}
            </Tabs>
          ) : (
            <div className="p-4">
              <Paragraph className="whitespace-pre-line">{question.questionText}</Paragraph>

              {/* Artifact images if no sources */}
              {question.artifactImages && question.artifactImages.length > 0 && (
                <div className="mt-4 space-y-4">
                  {question.artifactImages.map((src, idx) => (
                    <Image
                      key={idx}
                      src={src}
                      alt={`Artifact ${idx + 1}`}
                      style={{ maxWidth: '100%' }}
                    />
                  ))}
                </div>
              )}

              {/* Artifact tables if no sources */}
              {question.artifactTables && question.artifactTables.length > 0 && (
                <div className="mt-4 space-y-4">
                  {question.artifactTables.map((html, idx) => (
                    <div
                      key={idx}
                      className="overflow-x-auto border rounded-lg"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Sub-Question */}
        <div className="border rounded-lg bg-white shadow-sm">
          <div className="border-b bg-gray-50 px-4 py-2">
            <Text strong>Question</Text>
          </div>
          {renderSubQuestion()}
        </div>
      </div>
    </div>
  );
};
