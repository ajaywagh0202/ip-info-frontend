import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Toast from './Toast.jsx';
import ProfileDropdown from './ProfileDropdown.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';
import { clearAdminSession } from '../utils/adminAuth.js';

export default function AdminLayout({ children }) {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    const onToast = (event) => setToast(event.detail);
    window.addEventListener('app-toast', onToast);
    return () => window.removeEventListener('app-toast', onToast);
  }, []);

  const logout = () => {
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  const notify = (message, type = 'success') => setToast({ message, type });

  return (
    <div className="admin-layout">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <header className="admin-header">
        <div>
          <strong>Central Railways</strong>
          <span>ITC System Register Portal</span>
        </div>
        <div className="admin-header-right">
          <ProfileDropdown onChangePassword={() => setPasswordOpen(true)} onLogout={logout} />
        </div>
      </header>
      <div className="admin-body">
        <Sidebar />
        <main className="admin-main">{children}</main>
      </div>
      {passwordOpen ? (
        <ChangePasswordModal
          onClose={() => setPasswordOpen(false)}
          onSuccess={() => notify('Password changed successfully.')}
        />
      ) : null}
    </div>
  );
}
