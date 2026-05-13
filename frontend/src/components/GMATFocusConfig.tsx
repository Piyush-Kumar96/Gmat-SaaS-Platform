import React, { useState } from 'react';
import { Card, Button, Select, Radio, Typography, Space, Alert } from 'antd';
import { 
  SwapOutlined, 
  ClockCircleOutlined, 
  BookOutlined,
  CalculatorOutlined,
  FileTextOutlined,
  BarChartOutlined,
  CoffeeOutlined
} from '@ant-design/icons';
import { GMATSection, GMATSectionConfig } from '../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface GMATFocusConfigProps {
  onStartMockTest: (sectionOrder: GMATSection[], breakAfterSection: number) => void;
  loading?: boolean;
}

const GMATFocusConfig: React.FC<GMATFocusConfigProps> = ({ onStartMockTest, loading = false }) => {
  const [sectionOrder, setSectionOrder] = useState<GMATSection[]>([
    'Quantitative Reasoning',
    'Verbal Reasoning',
    'Data Insights'
  ]);
  const [breakAfterSection, setBreakAfterSection] = useState<number>(1);

  // GMAT Focus section configurations
  const sectionConfigs: Record<GMATSection, GMATSectionConfig> = {
    'Quantitative Reasoning': {
      name: 'Quantitative Reasoning',
      questionCount: 21,
      timeLimit: 45,
      questionTypes: ['Problem Solving'],
      categories: ['Quantitative Reasoning']
    },
    'Verbal Reasoning': {
      name: 'Verbal Reasoning', 
      questionCount: 23,
      timeLimit: 45,
      questionTypes: ['Reading Comprehension', 'Critical Reasoning'],
      categories: ['Verbal Reasoning']
    },
    'Data Insights': {
      name: 'Data Insights',
      questionCount: 20,
      timeLimit: 45,
      questionTypes: ['Data Sufficiency', 'Table Analysis', 'Graphics Interpretation', 'Two-Part Analysis', 'Multi-Source Reasoning'],
      categories: ['Data Insights']
    }
  };

  const sectionIcons: Record<GMATSection, React.ReactNode> = {
    'Quantitative Reasoning': <CalculatorOutlined className="text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />,
    'Verbal Reasoning': <FileTextOutlined className="text-green-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />,
    'Data Insights': <BarChartOutlined className="text-purple-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
  };

  const handleSectionOrderChange = (value: GMATSection, index: number) => {
    const newOrder = [...sectionOrder];
    newOrder[index] = value;
    setSectionOrder(newOrder);
  };

  const handleStartTest = () => {
    onStartMockTest(sectionOrder, breakAfterSection);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <Card className="mb-6">
        <div className="text-center mb-6">
          <Title level={2} className="flex items-center justify-center mb-4">
            <BookOutlined className="mr-3 text-purple-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
            GMAT Focus Edition Mock Test
          </Title>
          <Text className="text-lg text-gray-600">
            Complete 3-section exam • 64 questions • 2 hours 15 minutes
          </Text>
        </div>

        {/* Test Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {Object.values(sectionConfigs).map((section) => (
            <div key={section.name} className="bg-gray-50 rounded-lg p-4 text-center">
              <div className="text-2xl mb-2">
                {sectionIcons[section.name]}
              </div>
              <Title level={4} className="mb-2">{section.name}</Title>
              <Text className="text-gray-600 block">{section.questionCount} questions</Text>
              <Text className="text-gray-600 block">{section.timeLimit} minutes</Text>
            </div>
          ))}
        </div>

        {/* Section Order Configuration */}
        <Card title={
          <div className="flex items-center">
            <SwapOutlined className="mr-2 text-blue-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
            Choose Section Order
          </div>
        } className="mb-6">
          <Text className="text-gray-600 block mb-4">
            Select the order in which you want to take the three sections. You can arrange them in any sequence that works best for you.
          </Text>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((index) => (
              <div key={index}>
                <Text strong className="block mb-2">Section {index + 1}:</Text>
                <Select
                  value={sectionOrder[index]}
                  onChange={(value) => handleSectionOrderChange(value, index)}
                  className="w-full"
                  size="large"
                >
                  {Object.keys(sectionConfigs).map((section) => (
                    <Option 
                      key={section} 
                      value={section}
                      disabled={sectionOrder.includes(section as GMATSection) && sectionOrder[index] !== section}
                    >
                      <div className="flex items-center">
                        {sectionIcons[section as GMATSection]}
                        <span className="ml-2">{section}</span>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </Card>

        {/* Break Configuration */}
        <Card title={
          <div className="flex items-center">
            <CoffeeOutlined className="mr-2 text-orange-500" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
            Optional 10-Minute Break
          </div>
        } className="mb-6">
          <Text className="text-gray-600 block mb-4">
            You can take one optional 10-minute break during your exam. Choose when you'd like to take it:
          </Text>
          
          <Radio.Group 
            value={breakAfterSection} 
            onChange={(e) => setBreakAfterSection(e.target.value)}
            className="w-full"
          >
            <div className="space-y-3">
              <Radio value={1} className="flex items-center">
                <div className="ml-2">
                  <Text strong>After Section 1</Text>
                  <Text className="block text-gray-500 text-sm">
                    Take break after completing {sectionOrder[0]}
                  </Text>
                </div>
              </Radio>
              <Radio value={2} className="flex items-center">
                <div className="ml-2">
                  <Text strong>After Section 2</Text>
                  <Text className="block text-gray-500 text-sm">
                    Take break after completing {sectionOrder[1]}
                  </Text>
                </div>
              </Radio>
              <Radio value={0} className="flex items-center">
                <div className="ml-2">
                  <Text strong>No Break</Text>
                  <Text className="block text-gray-500 text-sm">
                    Complete all sections without taking a break
                  </Text>
                </div>
              </Radio>
            </div>
          </Radio.Group>
        </Card>

        {/* Summary */}
        <Alert
          message="Test Summary"
          description={
            <div className="mt-2">
              <Text>
                <strong>Section Order:</strong> {sectionOrder.join(' → ')}
              </Text>
              <br />
              <Text>
                <strong>Break:</strong> {
                  breakAfterSection === 0 
                    ? 'No break' 
                    : `10 minutes after ${sectionOrder[breakAfterSection - 1]}`
                }
              </Text>
              <br />
              <Text>
                <strong>Total Time:</strong> 2 hours 15 minutes {breakAfterSection > 0 ? '+ 10 minute break' : ''}
              </Text>
            </div>
          }
          type="info"
          className="mb-6"
        />

        {/* Start Button */}
        <div className="text-center">
          <Button
            type="primary"
            size="large"
            onClick={handleStartTest}
            loading={loading}
            className="px-12 py-3 text-lg font-semibold"
            style={{ height: 'auto' }}
          >
            <ClockCircleOutlined className="mr-2" onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
            Start GMAT Focus Mock Test
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GMATFocusConfig; 