import { CheckCircle2, TriangleAlert, X } from 'lucide-react';
import { useEffect } from 'react';

export default function Toast({ message, type = 'success', onClose }) {
  useEffect(() => {
    if (!message || !onClose) return undefined;
    const timeout = window.setTimeout(onClose, type === 'error' ? 5000 : 3000);
    return () => window.clearTimeout(timeout);
  }, [message, onClose, type]);

  if (!message) return null;
  const Icon = type === 'error' || type === 'warning' ? TriangleAlert : CheckCircle2;
  return (
    <div className={`toast ${type}`} role="status" aria-live="polite">
      <Icon size={18} />
      <span>{message}</span>
      <button className="toast-close" type="button" onClick={onClose} aria-label="Close notification">
        <X size={16} />
      </button>
    </div>
  );
}
