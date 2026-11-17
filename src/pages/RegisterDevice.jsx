import { useEffect, useState } from 'react';
import { CheckCircle2, Clipboard, Send } from 'lucide-react';
import axiosClient from '../api/axiosClient.js';
import InputField from '../components/InputField.jsx';
import LoadingSpinner from '../components/LoadingSpinner.jsx';
import { formatValue } from '../utils/formatField.js';

const initialForm = {
  name: '',
  phone: '',
  pf_no: '',
  dept_code: '',
  dept_name: '',
  designation: '',
  device_type: '',
  dsr_no: '',
  serial_no: '',
};

function validate(form) {
  const errors = {};
  ['name', 'phone', 'pf_no', 'dept_code', 'dept_name', 'designation', 'device_type', 'dsr_no'].forEach((key) => {
    if (!String(form[key] || '').trim()) errors[key] = 'This field is required.';
  });
  if (form.phone && !/^\d{10}$/.test(form.phone.trim())) {
    errors.phone = 'Phone number must be exactly 10 digits.';
  }
  return errors;
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back for browsers where Clipboard API exists but is blocked.
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();

  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('Unable to copy folder name.');
  }
}

export default function RegisterDevice() {
  const [form, setForm] = useState(initialForm);
  const [departments, setDepartments] = useState([]);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [successPayload, setSuccessPayload] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadDepartments() {
      try {
        const { data } = await axiosClient.get('/api/departments');
        const rows = Array.isArray(data) ? data : data?.data || data?.records || [];
        if (active) setDepartments(rows);
      } catch (error) {
        if (active) setServerError(error.friendlyMessage || 'Unable to load departments.');
      }
    }
    loadDepartments();
    return () => {
      active = false;
    };
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (name === 'department') {
      const selected = departments.find((department) => String(department.dept_code || department.code) === value);
      setForm((current) => ({
        ...current,
        dept_code: value,
        dept_name: selected?.deptname || selected?.dept_name || selected?.name || '',
      }));
      setErrors((current) => ({ ...current, dept_code: '', dept_name: '' }));
      return;
    }
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
  };

  const copyFolderName = async () => {
    setCopyFailed(false);
    try {
      await copyText('Scan_Device');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2200);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setServerError('');
    setSuccessPayload(null);

    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    // if (!folderFiles.length) {
    //   folderInputRef.current?.click();
    //   setFolderWarning('Please select your Scan_Device folder before submitting.');
    //   return;
    // }

    // if (!pdfFile || !jsonFile) {
    //   setFolderWarning('Required files not found in selected folder. Please run ITC_System_Scanner_V1.exe first.');
    //   return;
    // }
    
    const payload = new FormData();
    payload.append('name', form.name.trim());
    payload.append('phone', form.phone.trim());
    payload.append('pf_no', form.pf_no.trim());
    payload.append('dept_code', form.dept_code.trim());
    payload.append('dept_name', form.dept_name.trim());
    payload.append('designation', form.designation.trim());
    payload.append('device_type', form.device_type.trim());
    payload.append('dsr_no', form.dsr_no.trim());
    const serialValue = form.serial_no.trim();
    if (serialValue) {
      payload.append('serial_no', serialValue);
      payload.append('Serial_no', serialValue);
      payload.append('serial_number', serialValue);
    }
    payload.append('department', form.dept_name.trim());
    // payload.append('pdf_file', pdfFile);
    // payload.append('json_file', jsonFile);

    setSubmitting(true);
    try {

      const encoded = encodeURIComponent(JSON.stringify(form));

      window.location.href = `http://10.31.3.114:5001/?data=${encoded}`;

      // const { data } = await axiosClient.post('/api/register', payload, {
      //   headers: { 'Content-Type': 'multipart/form-data' },
      // });
      // const response = data?.data || data || {};
      // const registrationId = response?._id || response?.id || response?.record_id || `//${form.pf_no.trim()}-${form.dsr_no.trim()}`;
      // setSuccessPayload({
      //   name: form.name.trim(),
      //   registrationId,
      // });

      // window.location.href = 'http://10.31.3.114:5001/';
      setForm(initialForm);
    } catch (error) {
      setServerError(error.friendlyMessage || error.message || 'Unable to submit registration.');
    } finally {
      setSubmitting(false);
    }
  };

  if (successPayload) {
    return (
      <section className="success-page">
        <div className="success-card prominent">
          <div className="success-icon">
            <CheckCircle2 size={34} />
          </div>
          <div>
            <h1>Device Registered Successfully!</h1>
            <p>
              Your device has been submitted for IT inventory.
            </p>
            <p>Registration ID: {formatValue(successPayload.registrationId)}</p>
            <button className="primary-button" type="button" onClick={() => setSuccessPayload(null)}>
              New Registration
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="registration-stack">
      <form className="form-card registration-card registration-card--compact" onSubmit={handleSubmit} noValidate>
        <div>
          <p className="section-kicker">User registration</p>
          <h2>Register device</h2>
          <p>Fill the required details, download the scanner, run it, then submit the generated files.</p>
        </div>

        {serverError ? <div className="alert alert-error">{serverError}</div> : null}

        <div className="form-grid">
          <InputField label="Name" name="name" required value={form.name} onChange={handleChange} error={errors.name} />
          <InputField
            label="Phone Number"
            name="phone"
            required
            value={form.phone}
            onChange={handleChange}
            error={errors.phone}
            inputMode="numeric"
            type="tel"
          />
          <InputField label="Provident Fund No. (PF No.)" name="pf_no" required value={form.pf_no} onChange={handleChange} error={errors.pf_no} />
          <label className="field" htmlFor="field-department">
            <span className="field-label">Department<em>*</em></span>
            <select id="field-department" name="department" value={form.dept_code} onChange={handleChange} aria-invalid={Boolean(errors.dept_code || errors.dept_name)}>
              <option value="">Select department</option>
              {departments.map((department) => (
                <option key={department.dept_code || department.code || department.deptname} value={department.deptname ||  ''}>
                  {department.deptname || department.dept_name || department.name}
                </option>
              ))}
            </select>
            {errors.dept_code || errors.dept_name ? <span className="field-error">{errors.dept_code || errors.dept_name}</span> : null}
          </label>
          <InputField label="Designation" name="designation" required value={form.designation} onChange={handleChange} error={errors.designation} />
          <label className="field" htmlFor="field-device-type">
            <span className="field-label">Device Type<em>*</em></span>
            <select id="field-device-type" name="device_type" value={form.device_type} onChange={handleChange} aria-invalid={Boolean(errors.device_type)}>
              <option value="">Select device type</option>
              <option>Desktop</option>
              <option>Laptop</option>
              <option>Server</option>
              <option>NAS Server</option>
              <option>Other</option>
            </select>
            {errors.device_type ? <span className="field-error">{errors.device_type}</span> : null}
          </label>
          <InputField label="Dead Stock Register No. (DSR No.)" name="dsr_no" required value={form.dsr_no} onChange={handleChange} error={errors.dsr_no} />
          <InputField
            label="Serial Number (Optional)"
            name="serial_no"
            value={form.serial_no}
            onChange={handleChange}
            placeholder="Enter serial number if available"
          />
        </div>
        {/* <p className="registration-note">
          <span aria-hidden="true">i</span>
          Additional device details (IP address, OS, hardware info) will be captured automatically via the ITC System Scanner.
        </p> */}

        {/* <button className="download-button" type="button" onClick={handleDownload}>
          <Download size={22} />
          Download .exe File
        </button> */}

        <section className="instruction-card">
          <h2>How to Use - Follow These Steps</h2>
          <ol className="instruction-steps">
            <li>
              <CheckCircle2 size={18} />
              <span>Create a new empty folder on your computer. Name it exactly:</span>
              <button className="copy-chip" type="button" onClick={copyFolderName} title="Copy folder name">
                <code>Scan_Device</code>
                <Clipboard size={15} />
                {copied ? 'Copied' : ''}
                {copyFailed ? 'Copy failed' : ''}
              </button>
            </li>
            <li><CheckCircle2 size={18} /><span>Download the scanner file above and save it inside the Scan_Device folder.</span></li>
            <li><CheckCircle2 size={18} /><span>Open the Scan_Device folder and double-click ITC_System_Scanner_V1.exe to run it.</span></li>
            <li><CheckCircle2 size={18} /><span>While clicking, ensure the folder path is correct. After the click on the executable, the scanner will launch.</span></li>
            <li><CheckCircle2 size={18} /><span>After it runs successfully, keep the generated PDF file and JSON file in the same folder before submitting.</span></li>
          </ol>
        </section>

        {/* <section className="folder-card">
          {folderWarning ? <div className="alert alert-warning"><TriangleAlert size={18} />{folderWarning}</div> : null}
          <input
            ref={folderInputRef}
            className="visually-hidden"
            type="file"
            webkitdirectory=""
            multiple
            onChange={handleFolderPick}
          />
          <button className="secondary-button" type="button" onClick={() => folderInputRef.current?.click()}>
            <FolderOpen size={18} />
            Select Scan_Device Folder
          </button>
          <div className="file-status">
            <span className={pdfFile ? 'found' : ''}>PDF {pdfFile ? 'found' : 'missing'}</span>
            <span className={jsonFile ? 'found' : ''}>JSON {jsonFile ? 'found' : 'missing'}</span>
          </div>
        </section> */}

        <button className="primary-button submit-registration" type="submit" disabled={submitting}>
          {submitting ? <LoadingSpinner label="Submitting..." /> : <><Send size={18} /> Register Device</>}
        </button>
      </form>
    </section>
  );
}
