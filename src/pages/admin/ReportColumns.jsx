import { Eye } from 'lucide-react';
import formatDate from '../../utils/formatDate.js';

export function makeRecordColumns(onView, includeTargetIp = true) {
  return [
    { field: 'serial_no', headerName: 'Serial No.', minWidth: 110, maxWidth: 130, valueGetter: (params) => params.node.rowIndex + 1 },
    ...(includeTargetIp ? [{ field: 'target_ip', headerName: 'Target IP', minWidth: 145 }] : []),
    { field: 'name', headerName: 'Name', minWidth: 160 },
    { field: 'pf_no', headerName: 'PF No.', minWidth: 130 },
    { field: 'dept_name', headerName: 'Department', minWidth: 165 },
    { field: 'Series_no', headerName: 'Series No.', minWidth: 140 },
    { field: 'dsr_no', headerName: 'DSR No.', minWidth: 135 },
    { field: 'device_type', headerName: 'Device Type', minWidth: 145 },
    { field: 'date_of_procurement', headerName: 'Date of Procurement', minWidth: 175, valueFormatter: ({ value }) => formatDate(value, false) },
    { field: 'os', headerName: 'OS', minWidth: 135 },
    { field: 'hostname', headerName: 'Hostname', minWidth: 165 },
    { field: 'submitted_at', headerName: 'Submitted At', sort: 'desc', minWidth: 175, valueFormatter: ({ value }) => formatDate(value) },
    {
      headerName: 'Action',
      sortable: false,
      filter: false,
      floatingFilter: false,
      minWidth: 110,
      cellRenderer: ({ data }) => (
        <button className="grid-view-button" type="button" onClick={() => onView(data.original)}>
          <Eye size={15} />
          View
        </button>
      ),
    },
  ];
}

export const defaultGridColDef = {
  resizable: true,
  sortable: true,
  filter: true,
  floatingFilter: true,
  minWidth: 120,
};
