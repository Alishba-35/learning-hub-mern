import { useCallback, useMemo, useState } from 'react';
import { Navigate, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';
import { useApi } from '../hooks/useApi.js';
import { useLessonProgress } from '../hooks/useLessonProgress.js';
import Navbar from './Navbar.jsx';
import Spinner from './Spinner.jsx';
import TopicsSidebar from './TopicsSidebar.jsx';
import NotFound from '../pages/NotFound.jsx';

const YEAR = new Date().getFullYear();

function LearnShell({ slug }) {
  const { user } = useAuth();
  const lang = useApi(`/languages/${slug}`);
  const progress = useLessonProgress(slug);
  const quizList = useApi(`/quizzes/${slug}`);
  const [quizBest, setQuizBest] = useState({});
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  // Quiz list lessons ko rokti nahi (aakhir mein aati hai). Naya score milte hi sidebar ka badge update hota hai.
  const recordQuiz = useCallback((quizSlug, best) => setQuizBest((m) => ({ ...m, [quizSlug]: best })), []);
  const quizzes = useMemo(
    () => (quizList.data?.quizzes ?? []).map((q) => ({ ...q, best: quizBest[q.slug] ?? q.best })),
    [quizList.data, quizBest]
  );

  const ready = !lang.loading && !progress.loading;
  const context = useMemo(
    () => (lang.data ? { ...lang.data, progress, userId: user.id, quizzes, recordQuiz } : null),
    [lang.data, progress, user.id, quizzes, recordQuiz]
  );

  let body;
  if (!ready) body = <Spinner />;
  else if (lang.error?.status === 404) body = <NotFound />;
  else if (lang.error) body = <p className="text-center py-5">Could not load this language. Please try again.</p>;
  else body = <Outlet context={context} />;

  return (
    <>
      <Navbar onToggleTopics={ready && lang.data ? toggle : undefined} />
      {ready && lang.data && (
        <TopicsSidebar
          open={open}
          onClose={close}
          language={lang.data.language}
          topics={lang.data.topics}
          completed={progress.completed}
          quizzes={quizzes}
        />
      )}
      <main className={`lesson lesson--${slug}`}>{body}</main>
      <footer className="app-footer text-center py-3">
        <p className="mb-0">&copy; {YEAR} Learning Hub. All Rights Reserved.</p>
      </footer>
    </>
  );
}

// /learn/:slug/... ke sab pages: navbar + topics sidebar + lesson. Language badalne par sab kuch naye sire se.
export default function LearnLayout() {
  const { slug } = useParams();
  return <LearnShell key={slug} slug={slug} />;
}

// /learn/html ko aakhri dekhe hue (ya pehle) topic par bhej do
export function FirstTopic() {
  const { language, topics, progress } = useOutletContext();
  if (!topics.length) return <p className="text-center py-5">No lessons yet.</p>;
  return <Navigate to={`/learn/${language.slug}/${progress.lastTopic || topics[0].slug}`} replace />;
}
