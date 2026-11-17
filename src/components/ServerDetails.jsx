import { useCallback, useEffect, useRef, useState } from 'react';
import axiosInstance from '../utils/axiosInstance.js';
import formatDate from '../utils/formatDate.js';
import { formatFieldKey } from '../utils/formatField.js';
import LoadingSpinner from './LoadingSpinner.jsx';
import {
  serverGroups, readOnlyFields, booleanFields, textAreaFields, dropdowns, isNumeric, isDate,
  incidentFields, incidentAuditFields, restoreFields, makeDraft, changedInputs, buildPayload,
  validateIncident, sortIncidents, downtime, serverError,
} from '../utils/serverDetails.js';

function display(key, value) {
  if (value === null || value === undefined || value === '') return 'Not specified.';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (key.endsWith('_datetime') || key.endsWith('_at') || key === 'record_last_updated_on') return formatDate(value);
  if (isDate(key)) return String(value).slice(0, 10);
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

function Field({ name, value, onChange, required = false }) {
  const props = { value: value ?? '', onChange: e => onChange(name, e.target.value), required, name };
  let input;
  if (booleanFields.includes(name)) {
    input = <select {...props}><option value="">Unknown</option><option value="true">Yes</option><option value="false">No</option></select>;
  } else if (dropdowns[name]) {
    const options = dropdowns[name].includes(value) || !value ? dropdowns[name] : [value, ...dropdowns[name]];
    input = <select {...props}><option value="">Not specified.</option>{options.map(option => <option key={option}>{option}</option>)}</select>;
  } else if (textAreaFields.includes(name)) {
    input = <textarea {...props} rows={3} />;
  } else {
    input = <input {...props} type={name.endsWith('_datetime') ? 'datetime-local' : isDate(name) ? 'date' : isNumeric(name) ? 'number' : 'text'}
      min={isNumeric(name) ? 0 : undefined} max={name === 'availability_target' ? 100 : undefined}
      step={name.endsWith('_count') ? 1 : isNumeric(name) ? 'any' : name.endsWith('_datetime') ? '0.001' : undefined}
      list={name === 'root_cause' ? 'server-root-causes' : undefined} />;
  }
  return <label className="field"><span className="field-label">{formatFieldKey(name)}{name.endsWith('_gb') ? ' (decimal GB)' : name === 'availability_target' ? ' (%)' : ''}{required ? ' *' : ''}</span>{input}</label>;
}

function Values({ record, keys }) {
  return <dl className="device-detail-grid">{keys.map(key => <div key={key}><dt>{formatFieldKey(key)}</dt><dd>{key === 'downtime_hours' ? downtime(record) : display(key, record[key])}</dd></div>)}</dl>;
}

export default function ServerDetails({ serverId, canEdit, onGuardChange, activeSection = 'server' }) {
  const [server, setServer] = useState(null);
  const [logs, setLogs] = useState([]);
  const [draft, setDraft] = useState(null);
  const [original, setOriginal] = useState(null);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const lock = useRef(false);
  const editorRef = useRef(null);
  const base = `/api/admin/servers/${encodeURIComponent(serverId)}`;
  const dirty = Boolean(draft && Object.keys(changedInputs(draft, original)).length) || Boolean(editor && editor.mode !== 'view' && Object.keys(changedInputs(editor.draft, editor.original)).length);

  useEffect(() => { onGuardChange({ dirty, busy }); }, [dirty, busy, onGuardChange]);
  useEffect(() => {
    if (editor) editorRef.current?.focus();
  }, [editor?.mode, editor?.record?.incident_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = useCallback(async () => {
    const [details, incidents] = await Promise.all([axiosInstance.get(base), axiosInstance.get(`${base}/breakdown`)]);
    return { server: details.data.data, logs: incidents.data.data.logs || [] };
  }, [base]);
  useEffect(() => {
    let active = true;
    fetchAll().then(next => { if (active) { setServer(next.server); setLogs(next.logs); } })
      .catch(err => { if (active) setError(serverError(err)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fetchAll]);

  async function run(operation) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true); setError(''); setNotice('');
    try { await operation(); }
    catch (err) { setError(serverError(err)); if (err.response?.status === 409) setConflict(true); }
    finally { lock.current = false; setBusy(false); }
  }

  async function reload() {
    await run(async () => {
      const next = await fetchAll();
      setServer(next.server); setLogs(next.logs);
      if (draft) {
        const baseline = makeDraft(next.server);
        setDraft({ ...baseline, ...changedInputs(draft, original) }); setOriginal(baseline);
      }
      if (editor?.record?.incident_id) {
        const updated = next.logs.find(log => log.incident_id === editor.record.incident_id);
        if (!updated) throw new Error('Incident not found. Your draft is preserved. Cancel this editor and reload the list.');
        const baseline = makeDraft(updated, incidentFields);
        setEditor({ ...editor, record: updated, original: baseline, draft: { ...baseline, ...changedInputs(editor.draft, editor.original) } });
      }
      setConflict(false);
      setNotice(dirty ? 'Latest data loaded. Your changed fields are preserved. Review them before saving.' : 'Latest data loaded.');
    });
  }

  const saveServer = event => {
    event.preventDefault();
    if (conflict || !canEdit) return;
    run(async () => {
      const payload = buildPayload(draft, original);
      if (!Object.keys(payload).length) return;
      const { data } = await axiosInstance.patch(base, payload);
      setServer(data.data); setLogs(data.data.breakdown?.logs || []);
      setDraft(null); setOriginal(null); setNotice('Server details saved.');
    });
  };

  function openIncident(mode, record = {}) {
    const baseline = makeDraft(record, incidentFields);
    setEditor({ mode, record, original: baseline, draft: { ...baseline } });
    setError(''); setNotice('');
  }
  function cancelIncident() {
    if (editor.mode !== 'view' && Object.keys(changedInputs(editor.draft, editor.original)).length && !window.confirm('Discard unsaved incident changes?')) return;
    setEditor(null);
  }
  const saveIncident = event => {
    event.preventDefault();
    if (conflict || !canEdit) return;
    run(async () => {
      validateIncident(editor.draft);
      if (editor.mode === 'restore' && !editor.draft.restoration_datetime) throw new Error('Restoration time is required.');
      const payload = buildPayload(editor.draft, editor.mode === 'add' ? {} : editor.original, editor.mode === 'restore' ? restoreFields : incidentFields);
      if (!Object.keys(payload).length) return;
      const url = `${base}/breakdown`;
      const { data } = editor.mode === 'add' ? await axiosInstance.post(url, payload) : await axiosInstance.patch(`${url}/${encodeURIComponent(editor.record.incident_id)}`, payload);
      // Update only the returned incident, then refresh authoritative data.
      setLogs(current => [...current.filter(log => log.incident_id !== data.data.incident_id), data.data]);
      setEditor(null); setNotice('Incident saved.');
      const next = await fetchAll(); setServer(next.server); setLogs(next.logs);
    });
  };

  const prefill = () => {
    if (draft || editor || conflict || !canEdit) return;
    run(async () => {
      const { data } = await axiosInstance.post(`${base}/scan-prefill`);
      setServer(data.data); setLogs(data.data.breakdown?.logs || []);
      setNotice(data.populated_fields?.length ? `Filled: ${data.populated_fields.map(formatFieldKey).join(', ')}.` : 'No missing fields could be populated from the latest scan. Existing values were preserved.');
      const next = await fetchAll(); setServer(next.server); setLogs(next.logs);
    });
  };

  const tableKeys = ['incident_id', 'server_tag_no', 'ticket_no', 'breakdown_start_datetime', 'restoration_datetime', 'downtime_hours', 'status', 'root_cause', 'reported_by', 'restored_by'];
  return <div className="server-details-feature" aria-busy={busy || loading}>
    {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
    {notice ? <p role="status">{notice}</p> : null}
    <div className="server-actions"><button type="button" className="secondary-button" onClick={reload} disabled={busy || loading || (dirty && !conflict)}>Reload{conflict ? ' latest data (keep draft)' : ''}</button></div>
    {loading ? <LoadingSpinner label="Loading server details and breakdown logs" /> : null}
    {server ? <>
      <details className="device-section" open hidden={activeSection !== 'server'}>
        <summary><h3>Server Details</h3></summary>
        <p>DSR, primary IP and serial identity are managed through the existing device edit / registration workflows. Management username reference accepts a username or vault reference.</p>
        <div className="server-actions">
          {canEdit && !draft ? <button type="button" className="download-button" disabled={busy || Boolean(editor) || conflict} onClick={() => { const next = makeDraft(server); setDraft(next); setOriginal(next); }}>Edit Server Details</button> : null}
          {canEdit ? <button type="button" className="secondary-button" onClick={prefill} disabled={busy || Boolean(draft) || Boolean(editor) || conflict}>Fill Missing Details from Latest Scan</button> : null}
        </div>
        {draft ? <p>Save or cancel edits before filling from scan or editing incidents.</p> : null}
        <form onSubmit={saveServer}>
          <fieldset disabled={busy || conflict} className="server-fieldset">
            {serverGroups.map(({ title, keys }) => <section key={title} className="device-section"><h3>{title}</h3>
              {draft ? <><div className="device-form-grid">{keys.filter(key => !readOnlyFields.includes(key)).map(key => <Field key={key} name={key} value={draft[key]} onChange={(name, value) => setDraft(current => ({ ...current, [name]: value }))} />)}</div><Values record={server} keys={keys.filter(key => readOnlyFields.includes(key))} /></> : <Values record={server} keys={keys} />}
            </section>)}
          </fieldset>
          {draft ? <div className="server-actions"><button className="download-button" type="submit" disabled={busy || conflict || !Object.keys(changedInputs(draft, original)).length}>{busy ? 'Saving...' : 'Save'}</button><button type="button" className="secondary-button" disabled={busy} onClick={() => { if (!dirty || window.confirm('Discard unsaved server details?')) { setDraft(null); setOriginal(null); } }}>Cancel</button></div> : null}
        </form>
      </details>
      <section className="device-section" hidden={activeSection !== 'breakdown'}>
        <h3>Breakdown Logs</h3>
        <p>Times are shown and entered in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p>
        {canEdit ? <button type="button" className="download-button" onClick={() => openIncident('add')} disabled={busy || Boolean(editor) || Boolean(draft) || conflict}>Add Breakdown</button> : null}
        {!logs.length ? <p>No breakdown incidents recorded.</p> : <div className="server-table-scroll" role="region" aria-label="Breakdown logs" tabIndex={0}>
          <table className="server-log-table"><caption>Breakdown incidents, newest first</caption><thead><tr>{tableKeys.map(key => <th scope="col" key={key}>{formatFieldKey(key)}</th>)}<th scope="col">Actions</th></tr></thead>
            <tbody>{sortIncidents(logs).map(log => <tr key={log.incident_id}>{tableKeys.map(key => <td key={key}>{key === 'status' ? log.restoration_datetime ? 'Restored' : 'Open' : key === 'downtime_hours' ? downtime(log) : display(key, log[key])}</td>)}<td><div className="server-actions">
              <button type="button" className="secondary-button" disabled={busy || Boolean(editor) || Boolean(draft)} onClick={() => openIncident('view', log)}>View</button>
              {canEdit ? <><button type="button" className="secondary-button" disabled={busy || Boolean(editor) || Boolean(draft) || conflict} onClick={() => openIncident('edit', log)}>Edit</button>{!log.restoration_datetime ? <button type="button" className="secondary-button" disabled={busy || Boolean(editor) || Boolean(draft) || conflict} onClick={() => openIncident('restore', log)}>Mark Restored</button> : null}</> : null}
            </div></td></tr>)}</tbody></table>
        </div>}
        {editor ? <section className="device-section" aria-label="Incident details">
          <h3 tabIndex={-1} ref={editorRef}>{editor.mode === 'add' ? 'Add Breakdown' : editor.mode === 'restore' ? 'Mark Restored' : editor.mode === 'view' ? 'Incident Details' : 'Edit Incident'}{editor.record.incident_id ? ` — ${editor.record.incident_id}` : ''}</h3>
          <Values record={editor.record} keys={incidentAuditFields} />
          {editor.mode === 'view' ? <><Values record={editor.record} keys={incidentFields} /><div className="server-actions"><button type="button" className="secondary-button" onClick={cancelIncident}>Close Incident</button>{canEdit ? <button type="button" className="download-button" disabled={busy || conflict} onClick={() => openIncident('edit', editor.record)}>Edit Incident</button> : null}</div></> :
            <form onSubmit={saveIncident}>
              {editor.mode === 'restore' ? <Values record={editor.record} keys={['breakdown_start_datetime', 'root_cause', 'ticket_no']} /> : null}
              <fieldset disabled={busy || conflict} className="server-fieldset device-form-grid">{(editor.mode === 'restore' ? restoreFields : incidentFields).map(key => <Field key={key} name={key} value={editor.draft[key]} required={key === 'breakdown_start_datetime' || (editor.mode === 'restore' && key === 'restoration_datetime')} onChange={(name, value) => setEditor(current => ({ ...current, draft: { ...current.draft, [name]: value } }))} />)}</fieldset>
              <datalist id="server-root-causes">{['Hardware', 'OS', 'Network', 'Application', 'Power', 'Other'].map(value => <option key={value} value={value} />)}</datalist>
              <div className="server-actions"><button className="download-button" type="submit" disabled={busy || conflict || !Object.keys(changedInputs(editor.draft, editor.original)).length}>{busy ? 'Saving...' : editor.mode === 'restore' ? 'Mark Restored' : 'Save Incident'}</button><button type="button" className="secondary-button" disabled={busy} onClick={cancelIncident}>Cancel</button></div>
            </form>}
        </section> : null}
      </section>
    </> : null}
  </div>;
}
