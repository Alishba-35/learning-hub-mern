import { Link } from 'react-router-dom';

function answerText(question, answer) {
  if (answer === null || answer === undefined || answer === '') return null;
  return question.type === 'choice' ? question.options[answer] : String(answer);
}

export default function QuizResults({ slug, quiz, result, onRetry }) {
  const byId = new Map(result.results.map((r) => [r.id, r]));

  return (
    <section aria-labelledby="quiz-result-title">
      <h2 id="quiz-result-title" className="quiz-score">
        Your score: {result.score}/{result.total} ({result.percent}%)
      </h2>
      <p>
        {result.passed
          ? 'Great job, you passed this checkpoint!'
          : 'Not there yet. Read the explanations below and try again.'}
      </p>
      {result.xpGained > 0 ? (
        <p className="xp-toast" role="status">
          +{result.xpGained} XP &middot; Level {result.stats.level}
        </p>
      ) : (
        <p className="quiz-note" role="status">
          No extra XP this time. XP is given only when you beat your best score ({result.bestScore}/{result.total}).
        </p>
      )}

      <div className="quiz-actions">
        <button type="button" className="btn btn-primary" onClick={onRetry}>
          Try again
        </button>
        <Link className="btn btn-outline-light" to={`/learn/${slug}`}>
          Back to lessons
        </Link>
        <Link className="btn btn-outline-light" to="/dashboard">
          Dashboard
        </Link>
      </div>

      <h3 className="quiz-review-title">Review</h3>
      <ol className="quiz-review">
        {quiz.questions.map((q, i) => {
          const r = byId.get(q.id);
          const yours = answerText(q, r.yourAnswer);
          return (
            <li key={q.id} className={r.correct ? 'is-correct' : 'is-wrong'}>
              <p className="quiz-verdict">
                {r.correct ? 'Correct' : 'Incorrect'} <span>Question {i + 1}</span>
              </p>
              <p>{q.prompt}</p>
              {q.code && (
                <pre className="quiz-code">
                  <code>{q.code}</code>
                </pre>
              )}
              <p>
                Your answer: <strong className="quiz-pre">{yours ?? 'No answer'}</strong>
              </p>
              {!r.correct && (
                <p>
                  Correct answer: <strong className="quiz-pre">{answerText(q, r.correctAnswer)}</strong>
                </p>
              )}
              <p className="quiz-explain">{r.explanation}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
