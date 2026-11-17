import test from 'node:test';
import assert from 'node:assert/strict';
import {
  registeredServerId, makeDraft, buildPayload, booleanFields, readOnlyFields,
  incidentFields, restoreFields, validateIncident, toLocalInput, sortIncidents,
  downtime, changedInputs, serverError, serverEditableFields, isServerDevice,
} from '../src/utils/serverDetails.js';

test('server features are limited to Server and NAS Server devices', () => {
  for (const type of ['Server', 'NAS Server', ' server ', 'NAS  SERVER']) assert.equal(isServerDevice(type), true);
  for (const type of ['All in One', 'Desktop', 'Laptop', 'Printer', 'NAS', 'File Server', '', null, undefined]) assert.equal(isServerDevice(type), false);
});

test('server IDs come only from registration, never a scan or serial identity', () => {
  assert.equal(registeredServerId({ _id: 'scan', serial_no: 'serial', target_ip: 'ip' }), null);
  assert.equal(registeredServerId({ _id: 'scan', register_device: { _id: 'registered' } }), 'registered');
  assert.equal(registeredServerId({ device: { _id: 'newly-registered' } }), 'newly-registered');
});
test('only changed editable fields are submitted as a flat payload', () => {
  const original = makeDraft({ hostname: 'old', ram_gb: 8, environment: 'Legacy environment' });
  const draft = { ...original, hostname: 'new', server_id: 'bad', serial_no: 'bad', breakdown: [] };
  assert.deepEqual(buildPayload(draft, original), { hostname: 'new' });
  assert.equal(draft.environment, 'Legacy environment');
  for (const field of readOnlyFields) assert.ok(!serverEditableFields.includes(field));
});
test('Unknown, Yes, No and cleared numeric values remain distinct', () => {
  for (const key of booleanFields) {
    assert.equal(makeDraft({ [key]: null })[key], '');
    assert.equal(makeDraft({ [key]: false })[key], 'false');
    assert.deepEqual(buildPayload({ [key]: '' }, { [key]: 'false' }), { [key]: null });
    assert.deepEqual(buildPayload({ [key]: 'false' }, { [key]: '' }), { [key]: false });
    assert.deepEqual(buildPayload({ [key]: 'true' }, { [key]: '' }), { [key]: true });
  }
  assert.deepEqual(buildPayload({ ram_gb: '', nic_count: '0' }, { ram_gb: '16', nic_count: '' }), { ram_gb: null, nic_count: 0 });
  assert.deepEqual(buildPayload(makeDraft(), makeDraft()), {});
});
test('capacities accept decimals, counts require integers and percentages are bounded', () => {
  assert.deepEqual(buildPayload({ ram_gb: '1.25', availability_target: '99.95' }), { ram_gb: 1.25, availability_target: 99.95 });
  for (const draft of [{ nic_count: '1.5' }, { cpu_core_count: '-1' }, { availability_target: '101' }, { storage_os_gb: 'NaN' }]) assert.throws(() => buildPayload(draft));
});
test('software details remain strings and optional clearing sends null', () => {
  assert.deepEqual(buildPayload({ database_software: 'PostgreSQL\nSQLite', remarks: '' }, { remarks: 'old' }), { database_software: 'PostgreSQL\nSQLite', remarks: null });
});
test('local input timestamps convert to explicit ISO timezone and round trip precisely', () => {
  const instant = '2026-11-17T10:00:12.123+05:30';
  const local = toLocalInput(instant);
  const payload = buildPayload({ breakdown_start_datetime: local }, {}, incidentFields);
  assert.equal(payload.breakdown_start_datetime, '2026-11-17T04:30:12.123Z');
  assert.equal(new Date(local).getTime(), new Date(instant).getTime());
  assert.deepEqual(buildPayload(makeDraft({ breakdown_start_datetime: instant }, incidentFields), makeDraft({ breakdown_start_datetime: instant }, incidentFields), incidentFields), {});
});
test('incident validation rejects missing start and restoration before start', () => {
  assert.throws(() => validateIncident({ breakdown_start_datetime: '' }));
  assert.throws(() => validateIncident({ breakdown_start_datetime: '2026-11-17T10:00', restoration_datetime: '2026-11-17T09:59' }));
  assert.doesNotThrow(() => validateIncident({ breakdown_start_datetime: '2026-11-17T10:00', restoration_datetime: '' }));
  assert.doesNotThrow(() => validateIncident({ breakdown_start_datetime: '2026-11-17T10:00', restoration_datetime: '2026-11-17T10:00' }));
});
test('restoration payload excludes identities, audits, status and unrelated fields', () => {
  const payload = buildPayload({ restoration_datetime: '2026-11-17T12:30', action_taken: 'Fixed', restored_by: 'IT', remarks: '', incident_id: 'other', server_id: 'server', status: 'Restored', downtime_hours: 2, created_by: 'admin', root_cause: 'changed' }, {}, restoreFields);
  assert.deepEqual(Object.keys(payload), restoreFields);
  assert.equal(payload.remarks, null);
  assert.ok(payload.restoration_datetime.endsWith('Z'));
});
test('multiple incidents are sorted without mutation and retain separate identities', () => {
  const logs = [{ incident_id: 'first', breakdown_start_datetime: '2026-11-16T00:00Z', downtime_hours: null }, { incident_id: 'second', breakdown_start_datetime: '2026-11-17T00:00Z', restoration_datetime: '2026-11-17T02:30Z', downtime_hours: 2.5 }];
  assert.deepEqual(sortIncidents(logs).map(log => log.incident_id), ['second', 'first']);
  assert.equal(logs[0].incident_id, 'first');
  assert.equal(downtime(logs[0]), 'Ongoing');
  assert.equal(downtime(logs[1]), '2.50');
});
test('conflict reload preserves user changes while updating untouched values', () => {
  const original = makeDraft({ hostname: 'old', ram_gb: 8 });
  const draft = { ...original, hostname: 'my edit' };
  const refreshed = makeDraft({ hostname: 'someone else', ram_gb: 16 });
  const rebased = { ...refreshed, ...changedInputs(draft, original) };
  assert.equal(rebased.ram_gb, '16');
  assert.deepEqual(buildPayload(rebased, refreshed), { hostname: 'my edit' });
});
test('errors distinguish access, missing records, conflicts and backend validation', () => {
  assert.match(serverError({ response: { status: 403 } }), /Department access denied/);
  assert.match(serverError({ response: { status: 404, data: { error: 'No scan found' } } }), /No scan found/);
  assert.match(serverError({ response: { status: 409 } }), /Reload before retrying/);
  assert.equal(serverError({ response: { status: 400, data: { error: 'Invalid date' } } }), 'Invalid date');
});
