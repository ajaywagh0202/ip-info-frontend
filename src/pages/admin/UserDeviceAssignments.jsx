import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { LoaderCircle, Save, Trash2, TriangleAlert, UserCheck, X } from 'lucide-react';
import axiosClient from '../../api/axiosClient.js';
import LoadingSpinner from '../../components/LoadingSpinner.jsx';
import Toast from '../../components/Toast.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

const EMPTY_FORM = {
  pf_no: '',
  serial_number: '',
  target_ip: '',
  dsr_no: '',
};

const EMPTY_LOOKUP = {
  status: 'idle',
  data: null,
  message: '',
  searchedValue: '',
};

const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/;

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '') || '';
}

function extractRows(data) {
  return Array.isArray(data)
    ? data
    : data?.records || data?.data || data?.items || data?.assignments || data?.active || [];
}

function getAssignmentId(record) {
  return record?.id || record?._id || record?.assignment_id || record?.assignmentId || record?.user_device_sign_id || record?.userDeviceSignId || record?.sign_id || record?.signId;
}

function hasAnyValue(entity, keys) {
  return keys.some((key) => firstValue(entity?.[key]));
}

function getSearchEntity(data, nestedKeys = [], matchKeys = []) {
  if (!data || data.success === false || data.found === false) return null;

  const candidates = [
    data.data,
    data.record,
    data.result,
    data.item,
    ...nestedKeys.map((key) => data[key]),
    data,
  ];

  for (const candidate of candidates) {
    const entity = Array.isArray(candidate) ? candidate[0] : candidate;
    if (entity && typeof entity === 'object' && Object.keys(entity).length > 0 && (!matchKeys.length || hasAnyValue(entity, matchKeys))) {
      return entity;
    }
  }

  return null;
}

function normalizeAssignment(record, index) {
  const user = record?.user || record?.registered_user || record?.register_user || {};
  const device = record?.device || record?.registered_device || record?.register_device || {};
  const status = Number(firstValue(record?.status, record?.assignment_status, 1));

  return {
    ...record,
    row_no: index + 1,
    id: getAssignmentId(record),
    pf_no: firstValue(record?.pf_no, record?.pfNo, user?.pf_no, user?.pfNo),
    user_name: firstValue(record?.user_name, record?.name, user?.name, user?.employee_name, user?.full_name),
    serial_no: firstValue(record?.serial_no, record?.serial_number, record?.serialNumber, device?.serial_no, device?.serial_number, device?.serialNumber),
    device_type: firstValue(record?.device_type, record?.deviceType, device?.device_type, device?.deviceType, device?.device_name, device?.type),
    dsr_no: firstValue(record?.dsr_no, record?.dsrNo, device?.dsr_no, device?.dsrNo),
    target_ip: firstValue(record?.target_ip, record?.targetIp, record?.ip_address, record?.ip, device?.target_ip, device?.ip_address),
    status,
    status_label: status === 1 ? 'Active' : 'Inactive',
    action_label: 'Remove',
    original: record,
  };
}

function normalizeUser(data, pfNo) {
  const entity = getSearchEntity(data, ['user', 'registered_user', 'register_user'], [
    'pf_no',
    'pfNo',
    'pf',
    'name',
    'employee_name',
    'user_name',
    'full_name',
    'department',
    'dept_name',
    'deptName',
    'designation',
  ]);
  if (!entity) return null;

  return {
    pf_no: firstValue(entity.pf_no, entity.pfNo, entity.pf, pfNo),
    name: firstValue(entity.name, entity.employee_name, entity.user_name, entity.full_name),
    department: firstValue(entity.department, entity.dept_name, entity.deptName, entity.department_name, entity.dept_code),
    designation: firstValue(entity.designation, entity.role, entity.job_title),
    original: entity,
  };
}

function normalizeDevice(data, serialNumber) {
  const entity = getSearchEntity(data, ['device', 'registered_device', 'register_device', 'asset'], [
    'serial_number',
    'serialNumber',
    'serial_no',
    'serialNo',
    'serial',
    'device_type',
    'deviceType',
    'device_name',
    'type',
    'make_model',
    'makeModel',
    'model',
    'make',
  ]);
  if (!entity) return null;

  const make = firstValue(entity.make, entity.brand, entity.manufacturer);
  const model = firstValue(entity.model, entity.device_model, entity.model_no, entity.modelNo);
  const makeModel = firstValue(entity.make_model, entity.makeModel, entity.model_name, make && model ? `${make} / ${model}` : make || model);

  return {
    serial_number: firstValue(entity.serial_number, entity.serialNumber, entity.serial_no, entity.serialNo, entity.serial, serialNumber),
    device_type: firstValue(entity.device_type, entity.deviceType, entity.device_name, entity.type),
    dsr_no: firstValue(entity.dsr_no, entity.dsrNo),
    make_model: makeModel,
    original: entity,
  };
}

