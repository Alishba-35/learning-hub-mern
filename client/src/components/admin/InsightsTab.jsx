import { useState } from 'react';
import { request } from '../../services/api.js';
import { ProgressRow } from './Charts.jsx';
import { formatDate, relativeDay } from './format.js';
import { Loading } from './shared.jsx';
import { useAdminList } from './useAdminList.js';

const SHOWN = 8;

const GROUPS = [
  {
    key: 'inactive',
    title: 'Stopped learning',
    hint: (t) => `No activity for ${t.inactiveDays}+ days`,
    line: (s) => `Last active ${relativeDay(s.lastActiveDay)}, ${s.xp} XP`,
    reminder: { title: 'We miss you', body: 'We have not seen you for a while. Pick up where you left off, your next lesson is waiting.' },
  },
  {
    key: 'neverStarted',
    title: 'Never started',
    hint: (t) => `Signed up ${t.neverStartedDays}+ days ago, but no lesson or quiz yet`,
    line: (s) => `Signed up ${formatDate(s.joinedAt)}`,
    reminder: { title: 'Start your first lesson', body: 'Welcome to Learning Hub! Begin with your first lesson. It only takes a few minutes.' },
  },
  {
    key: 'streakBroken',
    title: 'Lost a streak',
    hint: () => 'Had a streak of 3+ days, then went quiet',
    line: (s) => `Best streak ${s.longestStreak} days, last active ${relativeDay(s.lastActiveDay)}`,
    reminder: { title: 'Keep your streak going', body: 'Your learning streak took a break. Finish one lesson today to start a new one!' },
  },
];

