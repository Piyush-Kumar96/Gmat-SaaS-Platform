import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Button, Modal, Form, Input, Select, message, Alert, Tooltip, Typography,
} from 'antd';
import { QuestionCircleOutlined, MessageOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';

const { TextArea } = Input;
const { Option } = Select;
const { Paragraph } = Typography;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';
const iconProps = { onPointerEnterCapture: () => {}, onPointerLeaveCapture: () => {} };

const CATEGORIES = [
  { value: 'account_request', label: 'Request an account' },
  { value: 'quiz_issue', label: 'Issue with a quiz' },
  { value: 'question_issue', label: 'Issue with a question' },
  { value: 'billing', label: 'Billing / payment' },
  { value: 'other', label: 'Something else' },
];

// Routes where the floating button should NOT appear:
//   - /admin (admins have their own support tab)
//   - quiz-taking pages (don't break the test-taking experience)
const HIDDEN_PATHS = [
  '/admin',
  '/admin/accounts',
  '/quiz',
  '/gmat-focus-quiz',
  '/di-quiz',
];

const shouldHide = (pathname: string): boolean =>
  HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

const ContactSupportWidget: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Pre-fill name/email when the user is logged in. Refresh whenever the
  // modal opens so re-logging-in mid-session is reflected.
  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({
        name: user.fullName,
        email: user.email,
      });
    }
  }, [open, user, form]);

  if (shouldHide(location.pathname)) return null;

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await fetch(`${API_URL}/support`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...values,
          pageUrl: window.location.pathname,
        }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Submit failed');
      setSubmitted(true);
    } catch (err: any) {
      console.error(err);
      message.error(err?.message || 'Could not send your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Reset after the close animation runs.
    setTimeout(() => {
      setSubmitted(false);
      form.resetFields();
    }, 250);
  };

  return (
    <>
      <Tooltip title="Contact support" placement="left">
        <Button
          type="primary"
          shape="round"
          size="large"
          icon={<QuestionCircleOutlined {...iconProps} />}
          onClick={() => setOpen(true)}
          aria-label="Contact support"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            height: 52,
            paddingInline: 22,
            zIndex: 1000,
            boxShadow: '0 6px 20px rgba(24, 144, 255, 0.35)',
            background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
            border: 'none',
            fontWeight: 600,
          }}
        >
          Help
        </Button>
      </Tooltip>

      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <MessageOutlined style={{ color: '#1890ff', fontSize: 22 }} {...iconProps} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>Contact support</span>
          </div>
        }
        open={open}
        onCancel={handleClose}
        footer={submitted ? [
          <Button key="done" type="primary" onClick={handleClose}>Done</Button>,
        ] : [
          <Button key="cancel" onClick={handleClose}>Cancel</Button>,
          <Button key="submit" type="primary" loading={submitting} onClick={handleSubmit}>
            Send request
          </Button>,
        ]}
        width={520}
        destroyOnClose
      >
        {submitted ? (
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 8 }}
            message="Thanks — we received your message."
            description={
              <Paragraph style={{ margin: 0 }}>
                A team member will get back to you within <strong>48 hours</strong> at the email you provided.
              </Paragraph>
            }
          />
        ) : (
          <Form
            form={form}
            layout="vertical"
            initialValues={{ category: 'other' }}
          >
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="We respond within 48 hours. For urgent issues during a test, please retry the test and follow up here if the problem persists."
            />
            <Form.Item
              name="category"
              label="What do you need help with?"
              rules={[{ required: true, message: 'Please pick a category' }]}
            >
              <Select size="large">
                {CATEGORIES.map((c) => (
                  <Option key={c.value} value={c.value}>{c.label}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="name"
              label="Your name"
              rules={[{ required: true, min: 2, message: 'Please enter your name' }]}
            >
              <Input
                size="large"
                placeholder="Full name"
                disabled={!!user}
              />
            </Form.Item>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input
                size="large"
                placeholder="you@example.com"
                disabled={!!user}
              />
            </Form.Item>

            <Form.Item
              name="message"
              label="Message"
              rules={[
                { required: true, min: 5, message: 'Please describe your issue (at least 5 characters)' },
                { max: 4000, message: 'Message is too long' },
              ]}
            >
              <TextArea
                rows={5}
                placeholder="Tell us what's going on. If it's a quiz/question issue, please include the quiz id or question id if you have it."
                showCount
                maxLength={4000}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  );
};

export default ContactSupportWidget;
