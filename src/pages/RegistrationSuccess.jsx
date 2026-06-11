import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Download, FileText, MonitorDown, ShieldAlert } from 'lucide-react';

function getStoredRegistration() {
  try {
    return JSON.parse(localStorage.getItem('deviceRegistration') || 'null');
  } catch {
    return null;
  }
}

export default function RegistrationSuccess() {
  const location = useLocation();
  const registration = useMemo(
    () => location.state || getStoredRegistration(),
    [location.state],
  );

  if (!registration?.scanId) {
    return (
      <section className="center-card">
        <h1>No active registration found</h1>
        <p>Please register the device again to generate a scan ID and download links.</p>
        <Link className="primary-button" to="/">
          Register Device
        </Link>
      </section>
    );
  }

  return (
    <section className="success-page">
      <div className="success-card">
        <div className="success-icon">
          <MonitorDown size={30} />
        </div>
        <div>
          <p className="section-kicker">Registration successful</p>
          <h1>Your scanner files are ready.</h1>
          <p className="muted">Scan ID</p>
          <p className="scan-id">{registration.scanId}</p>
        </div>
      </div>

      <div className="download-actions">
        <a className="primary-button" href={registration.downloads?.exe}>
          <Download size={18} />
          Download Scanner EXE
        </a>
        <a className="secondary-button" href={registration.downloads?.txt}>
          <FileText size={18} />
          Download scanId.txt
        </a>
      </div>

      <div className="alert alert-warning">
        <ShieldAlert size={18} />
        Please keep both files in the same folder before running the scanner.
      </div>

      <section className="instruction-card">
        <h2>Next steps</h2>
        <ol className="steps">
          <li>Create a new empty folder on your computer, for example <code>C:\ScanTemp</code>.</li>
          <li>Download both files into the same folder: <strong>device_scanner.exe</strong> and <strong>scanId.txt</strong>.</li>
          <li>Double-click <code>device_scanner.exe</code>.</li>
          <li>Wait until the message appears: <strong>Registration complete</strong>.</li>
          <li>You may close the scanner window after completion.</li>
        </ol>
      </section>
    </section>
  );
}
