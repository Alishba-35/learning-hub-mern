export const QUIZ_XP_PER_CORRECT = 5;
export const PASS_PERCENT = 60;

// Browser ko sawal bhejte waqt jawab aur explanation hata di jati hain (submit ke baad hi milte hain)
export function publicQuestion(q) {
  const out = { id: q.id, type: q.type, prompt: q.prompt };
  if (q.code) {
    out.code = q.code;
    out.codeLanguage = q.codeLanguage || '';
  }
  if (q.type === 'choice') out.options = q.options;
  return out;
}

const normalize = (value, caseSensitive) => {
  const text = String(value).trim().replace(/\s+/g, ' ');
  return caseSensitive ? text : text.toLowerCase();
};

export function gradeAnswer(q, answer) {
  if (answer === undefined || answer === null || answer === '') return false;
  if (q.type === 'choice') return Number.isInteger(answer) && answer === q.correctIndex;
  if (q.type === 'fill') {
    if (typeof answer !== 'string') return false;
    const given = normalize(answer, q.caseSensitive);
    return q.answers.some((a) => normalize(a, q.caseSensitive) === given);
  }
  return false;
}

export function gradeQuiz(quiz, answers) {
  const results = quiz.questions.map((q) => {
    const given = Object.hasOwn(answers, q.id) ? answers[q.id] : undefined;
    return {
      id: q.id,
      correct: gradeAnswer(q, given),
      yourAnswer: given ?? null,
      correctAnswer: q.type === 'choice' ? q.correctIndex : q.answers[0],
      explanation: q.explanation,
    };
  });
  const score = results.filter((r) => r.correct).length;
  const total = results.length;
  const percent = total ? Math.round((score / total) * 100) : 0;
  return { score, total, percent, passed: percent >= PASS_PERCENT, results };
}

// XP sirf behtar score par milta hai: dobara dene se XP farm nahi ho sakta
export const xpForImprovement = (previousBest, score) => Math.max(0, score - previousBest) * QUIZ_XP_PER_CORRECT;
