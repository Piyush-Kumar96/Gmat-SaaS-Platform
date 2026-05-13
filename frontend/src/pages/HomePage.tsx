import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { analytics } from '../services/analytics';

const { Text } = Typography;

export const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Track page view
  useEffect(() => {
    analytics.trackPageView({
      page_name: 'Home Page'
    });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-10">GMAT Quiz Platform</h1>
        
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          {/* Start Quiz Option */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-blue-500">
            <h2 className="text-xl font-semibold mb-4 text-blue-700">Start Quiz</h2>
            <p className="text-gray-600 mb-6">
              Take a customized quiz with your preferred settings for question types, difficulty, and time limit.
            </p>
            <button
              onClick={() => navigate('/config')}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Start Quiz
            </button>
          </div>

          {/* Review Questions Option */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-purple-500">
            <h2 className="text-xl font-semibold mb-4 text-purple-700">Question Bank</h2>
            <p className="text-gray-600 mb-6">
              Administrative access to manage the question database. Review, add, edit, and organize questions for the quiz platform. (Admin Only)
            </p>
            <button
              onClick={() => navigate('/review')}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Access Question Bank
            </button>
          </div>

          {/* Import Questions Option */}
          <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow border-t-4 border-green-500 relative">
            <h2 className="text-xl font-semibold mb-4 text-green-700">Import Questions</h2>
            <p className="text-gray-600 mb-6">
              Contribute to our question bank by sharing PDFs, Excel files, or question links that you want to be added to the platform.
            </p>
            <button
              onClick={() => navigate('/import')}
              className="w-full py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              Import Questions
            </button>
            <div className="mt-4 bg-yellow-50 p-3 rounded-md border border-yellow-200">
              <Text className="text-yellow-700 text-sm">
                <span className="font-semibold">Note:</span> This feature is currently under development and will be live soon.
              </Text>
            </div>
          </div>
        </div>
        
        {/* Platform Information Box - Light Grey with Curved Edges */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-gray-100 rounded-xl p-6 shadow-sm border border-gray-200 border-t-4 border-t-gray-600">
            <div className="flex items-center mb-4">
              <InfoCircleOutlined className="text-gray-600 mr-2 text-xl" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
              <h2 className="text-2xl font-semibold text-gray-700">About GMAT Quiz Platform</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Who This Is For</h3>
                <p className="text-gray-600 mb-2">
                  GMAT Quiz Platform is ideal for:
                </p>
                <ul className="list-disc ml-5 text-gray-600">
                  <li><span className="font-medium">Intermediate to Advanced GMAT Students</span> who have mastered the core concepts and need targeted practice</li>
                  <li><span className="font-medium">Test-Day Preparation Focused Learners</span> looking to sharpen their exam-taking strategies and time management</li>
                  <li><span className="font-medium">Professionals Seeking to Improve Critical Reasoning</span> and analytical skills essential for business success</li>
                  <li><span className="font-medium">Data-Driven Thinkers</span> who want to enhance their quantitative and data insights capabilities</li>
                </ul>
                <p className="text-gray-500 text-sm mt-2 italic">
                  Note: This platform focuses on practice and skill-building rather than fundamental concept education. It's designed to complement your existing GMAT preparation materials.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">How to Use This Platform</h3>
                <ul className="list-disc ml-5 text-gray-600">
                  <li>Take <span className="font-medium">Practice Exams</span> to simulate the actual GMAT Focus Edition test experience</li>
                  <li>Use <span className="font-medium">Custom Quiz</span> to target specific question types, difficulty levels, or content areas</li>
                  <li>Visit the <span className="font-medium">Review</span> section to analyze your performance and learn from explanations</li>
                  <li>Try the <span className="font-medium">Import</span> feature to add your own study materials (coming soon)</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Key Features</h3>
                <ul className="list-disc ml-5 text-gray-600">
                  <li>Extensive question bank with over 2,800 authentic GMAT-style questions</li>
                  <li>Detailed performance analytics to track your progress</li>
                  <li>Comprehensive explanations for all questions</li>
                  <li>Adaptive difficulty that adjusts to your skill level</li>
                  <li>Mobile-friendly interface for studying on the go</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-700 mb-2">Pricing</h3>
                <Text className="text-gray-600 block mb-3">
                  Free access is available with limited features (100 practice questions, basic tracking, and limited question types).
                </Text>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <Text strong className="text-gray-700">Monthly</Text>
                    <div className="text-2xl font-bold my-2">$15/month</div>
                    <ul className="text-sm text-gray-600 list-disc ml-5">
                      <li>Full question bank access</li>
                      <li>Basic performance tracking</li>
                      <li>All question types</li>
                      <li>Unlimited practice tests</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <Text strong className="text-gray-700">Premium Quarterly</Text>
                    <div className="text-2xl font-bold my-2">$45/quarter</div>
                    <ul className="text-sm text-gray-600 list-disc ml-5">
                      <li>Full question bank access</li>
                      <li>Advanced analytics</li>
                      <li>All question types</li>
                      <li>Unlimited practice tests</li>
                      <li>Minimum 3-month commitment</li>
                    </ul>
                  </div>
                  
                  <div className="bg-white p-4 rounded-lg border border-gray-200">
                    <Text strong className="text-gray-700">Premium Annual</Text>
                    <div className="text-2xl font-bold my-2">$140/year</div>
                    <ul className="text-sm text-gray-600 list-disc ml-5">
                      <li>Everything in Premium</li>
                      <li>Save over 20%</li>
                      <li>Priority customer support</li>
                      <li>Early access to new features</li>
                    </ul>
                  </div>
                </div>
                <Text className="text-xs text-gray-500 mt-4 block">
                  * All subscriptions come with a 7-day money-back guarantee. Prices subject to change.
                </Text>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 