import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Eye, Filter, LogOut, RefreshCw, Server, Users } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RecordDetailModal from '../components/RecordDetailModal.jsx';
import Toast from '../components/Toast.jsx';
import { clearAdminSession, getAdminProfile, isSuperUser } from '../utils/adminAuth.js';
import { extractRows, formatDateTime, normalizeRecord } from '../utils/adminRecords.js';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdminDashboard() {
  const navigate = useNavigate();
  const profile = getAdminProfile();
  const superUser = isSuperUser();
  const [records, setRecords] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedDept, setSelectedDept] = useState('');
  const [filters, setFilters] = useState({ series_no: '', dsr_no: '', from_date: '', to_date: '' });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const notify = (message, type = 'success') => setToast({ message, type });

  const loadDepartments = useCallback(async () => {
    if (!superUser) return;
    try {
      const { data } = await axiosClient.get('/api/departments');
      setDepartments(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load departments.', 'error');
    }
  }, [superUser]);

  const loadRecords = useCallback(async (options = {}) => {
    setError('');
    options.refresh ? setRefreshing(true) : setLoading(true);
    try {
      const params = {};
      if (superUser && selectedDept) params.dept_code = selectedDept;
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (String(value || '').trim()) params[key] = value;
        });
      }
      const { data } = await axiosClient.get('/api/admin/records', { params });
      setRecords(extractRows(data));
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDept, superUser]);

  useEffect(() => {
    loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const rowData = useMemo(() => records.map(normalizeRecord), [records]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
    floatingFilter: true,
    minWidth: 120,
  }), []);

  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'target_ip', headerName: 'Target IP', minWidth: 135 },
    { field: 'name', headerName: 'Name', minWidth: 170 },
    { field: 'phone', headerName: 'Phone', minWidth: 135 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 135 },
    { field: 'dept_name', headerName: 'Department', minWidth: 160 },
    { field: 'Series_no', headerName: 'Series No.', minWidth: 140 },
    { field: 'dsr_no', headerName: 'DSR No.', minWidth: 140 },
    { field: 'hostname', headerName: 'Hostname', minWidth: 165 },
    { field: 'os', headerName: 'OS', minWidth: 135 },
    { field: 'device_type', headerName: 'Device Type', minWidth: 145 },
    {
      field: 'submitted_at',
      headerName: 'Submitted At',
      sort: 'desc',
      minWidth: 175,
      valueFormatter: ({ value }) => formatDateTime(value),
    },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 120,
      maxWidth: 135,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => setSelectedRecord(data.original)}>
          <Eye size={15} />
          View
        </button>
      ),
    },
  ], []);

  const handleFilterChange = (event) => {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
  };

  const handleSearch = async () => {
    if (filters.series_no.trim()) {
      setLoading(true);
      try {
        const { data } = await axiosClient.get(`/api/admin/records/series/${encodeURIComponent(filters.series_no.trim())}`);
        setRecords(extractRows(data));
      } catch (err) {
        setError(err.friendlyMessage || 'Unable to search by series number.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (filters.dsr_no.trim()) {
      setLoading(true);
      try {
        const { data } = await axiosClient.get(`/api/admin/records/dsr/${encodeURIComponent(filters.dsr_no.trim())}`);
        setRecords(extractRows(data));
      } catch (err) {
        setError(err.friendlyMessage || 'Unable to search by DSR number.');
      } finally {
        setLoading(false);
      }
      return;
    }
    loadRecords({ filters });
  };

  const resetFilters = () => {
    setFilters({ series_no: '', dsr_no: '', from_date: '', to_date: '' });
    setSelectedDept('');
    loadRecords({ filters: {} });
  };

  const logout = () => {
    clearAdminSession();
    navigate('/admin/login', { replace: true });
  };

  return (
    <section className="dashboard-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin dashboard</p>
          <h1>Registered device data</h1>
          <p>Welcome, {profile.name || 'Admin'} | {profile.dept_name || 'Department'}</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-button" type="button" onClick={() => navigate('/admin/ip-list')}>
            <Server size={17} />
            IP Address List
          </button>
          {superUser ? (
            <button className="secondary-button" type="button" onClick={() => navigate('/admin/users')}>
              <Users size={17} />
              Manage Users
            </button>
          ) : null}
          <button className="secondary-button" type="button" onClick={() => loadRecords({ refresh: true })}>
            <RefreshCw size={18} className={refreshing ? 'spin-icon' : ''} />
            Refresh
          </button>
          <button className="admin-outline-button dark" type="button" onClick={logout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div className="filter-bar dashboard-filter-stack">
        {superUser ? (
          <label className="field compact-field" htmlFor="department-filter">
            <span className="field-label">Department</span>
            <select id="department-filter" value={selectedDept} onChange={(event) => setSelectedDept(event.target.value)}>
              <option value="">All Departments</option>
              {departments.map((department) => (
                <option key={department.dept_code || department.code || department.deptname || department.dept_name} value={department.dept_code || department.code || ''}>
                  {department.deptname || department.dept_name || department.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="dept-badge">Department: {profile.dept_name || 'Department'}</span>
        )}

        <button className="secondary-button filter-toggle" type="button" onClick={() => setFiltersOpen((value) => !value)}>
          <Filter size={17} />
          Advanced Filters
        </button>

        {filtersOpen ? (
          <div className="advanced-filter-grid">
            <label className="field compact-field">
              <span className="field-label">Series No.</span>
              <input name="series_no" value={filters.series_no} onChange={handleFilterChange} />
            </label>
            <label className="field compact-field">
              <span className="field-label">DSR No.</span>
              <input name="dsr_no" value={filters.dsr_no} onChange={handleFilterChange} />
            </label>
            <label className="field compact-field">
              <span className="field-label">From Date</span>
              <input type="date" name="from_date" value={filters.from_date} onChange={handleFilterChange} />
            </label>
            <label className="field compact-field">
              <span className="field-label">To Date</span>
              <input type="date" name="to_date" value={filters.to_date} onChange={handleFilterChange} />
            </label>
            <button className="primary-button" type="button" onClick={handleSearch}>Search</button>
            <button className="secondary-button" type="button" onClick={resetFilters}>Reset</button>
          </div>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <LoadingSpinner label="Loading records" />
      ) : (
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            pagination
            paginationPageSize={20}
            rowHeight={46}
            headerHeight={44}
            floatingFiltersHeight={40}
          />
        </div>
      )}

      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onNotify={notify} />
    </section>
  );
}
