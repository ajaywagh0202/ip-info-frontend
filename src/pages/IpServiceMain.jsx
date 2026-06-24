import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, Cpu, LoaderCircle, Network, Save, Search, Wifi, WifiOff, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Toast from '../components/Toast.jsx';

const EMPTY_FORM = {
  name: '',
  phone: '',
  pf_no: '',
  dept_code: '',
  dept_name: '',
  designation: '',
  device_type: '',
  date_of_procurement: '',
  serial_no: '',
  description: '',
  make: '',
  quantity: '',
  po_no: '',
  po_date: '',
  value: '',
  given_to: '',
  location: '',
  date_of_install: '',
  remarks: '',
  dsr_file: '',
  ds_no: '',
  date: '',
};

const SUMMARY_FIELDS = [
  ['name', 'Name'], ['phone', 'Phone'], ['pf_no', 'PF No.'], ['dept_code', 'Department Code'],
  ['dept_name', 'Department Name'], ['designation', 'Designation'], ['device_type', 'Device Type'],
  ['date_of_procurement', 'Date of Procurement'], ['serial_no', 'Serial No.'], ['description', 'Description'],
  ['make', 'Make'], ['quantity', 'Quantity'], ['po_no', 'PO No.'], ['po_date', 'PO Date'], ['value', 'Value'],
  ['given_to', 'Given To'], ['location', 'Location'], ['date_of_install', 'Date of Install'],
  ['remarks', 'Remarks'], ['dsr_file', 'DSR File'], ['ds_no', 'DS No.'], ['date', 'Date'],
];

const DEPARTMENTS = ['ACCOUNT', 'OPERATING', 'S_AND_T', 'MECHANICAL', 'ELECTRICAL', 'COMMERCIAL', 'IT'];
const DEVICE_TYPES = ['Desktop', 'Laptop', 'Printer', 'Server', 'Switch', 'Other'];
const CLIENT_IP_FALLBACK = String(import.meta.env.VITE_CLIENT_IP || '').trim();

function isLoopbackAddress(value) {
  const address = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return address === 'localhost' || address === '::1' || address === '0:0:0:0:0:0:0:1' || address === '127.0.0.1' || address.startsWith('127.') || address === '::ffff:127.0.0.1';
}

function displayValue(value) {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function ErrorAlert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="ip-alert ip-alert--error" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error"><X size={17} /></button>
    </div>
  );
}

function DeviceSummary({ record, dsrNo, targetIp }) {
  return (
    <section className="ip-card ip-summary-card" aria-label="Registered device details">
      <div className="ip-card-heading">
        <div>
          <p className="ip-kicker">Registration record</p>
          <h2>Registered device details</h2>
        </div>
        <span className="ip-badge ip-badge--registered"><CheckCircle2 size={16} /> Device Already Registered</span>
      </div>
      <dl className="ip-summary-grid">
        <div><dt>DSR Number</dt><dd>{displayValue(record.dsr_no || dsrNo)}</dd></div>
        <div><dt>Target IP Address</dt><dd>{displayValue(record.target_ip || targetIp)}</dd></div>
        {SUMMARY_FIELDS.map(([key, label]) => (
          <div key={key}><dt>{label}</dt><dd>{displayValue(record[key])}</dd></div>
        ))}
      </dl>
    </section>
  );
}

function RegistrationField({ label, field, value, onChange, required, type = 'text', placeholder }) {
  return (
    <label className="ip-field">
      <span>{label}{required ? <em>*</em> : null}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(field, event.target.value)}
      />
    </label>
  );
}

