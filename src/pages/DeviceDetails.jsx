import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatValue, getDeviceSummary } from '../utils/deviceFormatters.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

function pickArray(...values) {
  return values.find(Array.isArray) || [];
}

function KeyValueGrid({ items }) {
  return (
    <dl className="kv-grid">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function SimpleTable({ columns, rows, emptyText }) {
  if (!rows.length) {
    return <div className="empty-state compact">{emptyText}</div>;
  }

  return (
    <div className="table-wrap">
      <table className="device-table compact-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || row.name || row.service_name || `${row.mount || row.binary}-${index}`}>
              {columns.map((column) => (
                <td key={column.key}>{formatValue(row[column.key])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DeviceDetails() {
  const { scanId } = useParams();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await axiosClient.get(`/api/admin/devices/${scanId}`);
      setRecord(data?.device || data?.data || data);
    } catch (err) {
      setError(err.friendlyMessage || 'Unable to load device details.');
    } finally {
      setLoading(false);
    }
  }, [scanId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  if (loading) return <LoadingSpinner label="Loading device details" />;

  if (error) {
    return (
      <section className="center-card">
        <h1>Device details unavailable</h1>
        <p>{error}</p>
        <Link className="secondary-button" to="/admin">
          <ArrowLeft size={18} />
          Back to dashboard
        </Link>
      </section>
    );
  }

  const summary = getDeviceSummary(record);
  const user = record?.user || {};
  const scanData = record?.scan?.data || {};
  const disk = scanData.disk_info || scanData.disk || {};
  const partitions = pickArray(disk.partitions, scanData.partitions);
  const software = pickArray(scanData.installed_packages, scanData.software, scanData.packages);
  const databases = pickArray(scanData.databases, scanData.database_services);
  const webApplications = pickArray(scanData.web_applications, scanData.webApps, scanData.web_services);
  const services = pickArray(scanData.running_services, scanData.services);
  const jsonUrl = `${API_BASE_URL}/api/admin/devices/${summary.scanId}/json`;
  const pdfUrl = `${API_BASE_URL}/api/admin/devices/${summary.scanId}/pdf`;

  return (
    <section className="details-page">
      <div className="page-heading-row">
        <div>
          <Link className="back-link" to="/admin">
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
          <p className="section-kicker">Device details</p>
          <h1>{summary.hostname !== '-' ? summary.hostname : summary.scanId}</h1>
          <div className="details-meta">
            <span className="mono">{summary.scanId}</span>
            <StatusBadge completed={summary.completed} />
          </div>
        </div>
        <div className="download-actions small">
          <a className="secondary-button" href={jsonUrl}>
            <Download size={18} />
            Download JSON
          </a>
          <a className="primary-button" href={pdfUrl}>
            <Download size={18} />
            Download PDF
          </a>
        </div>
      </div>

      <section className="detail-card">
        <h2>User Details</h2>
        <KeyValueGrid
          items={[
            { label: 'Name', value: formatValue(user.name) },
            { label: 'Phone', value: formatValue(user.phone) },
            { label: 'PF Number', value: formatValue(user.pf_no || user.pfNo) },
            { label: 'Department', value: formatValue(user.department) },
            { label: 'Designation', value: formatValue(user.designation) },
          ]}
        />
      </section>

      <section className="detail-card">
        <h2>Scan Details</h2>
        <KeyValueGrid
          items={[
            { label: 'Scan ID', value: summary.scanId },
            { label: 'Status', value: summary.completed ? 'Completed' : 'Pending' },
            { label: 'Scan timestamp', value: formatDate(summary.timestamp) },
            { label: 'IP address', value: summary.ipAddress },
            { label: 'Hostname', value: summary.hostname },
            { label: 'OS', value: summary.os },
            { label: 'Architecture', value: summary.architecture },
          ]}
        />
      </section>

      <section className="detail-card">
        <h2>Disk Info</h2>
        <KeyValueGrid
          items={[
            { label: 'Total size', value: formatValue(disk.total_size || disk.total) },
            { label: 'Used', value: formatValue(disk.used) },
            { label: 'Free', value: formatValue(disk.free) },
            { label: 'Usage percentage', value: formatValue(disk.usage_percentage || disk.percent_used) },
          ]}
        />
        <SimpleTable
          columns={[
            { key: 'mount', label: 'Partition' },
            { key: 'filesystem', label: 'Filesystem' },
            { key: 'size', label: 'Size' },
            { key: 'used', label: 'Used' },
            { key: 'free', label: 'Free' },
            { key: 'usage_percentage', label: 'Usage %' },
          ]}
          rows={partitions}
          emptyText="No partition data available."
        />
      </section>

      <section className="detail-card">
        <h2>Software</h2>
        <SimpleTable
          columns={[
            { key: 'name', label: 'Package' },
            { key: 'version', label: 'Version' },
            { key: 'publisher', label: 'Publisher' },
          ]}
          rows={software}
          emptyText="No installed package data available."
        />
      </section>

      <section className="detail-card">
        <h2>Databases</h2>
        <SimpleTable
          columns={[
            { key: 'name', label: 'Database name' },
            { key: 'binary', label: 'Binary' },
            { key: 'port', label: 'Port' },
            { key: 'status', label: 'Status' },
            { key: 'version', label: 'Version' },
          ]}
          rows={databases}
          emptyText="No database services found."
        />
      </section>

      <section className="detail-card">
        <h2>Web Applications</h2>
        <SimpleTable
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'binary', label: 'Binary' },
            { key: 'port', label: 'Port' },
            { key: 'status', label: 'Status' },
            { key: 'version', label: 'Version' },
          ]}
          rows={webApplications}
          emptyText="No web application services found."
        />
      </section>

      <section className="detail-card">
        <h2>Running Services</h2>
        <SimpleTable
          columns={[
            { key: 'service_name', label: 'Service name' },
            { key: 'state', label: 'State' },
          ]}
          rows={services}
          emptyText="No running service data available."
        />
      </section>
    </section>
  );
}
