import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Download, Search, TriangleAlert } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { extractRows, getRecordId, normalizeRecord } from '../../utils/adminRecords.js';
import { buildReportFilename, downloadBlob, getExportErrorMessage, getFilenameFromDisposition } from '../../utils/exportReport.js';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import Toast from '../../components/Toast.jsx';
import ViewDetailModal from '../../components/ViewDetailModal.jsx';
import ExportModal from '../../components/ExportModal.jsx';
import { defaultGridColDef, makeRecordColumns } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

export default function SearchReport({
  title,
  placeholder,
  endpointPrefix,
  emptyWarning,
  resultLabel,
  noRecordsLabel,
  reportType,
}) {
  const [query, setQuery] = useState('');
  const [searchedValue, setSearchedValue] = useState('');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedRows, setSelectedRows] = useState([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('');
  const [exporting, setExporting] = useState(false);

  const notify = (message, type = 'success') => setToast({ message, type });
  const rowData = useMemo(() => records.map(normalizeRecord), [records]);
  const columnDefs = useMemo(() => makeRecordColumns(setSelectedRecord), []);
  const selectedCount = selectedRows.length;

  const search = async () => {
    const value = query.trim();
    if (!value) {
      notify(emptyWarning, 'warning');
      return;
    }

    setLoading(true);
    setHasSearched(true);
    setSearchedValue(value);
    setSelectedRows([]);
    try {
      const { data } = await axiosInstance.get(`${endpointPrefix}/${encodeURIComponent(value)}`);
      setRecords(extractRows(data));
    } catch (error) {
      setRecords([]);
      notify(error.friendlyMessage || 'Unable to load report.', 'error');
    } finally {
      setLoading(false);
    }
  };

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
        { format: exportFormat, report_type: reportType, ids },
        { responseType: 'blob', skipForbiddenToast: true },
      );
      const filename =
        getFilenameFromDisposition(response.headers?.['content-disposition']) ||
        buildReportFilename(reportType, exportFormat);
      downloadBlob(response.data, filename, response.headers?.['content-type']);
      notify('Report downloaded successfully.');
      setExportOpen(false);
      setExportFormat('');
    } catch (error) {
      notify(await getExportErrorMessage(error), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="dashboard-page admin-report-page">
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin report</p>
          <h1>{title}</h1>
        </div>
      </div>

      <div className="report-search-card">
        <label className="field report-search-field" htmlFor="report-search">
          <span className="field-label">{placeholder.replace('Enter ', '').replace('...', '')}</span>
          <input
            id="report-search"
            value={query}
            placeholder={placeholder}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') search();
            }}
          />
        </label>
        <button className="download-button report-search-button" type="button" onClick={search}>
          <Search size={18} />
          Search
        </button>
      </div>

      {loading ? <LoadingSpinner label="Loading report" /> : null}

      {!loading && hasSearched && rowData.length > 0 ? (
        <>
          <p className="result-count">{resultLabel(rowData.length, searchedValue)}</p>
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
          <div className="ag-theme-quartz grid-shell report-grid">
            <AgGridReact
              rowData={rowData}
              columnDefs={columnDefs}
              defaultColDef={defaultGridColDef}
              rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, selectAll: 'filtered' }}
              onSelectionChanged={(event) => setSelectedRows(event.api.getSelectedRows())}
              getRowId={({ data }) => String(getRecordId(data.original || data) || data.serial_no)}
              pagination
              paginationPageSize={20}
              rowHeight={46}
              headerHeight={44}
              floatingFiltersHeight={40}
            />
          </div>
        </>
      ) : null}

      {!loading && hasSearched && rowData.length === 0 ? (
        <div className="empty-state">
          <TriangleAlert size={26} />
          <span>{noRecordsLabel(searchedValue)}</span>
        </div>
      ) : null}

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
