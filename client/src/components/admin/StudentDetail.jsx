import { useState } from 'react';
import { request } from '../../services/api.js';
import { BarChart, ProgressRow } from './Charts.jsx';
import { formatDate, relativeDay } from './format.js';
import { Loading, StatusBadge } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

const ROLE_LABEL = { student: 'Student', teacher: 'Teacher' };

// Ek student ki poori tasveer + account ke actions (suspend, role, delete)
export default function StudentDetail({ id, onBack, onOpenVideos }) {
  const { data, error, reload } = useAdminList(`/admin/students/${id}`);
  const [mode, setMode] = useState(null); // 'suspend' | 'delete' | null
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [actionError, setActionError] = useState('');

  async function act(fn, after) {
    try {
      setActionError('');
      await fn();
      setMode(null);
      setReason('');
      setConfirm('');
      await after();
    } catch (err) {
      setActionError(err.message || 'Something went wrong');
    }
  }

  if (error) {
    return (
      <>
        <button type="button" className="btn btn-outline-light btn-sm mb-3" onClick={onBack}>
          Back to students
        </button>
        <div className="alert alert-danger">{error}</div>
      </>
    );
  }
  if (!data) return <Loading />;

  const { student: s, stats, languages, quizzes, badges, series, recent, videos } = data;
  const started = languages.filter((l) => l.completed > 0).sort((a, b) => b.percent - a.percent);
  const notStarted = languages.filter((l) => l.total > 0 && l.completed === 0);
  const path = `/admin/students/${s.id}`;

  const toggleSuspension = () => act(() => request(`${path}/suspension`, { method: 'PATCH', body: { disabled: !s.disabled, reason } }), reload);
  const changeRole = (role) => act(() => request(`${path}/role`, { method: 'PATCH', body: { role } }), reload);
  const deleteAccount = () => act(() => request(`${path}?confirm=${encodeURIComponent(confirm.trim())}`, { method: 'DELETE' }), onBack);

  return (
    <>
      <button type="button" className="btn btn-outline-light btn-sm mb-3" onClick={onBack}>
        Back to students
      </button>

      <section className="admin-panel-box admin-profile">
        <div>
          <h2>
            {s.name}
            <span className="badge text-bg-secondary ms-2">{ROLE_LABEL[s.role] ?? s.role}</span>
            <StatusBadge disabled={s.disabled} />
          </h2>
          <p className="admin-sub">{s.email}</p>
          <p className="admin-sub">
            Signed up {formatDate(s.joinedAt)}. Signed in on {s.sessions} device{s.sessions === 1 ? '' : 's'}.
          </p>
          {s.purpose && <p className="admin-sub">Why they joined: {s.purpose}</p>}
          {s.disabled && <p className="admin-warning">Suspended{s.disabledReason ? `: ${s.disabledReason}` : ''}</p>}
        </div>

        <div className="admin-actions">
          <button type="button" className="btn btn-outline-light btn-sm" disabled={videos.total === 0} onClick={() => onOpenVideos({ id: s.id, name: s.name })}>
            Their videos ({videos.total})
          </button>
          {s.role === 'student' ? (
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => changeRole('teacher')}>
              Make teacher
            </button>
          ) : (
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => changeRole('student')}>
              Make student
            </button>
          )}
          {s.disabled ? (
            <button type="button" className="btn btn-success btn-sm" onClick={toggleSuspension}>
              Reactivate
            </button>
          ) : (
            <button type="button" className="btn btn-warning btn-sm" onClick={() => setMode(mode === 'suspend' ? null : 'suspend')}>
              Suspend
            </button>
          )}
          <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => setMode(mode === 'delete' ? null : 'delete')}>
            Delete account
          </button>
        </div>
      </section>

      {actionError && <div className="alert alert-danger">{actionError}</div>}

      {mode === 'suspend' && (
        <form
          className="admin-panel-box admin-reject"
          onSubmit={(e) => {
            e.preventDefault();
            toggleSuspension();
          }}
        >
          <label htmlFor="suspend-reason">Why are you suspending this account? They cannot log in until you reactivate it.</label>
          <input id="suspend-reason" className="form-control form-control-sm" maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Uploading unrelated videos" autoFocus />
          <div className="admin-actions">
            <button type="submit" className="btn btn-warning btn-sm" disabled={reason.trim().length < 3}>
              Confirm suspend
            </button>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'delete' && (
        <form
          className="admin-panel-box admin-reject"
          onSubmit={(e) => {
            e.preventDefault();
            deleteAccount();
          }}
        >
          <label htmlFor="delete-confirm">
            This permanently deletes the account, progress, quiz results and uploaded videos. Type <strong>{s.email}</strong> to confirm.
          </label>
          <input id="delete-confirm" className="form-control form-control-sm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" autoFocus />
          <div className="admin-actions">
            <button type="submit" className="btn btn-danger btn-sm" disabled={confirm.trim().toLowerCase() !== s.email}>
              Delete forever
            </button>
            <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setMode(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="admin-stats admin-stats-small">
        {[
          ['XP', stats.xp, `Level ${stats.level}`],
          ['Streak', `${stats.streak} day${stats.streak === 1 ? '' : 's'}`, `Best ${stats.longestStreak}`],
          ['Last active', relativeDay(stats.lastActiveDay), ''],
          ['Lessons done', stats.completedTotal, ''],
          ['Quizzes passed', `${stats.quizzes.passed}/${stats.quizzes.taken}`, `${stats.quizzes.perfect} perfect`],
        ].map(([label, value, note]) => (
          <div className="admin-stat" key={label}>
            <span className="admin-stat-label">{label}</span>
            <strong className="admin-stat-value">{value}</strong>
            {note && <span className="admin-stat-note">{note}</span>}
          </div>
        ))}
      </div>

      <div className="admin-columns">
        <section className="admin-panel-box">
          <h2>Progress by language</h2>
          {started.length === 0 ? (
            <p className="admin-sub">Has not completed any lesson yet.</p>
          ) : (
            started.map((l) => <ProgressRow key={l.slug} label={l.name} value={l.completed} max={l.total} color={l.color} note={`${l.completed}/${l.total} lessons${l.score.percent === null ? '' : `, quizzes ${l.score.percent}%`}`} />)
          )}
          {notStarted.length > 0 && <p className="admin-sub">Not started: {notStarted.map((l) => l.name).join(', ')}</p>}
        </section>

        <section className="admin-panel-box">
          <h2>XP, last 14 days</h2>
          <BarChart data={series.map((d) => ({ label: d.day, value: d.xp }))} title={`${series.reduce((n, d) => n + d.xp, 0)} XP earned in the last 14 days`} />
          <p className="admin-sub">{series.reduce((n, d) => n + d.xp, 0)} XP in 14 days</p>
        </section>
      </div>

      <section className="admin-panel-box">
        <h2>Quizzes</h2>
        {quizzes.length === 0 ? (
          <p className="admin-sub">No quizzes taken yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Best score</th>
                  <th>Attempts</th>
                  <th>Last taken</th>
                </tr>
              </thead>
              <tbody>
                {quizzes.map((q) => (
                  <tr key={`${q.languageSlug}/${q.quizSlug}`}>
                    <td data-label="Quiz">{q.title}</td>
                    <td data-label="Best score">
                      {q.bestScore}/{q.total} ({q.percent}%)
                    </td>
                    <td data-label="Attempts">{q.attempts}</td>
                    <td data-label="Last taken">{formatDate(q.lastAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="admin-columns">
        <section className="admin-panel-box">
          <h2>Badges ({badges.length})</h2>
          {badges.length === 0 ? (
            <p className="admin-sub">No badges earned yet.</p>
          ) : (
            <ul className="admin-chips">
              {badges.map((b) => (
                <li key={b.id} title={b.description}>
                  {b.title}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-panel-box">
          <h2>Recent activity</h2>
          {recent.length === 0 ? (
            <p className="admin-sub">Nothing yet.</p>
          ) : (
            <ul className="admin-activity">
              {recent.map((a, i) => (
                <li key={`${a.at}-${i}`}>
                  <span className="admin-activity-type">{a.type === 'quiz' ? 'Quiz' : 'Lesson'}</span>
                  <span>
                    {a.title}
                    {a.detail && <small className="admin-sub"> {a.detail}</small>}
                  </span>
                  <span className="admin-sub-inline">+{a.xp} XP, {formatDate(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
