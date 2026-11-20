export const formatDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

const dayStamp = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

// "2026-11-18" -> "Yesterday", "3 days ago"; kabhi active na hua to "Never"
export function relativeDay(day, now = new Date()) {
  if (!day) return 'Never';
  const [y, m, d] = day.split('-').map(Number);
  const diff = Math.round((dayStamp(now) - Date.UTC(y, m - 1, d)) / 86400000);
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}
