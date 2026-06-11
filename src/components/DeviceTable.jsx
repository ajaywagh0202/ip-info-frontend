import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { formatDate, getDeviceSummary } from '../utils/deviceFormatters.js';

export default function DeviceTable({ devices }) {
  const navigate = useNavigate();

  if (!devices.length) {
    return (
      <div className="empty-state">
        <h3>No devices found</h3>
        <p>Try changing the filters or refresh once scanner data is available.</p>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="device-table">
        <thead>
          <tr>
            <th>Scan ID</th>
            <th>Name</th>
            <th>PF Number</th>
            <th>Phone</th>
            <th>Department</th>
            <th>Designation</th>
            <th>IP Address</th>
            <th>Hostname</th>
            <th>OS</th>
            <th>Scan Status</th>
            <th>Registered Date</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {devices.map((record) => {
            const summary = getDeviceSummary(record);

            return (
              <tr key={summary.scanId}>
                <td className="mono">{summary.scanId}</td>
                <td>{summary.name}</td>
                <td>{summary.pfNo}</td>
                <td>{summary.phone}</td>
                <td>{summary.department}</td>
                <td>{summary.designation}</td>
                <td>{summary.ipAddress}</td>
                <td>{summary.hostname}</td>
                <td>{summary.os}</td>
                <td>
                  <StatusBadge completed={summary.completed} />
                </td>
                <td>{formatDate(summary.createdAt)}</td>
                <td>
                  <button
                    className="icon-text-button"
                    type="button"
                    onClick={() => navigate(`/admin/devices/${summary.scanId}`)}
                  >
                    <Eye size={16} />
                    View Details
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
