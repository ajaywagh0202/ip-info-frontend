import SearchReport from './SearchReport.jsx';

export default function DsrReport() {
  return (
    <SearchReport
      title="DSR Number Report"
      placeholder="Enter DSR Number..."
      endpointPrefix="/api/admin/dsr-report"
      emptyWarning="Please enter a DSR number."
      resultLabel={(total, value) => `Found ${total} records for DSR: ${value}`}
      noRecordsLabel={(value) => `No records found for DSR number: ${value}`}
      reportType="dsr"
    />
  );
}
