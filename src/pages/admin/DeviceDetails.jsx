import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Eye, PencilLine, Search, RotateCcw, SlidersHorizontal } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { extractRows } from '../../utils/adminRecords.js';
import { getAdminProfile, getUserType } from '../../utils/adminAuth.js';
import formatDate from '../../utils/formatDate.js';
import { formatFieldKey } from '../../utils/formatField.js';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import Toast from '../../components/Toast.jsx';
import ViewDeviceModal from '../../components/ViewDeviceModal.jsx';
import EditDeviceModal from '../../components/EditDeviceModal.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

const deviceTypeOptions = ['All Types', 'Desktop', 'Laptop', 'Server', 'Printer', 'Network Switch', 'Other'];

function getDeviceId(record) {
  return record?.id || record?._id || record?.device_id || record?.record_id;
}

function normalizeDeviceRow(row = {}, index = 0) {
  return {
    ...row,
    id: getDeviceId(row),
    serial_no: index + 1,
    Serial_no: row.Serial_no || row.serial_number || row.serial_no || row.series_no || '',
  };
}

function buildParams(filters, profile, userType) {
  const params = {};
  if (filters.dsr_no) params.dsr_no = filters.dsr_no;
  if (filters.serial_no) params.serial_no = filters.serial_no;
  if (filters.device_type && filters.device_type !== 'All Types') params.device_type = filters.device_type;
  if (userType === 0 && filters.dept_code && filters.dept_code !== 'all') params.dept_code = filters.dept_code;
  if (filters.from_date) params.from_date = filters.from_date;
  if (filters.to_date) params.to_date = filters.to_date;
  if (userType === 1 && profile.dept_code) params.dept_code = profile.dept_code;
  return params;
}

