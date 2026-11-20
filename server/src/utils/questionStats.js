import QuestionStat from '../models/QuestionStat.js';

// Quiz ki pehli koshish ke natije se har sawal ka asked/wrong counter badhata hai
export function recordFirstAttempt(languageSlug, quizSlug, graded) {
  return QuestionStat.bulkWrite(
    graded.results.map((r) => ({
      updateOne: {
        filter: { languageSlug, quizSlug, questionId: r.id },
        update: { $inc: { asked: 1, wrong: r.correct ? 0 : 1 } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
}
