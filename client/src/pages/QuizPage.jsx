import { useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { useApi } from '../hooks/useApi.js';
import { request } from '../services/api.js';
import { localDay } from '../utils/day.js';
import QuestionView from '../components/quiz/QuestionView.jsx';
import QuizResults from '../components/quiz/QuizResults.jsx';
import Spinner from '../components/Spinner.jsx';
import NotFound from './NotFound.jsx';

const hasAnswer = (v) => v !== undefined && v !== null && v !== '';

function QuizRunner({ slug, data, language, onRecorded }) {
  const { quiz, best } = data;
  const questions = quiz.questions;
  const [phase, setPhase] = useState('intro'); // intro | taking | result
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [attempts, setAttempts] = useState(best?.attempts ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const answered = questions.filter((q) => hasAnswer(answers[q.id])).length;
  const unanswered = questions.length - answered;
  const isLast = index === questions.length - 1;

  const start = () => {
    setAnswers({});
    setIndex(0);
    setResult(null);
    setError('');
    setPhase('taking');
  };

  const setAnswer = (id, value) =>
    setAnswers((prev) => {
      const next = { ...prev };
      if (hasAnswer(value)) next[id] = value;
      else delete next[id];
      return next;
    });

  const submit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await request(`/quizzes/${slug}/${quiz.slug}/submit`, {
        method: 'POST',
        body: { answers, day: localDay() },
      });
      setResult(res);
      setAttempts((n) => n + 1);
      onRecorded(quiz.slug, { score: res.bestScore, total: res.total, attempts: attempts + 1 });
      setPhase('result');
      window.scrollTo(0, 0);
    } catch {
      setError('Could not submit your answers. Please try again.'); // jawab mehfooz rehte hain
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container quiz">
      <p className="quiz-crumb">
        <Link to={`/learn/${slug}`}>{language.name}</Link> &rsaquo; {quiz.section}
      </p>
      <h1>{quiz.title}</h1>

      {phase === 'intro' && (
        <section>
          <p>{quiz.description}</p>
          <ul className="quiz-facts">
            <li>{questions.length} questions: multiple choice, code reading and fill in the code</li>
            <li>You see the correct answer and an explanation for every question after you submit</li>
            <li>5 XP for each correct answer. Retakes only give XP when you beat your best score</li>
          </ul>
          {best && (
            <p className="quiz-best-line">
              Your best: {best.score}/{best.total}
            </p>
          )}
          <button type="button" className="btn btn-primary" onClick={start}>
            {attempts > 0 ? 'Start again' : 'Start quiz'}
          </button>
        </section>
      )}

      {phase === 'taking' && (
        <section aria-label="Quiz questions">
          <p className="quiz-progress-text">
            Question {index + 1} of {questions.length}
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Quiz progress"
            aria-valuemin={0}
            aria-valuemax={questions.length}
            aria-valuenow={index + 1}
          >
            <div className="progress-fill" style={{ width: `${((index + 1) / questions.length) * 100}%` }} />
          </div>

          <QuestionView
            key={questions[index].id}
            question={questions[index]}
            value={answers[questions[index].id]}
            onChange={(value) => setAnswer(questions[index].id, value)}
          />

          {isLast && unanswered > 0 && (
            <p className="quiz-note" role="status">
              {unanswered} {unanswered === 1 ? 'question is' : 'questions are'} unanswered. They count as wrong.
            </p>
          )}
          {error && (
            <p className="text-danger" role="alert">
              {error}
            </p>
          )}

          <div className="quiz-actions">
            <button
              type="button"
              className="btn btn-outline-light"
              onClick={() => setIndex((i) => i - 1)}
              disabled={index === 0}
            >
              Previous
            </button>
            {isLast ? (
              <button type="button" className="btn btn-success" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit quiz'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={() => setIndex((i) => i + 1)}>
                Next
              </button>
            )}
          </div>
        </section>
      )}

      {phase === 'result' && <QuizResults slug={slug} quiz={quiz} result={result} onRetry={start} />}
    </div>
  );
}

export default function QuizPage() {
  const { slug, quizSlug } = useParams();
  const { language, recordQuiz } = useOutletContext();
  const { data, error, loading } = useApi(`/quizzes/${slug}/${quizSlug}`);

  if (loading) return <Spinner />;
  if (error?.status === 404) return <NotFound />;
  if (error) return <p className="text-center py-5">Could not load this quiz. Please try again.</p>;
  return <QuizRunner key={quizSlug} slug={slug} data={data} language={language} onRecorded={recordQuiz} />;
}
