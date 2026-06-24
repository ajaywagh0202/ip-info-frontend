import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Save, X } from 'lucide-react';
import axiosInstance from '../utils/axiosInstance.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import InputField from './InputField.jsx';
import { formatFieldKey } from '../utils/formatField.js';

const deviceTypeOptions = ['Desktop', 'Laptop', 'Server', 'Printer', 'Network Switch', 'Other'];

function getDeviceId(record) {
  return record?.id || record?._id || record?.device_id || record?.record_id;
}

function serial_no(record) {
  return record?.Serial_no || record?.serial_number || record?.SerialNumber || record?.serialNo || '';
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function buildForm(record = {}) {
  return {
    name: record.name || '',
    phone: record.phone || '',
    pf_no: record.pf_no || '',
    dept_code: record.dept_code || '',
    dept_name: record.dept_name || '',
    designation: record.designation || '',
    target_ip: record.target_ip || '',
    device_type: record.device_type || '',
    dsr_no: record.dsr_no || '',
    Serial_no: record.Serial_no || record.serial_number || '',
    description: record.description || '',
    make: record.make || '',
    quantity: record.quantity ?? '',
    ds_no: record.ds_no || '',
    date: toDateInput(record.date),
    dsr_file: record.dsr_file || '',
    po_no: record.po_no || '',
    po_date: toDateInput(record.po_date),
    value: record.value || '',
    date_of_procurement: toDateInput(record.date_of_procurement),
    given_to: record.given_to || '',
    location: record.location || '',
    date_of_install: toDateInput(record.date_of_install),
    remarks: record.remarks || '',
    hostname: record.hostname || '',
    os: record.os || '',
  };
}

function normalizeComparable(value, key) {
  if (['date', 'po_date', 'date_of_procurement', 'date_of_install'].includes(key)) return toDateInput(value);
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function buildDiff(current, original) {
  const diff = {};
  Object.keys(current).forEach((key) => {
    if (['hostname', 'os'].includes(key)) return;
    const currentValue = normalizeComparable(current[key], key);
    const originalValue = normalizeComparable(original[key], key);
    if (currentValue !== originalValue) diff[key] = currentValue;
  });
  return diff;
}

function Section({ title, children }) {
  return (
    <section className="device-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Grid({ children }) {
  return <div className="device-form-grid">{children}</div>;
}

function ReadOnlyField({ label, value }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <input value={value || ''} disabled readOnly />
    </label>
  );
}

function TextAreaField({ label, name, value, onChange, rows = 3 }) {
  return (
    <label className="field" htmlFor={`device-${name}`}>
      <span className="field-label">{label}</span>
      <textarea id={`device-${name}`} name={name} rows={rows} value={value} onChange={onChange} />
    </label>
  );
}

export default function EditDeviceModal({ deviceId, initialRecord, departments = [], onClose, onSaved }) {
  const [record, setRecord] = useState(initialRecord || null);
  const [original, setOriginal] = useState(initialRecord ? buildForm(initialRecord) : null);
  const [form, setForm] = useState(initialRecord ? buildForm(initialRecord) : null);
  const [loading, setLoading] = useState(Boolean(deviceId));
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState('');
  const dirty = useMemo(() => {
    if (!form || !original) return false;
    return Object.keys(form).some((key) => normalizeComparable(form[key], key) !== normalizeComparable(original[key], key));
  }, [form, original]);

  useEffect(() => {
    if (!deviceId) return undefined;
    let active = true;
    setLoading(true);
    setServerError('');
    axiosInstance.get(`/api/admin/device-details/${deviceId}`)
      .then(({ data }) => {
        if (!active) return;
        const nextRecord = data?.data || data || {};
        const nextForm = buildForm(nextRecord);
        setRecord(nextRecord);
        setOriginal(nextForm);
        setForm(nextForm);
      })
      .catch((err) => {
        if (active) setServerError(err.friendlyMessage || 'Unable to load device details.');
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
      if (event.key === 'Escape' && !saving) {
        if (dirty && !window.confirm('You have unsaved changes. Are you sure you want to close?')) return;
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saving, dirty, onClose]);

  function handleClose() {
    if (saving) return;
    if (dirty && !window.confirm('You have unsaved changes. Are you sure you want to close?')) return;
    onClose();
  }

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setServerError('');
  };

  const updateDepartment = (event) => {
    const { value } = event.target;
    const selected = departments.find((department) => String(department.dept_code || department.code) === value);
    setForm((current) => ({
      ...current,
      dept_code: value,
      dept_name: selected?.deptname || selected?.dept_name || selected?.name || '',
    }));
    setServerError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setServerError('');
    

    const diff = buildDiff(form, original);
    if (!Object.keys(diff).length) {
      handleClose();
      return;
    }

    setSaving(true);
    try {
      const { data } = await axiosInstance.put(`/api/admin/device-details/serial_no:${serial_no(record)}`, diff);
      const updated = data?.data || data || {};
      onSaved?.({
        ...record,
        ...form,
        ...updated,
        Serial_no: form.Serial_no || form.Serial_no === 0 ? form.Serial_no : updated.Serial_no || updated.serial_number,
      });
      onClose();
    } catch (err) {
      setServerError(err.friendlyMessage || 'Unable to save device details.');
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    (
      <Section title="User Information" key="user">
        <Grid>
          <InputField label={formatFieldKey('name')} name="name" required value={form?.name || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('phone')} name="phone" required value={form?.phone || ''} onChange={update} type="tel" disabled={true} />
          <InputField label={formatFieldKey('pf_no')} name="pf_no" required value={form?.pf_no || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('dept_name')} name="dept_name" required value={form?.dept_name || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('designation')} name="designation" required value={form?.designation || ''} onChange={update} disabled={true} />
        </Grid>
      </Section>
    ),
    (
      <Section title="PO Details" key="po">
        <Grid>
          <InputField label={formatFieldKey('Serial_no')} name="Serial_no" value={form?.Serial_no || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('po_no')} name="po_no" value={form?.po_no || ''} onChange={update} />
          <InputField label={formatFieldKey('po_date')} name="po_date" type="date" value={form?.po_date || ''} onChange={update} />
          <InputField label={formatFieldKey('make')} name="make" value={form?.make || ''} onChange={update} />
          <InputField label={formatFieldKey('quantity')} name="quantity" type="number" min="0" value={form?.quantity ?? ''} onChange={update} />
          <InputField label={formatFieldKey('value')} name="value" value={form?.value || ''} onChange={update} />
          <InputField label={formatFieldKey('date_of_procurement')} name="date_of_procurement" type="date" value={form?.date_of_procurement || ''} onChange={update} />
        </Grid>
      </Section>
    ),
    (
      <Section title="DSR Details" key="dsr">
        <Grid>
          <InputField label={formatFieldKey('dsr_no')} name="dsr_no" value={form?.dsr_no || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('Issued To')} name="given_to" value={form?.name || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('location')} name="location" value={form?.location || ''} onChange={update}  />
          <InputField label={formatFieldKey('date_of_install')} name="date_of_install" type="date" value={form?.date_of_install || ''} onChange={update} />
          <TextAreaField label={formatFieldKey('description')} name="description" value={form?.description || ''} onChange={update} rows={3} />
          <InputField label={formatFieldKey('dsr_file')} name="dsr_file" value={form?.dsr_file || ''} onChange={update} />
        </Grid>
      </Section>
    ),
    (
      <Section title="Device Information" key="device">
        <Grid>
          <ReadOnlyField label={formatFieldKey('hostname')} value={form?.hostname || ''} />
          <ReadOnlyField label={formatFieldKey('os')} value={form?.os || ''} />
          <InputField label={formatFieldKey('target_ip')} name="target_ip" value={form?.target_ip || ''} onChange={update} disabled={true} />
          <InputField label={formatFieldKey('device_type')} name="device_type" value={form?.device_type || ''} onChange={update} disabled={true} />
        </Grid>
      </Section>
    ),
    (
      <Section title="Deployment Details" key="deploy">
        <Grid>

          <TextAreaField label={formatFieldKey('remarks')} name="remarks" value={form?.remarks || ''} onChange={update} rows={3} />
        </Grid>
      </Section>
    ),
    (
      <Section title="DS-8 Details" key="ds8">
        <Grid>
          <InputField label={formatFieldKey('ds_no')} name="ds_no" value={form?.ds_no || ''} onChange={update} />
          <InputField label={formatFieldKey('date')} name="date" type="date" value={form?.date || ''} onChange={update} />
        </Grid>
      </Section>
    )
  ];

  return (
    createPortal(
      <div className="modal-backdrop modal-overlay" role="presentation" onMouseDown={handleClose}>
        <section className="detail-modal device-modal device-edit-modal modal-content" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
          <div className="view-modal-titlebar device-modal-titlebar">
            <div className="modal-title">
              <p className="section-kicker">Edit device</p>
              <h2>{loading ? 'Loading...' : `Edit Device - ${record?.name || 'Record'} | ${record?.device_type || 'Device'}`}</h2>
            </div>
            <button className="icon-button light" type="button" onClick={handleClose} aria-label="Close edit device modal">
              <X size={20} />
            </button>
          </div>

          <form className="view-modal-content device-modal-content device-edit-form" onSubmit={submit}>
            {loading ? <LoadingSpinner label="Loading device details" /> : null}
            {serverError ? <div className="alert alert-error">{serverError}</div> : null}
            {!loading && form ? sections : null}

            <div className="device-modal-footer">
              <button className="secondary-button" type="button" onClick={handleClose} disabled={saving}>
                Cancel
              </button>
              <button className="download-button device-save-button" type="submit" disabled={saving || !dirty}>
                {saving ? 'Saving...' : (<><Save size={18} /> Save Changes</>)}
              </button>
            </div>
          </form>
        </section>
      </div>,
      document.body,
    )
  );
}
