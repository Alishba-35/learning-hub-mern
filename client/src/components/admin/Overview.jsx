import { BarChart, ProgressRow } from './Charts.jsx';
import { Loading } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

export default function Overview({ onOpenVideos, onOpenStudent }) {
  const { data, error } = useAdminList('/admin/stats');
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;

  const cards = [
    { label: 'Students signed up', value: data.students, note: `${data.newStudents} new in the last 7 days` },
    { label: 'Active this week', value: data.activeWeek, note: 'Learned something in the last 7 days' },
    { label: 'Certificates issued', value: data.certificates, note: 'Genuine, not revoked' },
    { label: 'Videos waiting', value: data.videos.pending, note: 'Need your review', action: () => onOpenVideos('pending') },
    { label: 'Videos approved', value: data.videos.approved, note: 'Visible to everyone', action: () => onOpenVideos('approved') },
    { label: 'Videos rejected', value: data.videos.rejected, note: 'Hidden from Shorts Study', action: () => onOpenVideos('rejected') },
    {
      label: 'Quiz attempts',
      value: data.quizzes.attempts,
      note: data.quizzes.takers ? `${data.quizzes.takers} students, average ${data.quizzes.averagePercent}%` : 'No quizzes taken yet',
    },
  ];
  const signupTotal = data.signups.reduce((n, d) => n + d.count, 0);
  const topLanguage = data.popularLanguages[0]?.learners ?? 0;

  return (
    <>
      <div className="admin-stats">
        {cards.map((c) => (
          <div className="admin-stat" key={c.label}>
            <span className="admin-stat-label">{c.label}</span>
            <strong className="admin-stat-value">{c.value}</strong>
            <span className="admin-stat-note">{c.note}</span>
            {c.action && (
              <button type="button" className="btn btn-outline-light btn-sm" onClick={c.action}>
                View
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="admin-columns">
        <section className="admin-panel-box">
          <h2>New signups, last 30 days</h2>
          <BarChart data={data.signups.map((d) => ({ label: d.day, value: d.count }))} title={`${signupTotal} students signed up in the last 30 days`} />
          <p className="admin-sub">{signupTotal} in total</p>
        </section>

        <section className="admin-panel-box">
          <h2>Top learners</h2>
          {data.topLearners.length === 0 ? (
            <p className="admin-sub">Nobody has earned XP yet.</p>
          ) : (
            <ol className="admin-top-list">
              {data.topLearners.map((s) => (
                <li key={s.id}>
                  <button type="button" className="admin-link" onClick={() => onOpenStudent(s.id)}>
                    {s.name}
                  </button>
                  <span className="admin-sub-inline">
                    {s.xp} XP, level {s.level}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="admin-panel-box">
        <h2>Languages students are learning</h2>
        {data.popularLanguages.length === 0 ? (
          <p className="admin-sub">No lessons completed yet.</p>
        ) : (
          data.popularLanguages.map((l) => <ProgressRow key={l.slug} label={l.name} value={l.learners} max={topLanguage} color={l.color} note={`${l.learners} learner${l.learners === 1 ? '' : 's'}, ${l.lessons} lessons done`} />)
        )}
      </section>
    </>
  );
}
