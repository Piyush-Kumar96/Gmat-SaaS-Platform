import React from 'react';
import { Card, Typography, Space, Divider } from 'antd';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';
import { addStatementBreaks } from '../utils/formatStatements';
import '../styles/question-cards.css';
const { Title, Text, Paragraph } = Typography;

interface PSQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
  };
  selectedAnswer?: string;
  showAnswer?: boolean;
  correctAnswer?: string;
  explanation?: string;
  onAnswerSelect?: (answer: string) => void;
}

export const PSQuestionCard: React.FC<PSQuestionCardProps> = ({
  question,
  selectedAnswer,
  showAnswer = false,
  correctAnswer,
  explanation,
  onAnswerSelect,
}) => {
  // Function to process text and render math expressions
  const renderWithMath = (text: string) => {
    if (!text) return null;

    // Inject <br> before Roman-numeral statement markers (no-op when not a
    // multi-statement question). Done before the math split so the marker
    // injection never lands inside an inline-math token.
    text = addStatementBreaks(text);

    // Simple regex to detect math expressions
    const parts = text.split(/(\$\$.*?\$\$|\$.*?\$)/g);
    
    return parts.map((part, index) => {
      // Block math: $$...$$
      if (part.startsWith('$$') && part.endsWith('$$')) {
        const math = part.slice(2, -2);
        try {
          return <BlockMath key={index} math={math} />;
        } catch (err) {
          console.error('KaTeX error:', err);
          return <code key={index}>{math}</code>;
        }
      }
      // Inline math: $...$
      else if (part.startsWith('$') && part.endsWith('$')) {
        const math = part.slice(1, -1);
        try {
          return <InlineMath key={index} math={math} />;
        } catch (err) {
          console.error('KaTeX error:', err);
          return <code key={index}>{math}</code>;
        }
      }
      // Regular text
      else {
        return <span key={index} dangerouslySetInnerHTML={{ __html: part }} />;
      }
    });
  };

  return (
    <div className="ps-question-card">
      {/* Question Section */}
      <div className="mb-6 p-4 bg-white rounded-lg shadow-sm">
        <div className="mb-4">
          {renderWithMath(question.questionText)}
        </div>
      </div>

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
                <div className={isSelected ? 'font-medium text-blue-800' : ''}>
                  {renderWithMath(option)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Explanation Section */}
      {showAnswer && explanation && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <Text strong>Explanation:</Text>
          <div className="mt-2">
            {renderWithMath(explanation)}
          </div>
        </div>
      )}
    </div>
  );
}; 