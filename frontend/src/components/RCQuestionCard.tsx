import React from 'react';
import { Card, Typography, Space, Button, Divider, Collapse } from 'antd';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { addStatementBreaks } from '../utils/formatStatements';
import '../styles/question-cards.css';
const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

interface RCSibling {
  _id: string;
  rcNumber?: string;
  passageId?: string;
}

interface RCQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
    passageText?: string;
    rcNumber?: string;
    passageId?: string;
  };
  selectedAnswer?: string;
  showAnswer?: boolean;
  correctAnswer?: string;
  explanation?: string;
  onAnswerSelect?: (answer: string) => void;
  isMobile?: boolean;
  /** Other questions in the quiz that share this passage (rcNumber/passageId).
   *  When provided and >1, the card shows MSR-style sub-question pills. */
  relatedQuestions?: RCSibling[];
  /** Per-question answers, keyed by _id, so the pills can show answered state. */
  answeredMap?: Record<string, string | undefined>;
  /** Called when the user clicks a sibling pill to jump to that question. */
  onJumpToQuestion?: (questionId: string) => void;
  /** When true, suppress the sibling-pill UI. Quiz pages pass this so the
   *  user advances through passage sub-questions only via the main pager —
   *  matching real GMAT behaviour (no jumping, no sibling count). */
  hidePassagePills?: boolean;
}

export const RCQuestionCard: React.FC<RCQuestionCardProps> = ({
  question,
  selectedAnswer,
  showAnswer = false,
  correctAnswer,
  explanation,
  onAnswerSelect,
  isMobile = false,
  relatedQuestions = [],
  answeredMap = {},
  onJumpToQuestion,
  hidePassagePills = false,
}) => {
  const [activeTab, setActiveTab] = React.useState<string>('passage');

  // Handle mobile view tab switching
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  // Build the passage's sub-question set: this question plus its siblings,
  // de-duplicated and ordered as supplied. Used for MSR-style sub-Q pills.
  const passageKey = question.rcNumber || question.passageId;
  const siblingMatches = relatedQuestions.filter(
    (s) => (s.rcNumber || s.passageId) === passageKey,
  );
  const passageSet = passageKey
    ? Array.from(
        new Map(
          [{ _id: question._id, rcNumber: question.rcNumber, passageId: question.passageId }, ...siblingMatches].map(
            (q) => [q._id, q],
          ),
        ).values(),
      )
    : [];
  const showPills = passageSet.length > 1 && !hidePassagePills;
  const currentPillIdx = passageSet.findIndex((s) => s._id === question._id);

  const renderSubQPills = () => {
    if (!showPills) return null;
    return (
      <div className="mb-3 flex items-center gap-2 flex-wrap">
        <Text strong className="text-sm">
          Question {currentPillIdx + 1} of {passageSet.length}
        </Text>
        <div className="flex gap-1 ml-2">
          {passageSet.map((s, idx) => {
            const isCurrent = s._id === question._id;
            const isAnswered = !!answeredMap[s._id];
            return (
              <button
                key={s._id}
                disabled={!onJumpToQuestion || isCurrent}
                onClick={() => onJumpToQuestion && onJumpToQuestion(s._id)}
                className={`w-8 h-8 rounded-full text-xs font-semibold transition ${
                  isCurrent
                    ? 'bg-blue-600 text-white'
                    : isAnswered
                    ? 'bg-green-100 text-green-700 border border-green-300 hover:bg-green-200'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${onJumpToQuestion && !isCurrent ? 'cursor-pointer' : ''}`}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="rc-question-card">
      {/* Mobile View */}
      {isMobile && (
        <div className="mb-4">
          <div className="flex border-b">
            <div
              className={`px-4 py-2 cursor-pointer ${
                activeTab === 'passage' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'
              }`}
              onClick={() => handleTabChange('passage')}
            >
              Passage
            </div>
            <div
              className={`px-4 py-2 cursor-pointer ${
                activeTab === 'question' ? 'border-b-2 border-blue-500 font-semibold' : 'text-gray-500'
              }`}
              onClick={() => handleTabChange('question')}
            >
              Question
            </div>
          </div>

          {activeTab === 'passage' && (
            <div className="p-4 bg-gray-50 rounded-lg mt-2 overflow-auto max-h-[60vh]">
              <Paragraph>
                <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.passageText) }} />
              </Paragraph>
            </div>
          )}

          {activeTab === 'question' && (
            <div className="mt-2">
              <div className="p-4 bg-white rounded-lg">
                {renderSubQPills()}
                <Text strong>
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(addStatementBreaks(question.questionText)) }} />
              </Text>
                
                <div className="mt-4 space-y-3">
                  {question.options.map((option, index) => {
                    const optionLetter = String.fromCharCode(65 + index);
                    const isSelected = selectedAnswer === optionLetter;
                    const isCorrect = showAnswer && correctAnswer === optionLetter;
                    
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-2 border-blue-500 bg-blue-100 shadow-md transform scale-[1.01]'
                            : isCorrect
                            ? 'border-2 border-green-500 bg-green-50'
                            : 'border border-gray-200 hover:border-blue-300 hover:bg-gray-100'
                        }`}
                        onClick={() => onAnswerSelect && onAnswerSelect(optionLetter)}
                      >
                        <div className="flex items-start">
                          <div className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 shadow ${
                            isSelected
                              ? 'bg-blue-600 text-white'
                              : isCorrect
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-200 text-gray-700'
                          }`}>
                            {optionLetter}
                          </div>
                          <div className={isSelected ? 'font-medium text-blue-800' : ''}>{option}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {showAnswer && explanation && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <Text strong>Explanation:</Text>
                    <Paragraph className="mt-2">{explanation}</Paragraph>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop View - Two-column layout */}
      {!isMobile && (
        <div className="flex flex-row space-x-4">
          {/* Left column: Passage */}
          <div className="w-1/2 bg-gray-50 p-4 rounded-lg overflow-auto max-h-[80vh]">
            <Title level={5} className="mb-3">Reading Passage</Title>
            <Paragraph>
              <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(question.passageText) }} />
            </Paragraph>
          </div>

          {/* Right column: Question and answers */}
          <div className="w-1/2">
            <div className="p-4 bg-white rounded-lg">
              {renderSubQPills()}
              <Text strong>
                <span dangerouslySetInnerHTML={{ __html: sanitizeHtml(addStatementBreaks(question.questionText)) }} />
              </Text>
              
              <div className="mt-4 space-y-3">
                {question.options.map((option, index) => {
                  const optionLetter = String.fromCharCode(65 + index);
                  const isSelected = selectedAnswer === optionLetter;
                  const isCorrect = showAnswer && correctAnswer === optionLetter;
                  
                  return (
                    <div
                      key={index}
                      className={`p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? 'border-2 border-blue-500 bg-blue-100 shadow-md transform scale-[1.01]'
                          : isCorrect
                          ? 'border-2 border-green-500 bg-green-50'
                          : 'border border-gray-200 hover:border-blue-300 hover:bg-gray-100'
                      }`}
                      onClick={() => onAnswerSelect && onAnswerSelect(optionLetter)}
                    >
                      <div className="flex items-start">
                        <div className={`w-6 h-6 flex items-center justify-center rounded-full mr-3 shadow ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : isCorrect
                            ? 'bg-green-500 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {optionLetter}
                        </div>
                        <div className={isSelected ? 'font-medium text-blue-800' : ''}>{option}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {showAnswer && explanation && (
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                  <Text strong>Explanation:</Text>
                  <Paragraph className="mt-2">{explanation}</Paragraph>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 