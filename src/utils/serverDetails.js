export const serverGroups = [
  ['Identity', 'server_tag_no hostname fqdn server_id serial_no'],
  ['Network', 'ip_address_primary ip_address_secondary subnet_vlan'],
  ['Location', 'location_site building_floor_room rack_no rack_u_position'],
  ['Classification', 'environment server_role hosting_type'],
  ['Application', 'application_category application_name application_owner_dept'],
  ['Procurement', 'dsr_no purchase_order_no purchase_order_date purchase_date installation_date age_years'],
  ['Hardware', 'vendor_name model_name cpu_make_model cpu_socket_count cpu_core_count cpu_thread_count ram_gb nic_count power_supply_redundant'],
  ['Storage', 'storage_os_gb storage_data_gb storage_raid_level storage_type'],
  ['Software', 'os_name os_version os_license_type database_software middleware_software other_software_details'],
  ['Remote Management', 'ilo_idrac_type management_ip management_url management_username_ref'],
  ['Support', 'warranty_status warranty_end_date amc_vendor'],
  ['Operations', 'backup_enabled backup_policy dr_replication monitoring_tool patching_group last_patch_date last_health_check_date criticality server_status'],
  ['SLA, Audit and Notes', 'availability_target record_last_updated_on record_last_updated_by remarks'],
].map(([title, keys]) => ({ title, keys: keys.split(' ') }));

export const readOnlyFields = ['server_id', 'serial_no', 'ip_address_primary', 'dsr_no', 'age_years', 'record_last_updated_on', 'record_last_updated_by'];
export const booleanFields = ['power_supply_redundant', 'backup_enabled', 'dr_replication'];
export const textAreaFields = ['database_software', 'middleware_software', 'other_software_details', 'remarks', 'action_taken', 'backup_policy'];
export const serverEditableFields = serverGroups.flatMap(({ keys }) => keys).filter(key => !readOnlyFields.includes(key));
export const incidentFields = ['ticket_no', 'breakdown_start_datetime', 'restoration_datetime', 'root_cause', 'action_taken', 'reported_by', 'restored_by', 'remarks'];
export const restoreFields = ['restoration_datetime', 'action_taken', 'restored_by', 'remarks'];
export const incidentAuditFields = ['incident_id', 'server_id', 'server_tag_no', 'downtime_hours', 'created_by', 'created_at', 'updated_by', 'updated_at'];
export const dropdowns = {
  environment: ['Production', 'UAT', 'Test', 'Dev', 'DR'],
  server_role: ['Physical', 'VM', 'Hypervisor', 'Appliance', 'Cloud'],
  hosting_type: ['Dedicated', 'VM', 'Cluster', 'Cloud'],
  criticality: ['Critical', 'High', 'Medium', 'Low'],
  server_status: ['In service', 'Standby', 'Repair', 'Condemned'],
  warranty_status: ['In warranty', 'Out of warranty', 'AMC'],
  storage_type: ['HDD', 'SSD', 'NVMe', 'SAN', 'NAS'],
};
export const isNumeric = key => key.endsWith('_count') || key.endsWith('_gb') || key === 'availability_target';
export const isDate = key => key.endsWith('_date');
export const registeredServerId = response => response?.register_device?._id || response?.device?._id || null;
export const isServerDevice = deviceType => ['server', 'nas server'].includes(String(deviceType ?? '').trim().replace(/\s+/g, ' ').toLowerCase());

// The existing application uses the browser's local timezone for display.
export function toLocalInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${String(date.getMilliseconds()).padStart(3, '0')}`;
}

export function toInput(key, value) {
  if (value === null || value === undefined) return '';
  if (key.endsWith('_datetime')) return toLocalInput(value);
  if (isDate(key)) return String(value).slice(0, 10);
  return String(value);
}
export function makeDraft(record = {}, fields = serverEditableFields) {
  return Object.fromEntries(fields.map(key => [key, toInput(key, record[key])]));
}
export function changedInputs(draft, original) {
  return Object.fromEntries(Object.entries(draft).filter(([key, value]) => value !== original[key]));
}
export function buildPayload(draft, original = {}, fields = serverEditableFields) {
  const result = {};
  for (const key of fields) {
    if (!(key in draft) || draft[key] === original[key]) continue;
    const value = String(draft[key]).trim();
    if (!value) { result[key] = null; continue; }
    if (booleanFields.includes(key)) {
      if (!['true', 'false'].includes(value)) throw new Error(`Invalid boolean: ${key}`);
      result[key] = value === 'true';
    } else if (isNumeric(key)) {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0 || (key.endsWith('_count') && !Number.isInteger(number)) || (key === 'availability_target' && number > 100)) {
        throw new Error(`${key}: enter ${key.endsWith('_count') ? 'a nonnegative whole number' : key === 'availability_target' ? 'a percentage from 0 to 100' : 'a nonnegative number'}.`);
      }
      result[key] = number;
    } else if (key.endsWith('_datetime')) {
      const date = new Date(value); // datetime-local is local time, never append Z here.
      if (Number.isNaN(date.getTime()) || toLocalInput(date).slice(0, 16) !== value.slice(0, 16)) throw new Error('Enter a valid local date and time.');
      result[key] = date.toISOString();
    } else result[key] = value;
  }
  return result;
}
export function validateIncident(draft) {
  const start = new Date(draft.breakdown_start_datetime);
  const end = draft.restoration_datetime ? new Date(draft.restoration_datetime) : null;
  if (Number.isNaN(start.getTime())) throw new Error('Breakdown start time is required.');
  if (end && (Number.isNaN(end.getTime()) || end < start)) throw new Error('Restoration must not precede breakdown start.');
}
export const sortIncidents = logs => [...logs].sort((a, b) => new Date(b.breakdown_start_datetime) - new Date(a.breakdown_start_datetime));
export function downtime(incident) {
  if (!incident.restoration_datetime) return 'Ongoing';
  return incident.downtime_hours == null ? 'Not specified.' : Number(incident.downtime_hours).toFixed(2);
}
export function serverError(error) {
  const status = error.response?.status;
  const detail = error.response?.data?.message || error.response?.data?.error || error.friendlyMessage || error.message;
  if (status === 403) return 'Department access denied. You cannot access this server.';
  if (status === 404) return `Server, scan or incident not found. ${typeof detail === 'string' ? detail : ''}`;
  if (status === 409) return 'This record changed. Reload before retrying. Your draft has been preserved; review it against the refreshed values.';
  return typeof detail === 'string' ? detail : 'Unable to complete the request. Please try again.';
}
