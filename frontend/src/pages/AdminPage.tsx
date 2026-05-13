import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import AdminPanel from '../components/AdminPanel';
import { Alert, Spin } from 'antd';

const AdminPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin } = useRoleAccess();

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
      }}>
        <Spin size="large" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Show access denied if not admin
  if (!isAdmin) {
    return (
      <div style={{ 
        padding: '24px', 
        maxWidth: '600px', 
        margin: '0 auto',
        marginTop: '100px'
      }}>
        <Alert
          message="Access Denied"
          description="You don't have permission to access the admin panel. Only administrators can view this page."
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Render admin panel for admin users
  return <AdminPanel />;
};

export default AdminPage; 