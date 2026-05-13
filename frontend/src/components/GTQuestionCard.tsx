import React, { useState } from 'react';
import { Typography, Image, Divider, Radio } from 'antd';
import '../styles/question-cards.css';

const { Text, Paragraph } = Typography;

/**
 * GTQuestionCard renders one of three Graphs & Tables shapes:
 *
 *  1. Standard MC                     — top-level options A..E + correctAnswer letter
 *  2. Yes/No (Supported / Not)        — subQuestions[0].questionType === 'yes_no_table'
 *  3. Dropdown fill-in (saver only)   — subQuestions of multiple_choice, [[N]] markers
 *
 * The component picks the shape automatically based on the data.
 */

interface SubOption {
  value: string;
  text: string;
}

interface SubQuestion {
  questionId: string;
  questionText?: string;
  questionType: 'multiple_choice' | 'yes_no_table' | 'two_part_analysis';
  options?: SubOption[];
  statements?: { text: string }[];
  columnHeaders?: string[];
  correctAnswer?: string | string[];
}

interface GTQuestionCardProps {
  question: {
    _id: string;
    questionText: string;
    options: string[];
    artifactImages?: string[];
    artifactTables?: string[];
    artifactDescription?: string;
    subQuestions?: SubQuestion[];
  };
  selectedAnswer?: string;
  /** Map of {subQuestionId: answer}; used for YesNo + Dropdown shapes. JSON-encoded by parent. */
  selectedSubAnswers?: Record<string, any>;
  showAnswer?: boolean;
  correctAnswer?: string;
  explanation?: string;
  onAnswerSelect?: (answer: string) => void;
  /** Called for sub-shape interactions; payload is the FULL updated map. */
  onSubAnswersChange?: (next: Record<string, any>) => void;
}

const ArtifactBlock: React.FC<{
  images?: string[];
  tablesHtml?: string[];
  description?: string;
}> = ({ images = [], tablesHtml = [], description }) => {
  if (images.length === 0 && tablesHtml.length === 0 && !description) return null;
  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      {images.length > 0 && (
        <div className="space-y-4">
          {images.map((src, idx) => (
            <div key={idx} className="flex justify-center">
              <Image
                src={src}
                alt={`Graph/Chart ${idx + 1}`}
                style={{ maxWidth: '100%', maxHeight: '400px' }}
                className="rounded-lg shadow-sm"
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
              />
            </div>
          ))}
        </div>
      )}
      {tablesHtml.length > 0 && (
        <div className={`space-y-4 ${images.length > 0 ? 'mt-4' : ''}`}>
          {tablesHtml.map((html, idx) => (
            <div
              key={idx}
              className="overflow-x-auto gt-data-table"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ))}
        </div>
      )}
      {description && (
        <Paragraph className="text-xs text-gray-500 italic mt-3 mb-0">
          {description}
        </Paragraph>
      )}
    </div>
  );
};

/* ---------- Shape: standard 5-option multiple choice ---------- */

