import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Download, Eye, Monitor } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import formatDate from '../../utils/formatDate.js';
import { extractRows, getRecordId, normalizeRecord } from '../../utils/adminRecords.js';
import { buildReportFilename, downloadBlob, getExportErrorMessage, getFilenameFromDisposition } from '../../utils/exportReport.js';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import Toast from '../../components/Toast.jsx';
import ViewDetailModal from '../../components/ViewDetailModal.jsx';
import ExportModal from '../../components/ExportModal.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function IpReport() {
  const [ipRows, setIpRows] = useState([]);
  const [records, setRecords] = useState([]);
  const [selectedIp, setSelectedIp] = useState('');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);
  const [selectedRows, setSelectedRows] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('');
  const [exporting, setExporting] = useState(false);

  const notify = (message, type = 'success') => setToast({ message, type });

  const loadList = useCallback(async () => {
    setLoadingList(true);
    setError('');
    try {
      const { data } = await axiosInstance.get('/api/admin/ip-report/list');
      setIpRows(extractRows(data));
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load IP report.');
      notify(err.friendlyMessage || 'Unable to load IP report.', 'error');
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const loadRecords = async (targetIp) => {
    if (!targetIp) return;
    setSelectedIp(targetIp);
    setLoadingRecords(true);
    setRecords([]);
    setSelectedRows([]);
    try {
      const { data } = await axiosInstance.get(`/api/admin/ip-report/${encodeURIComponent(targetIp)}/records`);
      setRecords(extractRows(data));
    } catch (err) {
      notify(err.friendlyMessage || 'Unable to load records for selected IP.', 'error');
    } finally {
      setLoadingRecords(false);
    }
  };

  const leftRows = useMemo(() => ipRows.map((row, index) => ({ id: row.target_ip || index, ...normalizeRecord(row, index) })), [ipRows]);
  const rightRows = useMemo(() => records.map(normalizeRecord), [records]);
  const selectedCount = selectedRows.length;

  const leftColumns = useMemo(() => [
    { field: 'target_ip', headerName: 'Target IP', minWidth: 250 },
  ], []);

  const rightColumns = useMemo(() => [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    { field: 'name', headerName: 'Name', minWidth: 160 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 130 },
    { field: 'dept_name', headerName: 'Department', minWidth: 160 },
    { field: 'Series_no', headerName: 'Series No.', minWidth: 140 },
    { field: 'dsr_no', headerName: 'DSR No.', minWidth: 130 },
    { field: 'device_type', headerName: 'Device Type', minWidth: 145 },
    { field: 'os', headerName: 'OS', minWidth: 130 },
    { field: 'submitted_at', headerName: 'Submitted At', sort: 'desc', minWidth: 175, valueFormatter: ({ value }) => formatDate(value) },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 110,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => setSelectedRecord(data.original)}>
          <Eye size={15} />
          View
        </button>
      ),
    },
  ], []);

  const exportSelected = async () => {
    const ids = selectedRows.map((row) => getRecordId(row.original || row)).filter(Boolean);
    if (!ids.length) {
      notify('Selected records do not have export IDs.', 'warning');
      return;
    }

    setExporting(true);
    try {
      const response = await axiosInstance.post(
        '/api/admin/export',
        { format: exportFormat, report_type: 'ip', ids },
        { responseType: 'blob', skipForbiddenToast: true },
      );
      const filename =
        getFilenameFromDisposition(response.headers?.['content-disposition']) ||
        buildReportFilename('ip', exportFormat);
      downloadBlob(response.data, filename, response.headers?.['content-type']);
      notify('Report downloaded successfully.');
      setExportOpen(false);
      setExportFormat('');
    } catch (err) {
      notify(await getExportErrorMessage(err), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="admin-report-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin report</p>
          <h1>IP Report</h1>
        </div>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className={`ip-report-split ${selectedIp ? 'has-selection' : 'no-selection'}`}>
        <section className="split-panel left-panel">
          <div className="split-panel-heading">
            <h2>IP Address List</h2>
          </div>
          {loadingList ? (
            <LoadingSpinner label="Loading IP addresses" />
          ) : (
            <div className="ag-theme-quartz split-grid">
              <AgGridReact
                rowData={leftRows}
                columnDefs={leftColumns}
                defaultColDef={defaultGridColDef}
                rowSelection="single"
                getRowId={({ data }) => data.target_ip}
                onRowClicked={({ data }) => loadRecords(data.target_ip)}
                getRowClass={({ data }) => data?.target_ip === selectedIp ? 'selected-ip-row' : ''}
                rowHeight={44}
                headerHeight={44}
                floatingFiltersHeight={40}
              />
            </div>
          )}
        </section>

        <section className="split-panel right-panel">
          {selectedIp ? (
            <>
              <div className="split-panel-heading">
                <h2>Records for IP: {selectedIp} ({rightRows.length} entries)</h2>
              </div>
              {loadingRecords ? (
                <LoadingSpinner label="Loading IP records" />
              ) : (
                <div className="grid-with-toolbar">
                  <div className="report-grid-toolbar">
                    <span>{selectedCount} record(s) selected</span>
                    <button
                      className="download-button export-selected-button"
                      type="button"
                      onClick={() => setExportOpen(true)}
                      disabled={selectedCount === 0}
                    >
                      <Download size={18} />
                      Export Selected
                    </button>
                  </div>
                  <div className="ag-theme-quartz split-grid">
                    <AgGridReact
                      rowData={rightRows}
                      columnDefs={rightColumns}
                      defaultColDef={defaultGridColDef}
                      rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, selectAll: 'filtered' }}
                      onSelectionChanged={(event) => setSelectedRows(event.api.getSelectedRows())}
                      getRowId={({ data }) => String(getRecordId(data.original || data) || data.serial_no)}
                      pagination
                      paginationPageSize={10}
                      rowHeight={46}
                      headerHeight={44}
                      floatingFiltersHeight={40}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state split-placeholder">
              <Monitor size={30} />
              <span>{'<- Select an IP address to view its records'}</span>
            </div>
          )}
        </section>
      </div>

      <ViewDetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} onNotify={notify} />
      {exportOpen ? (
        <ExportModal
          count={selectedCount}
          selectedFormat={exportFormat}
          loading={exporting}
          onSelectFormat={setExportFormat}
          onDownload={exportSelected}
          onClose={() => {
            if (!exporting) setExportOpen(false);
          }}
        />
      ) : null}
    </section>
  );
}
