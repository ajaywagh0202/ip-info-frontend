import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import formatDate from '../utils/formatDate.js';
import { formatFieldKey, formatValue } from '../utils/formatField.js';
import { getAdminProfile, getUserType } from '../utils/adminAuth.js';
import { registeredServerId, isServerDevice } from '../utils/serverDetails.js';
import ServerDetails from './ServerDetails.jsx';

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

export default function ViewDeviceModal({ deviceId, initialRecord, onClose, initialPanel = 'device' }) {
  const [record, setRecord] = useState(initialRecord || null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [error, setError] = useState('');
  const [guard, setGuard] = useState({ dirty: false, busy: false });
  const [panel, setPanel] = useState(initialPanel);
  const modalRef = useRef(null);
  const handleClose = useCallback(() => {
    if (guard.busy) return;
    if (guard.dirty && !window.confirm('Discard unsaved server or incident changes?')) return;
    onClose();
  }, [guard, onClose]);
  const profile = getAdminProfile();
  const userType = getUserType();
  const serverId = registeredServerId(record);
  const showServerSections = isServerDevice(record?.device_type || record?.register_device?.device_type);
  const activePanel = showServerSections ? panel : 'device';
  const canEditServer = userType === 0 || (userType === 1 && Boolean(profile.dept_code) && String(record?.dept_code || record?.register_device?.dept_code || '').toLowerCase() === String(profile.dept_code).toLowerCase());

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
      if (event.key === 'Escape') handleClose();
      if (event.key === 'Tab') {
        const elements = [...(modalRef.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') || [])].filter(element => element.getClientRects().length);
        const first = elements[0];
        const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  useEffect(() => {
    const previous = document.activeElement;
    modalRef.current?.querySelector('button')?.focus();
    return () => previous?.focus();
  }, []);


  const user = [
    { key: 'name', label: formatFieldKey('name'), value: record?.name },
    { key: 'phone', label: formatFieldKey('phone'), value: record?.phone },
    { key: 'pf_no', label: formatFieldKey('pf_no'), value: record?.pf_no },
    { key: 'dept_name', label: formatFieldKey('dept_name'), value: record?.dept_name },
    { key: 'designation', label: formatFieldKey('designation'), value: record?.designation },
    { key: 'section_office', label: formatFieldKey('section_office'), value: record?.section_office },
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
    { key: 'given_to', label: formatFieldKey('given_to'), value: record?.name },
    { key: 'location', label: formatFieldKey('location'), value: record?.section_office || record?.location },
    { key: 'date_of_install', label: formatFieldKey('date_of_install'), value: record?.date_of_install },
    { key: 'description', label: formatFieldKey('description'), value: record?.description },
    { key: 'dsr_file', label: formatFieldKey('dsr_file'), value: record?.dsr_file },
  ];
  const po = [
    { key: 'Serial_no', label: formatFieldKey('Serial_no'), value: record?.Serial_no || record?.serial_number },
    { key: 'po_no', label: formatFieldKey('po_no'), value: record?.po_no },
    { key: 'po_date', label: formatFieldKey('po_date'), value: record?.po_date },
    { key: 'make', label: formatFieldKey('make'), value: record?.make },
    { key: 'quantity', label: formatFieldKey('quantity'), value: record?.quantity },
    { key: 'value', label: formatFieldKey('value'), value: record?.value },
    { key: 'date_of_procurement', label: formatFieldKey('date_of_procurement'), value: record?.date_of_procurement },
  ];
  const deployment = [
    { key: 'remarks', label: formatFieldKey('remarks'), value: record?.remarks },
  ];

  const ds = [
    { key: 'ds_no', label: formatFieldKey('ds_no'), value: record?.ds_no },
    { key: 'date', label: formatFieldKey('date'), value: record?.date },
  ];

  return createPortal(
    <div className="modal-backdrop modal-overlay" role="presentation" onMouseDown={handleClose}>
      <section ref={modalRef} className="detail-modal device-modal device-view-modal modal-content" role="dialog" aria-modal="true" aria-label="Device details" onMouseDown={(event) => event.stopPropagation()}>
        <div className="view-modal-titlebar device-modal-titlebar">
          <div className="modal-title">
            <p className="section-kicker">Device details</p>
            <h2>{loading ? 'Loading...' : `Device Details - ${record?.name || 'Record'} | ${record?.device_type || 'Device'}`}</h2>
          </div>
          <button className="icon-button light" type="button" onClick={handleClose} disabled={guard.busy} aria-label="Close device details modal">
            <X size={20} />
          </button>
        </div>

        <nav className="device-detail-navigation" aria-label="Device detail sections">
          {[['device', 'Device Details'], ...(showServerSections ? [['server', 'Server Details'], ['breakdown', 'Breakdown Logs']] : [])].map(([key, label]) => (
            <button key={key} type="button" className={activePanel === key ? 'download-button' : 'secondary-button'} aria-pressed={activePanel === key} disabled={guard.busy} onClick={() => setPanel(key)}>{label}</button>
          ))}
        </nav>
        <div className="view-modal-content device-modal-content">
          {loading ? <LoadingSpinner label="Loading device details" /> : null}
          {error ? <div className="alert alert-error">{error}</div> : null}
          {!loading && record ? (
            <>
              <div hidden={activePanel !== 'device'}>
              <DetailSection title="User Information" items={user} />
              <DetailSection title="Purchase Order (PO) Details" items={po} />
              <DetailSection title="Dead Stock Register (DSR) Details" items={dsr} />
              <DetailSection title="Device Information" items={device} />
              <DetailSection title="DS-8 Details" items={ds} />
              <DetailSection title="Deployment Details" items={deployment} />
              </div>
              {showServerSections ? <div hidden={activePanel === 'device'}>
                {!error && serverId ? <ServerDetails key={serverId} serverId={serverId} canEdit={canEditServer} onGuardChange={setGuard} activeSection={activePanel} /> : !error ? <DetailSection title={activePanel === 'breakdown' ? 'Breakdown Logs' : 'Server Details'}><p>No registered-device ID is available. Register this device before managing server details or breakdown incidents.</p></DetailSection> : null}
              </div> : null}
            </>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}
