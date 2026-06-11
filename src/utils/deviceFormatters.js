export function getScanId(record) {
  return record?.scanId || record?.scan_id || record?.scan?.scanId || record?._id || 'Unavailable';
}

export function getSystemInfo(record) {
  return record?.scan?.data?.system_info || record?.scan?.data?.systemInfo || {};
}

export function getDeviceSummary(record) {
  const user = record?.user || {};
  const scan = record?.scan || {};
  const systemInfo = getSystemInfo(record);

  return {
    scanId: getScanId(record),
    name: user.name || '-',
    pfNo: user.pf_no || user.pfNo || '-',
    phone: user.phone || '-',
    department: user.department || '-',
    designation: user.designation || '-',
    completed: Boolean(scan.completed),
    ipAddress: systemInfo.target_ip || systemInfo.ip_address || systemInfo.ip || '-',
    hostname: systemInfo.hostname || '-',
    os: systemInfo.distro || systemInfo.os || systemInfo.platform || '-',
    architecture: systemInfo.architecture || systemInfo.arch || '-',
    createdAt: record?.createdAt,
    timestamp: scan.timestamp || scan.scannedAt || record?.updatedAt,
  };
}

export function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatValue(value) {
  if (value === 0) return '0';
  return value || '-';
}
