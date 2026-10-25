const pad = (n) => String(n).padStart(2, '0');

// "Today 14:05", "Yesterday 09:30" ya "Oct 7"
export function formatWhen(iso, now = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

// "2026-10-07" -> "Oct 7" (time zone se bagair)
export function formatDay(day) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

// quiz -> quizzes, match -> matches, lesson -> lessons
function pluralWord(word) {
  if (/z$/.test(word)) return `${word}zes`;
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
}
export const plural = (n, word) => `${n} ${n === 1 ? word : pluralWord(word)}`;
