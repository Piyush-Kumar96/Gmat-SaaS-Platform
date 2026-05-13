import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { addStatementBreaks } from '../utils/formatStatements';
import '../styles/question-cards.css';
const { Title, Text, Paragraph } = Typography;

interface DSQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
    metadata?: {
      statement1?: string;
      statement2?: string;
    };
  };
  selectedAnswer?: string;
  showAnswer?: boolean;
  correctAnswer?: string;
  explanation?: string;
  onAnswerSelect?: (answer: string) => void;
}

export const DSQuestionCard: React.FC<DSQuestionCardProps> = ({
  question,
  selectedAnswer,
  showAnswer = false,
  correctAnswer,
  explanation,
  onAnswerSelect,
}) => {
  const getStatements = () => {
    if (question.metadata?.statement1 && question.metadata?.statement2) {
      return {
        statement1: question.metadata.statement1,
        statement2: question.metadata.statement2,
      };
    }
    
    // If statements are not in metadata, try to extract from question text
    const questionParts = question.questionText.split(/\(1\)|\(2\)/);
    if (questionParts.length >= 3) {
      return {
        mainQuestion: questionParts[0].trim(),
        statement1: questionParts[1].trim(),
        statement2: questionParts[2].trim(),
      };
    }
    
    return null;
  };
  
  const statements = getStatements();

  return (
    <div className="ds-question-card">
      {/* Data Sufficiency Informational Box */}
      <div className="mb-4 p-4 bg-gray-100 rounded-lg border border-gray-200 text-sm">
        <Text strong>Data Sufficiency Format:</Text>
        <ul className="list-disc ml-5 mt-2">
          <li>Statement (1) ALONE is sufficient, but statement (2) alone is not sufficient.</li>
          <li>Statement (2) ALONE is sufficient, but statement (1) alone is not sufficient.</li>
          <li>BOTH statements TOGETHER are sufficient, but NEITHER statement ALONE is sufficient.</li>
          <li>EACH statement ALONE is sufficient.</li>
          <li>Statements (1) and (2) TOGETHER are NOT sufficient.</li>
        </ul>
      </div>

      {/* Main Question */}
      <div className="mb-4">
        <Text strong>
          <span dangerouslySetInnerHTML={{
            __html: sanitizeHtml(addStatementBreaks(statements?.mainQuestion || question.questionText)),
          }} />
        </Text>
      </div>

      {/* Statements Section */}
      {statements && (
        <div className="mb-4 space-y-3">
          <div className="p-3 bg-blue-50 rounded-lg">
            <Text strong>(1) </Text>
            <Text>{statements.statement1}</Text>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <Text strong>(2) </Text>
            <Text>{statements.statement2}</Text>
          </div>
        </div>
      )}

      <Divider className="my-4" />

      {/* Options Section */}
      <div className="space-y-3">
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

      {/* Explanation Section */}
      {showAnswer && explanation && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <Text strong>Explanation:</Text>
          <Paragraph className="mt-2">{explanation}</Paragraph>
        </div>
      )}
    </div>
  );
}; 