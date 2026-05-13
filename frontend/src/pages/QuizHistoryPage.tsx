import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, Typography, Tag, Button, Empty, Spin, Alert, Select, Input } from 'antd';
import { getMyQuizHistory, QuizHistoryItem } from '../services/api';
import { useAuth } from '../context/AuthContext';

const { Title, Text } = Typography;

const formatDuration = (seconds: number): string => {
  if (!seconds) return '0s';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
};

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const summarizeTypes = (item: QuizHistoryItem): string => {
  const types = (item.questionTypes || []).filter((t) => t.type && t.type !== 'Unknown');
  if (types.length === 0) return 'Mixed';
  return types.map((t) => t.type).join(', ');
};

const modeLabel: Record<string, string> = {
  'custom': 'Custom',
  'gmat-focus': 'Focus Mock',
  'di-sectional': 'DI Sectional',
};

const QuizHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthed = !!user;

  const [modeFilter, setModeFilter] = useState<string | undefined>(undefined);
  const [scoreBand, setScoreBand] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['quiz-history', user?._id],
    queryFn: () => getMyQuizHistory(1, 50),
    enabled: isAuthed,
    // Don't retry on auth failures — the response interceptor already
    // handles refresh + force-logout, and re-firing the queryFn on 401
    // just queues up duplicate redirect attempts.
    retry: (failureCount, err: any) => {
      const status = err?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  const items = data?.items || [];

  // Client-side filters. The set is small (<=50) so client-side is fine and
  // saves a roundtrip per change.
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (modeFilter && item.mode !== modeFilter) return false;
      if (scoreBand) {
        const pct = item.percentage;
        if (scoreBand === '70+' && pct < 70) return false;
        if (scoreBand === '50-69' && (pct < 50 || pct >= 70)) return false;
        if (scoreBand === '<50' && pct >= 50) return false;
      }
      if (search) {
        const haystack = `${summarizeTypes(item)} ${item.mode || ''}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [items, modeFilter, scoreBand, search]);

  if (!isAuthed) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-2xl text-center">
        <Title level={3}>Sign in to view your quiz history</Title>
        <Text className="block mb-6 text-gray-600">
          Your past attempts, scores, and review pages will show up here.
        </Text>
        <Button type="primary" onClick={() => navigate('/login')}>Log in</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-24">
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    const status = (error as any)?.response?.status;
    const isAuthErr = status === 401 || status === 403;
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Alert
          type={isAuthErr ? 'warning' : 'error'}
          message={isAuthErr ? 'Your session has expired' : "Couldn't load quiz history"}
          description={
            isAuthErr
              ? 'Please log in again to view your quiz history.'
              : 'Please refresh and try again. If the problem persists, contact support.'
          }
          showIcon
          action={
            isAuthErr ? (
              <Button size="small" type="primary" onClick={() => navigate('/login')}>
                Log in
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex justify-between items-center mb-6">
        <Title level={2} className="mb-0">Your Quiz History</Title>
        <Button type="primary" onClick={() => navigate('/config')}>
          Start New Quiz
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="text-center py-12">
          <Empty
            description={<span>You haven't taken a quiz yet. Configure one to get started.</span>}
          >
            <Button type="primary" onClick={() => navigate('/config')}>
              Configure a quiz
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4 bg-gray-50 p-3 rounded-md">
            <Select
              allowClear
              placeholder="Mode"
              style={{ width: 160 }}
              value={modeFilter}
              onChange={setModeFilter}
              options={[
                { value: 'custom', label: 'Custom' },
                { value: 'gmat-focus', label: 'Focus Mock' },
                { value: 'di-sectional', label: 'DI Sectional' },
              ]}
            />
            <Select
              allowClear
              placeholder="Score band"
              style={{ width: 160 }}
              value={scoreBand}
              onChange={setScoreBand}
              options={[
                { value: '70+', label: '70%+' },
                { value: '50-69', label: '50–69%' },
                { value: '<50', label: 'Below 50%' },
              ]}
            />
            <Input.Search
              placeholder="Search type or mode"
              style={{ width: 240 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
            <Text className="ml-auto text-gray-500 text-sm">
              {filteredItems.length} of {items.length} attempts
            </Text>
          </div>

          <div className="space-y-4">
            {filteredItems.map((item) => {
              const pct = item.percentage;
              const pctColor = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
              return (
                <Card
                  key={item.id}
                  hoverable
                  onClick={() => navigate(`/quizzes/${item.id}`)}
                  className="shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Text strong className="text-base">{formatDate(item.createdAt)}</Text>
                        {item.mode && <Tag color="purple">{modeLabel[item.mode] || item.mode}</Tag>}
                        <Tag color="blue">{summarizeTypes(item)}</Tag>
                        {item.schema === 'legacy' && (
                          <Tag color="default" title="Older attempt — limited review detail.">Legacy</Tag>
                        )}
                      </div>
                      <Text className="text-gray-600 text-sm">
                        {item.correctAnswers} / {item.totalQuestions} correct
                        {typeof item.skippedCount === 'number' && item.skippedCount > 0 && (
                          <> &middot; {item.skippedCount} skipped</>
                        )}
                        {' '}&middot; Time: {formatDuration(item.timeSpent)}
                      </Text>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-3xl font-bold" style={{ color: pctColor }}>
                          {pct.toFixed(0)}%
                        </div>
                        <Text className="text-gray-500 text-xs">Score</Text>
                      </div>
                      <Button
                        type="link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/quizzes/${item.id}`);
                        }}
                      >
                        Review →
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

export default QuizHistoryPage;
