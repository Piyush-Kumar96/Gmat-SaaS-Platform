import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  message,
  Input,
  Tag,
  Space,
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Tooltip,
  Divider,
  Alert,
  Empty,
  Avatar,
  Badge,
  Layout,
  Drawer,
  DatePicker,
  Checkbox,
  Switch,
  Tabs,
  List,
  Timeline,
  Progress,
  Dropdown,
  Menu
} from 'antd';
import {
  UserOutlined,
  CrownOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  TeamOutlined,
  TrophyOutlined,
  CalendarOutlined,
  DollarOutlined,
  FilterOutlined,
  ExportOutlined,
  PlusOutlined,
  SettingOutlined,
  EyeOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  BarChartOutlined,
  SaveOutlined,
  CloseOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { User } from '../types/auth';
import moment from 'moment';
import AccessRequestsTab from './admin/AccessRequestsTab';
import SupportRequestsTab from './admin/SupportRequestsTab';
import { LockOutlined, MailOutlined, MessageOutlined, CopyOutlined } from '@ant-design/icons';

const { Option } = Select;
const { Title, Text } = Typography;
const { Content } = Layout;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5006/api';

interface Analytics {
  users: {
    total: number;
    paid: number;
    free: number;
    admin: number;
    newThisWeek: number;
    newThisMonth: number;
    activeThisWeek: number;
    byPlan: Record<string, number>;
  };
  payments: {
    totalPayments: number;
    totalRevenue: number;
    revenueThisMonth: number;
    paymentsThisMonth: number;
  };
  quizzes: {
    total: number;
    thisWeek: number;
  };
  conversionRate: string;
}

interface UserDetails {
  user: User;
  quizHistory: Array<{
    _id: string;
    score: number;
    totalQuestions: number;
    correctAnswers: number;
    timeSpent: number;
    createdAt: string;
  }>;
  paymentHistory: Array<{
    _id: string;
    amount: number;
    status: string;
    subscriptionPlan: string;
    createdAt: string;
  }>;
  quizStats: {
    totalQuizzes: number;
    averageScore: number;
    totalQuestionsAnswered: number;
    totalCorrect: number;
    averageTimePerQuiz: number;
  };
  paymentStats: {
    totalPayments: number;
    totalAmount: number;
    successfulPayments: number;
  };
}

interface Filters {
  role: string[];
  dateFrom: string | null;
  dateTo: string | null;
  search: string;
}

const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [tableLoading, setTableLoading] = useState(false);

  // New state for enhanced features
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [userDetailVisible, setUserDetailVisible] = useState(false);
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  // Repeat-ledger state for the user detail drawer. Lives outside
  // userDetails so we can refetch after a reset without re-fetching the
  // whole user payload.
  const [repeatLedgerStats, setRepeatLedgerStats] = useState<{ total: number; byType: Array<{ _id: string; count: number }> } | null>(null);
  const [repeatLedgerLoading, setRepeatLedgerLoading] = useState(false);
  const [repeatLedgerResetting, setRepeatLedgerResetting] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    role: [],
    dateFrom: null,
    dateTo: null,
    search: ''
  });
  const [addUserForm] = Form.useForm();
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [editingKey, setEditingKey] = useState<string>('');
  const [editForm] = Form.useForm();

  // Top-level tab inside the admin panel — Users / Access Requests / Support.
  const [activeTopTab, setActiveTopTab] = useState<string>('users');

  // Password-reset modal state. The plain new password is shown to the
  // admin once and never persisted client-side beyond this modal.
  const [resetPwModalOpen, setResetPwModalOpen] = useState(false);
  const [resetPwUser, setResetPwUser] = useState<{ email: string; password: string } | null>(null);

  const handleResetPassword = async (user: User) => {
    Modal.confirm({
      title: `Reset password for ${user.email}?`,
      content: 'A new password will be generated and shown to you once. The user\'s previous password will stop working immediately.',
      okText: 'Reset password',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const token = localStorage.getItem('token');
          const resp = await fetch(`${API_URL}/admin/users/${user._id}/reset-password`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          });
          const data = await resp.json();
          if (!data.success) throw new Error(data.message || 'Failed to reset password');
          setResetPwUser({ email: data.data.email, password: data.data.password });
          setResetPwModalOpen(true);
        } catch (err: any) {
          console.error(err);
          message.error(err.message || 'Failed to reset password');
        }
      },
    });
  };

  // Fetch analytics
  const fetchAnalytics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/analytics`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setAnalytics(data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  }, []);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setTableLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '10');

      if (filters.role.length > 0) {
        params.append('role', filters.role.join(','));
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }
      if (filters.search) {
        params.append('search', filters.search);
      }

      const response = await fetch(`${API_URL}/admin/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        setUsers(data.data.users);
        setTotalUsers(data.data.total);
      } else {
        throw new Error(data.message || 'Failed to fetch users');
      }
    } catch (error) {
      console.error('Fetch users error:', error);
      message.error('Failed to fetch users. Please try again.');
    } finally {
      setTableLoading(false);
    }
  }, [currentPage, filters]);

  // Pull the repeat-ledger size + per-type breakdown for the drawer.
  const fetchRepeatLedger = async (userId: string) => {
    try {
      setRepeatLedgerLoading(true);
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/users/${userId}/repeats`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (resp.ok) setRepeatLedgerStats(await resp.json());
    } catch (err) {
      console.error('Failed to fetch repeat ledger:', err);
    } finally {
      setRepeatLedgerLoading(false);
    }
  };

  // Toggle a user's access to the legacy/imported question pool. Critical
  // CRM control per LEGAL_STRATEGY.md — when off, the user only sees their
  // own account questions; when on, they also see the legacy admin pool.
  const handleLegacyAccessToggle = async (userId: string, enabled: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/users/${userId}/legacy-access`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (!resp.ok) throw new Error('Request failed');
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Toggle failed');
      message.success(`Legacy question pool ${enabled ? 'enabled' : 'disabled'} for this user.`);
      // Update the local drawer state in place so the Switch reflects the change.
      setUserDetails((prev: any) => prev ? { ...prev, user: { ...prev.user, legacyAccessEnabled: enabled } } : prev);
    } catch (err: any) {
      console.error('Legacy access toggle error:', err);
      message.error('Failed to update legacy access.');
    }
  };

  // Toggle "all platform questions" vs "only their own uploads" for a user.
  // The switch in the UI is the inverse: ON = allow all, OFF = restricted.
  const handleAllQuestionsToggle = async (userId: string, allowAll: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/users/${userId}/restricted-to-own`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ restricted: !allowAll }),
      });
      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}));
        throw new Error(data.message || 'Request failed');
      }
      const data = await resp.json();
      if (!data.success) throw new Error(data.message || 'Toggle failed');
      message.success(allowAll
        ? 'User can now access all platform questions.'
        : 'User now restricted to their own uploads.');
      setUserDetails((prev: any) => prev
        ? { ...prev, user: { ...prev.user, restrictedToOwnQuestions: !allowAll } }
        : prev);
    } catch (err: any) {
      console.error('All-questions toggle error:', err);
      message.error(err?.message || 'Failed to update access mode.');
    }
  };

  const handleAdminResetRepeats = async (userId: string, scope?: { questionType?: string }) => {
    try {
      setRepeatLedgerResetting(true);
      const token = localStorage.getItem('token');
      const resp = await fetch(`${API_URL}/admin/users/${userId}/repeats/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: scope || {} }),
      });
      if (resp.ok) {
        const data = await resp.json();
        message.success(`Cleared ${data.deletedCount} questions${scope?.questionType ? ` for ${scope.questionType}` : ''}.`);
        await fetchRepeatLedger(userId);
      } else {
        message.error('Reset failed');
      }
    } catch (err) {
      console.error('Reset error:', err);
      message.error('Reset failed');
    } finally {
      setRepeatLedgerResetting(false);
    }
  };

  // Fetch user details
  const fetchUserDetails = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setUserDetails(data.data);
          setUserDetailVisible(true);
          // Pull the repeat ledger in parallel; the card renders progressive.
          void fetchRepeatLedger(userId);
        }
      }
    } catch (error) {
      console.error('Error fetching user details:', error);
      message.error('Failed to fetch user details');
    }
  };

  // Create new user
  const createUser = async (values: {
    email: string;
    password: string;
    fullName: string;
    phoneNumber?: string;
    role: string;
  }) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await response.json();

      if (data.success) {
        message.success('User created successfully');
        setAddUserModalVisible(false);
        addUserForm.resetFields();
        fetchUsers();
        fetchAnalytics();
      } else {
        throw new Error(data.message || 'Failed to create user');
      }
    } catch (error) {
      console.error('Create user error:', error);
      message.error(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  // Export users to CSV
  const exportUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();

      if (filters.role.length > 0) {
        params.append('role', filters.role.join(','));
      }
      if (filters.dateFrom) {
        params.append('dateFrom', filters.dateFrom);
      }
      if (filters.dateTo) {
        params.append('dateTo', filters.dateTo);
      }

      const response = await fetch(`${API_URL}/admin/export/users?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `users_export_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('Users exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export users');
    }
  };

  // Bulk operations
  const handleBulkAction = async (action: 'upgrade' | 'downgrade' | 'delete', plan?: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select users first');
      return;
    }

    if (action === 'delete') {
      Modal.confirm({
        title: 'Delete Users',
        content: `Are you sure you want to delete ${selectedRowKeys.length} users? This action cannot be undone.`,
        okText: 'Delete',
        okType: 'danger',
        onOk: () => performBulkAction(action)
      });
    } else {
      await performBulkAction(action, plan);
    }
  };

  const performBulkAction = async (action: string, plan?: string) => {
    setBulkActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users/bulk`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userIds: selectedRowKeys,
          action,
          plan
        })
      });

      const data = await response.json();

      if (data.success) {
        message.success(`${data.data.affected} users affected`);
        setSelectedRowKeys([]);
        fetchUsers();
        fetchAnalytics();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Bulk action error:', error);
      message.error('Failed to perform bulk action');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Upgrade user
  const upgradeUser = async (userId: string, plan: string) => {
    setUpgrading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users/${userId}/upgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ plan })
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message);
        setUpgradeModalVisible(false);
        setSelectedUser(null);
        fetchUsers();
        fetchAnalytics();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Upgrade error:', error);
      message.error('Failed to upgrade user');
    } finally {
      setUpgrading(false);
    }
  };

  // Downgrade user
  const downgradeUser = async (userId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users/${userId}/downgrade`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        message.success(data.message);
        fetchUsers();
        fetchAnalytics();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Downgrade error:', error);
      message.error('Failed to downgrade user');
    }
  };

  // Save edited user
  const saveUser = async (userId: string, values: any) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      });

      const data = await response.json();

      if (data.success) {
        message.success('User updated successfully');
        setEditingKey('');
        fetchUsers();
        fetchAnalytics();
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      console.error('Update user error:', error);
      message.error('Failed to update user');
    }
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingKey('');
    editForm.resetFields();
  };

  // Start editing
  const edit = (record: User) => {
    editForm.setFieldsValue({
      fullName: record.fullName,
      phoneNumber: record.phoneNumber || '',
      targetScore: record.targetScore || 700
    });
    setEditingKey(record._id);
  };

  // Check if row is being edited
  const isEditing = (record: User) => record._id === editingKey;

  // Apply filters
  const applyFilters = () => {
    setCurrentPage(1);
    setFilterModalVisible(false);
    fetchUsers();
  };

  // Clear filters
  const clearFilters = () => {
    setFilters({
      role: [],
      dateFrom: null,
      dateTo: null,
      search: ''
    });
    setSearchEmail('');
    setCurrentPage(1);
  };

  // Utility functions
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'monthly_pack': return 'blue';
      case 'quarterly_pack': return 'purple';
      case 'annual_pack': return 'gold';
      default: return 'default';
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Admin';
      case 'monthly_pack': return 'Monthly';
      case 'quarterly_pack': return 'Quarterly';
      case 'annual_pack': return 'Annual';
      case 'registered': return 'Free';
      default: return role;
    }
  };

  // Workaround for Ant Design icons TypeScript compatibility
  const iconProps = { onPointerEnterCapture: () => {}, onPointerLeaveCapture: () => {} };

  const getPlanIcon = (role: string): React.ReactNode => {
    switch (role) {
      case 'admin': return <CrownOutlined style={{ color: '#ff4d4f' }} {...iconProps} />;
      case 'monthly_pack':
      case 'quarterly_pack':
      case 'annual_pack': return <TrophyOutlined style={{ color: '#52c41a' }} {...iconProps} />;
      default: return <UserOutlined style={{ color: '#8c8c8c' }} {...iconProps} />;
    }
  };

  const getStatusIcon = (status: string): React.ReactNode => {
    switch (status) {
      case 'paid': return <CheckCircleOutlined style={{ color: '#52c41a' }} {...iconProps} />;
      case 'failed': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} {...iconProps} />;
      default: return <ClockCircleOutlined style={{ color: '#faad14' }} {...iconProps} />;
    }
  };

  // Table columns with inline editing
  const columns: ColumnsType<User> = [
    {
      title: 'User',
      key: 'user',
      width: 250,
      render: (_, user) => {
        const editable = isEditing(user);
        return editable ? (
          <Form.Item
            name="fullName"
            style={{ margin: 0 }}
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="Full Name" size="small" style={{ borderRadius: '6px' }} />
          </Form.Item>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Avatar
              size={36}
              style={{ backgroundColor: user.role === 'admin' ? '#ff4d4f' : '#1890ff' }}
            >
              {user.fullName?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{user.fullName}</div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{user.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      title: 'Email',
      key: 'email',
      width: 200,
      render: (_, user) => (
        <span style={{ fontSize: '13px', color: '#595959' }}>{user.email}</span>
      ),
    },
    {
      title: 'Plan',
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={getRoleColor(role)} icon={getPlanIcon(role)} style={{ borderRadius: '6px' }}>
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: 'Phone',
      key: 'phone',
      width: 140,
      render: (_, user) => {
        const editable = isEditing(user);
        return editable ? (
          <Form.Item
            name="phoneNumber"
            style={{ margin: 0 }}
          >
            <Input placeholder="Phone" size="small" style={{ borderRadius: '6px' }} />
          </Form.Item>
        ) : (
          <span style={{ fontSize: '13px' }}>{user.phoneNumber || 'N/A'}</span>
        );
      },
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 100,
      render: (_, user) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 600 }}>
            {user.mockTestsUsed}
          </div>
          <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
            / {user.mockTestLimit === -1 ? '∞' : user.mockTestLimit}
          </div>
        </div>
      ),
    },
    {
      title: 'Joined',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => (
        <Tooltip title={new Date(date).toLocaleString()}>
          <span style={{ fontSize: '13px' }}>{moment(date).format('MMM D, YYYY')}</span>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      fixed: 'right',
      render: (_, user) => {
        const editable = isEditing(user);
        return editable ? (
          <Space size="small">
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined {...iconProps} />}
              onClick={() => {
                editForm.validateFields().then((values) => {
                  saveUser(user._id, values);
                }).catch(() => {});
              }}
              style={{ borderRadius: '6px' }}
            >
              Save
            </Button>
            <Button
              size="small"
              icon={<CloseOutlined {...iconProps} />}
              onClick={cancelEdit}
              style={{ borderRadius: '6px' }}
            >
              Cancel
            </Button>
          </Space>
        ) : (
          <Space size="small">
            <Tooltip title="View Details">
              <Button
                size="small"
                icon={<EyeOutlined {...iconProps} />}
                onClick={() => fetchUserDetails(user._id)}
                style={{ borderRadius: '6px' }}
              />
            </Tooltip>
            <Tooltip title="Edit User">
              <Button
                type="primary"
                size="small"
                icon={<EditOutlined {...iconProps} />}
                onClick={() => edit(user)}
                disabled={editingKey !== ''}
                style={{ borderRadius: '6px' }}
              />
            </Tooltip>
            <Tooltip title="Manage Plan">
              <Button
                size="small"
                onClick={() => {
                  setSelectedUser(user);
                  setUpgradeModalVisible(true);
                }}
                style={{ borderRadius: '6px' }}
              >
                Plan
              </Button>
            </Tooltip>
            {user.role !== 'admin' && (
              <Tooltip title="Generate new password">
                <Button
                  size="small"
                  icon={<LockOutlined {...iconProps} />}
                  onClick={() => handleResetPassword(user)}
                  style={{ borderRadius: '6px' }}
                />
              </Tooltip>
            )}
            {user.role !== 'registered' && user.role !== 'admin' && (
              <Tooltip title="Downgrade">
                <Button
                  danger
                  size="small"
                  onClick={() => downgradeUser(user._id)}
                  style={{ borderRadius: '6px' }}
                >
                  Down
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // Row selection
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: User) => ({
      disabled: record.role === 'admin',
      name: record._id,
    }),
  };

  useEffect(() => {
    fetchUsers();
    fetchAnalytics();
  }, [fetchUsers, fetchAnalytics]);

  useEffect(() => {
    fetchUsers();
  }, [currentPage, filters, fetchUsers]);

  return (
    <Layout style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <Content style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        {/* Header Section */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
              }}>
                <SettingOutlined style={{ fontSize: '28px', color: 'white' }} {...iconProps} />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, fontSize: '28px', fontWeight: 700, color: '#1a1a1a' }}>
                  Admin Dashboard
                </Title>
                <Text type="secondary" style={{ fontSize: '15px', color: '#8c8c8c' }}>
                  Manage users and monitor platform activity
                </Text>
              </div>
            </div>
            {activeTopTab === 'users' && (
              <Space size="middle" wrap>
                <Button
                  size="large"
                  icon={<ExportOutlined {...iconProps} />}
                  onClick={exportUsers}
                  style={{ height: '44px', borderRadius: '8px' }}
                >
                  Export Data
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined {...iconProps} />}
                  onClick={() => setAddUserModalVisible(true)}
                  style={{ height: '44px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)' }}
                >
                  Add User
                </Button>
              </Space>
            )}
          </div>
        </div>

        <Tabs
          activeKey={activeTopTab}
          onChange={setActiveTopTab}
          size="large"
          style={{ marginBottom: 16 }}
          items={[
            {
              key: 'users',
              label: <span><TeamOutlined {...iconProps} /> Users</span>,
            },
            {
              key: 'leads',
              label: <span><MailOutlined {...iconProps} /> Access Requests</span>,
            },
            {
              key: 'support',
              label: <span><MessageOutlined {...iconProps} /> Support</span>,
            },
          ]}
        />

        {activeTopTab === 'leads' && <AccessRequestsTab />}
        {activeTopTab === 'support' && <SupportRequestsTab />}

        {activeTopTab === 'users' && (
        <>
        {/* Analytics Cards - Horizontal Layout */}
        <Row gutter={[12, 12]} style={{ marginBottom: '24px' }}>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Card
              hoverable
              style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(102, 126, 234, 0.25)',
                transition: 'all 0.3s ease'
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>Total Users</span>}
                value={analytics?.users.total || 0}
                prefix={<TeamOutlined style={{ color: 'white', fontSize: '18px' }} {...iconProps} />}
                valueStyle={{ color: 'white', fontSize: '28px', fontWeight: 700, lineHeight: '1.2' }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                +{analytics?.users.newThisWeek || 0} this week
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Card
              hoverable
              style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(240, 147, 251, 0.25)',
                transition: 'all 0.3s ease'
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>Paid Users</span>}
                value={analytics?.users.paid || 0}
                prefix={<DollarOutlined style={{ color: 'white', fontSize: '18px' }} {...iconProps} />}
                valueStyle={{ color: 'white', fontSize: '28px', fontWeight: 700, lineHeight: '1.2' }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                {analytics?.conversionRate || 0}% conversion
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Card
              hoverable
              style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(79, 172, 254, 0.25)',
                transition: 'all 0.3s ease'
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>Active Users</span>}
                value={analytics?.users.activeThisWeek || 0}
                prefix={<BarChartOutlined style={{ color: 'white', fontSize: '18px' }} {...iconProps} />}
                valueStyle={{ color: 'white', fontSize: '28px', fontWeight: 700, lineHeight: '1.2' }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                {analytics?.quizzes.thisWeek || 0} quizzes
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Card
              hoverable
              style={{
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                border: 'none',
                boxShadow: '0 4px 20px rgba(250, 112, 154, 0.25)',
                transition: 'all 0.3s ease'
              }}
              bodyStyle={{ padding: '20px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: '13px', fontWeight: 500 }}>Revenue</span>}
                value={analytics?.payments.revenueThisMonth || 0}
                prefix="₹"
                valueStyle={{ color: 'white', fontSize: '28px', fontWeight: 700, lineHeight: '1.2' }}
              />
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>
                {analytics?.payments.paymentsThisMonth || 0} payments
              </div>
            </Card>
          </Col>
        </Row>

        {/* Search and Filters - Horizontal Layout */}
        <Card 
          style={{ 
            marginBottom: '24px', 
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e8e8e8'
          }}
          bodyStyle={{ padding: '16px 20px' }}
        >
          <Space size="middle" style={{ width: '100%', display: 'flex', flexWrap: 'wrap' }} align="center">
            <Input.Search
              placeholder="Search by email, name, or phone..."
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              onSearch={(value) => {
                setFilters({ ...filters, search: value });
                setCurrentPage(1);
              }}
              prefix={<SearchOutlined {...iconProps} />}
              size="large"
              enterButton="Search"
              style={{ borderRadius: '8px', flex: '1', minWidth: '300px' }}
            />
            <Dropdown
              overlay={
                <Menu style={{ padding: '12px', minWidth: '280px' }}>
                  <Menu.Item key="title" disabled style={{ fontWeight: 600, color: '#1a1a1a', cursor: 'default' }}>
                    Filter by Plan
                  </Menu.Item>
                  <Menu.Divider />
                  {['registered', 'monthly_pack', 'quarterly_pack', 'annual_pack', 'admin'].map((role) => (
                    <Menu.Item key={role}>
                      <Checkbox
                        checked={filters.role.includes(role)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters({ ...filters, role: [...filters.role, role] });
                          } else {
                            setFilters({ ...filters, role: filters.role.filter(r => r !== role) });
                          }
                        }}
                      >
                        {getRoleLabel(role)}
                      </Checkbox>
                    </Menu.Item>
                  ))}
                  <Menu.Divider />
                  <Menu.Item key="date-range">
                    <div style={{ marginBottom: '8px', fontWeight: 500 }}>Date Range</div>
                    <RangePicker
                      style={{ width: '100%', borderRadius: '6px' }}
                      size="small"
                      value={[
                        filters.dateFrom ? moment(filters.dateFrom) : null,
                        filters.dateTo ? moment(filters.dateTo) : null
                      ]}
                      onChange={(dates) => {
                        setFilters({
                          ...filters,
                          dateFrom: dates?.[0]?.toISOString() || null,
                          dateTo: dates?.[1]?.toISOString() || null
                        });
                      }}
                    />
                  </Menu.Item>
                  <Menu.Divider />
                  <Menu.Item key="actions">
                    <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                      <Button 
                        size="small" 
                        onClick={clearFilters}
                        style={{ borderRadius: '6px' }}
                      >
                        Clear
                      </Button>
                      <Button 
                        type="primary" 
                        size="small"
                        onClick={() => {
                          applyFilters();
                        }}
                        style={{ borderRadius: '6px' }}
                      >
                        Apply
                      </Button>
                    </Space>
                  </Menu.Item>
                </Menu>
              }
              trigger={['click']}
              placement="bottomRight"
            >
              <Badge count={filters.role.length + (filters.dateFrom ? 1 : 0)} size="small" offset={[-5, 5]}>
                <Button 
                  size="large"
                  icon={<FilterOutlined {...iconProps} />} 
                  style={{ borderRadius: '8px' }}
                >
                  Filters
                </Button>
              </Badge>
            </Dropdown>
            <Button
              size="large"
              icon={<ReloadOutlined {...iconProps} />}
              onClick={() => {
                clearFilters();
                fetchUsers();
                fetchAnalytics();
              }}
              style={{ borderRadius: '8px' }}
            >
              Refresh
            </Button>
          </Space>
        </Card>

        {/* Bulk Actions */}
        {selectedRowKeys.length > 0 && (
          <Card 
            style={{ 
              marginBottom: '20px', 
              borderRadius: '12px', 
              background: 'linear-gradient(135deg, #e6f7ff 0%, #bae7ff 100%)',
              border: '1px solid #91d5ff',
              boxShadow: '0 2px 8px rgba(24, 144, 255, 0.15)'
            }}
            bodyStyle={{ padding: '16px 20px' }}
          >
            <Space size="middle" wrap style={{ width: '100%', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: '15px', color: '#1890ff' }}>
                {selectedRowKeys.length} user{selectedRowKeys.length > 1 ? 's' : ''} selected
              </Text>
              <Space size="small" wrap>
                <Button
                  size="middle"
                  loading={bulkActionLoading}
                  onClick={() => handleBulkAction('upgrade', 'monthly_pack')}
                  style={{ borderRadius: '6px' }}
                >
                  Upgrade to Monthly
                </Button>
                <Button
                  size="middle"
                  loading={bulkActionLoading}
                  onClick={() => handleBulkAction('upgrade', 'quarterly_pack')}
                  style={{ borderRadius: '6px' }}
                >
                  Upgrade to Quarterly
                </Button>
                <Button
                  size="middle"
                  loading={bulkActionLoading}
                  onClick={() => handleBulkAction('downgrade')}
                  style={{ borderRadius: '6px' }}
                >
                  Downgrade All
                </Button>
                <Button
                  danger
                  size="middle"
                  loading={bulkActionLoading}
                  onClick={() => handleBulkAction('delete')}
                  style={{ borderRadius: '6px' }}
                >
                  Delete Selected
                </Button>
                <Button 
                  size="middle"
                  onClick={() => setSelectedRowKeys([])}
                  style={{ borderRadius: '6px' }}
                >
                  Clear
                </Button>
              </Space>
            </Space>
          </Card>
        )}

        {/* Users Table */}
        <Card 
          style={{ 
            borderRadius: '16px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            border: '1px solid #e8e8e8'
          }}
          bodyStyle={{ padding: '24px' }}
        >
          <div style={{ 
            marginBottom: '24px', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <Title level={4} style={{ margin: 0, fontSize: '20px', fontWeight: 600, color: '#1a1a1a' }}>
              User Management
            </Title>
            <Badge 
              count={totalUsers} 
              showZero 
              style={{ backgroundColor: '#1890ff' }}
            >
              <Text type="secondary" style={{ fontSize: '14px', fontWeight: 500 }}>
                Total Users
              </Text>
            </Badge>
          </div>

          <Form form={editForm} component={false}>
            <Table
              rowSelection={rowSelection}
              columns={columns}
              dataSource={users}
              rowKey="_id"
              loading={tableLoading}
              components={{
                body: {
                  cell: (props: any) => {
                    const { children, ...restProps } = props;
                    const user = users.find(u => u._id === editingKey);
                    if (user && isEditing(user)) {
                      return <td {...restProps}>{children}</td>;
                    }
                    return <td {...restProps}>{children}</td>;
                  },
                },
              }}
              pagination={{
                current: currentPage,
                total: totalUsers,
                pageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => (
                  <span style={{ color: '#8c8c8c', fontSize: '13px', whiteSpace: 'nowrap' }}>
                    Showing <strong>{range[0]}-{range[1]}</strong> of <strong>{total}</strong> users
                  </span>
                ),
                onChange: (page) => setCurrentPage(page),
                onShowSizeChange: (current, size) => {
                  setCurrentPage(1);
                },
                style: { 
                  marginTop: '20px',
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px'
                },
                pageSizeOptions: ['10', '20', '50', '100'],
                responsive: true
              }}
              locale={{
                emptyText: (
                  <Empty 
                    description={
                      <span style={{ color: '#8c8c8c' }}>No users found</span>
                    }
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                )
              }}
              style={{ 
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid #e8e8e8'
              }}
              bordered
              size="middle"
            />
          </Form>
        </Card>
        </>
        )}

        {/* Password reset reveal modal */}
        <Modal
          title="Password reset"
          open={resetPwModalOpen}
          onCancel={() => { setResetPwModalOpen(false); setResetPwUser(null); }}
          footer={[
            <Button
              key="close"
              type="primary"
              onClick={() => { setResetPwModalOpen(false); setResetPwUser(null); }}
            >
              Done
            </Button>,
          ]}
          width={500}
        >
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Copy this password now"
            description="It is shown only once and is not stored in plain text. The user's previous password no longer works."
          />
          {resetPwUser && (
            <Card size="small" style={{ background: '#fafafa' }}>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Email</Text>
                <Typography.Paragraph
                  style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 14 }}
                  copyable={{ tooltips: ['Copy email', 'Copied'] }}
                >
                  {resetPwUser.email}
                </Typography.Paragraph>
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>New password</Text>
                <Typography.Paragraph
                  style={{ margin: '4px 0 0', fontFamily: 'monospace', fontSize: 16, fontWeight: 600 }}
                  copyable={{ tooltips: ['Copy password', 'Copied'] }}
                >
                  {resetPwUser.password}
                </Typography.Paragraph>
              </div>
              <Button
                icon={<CopyOutlined {...iconProps} />}
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Email: ${resetPwUser.email}\nPassword: ${resetPwUser.password}`
                  );
                  message.success('Credentials copied');
                }}
              >
                Copy both
              </Button>
            </Card>
          )}
        </Modal>

        {/* Add User Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <PlusOutlined style={{ fontSize: '20px', color: 'white' }} {...iconProps} />
              </div>
              <span style={{ fontSize: '20px', fontWeight: 600 }}>Add New User</span>
            </div>
          }
          open={addUserModalVisible}
          onCancel={() => {
            setAddUserModalVisible(false);
            addUserForm.resetFields();
          }}
          footer={null}
          width={560}
          style={{ top: 50 }}
        >
          <Form 
            form={addUserForm} 
            layout="vertical" 
            onFinish={createUser}
            style={{ marginTop: '24px' }}
          >
            <Form.Item
              name="fullName"
              label={<span style={{ fontWeight: 500 }}>Full Name</span>}
              rules={[{ required: true, message: 'Please enter full name' }]}
            >
              <Input 
                placeholder="Enter full name" 
                size="large"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>
            <Form.Item
              name="email"
              label={<span style={{ fontWeight: 500 }}>Email Address</span>}
              rules={[
                { required: true, message: 'Please enter email' },
                { type: 'email', message: 'Please enter a valid email' }
              ]}
            >
              <Input 
                placeholder="Enter email address" 
                size="large"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label={<span style={{ fontWeight: 500 }}>Password</span>}
              rules={[
                { required: true, message: 'Please enter password' },
                { min: 6, message: 'Password must be at least 6 characters' }
              ]}
            >
              <Input.Password 
                placeholder="Enter password (min. 6 characters)" 
                size="large"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>
            <Form.Item 
              name="phoneNumber" 
              label={<span style={{ fontWeight: 500 }}>Phone Number</span>}
            >
              <Input 
                placeholder="Enter phone number (optional)" 
                size="large"
                style={{ borderRadius: '8px' }}
              />
            </Form.Item>
            <Form.Item
              name="role"
              label={<span style={{ fontWeight: 500 }}>Subscription Plan</span>}
              initialValue="registered"
            >
              <Select size="large" style={{ borderRadius: '8px' }}>
                <Option value="registered">Free Plan</Option>
                <Option value="monthly_pack">Monthly Plan - ₹1,500</Option>
                <Option value="quarterly_pack">Quarterly Plan - ₹3,500</Option>
                <Option value="annual_pack">Annual Plan - ₹6,000</Option>
              </Select>
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, marginTop: '32px' }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }} size="middle">
                <Button 
                  size="large"
                  onClick={() => {
                    setAddUserModalVisible(false);
                    addUserForm.resetFields();
                  }}
                  style={{ borderRadius: '8px', minWidth: '100px' }}
                >
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit"
                  size="large"
                  style={{ borderRadius: '8px', minWidth: '120px' }}
                >
                  Create User
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>


        {/* Upgrade Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Avatar size={48} style={{ backgroundColor: '#1890ff', fontSize: '18px', fontWeight: 600 }}>
                {selectedUser?.fullName?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
              <div>
                <div style={{ fontWeight: 600, fontSize: '18px', color: '#1a1a1a' }}>Upgrade User Plan</div>
                <div style={{ fontSize: '13px', color: '#8c8c8c', marginTop: '4px' }}>{selectedUser?.email}</div>
              </div>
            </div>
          }
          open={upgradeModalVisible}
          onCancel={() => {
            setUpgradeModalVisible(false);
            setSelectedUser(null);
          }}
          footer={null}
          width={560}
          style={{ top: 50 }}
        >
          <Form
            layout="vertical"
            onFinish={(values) => {
              if (selectedUser) {
                upgradeUser(selectedUser._id, values.plan);
              }
            }}
            style={{ marginTop: '24px' }}
          >
            <Alert
              message="Current Subscription"
              description={
                <div style={{ marginTop: '8px' }}>
                  <Tag 
                    color={getRoleColor(selectedUser?.role || '')} 
                    style={{ fontSize: '13px', padding: '4px 12px', borderRadius: '6px' }}
                  >
                    {getRoleLabel(selectedUser?.role || '')}
                  </Tag>
                </div>
              }
              type="info"
              style={{ marginBottom: '24px', borderRadius: '8px' }}
              showIcon
            />

            <Form.Item
              label={<span style={{ fontWeight: 500 }}>Select New Plan</span>}
              name="plan"
              rules={[{ required: true, message: 'Please select a plan' }]}
            >
              <Select 
                placeholder="Choose a subscription plan" 
                size="large"
                style={{ borderRadius: '8px' }}
              >
                <Option value="monthly_pack">
                  <Space>
                    <CalendarOutlined {...iconProps} />
                    <span style={{ fontWeight: 500 }}>Monthly Plan - ₹1,500</span>
                  </Space>
                </Option>
                <Option value="quarterly_pack">
                  <Space>
                    <CalendarOutlined {...iconProps} />
                    <span style={{ fontWeight: 500 }}>Quarterly Plan - ₹3,500</span>
                  </Space>
                </Option>
                <Option value="annual_pack">
                  <Space>
                    <TrophyOutlined {...iconProps} />
                    <span style={{ fontWeight: 500 }}>Annual Plan - ₹6,000</span>
                  </Space>
                </Option>
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: '32px' }}>
              <Space style={{ width: '100%', justifyContent: 'flex-end' }} size="middle">
                <Button 
                  size="large"
                  onClick={() => {
                    setUpgradeModalVisible(false);
                    setSelectedUser(null);
                  }}
                  style={{ borderRadius: '8px', minWidth: '100px' }}
                >
                  Cancel
                </Button>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={upgrading}
                  size="large"
                  style={{ borderRadius: '8px', minWidth: '120px' }}
                >
                  Upgrade User
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        {/* User Details Drawer */}
        <Drawer
          title={
            userDetails && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Avatar size={48} style={{ backgroundColor: '#1890ff' }}>
                  {userDetails.user.fullName?.charAt(0).toUpperCase() || 'U'}
                </Avatar>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px' }}>{userDetails.user.fullName}</div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{userDetails.user.email}</div>
                </div>
              </div>
            )
          }
          placement="right"
          width={600}
          onClose={() => {
            setUserDetailVisible(false);
            setUserDetails(null);
          }}
          open={userDetailVisible}
        >
          {userDetails && (
            <Tabs defaultActiveKey="overview">
              <TabPane tab="Overview" key="overview">
                <Card size="small" style={{ marginBottom: '16px' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={12}>
                      <Statistic title="Plan" value={getRoleLabel(userDetails.user.role)} prefix={getPlanIcon(userDetails.user.role)} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="Tests Used" value={`${userDetails.user.mockTestsUsed} / ${userDetails.user.mockTestLimit === -1 ? '∞' : userDetails.user.mockTestLimit}`} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="Phone" value={userDetails.user.phoneNumber || 'N/A'} />
                    </Col>
                    <Col span={12}>
                      <Statistic title="Target Score" value={userDetails.user.targetScore || 700} />
                    </Col>
                  </Row>
                </Card>

                <Title level={5}>Tenancy &amp; Access</Title>
                <Card size="small" style={{ marginBottom: '16px' }}>
                  <Row gutter={[16, 16]} align="middle">
                    <Col span={12}>
                      <div style={{ fontWeight: 500 }}>Account role</div>
                      <div style={{ color: '#8c8c8c', fontSize: 13 }}>
                        {userDetails.user.accountRole || '—'}
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>All platform questions</div>
                      <Switch
                        checked={!userDetails.user.restrictedToOwnQuestions}
                        onChange={(checked) => handleAllQuestionsToggle(userDetails.user._id, checked)}
                        checkedChildren="All"
                        unCheckedChildren="Own only"
                      />
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                        ON: user sees every question on the platform. OFF: user is restricted to questions in their own account (their uploads). Useful for sandboxing friends-testers.
                      </div>
                    </Col>
                    <Col span={24}>
                      <div style={{ fontWeight: 500, marginBottom: 4 }}>Legacy question pool</div>
                      <Switch
                        checked={!!userDetails.user.legacyAccessEnabled}
                        onChange={(checked) => handleLegacyAccessToggle(userDetails.user._id, checked)}
                        checkedChildren="On"
                        unCheckedChildren="Off"
                      />
                      <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
                        Only meaningful in tenant_scoped mode. When ON, this user also sees the legacy / imported admin question bank in addition to their own account&apos;s questions.
                      </div>
                    </Col>
                  </Row>
                </Card>

                <Title level={5}>Quiz Performance</Title>
                <Card size="small" style={{ marginBottom: '16px' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Statistic title="Total Quizzes" value={userDetails.quizStats.totalQuizzes} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Avg Score" value={userDetails.quizStats.averageScore} suffix="%" />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Questions" value={userDetails.quizStats.totalQuestionsAnswered} />
                    </Col>
                  </Row>
                  {userDetails.quizStats.totalQuizzes > 0 && (
                    <Progress
                      percent={Math.round((userDetails.quizStats.totalCorrect / userDetails.quizStats.totalQuestionsAnswered) * 100)}
                      status="active"
                      style={{ marginTop: '16px' }}
                    />
                  )}
                </Card>

                <Title level={5}>Payment Summary</Title>
                <Card size="small" style={{ marginBottom: '16px' }}>
                  <Row gutter={[16, 16]}>
                    <Col span={8}>
                      <Statistic title="Total Paid" value={userDetails.paymentStats.totalAmount} prefix="₹" />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Payments" value={userDetails.paymentStats.totalPayments} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Successful" value={userDetails.paymentStats.successfulPayments} />
                    </Col>
                  </Row>
                </Card>

                <Title level={5}>No-Repeat Ledger</Title>
                <Card size="small">
                  {repeatLedgerLoading && !repeatLedgerStats ? (
                    <span style={{ color: '#8c8c8c' }}>Loading…</span>
                  ) : (
                    <>
                      <Row gutter={[16, 16]}>
                        <Col span={12}>
                          <Statistic title="Questions in ledger" value={repeatLedgerStats?.total ?? 0} />
                        </Col>
                        <Col span={12}>
                          <Button
                            danger
                            type="primary"
                            loading={repeatLedgerResetting}
                            disabled={(repeatLedgerStats?.total ?? 0) === 0}
                            onClick={() => {
                              Modal.confirm({
                                title: `Reset no-repeat list for ${userDetails.user.email}?`,
                                content: 'This wipes every question in the user\'s no-repeat list. They\'ll be eligible to receive any of these questions again. Reset for support / recovery only.',
                                okText: 'Reset',
                                okButtonProps: { danger: true },
                                onOk: () => handleAdminResetRepeats(userDetails.user._id),
                              });
                            }}
                          >
                            Reset all
                          </Button>
                        </Col>
                      </Row>
                      {repeatLedgerStats && repeatLedgerStats.byType.length > 0 && (
                        <div style={{ marginTop: 12 }}>
                          {repeatLedgerStats.byType.map((row) => (
                            <Tag
                              key={row._id || 'unknown'}
                              color="blue"
                              style={{ marginBottom: 4, cursor: 'pointer' }}
                              onClick={() => {
                                Modal.confirm({
                                  title: `Reset only ${row._id}?`,
                                  content: `Removes ${row.count} ${row._id} questions from the user's no-repeat list. Other types stay locked.`,
                                  okText: 'Reset',
                                  okButtonProps: { danger: true },
                                  onOk: () => handleAdminResetRepeats(userDetails.user._id, { questionType: row._id }),
                                });
                              }}
                            >
                              {row._id}: {row.count} ×
                            </Tag>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </Card>
              </TabPane>

              <TabPane tab="Quiz History" key="quizzes">
                <List
                  dataSource={userDetails.quizHistory}
                  renderItem={(quiz) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={<HistoryOutlined {...iconProps} />} style={{ backgroundColor: '#1890ff' }} />}
                        title={`Score: ${quiz.score}/${quiz.totalQuestions} (${Math.round((quiz.score / quiz.totalQuestions) * 100)}%)`}
                        description={
                          <Space>
                            <span>{moment(quiz.createdAt).format('MMM D, YYYY h:mm A')}</span>
                            <span>•</span>
                            <span>{Math.round(quiz.timeSpent / 60)} mins</span>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                  locale={{ emptyText: 'No quiz history' }}
                />
              </TabPane>

              <TabPane tab="Payment History" key="payments">
                <Timeline>
                  {userDetails.paymentHistory.map((payment) => (
                    <Timeline.Item
                      key={payment._id}
                      dot={getStatusIcon(payment.status)}
                    >
                      <div>
                        <strong>₹{payment.amount}</strong> - {payment.subscriptionPlan.replace('_', ' ')}
                      </div>
                      <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                        {moment(payment.createdAt).format('MMM D, YYYY h:mm A')}
                        <Tag style={{ marginLeft: '8px' }} color={payment.status === 'paid' ? 'green' : payment.status === 'failed' ? 'red' : 'orange'}>
                          {payment.status}
                        </Tag>
                      </div>
                    </Timeline.Item>
                  ))}
                </Timeline>
                {userDetails.paymentHistory.length === 0 && (
                  <Empty description="No payment history" />
                )}
              </TabPane>
            </Tabs>
          )}
        </Drawer>
      </Content>
    </Layout>
  );
};

export default AdminPanel;
