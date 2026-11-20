import { useState } from 'react';
import { useApi } from '../../hooks/useApi.js';
import { formatWhen } from '../../utils/format.js';

const KEY = 'lh-dismissed-announcements';

function readDismissed() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Admin/teacher ke paigham: sab ke liye ya sirf mujhe bheje gaye (reminder). Band karne par is device par chhup jate hain.
export default function Announcements() {
  const { data } = useApi('/announcements'); // error aaye to bas kuch nahi dikhta, dashboard na ruke
  const [dismissed, setDismissed] = useState(readDismissed);
  const items = (data?.announcements ?? []).filter((a) => !dismissed.includes(a.id));
  if (items.length === 0) return null;

  const dismiss = (id) => {
    const next = [id, ...dismissed].slice(0, 100);
    setDismissed(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage band ho to bhi is session mein chhup jata hai */
    }
  };

  return (
    <section className="announce-list" aria-label="Announcements">
      {items.map((a) => (
        <article key={a.id} className={`announce${a.level === 'important' ? ' is-important' : ''}`}>
          <div className="announce-body">
            <h3>
              {a.title}
              {a.level === 'important' && <span className="announce-tag">Important</span>}
              {a.personal && <span className="announce-tag">For you</span>}
            </h3>
            <p>{a.body}</p>
            <small className="announce-meta">{formatWhen(a.createdAt)}</small>
          </div>
          <button type="button" className="announce-close" onClick={() => dismiss(a.id)} aria-label={`Dismiss announcement: ${a.title}`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </article>
      ))}
    </section>
  );
}
