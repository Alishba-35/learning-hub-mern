import Activity from '../models/Activity.js';
import Quiz from '../models/Quiz.js';
import QuizResult from '../models/QuizResult.js';
import { awardXp } from '../utils/award.js';
import { resolveDay } from '../utils/progress.js';
import { retryOnDuplicate } from '../utils/retry.js';
import { gradeQuiz, publicQuestion, xpForImprovement } from '../utils/quiz.js';

const SLUG = /^[a-z0-9-]{1,50}$/;
const notFound = (res) => res.status(404).json({ message: 'Quiz not found' });
const best = (r) => (r && r.attempts > 0 ? { score: r.bestScore, total: r.total, attempts: r.attempts } : null);

export async function listQuizzes(req, res) {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return notFound(res);

  const [quizzes, results] = await Promise.all([
    Quiz.find({ languageSlug: slug }).sort('order').select('slug title section description order questions.id -_id').lean(),
    QuizResult.find({ user: req.user.id, languageSlug: slug }).select('quizSlug bestScore total attempts -_id').lean(),
  ]);
  const bySlug = new Map(results.map((r) => [r.quizSlug, r]));
  res.json({
    quizzes: quizzes.map((q) => ({
      slug: q.slug,
      title: q.title,
      section: q.section,
      description: q.description,
      questionCount: q.questions.length,
      best: best(bySlug.get(q.slug)),
    })),
  });
}

export async function getQuiz(req, res) {
  const { slug, quizSlug } = req.params;
  if (!SLUG.test(slug) || !SLUG.test(quizSlug)) return notFound(res);

  const [quiz, result] = await Promise.all([
    Quiz.findOne({ languageSlug: slug, slug: quizSlug }).lean(),
    QuizResult.findOne({ user: req.user.id, languageSlug: slug, quizSlug }).select('bestScore total attempts -_id').lean(),
  ]);
  if (!quiz) return notFound(res);

  res.json({
    quiz: {
      slug: quiz.slug,
      title: quiz.title,
      section: quiz.section,
      description: quiz.description,
      questions: quiz.questions.map(publicQuestion),
    },
    best: best(result),
  });
}

export async function submitQuiz(req, res) {
  const { slug, quizSlug } = req.params;
  if (!SLUG.test(slug) || !SLUG.test(quizSlug)) return notFound(res);
  const userId = req.user.id;

  const quiz = await Quiz.findOne({ languageSlug: slug, slug: quizSlug }).lean();
  if (!quiz) return notFound(res);

  const graded = gradeQuiz(quiz, req.body.answers);

  // Atomic: pehle wala best wapas aata hai (update se pehle ka document), is liye do ek sath submit bhi XP double nahi dete
  const before = await retryOnDuplicate(() =>
    QuizResult.findOneAndUpdate(
      { user: userId, languageSlug: slug, quizSlug },
      {
        $inc: { attempts: 1 },
        $set: { lastScore: graded.score, total: graded.total, lastAt: new Date() },
        $max: { bestScore: graded.score },
      },
      { upsert: true, returnDocument: 'before' }
    )
  );
  const previousBest = before?.bestScore ?? 0;
  const xpGained = xpForImprovement(previousBest, graded.score);

  const day = resolveDay(req.body.day);
  const stats = await awardXp(userId, xpGained, day);
  await Activity.create({
    user: userId,
    type: 'quiz',
    languageSlug: slug,
    title: quiz.title,
    detail: `Score ${graded.score}/${graded.total}`,
    xp: xpGained,
    day,
  }).catch((err) => console.error('activity log failed:', err.message));
  res.json({ ...graded, xpGained, bestScore: Math.max(previousBest, graded.score), previousBest, stats });
}
