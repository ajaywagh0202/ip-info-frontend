import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Edit, KeyRound, Trash2, X } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { extractRows } from '../../utils/adminRecords.js';
import { getAdminProfile, isSuperUser } from '../../utils/adminAuth.js';
import InputField from '../../components/InputField.jsx';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import Toast from '../../components/Toast.jsx';
import ResetUserPasswordModal from '../../components/ResetUserPasswordModal.jsx';
import DeleteAdminModal from '../../components/DeleteAdminModal.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

function getUserId(user) {
  return user?.id || user?._id || user?.user_id;
}

function makeInitialForm(profile) {
  const superUser = Number(profile.user_type) === 0;
  return {
    name: '',
    username: '',
    pf_no: '',
    dept_code: superUser ? '' : profile.dept_code || '',
    dept_name: superUser ? '' : profile.dept_name || '',
    designation: '',
    user_type: '1',
  };
}

function UserForm({
  form,
  departments,
  onChange,
  onSubmit,
  error,
  saving,
  submitLabel,
  lockDepartment,
  lockUserType,
  note,
}) {
  return (
    <form className="form-card admin-user-form" onSubmit={onSubmit} noValidate>
      {error ? <div className="alert alert-error">{error}</div> : null}
      <div className="form-grid">
        <InputField label="Name" name="name" required value={form.name} onChange={onChange} />
        <InputField label="Username" name="username" required value={form.username} onChange={onChange} />
        <InputField label="PF No." name="pf_no" required value={form.pf_no} onChange={onChange} />
        <label className="field" htmlFor={`department-${submitLabel}`}>
          <span className="field-label">Department<em>*</em></span>
          <select id={`department-${submitLabel}`} name="department" value={form.dept_code} onChange={onChange} disabled={lockDepartment}>
            {lockDepartment && form.dept_code ? (
              <option value={form.dept_code}>{form.dept_name}</option>
            ) : (
              <option value="">Select department</option>
            )}
            {departments.map((department) => (
              <option key={department.dept_code || department.code || department.deptname} value={department.dept_code || department.code || ''}>
                {department.deptname || department.dept_name || department.name}
              </option>
            ))}
          </select>
        </label>
        <InputField label="Designation" name="designation" required value={form.designation} onChange={onChange} />
        <label className="field" htmlFor={`user-type-${submitLabel}`}>
          <span className="field-label">User Type<em>*</em></span>
          <select id={`user-type-${submitLabel}`} name="user_type" value={form.user_type} onChange={onChange} disabled={lockUserType}>
            <option value="1">Department User</option>
            <option value="0">Super User</option>
          </select>
        </label>
      </div>
      <p className="default-password-note">{note}</p>
      <button className="primary-button" type="submit" disabled={saving}>
        {saving ? <LoadingSpinner label="Saving" /> : submitLabel}
      </button>
    </form>
  );
}