const renderMC = (question: GTQuestionCardProps['question'], selectedAnswer: string | undefined,
  showAnswer: boolean, correctAnswer: string | undefined, onAnswerSelect: ((a: string) => void) | undefined) => (
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
              ? 'border-2 border-blue-500 bg-blue-100 shadow-md'
              : isCorrect
              ? 'border-2 border-green-500 bg-green-50'
              : 'border border-gray-200 hover:border-blue-300 hover:bg-gray-50'
          }`}
          onClick={() => onAnswerSelect && onAnswerSelect(optionLetter)}
        >
          <div className="flex items-start">
            <div className={`w-7 h-7 flex items-center justify-center rounded-full mr-3 font-medium ${
              isSelected
                ? 'bg-blue-600 text-white shadow'
                : isCorrect
                ? 'bg-green-500 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}>
              {optionLetter}
            </div>
            <div className={`flex-1 ${isSelected ? 'font-medium text-blue-800' : ''}`}>
              {option}
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

/* ---------- Shape: Yes/No (Supported / Not Supported) ---------- */

const renderYesNo = (
  sub: SubQuestion,
  selectedSubAnswers: Record<string, any>,
  showAnswer: boolean,
  onSubAnswersChange: ((m: Record<string, any>) => void) | undefined
) => {
  const headers = sub.columnHeaders || ['Yes', 'No'];
  const statements = sub.statements || [];
  const selected = (selectedSubAnswers[sub.questionId] || []) as string[];
  const correct = (sub.correctAnswer || []) as string[];

  const setRow = (rowIdx: number, colIdx: '0' | '1') => {
    if (!onSubAnswersChange) return;
    const next = [...selected];
    next[rowIdx] = colIdx;
    onSubAnswersChange({ ...selectedSubAnswers, [sub.questionId]: next });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            {headers.map((h, idx) => (
              <th key={idx} className="border border-gray-300 p-2 text-center w-28 text-sm">
                {h}
              </th>
            ))}
            <th className="border border-gray-300 p-2 text-left text-sm">Statement</th>
          </tr>
        </thead>
        <tbody>
          {statements.length === 0 && (
            <tr>
              <td className="border border-gray-300 p-4 text-center text-sm text-gray-400 italic" colSpan={3}>
                No statements defined.
              </td>
            </tr>
          )}
          {statements.map((s, idx) => {
            const sel = selected[idx];
            const cor = correct[idx];
            return (
              <tr key={idx} className="hover:bg-gray-50">
                {headers.map((_, colIdx) => {
                  const isSel = sel === String(colIdx);
                  const isCor = showAnswer && cor === String(colIdx);
                  return (
                    <td key={colIdx} className="border border-gray-300 p-2 text-center">
                      <Radio
                        checked={isSel}
                        onChange={() => setRow(idx, colIdx === 0 ? '0' : '1')}
                        className={isCor && !isSel ? 'text-green-500' : ''}
                      />
                      {isCor && (
                        <span className="block mt-0.5 text-[10px] text-green-700 font-semibold">
                          ✓ correct
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="border border-gray-300 p-3 text-left text-sm">
                  {s.text || <span className="text-gray-400 italic">empty statement</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

/* ---------- Shape: Dropdown fill-in (inline interactive selects) ---------- */

interface DropdownBlanksProps {
  question: GTQuestionCardProps['question'];
  selectedSubAnswers: Record<string, any>;
  showAnswer: boolean;
  onSubAnswersChange: ((m: Record<string, any>) => void) | undefined;
}

/**
 * Renders the question text with a `<select>` per `[[N]]` blank.
 * When the parent provides `onSubAnswersChange`, the component is controlled
 * (real quiz mode). Otherwise — Question Bank / Forge preview — it falls back
 * to local uncontrolled state so the user can still play with the dropdowns.
 */
const DropdownBlanks: React.FC<DropdownBlanksProps> = ({
  question,
  selectedSubAnswers,
  showAnswer,
  onSubAnswersChange,
}) => {
  const [local, setLocal] = useState<Record<string, any>>({});
  const isControlled = !!onSubAnswersChange;
  const answers = isControlled ? selectedSubAnswers : local;

  const setAnswer = (subId: string, value: string) => {
    const next = { ...answers, [subId]: value };
    if (isControlled) onSubAnswersChange!(next);
    else setLocal(next);
  };

  const subs = question.subQuestions || [];
  const text = question.questionText || '';
  const parts = text.split(/(\[\[\d+\]\])/g);

  return (
    <div className="space-y-4">
      <div className="text-base leading-relaxed whitespace-pre-line">
        {parts.map((part, i) => {
          const m = part.match(/^\[\[(\d+)\]\]$/);
          if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
          const blankIdx = parseInt(m[1], 10) - 1;
          const sub = subs[blankIdx];
          if (!sub) {
            return (
              <span key={i} className="mx-1 text-red-500 font-mono text-sm">
                [[{m[1]}]]
              </span>
            );
          }
          const selected = (answers[sub.questionId] as string) || '';
          const isCorrect = showAnswer && selected !== '' && selected === sub.correctAnswer;
          const isWrong = showAnswer && selected !== '' && selected !== sub.correctAnswer;

          return (
            <select
              key={i}
              value={selected}
              onChange={(e) => setAnswer(sub.questionId, e.target.value)}
              className={`mx-1 px-2 py-1 border rounded text-sm align-baseline cursor-pointer ${
                isCorrect
                  ? 'border-green-500 bg-green-50 text-green-900'
                  : isWrong
                  ? 'border-red-500 bg-red-50 text-red-900'
                  : selected
                  ? 'border-blue-500 bg-blue-50 text-blue-900'
                  : 'border-gray-300 bg-white text-gray-700'
              }`}
            >
              <option value="">— select —</option>
              {(sub.options || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.text || o.value}
                </option>
              ))}
            </select>
          );
        })}
      </div>

      {showAnswer && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm">
          <Text strong className="block mb-1 text-emerald-800">Correct answers</Text>
          {subs.map((sq, idx) => {
            const correctOpt = (sq.options || []).find((o) => o.value === sq.correctAnswer);
            return (
              <div key={sq.questionId} className="text-emerald-900">
                Blank #{idx + 1}: <span className="font-semibold">{correctOpt?.text || sq.correctAnswer}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ---------- Main component ---------- */

export const GTQuestionCard: React.FC<GTQuestionCardProps> = ({
  question,
  selectedAnswer,
  selectedSubAnswers = {},
  showAnswer = false,
  correctAnswer,
  explanation,
  onAnswerSelect,
  onSubAnswersChange,
}) => {
  const sub = question.subQuestions?.[0];
  const isYesNo = sub?.questionType === 'yes_no_table';
  const isDropdown =
    !isYesNo &&
    sub?.questionType === 'multiple_choice' &&
    /\[\[\d+\]\]/.test(question.questionText || '');

  return (
    <div className="gt-question-card">
      {/* Banner */}
      <div className="mb-4 p-3 bg-teal-50 rounded-lg border border-teal-200">
        <Text strong className="text-teal-800">Graphs & Tables</Text>
        <Text className="block mt-1 text-sm text-teal-600">
          {isYesNo
            ? 'For each statement, select the column that applies.'
            : isDropdown
            ? 'Fill in each blank using the listed options.'
            : 'Analyze the data presented in the graph or table to answer the question.'}
        </Text>
      </div>

      {/* Artifact (images + tables + description below) */}
      <ArtifactBlock
        images={question.artifactImages}
        tablesHtml={question.artifactTables}
        description={question.artifactDescription}
      />

      <Divider className="my-4" />

      {/* Question / instruction text — suppressed for dropdown shape since the
          renderer embeds the text inline with the selects. */}
      {question.questionText && !isDropdown && (
        <div className="mb-4">
          <Text className="text-base font-medium whitespace-pre-line">
            {question.questionText}
          </Text>
        </div>
      )}

      {/* Body — picks shape */}
      {isYesNo && sub ? (
        renderYesNo(sub, selectedSubAnswers, showAnswer, onSubAnswersChange)
      ) : isDropdown ? (
        <DropdownBlanks
          question={question}
          selectedSubAnswers={selectedSubAnswers}
          showAnswer={showAnswer}
          onSubAnswersChange={onSubAnswersChange}
        />
      ) : (
        renderMC(question, selectedAnswer, showAnswer, correctAnswer, onAnswerSelect)
      )}

      {/* Explanation */}
      {showAnswer && explanation && (
        <div className="mt-6 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
          <Text strong className="block mb-2 text-gray-700">Explanation:</Text>
          <Paragraph className="whitespace-pre-line text-gray-600 m-0">
            {explanation}
          </Paragraph>
        </div>
      )}
    </div>
  );
};
