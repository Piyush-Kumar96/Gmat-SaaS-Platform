import React, { useCallback, useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Card, Typography, message, Modal, Input, Select,
  Tooltip, Popconfirm, Empty, Alert,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined, KeyOutlined, DeleteOutlined, CopyOutlined, MailOutlined,
  PhoneOutlined, SearchOutlined,
} from '@ant-design/icons';
import moment from 'moment';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';
const iconProps = { onPointerEnterCapture: () => {}, onPointerLeaveCapture: () => {} };

interface Lead {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  source: string;
  status: 'new' | 'contacted' | 'converted' | 'rejected';
  notes?: string;
  convertedUserId?: string;
  createdAt: string;
}

interface GeneratedCreds {
  email: string;
  fullName: string;
  password: string;
  role: string;
}

const AccessRequestsTab: React.FC = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [convertModalOpen, setConvertModalOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState<Lead | null>(null);
  const [convertRole, setConvertRole] = useState<string>('registered');
  const [convertLoading, setConvertLoading] = useState(false);
  const [credsModalOpen, setCredsModalOpen] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<GeneratedCreds | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (search) params.append('search', search);
      const resp = await fetch(`${API_URL}/admin/leads?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (data.success) setLeads(data.data.leads);
      else throw new Error(data.message || 'Failed to fetch leads');
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to fetch access requests');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const openConvertModal = (lead: Lead) => {
    setConvertingLead(lead);
    setConvertRole('registered');
    setConvertModalOpen(true);
  };

  const handleConvert = async () => {
    if (!convertingLead) return;
    setConvertLoading(true);
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/leads/${convertingLead._id}/convert`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: convertRole }),
      });
      const data = await resp.json();
      if (resp.status === 409) {
        message.warning(data.message || 'User already exists.');
        setConvertModalOpen(false);
        fetchLeads();
        return;
      }
      if (!data.success) throw new Error(data.message || 'Conversion failed');
      setGeneratedCreds(data.data);
      setConvertModalOpen(false);
      setCredsModalOpen(true);
      fetchLeads();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to generate credentials');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleDelete = async (lead: Lead) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/leads/${lead._id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Delete failed');
      message.success('Access request deleted');
      fetchLeads();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to delete');
    }
  };

  const handleStatusChange = async (lead: Lead, status: Lead['status']) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/leads/${lead._id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Update failed');
      fetchLeads();
    } catch (err: any) {
      console.error(err);
      message.error(err.message || 'Failed to update');
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => message.success(`${label} copied`),
      () => message.error(`Could not copy ${label}`)
    );
  };

  const statusColor = (s: Lead['status']) => {
    switch (s) {
      case 'new': return 'blue';
      case 'contacted': return 'orange';
      case 'converted': return 'green';
      case 'rejected': return 'red';
      default: return 'default';
    }
  };

  const columns: ColumnsType<Lead> = [
    {
      title: 'Requester',
      key: 'requester',
      render: (_, lead) => (
        <div>
          <div style={{ fontWeight: 600 }}>{lead.name}</div>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            <MailOutlined {...iconProps} /> {lead.email}
          </div>
          {lead.phone && (
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>
              <PhoneOutlined {...iconProps} /> {lead.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Source',
      dataIndex: 'source',
      key: 'source',
      width: 130,
      render: (src: string) => <Tag>{src.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: Lead['status'], lead) => (
        <Select
          value={status}
          size="small"
          style={{ width: 130 }}
          onChange={(v) => handleStatusChange(lead, v)}
          disabled={status === 'converted'}
        >
          <Option value="new"><Tag color="blue">New</Tag></Option>
          <Option value="contacted"><Tag color="orange">Contacted</Tag></Option>
          <Option value="rejected"><Tag color="red">Rejected</Tag></Option>
          <Option value="converted" disabled><Tag color="green">Converted</Tag></Option>
        </Select>
      ),
    },
    {
      title: 'Submitted',
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
      width: 220,
      fixed: 'right',
      render: (_, lead) => (
        <Space size="small">
          <Tooltip title={lead.status === 'converted' ? 'Already converted' : 'Generate credentials & create user'}>
            <Button
              type="primary"
              size="small"
              icon={<KeyOutlined {...iconProps} />}
              disabled={lead.status === 'converted'}
              onClick={() => openConvertModal(lead)}
            >
              Generate
            </Button>
          </Tooltip>
          <Popconfirm
            title="Delete this request? This cannot be undone."
            okText="Delete"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDelete(lead)}
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
            placeholder="Search name, email, phone..."
            prefix={<SearchOutlined {...iconProps} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={fetchLeads}
            style={{ width: 280 }}
          />
          <Select
            placeholder="All statuses"
            allowClear
            value={statusFilter || undefined}
            onChange={(v) => setStatusFilter(v || '')}
            style={{ width: 160 }}
          >
            <Option value="new">New</Option>
            <Option value="contacted">Contacted</Option>
            <Option value="converted">Converted</Option>
            <Option value="rejected">Rejected</Option>
          </Select>
          <Button icon={<ReloadOutlined {...iconProps} />} onClick={fetchLeads}>
            Refresh
          </Button>
        </Space>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Table
          columns={columns}
          dataSource={leads}
          loading={loading}
          rowKey="_id"
          locale={{ emptyText: <Empty description="No access requests yet" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          scroll={{ x: 800 }}
        />
      </Card>

      {/* Convert (generate credentials) modal */}
      <Modal
        title={`Generate credentials for ${convertingLead?.name || ''}`}
        open={convertModalOpen}
        onCancel={() => setConvertModalOpen(false)}
        onOk={handleConvert}
        okText="Generate"
        confirmLoading={convertLoading}
        destroyOnClose
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="A new user account will be created for the email below. The system will generate a password — make sure to copy and share it with the user (we don't store the plain password)."
        />
        <div style={{ marginBottom: 12 }}>
          <Text strong>Email:</Text> <Text copyable>{convertingLead?.email}</Text>
        </div>
        <div style={{ marginBottom: 12 }}>
          <Text strong>Name:</Text> {convertingLead?.name}
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>Initial plan:</Text>
        </div>
        <Select value={convertRole} onChange={setConvertRole} style={{ width: '100%' }}>
          <Option value="registered">Free</Option>
          <Option value="monthly_pack">Monthly Pack</Option>
          <Option value="quarterly_pack">Quarterly Pack</Option>
          <Option value="annual_pack">Annual Pack</Option>
        </Select>
      </Modal>

      {/* Generated credentials reveal modal */}
      <Modal
        title="Credentials generated"
        open={credsModalOpen}
        onCancel={() => { setCredsModalOpen(false); setGeneratedCreds(null); }}
        footer={[
          <Button key="close" type="primary" onClick={() => { setCredsModalOpen(false); setGeneratedCreds(null); }}>
            Done
          </Button>,
        ]}
        width={520}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="Copy these credentials now"
          description="The password is shown only once and is not stored in plain text. Share it with the user via your preferred channel."
        />
        {generatedCreds && (
          <Card size="small" style={{ background: '#fafafa' }}>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
              <Paragraph
                style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 14 }}
                copyable={{ tooltips: ['Copy email', 'Copied'] }}
              >
                {generatedCreds.email}
              </Paragraph>
            </div>
            <div style={{ marginBottom: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>Password</Text>
              <Paragraph
                style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 16, fontWeight: 600 }}
                copyable={{ tooltips: ['Copy password', 'Copied'] }}
              >
                {generatedCreds.password}
              </Paragraph>
            </div>
            <Button
              icon={<CopyOutlined {...iconProps} />}
              onClick={() => copyToClipboard(
                `Email: ${generatedCreds.email}\nPassword: ${generatedCreds.password}`,
                'Credentials'
              )}
            >
              Copy both
            </Button>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default AccessRequestsTab;