export default function IpServiceMain() {
  const navigate = useNavigate();
  const [dsrNo, setDsrNo] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [record, setRecord] = useState(null);
  const [lookupState, setLookupState] = useState('idle');
  const [loadingIp, setLoadingIp] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadClientIp() {
      try {
        const response = await axiosClient.get('/api/ip-service/my-ip');
        const apiIp = response.data?.ip || response.data?.data?.ip;
        const ip = !isLoopbackAddress(apiIp) ? apiIp : CLIENT_IP_FALLBACK;
        if (active && ip) setTargetIp(String(ip));
        if (active && isLoopbackAddress(apiIp) && !CLIENT_IP_FALLBACK) {
          setError('The IP service returned a loopback address. Enter the target LAN IP manually or configure VITE_CLIENT_IP.');
        }
      } catch (requestError) {
        if (active) setError(requestError.friendlyMessage || 'Unable to auto-fetch this machine’s IP address. You can enter it manually.');
      } finally {
        if (active) setLoadingIp(false);
      }
    }
    loadClientIp();
    return () => { active = false; };
  }, []);

  const handleDsrChange = (value) => {
    setDsrNo(value);
    setRecord(null);
    setLookupState('idle');
    setError('');
  };

  const lookupDsr = async () => {
    const value = dsrNo.trim();
    if (!value) {
      setError('Enter a DSR Number to look up a device.');
      return;
    }

    setError('');
    setRecord(null);
    setLookupState('loading');
    try {
      const response = await axiosClient.get('/api/ip-service/register', { params: { dsr_no: value } });
      const device = response.data?.data || response.data;
      if (!device || typeof device !== 'object') throw new Error('No registration data was returned for this DSR Number.');
      setRecord(device);
      setLookupState('registered');
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        setLookupState('new');
      } else {
        setLookupState('idle');
        setError(requestError.friendlyMessage || requestError.message || 'Unable to look up the DSR Number. Please try again.');
      }
    }
  };

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
  };

  const saveRegistration = async () => {
    const requiredFields = ['name', 'phone', 'pf_no', 'dept_name', 'designation', 'device_type'];
    const nextErrors = Object.fromEntries(requiredFields.filter((field) => !String(form[field]).trim()).map((field) => [field, 'Required']));
    if (!dsrNo.trim()) nextErrors.dsr_no = 'Enter a DSR Number before saving.';
    if (!targetIp.trim()) nextErrors.target_ip = 'Enter a Target IP Address before saving.';
    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Complete the required registration details before saving.');
      return;
    }

    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        dsr_no: dsrNo.trim(),
        target_ip: targetIp.trim(),
        quantity: form.quantity === '' ? '' : Number(form.quantity),
      };
      const response = await axiosClient.post('/api/ip-service/register', payload);
      setRecord(response.data?.data || response.data || payload);
      setLookupState('registered');
      setToast({ type: 'success', message: 'Device registered successfully' });
    } catch (requestError) {
      setError(requestError.friendlyMessage || requestError.message || 'Unable to save the registration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const goToScan = (flag) => {
    if (!dsrNo.trim() || !targetIp.trim()) {
      setError('Enter both a DSR Number and Target IP Address before starting a scan.');
      return;
    }
    navigate('/ip-service/scan', {
      state: {
        dsr_no: dsrNo.trim(),
        target_ip: targetIp.trim(),
        flag,
        registration: record || { ...form, dsr_no: dsrNo.trim(), target_ip: targetIp.trim() },
      },
    });
  };

  return (
    <section className="ip-service-page">
      <div className="ip-card ip-entry-card">
        <div className="ip-entry-heading">
          <div className="ip-heading-icon"><Network size={25} /></div>
          <div>
            <p className="ip-kicker">ITC System Scanner Portal</p>
            <h1>IP Service — Device Registration &amp; Scan</h1>
            <p>Look up a DSR record, register new equipment, and run a remote device scan.</p>
          </div>
        </div>
        <ErrorAlert message={error} onDismiss={() => setError('')} />
        <div className="ip-search-grid">
          <label className="ip-field ip-search-field">
            <span>DSR Number</span>
            <div className="ip-input-action">
              <input
                value={dsrNo}
                placeholder="Enter DSR No."
                onChange={(event) => handleDsrChange(event.target.value)}
                onBlur={lookupDsr}
                onKeyDown={(event) => { if (event.key === 'Enter') lookupDsr(); }}
              />
              <button className="ip-search-button" type="button" onClick={lookupDsr} disabled={lookupState === 'loading'} aria-label="Look up DSR Number">
                {lookupState === 'loading' ? <LoaderCircle className="spin-icon" size={18} /> : <Search size={18} />}
              </button>
            </div>
            {formErrors.dsr_no ? <small className="ip-field-error">{formErrors.dsr_no}</small> : null}
          </label>
          <label className="ip-field ip-search-field">
            <span>Target IP Address {loadingIp ? <LoaderCircle className="spin-icon ip-inline-loader" size={14} /> : null}</span>
            <input value={targetIp} placeholder="Auto-fetched or enter manually" onChange={(event) => setTargetIp(event.target.value)} />
            {formErrors.target_ip ? <small className="ip-field-error">{formErrors.target_ip}</small> : null}
          </label>
        </div>
      </div>

      {lookupState === 'loading' ? <div className="ip-card ip-loading-card"><LoadingSpinner label="Looking up registration…" /></div> : null}

      {lookupState === 'registered' && record ? <DeviceSummary record={record} dsrNo={dsrNo} targetIp={targetIp} /> : null}

      {lookupState === 'new' ? (
        <section className="ip-card ip-registration-card">
          <div className="ip-card-heading">
            <div>
              <p className="ip-kicker">New device</p>
              <h2>Registration details</h2>
              <p>Fields marked with an asterisk are required.</p>
            </div>
            <span className="ip-badge ip-badge--new"><Cpu size={16} /> New Device — Fill Registration Details</span>
          </div>
          <div className="ip-form-grid">
            <RegistrationField label="Name" field="name" value={form.name} onChange={updateForm} required />
            <RegistrationField label="Phone" field="phone" value={form.phone} onChange={updateForm} required type="tel" />
            <RegistrationField label="PF No." field="pf_no" value={form.pf_no} onChange={updateForm} required />
            <label className="ip-field"><span>Department Code</span><select value={form.dept_code} onChange={(event) => updateForm('dept_code', event.target.value)}><option value="">Select department code</option>{DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}</select></label>
            <RegistrationField label="Department Name" field="dept_name" value={form.dept_name} onChange={updateForm} required />
            <RegistrationField label="Designation" field="designation" value={form.designation} onChange={updateForm} required />
            <label className="ip-field"><span>Device Type<em>*</em></span><select value={form.device_type} onChange={(event) => updateForm('device_type', event.target.value)}><option value="">Select device type</option>{DEVICE_TYPES.map((type) => <option key={type}>{type}</option>)}</select>{formErrors.device_type ? <small className="ip-field-error">Required</small> : null}</label>
            <RegistrationField label="Date of Procurement" field="date_of_procurement" value={form.date_of_procurement} onChange={updateForm} type="date" />
            <RegistrationField label="Serial No." field="serial_no" value={form.serial_no} onChange={updateForm} />
            <RegistrationField label="Make" field="make" value={form.make} onChange={updateForm} />
            <RegistrationField label="Quantity" field="quantity" value={form.quantity} onChange={updateForm} type="number" />
            <RegistrationField label="PO No." field="po_no" value={form.po_no} onChange={updateForm} />
            <RegistrationField label="PO Date" field="po_date" value={form.po_date} onChange={updateForm} type="date" />
            <RegistrationField label="Value" field="value" value={form.value} onChange={updateForm} />
            <RegistrationField label="Given To" field="given_to" value={form.given_to} onChange={updateForm} />
            <RegistrationField label="Location" field="location" value={form.location} onChange={updateForm} />
            <RegistrationField label="Date of Install" field="date_of_install" value={form.date_of_install} onChange={updateForm} type="date" />
            <RegistrationField label="DSR File" field="dsr_file" value={form.dsr_file} onChange={updateForm} />
            <RegistrationField label="DS No." field="ds_no" value={form.ds_no} onChange={updateForm} />
            <RegistrationField label="Date" field="date" value={form.date} onChange={updateForm} type="date" />
            <label className="ip-field ip-field--wide"><span>Description</span><textarea value={form.description} onChange={(event) => updateForm('description', event.target.value)} /></label>
            <label className="ip-field ip-field--wide"><span>Remarks</span><textarea value={form.remarks} onChange={(event) => updateForm('remarks', event.target.value)} /></label>
          </div>
          <div className="ip-form-actions">
            <button className="ip-button ip-button--primary" type="button" onClick={saveRegistration} disabled={saving}>
              {saving ? <LoadingSpinner label="Saving registration…" /> : <><Save size={18} /> Save Registration</>}
            </button>
          </div>
        </section>
      ) : null}

      <section className="ip-card ip-scan-actions">
        <div>
          <p className="ip-kicker">Device scan</p>
          <h2>Choose scan mode</h2>
          <p>Online scans save their results to the central server; offline scans remain local.</p>
        </div>
        <div className="ip-scan-button-row">
          <button className="ip-button ip-button--primary" type="button" onClick={() => goToScan(1)}><Wifi size={19} /> Scan Device (Online)<ChevronRight size={18} /></button>
          <button className="ip-button ip-button--offline" type="button" onClick={() => goToScan(0)} title="Offline mode — scan results will NOT be saved to the server."><WifiOff size={19} /> Scan Device (Offline)<ChevronRight size={18} /></button>
        </div>
      </section>
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </section>
  );
}
