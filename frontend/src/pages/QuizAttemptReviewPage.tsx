import React, { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Typography, Tag, Button, Spin, Alert, Tooltip, message } from 'antd';
import { BulbOutlined, ReloadOutlined, FlagOutlined } from '@ant-design/icons';
import { getMyQuizAttempt } from '../services/api';
import { QuizResult } from '../types';
import { Question } from '../types/quiz';
import QuestionCard from '../components/QuestionCard';

const { Title, Text } = Typography;

const formatDuration = (seconds: number): string => {
  const m = Math.floor((seconds || 0) / 60);
  const s = (seconds || 0) % 60;
  return `${m}m ${s}s`;
};

const formatMs = (ms?: number): string => {
  if (!ms || ms < 1000) return `${ms || 0}ms`;
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

// Convert a server `result` row into the `Question` shape that QuestionCard
// expects. Pulls options from the V2/V3 native object form into the array
// the cards render.
const resultToQuestion = (r: QuizResult): Question => {
  let optionsArr: string[] = [];
  if (Array.isArray(r.options)) {
    optionsArr = r.options as string[];
  } else if (r.options && typeof r.options === 'object') {
    optionsArr = Object.entries(r.options)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, v]) => v as string);
  }
  return {
    _id: r.questionId,
    questionText: r.questionText || '',
    questionType: r.questionType || 'Unknown',
    options: optionsArr,
    correctAnswer: r.correctAnswer || '',
    explanation: r.explanation || '',
    difficulty: 3,
    category: '',
    tags: [],
    passageText: r.passageText || undefined,
    passageId: r.passageId,
    msrSources: r.msrSources as any,
    subQuestions: r.subQuestions as any,
    artifactImages: r.artifactImages,
    artifactTables: r.artifactTables,
    artifactDescription: r.artifactDescription,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
};

const statusOf = (r: QuizResult): 'correct' | 'wrong' | 'skipped' => {
  if (r.userAnswer === null || r.userAnswer === undefined || r.userAnswer === '') return 'skipped';
  if (r.isCorrect === true) return 'correct';
  return 'wrong';
};

const statusColor: Record<string, string> = {
  correct: '#10b981',
  wrong: '#ef4444',
  skipped: '#9ca3af',
};

const QuizAttemptReviewPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: submission, isLoading, error } = useQuery({
    queryKey: ['quiz-attempt', id],
    queryFn: () => getMyQuizAttempt(id!),
    enabled: !!id,
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });

  const [filterMode, setFilterMode] = useState<'all' | 'wrong' | 'skipped' | 'flagged'>('all');

  const filteredResults = useMemo(() => {
    if (!submission) return [];
    return submission.results.filter((r) => {
      if (filterMode === 'wrong') return r.isCorrect === false;
      if (filterMode === 'skipped') return r.userAnswer === null || r.userAnswer === undefined || r.userAnswer === '';
      if (filterMode === 'flagged') return !!r.flaggedForReview;
      return true;
    });
  }, [submission, filterMode]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert
          type="error"
          message="Couldn't load this attempt"
          description="It may have been removed, or you don't have access to it."
          showIcon
        />
        <div className="mt-4">
          <Button onClick={() => navigate('/quizzes')}>Back to history</Button>
        </div>
      </div>
    );
  }

  const pct = submission.percentage;
  const pctColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const isV2 = submission.schema === 'v2';

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-4">
        <Button onClick={() => navigate('/quizzes')}>← Back to history</Button>
      </div>

      {/* ---- Summary header ---- */}
      <Card className="mb-6 shadow-md rounded-lg">
        <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="text-center md:text-left">
            <Title level={2} className="mb-1">Quiz Review</Title>
            {submission.mode && <Tag color="purple">{submission.mode}</Tag>}
            <div className="text-5xl font-bold mt-3" style={{ color: pctColor }}>
              {pct.toFixed(1)}%
            </div>
            <Text className="block mt-1 text-gray-500">
              {submission.score} / {submission.total} correct
              {typeof submission.skippedCount === 'number' && submission.skippedCount > 0 && (
                <> &middot; {submission.skippedCount} skipped</>
              )}
            </Text>
            <Text className="block mt-1 text-gray-500 text-sm">
              Time: {formatDuration(submission.timeSpent || 0)}
            </Text>
          </div>

          {/* Per-type breakdown — only on v2 attempts. */}
          {isV2 && submission.perType && submission.perType.length > 0 && (
            <div className="flex-1 w-full">
              <Text strong className="block mb-2">By Question Type</Text>
              <div className="space-y-2">
                {submission.perType.map((p) => {
                  const pt = p.total > 0 ? (p.correct / p.total) * 100 : 0;
                  return (
                    <div key={p.type}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{p.type}</span>
                        <span className="text-gray-600">
                          {p.correct}/{p.total} &middot; avg {formatMs(p.avgTimeMs)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{ width: `${pt}%`, backgroundColor: pt >= 70 ? '#10b981' : pt >= 50 ? '#f59e0b' : '#ef4444' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {!isV2 && (
          <Alert
            type="info"
            showIcon
            className="mt-4"
            message="This is a legacy attempt — per-question time and skipped detail are not available."
          />
        )}
      </Card>

      {/* ---- Filter strip + jump grid ---- */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button.Group>
          <Button type={filterMode === 'all' ? 'primary' : 'default'} onClick={() => setFilterMode('all')}>
            All ({submission.results.length})
          </Button>
          <Button type={filterMode === 'wrong' ? 'primary' : 'default'} onClick={() => setFilterMode('wrong')}>
            Incorrect ({submission.results.filter((r) => r.isCorrect === false).length})
          </Button>
          <Button type={filterMode === 'skipped' ? 'primary' : 'default'} onClick={() => setFilterMode('skipped')}>
            Skipped ({submission.results.filter((r) => r.userAnswer === null || r.userAnswer === undefined || r.userAnswer === '').length})
          </Button>
          {isV2 && (
            <Button type={filterMode === 'flagged' ? 'primary' : 'default'} onClick={() => setFilterMode('flagged')}>
              Flagged ({submission.results.filter((r) => !!r.flaggedForReview).length})
            </Button>
          )}
        </Button.Group>
      </div>

      {/* ---- Question list ---- */}
      <div className="space-y-6">
        {filteredResults.map((result, idx) => {
          const status = statusOf(result);
          const question = resultToQuestion(result);
          const order = result.order || idx + 1;
          return (
            <Card
              key={`${result.questionId}-${idx}`}
              className="shadow-md hover:shadow-lg transition-shadow border-t-4"
              style={{ borderTopColor: statusColor[status] }}
              bodyStyle={{ padding: 0 }}
            >
              <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Text strong>Question {order}</Text>
                  {result.questionType && <Tag color="blue">{result.questionType}</Tag>}
                  {typeof result.timeSpentMs === 'number' && result.timeSpentMs > 0 && (
                    <Tag color="default">⏱ {formatMs(result.timeSpentMs)}</Tag>
                  )}
                  {result.flaggedForReview && (
                    <Tag color="gold" icon={<FlagOutlined />}>Flagged</Tag>
                  )}
                </div>
                <Tag
                  color={status === 'correct' ? 'success' : status === 'wrong' ? 'error' : 'default'}
                  className="px-3 py-1"
                >
                  {status === 'correct' ? 'Correct' : status === 'wrong' ? 'Incorrect' : 'Skipped'}
                </Tag>
              </div>

              <div className="p-4">
                {/* Render via the same QuestionCard router used during the
                    quiz, in `showAnswer` mode. Single source of truth so
                    DI/RC visuals match exactly what the user attempted. */}
                <QuestionCard
                  question={question}
                  selectedOption={typeof result.userAnswer === 'string' ? result.userAnswer : undefined}
                  showAnswer
                  correctAnswer={result.correctAnswer}
                  explanation={result.explanation}
                  hidePassagePills
                />

                {/* Tutor + similar hooks. Disabled today; backlog.md for
                    real implementation. */}
                <div className="flex flex-wrap items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                  <Tooltip title="AI tutor coming soon — will explain why your answer was off and walk you through the correct approach.">
                    <Button
                      icon={<BulbOutlined />}
                      disabled
                      onClick={() => message.info('AI tutor not enabled yet — coming soon.')}
                    >
                      Explain with AI
                    </Button>
                  </Tooltip>
                  <Tooltip title="Practice similar questions — coming soon. Will use skill tags + difficulty band to find more like this.">
                    <Button
                      icon={<ReloadOutlined />}
                      disabled
                      onClick={() => message.info('Similar-question practice not enabled yet — coming soon.')}
                    >
                      More like this
                    </Button>
                  </Tooltip>
                </div>
              </div>
            </Card>
          );
        })}

        {filteredResults.length === 0 && (
          <Card className="text-center py-12">
            <Text className="text-gray-500">No questions match this filter.</Text>
          </Card>
        )}
      </div>
    </div>
  );
};

export default QuizAttemptReviewPage;
