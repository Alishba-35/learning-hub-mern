import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { useAuth } from '../hooks/useAuth.js';
import { languages as languageCards } from '../data/languages.js';
import { localDay } from '../utils/day.js';
import { formatWhen, plural } from '../utils/format.js';
import { pickContinue } from '../utils/recommend.js';
import { AreaChart, Donut, MiniBars, Sparkline } from '../components/dashboard/charts.jsx';
import DashboardShell from '../components/dashboard/DashboardShell.jsx';
import DashboardSkeleton from '../components/dashboard/DashboardSkeleton.jsx';
import { useDashboard } from '../components/dashboard/dashboardContext.js';
import Icon from '../components/dashboard/Icon.jsx';

const DAY = localDay();

function StatCard({ icon, label, value, note, children, tone }) {
  return (
    <section className={`card stat${tone ? ` ${tone}` : ''}`} aria-label={label}>
      <div className="stat-top">
        <span className="chip-icon" aria-hidden="true">
          <Icon name={icon} size={18} />
        </span>
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
        </div>
        {children}
      </div>
      {note && <p className="stat-note">{note}</p>}
    </section>
  );
}

function LanguageCard({ lang }) {
  const { askBuddy } = useDashboard();
  const card = languageCards.find((c) => c.slug === lang.slug);
  const target = lang.nextTopic?.slug ?? lang.lastTopic ?? lang.firstTopic;
  const action = lang.completed === 0 ? 'Start' : lang.completed >= lang.total ? 'Review' : 'Continue';
  return (
    <article className="card lang-card-dash" style={{ '--lang': lang.color }}>
      <div className="lang-art">
        {card?.image ? <img src={card.image} alt="" /> : <span aria-hidden="true">{lang.name.slice(0, 2)}</span>}
      </div>
      <div className="lang-head">
        <div>
          <h3>{lang.name}</h3>
          <p>{plural(lang.total, 'lesson')}</p>
        </div>
        <Donut percent={lang.percent} size={46} stroke={5} color="var(--lang)" label={`${lang.name} progress ${lang.percent}%`}>
          <small>{lang.percent}%</small>
        </Donut>
      </div>
      <dl className="lang-stats">
        <div>
          <dt>Lessons</dt>
          <dd>
            {lang.completed}/{lang.total}
          </dd>
        </div>
        <div>
          <dt>Quizzes</dt>
          <dd>
            {lang.quizzes.taken}/{lang.quizzes.total}
          </dd>
        </div>
        <div>
          <dt>XP</dt>
          <dd>{lang.xp}</dd>
        </div>
      </dl>
      <div className="lang-actions">
        <Link className="btn-dash primary" to={target ? `/learn/${lang.slug}/${target}` : `/learn/${lang.slug}`} aria-label={`${action} ${lang.name}`}>
          {action}
        </Link>
        <button type="button" className="btn-dash ghost" onClick={() => askBuddy(`How am I doing in ${lang.name}?`)} aria-label={`Ask Buddy about ${lang.name}`}>
          Ask Buddy
        </button>
      </div>
    </article>
  );
}

