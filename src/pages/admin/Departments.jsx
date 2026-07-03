import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { LoaderCircle, Save } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { extractRows } from '../../utils/adminRecords.js';
import InputField from '../../components/InputField.jsx';
import Toast from '../../components/Toast.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

const emptyForm = {
  deptname: '',
  dept_code: '',
};

function makeDepartmentCode(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getDepartmentName(department) {
  return department?.deptname || department?.dept_name || department?.name || '';
}

function getDepartmentCode(department) {
  return department?.dept_code || department?.code || makeDepartmentCode(getDepartmentName(department));
}

function normalizeDepartment(department, index) {
  return {
    ...department,
    serial_no: index + 1,
    deptname: getDepartmentName(department),
    dept_code: getDepartmentCode(department),
  };
}

export default function Departments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const loadDepartments = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const { data } = await axiosInstance.get('/api/departments');
      setDepartments(extractRows(data));
    } catch (requestError) {
      setDepartments([]);
      setListError(requestError.friendlyMessage || 'Unable to load departments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  const updateField = (event) => {
    const { name, value } = event.target;

    setForm((current) => (
      name === 'deptname'
        ? { ...current, deptname: value, dept_code: makeDepartmentCode(value) }
        : { ...current, [name]: makeDepartmentCode(value) }
    ));

    setErrors((current) => ({
      ...current,
      [name]: '',
      ...(name === 'deptname' ? { dept_code: '' } : {}),
    }));
    setFormError('');
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setFormError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.deptname.trim()) nextErrors.deptname = 'Department name is required.';
    if (!form.dept_code.trim()) nextErrors.dept_code = 'Department code is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveDepartment = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    setSaving(true);
    try {
      await axiosInstance.post('/api/departments', {
        deptname: form.deptname.trim(),
        dept_code: form.dept_code.trim(),
      });
      notify('Department added successfully.');
      resetForm();
      await loadDepartments();
    } catch (requestError) {
      const message = requestError.response?.status === 409
        ? 'Department name or department code already exists.'
        : requestError.friendlyMessage || requestError.message || 'Unable to save department.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const rowData = useMemo(
    () => departments.map((department, index) => normalizeDepartment(department, index)),
    [departments],
  );

  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'deptname', headerName: 'Department Name', flex: 2, minWidth: 220 },
    { field: 'dept_code', headerName: 'Department Code', flex: 1, minWidth: 180 },
  ], []);

  return (
    <section className="dashboard-page admin-report-page departments-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />

      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Department management</p>
          <h1>Departments</h1>
        </div>
      </div>

      <section>
        <h2 className="subsection-title">Create New Department</h2>
        <form className="form-card department-management-card" onSubmit={saveDepartment} noValidate>
          {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}
          <div className="form-grid">
            <InputField
              label="Department Name"
              name="deptname"
              required
              placeholder="Enter department name"
              value={form.deptname}
              onChange={updateField}
              error={errors.deptname}
            />
            <InputField
              label="Department Code"
              name="dept_code"
              required
              placeholder="Generated from department name"
              value={form.dept_code}
              onChange={updateField}
              error={errors.dept_code}
              helperText="Auto-generated from name; edit if a shorter code is needed."
            />
          </div>
          <div className="department-management-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <><LoaderCircle className="spin-icon" size={17} /> Saving...</> : <><Save size={17} /> Save Department</>}
            </button>
          </div>
        </form>
      </section>

      <section>
        <h2 className="subsection-title">Existing Departments</h2>
        {listError ? <div className="alert alert-error">{listError}</div> : null}
        <div className="ag-theme-quartz grid-shell departments-grid">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultGridColDef}
            loading={loading}
            pagination
            paginationPageSize={15}
            rowHeight={42}
            headerHeight={44}
            floatingFiltersHeight={40}
          />
        </div>
      </section>
    </section>
  );
}
