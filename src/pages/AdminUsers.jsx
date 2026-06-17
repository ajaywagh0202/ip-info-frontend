import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ArrowLeft, Plus, X } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import InputField from '../components/InputField.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Toast from '../components/Toast.jsx';
import { extractRows } from '../utils/adminRecords.js';

ModuleRegistry.registerModules([AllCommunityModule]);

const initialForm = {
  username: '',
  name: '',
  pf_no: '',
  dept_code: '',
  dept_name: '',
  designation: '',
  user_type: '1',
};

export default function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => setToast({ message, type });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/api/admin/users');
      setUsers(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load admin users.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDepartments = useCallback(async () => {
    try {
      const { data } = await axiosClient.get('/api/departments');
      setDepartments(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load departments.', 'error');
    }
  }, []);

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, [loadDepartments, loadUsers]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'department') {
      const dept = departments.find((item) => String(item.dept_code || item.code) === value);
      setForm((current) => ({
        ...current,
        dept_code: value,
        dept_name: dept?.deptname || dept?.dept_name || dept?.name || '',
      }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
  };

  const submitUser = async (event) => {
    event.preventDefault();
    setModalError('');
    const required = ['username', 'name', 'pf_no', 'dept_code', 'dept_name', 'designation', 'user_type'];
    if (required.some((key) => !String(form[key] || '').trim())) {
      setModalError('Please fill all required fields.');
      return;
    }
    setSaving(true);
    try {
      await axiosClient.post('/api/admin/users/create', {
        ...form,
        user_type: Number(form.user_type),
      });
      setModalOpen(false);
      setForm(initialForm);
      notify('Admin user created successfully.');
      loadUsers();
    } catch (err) {
      setModalError(err.friendlyMessage || 'Unable to create admin user.');
    } finally {
      setSaving(false);
    }
  };

  const rowData = useMemo(() => users.map((user, index) => ({ serial_no: index + 1, ...user })), [users]);
  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, floatingFilter: true, minWidth: 130 }), []);
  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'username', headerName: 'Username', minWidth: 150 },
    { field: 'name', headerName: 'Name', minWidth: 170 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 135 },
    { field: 'dept_name', headerName: 'Department', minWidth: 175 },
    { field: 'designation', headerName: 'Designation', minWidth: 170 },
    { field: 'user_type', headerName: 'User Type', minWidth: 150, valueFormatter: ({ value }) => Number(value) === 0 ? 'Super User' : 'Dept. User' },
  ], []);

  return (
    <section className="dashboard-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Super user</p>
          <h1>Admin User Management</h1>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-button" type="button" onClick={() => navigate('/admin/dashboard')}>
            <ArrowLeft size={17} />
            Dashboard
          </button>
          <button className="primary-button" type="button" onClick={() => setModalOpen(true)}>
            <Plus size={17} />
            Create New Admin
          </button>
        </div>
      </div>
      {loading ? (
        <LoadingSpinner label="Loading users" />
      ) : (
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact rowData={rowData} columnDefs={columnDefs} defaultColDef={defaultColDef} pagination paginationPageSize={20} rowHeight={46} headerHeight={44} floatingFiltersHeight={40} />
        </div>
      )}

      {modalOpen ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
          <form className="center-card user-modal" onSubmit={submitUser} onMouseDown={(event) => event.stopPropagation()} noValidate>
            <div className="modal-header">
              <div>
                <p className="section-kicker">Create user</p>
                <h2>Create New Admin</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setModalOpen(false)} aria-label="Close create user modal">
                <X size={20} />
              </button>
            </div>
            {modalError ? <div className="alert alert-error">{modalError}</div> : null}
            <div className="form-grid">
              <InputField label="Username" name="username" required value={form.username} onChange={handleChange} />
              <InputField label="Name" name="name" required value={form.name} onChange={handleChange} />
              <InputField label="PF No." name="pf_no" required value={form.pf_no} onChange={handleChange} />
              <label className="field" htmlFor="admin-department">
                <span className="field-label">Department<em>*</em></span>
                <select id="admin-department" name="department" value={form.dept_code} onChange={handleChange}>
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.dept_code || department.code || department.deptname} value={department.dept_code || department.code || ''}>
                      {department.deptname || department.dept_name || department.name}
                    </option>
                  ))}
                </select>
              </label>
              <InputField label="Designation" name="designation" required value={form.designation} onChange={handleChange} />
              <label className="field" htmlFor="admin-user-type">
                <span className="field-label">User Type<em>*</em></span>
                <select id="admin-user-type" name="user_type" value={form.user_type} onChange={handleChange}>
                  <option value="1">Department User</option>
                  <option value="0">Super User</option>
                </select>
              </label>
            </div>
            <p className="default-password-note">Default password: 123456</p>
            <button className="primary-button full-width" type="submit" disabled={saving}>
              {saving ? <LoadingSpinner label="Creating user" /> : 'Create Admin'}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}
