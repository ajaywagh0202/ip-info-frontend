export function getPasswordStrength(password = '') {
  const length = password.length;

  if (length < 6) return { label: 'Too short', color: 'red', tone: 'danger' };
  if (length <= 8) return { label: 'Weak', color: 'orange', tone: 'warning' };
  if (length <= 12) return { label: 'Good', color: 'yellow', tone: 'good' };
  return { label: 'Strong', color: 'green', tone: 'strong' };
}
