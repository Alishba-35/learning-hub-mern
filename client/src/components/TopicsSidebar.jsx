import { Fragment, useEffect } from 'react';
import { NavLink } from 'react-router-dom';

export default function TopicsSidebar({ open, onClose, language, topics, completed, quizzes = [] }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const doneCount = topics.filter((t) => completed.has(t.slug)).length;
  const percent = topics.length ? Math.round((doneCount / topics.length) * 100) : 0;

  return (
    <aside
      className={`topics-sidebar${open ? ' is-open' : ''}`}
      aria-label={`${language.name} topics`}
      aria-hidden={!open}
      inert={!open}
    >
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h5 className="m-0">TOPICS</h5>
        <button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={onClose} />
      </div>
      <p className="topics-language">{language.name}</p>
      <div
        className="progress-track"
        role="progressbar"
        aria-label={`${language.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <p className="topics-progress">
        {doneCount}/{topics.length} completed
      </p>
      <nav>
        {topics.map((t, i) => {
          const sectionEnds = t.section && t.section !== topics[i + 1]?.section;
          const quiz = sectionEnds ? quizzes.find((q) => q.section === t.section) : null;
          return (
            <Fragment key={t.slug}>
              {t.section && t.section !== topics[i - 1]?.section && <p className="topics-section">{t.section}</p>}
              <NavLink
                to={`/learn/${language.slug}/${t.slug}`}
                onClick={onClose}
                aria-label={completed.has(t.slug) ? `${t.title} (completed)` : undefined}
              >
                {t.title}
                {completed.has(t.slug) && (
                  <span className="topic-check" aria-hidden="true">
                    ✓
                  </span>
                )}
              </NavLink>
              {quiz && (
                <NavLink
                  className="topics-quiz"
                  to={`/learn/${language.slug}/quiz/${quiz.slug}`}
                  onClick={onClose}
                  aria-label={`${quiz.title} quiz${quiz.best ? `, best score ${quiz.best.score} of ${quiz.best.total}` : ''}`}
                >
                  Checkpoint quiz
                  {quiz.best && (
                    <span className="quiz-best" aria-hidden="true">
                      {quiz.best.score}/{quiz.best.total}
                    </span>
                  )}
                </NavLink>
              )}
            </Fragment>
          );
        })}
      </nav>
    </aside>
  );
}
