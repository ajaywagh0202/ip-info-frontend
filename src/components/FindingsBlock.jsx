export default function FindingsBlock({ label, value, tone }) {
  return (
    <div className={`findings-block ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