export default function DeviceDetails() {
  const profile = getAdminProfile();
  const userType = getUserType();
  const [devices, setDevices] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState({
    dsr_no: '',
    serial_no: '',
    device_type: 'All Types',
    dept_code: 'all',
    from_date: '',
    to_date: '',
  });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [viewId, setViewId] = useState('');
  const [editId, setEditId] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const notify = useCallback((message, type = 'success') => setToast({ message, type }), []);

  const loadDepartments = useCallback(async () => {
    setLoadingDepartments(true);
    try {
      const { data } = await axiosInstance.get('/api/departments');
      setDepartments(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load departments.', 'error');
    } finally {
      setLoadingDepartments(false);
    }
  }, [notify]);

  const loadDevices = useCallback(async (nextFilters = appliedFilters) => {
    setLoading(true);
    setError('');
    try {
      const params = buildParams(nextFilters, profile, userType);
      const { data } = await axiosInstance.get('/api/admin/device-details', { params });
      setDevices(extractRows(data).map(normalizeDeviceRow));
    } catch (err) {
      setDevices([]);
      setError(err.friendlyMessage || 'Unable to load device details.');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters, profile, userType]);

  useEffect(() => {
    loadDepartments();
    loadDevices(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'name', headerName: formatFieldKey('name'), minWidth: 160 },
    { field: 'phone', headerName: formatFieldKey('phone'), minWidth: 150 },
    { field: 'pf_no', headerName: formatFieldKey('pf_no'), minWidth: 150 },
    { field: 'dept_name', headerName: formatFieldKey('dept_name'), minWidth: 165 },
    { field: 'designation', headerName: formatFieldKey('designation'), minWidth: 165 },
    { field: 'device_type', headerName: formatFieldKey('device_type'), minWidth: 145 },
    { field: 'dsr_no', headerName: formatFieldKey('dsr_no'), minWidth: 175 },
    { field: 'Serial_no', headerName: formatFieldKey('Serial_no'), minWidth: 150 },
    { field: 'submitted_at', headerName: formatFieldKey('submitted_at'), minWidth: 175, sort: 'desc', valueFormatter: ({ value }) => formatDate(value) },
    {
      headerName: 'Actions',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 180,
      cellRenderer: ({ data }) => {
        const canEdit = userType === 0 || String(data?.dept_code || '') === String(profile.dept_code || '');
        return (
          <div className="device-actions">
            <button className="grid-action-button blue" type="button" onClick={() => { setSelectedRecord(data); setViewId(getDeviceId(data)); }}>
              <Eye size={15} />
              View
            </button>
            <button
              className={`grid-action-button orange${canEdit ? '' : ' disabled'}`}
              type="button"
              disabled={!canEdit}
              title={canEdit ? 'Edit record' : 'You can only edit your department\'s records.'}
              onClick={() => {
                if (!canEdit) return;
                setSelectedRecord(data);
                setEditId(getDeviceId(data));
              }}
            >
              <PencilLine size={15} />
              Edit
            </button>
          </div>
        );
      },
    },
  ], [profile.dept_code, userType]);

  const handleApply = () => {
    setAppliedFilters(filters);
    loadDevices(filters);
  };

  const handleReset = () => {
    const nextFilters = {
      dsr_no: '',
      serial_no: '',
      device_type: 'All Types',
      dept_code: 'all',
      from_date: '',
      to_date: '',
    };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    loadDevices(nextFilters);
  };

  const handleSaved = (updatedRecord) => {
    const next = normalizeDeviceRow(updatedRecord);
    setDevices((current) => current.map((row) => (String(getDeviceId(row)) === String(getDeviceId(next)) ? { ...row, ...next } : row)));
    notify('Device record updated successfully.');
  };

  const deptOptions = useMemo(() => departments, [departments]);

  return (
    <section className="dashboard-page admin-report-page device-details-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin report</p>
          <h1>Device Details</h1>
          <p>{userType === 0 ? 'All Departments' : `Department: ${profile.dept_name || 'Department'}`}</p>
        </div>
      </div>

      <section className="device-filter-shell">
        <button className="filter-toggle-button" type="button" onClick={() => setFiltersOpen((current) => !current)}>
          <SlidersHorizontal size={16} />
          Filters
        </button>

        {filtersOpen ? (
          <div className="device-filter-panel">
            <div className="device-filter-grid">
              <label className="field">
                <span className="field-label">DSR No.</span>
                <input value={filters.dsr_no} onChange={(event) => setFilters((current) => ({ ...current, dsr_no: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field-label">Serial No.</span>
                <input value={filters.serial_no} onChange={(event) => setFilters((current) => ({ ...current, serial_no: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field-label">Device Type</span>
                <select value={filters.device_type} onChange={(event) => setFilters((current) => ({ ...current, device_type: event.target.value }))}>
                  {deviceTypeOptions.map((option) => <option key={option}>{option}</option>)}
                </select>
              </label>
              {userType === 0 ? (
                <label className="field">
                  <span className="field-label">Department</span>
                  <select value={filters.dept_code} onChange={(event) => setFilters((current) => ({ ...current, dept_code: event.target.value }))} disabled={loadingDepartments}>
                    <option value="all">All Departments</option>
                    {deptOptions.map((department) => (
                      <option key={department.dept_code || department.code || department.deptname} value={department.dept_code || department.code || ''}>
                        {department.deptname || department.dept_name || department.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="field">
                <span className="field-label">From Date</span>
                <input type="date" value={filters.from_date} onChange={(event) => setFilters((current) => ({ ...current, from_date: event.target.value }))} />
              </label>
              <label className="field">
                <span className="field-label">To Date</span>
                <input type="date" value={filters.to_date} onChange={(event) => setFilters((current) => ({ ...current, to_date: event.target.value }))} />
              </label>
            </div>
            <div className="device-filter-actions">
              <button className="download-button" type="button" onClick={handleApply}>
                <Search size={16} />
                Search
              </button>
              <button className="secondary-button" type="button" onClick={handleReset}>
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <LoadingSpinner label="Loading device details" /> : null}

      {!loading && !error ? (
        <div className="ag-theme-quartz grid-shell device-grid">
          <AgGridReact
            rowData={devices}
            columnDefs={columnDefs}
            defaultColDef={defaultGridColDef}
            pagination
            paginationPageSize={20}
            rowHeight={46}
            headerHeight={44}
            floatingFiltersHeight={40}
            getRowId={({ data }) => String(getDeviceId(data))}
          />
        </div>
      ) : null}

      {viewId ? (
        <ViewDeviceModal
          deviceId={viewId}
          initialRecord={selectedRecord}
          onClose={() => {
            setViewId('');
            setSelectedRecord(null);
          }}
        />
      ) : null}

      {editId ? (
        <EditDeviceModal
          deviceId={editId}
          initialRecord={selectedRecord}
          departments={departments}
          onClose={() => {
            setEditId('');
            setSelectedRecord(null);
          }}
          onSaved={handleSaved}
        />
      ) : null}
    </section>
  );
}
