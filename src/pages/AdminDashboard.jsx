import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { Eye, LogOut, RefreshCw, X } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { formatDate, formatValue } from '../utils/deviceFormatters.js';

import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-quartz.css';

ModuleRegistry.registerModules([AllCommunityModule]);

function getRecordId(record) {
  return record?.id || record?._id || record?.record_id || record?.scanId || record?.scan_id;
}

function getJsonData(record) {
  return record?.json_data || record?.jsonData || record?.device_details || record?.scan?.data || record?.data || {};
}

function getField(record, ...keys) {
  const json = getJsonData(record);
  const system = json.system_info || json.systemInfo || {};
  for (const key of keys) {
    const value = record?.[key] ?? record?.user?.[key] ?? system?.[key] ?? json?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '-';
}

function toFriendlyLabel(value) {
  const words = String(value || 'Details')
    .replace(/\./g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const acronyms = new Set(['api', 'cpu', 'dns', 'gpu', 'id', 'ip', 'json', 'mac', 'os', 'pdf', 'pf', 'ram', 'url', 'usb', 'uuid']);

  return words
    .map((word) => (acronyms.has(word.toLowerCase())
      ? word.toUpperCase()
      : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

function getStatusDisplay(value) {
  if (value === true) return { label: 'ACTIVE', tone: 'green', rank: 0 };
  if (value === false) return { label: 'INACTIVE', tone: 'red', rank: 2 };

  if (typeof value !== 'string') return null;

  const normalized = value.trim().toLowerCase();
  if (normalized === 'running') return { label: 'Running', tone: 'green', rank: 0 };
  if (normalized === 'binary only') return { label: 'BINARY ONLY', tone: 'orange', rank: 1 };
  if (normalized === 'stop') return { label: 'Stop', tone: 'red', rank: 2 };
  if (normalized === 'off') return { label: 'Off', tone: 'red', rank: 2 };

  return null;
}

function parsePercent(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number.parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(number) ? number : null;
}

function getUsageTone(value) {
  const percent = parsePercent(value);
  if (percent === null) return null;
  if (percent < 50) return 'green';
  if (percent <= 85) return 'orange';
  return 'red';
}

function getRowStatusRank(row) {
  const statuses = Object.entries(row)
    .filter(([key]) => key !== '__statusRank')
    .map(([, value]) => getStatusDisplay(value))
    .filter(Boolean);

  if (statuses.length === 0) return 3;
  return Math.min(...statuses.map(({ rank }) => rank));
}

function StatusValue({ value }) {
  const status = getStatusDisplay(value);
  if (!status) return formatValue(value);

  return <span className={`status-chip ${status.tone}`}>{status.label}</span>;
}

function UsageValue({ value }) {
  const tone = getUsageTone(value);
  if (!tone) return <StatusValue value={value} />;

  return <span className={`usage-chip ${tone}`}>{formatValue(value)}</span>;
}

function getValue(source, ...keys) {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '-';
}

function buildDetails(source, fields = null) {
  if (!source || typeof source !== 'object') return [];

  if (fields) {
    return fields.map(([label, ...keys]) => ({ label, value: getValue(source, ...keys) }));
  }

  return Object.entries(source)
    .filter(([, value]) => !Array.isArray(value) && (!value || typeof value !== 'object'))
    .map(([key, value]) => ({ label: toFriendlyLabel(key), value }));
}

function flattenRow(value, prefix = '') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { [prefix || 'value']: value };
  }

  return Object.entries(value).reduce((row, [key, item]) => {
    const label = prefix ? `${prefix}.${key}` : key;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return { ...row, ...flattenRow(item, label) };
    }
    return { ...row, [label]: item };
  }, {});
}

function makeTable(title, data, preferredColumns = null, options = {}) {
  if (!Array.isArray(data) || data.length === 0) return null;

  const rows = data
    .map((entry) => flattenRow(entry))
    .map((row) => ({ ...row, __statusRank: getRowStatusRank(row) }))
    .sort((firstRow, secondRow) => firstRow.__statusRank - secondRow.__statusRank);
  const discoveredColumns = Array.from(new Set(rows.flatMap((row) => (
    Object.keys(row).filter((column) => column !== '__statusRank')
  ))));
  const columns = preferredColumns
    ? [
      ...preferredColumns.filter((column) => discoveredColumns.includes(column)),
      ...discoveredColumns.filter((column) => !preferredColumns.includes(column)),
    ]
    : discoveredColumns;

  return {
    title,
    rowData: rows,
    rowClassRules: options.rowClassRules,
    columnDefs: columns.map((column) => ({
      colId: column,
      headerName: toFriendlyLabel(column.split('.').at(-1)),
      minWidth: column === 'value' ? 180 : 145,
      flex: 1,
      valueGetter: ({ data: row }) => row?.[column],
      cellRenderer: ({ value: cellValue }) => (column.toLowerCase().includes('use_pct')
        ? <UsageValue value={cellValue} />
        : <StatusValue value={cellValue} />),
      valueFormatter: ({ value: cellValue }) => formatValue(
        cellValue && typeof cellValue === 'object' ? JSON.stringify(cellValue) : cellValue,
      ),
    })),
  };
}

function getObjectTables(source, titlePrefix = '') {
  if (!source || typeof source !== 'object') return [];

  return Object.entries(source)
    .map(([key, value]) => {
      if (!Array.isArray(value)) return null;
      return makeTable(titlePrefix ? `${titlePrefix} - ${toFriendlyLabel(key)}` : toFriendlyLabel(key), value);
    })
    .filter(Boolean);
}

function KeyValueSection({ items }) {
  if (!items?.length) return null;

  return (
    <dl className="kv-grid compact">
      {items.map(({ label, value }, index) => (
        <div key={`${label}-${index}`}>
          <dt>{label}</dt>
          <dd>{label.toLowerCase().includes('use %') ? <UsageValue value={value} /> : <StatusValue value={value} />}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailTable({ table, defaultColDef }) {
  return (
    <div
      className="ag-theme-quartz detail-grid-shell"
      style={{ height: Math.min(380, Math.max(156, (table.rowData.length * 46) + 92)) }}
    >
      <AgGridReact
        rowData={table.rowData}
        columnDefs={table.columnDefs}
        defaultColDef={defaultColDef}
        rowClassRules={table.rowClassRules}
        autoSizeStrategy={{ type: 'fitGridWidth' }}
        rowHeight={46}
        headerHeight={42}
      />
    </div>
  );
}

function DetailModal({ record, onClose }) {
  if (!record) return null;

  const json = getJsonData(record);
  const systemInfo = json.system_info || json.systemInfo || {};
  const diskInfo = json.disk_info || json.diskInfo || {};
  const systemHealth = json.system_health || json.systemHealth || {};
  const cyberSecurity = json.cyber_security || json.cyberSecurity || {};
  const installedPackages = json.installed_packages || json.installedPackages || {};
  const containers = json.containers || {};
  const virtualMachines = json.virtual_machines || json.virtualMachines || {};
  const runtimes = json.runtimes || {};

  const userDetails = [
    { label: 'Name', value: getField(record, 'name') },
    { label: 'Phone', value: getField(record, 'phone') },
    { label: 'PF No.', value: getField(record, 'pf_no', 'pfNo') },
    { label: 'Department', value: getField(record, 'department') },
    { label: 'Designation', value: getField(record, 'designation') },
  ];

  const reportSections = [
    {
      title: 'User Details',
      details: userDetails,
      tables: [],
    },
    {
      title: 'System Details',
      details: buildDetails(systemInfo, [
        ['Target IP', 'target_ip', 'targetIp', 'ip_address', 'ip'],
        ['Hostname', 'hostname'],
        ['OS', 'os'],
        ['OS Version', 'os_version', 'osVersion'],
        ['OS Release', 'os_release', 'osRelease'],
        ['Architecture', 'architecture'],
        ['Distro', 'distro'],
        ['Python Version', 'python_version', 'pythonVersion'],
        ['Scan Time', 'scan_time', 'scanTime'],
        ['Host Hypervisor', 'host_hypervisor', 'hostHypervisor'],
      ]),
      tables: [],
    },
    {
      title: 'System Health',
      details: buildDetails(systemHealth, [
        ['CPU Count', 'cpu_count', 'cpuCount'],
        ['CPU Model', 'cpu_model', 'cpuModel'],
        ['CPU Usage %', 'cpu_usage_pct', 'cpuUsagePct'],
        ['RAM Total', 'ram_total', 'ramTotal'],
        ['RAM Used', 'ram_used', 'ramUsed'],
        ['RAM Free', 'ram_free', 'ramFree'],
        ['RAM %', 'ram_pct', 'ramPct'],
        ['Swap Total', 'swap_total', 'swapTotal'],
        ['Swap Used', 'swap_used', 'swapUsed'],
        ['Swap %', 'swap_pct', 'swapPct'],
        ['Load Average', 'load_avg', 'loadAvg'],
        ['Uptime', 'uptime'],
      ]),
      tables: [
        makeTable('Top Processes', systemHealth.top_processes || systemHealth.topProcesses),
      ].filter(Boolean),
    },
    {
      title: 'Cyber Security Posture',
      details: [
        { label: 'Score', value: cyberSecurity.score },
        { label: 'Grade', value: cyberSecurity.grade },
        ...buildDetails(cyberSecurity.summary).map(({ label, value }) => ({ label: `${label} Findings`, value })),
      ],
      tables: [
        makeTable('Security Findings', cyberSecurity.findings, ['severity', 'category', 'title', 'detail']),
      ].filter(Boolean),
    },
    {
      title: 'Disk Storage',
      details: buildDetails(diskInfo, [
        ['Total Size', 'total_size', 'totalSize'],
        ['Total Used', 'total_used', 'totalUsed'],
        ['Total Free', 'total_free', 'totalFree'],
        ['Total Use %', 'total_use_pct', 'totalUsePct'],
      ]),
      tables: [
        makeTable('Disk Partitions', diskInfo.partitions, ['filesystem', 'mount', 'size', 'used', 'free', 'use_pct'], {
          rowClassRules: {
            'usage-row-green': ({ data }) => getUsageTone(data?.use_pct) === 'green',
            'usage-row-orange': ({ data }) => getUsageTone(data?.use_pct) === 'orange',
            'usage-row-red': ({ data }) => getUsageTone(data?.use_pct) === 'red',
          },
        }),
      ].filter(Boolean),
    },
    {
      title: 'Database Services',
      details: [],
      tables: [
        makeTable('Databases', json.databases, ['name', 'binary', 'port', 'port_listening', 'version']),
      ].filter(Boolean),
    },
    {
      title: 'Web Applications',
      details: [],
      tables: [
        makeTable('Web Applications', json.web_applications || json.webApplications, ['name', 'binary', 'port', 'port_listening', 'version']),
      ].filter(Boolean),
    },
    {
      title: 'Running Services',
      details: [],
      tables: [
        makeTable('Running Services', json.running_services || json.runningServices, ['service', 'description', 'state']),
      ].filter(Boolean),
    },
    {
      title: 'Installed Packages',
      details: [],
      tables: getObjectTables(installedPackages),
    },
    {
      title: 'Containers',
      details: buildDetails(containers),
      tables: [
        makeTable('Containers', containers.containers),
        makeTable('Kubernetes Pods', containers.k8s_pods || containers.k8sPods),
      ].filter(Boolean),
    },
    {
      title: 'Virtual Machines',
      details: buildDetails(virtualMachines),
      tables: [
        makeTable('Virtual Machines', virtualMachines.vms),
      ].filter(Boolean),
    },
    {
      title: 'Runtimes',
      details: buildDetails(runtimes),
      tables: getObjectTables(runtimes),
    },
  ];
  const visibleReportSections = reportSections.filter((section) => section.details.length || section.tables.length);

  const detailGridDefaultColDef = {
    resizable: true,
    sortable: true,
    filter: true,
    wrapText: true,
    autoHeight: true,
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="detail-modal">
        <div className="modal-header">
          <div>
            <p className="section-kicker">Record details</p>
            <h2>{getField(record, 'hostname') !== '-' ? getField(record, 'hostname') : getField(record, 'name')}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </div>

        {visibleReportSections.map((section, index) => (
          <section className="report-section" key={section.title}>
            <div className="report-section-heading">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h3>{section.title}</h3>
            </div>
            <KeyValueSection items={section.details} />
            {section.tables.map((table) => (
              <div className="report-table-block" key={table.title}>
                <h4>{table.title}</h4>
                <DetailTable table={table} defaultColDef={detailGridDefaultColDef} />
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [department, setDepartment] = useState('All Departments');
  const [selectedRecord, setSelectedRecord] = useState(null);

  const loadRecords = useCallback(async (isRefresh = false) => {
    setError('');
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const { data } = await axiosClient.get('/api/admin/records');
      setRecords(Array.isArray(data) ? data : data?.records || data?.data || []);
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const rowData = useMemo(() => records.map((record) => ({
    ...record,
    id: getRecordId(record),
    target_ip: getField(record, 'target_ip', 'targetIp', 'ip_address', 'ip'),
    name: getField(record, 'name'),
    phone: getField(record, 'phone'),
    pf_no: getField(record, 'pf_no', 'pfNo'),
    department: getField(record, 'department'),
    hostname: getField(record, 'hostname'),
    os: getField(record, 'os', 'distro', 'platform'),
    submitted_at: record.submitted_at || record.submission_date || record.createdAt || record.created_at,
    original: record,
  })), [records]);

  const departments = useMemo(() => {
    const values = rowData.map((record) => record.department).filter((value) => value && value !== '-');
    return ['All Departments', ...Array.from(new Set(values)).sort()];
  }, [rowData]);

  const filteredRows = useMemo(() => {
    if (department === 'All Departments') return rowData;
    return rowData.filter((record) => record.department === department);
  }, [department, rowData]);

  const columnDefs = useMemo(() => [
    { field: 'target_ip', headerName: 'Target IP', filter: true, minWidth: 125, flex: 1 },
    { field: 'name', headerName: 'Name', filter: true, minWidth: 180, flex: 1.35 },
    { field: 'phone', headerName: 'Phone', filter: true, minWidth: 125, flex: 1 },
    { field: 'pf_no', headerName: 'PF No.', filter: true, minWidth: 140, flex: 1 },
    { field: 'hostname', headerName: 'Hostname', filter: true, minWidth: 165, flex: 1.2 },
    { field: 'os', headerName: 'OS', filter: true, minWidth: 120, flex: 0.9 },
    {
      field: 'submitted_at',
      headerName: 'Submitted',
      sort: 'desc',
      minWidth: 150,
      flex: 1,
      valueFormatter: ({ value }) => formatDate(value),
    },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      minWidth: 112,
      maxWidth: 124,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => setSelectedRecord(data.original)}>
          <Eye size={15} />
          View
        </button>
      ),
    },
  ], []);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    floatingFilter: true,
    minWidth: 110,
  }), []);

  const autoSizeStrategy = useMemo(() => ({ type: 'fitGridWidth' }), []);

  const logout = () => {
    localStorage.removeItem('adminToken');
    window.location.href = '/';
  };

  return (
    <section className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Admin dashboard</p>
          <h1>Registered device data</h1>
          <p>View scanner submissions, filter departments, and download submitted files.</p>
        </div>
        <div className="dashboard-actions">
          <button className="secondary-button" type="button" onClick={() => loadRecords(true)}>
            <RefreshCw size={18} className={refreshing ? 'spin-icon' : ''} />
            Refresh
          </button>
          <button className="admin-outline-button dark" type="button" onClick={logout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </div>

      <div className="filter-bar single-filter">
        <label className="field compact-field" htmlFor="department-filter">
          <span className="field-label">Department</span>
          <select id="department-filter" value={department} onChange={(event) => setDepartment(event.target.value)}>
            {departments.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? (
        <LoadingSpinner label="Loading records" />
      ) : (
        <div className="ag-theme-quartz grid-shell">
          <AgGridReact
            rowData={filteredRows}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            autoSizeStrategy={autoSizeStrategy}
            pagination
            paginationPageSize={20}
            rowHeight={46}
            headerHeight={44}
            floatingFiltersHeight={40}
          />
        </div>
      )}

      <DetailModal record={selectedRecord} onClose={() => setSelectedRecord(null)} />
    </section>
  );
}
