import { useEffect, useState } from 'react';
import { TriangleAlert, X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';

function getUserId(user) {
  return user?.id || user?._id || user?.user_id;
}

export default function DeleteAdminModal({ user, onClose, onDeleted }) {
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onClose]);

  const deleteUser = async () => {
    setServerError('');
    setLoading(true);
    try {
      await axiosInstance.delete(`/api/admin/users/${getUserId(user)}`);
      onDeleted(user);
      onClose();
    } catch (err) {
      setServerError(err.friendlyMessage || 'Unable to delete admin user.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <section className="center-card delete-admin-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="danger-modal-title">
            <TriangleAlert size={22} />
            <h2>Delete Admin User</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close delete user modal" disabled={loading}>
            <X size={19} />
          </button>
        </div>

        {serverError ? <div className="alert alert-error">{serverError}</div> : null}
        <p className="delete-warning">Are you sure you want to delete this admin user? This action CANNOT be undone.</p>

        <dl className="delete-user-card">
          <div><dt>Name</dt><dd>{user?.name || '-'}</dd></div>
          <div><dt>Username</dt><dd>@{user?.username || '-'}</dd></div>
          <div><dt>Department</dt><dd>{user?.dept_name || '-'}</dd></div>
          <div><dt>Designation</dt><dd>{user?.designation || '-'}</dd></div>
        </dl>

        <div className="modal-actions two">
          <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>Cancel</button>
          <button className="danger-button" type="button" onClick={deleteUser} disabled={loading}>
            {loading ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </section>
    </div>
  );
}
