import { FileSpreadsheet, FileText, LoaderCircle, X } from 'lucide-react';

const formatOptions = [
  { value: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
  { value: 'pdf', label: 'PDF (.pdf)', icon: FileText },
];

export default function ExportModal({ count, selectedFormat, loading, onSelectFormat, onDownload, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="detail-modal export-modal" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <div className="modal-header">
          <div>
            <h2 id="export-title">Export Report</h2>
            <p>{count} record(s) selected</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close export modal" disabled={loading}>
            <X size={18} />
          </button>
        </div>

        <div className="export-format-grid" role="radiogroup" aria-label="Export format">
          {formatOptions.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`export-format-card${selectedFormat === value ? ' selected' : ''}`}
              type="button"
              role="radio"
              aria-checked={selectedFormat === value}
              onClick={() => onSelectFormat(value)}
              disabled={loading}
            >
              <Icon size={30} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button className="download-button export-download-button" type="button" onClick={onDownload} disabled={!selectedFormat || loading}>
            {loading ? <LoaderCircle className="spin-icon" size={18} /> : null}
            {loading ? 'Generating...' : 'Download'}
          </button>
        </div>
      </section>
    </div>
  );
}
