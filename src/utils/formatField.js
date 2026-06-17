import { FIELD_LABELS } from './fieldLabels.js';

function toTitleCase(value) {
  return String(value || '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

export function formatFieldKey(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  return toTitleCase(key);
}

export function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}
