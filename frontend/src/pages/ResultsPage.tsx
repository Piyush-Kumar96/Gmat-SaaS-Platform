import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QuizSubmission } from '../types';
import { Card, Button, Tag, Divider, Typography, Collapse } from 'antd';
import QuestionCard from '../components/QuestionCard';
import { analytics } from '../services/analytics';

const { Title, Text, Paragraph } = Typography;
const { Panel } = Collapse;

export const ResultsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const submission = location.state?.submission as QuizSubmission;
  const isGmatFocus = location.state?.isGmatFocus;
  const gmatResults = location.state?.gmatResults;

  // Track page view
  React.useEffect(() => {
    analytics.trackPageView({
      page_name: 'results',
      path: '/results'
    });
  }, []);

  // Count question types with better detection
  const getQuestionTypeCounts = () => {
    if (!submission?.results) return {};
    
    const typeCounts: Record<string, { total: number, correct: number }> = {};
    
    submission.results.forEach(result => {
      // Try to extract question type from result metadata if available
      let type = result.questionType || 'Unknown';
      
      // Fall back to extraction from explanation if no explicit type
      if (type === 'Unknown' && result.explanation) {
        // Look for common pattern like "This is a [Critical Reasoning] question"
        const match = result.explanation.match(/This is an? ([^.]+) question/i) || 
                     result.explanation.match(/This ([^.]+) question/i);
        if (match) {
          type = match[1].trim();
        }
      }
      
      if (!typeCounts[type]) {
        typeCounts[type] = { total: 0, correct: 0 };
      }
      
      typeCounts[type].total += 1;
      if (result.isCorrect) {
        typeCounts[type].correct += 1;
      }
    });
    
    return typeCounts;
  };

  // Handle GMAT Focus Edition results
  if (isGmatFocus && gmatResults) {
    const totalQuestions = gmatResults.sectionResults.reduce((sum: number, section: any) => sum + section.questionCount, 0);
    const totalCorrect = gmatResults.sectionResults.reduce((sum: number, section: any) => sum + (section.submission?.score || 0), 0);
    const overallPercentage = (totalCorrect / totalQuestions) * 100;

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Overall Results Summary */}
        <Card className="mb-8 text-center shadow-md rounded-lg">
          <Title level={2}>GMAT Focus Edition - Overall Results</Title>
          <div className="text-5xl font-bold mb-2" style={{ color: overallPercentage >= 70 ? '#10b981' : overallPercentage >= 50 ? '#f59e0b' : '#ef4444' }}>
            {overallPercentage.toFixed(1)}%
          </div>
          <Text className="text-lg">
            You got <strong>{totalCorrect}</strong> out of <strong>{totalQuestions}</strong> questions correct
          </Text>

          <div className="mt-4 px-4 py-2 bg-gray-100 rounded-md inline-block">
            <Text className="text-sm text-gray-600">
              Total time: <strong>{Math.floor(gmatResults.totalTime / 60)}</strong>m <strong>{gmatResults.totalTime % 60}</strong>s
            </Text>
          </div>
        </Card>

        {/* Section-by-Section Results */}
        <Title level={3} className="mb-4">Section Results</Title>
        <div className="space-y-6">
          {gmatResults.sectionResults.map((section: any, index: number) => {
            const sectionPercentage = section.submission ? (section.submission.score / section.questionCount) * 100 : 0;
            return (
              <Card key={index} className="shadow-md">
                <div className="flex justify-between items-center mb-4">
                  <Title level={4} className="mb-0">{section.sectionName}</Title>
                  <Tag color={sectionPercentage >= 70 ? "success" : sectionPercentage >= 50 ? "warning" : "error"} className="text-lg px-4 py-2">
                    {sectionPercentage.toFixed(1)}%
                  </Tag>
                </div>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <Text className="text-gray-600 block">Questions</Text>
                    <Text className="text-xl font-bold">{section.questionCount}</Text>
                  </div>
                  <div>
                    <Text className="text-gray-600 block">Correct</Text>
                    <Text className="text-xl font-bold text-green-600">{section.submission?.score || 0}</Text>
                  </div>
                  <div>
                    <Text className="text-gray-600 block">Time</Text>
                    <Text className="text-xl font-bold">{Math.floor(section.timeSpent / 60)}m {section.timeSpent % 60}s</Text>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 flex justify-center">
          <Button type="primary" size="large" onClick={() => navigate('/config')}>
            Start New Quiz
          </Button>
        </div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center p-8">
        <Title level={2}>No submission data found</Title>
        <Paragraph>
          There was an issue retrieving your quiz results. This might happen if you accessed this page directly.
        </Paragraph>
        <Button type="primary" onClick={() => navigate('/config')} className="mt-4">
          Start New Quiz
        </Button>
      </div>
    );
  }

  const questionTypes = getQuestionTypeCounts();
  const timeSpent = submission.timeSpent || 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Results Summary Card */}
      <Card className="mb-8 text-center shadow-md rounded-lg">
        <Title level={2}>Quiz Results</Title>
        <div className="text-5xl font-bold mb-2" style={{ color: submission.percentage >= 70 ? '#10b981' : submission.percentage >= 50 ? '#f59e0b' : '#ef4444' }}>
          {submission.percentage.toFixed(1)}%
        </div>
        <Text className="text-lg">
          You got <strong>{submission.score}</strong> out of <strong>{submission.total}</strong> questions correct
        </Text>
        
        <div className="mt-4 px-4 py-2 bg-gray-100 rounded-md inline-block">
          <Text className="text-sm text-gray-600">
            Time spent: <strong>{Math.floor(timeSpent / 60)}</strong>m <strong>{timeSpent % 60}</strong>s
          </Text>
        </div>
      </Card>

      {/* Question type statistics */}
      <Card className="mb-8 shadow-md rounded-lg" title={<Title level={4}>Performance by Question Type</Title>}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(questionTypes).map(([type, stats]) => (
            <div key={type} className="flex justify-between items-center p-3 border rounded hover:shadow-sm transition-shadow">
              <Text strong>{type}</Text>
              <div className="flex gap-2">
                <Tag color={stats.correct === stats.total ? "success" : "warning"}>
                  {stats.correct}/{stats.total} correct
                </Tag>
                <Tag color={
                  (stats.correct / stats.total) * 100 >= 70 ? "green" :
                  (stats.correct / stats.total) * 100 >= 50 ? "orange" : "red"
                }>
                  {((stats.correct / stats.total) * 100).toFixed(0)}%
                </Tag>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Title level={3} className="mb-4">Question Review</Title>
      
      <div className="space-y-6">
        {submission.results.map((result, index) => (
          <Card 
            key={result.questionId}
            className={`shadow-md hover:shadow-lg transition-shadow border-t-4 ${
              result.isCorrect ? 'border-t-green-500' : 'border-t-red-500'
            }`}
            bodyStyle={{ padding: 0 }}
          >
            {/* Question Header */}
            <div className="bg-gray-50 border-b border-gray-200 p-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <span className="font-medium mr-2">Question {index + 1}</span>
                  {result.questionType && (
                    <Tag color="blue" className="mr-2">{result.questionType}</Tag>
                  )}
                </div>
                <Tag color={result.isCorrect ? "success" : "error"} className="px-3 py-1">
                  {result.isCorrect ? 'Correct' : 'Incorrect'}
                </Tag>
              </div>
            </div>
            
            {/* Question Content */}
            <div className="p-5">
              {/* Show original question if available */}
              {result.questionText && (
                <div className="mb-4">
                  <Text strong className="block mb-2">Question:</Text>
                  <div className="bg-gray-50 p-3 rounded-md">
                    <Text>{result.questionText}</Text>
                  </div>
                </div>
              )}
              
              {/* Answer comparison */}
              <div className="flex flex-col md:flex-row md:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <Text strong className="block mb-2">Your answer:</Text>
                  <div className={`p-3 rounded-md ${result.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                    <div className="flex items-center">
                      <div className={`w-7 h-7 flex items-center justify-center rounded-full mr-3 ${
                        result.isCorrect ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                      }`}>
                        {result.userAnswer}
                      </div>
                      <Text>{result.userAnswerText || ''}</Text>
                    </div>
                  </div>
                </div>
                
                {!result.isCorrect && (
                  <div className="flex-1">
                    <Text strong className="block mb-2">Correct answer:</Text>
                    <div className="p-3 rounded-md bg-green-50 border border-green-200">
                      <div className="flex items-center">
                        <div className="w-7 h-7 flex items-center justify-center rounded-full bg-green-500 text-white mr-3">
                          {result.correctAnswer}
                        </div>
                        <Text>{result.correctAnswerText || ''}</Text>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Explanation */}
              {result.explanation && (
                <div>
                  <Collapse 
                    ghost 
                    defaultActiveKey={result.isCorrect ? [] : ['1']}
                  >
                    <Panel 
                      header={<Text strong>Explanation</Text>} 
                      key="1"
                      className="bg-yellow-50 border border-yellow-200 rounded-md"
                    >
                      <div className="px-3 py-2">
                        <Text>{result.explanation}</Text>
                      </div>
                    </Panel>
                  </Collapse>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>

      <div className="mt-8 flex justify-center">
        <Button type="primary" size="large" onClick={() => navigate('/config')} className="mr-4">
          Start New Quiz
        </Button>
        <Button onClick={() => window.print()}>Print Results</Button>
      </div>
    </div>
  );
}; 