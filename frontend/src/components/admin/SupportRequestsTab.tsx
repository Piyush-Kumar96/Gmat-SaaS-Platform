import React, { useCallback, useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography, message, Modal, Input, Select,
  Tooltip, Popconfirm, Empty, Drawer, Form,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, DeleteOutlined, EyeOutlined, MailOutlined,
  SearchOutlined, MessageOutlined, SaveOutlined,
} from '@ant-design/icons';
import moment from 'moment';

const { Text, Paragraph } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';
const iconProps = { onPointerEnterCapture: () => {}, onPointerLeaveCapture: () => {} };

type SupportStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

interface SupportTicket {
  _id: string;
  name: string;
  email: string;
  userId?: string;
  category: 'account_request' | 'quiz_issue' | 'question_issue' | 'billing' | 'other';
  message: string;
  status: SupportStatus;
  adminNotes?: string;
  pageUrl?: string;
  userAgent?: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_LABELS: Record<SupportTicket['category'], string> = {
  account_request: 'Account request',
  quiz_issue: 'Quiz issue',
  question_issue: 'Question issue',
  billing: 'Billing',
  other: 'Other',
};

const STATUS_COLOR: Record<SupportStatus, string> = {
  open: 'red',
  in_progress: 'orange',
  resolved: 'green',
  closed: 'default',
};

const SupportRequestsTab: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTicket, setActiveTicket] = useState<SupportTicket | null>(null);
  const [notesForm] = Form.useForm();
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (categoryFilter) params.append('category', categoryFilter);
      if (search) params.append('search', search);
      const resp = await fetch(`${API_URL}/admin/support?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.success) setTickets(data.data.requests);
      else throw new Error(data.message || 'Failed to fetch support requests');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to fetch support requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, categoryFilter, search]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const openTicket = (ticket: SupportTicket) => {
    setActiveTicket(ticket);
    notesForm.setFieldsValue({
      status: ticket.status,
      adminNotes: ticket.adminNotes || '',
    });
    setDrawerOpen(true);
  };

  const handleSaveNotes = async () => {
    if (!activeTicket) return;
    try {
      setSavingNotes(true);
      const values = await notesForm.validateFields();
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/support/${activeTicket._id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Update failed');
      message.success('Saved');
      setActiveTicket(data.data.request);
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to save');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusChange = async (ticket: SupportTicket, status: SupportStatus) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/support/${ticket._id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Update failed');
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to update');
    }
  };

  const handleDelete = async (ticket: SupportTicket) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/support/${ticket._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Delete failed');
      message.success('Support request deleted');
      fetchTickets();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to delete');
    }
  };

  const columns: ColumnsType<SupportTicket> = [
    {
      title: 'From',
      key: 'from',
      render: (_, t) => (
        <div>
          <div style={{ fontWeight: 600 }}>
            {t.name}
            {t.userId && <Tag color="blue" style={{ marginLeft: 8 }}>User</Tag>}
          </div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            <MailOutlined {...iconProps} /> {t.email}
          </div>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 150,
      render: (c: SupportTicket['category']) => <Tag color="purple">{CATEGORY_LABELS[c] || c}</Tag>,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (msg: string) => (
        <Tooltip title={msg}>
          <span style={{ fontSize: 13 }}>{msg.length > 80 ? `${msg.slice(0, 80)}…` : msg}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: SupportStatus, ticket) => (
        <Select
          value={status}
          size="small"
          style={{ width: 130 }}
          onChange={(v) => handleStatusChange(ticket, v)}
        >
          <Option value="open"><Tag color={STATUS_COLOR.open}>Open</Tag></Option>
          <Option value="in_progress"><Tag color={STATUS_COLOR.in_progress}>In progress</Tag></Option>
          <Option value="resolved"><Tag color={STATUS_COLOR.resolved}>Resolved</Tag></Option>
          <Option value="closed"><Tag color={STATUS_COLOR.closed}>Closed</Tag></Option>
        </Select>
      ),
    },
    {
      title: 'Received',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (d: string) => (
        <Tooltip title={new Date(d).toLocaleString()}>
          <span style={{ fontSize: 13 }}>{moment(d).fromNow()}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 140,
      fixed: 'right',
      render: (_, ticket) => (
        <Space size="small">
          <Tooltip title="View / reply">
            <Button size="small" icon={<EyeOutlined {...iconProps} />} onClick={() => openTicket(ticket)} />
          </Tooltip>
          <Popconfirm
            title="Delete this ticket?"
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(ticket)}
          >
            <Button danger size="small" icon={<DeleteOutlined {...iconProps} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search name, email, message..."
            prefix={<SearchOutlined {...iconProps} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchTickets}
            style={{ width: 280 }}
          />
          <Select
            placeholder="All statuses"
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            style={{ width: 160 }}
          >
            <Option value="open">Open</Option>
            <Option value="in_progress">In progress</Option>
            <Option value="resolved">Resolved</Option>
            <Option value="closed">Closed</Option>
          </Select>
          <Select
            placeholder="All categories"
            allowClear
            value={categoryFilter || undefined}
            onChange={(v) => setCategoryFilter(v || '')}
            style={{ width: 200 }}
          >
            {(Object.keys(CATEGORY_LABELS) as Array<SupportTicket['category']>).map((c) => (
              <Option key={c} value={c}>{CATEGORY_LABELS[c]}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined {...iconProps} />} onClick={fetchTickets}>
            Refresh
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Table
          columns={columns}
          dataSource={tickets}
          loading={loading}
          rowKey="_id"
          locale={{ emptyText: <Empty description="No support requests yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 900 }}
        />
      </Card>

      <Drawer
        title={activeTicket ? `Ticket from ${activeTicket.name}` : 'Ticket'}
        width={560}
        open={drawerOpen}
        onClose={() => { setDrawerOpen(false); setActiveTicket(null); }}
        destroyOnClose
      >
        {activeTicket && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">From: </Text>
                <Text strong>{activeTicket.name}</Text> &lt;{activeTicket.email}&gt;
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Category: </Text>
                <Tag color="purple">{CATEGORY_LABELS[activeTicket.category]}</Tag>
              </div>
              <div style={{ marginBottom: 8 }}>
                <Text type="secondary">Received: </Text>
                {moment(activeTicket.createdAt).format('MMM D, YYYY h:mm A')}
              </div>
              {activeTicket.pageUrl && (
                <div style={{ marginBottom: 8, fontSize: 12, color: '#8c8c8c' }}>
                  Submitted from: <code>{activeTicket.pageUrl}</code>
                </div>
              )}
            </Card>

            <Typography.Title level={5} style={{ marginTop: 0 }}>
              <MessageOutlined {...iconProps} /> Message
            </Typography.Title>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0 }}>
                {activeTicket.message}
              </Paragraph>
            </Card>

            <Form form={notesForm} layout="vertical">
              <Form.Item label="Status" name="status">
                <Select>
                  <Option value="open">Open</Option>
                  <Option value="in_progress">In progress</Option>
                  <Option value="resolved">Resolved</Option>
                  <Option value="closed">Closed</Option>
                </Select>
              </Form.Item>
              <Form.Item label="Internal notes" name="adminNotes">
                <TextArea rows={5} placeholder="Notes for the team (not shown to user)" maxLength={4000} showCount />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<SaveOutlined {...iconProps} />}
                  loading={savingNotes}
                  onClick={handleSaveNotes}
                >
                  Save
                </Button>
              </Form.Item>
            </Form>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default SupportRequestsTab;
