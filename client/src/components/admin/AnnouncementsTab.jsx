import { useState } from 'react';
import { request } from '../../services/api.js';
import { formatDate } from './format.js';
import { Loading } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

const DURATIONS = [
  { value: '', label: 'Until I remove it' },
  { value: '1', label: '1 day' },
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
];
const EMPTY = { title: '', body: '', level: 'info', days: '' };

// Sab students ke dashboard par dikhne wala paigham likho, aur purane paigham dekho / hatao
export default function AnnouncementsTab() {
  const { data, error, reload } = useAdminList('/admin/announcements');
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const valid = form.title.trim().length >= 3 && form.body.trim().length >= 3;

  async function publish(e) {
    e.preventDefault();
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      await request('/admin/announcements', {
        method: 'POST',
        body: { title: form.title, body: form.body, level: form.level, audience: 'everyone', expiresInDays: form.days ? Number(form.days) : null },
      });
      setForm(EMPTY);
      setNotice('Published. Every student will see it on their dashboard.');
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not publish');
    } finally {
      setBusy(false);
    }
  }

  async function remove(a) {
    if (!window.confirm(`Remove "${a.title}"? Students will stop seeing it.`)) return;
    try {
      setActionError('');
      await request(`/admin/announcements/${a.id}`, { method: 'DELETE' });
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not remove');
    }
  }

  return (
    <>
      <form className="admin-panel-box admin-announce-form" onSubmit={publish}>
        <h2>New announcement</h2>
        <label htmlFor="ann-title">Title</label>
        <input id="ann-title" className="form-control" maxLength={80} value={form.title} onChange={set('title')} placeholder="e.g. JavaScript quiz opens tomorrow" />
        <label htmlFor="ann-body">Message</label>
        <textarea id="ann-body" className="form-control" rows={3} maxLength={500} value={form.body} onChange={set('body')} placeholder="What should students know?" />
        <small className="admin-sub">{form.body.length}/500</small>
        <div className="admin-announce-row">
          <div>
            <label htmlFor="ann-level">Type</label>
            <select id="ann-level" className="form-select" value={form.level} onChange={set('level')}>
              <option value="info">Normal</option>
              <option value="important">Important (highlighted)</option>
            </select>
          </div>
          <div>
            <label htmlFor="ann-days">Show for</label>
            <select id="ann-days" className="form-select" value={form.days} onChange={set('days')}>
              {DURATIONS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="admin-sub">Goes to every student. To message only some students (a reminder), use the Insights page.</p>
        <div className="admin-actions">
          <button type="submit" className="btn btn-primary" disabled={!valid || busy}>
            {busy ? 'Publishing...' : 'Publish'}
          </button>
        </div>
        {notice && (
          <p className="admin-success" role="status">
            {notice}
          </p>
        )}
      </form>

      {(error || actionError) && <div className="alert alert-danger">{actionError || error}</div>}

      <h2 className="admin-section-title">Sent so far</h2>
      {!data ? (
        !error && <Loading />
      ) : data.announcements.length === 0 ? (
        <p className="admin-sub">Nothing sent yet.</p>
      ) : (
        data.announcements.map((a) => (
          <article key={a.id} className={`admin-panel-box admin-announce${a.active ? '' : ' is-expired'}`}>
            <div className="admin-announce-head">
              <h3>{a.title}</h3>
              <div className="admin-actions">
                {a.level === 'important' && <span className="badge text-bg-warning">Important</span>}
                <span className="badge text-bg-secondary">{a.audience === 'everyone' ? 'Everyone' : `${a.recipientCount} student${a.recipientCount === 1 ? '' : 's'}`}</span>
                <span className={`badge ${a.active ? 'text-bg-success' : 'text-bg-dark'}`}>{a.active ? 'Live' : 'Expired'}</span>
              </div>
            </div>
            <p>{a.body}</p>
            <small className="admin-sub">
              {a.createdByName ? `${a.createdByName}, ` : ''}
              {formatDate(a.createdAt)}
              {a.expiresAt ? `. ${a.active ? 'Ends' : 'Ended'} ${formatDate(a.expiresAt)}` : '. No end date'}
            </small>
            <div className="admin-actions mt-2">
              <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => remove(a)}>
                Remove
              </button>
            </div>
          </article>
        ))
      )}
    </>
  );
}
