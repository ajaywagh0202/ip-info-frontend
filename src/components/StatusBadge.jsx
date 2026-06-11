export default function StatusBadge({ completed }) {
  return (
    <span className={`status-badge ${completed ? 'status-completed' : 'status-pending'}`}>
      {completed ? 'Completed' : 'Pending'}
    </span>
  );
}
