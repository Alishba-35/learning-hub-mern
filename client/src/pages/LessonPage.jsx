import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { LessonContext } from '../context/lessonContext.js';
import { attachLessonScripts } from '../lessonScripts/index.js';
import LessonBody from '../components/lesson/LessonBody.jsx';
import Spinner from '../components/Spinner.jsx';
import NotFound from './NotFound.jsx';

function CompleteBar({ topicSlug, progress }) {
  const [busy, setBusy] = useState(false);
  const [reward, setReward] = useState(null);
  const [error, setError] = useState('');
  const done = progress.completed.has(topicSlug);

  if (!progress.available) return null;

  const onComplete = async () => {
    setBusy(true);
    setError('');
    try {
      setReward(await progress.complete(topicSlug));
    } catch {
      setError('Could not save your progress. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lesson-complete">
      {done ? (
        <span className="complete-done">Completed &#10003;</span>
      ) : (
        <button type="button" className="btn btn-success" onClick={onComplete} disabled={busy}>
          {busy ? 'Saving...' : 'Mark as complete'}
        </button>
      )}
      {reward?.xpGained > 0 && (
        <span className="xp-toast" role="status">
          +{reward.xpGained} XP &middot; Level {reward.stats.level} &middot; {reward.stats.streak}-day streak
        </span>
      )}
      {error && (
        <span className="text-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function LessonView({ slug, data, progress, userId, topics, quizzes }) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const { topic, prev, next } = data;
  const { available, touch, drafts, saveDraft } = progress;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [topic.slug]);

  useEffect(() => {
    if (available) touch(topic.slug); // "aakhri dekha hua lesson" yaad rakhne ke liye
  }, [available, touch, topic.slug]);

  useEffect(() => {
    if (!rootRef.current) return undefined;
    return attachLessonScripts(rootRef.current, `${slug}/${topic.slug}`, { navigate });
  }, [slug, topic.slug, navigate]);

  // Section ka aakhri lesson ho to us section ke quiz ka button dikhao
  const here = topics.find((t) => t.slug === topic.slug);
  const nextInList = topics[topics.findIndex((t) => t.slug === topic.slug) + 1];
  const sectionQuiz = here?.section && here.section !== nextInList?.section ? quizzes.find((q) => q.section === here.section) : null;

  const lessonContext = useMemo(
    () => ({ slug, topic: topic.slug, userId, drafts, saveDraft }),
    [slug, topic.slug, userId, drafts, saveDraft]
  );

  return (
    <div className="container" ref={rootRef}>
      {topic.styles && <style>{topic.styles}</style>}
      <LessonContext.Provider value={lessonContext}>
        <LessonBody blocks={topic.blocks} />
      </LessonContext.Provider>
      <CompleteBar topicSlug={topic.slug} progress={progress} />
      {sectionQuiz && (
        <div className="lesson-quiz-cta">
          <p>You finished the last lesson of &ldquo;{here.section}&rdquo;. Test yourself:</p>
          <Link className="btn btn-primary" to={`/learn/${slug}/quiz/${sectionQuiz.slug}`}>
            Take the checkpoint quiz
          </Link>
        </div>
      )}
      <nav className="lesson-nav" aria-label="Lesson navigation">
        {prev ? (
          <Link className="btn" to={`/learn/${slug}/${prev.slug}`}>
            &lt;= Previous
          </Link>
        ) : (
          <Link className="btn" to="/languages">
            &lt;= Back
          </Link>
        )}
        {next && (
          <Link className="btn ms-auto" to={`/learn/${slug}/${next.slug}`}>
            Next =&gt;
          </Link>
        )}
      </nav>
    </div>
  );
}

export default function LessonPage() {
  const { slug, topic: topicSlug } = useParams();
  const { language, topics, progress, userId, quizzes } = useOutletContext();
  const { data, error, loading } = useApi(`/languages/${slug}/topics/${topicSlug}`);

  useEffect(() => {
    if (data) document.title = `${data.topic.title} | ${language.name} | Learning Hub`;
  }, [data, language.name]);

  if (loading) return <Spinner />;
  if (error?.status === 404) return <NotFound />;
  if (error) return <p className="text-center py-5">Could not load this lesson. Please try again.</p>;

  return <LessonView key={topicSlug} slug={slug} data={data} progress={progress} userId={userId} topics={topics} quizzes={quizzes} />;
}
