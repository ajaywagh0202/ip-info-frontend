import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronRight, ClipboardList, LoaderCircle, Save, ScanLine, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient.js';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import Toast from '../components/Toast.jsx';

const DEVICE_TYPES = ['Laptop', 'Desktop', 'All-in-One', 'Server', 'NAS Server'];
const CLIENT_IP_FALLBACK = String(import.meta.env.VITE_CLIENT_IP || '').trim();

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function emptyForm(overrides = {}) {
  return {
    serial_no: '',
    dsr_no: '',
    device_type: '',
    name: '',
    pf_no: '',
    phone: '',
    designation: '',
    department: '',
    section_office: '',
    target_ip: '',
    assigned_date: localToday(),
    ...overrides,
  };
}

function isLoopbackAddress(value) {
  const address = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return address === 'localhost' || address === '::1' || address === '0:0:0:0:0:0:0:1' || address === '127.0.0.1' || address.startsWith('127.') || address === '::ffff:127.0.0.1';
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function responseParts(response) {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response || {};
  return {
    payload,
    user: payload.user || payload.assigned_user || payload.registration || {},
    device: payload.device || payload.asset || {},
  };
}

function formFromResponse(response, fallback) {
  const { payload, user, device } = responseParts(response);
  return emptyForm({
    ...fallback,
    serial_no: firstValue(device.serial_no, device.serial, payload.serial_no, fallback.serial_no),
    dsr_no: firstValue(device.dsr_no, device.dsr, payload.dsr_no, fallback.dsr_no),
    device_type: firstValue(device.device_type, device.type, payload.device_type, fallback.device_type),
    name: firstValue(user.name, user.employee_name, payload.name, fallback.name),
    pf_no: firstValue(user.pf_no, user.pf, payload.pf_no, fallback.pf_no),
    phone: firstValue(user.phone, user.mobile, payload.phone, fallback.phone),
    designation: firstValue(user.designation, payload.designation, fallback.designation),
    department: firstValue(user.department, user.dept_name, payload.department, payload.dept_name, fallback.department),
    section_office: firstValue(user.section_office, user.section, user.office, payload.section_office, fallback.section_office),
    target_ip: firstValue(device.target_ip, device.ip_address, device.ip, payload.target_ip, payload.ip_address, fallback.target_ip),
    assigned_date: firstValue(device.assigned_date, device.date, payload.assigned_date, fallback.assigned_date, localToday()),
  });
}

function isAssigned(response) {
  const { payload } = responseParts(response);
  return payload.found === true && Number(payload.status) === 1;
}

function hasDeviceRecord(response) {
  const { payload, device } = responseParts(response);
  return payload.found === true && Boolean(firstValue(device.serial_no, device.serial, payload.serial_no));
}

function ErrorAlert({ message, onDismiss }) {
  if (!message) return null;
  return <div className="assignment-alert" role="alert"><span>{message}</span><button type="button" onClick={onDismiss} aria-label="Dismiss error"><X size={17} /></button></div>;
}

function ReadOnlyValue({ label, value }) {
  return <div className="assignment-readonly-field"><span>{label}</span><strong>{value || '—'}</strong></div>;
}

function Field({ label, name, value, onChange, readOnly, type = 'text', children }) {
  return (
    <label className="assignment-field">
      <span>{label}<em>*</em></span>
      {children || <input type={type} value={value} readOnly={readOnly} onChange={(event) => onChange(name, event.target.value)} />}
    </label>
  );
}

export default function DeviceRegistrationAssignment() {
  const navigate = useNavigate();
  const [serialSearch, setSerialSearch] = useState('');
  const [currentView, setCurrentView] = useState('search');
  const [formData, setFormData] = useState(() => emptyForm());
  const [serialReadOnly, setSerialReadOnly] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingDepartments, setIsFetchingDepartments] = useState(false);
  const [isFetchingDevices, setIsFetchingDevices] = useState(false);
  const [isFetchingIp, setIsFetchingIp] = useState(true);
  const [error, setError] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [toast, setToast] = useState(null);
  const [device, setDevice ] =  useState([]);

  useEffect(() => {
    let active = true;
    async function loadClientIp() {
      try {
        const response = await axiosClient.get('/api/ip');
        const apiIp = response.data?.ip || response.data?.data?.ip;
        const ip = !isLoopbackAddress(apiIp) ? apiIp : CLIENT_IP_FALLBACK;
        if (active && ip) setFormData((current) => current.target_ip ? current : { ...current, target_ip: String(ip) });
      } catch (requestError) {
        if (active) setError(requestError.friendlyMessage || 'Unable to fetch the client IP address. Please enter it manually.');
      } finally {
        if (active) setIsFetchingIp(false);
      }
    }
    loadClientIp();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (currentView !== 'form') return undefined;
    let active = true;
    async function loadDepartments() {
      setIsFetchingDepartments(true);
      try {
        const response = await axiosClient.get('/api/departments');
        const rows = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.records || [];
        if (active) setDepartments(rows);
      } catch (requestError) {
        if (active) setError(requestError.friendlyMessage || 'Unable to load departments. Please try again.');
      } finally {
        if (active) setIsFetchingDepartments(false);
      }
    }

    async function loadDevices(params) {
       setIsFetchingDevices(true);
      try {
        const response = await axiosClient.get('/api/devices');
        let rows = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.records || [];
        rows = rows.filter((item) => item.view == 1)
        if (active) setDevice(rows);
      } catch (requestError) {
        if (active) setError(requestError.friendlyMessage || 'Unable to load devices. Please try again.');
      } finally {
        if (active) setIsFetchingDevices(false);
      }
    }

    loadDepartments();
    loadDevices();
    return () => { active = false; };
  }, [currentView]);

  const startEditableRegistration = (response, serial, forceReadOnlySerial = false) => {
    setFormData((current) => formFromResponse(response, { ...current, serial_no: serial || current.serial_no }));
    setSerialReadOnly(forceReadOnlySerial);
    setCurrentView('form');
  };

  const searchDevice = async () => {
    const serial = serialSearch.trim();
    if (!serial) {
      setError('Enter a Serial Number Of Device to search.');
      return;
    }
    setError('');
    setFormErrors({});
    setIsSearching(true);
    try {
      const response = await axiosClient.get('/api/device/check', { params: { serial } });
      const result = response.data?.data || response.data || {};
      const fallback = { ...formData, serial_no: serial };
      if (isAssigned(result)) {
        setFormData(formFromResponse(result, fallback));
        setSerialReadOnly(true);
        setCurrentView('readonly');
      } else {
        startEditableRegistration(result, serial, hasDeviceRecord(result));
        if (result.found === false) {
          setToast({ type: 'warning', message: 'Serial not found. Complete the registration details to assign it.' });
        }
      }
    } catch (requestError) {
      if (requestError.response?.status === 404) {
        startEditableRegistration({ found: false }, serial, false);
        setToast({ type: 'warning', message: 'Serial not found. Complete the registration details to assign it.' });
      } else {
        setError(requestError.friendlyMessage || requestError.message || 'Unable to search for this serial number. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const updateField = (name, value) => {
    setFormData((current) => ({ ...current, [name]: value }));
    setFormErrors((current) => ({ ...current, [name]: '' }));
  };

  const saveRegistration = async () => {
    const requiredFields = ['serial_no', 'dsr_no', 'device_type', 'name', 'pf_no', 'phone', 'designation', 'department', 'section_office', 'assigned_date'];
    const errors = Object.fromEntries(requiredFields.filter((field) => !String(formData[field] || '').trim()).map((field) => [field, 'Required']));
    setFormErrors(errors);
    if (Object.keys(errors).length) {
      setError('Complete every required field before saving the registration.');
      return;
    }
    if (!String(formData.target_ip || '').trim()) {
      setError('The client IP address could not be detected. Refresh the page and try again.');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const response = await axiosClient.post('/api/register-device', formData);
      const saved = response.data?.data || response.data || {};
      setFormData((current) => formFromResponse(saved, current));
      setSerialReadOnly(true);
      setCurrentView('readonly');
      setToast({ type: 'success', message: 'Device registration saved successfully.' });
    } catch (requestError) {
      setError(requestError.friendlyMessage || requestError.message || 'Registration failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const scanDevice = () => {
    navigate('/ip-service/scan', {
      state: {
        serial_no: formData.serial_no,
        dsr_no: formData.dsr_no,
        pf_no: formData.pf_no,
        target_ip: formData.target_ip,
        flag: 1,
        registration: formData,
      },
    });
  };

  const resetSearch = () => {
    setSerialSearch('');
    setFormData((current) => emptyForm({ target_ip: current.target_ip }));
    setSerialReadOnly(false);
    setFormErrors({});
    setError('');
    setCurrentView('search');
  };

  const startSelfRegistration = () => {
    setSerialSearch('');
    setFormData((current) => emptyForm({ target_ip: current.target_ip }));
    setSerialReadOnly(false);
    setFormErrors({});
    setError('');
    setCurrentView('form');
  };

  return (
    <section className="assignment-page">
      <div className="assignment-heading">
        <div className="assignment-heading-icon"><ClipboardList size={25} /></div>
        <div><p>ITC System Scanner Portal</p><h1>Device Registration &amp; Assignment</h1><span>Search a serial number to view its assignment or register a new device.</span></div>
      </div>
      <ErrorAlert message={error} onDismiss={() => setError('')} />

      {currentView === 'search' ? (
        <div className="assignment-entry-grid">
          <section className="assignment-card assignment-search-card">
            <div><p className="assignment-kicker">Device lookup</p><h2>Find a device by serial number</h2><p>Enter the serial number printed on the device or asset label.</p></div>
            <div className="assignment-search-row">
              <label className="assignment-field"><span>Serial Number Of Device</span><input value={serialSearch} placeholder="Enter serial number" onChange={(event) => setSerialSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchDevice(); }} /></label>
              <button className="assignment-button assignment-button--primary" type="button" onClick={searchDevice} disabled={isSearching}>{isSearching ? <LoadingSpinner label="Searching…" /> : <><Search size={18} /> Search</>}</button>
            </div>
          </section>
          <section className="assignment-card assignment-self-registration-card">
            <div><p className="assignment-kicker">New user</p><h2>Register a device</h2><p>Start with a blank registration form if you are not already registered.</p></div>
            <button className="assignment-button assignment-button--primary" type="button" onClick={startSelfRegistration}><ClipboardList size={18} /> I am Not Register User</button>
          </section>
        </div>
      ) : null}

      {currentView === 'form' ? (
        <section className="assignment-card">
          <div className="assignment-card-heading"><div><p className="assignment-kicker">Device available</p><h2>Assign device details</h2><p>All fields are required. White fields can be edited before saving; the client IP is detected automatically.</p></div><button className="assignment-text-button" type="button" onClick={resetSearch}>Search another serial</button></div>
          <div className="assignment-form-grid">
            <Field label="Serial No." name="serial_no" value={formData.serial_no} readOnly={serialReadOnly} onChange={updateField} />
            <Field label="DSR No." name="dsr_no" value={formData.dsr_no} onChange={updateField} />
            <Field label="Device Type" name="device_type" value={formData.device_type} onChange={updateField}>
              {<select value={formData.device_type} onChange={(event) => updateField('device_type', event.target.value)}>
                <option value="">Select device type</option>
                {device.map((type) => <option key={type.device_name}>{type.device_name}</option>)}</select>}
                </Field>
            <Field label="Name" name="name" value={formData.name} onChange={updateField} />
            <Field label="PF No." name="pf_no" value={formData.pf_no} onChange={updateField} />
            <Field label="Phone" name="phone" value={formData.phone} onChange={updateField} type="tel" />
            <Field label="Designation" name="designation" value={formData.designation} onChange={updateField} />
            <Field label="Department" name="department" value={formData.department} onChange={updateField}>{
              <select value={formData.department} onChange={(event) => updateField('department', event.target.value)} disabled={isFetchingDepartments}><option value="">{isFetchingDepartments ? 'Loading departments…' : 'Select department'}</option>{departments.map((department) => { const value = department.dept_code || department.code || department.dept_name || department.deptname || department.name || String(department); const label = department.dept_name || department.deptname || department.name || department.dept_code || String(department); return <option key={value} value={value}>{label}</option>; })}</select>}</Field>
            <Field label="Section / Office" name="section_office" value={formData.section_office} onChange={updateField} />
            <Field label="Assigned Date" name="assigned_date" value={formData.assigned_date} onChange={updateField} type="date" />
          </div>
          {Object.keys(formErrors).length ? <p className="assignment-validation">All fields marked with * are required.</p> : null}
          <div className="assignment-actions"><span>{isFetchingIp ? <><LoaderCircle className="spin-icon" size={15} /> Fetching client IP…</> : null}</span><button className="assignment-button assignment-button--primary" type="button" onClick={saveRegistration} disabled={isSaving || isFetchingIp}>{isSaving ? <LoadingSpinner label="Saving registration…" /> : isFetchingIp ? <LoadingSpinner label="Detecting client IP…" /> : <><Save size={18} /> Save Registration</>}</button></div>
        </section>
      ) : null}

      {currentView === 'readonly' ? (
        <section className="assignment-card assignment-readonly-card">
          <div className="assignment-card-heading"><div><p className="assignment-kicker">Device assigned</p><h2>Assignment details</h2><p>These registration details are read-only.</p></div><span className="assignment-status"><CheckCircle2 size={17} /> Device Already Assigned</span></div>
          <div className="assignment-readonly-grid">
            <ReadOnlyValue label="Serial No." value={formData.serial_no} /><ReadOnlyValue label="DSR No." value={formData.dsr_no} /><ReadOnlyValue label="Device Type" value={formData.device_type} /><ReadOnlyValue label="Name" value={formData.name} /><ReadOnlyValue label="PF No." value={formData.pf_no} /><ReadOnlyValue label="Phone" value={formData.phone} /><ReadOnlyValue label="Designation" value={formData.designation} /><ReadOnlyValue label="Department" value={formData.department} /><ReadOnlyValue label="Section / Office" value={formData.section_office} /><ReadOnlyValue label="Assigned Date" value={formData.assigned_date} />
          </div>
          <div className="assignment-actions"><button className="assignment-text-button" type="button" onClick={resetSearch}>Search another serial</button><button className="assignment-button assignment-button--primary" type="button" onClick={scanDevice}><ScanLine size={19} /> Scan Device <ChevronRight size={18} /></button></div>
        </section>
      ) : null}
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </section>
  );
}
