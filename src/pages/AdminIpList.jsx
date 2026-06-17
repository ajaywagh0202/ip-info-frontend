import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ArrowLeft, Eye } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Toast from '../components/Toast.jsx';
import { extractRows } from '../utils/adminRecords.js';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdminIpList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get('/api/admin/ip-list');
      setRows(extractRows(data));
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load IP address list.');
      setToast({ message: err.friendlyMessage || 'Unable to load IP address list.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const rowData = useMemo(() => rows.map((row, index) => ({ serial_no: index + 1, ...row })), [rows]);
  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, floatingFilter: true, minWidth: 130 }), []);
  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'target_ip', headerName: 'Target IP', minWidth: 150 },
    { field: 'hostname', headerName: 'Hostname', minWidth: 180 },
    { field: 'dept_name', headerName: 'Department', minWidth: 180 },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 135,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => navigate(`/admin/ip-list/${encodeURIComponent(data.target_ip)}/logs`)}>
          <Eye size={15} />
          View Logs
        </button>
      ),
    },
  ], [navigate]);

  return (
    <section className="dashboard-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">IP address list</p>
          <h1>Registered IP addresses</h1>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate('/admin/dashboard')}>
          <ArrowLeft size={17} />
          Dashboard
        </button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <LoadingSpinner label="Loading IP list" />
      ) : (
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact rowData={rowData} columnDefs={columnDefs} defaultColDef={defaultColDef} pagination paginationPageSize={20} rowHeight={46} headerHeight={44} floatingFiltersHeight={40} />
        </div>
      )}
    </section>
  );
}
