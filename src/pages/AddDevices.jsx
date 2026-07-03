import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ClipboardList, LoaderCircle, Save, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axiosClient from '../api/axiosClient.js';
import Toast from '../components/Toast.jsx';

const CLIENT_IP_FALLBACK = String(import.meta.env.VITE_CLIENT_IP || '').trim();

function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function rowsFrom(data) {
  return Array.isArray(data) ? data : data?.data || data?.records || data?.items || [];
}

function isLoopbackAddress(value) {
  const address = String(value || '').trim().toLowerCase().replace(/^\[|\]$/g, '');
  return address === 'localhost'
    || address === '::1'
    || address === '0:0:0:0:0:0:0:1'
    || address === '127.0.0.1'
    || address.startsWith('127.')
    || address === '::ffff:127.0.0.1';
}

function emptyForm(overrides = {}) {
  return {
    id: '',
    _id: '',
    record_id: '',
    pf_no: '',
    name: '',
    phone: '',
    designation: '',
    department: '',
    dept_code: '',
    dept_name: '',
    section_office: '',
    Section: '',
    serial_no: '',
    dsr_no: '',
    device_type: '',
    is_hiring: '0',
    from_date: '',
    to_date: '',
    contract_no: '',
    sr_no: '',
    given_to: '',
    location: '',
    description: '',
    make: '',
    date_of_install: '',
    remarks: '',
    target_ip: '',
    assigned_date: localToday(),
    date_of_procurement: '',
    quantity: '',
    po_no: '',
    po_date: '',
    value: '',
    date: '',
    dsr_file: '',
    ds_no: '',
    ...overrides,
  };
}

function getDepartmentCode(department) {
  return String(department?.dept_code || department?.code || '').trim();
}

function getDepartmentName(department) {
  return String(department?.dept_name || department?.deptname || department?.name || department?.department || '').trim();
}

function getDeviceValue(device) {
  return String(device?.device_name || device?.name || device?.device_code || device?.code || device || '').trim();
}

function getDeviceLabel(device) {
  return String(device?.device_name || device?.name || device?.device_code || device?.code || device || '').trim();
}

function responseParts(response) {
  const payload = response?.data && typeof response.data === 'object' ? response.data : response || {};
  return {
    payload,
    user: payload.user || payload.assigned_user || payload.registration || {},
    device: payload.device || payload.asset || {},
  };
}

function formFromResponse(response, fallback = emptyForm()) {
  const { payload, user, device } = responseParts(response);
  const merged = { ...payload, ...user, ...device };
  const name = firstValue(merged.name, fallback.name);
  const sectionOffice = firstValue(merged.section_office, merged.Section, merged.section, merged.office, fallback.section_office);
  const deptName = firstValue(merged.dept_name, merged.department, fallback.dept_name, fallback.department);
  const deptCode = firstValue(merged.dept_code, fallback.dept_code);

  return emptyForm({
    ...fallback,
    ...merged,
    id: firstValue(merged.id, payload.id, fallback.id),
    _id: firstValue(merged._id, payload._id, fallback._id),
    record_id: firstValue(merged.record_id, payload.record_id, fallback.record_id),
    pf_no: firstValue(merged.pf_no, merged.pf, fallback.pf_no),
    name,
    phone: firstValue(merged.phone, merged.mobile, fallback.phone),
    designation: firstValue(merged.designation, fallback.designation),
    department: deptName,
    dept_code: deptCode,
    dept_name: deptName,
    section_office: sectionOffice,
    Section: sectionOffice,
    serial_no: firstValue(merged.serial_no, merged.serial, fallback.serial_no),
    dsr_no: firstValue(merged.dsr_no, merged.dsr, fallback.dsr_no),
    device_type: firstValue(merged.device_type, merged.type, fallback.device_type),
    is_hiring: String(Number(firstValue(merged.is_hiring, fallback.is_hiring, 0))),
    given_to: name,
    location: sectionOffice,
    assigned_date: firstValue(merged.assigned_date, fallback.assigned_date, localToday()),
    target_ip: firstValue(merged.target_ip, merged.ip_address, merged.ip, fallback.target_ip),
    quantity: firstValue(merged.quantity, merged.quanity, fallback.quantity),
  });
}

