/**
 * Smart wrappers for the DI question cards. They own the per-render state
 * (sub-question index for MSR; column-pair selection for TPA) and translate
 * between the outer answers map (keyed by `question._id`) and the inner
 * answer shapes the cards expect (keyed by sub-question id).
 *
 * The dumb cards (`MSRQuestionCard`, `TPAQuestionCard`) remain pure renderers.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { MSRQuestionCard } from './MSRQuestionCard';
import { TPAQuestionCard } from './TPAQuestionCard';
import { GTQuestionCard } from './GTQuestionCard';
import { Question } from '../types/quiz';

const safeParseObj = <T,>(s: string | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    const v = JSON.parse(s);
    return v ?? fallback;
  } catch {
    return fallback;
  }
};

interface MSRShellProps {
  question: Question;
  selectedOption?: string;     // JSON-encoded { [subId]: answer }
  onChange?: (questionId: string, encoded: string) => void;
  showAnswer?: boolean;
  /** Persisted top-level correctAnswer is empty for MSR; correctAnswers per sub live on subQuestions[i].correctAnswer */
}

export const MSRQuestionShell: React.FC<MSRShellProps> = ({
  question,
  selectedOption,
  onChange,
  showAnswer
}) => {
  // Quiz pages flatten MSR stems into per-sub-Q entries via flattenMsrSubQuestions —
  // the desired sub-index arrives on `question._msrSubIdx`. When the prop is
  // absent (admin Question Bank, unflattened contexts), fall back to local state.
  const flattenedIdx = (question as any)._msrSubIdx;
  const [localIdx, setLocalIdx] = useState(0);
  useEffect(() => {
    setLocalIdx(0);
  }, [question._id]);
  const subIdx = typeof flattenedIdx === 'number' ? flattenedIdx : localIdx;

  const selectedMap = useMemo(
    () => safeParseObj<Record<string, string | string[]>>(selectedOption, {}),
    [selectedOption]
  );

  const correctMap = useMemo(() => {
    const m: Record<string, string | string[]> = {};
    (question.subQuestions || []).forEach(sq => {
      if (sq.questionId && sq.correctAnswer !== undefined) {
        m[sq.questionId] = sq.correctAnswer as any;
      }
    });
    return m;
  }, [question.subQuestions]);

  return (
    <MSRQuestionCard
      question={question as any}
      currentSubQuestionIndex={subIdx}
      // No onSubQuestionChange when flattened — the outer pager owns navigation.
      onSubQuestionChange={typeof flattenedIdx === 'number' ? undefined : setLocalIdx}
      selectedAnswers={selectedMap}
      correctAnswers={correctMap}
      showAnswer={!!showAnswer}
      onAnswerSelect={(subQuestionId, answer) => {
        if (!onChange) return;
        const next = { ...selectedMap, [subQuestionId]: answer };
        onChange(question._id, JSON.stringify(next));
      }}
    />
  );
};

interface TPAShellProps {
  question: Question;
  selectedOption?: string;     // JSON-encoded [colA_rowIdx, colB_rowIdx]
  onChange?: (questionId: string, encoded: string) => void;
  showAnswer?: boolean;
}

export const TPAQuestionShell: React.FC<TPAShellProps> = ({
  question,
  selectedOption,
  onChange,
  showAnswer
}) => {
  const subQuestion = (question.subQuestions || [])[0];
  const subId = subQuestion?.questionId || 'tpa';

  const selectedPair = useMemo(
    () => safeParseObj<string[]>(selectedOption, ['', '']),
    [selectedOption]
  );
  const correctPair = useMemo(() => {
    const ca = subQuestion?.correctAnswer;
    return Array.isArray(ca) ? (ca as string[]) : ['', ''];
  }, [subQuestion]);

  return (
    <TPAQuestionCard
      question={question as any}
      selectedAnswers={{ [subId]: selectedPair }}
      correctAnswers={{ [subId]: correctPair }}
      showAnswer={!!showAnswer}
      onAnswerSelect={(_subQuestionId, columnIndex, rowIndex) => {
        if (!onChange) return;
        const next = [...selectedPair] as string[];
        while (next.length < 2) next.push('');
        next[columnIndex] = String(rowIndex);
        onChange(question._id, JSON.stringify(next));
      }}
    />
  );
};

interface GTShellProps {
  question: Question;
  /**
   * For MC shape: `'A'..'E'`. For YesNo / Dropdown: JSON-encoded
   * `{ [subId]: <answer> }`.
   */
  selectedOption?: string;
  onChange?: (questionId: string, encoded: string) => void;
  showAnswer?: boolean;
  correctAnswer?: string;
  explanation?: string;
}

export const GTQuestionShell: React.FC<GTShellProps> = ({
  question,
  selectedOption,
  onChange,
  showAnswer,
  correctAnswer,
  explanation
}) => {
  const sub = (question.subQuestions || [])[0];
  const isSubShape = !!sub && (sub.questionType === 'yes_no_table' || sub.questionType === 'multiple_choice');

  // For sub-shape, selectedOption is JSON map; for MC, plain letter
  const selectedSubMap = useMemo(
    () => isSubShape ? safeParseObj<Record<string, any>>(selectedOption, {}) : {},
    [isSubShape, selectedOption]
  );

  return (
    <GTQuestionCard
      question={question as any}
      selectedAnswer={isSubShape ? undefined : selectedOption}
      selectedSubAnswers={selectedSubMap}
      showAnswer={!!showAnswer}
      correctAnswer={correctAnswer}
      explanation={explanation}
      onAnswerSelect={isSubShape || !onChange ? undefined : (a) => onChange(question._id, a)}
      onSubAnswersChange={isSubShape && onChange ? (next) => onChange(question._id, JSON.stringify(next)) : undefined}
    />
  );
};
