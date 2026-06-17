export function dispatchToast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }));
}

export function getFilenameFromDisposition(disposition) {
  if (!disposition) return '';
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1].replace(/["']/g, ''));

  const match = disposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] || '';
}

export function buildReportFilename(reportType, format) {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '_');
  return `ITC_Report_${reportType}_${timestamp}.${format}`;
}

export function downloadBlob(data, filename, mimeType) {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function getExportErrorMessage(error) {
  const fallback = error?.friendlyMessage || 'Unable to export report.';
  const data = error?.response?.data;

  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      return parsed.message || parsed.error || fallback;
    } catch {
      return fallback;
    }
  }

  return data?.message || data?.error || fallback;
}