// Ek group ke students: list, "Copy emails" aur "Email them"
function NudgeGroup({ group, data, thresholds, onOpenStudent }) {
  const [all, setAll] = useState(false);
  const [copied, setCopied] = useState('');
  const [reminding, setReminding] = useState(false);
  const [message, setMessage] = useState(group.reminder.body);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState({ text: '', error: false });
  const students = data.students;
  const shown = all ? students : students.slice(0, SHOWN);
  const emails = students.map((s) => s.email);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(emails.join(', '));
      setCopied('Copied!');
    } catch {
      setCopied('Could not copy');
    }
  };

  // Reminder: in students ke dashboard par 7 din tak dikhne wala personal paigham
  const send = async (e) => {
    e.preventDefault();
    setSending(true);
    setResult({ text: '', error: false });
    try {
      const res = await request('/admin/announcements', {
        method: 'POST',
        body: { title: group.reminder.title, body: message, level: 'info', audience: 'selected', userIds: students.map((s) => s.id), expiresInDays: 7 },
      });
      setResult({ text: `Reminder sent to ${res.recipients} student${res.recipients === 1 ? '' : 's'}. They will see it on their dashboard.`, error: false });
      setReminding(false);
    } catch (err) {
      setResult({ text: err.message || 'Could not send the reminder', error: true });
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="admin-panel-box">
      <h2>
        {group.title} <span className="badge text-bg-secondary">{data.total}</span>
      </h2>
      <p className="admin-sub">{group.hint(thresholds)}</p>
      {students.length === 0 ? (
        <p className="admin-sub">Nobody here. Good news!</p>
      ) : (
        <>
          <ul className="admin-nudge-list">
            {shown.map((s) => (
              <li key={s.id}>
                <span>
                  <strong>{s.name}</strong>
                  <small className="admin-sub">{group.line(s)}</small>
                </span>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => onOpenStudent(s.id)}>
                  View
                </button>
              </li>
            ))}
          </ul>
          {students.length > SHOWN && (
            <button type="button" className="btn btn-outline-light btn-sm me-2" onClick={() => setAll(!all)}>
              {all ? 'Show fewer' : `Show all ${students.length}`}
            </button>
          )}
          <div className="admin-actions mt-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
              Copy emails
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setReminding(!reminding)} aria-expanded={reminding}>
              Send reminder
            </button>
            <a className="btn btn-outline-light btn-sm" href={`mailto:?bcc=${emails.map(encodeURIComponent).join(',')}&subject=${encodeURIComponent('We miss you on Learning Hub')}`}>
              Email them
            </a>
            {copied && (
              <span className="admin-sub-inline" role="status">
                {copied}
              </span>
            )}
          </div>
          {reminding && (
            <form className="admin-reject" onSubmit={send}>
              <label htmlFor={`reminder-${group.key}`}>
                Reminder for {students.length} student{students.length === 1 ? '' : 's'}
                {data.total > students.length ? ` (the first ${students.length} of ${data.total})` : ''}. It shows on their dashboard for 7 days.
              </label>
              <textarea id={`reminder-${group.key}`} className="form-control" rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="admin-actions">
                <button type="submit" className="btn btn-primary btn-sm" disabled={sending || message.trim().length < 3}>
                  {sending ? 'Sending...' : 'Send'}
                </button>
                <button type="button" className="btn btn-outline-light btn-sm" onClick={() => setReminding(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
          {result.text && (
            <p className={result.error ? 'admin-warning' : 'admin-success'} role="status">
              {result.text}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function HardQuestions({ questions, minAsked }) {
  return (
    <section className="admin-panel-box">
      <h2>Questions students get wrong most</h2>
      <p className="admin-sub">Based on each student&apos;s first try at a quiz. A question needs answers from at least {minAsked} students to show up here.</p>
      {questions.length === 0 ? (
        <p className="admin-sub">Not enough data yet. This fills in as students take quizzes.</p>
      ) : (
        questions.map((q) => (
          <div key={`${q.languageSlug}/${q.quizSlug}/${q.questionId}`} className="admin-hard-question">
            <ProgressRow label={q.prompt} value={q.wrongPercent} max={100} color="#bd3a30" note={`${q.wrongPercent}% wrong (${q.wrong} of ${q.asked})`} />
            <small className="admin-sub">
              {q.language}: {q.quizTitle}. Consider making this lesson clearer.
            </small>
          </div>
        ))
      )}
    </section>
  );
}

function DropOff({ languages }) {
  const [slug, setSlug] = useState(languages[0]?.slug ?? '');
  const lang = languages.find((l) => l.slug === slug) ?? languages[0];

  return (
    <section className="admin-panel-box">
      <h2>Where students stop</h2>
      {!lang ? (
        <p className="admin-sub">Nobody has completed a lesson yet.</p>
      ) : (
        <>
          <label htmlFor="dropoff-language" className="admin-sub">
            Language
          </label>
          <select id="dropoff-language" className="form-select form-select-sm admin-select" value={lang.slug} onChange={(e) => setSlug(e.target.value)}>
            {languages.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name} ({l.starters} learner{l.starters === 1 ? '' : 's'})
              </option>
            ))}
          </select>
          {lang.biggestDrop ? (
            <p className="admin-warning">
              Biggest drop: after &quot;{lang.biggestDrop.from}&quot; {lang.biggestDrop.dropPercent}% of students stop ({lang.biggestDrop.fromCount} finished it, {lang.biggestDrop.toCount} went on to &quot;{lang.biggestDrop.to}&quot;).
            </p>
          ) : (
            <p className="admin-sub">No big drop yet. Students who finish one lesson tend to carry on.</p>
          )}
          {lang.lessons.map((l) => (
            <ProgressRow key={l.slug} label={l.title} value={l.completed} max={lang.starters} color={lang.color} note={`${l.completed} (${l.percent}%)`} />
          ))}
        </>
      )}
    </section>
  );
}

// Insights: kaun peeche reh gaya, kaunse sawal/lessons mushkil hain
export default function InsightsTab({ onOpenStudent }) {
  const { data, error } = useAdminList('/admin/insights');
  if (error) return <div className="alert alert-danger">{error}</div>;
  if (!data) return <Loading />;

  return (
    <>
      <h2 className="admin-section-title">Students who need a nudge</h2>
      <div className="admin-columns admin-columns-top">
        {GROUPS.map((g) => (
          <NudgeGroup key={g.key} group={g} data={data.atRisk[g.key]} thresholds={data.thresholds} onOpenStudent={onOpenStudent} />
        ))}
      </div>
      <h2 className="admin-section-title">What is hard to learn</h2>
      <HardQuestions questions={data.hardQuestions} minAsked={data.thresholds.minAsked} />
      <DropOff languages={data.dropOff} />
    </>
  );
}