function getResponseMessage(errorOrData, fallback) {
  return firstValue(
    errorOrData?.response?.data?.message,
    errorOrData?.response?.data?.error,
    errorOrData?.data?.message,
    errorOrData?.data?.error,
    errorOrData?.message,
    errorOrData?.error,
    errorOrData?.friendlyMessage,
    fallback,
  );
}

function isValidIpv4(value) {
  return IPV4_PATTERN.test(String(value || '').trim());
}

function StatusBadge({ value }) {
  const active = Number(value) === 1;
  return (
    <span className={`admin-assignment-status-badge${active ? ' admin-assignment-status-badge--active' : ' admin-assignment-status-badge--inactive'}`}>
      {active ? 'Active' : 'Inactive'}
    </span>
  );
}

function ActiveAssignmentsGrid({ rows, loading, error, onRemove }) {
  const columnDefs = useMemo(() => [
    { field: 'target_ip', headerName: 'Target IP', minWidth: 145 },
    { field: 'serial_no', headerName: 'Serial No', minWidth: 150 },
    { field: 'pf_no', headerName: 'PF No', minWidth: 125 },
    { field: 'user_name', headerName: 'User Name', minWidth: 170, flex: 1.2 },
    { field: 'device_type', headerName: 'Device Type', minWidth: 150 },
    { field: 'dsr_no', headerName: 'DSR No', minWidth: 130 },
    {
      field: 'status_label',
      headerName: 'Status',
      minWidth: 130,
      cellRenderer: ({ data }) => <StatusBadge value={data?.status} />,
    },
    {
      field: 'action_label',
      headerName: 'Action',
      minWidth: 135,
      cellRenderer: ({ data }) => (
        <button className="grid-action-button red admin-assignment-remove-button" type="button" onClick={() => onRemove(data)}>
          <Trash2 size={15} />
          Remove
        </button>
      ),
    },
  ], [onRemove]);

  const defaultColDef = useMemo(() => ({
    ...defaultGridColDef,
    filter: true,
    sortable: true,
    resizable: true,
    floatingFilter: true,
  }), []);

  return (
    <section className="admin-assignment-panel admin-assignment-panel--grid">
      <div className="admin-assignment-panel-heading">
        <div>
          <p className="section-kicker">Active assignments</p>
          <h2>Assigned Devices</h2>
        </div>
        <span className="admin-assignment-count-pill">{rows.length} Active</span>
      </div>

      {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
      {loading ? <LoadingSpinner label="Loading active assignments" /> : null}

      <div className="ag-theme-quartz grid-shell admin-assignment-grid">
        <AgGridReact
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          loading={loading}
          pagination
          paginationPageSize={10}
          rowHeight={46}
          headerHeight={46}
          floatingFiltersHeight={42}
          suppressCellFocus
        />
      </div>
    </section>
  );
}

function LookupDetails({ items }) {
  return (
    <dl className="admin-assignment-lookup-details">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value || '-'}</dd>
        </div>
      ))}
    </dl>
  );
}

function LookupState({ lookup, loadingLabel, notFoundMessage, foundItems }) {
  if (lookup.status === 'loading') {
    return <LoadingSpinner label={loadingLabel} />;
  }

  if (lookup.status === 'found') {
    return <LookupDetails items={foundItems} />;
  }

  if (lookup.status === 'not_found') {
    return <span className="field-error">{notFoundMessage}</span>;
  }

  if (lookup.status === 'error') {
    return <span className="field-error">{lookup.message}</span>;
  }

  return null;
}