function DashboardBody({ data, user }) {
  const { stats, languages, badges, series, week, recent } = data;
  const earned = badges.filter((b) => b.earned).length;
  const goal = week.goal;
  const goalStatus = goal.percent >= 100 ? 'Goal reached' : goal.percent >= 50 ? 'On track' : 'Keep going';
  const delta = week.weekXp - week.prevWeekXp;
  const deltaText = delta === 0 ? 'Same as last week' : `${Math.abs(delta)} XP ${delta > 0 ? 'more' : 'less'} than last week`;
  const pick = pickContinue(languages, recent);
  const pickCard = pick && languageCards.find((c) => c.slug === pick.slug);
  const last7 = series.slice(-7);

  return (
    <>
      <div className="stat-row">
        <StatCard icon="bolt" label="XP this week" value={week.weekXp}>
          <MiniBars values={last7.map((d) => d.xp)} label="XP for each of the last 7 days" />
        </StatCard>
        <StatCard icon="book" label="Lessons completed" value={stats.completedTotal}>
          <Sparkline values={series.map((d) => d.lessons)} label="Lessons completed per day, last 14 days" />
        </StatCard>
        <StatCard icon="trophy" label="Quizzes passed" value={`${stats.quizzes.passed}/${stats.quizzes.total}`} note={`${stats.quizzes.perfect} perfect · ${stats.quizzes.taken} taken`} />
        <StatCard icon="flame" label="Day streak" value={stats.streak} tone="green" note={`Best: ${plural(stats.longestStreak, 'day')}`}>
          <span className="live-chip">{stats.activeToday ? 'Done today' : 'Keep it going'}</span>
        </StatCard>
      </div>

      <div className="mid-row">
        <section className="card span-2" aria-labelledby="xp-title">
          <div className="card-head">
            <h2 id="xp-title">XP progress</h2>
            <span className="status-chip">{goalStatus}</span>
          </div>
          <div className="mini-chips">
            <div>
              <small>Level</small>
              <strong>{stats.level}</strong>
              <span>
                {stats.xpIntoLevel}/{stats.xpForNext} XP
              </span>
            </div>
            <div>
              <small>Total XP</small>
              <strong>{stats.xp}</strong>
              <span>{deltaText}</span>
            </div>
          </div>
          <AreaChart series={series} />
        </section>

        <section className="card goal" aria-labelledby="goal-title">
          <h2 id="goal-title">Weekly goal</h2>
          <p className="muted">
            {week.weekXp} / {goal.target} XP
          </p>
          <div className="goal-donut">
            <Donut percent={goal.percent} size={132} stroke={14} color="var(--accent)" label={`Weekly goal ${goal.percent}%`}>
              <strong>{goal.percent}%</strong>
            </Donut>
          </div>
          <p className="muted center">{deltaText}</p>
        </section>

        <section className="card profile" aria-label="Your profile">
          <span className="avatar" aria-hidden="true">
            {user.name[0]?.toUpperCase()}
          </span>
          <h2>{user.name}</h2>
          <p className="muted">{user.email}</p>
          <dl className="profile-stats">
            <div>
              <dd>{stats.completedTotal}</dd>
              <dt>Lessons</dt>
            </div>
            <div>
              <dd>{stats.quizzes.passed}</dd>
              <dt>Quizzes</dt>
            </div>
            <div>
              <dd>{stats.streak}</dd>
              <dt>Streak</dt>
            </div>
          </dl>
        </section>
      </div>

      <div className="bottom-row">
        <section className="card continue span-2" aria-labelledby="continue-title" style={{ '--lang': pick?.color ?? 'var(--accent)' }}>
          <div className="continue-text">
            <h2 id="continue-title">{pick ? 'Continue learning' : 'All lessons done'}</h2>
            {pick ? (
              <>
                <p className="muted">
                  Pick up where you left off in {pick.name}: <strong>{pick.nextTopic.title}</strong>. You finished {pick.completed} of {plural(pick.total, 'lesson')} there.
                </p>
                <Link className="btn-dash primary" to={`/learn/${pick.slug}/${pick.nextTopic.slug}`}>
                  Continue
                </Link>
              </>
            ) : (
              <>
                <p className="muted">You completed every lesson. Take the quizzes to test yourself, or revisit a topic you liked.</p>
                <Link className="btn-dash primary" to="/languages">
                  Browse languages
                </Link>
              </>
            )}
          </div>
          <div className="continue-art" aria-hidden="true">
            <span className="stack s3" />
            <span className="stack s2" />
            <span className="stack s1">{pickCard?.image ? <img src={pickCard.image} alt="" /> : pick?.name.slice(0, 2)}</span>
          </div>
        </section>

        <section className="card recent" aria-labelledby="recent-title">
          <div className="card-head">
            <h2 id="recent-title">Recent activity</h2>
          </div>
          {recent.length === 0 ? (
            <p className="muted">Nothing yet. Finish a lesson or take a quiz and it will show up here.</p>
          ) : (
            <ul>
              {recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className={r.type}>
                  <div>
                    <strong>{r.title}</strong>
                    <small>
                      {r.type === 'quiz' ? `Quiz · ${r.detail}` : 'Lesson completed'} · {formatWhen(r.at)}
                    </small>
                  </div>
                  <span className={`xp-chip${r.xp > 0 ? '' : ' zero'}`}>{r.xp > 0 ? `+${r.xp} XP` : 'No XP'}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card badges-card" aria-labelledby="badges-title">
          <h2 id="badges-title">Badges</h2>
          <div className="goal-donut">
            <Donut percent={Math.round((earned / badges.length) * 100)} size={96} stroke={10} color="var(--accent)" label={`${earned} of ${badges.length} badges earned`}>
              <strong>
                {earned}/{badges.length}
              </strong>
            </Donut>
          </div>
          <a className="btn-dash primary" href="#badges">
            View badges
          </a>
        </section>
      </div>

      <h2 className="section-title">Your languages</h2>
      <div className="lang-grid-dash">
        {languages.map((l) => (
          <LanguageCard key={l.slug} lang={l} />
        ))}
      </div>

      <h2 className="section-title" id="badges">
        Badges <small>({earned}/{badges.length})</small>
      </h2>
      <ul className="badge-grid">
        {badges.map((b) => (
          <li key={b.id} className={`badge-card${b.earned ? ' is-earned' : ''}`}>
            <strong>{b.title}</strong>
            <span>{b.description}</span>
            <em>{b.earned ? 'Earned' : 'Locked'}</em>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { data, error, loading } = useApi(`/progress?day=${DAY}`);
  const firstName = user.name.split(' ')[0];

  const ctx = useMemo(
    () =>
      data
        ? { name: firstName, stats: data.stats, languages: data.languages, week: data.week, series: data.series, badges: data.badges, recent: data.recent }
        : null,
    [data, firstName]
  );

  return (
    <DashboardShell user={user} onLogout={logout} ctx={ctx} title={`Hey, ${firstName}!`} subtitle="Here is your learning activity">
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <p className="dash-error" role="alert">
          Could not load your dashboard. Please try again.
        </p>
      ) : (
        <DashboardBody data={data} user={user} />
      )}
    </DashboardShell>
  );
}
