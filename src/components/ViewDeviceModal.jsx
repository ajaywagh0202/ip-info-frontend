import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import formatDate from '../utils/formatDate.js';
import { formatFieldKey, formatValue } from '../utils/formatField.js';

function getJsonData(record) {
  const value = record?.json_data || record?.jsonData || record?.data || {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

function renderValue(key, value) {
  if (value === null || value === undefined || value === '') return '—';
  if (['submitted_at', 'date_of_procurement', 'po_date', 'date', 'date_of_install', 'date_of_procurement'].includes(String(key))) {
    return formatDate(value, true);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return formatValue(value);
}

function FieldGrid({ items }) {
  return (
    <dl className="device-detail-grid">
      {items.map(({ label, value, key }) => (
        <div key={`${key || label}-${label}`}>
          <dt>{label}</dt>
          <dd>{renderValue(key, value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function DetailSection({ title, items, children }) {
  return (
    <section className="device-section">
      <h3>{title}</h3>
      {items?.length ? <FieldGrid items={items} /> : null}
      {children}
    </section>
  );
}

export default function ViewDeviceModal({ deviceId, initialRecord, onClose }) {
  const [record, setRecord] = useState(initialRecord || null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!deviceId) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    axiosInstance.get(`/api/admin/device-details/${deviceId}`)
      .then(({ data }) => {
        if (!active) return;
        setRecord(data?.data || data || {});
      })
      .catch((err) => {
        if (active) setError(err.friendlyMessage || 'Unable to load device details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [deviceId]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const jsonData = getJsonData(record);
  const user = [
    { key: 'name', label: formatFieldKey('name'), value: record?.name },
    { key: 'phone', label: formatFieldKey('phone'), value: record?.phone },
    { key: 'pf_no', label: formatFieldKey('pf_no'), value: record?.pf_no },
    { key: 'dept_name', label: formatFieldKey('dept_name'), value: record?.dept_name },
    { key: 'designation', label: formatFieldKey('designation'), value: record?.designation },
    { key: 'submitted_at', label: formatFieldKey('submitted_at'), value: record?.submitted_at },
  ];
  const device = [
    { key: 'target_ip', label: formatFieldKey('target_ip'), value: record?.target_ip },
    { key: 'device_type', label: formatFieldKey('device_type'), value: record?.device_type },
    { key: 'hostname', label: formatFieldKey('hostname'), value: record?.hostname },
    { key: 'os', label: formatFieldKey('os'), value: record?.os },
  ];
  const dsr = [
    { key: 'dsr_no', label: formatFieldKey('dsr_no'), value: record?.dsr_no },
    { key: 'Serial_no', label: formatFieldKey('Serial_no'), value: record?.Serial_no || record?.serial_number },
    { key: 'description', label: formatFieldKey('description'), value: record?.description },
    { key: 'make', label: formatFieldKey('make'), value: record?.make },
    { key: 'quantity', label: formatFieldKey('quantity'), value: record?.quantity },
    { key: 'ds_no', label: formatFieldKey('ds_no'), value: record?.ds_no },
    { key: 'date', label: formatFieldKey('date'), value: record?.date },
    { key: 'dsr_file', label: formatFieldKey('dsr_file'), value: record?.dsr_file },
  ];
  const po = [
    { key: 'po_no', label: formatFieldKey('po_no'), value: record?.po_no },
    { key: 'po_date', label: formatFieldKey('po_date'), value: record?.po_date },
    { key: 'value', label: formatFieldKey('value'), value: record?.value },
    { key: 'date_of_procurement', label: formatFieldKey('date_of_procurement'), value: record?.date_of_procurement },
  ];
  const deployment = [
    { key: 'given_to', label: formatFieldKey('given_to'), value: record?.given_to },
    { key: 'location', label: formatFieldKey('location'), value: record?.location },
    { key: 'date_of_install', label: formatFieldKey('date_of_install'), value: record?.date_of_install },
    { key: 'remarks', label: formatFieldKey('remarks'), value: record?.remarks },
  ];

  return createPortal(
    <div className="modal-backdrop modal-overlay" role="presentation" onMouseDown={onClose}>
      <section className="detail-modal device-modal modal-content" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
        <div className="view-modal-titlebar device-modal-titlebar">
          <div className="modal-title">
            <p className="section-kicker">Device details</p>
            <h2>{loading ? 'Loading...' : `Device Details - ${record?.name || 'Record'} | ${record?.device_type || 'Device'}`}</h2>
          </div>
          <button className="icon-button light" type="button" onClick={onClose} aria-label="Close device details modal">
            <X size={20} />
          </button>
        </div>

        <div className="view-modal-content device-modal-content">
          {loading ? <LoadingSpinner label="Loading device details" /> : null}
          {error ? <div className="alert alert-error">{error}</div> : null}
          {!loading && record ? (
            <>
              <DetailSection title="Dead Stock Register (DSR) Details" items={dsr} />
              <DetailSection title="User Information" items={user} />
              <DetailSection title="Device Information" items={device} />
              <DetailSection title="Purchase Order (PO) Details" items={po} />
              <DetailSection title="Deployment Details" items={deployment} />
              {jsonData && Object.keys(jsonData).length ? (
                <section className="device-section">
                  <h3>Scanner Data</h3>
                  <dl className="device-detail-grid">
                    {Object.entries(jsonData)
                      .filter(([, value]) => value !== null && value !== undefined && value !== '')
                      .map(([key, value]) => (
                        <div key={key}>
                          <dt>{formatFieldKey(key)}</dt>
                          <dd>{renderValue(key, value)}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
