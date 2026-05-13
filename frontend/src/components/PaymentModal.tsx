import React, { useState, useEffect } from 'react';
import { Modal, Card, Button, Row, Col, Typography, Tag, Space, Spin } from 'antd';
import { CheckOutlined, CrownOutlined, StarOutlined } from '@ant-design/icons';
import { usePayment } from '../hooks/usePayment';
import { SubscriptionPlan } from '../types';

const { Title, Text, Paragraph } = Typography;

interface PaymentModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess: () => void;
  userDetails: {
    name: string;
    email: string;
  };
  preselectedPlan?: string;
}

const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  userDetails,
  preselectedPlan
}) => {
  const { loading, plans, fetchPlans, initiatePayment } = usePayment();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(preselectedPlan || null);

  useEffect(() => {
    if (visible) {
      fetchPlans();
    }
  }, [visible, fetchPlans]);

  useEffect(() => {
    if (preselectedPlan) {
      setSelectedPlan(preselectedPlan);
    }
  }, [preselectedPlan]);

  const handlePayment = async (planId: string) => {
    await initiatePayment(
      planId,
      userDetails,
      () => {
        onSuccess();
        onCancel();
      },
      (error) => {
        console.error('Payment failed:', error);
      }
    );
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case 'annual_pack':
        return <CrownOutlined style={{ color: '#f5222d' }} onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />;
      case 'quarterly_pack':
        return <StarOutlined style={{ color: '#fa8c16' }} onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />;
      default:
        return <CheckOutlined style={{ color: '#52c41a' }} onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />;
    }
  };

  const getPlanColor = (planName: string) => {
    switch (planName) {
      case 'annual_pack':
        return '#f5222d';
      case 'quarterly_pack':
        return '#fa8c16';
      default:
        return '#1890ff';
    }
  };

  return (
    <Modal
      title={
        <Space>
          <CrownOutlined style={{ color: '#1890ff' }} onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
          <span>Choose Your Subscription Plan</span>
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      footer={null}
      width={900}
      centered
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <Paragraph style={{ marginTop: 16 }}>Loading subscription plans...</Paragraph>
        </div>
      ) : (
        <div>
          <Paragraph style={{ textAlign: 'center', marginBottom: 24, fontSize: 16 }}>
            Unlock premium features and boost your GMAT preparation with our comprehensive plans
          </Paragraph>

          <Row gutter={[16, 16]}>
            {plans.map((plan) => (
              <Col xs={24} md={8} key={plan.id}>
                <Card
                  hoverable
                  className={`payment-plan-card ${selectedPlan === plan.id ? 'selected' : ''}`}
                  style={{
                    border: selectedPlan === plan.id ? `2px solid ${getPlanColor(plan.name)}` : '1px solid #d9d9d9',
                    borderRadius: 8,
                    height: '100%',
                  }}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div style={{ textAlign: 'center' }}>
                    {plan.popular && (
                      <Tag color="gold" style={{ marginBottom: 12 }}>
                        Most Popular
                      </Tag>
                    )}
                    
                    <div style={{ fontSize: 24, marginBottom: 8 }}>
                      {getPlanIcon(plan.name)}
                    </div>
                    
                    <Title level={4} style={{ marginBottom: 8 }}>
                      {plan.displayName}
                    </Title>
                    
                    <div style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 32, fontWeight: 'bold', color: getPlanColor(plan.name) }}>
                        ₹{plan.price}
                      </Text>
                      <Text type="secondary"> / {plan.duration}</Text>
                    </div>

                    <div style={{ textAlign: 'left', marginBottom: 20 }}>
                      {plan.features.map((feature, index) => (
                        <div key={index} style={{ marginBottom: 8 }}>
                          <CheckOutlined style={{ color: '#52c41a', marginRight: 8 }} onPointerEnterCapture={() => {}} onPointerLeaveCapture={() => {}} />
                          <Text>{feature}</Text>
                        </div>
                      ))}
                    </div>

                    <Button
                      type={selectedPlan === plan.id ? 'primary' : 'default'}
                      size="large"
                      block
                      loading={loading}
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePayment(plan.id);
                      }}
                      style={{
                        backgroundColor: selectedPlan === plan.id ? getPlanColor(plan.name) : undefined,
                        borderColor: selectedPlan === plan.id ? getPlanColor(plan.name) : undefined,
                      }}
                    >
                      {selectedPlan === plan.id ? 'Pay Now' : 'Select Plan'}
                    </Button>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <Text type="secondary">
              Secure payment powered by Razorpay • 100% money-back guarantee
            </Text>
          </div>
        </div>
      )}

      <style>{`
        .payment-plan-card.selected {
          box-shadow: 0 4px 12px rgba(24, 144, 255, 0.15);
        }
        .payment-plan-card:hover {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </Modal>
  );
};

export default PaymentModal; 