export default function AdminUsers() {
  const profile = getAdminProfile();
  const superUser = isSuperUser();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [form, setForm] = useState(() => makeInitialForm(profile));
  const [editForm, setEditForm] = useState(null);
  const [editId, setEditId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [formError, setFormError] = useState('');
  const [editError, setEditError] = useState('');
  const [toast, setToast] = useState(null);
  const [resetUser, setResetUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosInstance.get('/api/admin/users/list');
      let usersData = extractRows(data);
      if (!superUser) {
        usersData = usersData.filter((user) => String(user.dept_code) === String(profile.dept_code) && Number(user.user_type) !== 0);
      }
      setUsers(usersData);
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load admin users.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify, profile.dept_code, superUser]);

  const loadDepartments = useCallback(async () => {
    try {
      const { data } = await axiosInstance.get('/api/departments');
      setDepartments(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load departments.', 'error');
    }
  }, [notify]);

  useEffect(() => {
    loadUsers();
    loadDepartments();
  }, [loadDepartments, loadUsers]);

  const updateForm = (setter) => (event) => {
    const { name, value } = event.target;
    if (name === 'department') {
      const dept = departments.find((item) => String(item.dept_code || item.code) === value);
      setter((current) => ({
        ...current,
        dept_code: value,
        dept_name: dept?.deptname || dept?.dept_name || dept?.name || '',
      }));
      return;
    }
    setter((current) => ({ ...current, [name]: value }));
  };

  const validate = (value) => ['name', 'username', 'pf_no', 'dept_code', 'dept_name', 'designation', 'user_type']
    .every((key) => String(value[key] || '').trim());

  const submitCreate = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate(form)) {
      setFormError('Please fill all required fields.');
      return;
    }

    setSaving(true);
    try {
      await axiosInstance.post('/api/admin/users/create', { ...form, user_type: Number(form.user_type) });
      notify('Admin user created successfully.');
      setForm(makeInitialForm(profile));
      loadUsers();
    } catch (err) {
      setFormError(err.friendlyMessage || 'Unable to create admin user.');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (user) => {
    setEditId(user.id || user._id || user.user_id);
    setEditForm({
      name: user.name || '',
      username: user.username || '',
      pf_no: user.pf_no || '',
      dept_code: user.dept_code || '',
      dept_name: user.dept_name || '',
      designation: user.designation || '',
      user_type: String(user.user_type ?? 1),
    });
    setEditError('');
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    setEditError('');
    if (!validate(editForm)) {
      setEditError('Please fill all required fields.');
      return;
    }

    setUpdating(true);
    try {
      await axiosInstance.put(`/api/admin/users/edit/${editId}`, { ...editForm, user_type: Number(editForm.user_type) });
      setEditForm(null);
      setEditId('');
      notify('Admin user updated successfully.');
      loadUsers();
    } catch (err) {
      setEditError(err.friendlyMessage || 'Unable to update admin user.');
    } finally {
      setUpdating(false);
    }
  };

  const canManageUser = useCallback((user) => superUser && Number(user?.user_type) === 1, [superUser]);

  const handlePasswordReset = (user) => {
    notify(`Password reset successfully for ${user?.name || 'user'}.`);
  };

  const handleDeleted = (user) => {
    const targetId = getUserId(user);
    setUsers((current) => current.filter((item) => String(getUserId(item)) !== String(targetId)));
    notify(`Admin user '${user?.username || 'user'}' has been deleted successfully.`, 'warning');
  };

  const rowData = useMemo(() => users.map((user, index) => ({ serial_no: index + 1, ...user })), [users]);
  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'username', headerName: 'Username', minWidth: 150 },
    { field: 'name', headerName: 'Name', minWidth: 170 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 135 },
    { field: 'dept_name', headerName: 'Department', minWidth: 175 },
    { field: 'designation', headerName: 'Designation', minWidth: 170 },
    { field: 'user_type', headerName: 'User Type', minWidth: 150, valueFormatter: ({ value }) => Number(value) === 0 ? 'Super User' : 'Dept. User' },
    ...(superUser ? [{
      headerName: 'Edit',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 110,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => openEdit(data)}>
          <Edit size={15} />
          Edit
        </button>
      ),
    },
    {
      headerName: 'Reset Password',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 155,
      cellRenderer: ({ data }) => canManageUser(data) ? (
        <button className="grid-action-button blue" type="button" onClick={() => setResetUser(data)}>
          <KeyRound size={15} />
          Reset
        </button>
      ) : null,
    },
    {
      headerName: 'Delete',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 120,
      cellRenderer: ({ data }) => canManageUser(data) ? (
        <button className="grid-action-button red" type="button" onClick={() => setDeleteUser(data)}>
          <Trash2 size={15} />
          Delete
        </button>
      ) : null,
    }] : []),
  ], [canManageUser, superUser]);

  return (
    <section className="dashboard-page admin-report-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin users</p>
          <h1>Admin User Management</h1>
        </div>
      </div>

      <section>
        <h2 className="subsection-title">Create New Admin User</h2>
        <UserForm
          form={form}
          departments={departments}
          onChange={updateForm(setForm)}
          onSubmit={submitCreate}
          error={formError}
          saving={saving}
          submitLabel="Create Admin User"
          lockDepartment={!superUser}
          lockUserType={!superUser}
          note="Default password for new user will be set to: 123456"
        />
      </section>

      <section>
        <h2 className="subsection-title">Existing Users</h2>
        {loading ? (
          <LoadingSpinner label="Loading users" />
        ) : (
          <div className="ag-theme-quartz grid-shell users-grid">
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultGridColDef}
              pagination
              paginationPageSize={10}
              rowHeight={46}
              headerHeight={44}
              floatingFiltersHeight={40}
            />
          </div>
        )}
      </section>

      {editForm ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditForm(null)}>
          <div className="center-card user-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <p className="section-kicker">Edit user</p>
                <h2>Update Admin User</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setEditForm(null)} aria-label="Close edit user modal">
                <X size={20} />
              </button>
            </div>
            <UserForm
              form={editForm}
              departments={departments}
              onChange={updateForm(setEditForm)}
              onSubmit={submitEdit}
              error={editError}
              saving={updating}
              submitLabel="Update Admin User"
              lockDepartment={false}
              lockUserType={false}
              note="Password cannot be changed from this screen."
            />
            <button className="secondary-button full-width" type="button" onClick={() => setEditForm(null)}>Cancel</button>
          </div>
        </div>
      ) : null}

      {resetUser ? (
        <ResetUserPasswordModal
          user={resetUser}
          onClose={() => setResetUser(null)}
          onSuccess={handlePasswordReset}
        />
      ) : null}

      {deleteUser ? (
        <DeleteAdminModal
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onDeleted={handleDeleted}
        />
      ) : null}
    </section>
  );
}