function getSaveRecordId(form, queryRecordId) {
  return firstValue(queryRecordId, form.record_id, form.id, form._id);
}

function Field({ label, required = false, error, wide = false, children }) {
  return (
    <label className={`device-register-field${wide ? ' device-register-field--wide' : ''}`}>
      <span>
        {label}
        {required ? <em>*</em> : null}
      </span>
      {children}
      {error ? <small>{error}</small> : null}
    </label>
  );
}

function ReadOnlyValue({ label, value, wide = false }) {
  return (
    <div className={`device-register-readonly${wide ? ' device-register-field--wide' : ''}`}>
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

function ErrorAlert({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="assignment-alert" role="alert">
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error">
        <X size={17} />
      </button>
    </div>
  );
}

function FormSkeleton() {
  return (
    <section className="assignment-page add-device-page">
      <div className="device-register-skeleton">
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

export default function AddDevices() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryRecordId = searchParams.get('_id') || searchParams.get('id') || searchParams.get('record_id') || '';
  const querySerialNo = searchParams.get('serial_no') || searchParams.get('serial') || '';
  const hasRecordLookup = Boolean(queryRecordId || querySerialNo);

  const [form, setForm] = useState(() => emptyForm({ serial_no: querySerialNo }));
  const [rawRecord, setRawRecord] = useState({});
  const [departments, setDepartments] = useState([]);
  const [devices, setDevices] = useState([]);
  const [dropdownErrors, setDropdownErrors] = useState({});
  const [recordLoaded, setRecordLoaded] = useState(false);
  const [recordNotFound, setRecordNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  const recordFetchParams = useMemo(() => (
    queryRecordId ? { _id: queryRecordId } : { serial_no: querySerialNo }
  ), [queryRecordId, querySerialNo]);

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setRecordNotFound(false);
    setError('');
    setDropdownErrors({});

    const recordRequest = hasRecordLookup
      ? axiosClient.get('/api/register-device', { params: recordFetchParams })
      : Promise.resolve({ data: null });

    const [recordResult, departmentsResult, devicesResult, ipResult] = await Promise.allSettled([
      recordRequest,
      axiosClient.get('/api/departments'),
      axiosClient.get('/api/devices'),
      axiosClient.get('/api/ip'),
    ]);

    if (departmentsResult.status === 'fulfilled') {
      setDepartments(rowsFrom(departmentsResult.value.data));
    } else {
      setDropdownErrors((current) => ({ ...current, departments: 'Could not load options' }));
    }

    if (devicesResult.status === 'fulfilled') {
      setDevices(rowsFrom(devicesResult.value.data));
    } else {
      setDropdownErrors((current) => ({ ...current, devices: 'Could not load options' }));
    }

    const detectedIp = ipResult.status === 'fulfilled'
      ? ipResult.value.data?.ip || ipResult.value.data?.data?.ip
      : '';
    const targetIp = !isLoopbackAddress(detectedIp) ? detectedIp : CLIENT_IP_FALLBACK;

    if (recordResult.status === 'fulfilled' && recordResult.value.data) {
      const nextForm = formFromResponse(recordResult.value.data, emptyForm({ target_ip: targetIp, serial_no: querySerialNo }));
      setForm(nextForm);
      setRawRecord({ ...responseParts(recordResult.value.data).payload, ...responseParts(recordResult.value.data).user, ...responseParts(recordResult.value.data).device });
      setRecordLoaded(true);
    } else if (recordResult.status === 'rejected' && hasRecordLookup) {
      if (recordResult.reason?.response?.status === 404) {
        setRecordNotFound(true);
      } else {
        setError(recordResult.reason?.friendlyMessage || recordResult.reason?.message || 'Unable to load registration record.');
      }
    } else {
      setForm((current) => emptyForm({ ...current, serial_no: querySerialNo, target_ip: current.target_ip || targetIp }));
    }

    setLoading(false);
  }, [hasRecordLookup, querySerialNo, recordFetchParams]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (!departments.length || form.dept_code || !form.dept_name) return;
    const matched = departments.find((department) => getDepartmentName(department).toLowerCase() === form.dept_name.toLowerCase());
    if (!matched) return;
    const deptCode = getDepartmentCode(matched);
    if (!deptCode) return;
    setForm((current) => ({ ...current, dept_code: deptCode }));
  }, [departments, form.dept_code, form.dept_name]);

  const updateField = (name, value) => {
    setForm((current) => {
      const next = { ...current, [name]: value };
      if (name === 'name') next.given_to = value;
      if (name === 'section_office') {
        next.location = value;
        next.Section = value;
      }
      if (name === 'is_hiring' && value === '0') {
        next.from_date = '';
        next.to_date = '';
        next.contract_no = '';
        next.sr_no = '';
      }
      return next;
    });
    setFormErrors((current) => ({ ...current, [name]: '' }));
    setError('');
  };

  const updateDepartment = (value) => {
    const selected = departments.find((department) => getDepartmentCode(department) === value);
    const deptName = getDepartmentName(selected);
    setForm((current) => ({
      ...current,
      department: deptName,
      dept_code: value,
      dept_name: deptName,
    }));
    setFormErrors((current) => ({ ...current, department: '', dept_code: '', dept_name: '' }));
    setError('');
  };

  const validate = () => {
    const requiredFields = {
      serial_no: 'Serial No. is required.',
      target_ip: 'Target IP is required.',
      device_type: 'Device type is required.',
      pf_no: 'PF No. is required.',
      name: 'Name is required.',
      phone: 'Phone is required.',
      designation: 'Designation is required.',
      dept_code: 'Department is required.',
      section_office: 'Section / Office is required.',
      assigned_date: 'Assigned date is required.',
    };

    const nextErrors = Object.fromEntries(
      Object.entries(requiredFields)
        .filter(([field]) => !String(form[field] || '').trim())
        .map(([field, message]) => [field, message]),
    );

    if (Number(form.is_hiring) === 1) {
      if (!String(form.from_date || '').trim()) nextErrors.from_date = 'Hire from date is required.';
      if (!String(form.to_date || '').trim()) nextErrors.to_date = 'Hire to date is required.';
      if (!String(form.contract_no || '').trim()) nextErrors.contract_no = 'Contract number is required.';
    } else if (!String(form.dsr_no || '').trim()) {
      nextErrors.dsr_no = 'DSR No. is required.';
    }

    setFormErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      setError('Please fill all required fields before saving.');
      return false;
    }

    if (!String(form.target_ip || '').trim()) {
      setError('Client IP could not be detected. Please refresh and try again.');
      return false;
    }

    return true;
  };

  const buildPayload = () => {
    const isHiring = Number(form.is_hiring) === 1 ? 1 : 0;
    const sectionOffice = String(form.section_office || '').trim();
    const name = String(form.name || '').trim();
    const deptName = String(form.dept_name || form.department || '').trim();

    return {
      ...rawRecord,
      ...form,
      pf_no: String(form.pf_no || '').trim(),
      name,
      phone: String(form.phone || '').trim(),
      designation: String(form.designation || '').trim(),
      department: deptName,
      dept_code: String(form.dept_code || '').trim(),
      dept_name: deptName,
      section_office: sectionOffice,
      Section: sectionOffice,
      serial_no: String(form.serial_no || '').trim(),
      dsr_no: String(form.dsr_no || '').trim(),
      device_type: String(form.device_type || '').trim(),
      target_ip: String(form.target_ip || '').trim(),
      assigned_date: String(form.assigned_date || '').trim(),
      date_of_procurement: String(form.date_of_procurement || '').trim(),
      description: String(form.description || '').trim(),
      make: String(form.make || '').trim(),
      quantity: String(form.quantity || '').trim(),
      quanity: String(form.quantity || '').trim(),
      po_no: String(form.po_no || '').trim(),
      po_date: String(form.po_date || '').trim(),
      value: String(form.value || '').trim(),
      given_to: name,
      location: sectionOffice,
      date_of_install: String(form.date_of_install || '').trim(),
      remarks: String(form.remarks || '').trim(),
      dsr_file: String(form.dsr_file || '').trim(),
      ds_no: String(form.ds_no || '').trim(),
      date: String(form.date || '').trim(),
      is_hiring: isHiring,
      from_date: isHiring ? String(form.from_date || '').trim() : '',
      to_date: isHiring ? String(form.to_date || '').trim() : '',
      contract_no: isHiring ? String(form.contract_no || '').trim() : '',
      sr_no: isHiring ? String(form.sr_no || '').trim() : '',
    };
  };

  const saveDeviceDetails = async (payload) => {
    if (!payload.serial_no) return false;
    await axiosClient.put(`/api/admin/device-details/${encodeURIComponent(payload.serial_no)}`, {
      target_ip: payload.target_ip,
      device_type: payload.device_type,
      dsr_no: payload.dsr_no,
      date_of_procurement: payload.date_of_procurement,
      description: payload.description,
      make: payload.make,
      quantity: payload.quantity,
      quanity: payload.quantity,
      po_no: payload.po_no,
      po_date: payload.po_date,
      value: payload.value,
      given_to: payload.given_to,
      location: payload.location,
      date_of_install: payload.date_of_install,
      remarks: payload.remarks,
      dsr_file: payload.dsr_file,
      ds_no: payload.ds_no,
      date: payload.date,
      is_hiring: payload.is_hiring,
      from_date: payload.from_date,
      to_date: payload.to_date,
      contract_no: payload.contract_no,
      sr_no: payload.sr_no,
    });
    return true;
  };

  const saveRegistration = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    const payload = buildPayload();
    const saveRecordId = getSaveRecordId(form, queryRecordId);

    setSaving(true);
    setError('');
    try {
      if (saveRecordId) {
        await axiosClient.put(`/api/register-device/${encodeURIComponent(saveRecordId)}`, payload);
      } else {
        await axiosClient.post('/api/register-device', payload);
      }
      let detailsWarning = false;
      if (!saveRecordId) {
        try {
          await saveDeviceDetails(payload);
        } catch {
          detailsWarning = true;
        }
      }
      setForm(emptyForm({ target_ip: payload.target_ip }));
      setRawRecord(payload);
      setRecordLoaded(false);
      setFormErrors({});
      setToast({
        type: detailsWarning ? 'warning' : 'success',
        message: detailsWarning ? 'Registration saved, but detailed device fields could not be updated.' : 'Registration saved',
      });
    } catch (requestError) {
      setError(requestError.friendlyMessage || requestError.message || 'Unable to save registration.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/devices');
  };

  if (loading) return <FormSkeleton />;

  if (recordNotFound) {
    return (
      <section className="assignment-page add-device-page">
        <div className="empty-state">
          <h2>Record not found</h2>
          <p>The requested device registration could not be found.</p>
          <button className="secondary-button" type="button" onClick={cancel}>
            <ArrowLeft size={17} />
            Back
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="assignment-page add-device-page">
      <div className="assignment-heading">
        <div className="assignment-heading-icon"><ClipboardList size={25} /></div>
        <div>
          <p>ITC System Scanner Portal</p>
          <h1>{recordLoaded ? 'Edit Device Registration' : 'Add Device Registration'}</h1>
        </div>
      </div>

      <ErrorAlert message={error} onDismiss={() => setError('')} />

      <form className="device-register-form" onSubmit={saveRegistration} noValidate>
        <section className="device-register-card">
          <div className="device-register-card__header">
            <div>
              <p className="assignment-kicker">Section A</p>
              <h2>User details</h2>
            </div>
          </div>
          <div className="device-register-grid">
            <Field label="PF No." required error={formErrors.pf_no}>
              <input value={form.pf_no} readOnly={recordLoaded} onChange={(event) => updateField('pf_no', event.target.value)} />
            </Field>
            <Field label="Name" required error={formErrors.name}>
              <input value={form.name} onChange={(event) => updateField('name', event.target.value)} />
            </Field>
            <Field label="Phone" required error={formErrors.phone}>
              <input type="tel" value={form.phone} onChange={(event) => updateField('phone', event.target.value)} />
            </Field>
            <Field label="Designation" required error={formErrors.designation}>
              <input value={form.designation} onChange={(event) => updateField('designation', event.target.value)} />
            </Field>
            <Field label="Department" required error={formErrors.dept_code}>
              <select value={form.dept_code} onChange={(event) => updateDepartment(event.target.value)} disabled={Boolean(dropdownErrors.departments)}>
                <option value="">{dropdownErrors.departments || 'Select department'}</option>
                {departments.map((department) => {
                  const code = getDepartmentCode(department);
                  const label = getDepartmentName(department) || code;
                  return <option key={code || label} value={code}>{label}</option>;
                })}
              </select>
              {dropdownErrors.departments ? <small>{dropdownErrors.departments}</small> : null}
            </Field>
            <Field label="Section / Office" required error={formErrors.section_office}>
              <input value={form.section_office} onChange={(event) => updateField('section_office', event.target.value)} />
            </Field>
            <ReadOnlyValue label="Department Code" value={form.dept_code} />
            <ReadOnlyValue label="Department Name" value={form.dept_name} />
          </div>
        </section>

        <section className="device-register-card">
          <div className="device-register-card__header">
            <div>
              <p className="assignment-kicker">Section B</p>
              <h2>Device details</h2>
            </div>
          </div>
          <div className="device-register-grid">
            <Field label="Serial No." required error={formErrors.serial_no}>
              <input value={form.serial_no} onChange={(event) => updateField('serial_no', event.target.value)} />
            </Field>
            <Field label="DSR No." required={form.is_hiring === '0'} error={formErrors.dsr_no}>
              <input value={form.dsr_no} onChange={(event) => updateField('dsr_no', event.target.value)} />
            </Field>
            <Field label="Device Type" required error={formErrors.device_type}>
              <select value={form.device_type} onChange={(event) => updateField('device_type', event.target.value)} disabled={Boolean(dropdownErrors.devices)}>
                <option value="">{dropdownErrors.devices || 'Select device type'}</option>
                {devices.map((device) => {
                  const value = getDeviceValue(device);
                  const label = getDeviceLabel(device);
                  return <option key={value || label} value={value}>{label}</option>;
                })}
              </select>
              {dropdownErrors.devices ? <small>{dropdownErrors.devices}</small> : null}
            </Field>
            <Field label="Assigned Date" required error={formErrors.assigned_date}>
              <input type="date" value={form.assigned_date} onChange={(event) => updateField('assigned_date', event.target.value)} />
            </Field>

            <div className="device-register-hiring">
              <div>
                <span>Is this a hired device?</span>
                <p>Hiring details are required only when this is marked Yes.</p>
              </div>
              <div className="device-register-toggle" role="radiogroup" aria-label="Is this a hired device?">
                <button className={form.is_hiring === '1' ? 'active' : ''} type="button" onClick={() => updateField('is_hiring', '1')}>Yes</button>
                <button className={form.is_hiring === '0' ? 'active' : ''} type="button" onClick={() => updateField('is_hiring', '0')}>No</button>
              </div>
              {form.is_hiring === '1' ? (
                <div className="device-register-hiring-grid">
                  <Field label="Hire from date" required error={formErrors.from_date}>
                    <input type="date" value={form.from_date} onChange={(event) => updateField('from_date', event.target.value)} />
                  </Field>
                  <Field label="Hire to date" required error={formErrors.to_date}>
                    <input type="date" value={form.to_date} onChange={(event) => updateField('to_date', event.target.value)} />
                  </Field>
                  <Field label="Contract number" required error={formErrors.contract_no}>
                    <input value={form.contract_no} onChange={(event) => updateField('contract_no', event.target.value)} />
                  </Field>
                  <Field label="SR number" error={formErrors.sr_no}>
                    <p>The unique number assigned by the dealer or hiring agency for this contracted device.</p>
                    <input value={form.sr_no} onChange={(event) => updateField('sr_no', event.target.value)} />
                  </Field>
                </div>
              ) : null}
            </div>

            {form.is_hiring === '0' ? (
              <div className="device-register-standard">
                <div className="device-register-standard__heading">
                  <span>Non-hired / DSR inventory details</span>
                  <p>These fields are shown for regular devices and are saved with the RegisterDevice record.</p>
                </div>
                <div className="device-register-standard-grid">
                  <Field label="Target IP" required error={formErrors.target_ip}>
                    <input value={form.target_ip} onChange={(event) => updateField('target_ip', event.target.value)} />
                  </Field>
                  <Field label="Date of procurement">
                    <input type="date" value={form.date_of_procurement} onChange={(event) => updateField('date_of_procurement', event.target.value)} />
                  </Field>
                  <Field label="Quantity">
                    <input type="number" min="0" value={form.quantity} onChange={(event) => updateField('quantity', event.target.value)} />
                  </Field>
                  <Field label="PO No.">
                    <input value={form.po_no} onChange={(event) => updateField('po_no', event.target.value)} />
                  </Field>
                  <Field label="PO Date">
                    <input type="date" value={form.po_date} onChange={(event) => updateField('po_date', event.target.value)} />
                  </Field>
                  <Field label="Value">
                    <input value={form.value} onChange={(event) => updateField('value', event.target.value)} />
                  </Field>
                  <Field label="DSR File Reference">
                    <input value={form.dsr_file} onChange={(event) => updateField('dsr_file', event.target.value)} />
                  </Field>
                  <Field label="DS No.">
                    <input value={form.ds_no} onChange={(event) => updateField('ds_no', event.target.value)} />
                  </Field>
                  <Field label="Date">
                    <input type="date" value={form.date} onChange={(event) => updateField('date', event.target.value)} />
                  </Field>
                </div>
              </div>
            ) : null}

            <ReadOnlyValue label="Assigned to" value={form.name} />
            <ReadOnlyValue label="Location" value={form.section_office} />
            <Field label="Description" wide>
              <textarea rows={2} value={form.description} onChange={(event) => updateField('description', event.target.value)} />
            </Field>
            <Field label="Make / Manufacturer">
              <input value={form.make} onChange={(event) => updateField('make', event.target.value)} />
            </Field>
            <Field label="Date of installation">
              <input type="date" value={form.date_of_install} onChange={(event) => updateField('date_of_install', event.target.value)} />
            </Field>
            <Field label="Remarks" wide>
              <textarea rows={2} value={form.remarks} onChange={(event) => updateField('remarks', event.target.value)} />
            </Field>
          </div>
        </section>

        <div className="device-register-actions">
          <span>
            {saving ? <><LoaderCircle className="spin-icon" size={15} /> Saving registration…</> : form.target_ip ? `Client IP: ${form.target_ip}` : 'Client IP not detected'}
          </span>
          <div>
            <button className="secondary-button" type="button" onClick={cancel} disabled={saving}>Cancel</button>
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <><LoaderCircle className="spin-icon" size={17} /> Saving...</> : <><Save size={17} /> Save registration</>}
            </button>
          </div>
        </div>
      </form>

      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </section>
  );
}