function AssignmentForm({ onAssigned, notify }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [userLookup, setUserLookup] = useState(EMPTY_LOOKUP);
  const [deviceLookup, setDeviceLookup] = useState(EMPTY_LOOKUP);
  const [submitBanner, setSubmitBanner] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const userRequestId = useRef(0);
  const deviceRequestId = useRef(0);

  const clearForm = useCallback(() => {
    userRequestId.current += 1;
    deviceRequestId.current += 1;
    setForm(EMPTY_FORM);
    setErrors({});
    setUserLookup(EMPTY_LOOKUP);
    setDeviceLookup(EMPTY_LOOKUP);
    setSubmitBanner(null);
  }, []);

  const lookupUser = useCallback(async (value) => {
    const pfNo = String(value || '').trim();
    const requestId = userRequestId.current + 1;
    userRequestId.current = requestId;

    if (!pfNo) {
      setUserLookup(EMPTY_LOOKUP);
      return;
    }

    setUserLookup({ status: 'loading', data: null, message: '', searchedValue: pfNo });

    try {
      const { data } = await axiosClient.get('/api/admin/register-users/search', { params: { pf_no: pfNo } });
      if (requestId !== userRequestId.current) return;

      const user = normalizeUser(data, pfNo);
      if (user) {
        setUserLookup({ status: 'found', data: user, message: '', searchedValue: pfNo });
        setErrors((current) => ({ ...current, pf_no: '' }));
      } else {
        setUserLookup({ status: 'not_found', data: null, message: 'No user found for this PF No', searchedValue: pfNo });
      }
    } catch (error) {
      if (requestId !== userRequestId.current) return;
      if (error.response?.status === 404) {
        setUserLookup({ status: 'not_found', data: null, message: 'No user found for this PF No', searchedValue: pfNo });
        return;
      }
      setUserLookup({ status: 'error', data: null, message: getResponseMessage(error, 'Unable to search user.'), searchedValue: pfNo });
    }
  }, []);

  const lookupDevice = useCallback(async (value) => {
    const serialNumber = String(value || '').trim();
    const requestId = deviceRequestId.current + 1;
    deviceRequestId.current = requestId;

    if (!serialNumber) {
      setDeviceLookup(EMPTY_LOOKUP);
      return;
    }

    setDeviceLookup({ status: 'loading', data: null, message: '', searchedValue: serialNumber });

    try {
      const { data } = await axiosClient.get('/api/admin/register-devices/search', { params: { serial_number: serialNumber } });
      if (requestId !== deviceRequestId.current) return;

      const device = normalizeDevice(data, serialNumber);
      if (device) {
        setDeviceLookup({ status: 'found', data: device, message: '', searchedValue: serialNumber });
        setForm((current) => (
          current.serial_number.trim() === serialNumber
            ? { ...current, dsr_no: device.dsr_no }
            : current
        ));
        setErrors((current) => ({ ...current, serial_number: '', dsr_no: '' }));
      } else {
        setDeviceLookup({ status: 'not_found', data: null, message: 'No device found for this Serial No', searchedValue: serialNumber });
      }
    } catch (error) {
      if (requestId !== deviceRequestId.current) return;
      if (error.response?.status === 404) {
        setDeviceLookup({ status: 'not_found', data: null, message: 'No device found for this Serial No', searchedValue: serialNumber });
        return;
      }
      setDeviceLookup({ status: 'error', data: null, message: getResponseMessage(error, 'Unable to search device.'), searchedValue: serialNumber });
    }
  }, []);

  useEffect(() => {
    const pfNo = form.pf_no.trim();
    if (!pfNo) return undefined;
    const timeout = window.setTimeout(() => lookupUser(pfNo), 500);
    return () => window.clearTimeout(timeout);
  }, [form.pf_no, lookupUser]);

  useEffect(() => {
    const serialNumber = form.serial_number.trim();
    if (!serialNumber) return undefined;
    const timeout = window.setTimeout(() => lookupDevice(serialNumber), 500);
    return () => window.clearTimeout(timeout);
  }, [form.serial_number, lookupDevice]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setSubmitBanner(null);

    if (name === 'pf_no') {
      userRequestId.current += 1;
      setUserLookup(value.trim() ? { ...EMPTY_LOOKUP, searchedValue: value.trim() } : EMPTY_LOOKUP);
    }

    if (name === 'serial_number') {
      deviceRequestId.current += 1;
      setDeviceLookup(value.trim() ? { ...EMPTY_LOOKUP, searchedValue: value.trim() } : EMPTY_LOOKUP);
    }
  };

  const validateForm = () => {
    const nextErrors = {};

    if (!form.pf_no.trim()) nextErrors.pf_no = 'PF No is required.';
    else if (userLookup.status !== 'found') nextErrors.pf_no = 'Resolve a valid PF No before assigning.';

    if (!form.serial_number.trim()) nextErrors.serial_number = 'Serial No is required.';
    else if (deviceLookup.status !== 'found') nextErrors.serial_number = 'Resolve a valid Serial No before assigning.';

    if (!form.target_ip.trim()) nextErrors.target_ip = 'Target IP is required.';
    else if (!isValidIpv4(form.target_ip)) nextErrors.target_ip = 'Enter a valid IPv4 address.';

    if (!form.dsr_no.trim()) nextErrors.dsr_no = 'DSR No is required.';

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitDisabled = submitting
    || userLookup.status !== 'found'
    || deviceLookup.status !== 'found'
    || !form.target_ip.trim()
    || !form.dsr_no.trim();

  const submitAssignment = async (event) => {
    event.preventDefault();
    setSubmitBanner(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        pf_no: form.pf_no.trim(),
        serial_number: form.serial_number.trim(),
        target_ip: form.target_ip.trim(),
        dsr_no: form.dsr_no.trim(),
      };
      const { data } = await axiosClient.post('/api/admin/user-device-sign', payload);

      if (data?.success === false) {
        setSubmitBanner({ type: 'error', message: getResponseMessage(data, 'Unable to assign this device.') });
        return;
      }

      notify('Device assigned successfully', 'success');
      clearForm();
      await onAssigned();
    } catch (error) {
      const message = getResponseMessage(error, 'Unable to assign this device.');
      setSubmitBanner({ type: error.response?.status === 409 ? 'warning' : 'error', message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="admin-assignment-panel admin-assignment-panel--form">
      <div className="admin-assignment-panel-heading">
        <div>
          <p className="section-kicker">New assignment</p>
          <h2>Assign Device</h2>
        </div>
        <UserCheck size={24} />
      </div>

      {submitBanner ? (
        <div className={`alert ${submitBanner.type === 'warning' ? 'alert-warning' : 'alert-error'}`} role="alert">
          {submitBanner.message}
        </div>
      ) : null}

      <form className="admin-assignment-form" onSubmit={submitAssignment} noValidate>
        <label className="field" htmlFor="assignment-pf-no">
          <span className="field-label">PF No<em>*</em></span>
          <input
            id="assignment-pf-no"
            name="pf_no"
            value={form.pf_no}
            onChange={updateField}
            onBlur={() => lookupUser(form.pf_no)}
            aria-invalid={Boolean(errors.pf_no)}
            autoComplete="off"
          />
          {errors.pf_no ? <span className="field-error">{errors.pf_no}</span> : null}
          <LookupState
            lookup={userLookup}
            loadingLabel="Searching user"
            notFoundMessage="No user found for this PF No"
            foundItems={[
              { label: 'Name', value: userLookup.data?.name },
              { label: 'Department', value: userLookup.data?.department },
              { label: 'Designation', value: userLookup.data?.designation },
            ]}
          />
        </label>

        <label className="field" htmlFor="assignment-serial-no">
          <span className="field-label">Serial No<em>*</em></span>
          <input
            id="assignment-serial-no"
            name="serial_number"
            value={form.serial_number}
            onChange={updateField}
            onBlur={() => lookupDevice(form.serial_number)}
            aria-invalid={Boolean(errors.serial_number)}
            autoComplete="off"
          />
          {errors.serial_number ? <span className="field-error">{errors.serial_number}</span> : null}
          <LookupState
            lookup={deviceLookup}
            loadingLabel="Searching device"
            notFoundMessage="No device found for this Serial No"
            foundItems={[
              { label: 'Device Type', value: deviceLookup.data?.device_type },
              { label: 'Make/Model', value: deviceLookup.data?.make_model },
            ]}
          />
        </label>

        <label className="field" htmlFor="assignment-target-ip">
          <span className="field-label">Target IP<em>*</em></span>
          <input
            id="assignment-target-ip"
            name="target_ip"
            value={form.target_ip}
            onChange={updateField}
            onBlur={() => {
              if (form.target_ip.trim() && !isValidIpv4(form.target_ip)) {
                setErrors((current) => ({ ...current, target_ip: 'Enter a valid IPv4 address.' }));
              }
            }}
            aria-invalid={Boolean(errors.target_ip)}
            inputMode="decimal"
            placeholder="192.168.1.10"
          />
          {errors.target_ip ? <span className="field-error">{errors.target_ip}</span> : null}
        </label>

        <label className="field" htmlFor="assignment-dsr-no">
          <span className="field-label">DSR No<em>*</em></span>
          <input
            id="assignment-dsr-no"
            name="dsr_no"
            value={form.dsr_no}
            onChange={updateField}
            aria-invalid={Boolean(errors.dsr_no)}
            autoComplete="off"
          />
          {errors.dsr_no ? <span className="field-error">{errors.dsr_no}</span> : null}
        </label>

        <div className="admin-assignment-form-actions">
          <button className="primary-button admin-assignment-submit-button" type="submit" disabled={submitDisabled}>
            {submitting ? <><LoaderCircle className="spin-icon" size={17} /> Assigning...</> : <><Save size={17} /> Assign Device</>}
          </button>
        </div>
      </form>
    </section>
  );
}

function RemoveAssignmentModal({ assignment, loading, error, onConfirm, onClose }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !loading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [loading, onClose]);

  if (!assignment) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={() => !loading && onClose()}>
      <section className="center-card admin-assignment-remove-modal" role="dialog" aria-modal="true" aria-labelledby="remove-assignment-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div className="danger-modal-title">
            <TriangleAlert size={22} />
            <h2 id="remove-assignment-title">Remove Assignment</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close remove assignment modal" disabled={loading}>
            <X size={19} />
          </button>
        </div>

        {error ? <div className="alert alert-error" role="alert">{error}</div> : null}
        <p className="delete-warning">Given user can not be continues assign with given register device</p>

        <dl className="delete-user-card">
          <div><dt>PF No</dt><dd>{assignment.pf_no || '-'}</dd></div>
          <div><dt>User</dt><dd>{assignment.user_name || '-'}</dd></div>
          <div><dt>Serial No</dt><dd>{assignment.serial_no || '-'}</dd></div>
          <div><dt>Target IP</dt><dd>{assignment.target_ip || '-'}</dd></div>
        </dl>

        <div className="modal-actions two">
          <button className="secondary-button" type="button" onClick={onClose} disabled={loading}>No</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={loading}>
            {loading ? 'Removing...' : 'Yes'}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function UserDeviceAssignments() {
  const [assignments, setAssignments] = useState([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [gridError, setGridError] = useState('');
  const [toast, setToast] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeLoading, setRemoveLoading] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  const loadAssignments = useCallback(async () => {
    setGridLoading(true);
    setGridError('');
    try {
      const { data } = await axiosClient.get('/api/admin/user-device-sign/active');
      setAssignments(extractRows(data).map(normalizeAssignment));
    } catch (error) {
      setAssignments([]);
      setGridError(getResponseMessage(error, 'Unable to load active assignments.'));
    } finally {
      setGridLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const openRemoveModal = useCallback((assignment) => {
    setRemoveTarget(assignment);
    setRemoveError('');
  }, []);

  const closeRemoveModal = useCallback(() => {
    if (removeLoading) return;
    setRemoveTarget(null);
    setRemoveError('');
  }, [removeLoading]);

  const confirmRemove = async () => {
    const assignmentId = getAssignmentId(removeTarget);
    if (!assignmentId) {
      setRemoveError('Unable to remove this assignment because its id was not returned by the server.');
      notify('Unable to remove assignment.', 'error');
      return;
    }

    setRemoveLoading(true);
    setRemoveError('');
    try {
      await axiosClient.patch(`/api/admin/user-device-sign/${assignmentId}/status`, { status: 0 });
      setRemoveTarget(null);
      notify('Assignment removed successfully', 'success');
      await loadAssignments();
    } catch (error) {
      const message = getResponseMessage(error, 'Unable to remove assignment.');
      setRemoveError(message);
      notify(message, 'error');
    } finally {
      setRemoveLoading(false);
    }
  };

  return (
    <section className="dashboard-page admin-assignment-page">
      <div className="page-heading-row">
        <div>
          <p className="section-kicker">Device assignment</p>
          <h1>User Device Assignment</h1>
        </div>
      </div>

      <div className="admin-assignment-split">
        <ActiveAssignmentsGrid
          rows={assignments}
          loading={gridLoading}
          error={gridError}
          onRemove={openRemoveModal}
        />
        <AssignmentForm onAssigned={loadAssignments} notify={notify} />
      </div>

      <RemoveAssignmentModal
        assignment={removeTarget}
        loading={removeLoading}
        error={removeError}
        onConfirm={confirmRemove}
        onClose={closeRemoveModal}
      />
      <Toast message={toast?.message} type={toast?.type} onClose={() => setToast(null)} />
    </section>
  );
}
