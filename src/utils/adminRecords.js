import { API_BASE_URL } from '../api/axiosClient.js';
import formatDate from './formatDate.js';
import { formatFieldKey } from './formatField.js';

export function getRecordId(record) {
  return record?.id || record?._id || record?.record_id || record?.scanId || record?.scan_id;
}

export function getJsonData(record) {
  const value = record?.json_data || record?.jsonData || record?.device_details || record?.scan?.data || record?.data || {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

export function getField(record, ...keys) {
  const json = getJsonData(record);
  const system = json.system_info || json.systemInfo || {};
  const user = record?.user || {};
  for (const key of keys) {
    const value = record?.[key] ?? user?.[key] ?? system?.[key] ?? json?.[key];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return '-';
}

export function formatDateTime(value) {
  return formatDate(value);
}

export function toFriendlyLabel(value) {
  return formatFieldKey(value || 'Details');
}

export function normalizeRecord(record, index = 0) {
  const submittedAt = record?.submitted_at || record?.submission_date || record?.createdAt || record?.created_at;
  return {
    ...record,
    serial_no: index + 1,
    id: getRecordId(record),
    target_ip: getField(record, 'target_ip', 'targetIp', 'ip_address', 'ip'),
    name: getField(record, 'name'),
    phone: getField(record, 'phone'),
    pf_no: getField(record, 'pf_no', 'pfNo'),
    dept_name: getField(record, 'dept_name', 'deptName', 'department'),
    designation: getField(record, 'designation'),
    Series_no: getField(record, 'Series_no', 'series_no', 'serial_no'),
    dsr_no: getField(record, 'dsr_no', 'dsrNo'),
    hostname: getField(record, 'hostname'),
    os: getField(record, 'os', 'distro', 'platform'),
    device_type: getField(record, 'device_type', 'deviceType'),
    date_of_procurement: getField(record, 'date_of_procurement', 'dateOfProcurement'),
    submitted_at: submittedAt,
    original: record,
  };
}

export function extractRows(data) {
  return Array.isArray(data) ? data : data?.records || data?.data || data?.items || [];
}

export function downloadUrl(path) {
  return `${API_BASE_URL}${path}`;
}
