export default function formatDate(value, includeTime = true) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  const options = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  };

  if (includeTime) {
    options.hour = '2-digit';
    options.minute = '2-digit';
    options.hour12 = false;
  }

  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(date);
  const part = (type) => parts.find((item) => item.type === type)?.value || '';
  const dateText = `${part('day')}/${part('month')}/${part('year')}`;

  return includeTime ? `${dateText} ${part('hour')}:${part('minute')}` : dateText;
}
