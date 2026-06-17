export default function StatCard({ icon: Icon, label, value }) {
  return (
    <article className="analytics-stat-card">
      <span className="analytics-stat-icon" aria-hidden="true">
        <Icon size={24} />
      </span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
