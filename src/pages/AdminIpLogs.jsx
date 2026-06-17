import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { ArrowLeft, Eye } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import RecordDetailModal from '../components/RecordDetailModal.jsx';
import Toast from '../components/Toast.jsx';
import { extractRows, formatDateTime, normalizeRecord } from '../utils/adminRecords.js';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function AdminIpLogs() {
  const navigate = useNavigate();
  const { target_ip } = useParams();
  const ip = decodeURIComponent(target_ip || '');
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const notify = (message, type = 'success') => setToast({ message, type });

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get(`/api/admin/ip-list/${encodeURIComponent(ip)}/logs`);
      setRecords(extractRows(data));
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load scan history.');
      notify(err.friendlyMessage || 'Unable to load scan history.', 'error');
    } finally {
      setLoading(false);
    }
  }, [ip]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const rowData = useMemo(() => records.map(normalizeRecord), [records]);
  const defaultColDef = useMemo(() => ({ resizable: true, sortable: true, filter: true, floatingFilter: true, minWidth: 130 }), []);
  const columnDefs = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'name', headerName: 'Name', minWidth: 170 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 135 },
    { field: 'dept_name', headerName: 'Department', minWidth: 170 },
    { field: 'Series_no', headerName: 'Series No.', minWidth: 140 },
    { field: 'dsr_no', headerName: 'DSR No.', minWidth: 140 },
    { field: 'device_type', headerName: 'Device Type', minWidth: 145 },
    { field: 'os', headerName: 'OS', minWidth: 135 },
    { field: 'hostname', headerName: 'Hostname', minWidth: 165 },
    { field: 'submitted_at', headerName: 'Submitted At', sort: 'desc', minWidth: 175, valueFormatter: ({ value }) => formatDateTime(value) },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 145,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => setSelectedRecord(data.original)}>
          <Eye size={15} />
          View Details
        </button>
      ),
    },
  ], []);

  return (
    <section className="dashboard-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Scan history</p>
          <h1>Scan History for IP: {ip}</h1>
          <p>Total Scans: {rowData.length}</p>
        </div>
        <button className="secondary-button" type="button" onClick={() => navigate('/admin/ip-list')}>
          <ArrowLeft size={17} />
          Back
        </button>
      </div>
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <LoadingSpinner label="Loading scan history" />
      ) : (
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact rowData={rowData} columnDefs={columnDefs} defaultColDef={defaultColDef} pagination paginationPageSize={20} rowHeight={46} headerHeight={44} floatingFiltersHeight={40} />
        </div>
      )}
      <RecordDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onNotify={notify} />
    </section>
  );
}
