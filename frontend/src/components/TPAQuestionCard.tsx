import React from 'react';
import { Typography, Radio, Image } from 'antd';
import '../styles/question-cards.css';

const { Text, Paragraph } = Typography;

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

interface TPAQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
    subQuestions?: SubQuestion[];
    artifactImages?: string[];
    artifactTables?: string[];
  };
  selectedAnswers?: Record<string, string[]>;
  showAnswer?: boolean;
  correctAnswers?: Record<string, string[]>;
  onAnswerSelect?: (subQuestionId: string, columnIndex: number, rowIndex: number) => void;
}

export const TPAQuestionCard: React.FC<TPAQuestionCardProps> = ({
  question,
  selectedAnswers = {},
  showAnswer = false,
  correctAnswers = {},
  onAnswerSelect,
}) => {
  const subQuestions = question.subQuestions || [];
  const tpaQuestion = subQuestions.find(sq => sq.questionType === 'two_part_analysis') || subQuestions[0];

  if (!tpaQuestion) {
    return (
      <div className="p-4 text-gray-500">
        No Two-Part Analysis question data available.
      </div>
    );
  }

  const columnHeaders = tpaQuestion.columnHeaders || ['Part 1', 'Part 2'];
  const rowOptions = tpaQuestion.rowOptions || [];
  const selectedValue = selectedAnswers[tpaQuestion.questionId] || [];
  const correctValue = correctAnswers[tpaQuestion.questionId] || [];

  // Handle selection - TPA has 2 columns, each can select one row
  const handleSelection = (columnIndex: number, rowIndex: number) => {
    if (onAnswerSelect) {
      onAnswerSelect(tpaQuestion.questionId, columnIndex, rowIndex);
    }
  };

  return (
    <div className="tpa-question-card">
      {/* Instructions */}
      <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
        <Text strong className="text-orange-800">Two-Part Analysis (TPA)</Text>
        <Text className="block mt-1 text-sm text-orange-600">
          Select one answer in each column. The same answer choice may be used for both columns.
        </Text>
      </div>

      {/* Question Text/Passage */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <Paragraph className="text-base whitespace-pre-line leading-relaxed">
          {question.questionText}
        </Paragraph>

        {/* Artifact images */}
        {question.artifactImages && question.artifactImages.length > 0 && (
          <div className="mt-4 space-y-4">
            {question.artifactImages.map((src, idx) => (
              <div key={idx} className="flex justify-center">
                <Image
                  src={src}
                  alt={`Artifact ${idx + 1}`}
                  style={{ maxWidth: '100%', maxHeight: '300px' }}
                  fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Sub-question text if different from main */}
      {tpaQuestion.questionText && tpaQuestion.questionText !== question.questionText && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <Text className="text-base">{tpaQuestion.questionText}</Text>
        </div>
      )}

      {/* Two-Part Analysis Table */}
      <div className="overflow-x-auto">
        {rowOptions.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400 italic border border-dashed border-gray-300 rounded-lg">
            No row options defined for this Two-Part Analysis question.
          </div>
        )}
        {rowOptions.length > 0 && (
        <table className="w-full border-collapse border border-gray-300 tpa-table">
          <thead>
            <tr className="bg-gray-100">
              {columnHeaders.map((header, idx) => (
                <th
                  key={idx}
                  className="border border-gray-300 p-3 text-center font-bold"
                  style={{ width: '90px' }}
                >
                  {header || (idx === 0 ? 'Col 1' : 'Col 2')}
                </th>
              ))}
              <th className="border border-gray-300 p-3 text-left">Value</th>
            </tr>
          </thead>
          <tbody>
            {rowOptions.map((option, rowIdx) => {
              const isCol1Selected = selectedValue[0] === String(rowIdx);
              const isCol2Selected = selectedValue[1] === String(rowIdx);
              const isCol1Correct = showAnswer && correctValue[0] === String(rowIdx);
              const isCol2Correct = showAnswer && correctValue[1] === String(rowIdx);

              return (
                <tr
                  key={rowIdx}
                  className={`hover:bg-gray-50 transition-colors ${
                    (isCol1Selected || isCol2Selected) ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Column 1 (Part 1) */}
                  <td className="border border-gray-300 p-2 text-center">
                    <div
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-all ${
                        isCol1Selected
                          ? 'bg-blue-600 text-white shadow-md'
                          : isCol1Correct
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 hover:bg-blue-100 border border-gray-300'
                      }`}
                      onClick={() => handleSelection(0, rowIdx)}
                    >
                      <Radio
                        checked={isCol1Selected}
                        onChange={() => handleSelection(0, rowIdx)}
                        className="m-0"
                      />
                    </div>
                  </td>

                  {/* Column 2 (Part 2) */}
                  <td className="border border-gray-300 p-2 text-center">
                    <div
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full cursor-pointer transition-all ${
                        isCol2Selected
                          ? 'bg-blue-600 text-white shadow-md'
                          : isCol2Correct
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 hover:bg-blue-100 border border-gray-300'
                      }`}
                      onClick={() => handleSelection(1, rowIdx)}
                    >
                      <Radio
                        checked={isCol2Selected}
                        onChange={() => handleSelection(1, rowIdx)}
                        className="m-0"
                      />
                    </div>
                  </td>

                  {/* Option Text — labelled with row index for readability */}
                  <td className={`border border-gray-300 p-3 ${
                    (isCol1Selected || isCol2Selected) ? 'font-medium text-blue-800' : ''
                  }`}>
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-gray-200 text-gray-600 text-[10px] font-semibold mr-2">
                      {rowIdx + 1}
                    </span>
                    {option || <span className="text-gray-400 italic">empty value</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        )}
      </div>

      {/* Answer indicator when showing answers */}
      {showAnswer && (
        <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
          <Text strong className="text-green-800">Correct Answers:</Text>
          <div className="mt-2">
            {columnHeaders.map((header, idx) => {
              const correctIdx = parseInt(correctValue[idx] || '0');
              return (
                <div key={idx} className="text-sm text-green-700">
                  <strong>{header}:</strong> {rowOptions[correctIdx] || 'Not available'}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
