import { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import formatDate from '../utils/formatDate.js';
import { getField, getJsonData, toFriendlyLabel } from '../utils/adminRecords.js';

ModuleRegistry.registerModules([AllCommunityModule]);

function displayValue(value) {
  if (value === 0) return '0';
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DisplayValue({ label, value }) {
  if (label.toLowerCase() === 'scan time') return formatDate(value);
  if (label.toLowerCase().includes('use %')) return <UsageValue value={value} />;
  return <StatusValue value={value} />;
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
  const percent = Number.parseFloat(String(value).replace('%', '').trim());
  return Number.isFinite(percent) ? percent : null;
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
    .filter(([key]) => !key.startsWith('__'))
    .map(([, value]) => getStatusDisplay(value))
    .filter(Boolean);

  if (!statuses.length) return 3;
  return Math.min(...statuses.map(({ rank }) => rank));
}

function StatusValue({ value }) {
  const status = getStatusDisplay(value);
  if (!status) return displayValue(value);

  return <span className={`status-chip ${status.tone}`}>{status.label}</span>;
}

function UsageValue({ value }) {
  const tone = getUsageTone(value);
  if (!tone) return <StatusValue value={value} />;

  return <span className={`usage-chip ${tone}`}>{displayValue(value)}</span>;
}

function DetailGrid({ items, columns = 'three' }) {
  return (
    <dl className={`kv-grid ${columns === 'two' ? 'two-column' : ''}`}>
      {items
        .filter((item) => item.value !== null && item.value !== undefined && item.value !== '')
        .map(({ label, value }) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd><DisplayValue label={label} value={value} /></dd>
          </div>
        ))}
    </dl>
  );
}

function DetailTable({ title, rowData, columnDefs, rowClassRules, height = 300 }) {
  if (!rowData?.length || !columnDefs?.length) return null;

  return (
    <div className="report-table-block">
      <h4>{title}</h4>
      <div className="ag-theme-quartz detail-grid-shell" style={{ height }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          rowClassRules={rowClassRules}
          defaultColDef={{ resizable: true, sortable: true, filter: true, floatingFilter: true, wrapText: true, autoHeight: true }}
          rowHeight={44}
          headerHeight={42}
        />
      </div>
    </div>
  );
}

function makeTable(title, data, preferredColumns = null, options = {}) {
  if (!Array.isArray(data) || data.length === 0) return null;
  const rowData = data
    .map((item, index) => ({ ...item, __rowIndex: index + 1 }))
    .map((row) => ({ ...row, __statusRank: getRowStatusRank(row) }))
    .sort((firstRow, secondRow) => firstRow.__statusRank - secondRow.__statusRank);
  const discoveredColumns = Array.from(new Set(rowData.flatMap((row) => Object.keys(row).filter((key) => !key.startsWith('__')))));
  const columns = preferredColumns
    ? [
      ...preferredColumns.filter((column) => discoveredColumns.includes(column)),
      ...discoveredColumns.filter((column) => !preferredColumns.includes(column)),
    ]
    : discoveredColumns;

  return {
    title,
    rowData,
    rowClassRules: options.rowClassRules,
    columnDefs: columns.map((column) => ({
      field: column,
      headerName: toFriendlyLabel(column),
      minWidth: 140,
      flex: 1,
      cellRenderer: ({ value }) => (column.toLowerCase().includes('use_pct')
        ? <UsageValue value={value} />
        : <StatusValue value={value} />),
      valueFormatter: ({ value }) => (value === null || value === undefined || value === '' ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value)),
    })),
  };
}

export default function ViewDetailModal({ record, onClose }) {
  const jsonData = useMemo(() => getJsonData(record), [record]);

  useEffect(() => {
    if (!record) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, record]);

  if (!record) return null;

  const targetIp = getField(record, 'target_ip', 'targetIp', 'ip_address', 'ip');
  const hostname = getField(record, 'hostname');

  const deviceDetails = [
    { label: 'Dead Stock Register No.', value: getField(record, 'dsr_no', 'dsrNo') },
    { label: 'Device Type', value: getField(record, 'device_type', 'deviceType') },
    { label: 'Date of Procurement', value: getField(record, 'date_of_procurement', 'date_of_procurement') },
    { label: 'Serial No.', value: getField(record, 'Series_no', 'series_no', 'serial_no') },
    { label: 'Make', value: getField(record, 'make') },
    { label : 'Date of Installation', value: getField(record, 'date_of_install', 'dateOfInstall') },
    { label: 'Date', value: getField(record, 'date') },
    { label: 'description', value: getField(record, 'description') },
    { label: 'Given To', value: getField(record, 'given_to', 'givenTo') },
    { label: 'Location', value: getField(record, 'location') },
    { label: 'Purchase Order  No.', value: getField(record, 'po_no', 'poNo') },
    { label: 'Purchase Order Date', value: getField(record, 'po_date', 'poDate') },
    { label: 'Quantity', value: getField(record, 'quanity', 'quantity') },
    { label: 'Price', value: getField(record, 'value') },
    { label: 'Dead Stock Register File', value: getField(record, 'dsr_file', 'dsrFile') },
    { label: 'DS No.', value: getField(record, 'ds_no', 'dsNo') },
    { label: 'Remarks', value: getField(record, 'remarks') },
  ];


  const userInfo = [
    { label: 'Name', value: getField(record, 'name') },
    { label: 'Phone', value: getField(record, 'phone') },
    { label: 'PF No.', value: getField(record, 'pf_no', 'pfNo') },
    { label: 'Department', value: getField(record, 'dept_name', 'deptName', 'department') },
    { label: 'Designation', value: getField(record, 'designation') },
    { label: 'Target IP', value: targetIp },
  ];

  const systemInfo = [
    { label: 'Target IP', value: targetIp },
    { label: 'Hostname', value: hostname },
    { label: 'Operating System', value: getField(record, 'os', 'distro', 'platform') },
    { label: 'Operating System Version', value: getField(record, 'os_version', 'osVersion') },
    { label: 'Operating System Release', value: getField(record, 'os_release', 'osRelease') },
    { label: 'Architecture', value: getField(record, 'architecture') },
    { label: 'Distro', value: getField(record, 'distro') },
    { label: 'Python Version', value: getField(record, 'python_version', 'pythonVersion') },
    { label: 'Scan Time', value: getField(record, 'scan_time', 'scanTime') },
    { label: 'Host Hypervisor', value: getField(record, 'host_hypervisor', 'hostHypervisor') },
  ];

  const systemHealth = jsonData.system_health || jsonData.systemHealth || null;
  const cyberSecurity = jsonData.cyber_security || jsonData.cyberSecurity || null;
  const diskInfo = jsonData.disk_info || jsonData.diskInfo || null;
  const installedPackages = jsonData.installed_packages || jsonData.installedPackages || null;
  const containers = jsonData.containers || null;
  const virtualMachines = jsonData.virtual_machines || jsonData.virtualMachines || null;
  const runtimes = jsonData.runtimes || null;
  const databases = jsonData.databases || null;
  const webApplications = jsonData.web_applications || jsonData.webApplications || null;
  const runningServices = jsonData.running_services || jsonData.runningServices || null;

  const sections = [
    { title: 'Device Details', items: deviceDetails, index: '01' },
    { title: 'User Details', items: userInfo, index: '02' },
    { title: 'System Details', items: systemInfo, index: '03' },
  ];

  const scalarHealth = systemHealth ? [
    { label: 'CPU Count', value: systemHealth.cpu_count ?? systemHealth.cpuCount },
    { label: 'CPU Model', value: systemHealth.cpu_model ?? systemHealth.cpuModel },
    { label: 'CPU Usage %', value: systemHealth.cpu_usage_pct ?? systemHealth.cpuUsagePct },
    { label: 'RAM Total', value: systemHealth.ram_total ?? systemHealth.ramTotal },
    { label: 'RAM Used', value: systemHealth.ram_used ?? systemHealth.ramUsed },
    { label: 'RAM Free', value: systemHealth.ram_free ?? systemHealth.ramFree },
    { label: 'RAM %', value: systemHealth.ram_pct ?? systemHealth.ramPct },
    { label: 'Swap Total', value: systemHealth.swap_total ?? systemHealth.swapTotal },
    { label: 'Swap Used', value: systemHealth.swap_used ?? systemHealth.swapUsed },
    { label: 'Swap %', value: systemHealth.swap_pct ?? systemHealth.swapPct },
    { label: 'Load Average', value: systemHealth.load_avg ?? systemHealth.loadAvg },
    { label: 'Uptime', value: systemHealth.uptime },
  ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '') : [];

  if (scalarHealth.length || systemHealth?.top_processes?.length || systemHealth?.topProcesses?.length) {
    sections.push({
      title: 'System Health',
      items: scalarHealth,
      index: '04',
      tables: [
        makeTable('Top Processes', systemHealth.top_processes || systemHealth.topProcesses, ['pid', 'name', 'cpu', 'memory']),
      ].filter(Boolean),
    });
  }

  if (cyberSecurity) {
    const summary = cyberSecurity.summary || {};
    const cyberItems = [
      { label: 'Score', value: cyberSecurity.score },
      { label: 'Grade', value: cyberSecurity.grade },
      { label: 'CRITICAL Findings', value: summary.critical ?? summary.criticalCount ?? summary.CRITICAL },
      { label: 'HIGH Findings', value: summary.high ?? summary.highCount ?? summary.HIGH },
      { label: 'MEDIUM Findings', value: summary.medium ?? summary.mediumCount ?? summary.MEDIUM },
      { label: 'LOW Findings', value: summary.low ?? summary.lowCount ?? summary.LOW },
      { label: 'INFO Findings', value: summary.info ?? summary.infoCount ?? summary.INFO },
    ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
    sections.push({
      title: 'Cyber Security Posture',
      items: cyberItems,
      index: String(sections.length + 1).padStart(2, '0'),
      tables: [makeTable('Security Findings', cyberSecurity.findings, ['severity', 'category', 'title', 'detail'])].filter(Boolean),
    });
  }

  if (diskInfo) {
    const diskItems = [
      { label: 'Total Size', value: diskInfo.total_size ?? diskInfo.totalSize },
      { label: 'Total Used', value: diskInfo.total_used ?? diskInfo.totalUsed },
      { label: 'Total Free', value: diskInfo.total_free ?? diskInfo.totalFree },
      { label: 'Total Use %', value: diskInfo.total_use_pct ?? diskInfo.totalUsePct },
    ].filter((item) => item.value !== null && item.value !== undefined && item.value !== '');
    sections.push({
      title: 'Disk Storage',
      items: diskItems,
      index: String(sections.length + 1).padStart(2, '0'),
      tables: [
        makeTable('Disk Partitions', diskInfo.partitions, ['filesystem', 'mount', 'size', 'used', 'free', 'use_pct'], {
          rowClassRules: {
            'usage-row-green': ({ data }) => getUsageTone(data?.use_pct) === 'green',
            'usage-row-orange': ({ data }) => getUsageTone(data?.use_pct) === 'orange',
            'usage-row-red': ({ data }) => getUsageTone(data?.use_pct) === 'red',
          },
        }),
      ].filter(Boolean),
    });
  }

  if (databases?.length) {
    sections.push({
      title: 'Database Services',
      items: [],
      index: String(sections.length + 1).padStart(2, '0'),
      tables: [makeTable('Databases', databases, ['name', 'binary', 'port', 'port_listening', 'version'])].filter(Boolean),
    });
  }

  if (webApplications?.length) {
    sections.push({
      title: 'Web Applications',
      items: [],
      index: String(sections.length + 1).padStart(2, '0'),
      tables: [makeTable('Web Applications', webApplications, ['name', 'binary', 'port', 'port_listening', 'version'])].filter(Boolean),
    });
  }

  if (runningServices?.length) {
    sections.push({
      title: 'Running Services',
      items: [],
      index: String(sections.length + 1).padStart(2, '0'),
      tables: [makeTable('Running Services', runningServices, ['service', 'description', 'state'])].filter(Boolean),
    });
  }

  if (installedPackages) {
    const packageTables = Object.entries(installedPackages)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => makeTable(toFriendlyLabel(key), value))
      .filter(Boolean);
    if (packageTables.length) {
      sections.push({
        title: 'Installed Packages',
        items: [],
        index: String(sections.length + 1).padStart(2, '0'),
        tables: packageTables,
      });
    }
  }

  if (containers) {
    const containerItems = Object.entries(containers)
      .filter(([, value]) => value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'object')
      .map(([key, value]) => ({ label: toFriendlyLabel(key), value }));
    const containerTables = [
      makeTable('Containers', containers.containers),
      makeTable('Kubernetes Pods', containers.k8s_pods || containers.k8sPods),
    ].filter(Boolean);
    if (containerItems.length || containerTables.length) {
      sections.push({
        title: 'Containers',
        items: containerItems,
        index: String(sections.length + 1).padStart(2, '0'),
        tables: containerTables,
      });
    }
  }

  if (virtualMachines) {
    const vmItems = Object.entries(virtualMachines)
      .filter(([, value]) => value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'object')
      .map(([key, value]) => ({ label: toFriendlyLabel(key), value }));
    const vmTables = [makeTable('Virtual Machines', virtualMachines.vms)].filter(Boolean);
    if (vmItems.length || vmTables.length) {
      sections.push({
        title: 'Virtual Machines',
        items: vmItems,
        index: String(sections.length + 1).padStart(2, '0'),
        tables: vmTables,
      });
    }
  }

  if (runtimes) {
    const runtimeItems = Object.entries(runtimes)
      .filter(([, value]) => value !== null && value !== undefined && !Array.isArray(value) && typeof value !== 'object')
      .map(([key, value]) => ({ label: toFriendlyLabel(key), value }));
    const runtimeTables = Object.entries(runtimes)
      .filter(([, value]) => Array.isArray(value))
      .map(([key, value]) => makeTable(toFriendlyLabel(key), value))
      .filter(Boolean);
    if (runtimeItems.length || runtimeTables.length) {
      sections.push({
        title: 'Runtimes',
        items: runtimeItems,
        index: String(sections.length + 1).padStart(2, '0'),
        tables: runtimeTables,
      });
    }
  }

  const visibleSections = sections.filter((section) => section.items.length || section.tables?.length);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="detail-modal view-detail-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="view-modal-titlebar">
          <div className="modal-title">
            <p className="section-kicker">Record details</p>
            <h2>{hostname !== '-' ? hostname : targetIp !== '-' ? targetIp : getField(record, 'name')}</h2>
            <span>{targetIp !== '-' ? targetIp : 'Device scan report'}</span>
          </div>
          <button className="icon-button light" type="button" onClick={onClose} aria-label="Close details">
            <X size={20} />
          </button>
        </div>

        <div className="view-modal-content">
          {visibleSections.map((section) => (
            <section className="report-section" key={section.title}>
              <div className="report-section-heading">
                <span>{section.index}</span>
                <h3>{section.title}</h3>
              </div>
              {section.items.length ? <DetailGrid items={section.items} /> : null}
              {section.tables?.length ? section.tables.map((table) => (
                <DetailTable
                  key={table.title}
                  title={table.title}
                  rowData={table.rowData}
                  columnDefs={table.columnDefs}
                  rowClassRules={table.rowClassRules}
                  height={Math.min(380, Math.max(180, table.rowData.length * 42 + 88))}
                />
              )) : null}
            </section>
          ))}

          <section className="report-section">
            <div className="report-section-heading"><span>{String(visibleSections.length + 1).padStart(2, '0')}</span><h3>Submission Info</h3></div>
            <DetailGrid items={[{ label: 'Submitted At', value: formatDate(record.submitted_at || record.created_at || record.createdAt) }]} />
          </section>
        </div>
      </div>
    </div>
  );
}
