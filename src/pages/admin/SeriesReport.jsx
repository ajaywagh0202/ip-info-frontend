import SearchReport from './SearchReport.jsx';

export default function SeriesReport() {
  return (
    <SearchReport
      title="Serial Number Report"
      placeholder="Enter Serial Number..."
      endpointPrefix="/api/admin/series-report"
      emptyWarning="Please enter a Serial number."
      resultLabel={(total, value) => `Found ${total} records for Serial: ${value}`}
      noRecordsLabel={(value) => `No records found for Serial number: ${value}`}
      reportType="series"
    />
  );
}
