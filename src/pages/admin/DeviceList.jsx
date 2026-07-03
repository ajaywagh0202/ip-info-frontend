import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { LoaderCircle, Save } from 'lucide-react';
import axiosInstance from '../../utils/axiosInstance.js';
import { extractRows } from '../../utils/adminRecords.js';
import InputField from '../../components/InputField.jsx';
import { defaultGridColDef } from './ReportColumns.jsx';

ModuleRegistry.registerModules([AllCommunityModule]);

function AccessTypeBadge({ value }) {
  const isNormalUser = Number(value) === 1;
  return (
    <span className={`device-access-badge${isNormalUser ? ' device-access-badge--normal' : ' device-access-badge--admin'}`}>
      {isNormalUser ? 'Normal User' : 'Admin Only'}
    </span>
  );
}

const emptyForm = {
  device_name: '',
  device_code: '',
  view: '1',
};

function makeDeviceCode(deviceName) {
  return String(deviceName || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function getAccessTypeLabel(value) {
  return Number(value) === 1 ? 'Normal User' : 'Admin Only';
}

function normalizeFilterText(value) {
  return String(value ?? '').toLowerCase();
}

const textFilterParams = {
  debounceMs: 100,
  defaultOption: 'contains',
  filterOptions: ['contains'],
  maxNumConditions: 1,
  textFormatter: normalizeFilterText,
};

export default function DeviceList() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [filteredCount, setFilteredCount] = useState(0);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      const { data } = await axiosInstance.get('/api/devices');
      setDevices(extractRows(data));
    } catch (requestError) {
      setDevices([]);
      setListError(requestError.friendlyMessage || 'Unable to load devices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
  }, [loadDevices]);

  const updateField = (event) => {
    const { name, value } = event.target;
    setForm((current) => (
      name === 'device_name'
        ? { ...current, device_name: value, device_code: makeDeviceCode(value) }
        : { ...current, [name]: value }
    ));
    setErrors((current) => ({
      ...current,
      [name]: '',
      ...(name === 'device_name' ? { device_code: '' } : {}),
    }));
    setFormError('');
  };

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setFormError('');
  };

  const validate = () => {
    const nextErrors = {};
    if (!form.device_name.trim()) nextErrors.device_name = 'Device name is required.';
    if (!form.device_code.trim()) nextErrors.device_code = 'Device code is required.';
    if (form.view === '') nextErrors.view = 'Access type is required.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const saveDevice = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!validate()) return;

    const payload = { device_name: form.device_name.trim(), device_code: form.device_code.trim(), view: Number(form.view) };

    setSaving(true);
    try {
      await axiosInstance.post('/api/add-device', payload);
      window.dispatchEvent(new CustomEvent('app-toast', {
        detail: { message: 'Device added successfully', type: 'success' },
      }));
      resetForm();
      await loadDevices();
    } catch (requestError) {
      const isDuplicateCode = requestError.response?.status === 409;
      setFormError(isDuplicateCode ? 'A device with this code already exists.' : requestError.friendlyMessage || requestError.message || 'Unable to save device.');
    } finally {
      setSaving(false);
    }
  };

  const rowData = useMemo(() => devices.map((device, index) => {
    const deviceName = device.device_name || device.deviceName || device.name || '';
    const deviceCode = device.device_code || device.deviceCode || makeDeviceCode(deviceName);
    const view = Number(device.view ?? device.access_type ?? device.accessType ?? 1);

    return {
      ...device,
      serial_no: index + 1,
      device_name: deviceName,
      device_code: deviceCode,
      view,
      access_type_label: getAccessTypeLabel(view),
    };
  }), [devices]);

  useEffect(() => {
    setFilteredCount(rowData.length);
  }, [rowData.length]);

  const syncFilteredCount = useCallback((event) => {
    setFilteredCount(event.api.getDisplayedRowCount());
  }, []);

  const gridDefaultColDef = useMemo(() => ({
    ...defaultGridColDef,
    filter: 'agTextColumnFilter',
    filterParams: textFilterParams,
    floatingFilterComponentParams: { suppressFilterButton: true },
  }), []);

  const deviceCountLabel = filteredCount === rowData.length
    ? `${rowData.length} Devices`
    : `${filteredCount} of ${rowData.length} Devices`;

  const columnDefs = useMemo(() => [
    {
      field: 'serial_no',
      headerName: 'Serial No.',
      minWidth: 115,
      maxWidth: 135,
      valueGetter: (params) => params.node.rowIndex + 1,
      filterValueGetter: ({ data }) => data?.serial_no,
    },
    { field: 'device_name', headerName: 'Device Name', flex: 2, minWidth: 260 },
    { field: 'device_code', headerName: 'Device Code', flex: 1.3, minWidth: 210 },
    {
      field: 'access_type_label',
      headerName: 'Access Type',
      flex: 1,
      minWidth: 180,
      cellRenderer: ({ data }) => <AccessTypeBadge value={data?.view} />,
    },
  ], []);

  return (
    <section className="dashboard-page device-list-page">
      <div className="page-heading-row device-list-heading">
        <div>
          <p className="section-kicker">Device management</p>
          <h1>Device List</h1>
        </div>
      </div>

      <section>
        <h2 className="subsection-title">Create New Device</h2>
        <form className="form-card device-management-card" onSubmit={saveDevice} noValidate>
          {formError ? <div className="alert alert-error" role="alert">{formError}</div> : null}
          <div className="form-grid">
            <InputField label="Device Name" name="device_name" required placeholder="Enter device name" value={form.device_name} onChange={updateField} error={errors.device_name} />
            <InputField label="Device Code" name="device_code" required placeholder="Generated from device name" value={form.device_code} onChange={updateField} error={errors.device_code}  disabled={true}/>
            <label className="field" htmlFor="device-view">
              <span className="field-label">Access Type<em>*</em></span>
              <select id="device-view" name="view" value={form.view} onChange={updateField} aria-invalid={Boolean(errors.view)}>
                <option value="1">Normal User</option>
                <option value="0">For All</option>
              </select>
              {errors.view ? <span className="field-error">{errors.view}</span> : null}
            </label>
          </div>
          <div className="device-management-actions">
            <button className="primary-button" type="submit" disabled={saving}>
              {saving ? <><LoaderCircle className="spin-icon" size={17} /> Saving...</> : <><Save size={17} /> Save Device</>}
            </button>
          </div>
        </form>
      </section>

      <section>
        <div className="device-table-heading">
          <div>
            <h2 className="subsection-title">Existing Devices</h2>
            <p>Search, filter, and review configured device types.</p>
          </div>
          <span className="device-count-pill">{deviceCountLabel}</span>
        </div>
        {listError ? <div className="alert alert-error">{listError}</div> : null}

        <div className="ag-theme-quartz grid-shell device-list-grid">
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={gridDefaultColDef}
            loading={loading}
            pagination
            paginationPageSize={15}
            rowHeight={46}
            headerHeight={46}
            floatingFiltersHeight={42}
            onGridReady={syncFilteredCount}
            onFirstDataRendered={syncFilteredCount}
            onRowDataUpdated={syncFilteredCount}
            onFilterChanged={syncFilteredCount}
          />
        </div>
      </section>
    </section>
  );
}
