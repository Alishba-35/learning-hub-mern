import test from 'node:test';
import assert from 'node:assert/strict';
import { gradeAnswer, gradeQuiz, publicQuestion, xpForImprovement } from '../src/utils/quiz.js';

const choice = { id: 'q1', type: 'choice', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'because c' };
const fill = { id: 'q2', type: 'fill', prompt: 'p', code: 'x = ____', answers: ['Foo', 'bar'], caseSensitive: true, explanation: 'because foo' };
const fillLoose = { ...fill, id: 'q3', caseSensitive: false, answers: ['h1'] };
const quiz = { questions: [choice, fill, fillLoose] };

test('choice questions need the exact index (a number, not a string)', () => {
  assert.equal(gradeAnswer(choice, 2), true);
  assert.equal(gradeAnswer(choice, 1), false);
  assert.equal(gradeAnswer(choice, '2'), false);
  assert.equal(gradeAnswer(choice, null), false);
  assert.equal(gradeAnswer(choice, undefined), false);
  assert.equal(gradeAnswer(choice, 2.0), true);
});

test('fill questions ignore extra spaces, and respect caseSensitive', () => {
  assert.equal(gradeAnswer(fill, '  Foo '), true);
  assert.equal(gradeAnswer(fill, 'bar'), true);
  assert.equal(gradeAnswer(fill, 'foo'), false); // case matters here
  assert.equal(gradeAnswer(fillLoose, ' H1 '), true); // not here
  assert.equal(gradeAnswer(fillLoose, 'h2'), false);
  assert.equal(gradeAnswer(fill, ''), false);
  assert.equal(gradeAnswer(fill, 3), false);
});

test('gradeQuiz counts unanswered and unknown ids as wrong and ignores extras', () => {
  const r = gradeQuiz(quiz, { q1: 2, q3: 'h1', nonsense: 5, __proto__: 'x' });
  assert.equal(r.score, 2);
  assert.equal(r.total, 3);
  assert.equal(r.percent, 67);
  assert.equal(r.passed, true);
  assert.deepEqual(r.results.map((x) => x.correct), [true, false, true]);
  assert.equal(r.results[1].yourAnswer, null);
  assert.equal(r.results[0].correctAnswer, 2);
  assert.equal(r.results[1].correctAnswer, 'Foo');
  assert.equal(r.results[0].explanation, 'because c');
});

test('gradeQuiz: nothing answered fails, everything right passes with 100%', () => {
  assert.deepEqual([gradeQuiz(quiz, {}).score, gradeQuiz(quiz, {}).passed], [0, false]);
  const perfect = gradeQuiz(quiz, { q1: 2, q2: 'Foo', q3: 'H1' });
  assert.equal(perfect.percent, 100);
  assert.equal(perfect.passed, true);
});

test('publicQuestion never contains the answer, accepted answers or the explanation', () => {
  for (const q of [choice, fill]) {
    const text = JSON.stringify(publicQuestion(q));
    for (const secret of ['correctIndex', 'answers', 'explanation', 'because', 'caseSensitive']) {
      assert.ok(!text.includes(secret), `${q.type} leaks "${secret}"`);
    }
  }
  assert.deepEqual(publicQuestion(choice).options, ['a', 'b', 'c', 'd']);
  assert.equal(publicQuestion(fill).code, 'x = ____');
});

test('XP is given only for improvement over the best score so far', () => {
  assert.equal(xpForImprovement(0, 4), 20);
  assert.equal(xpForImprovement(4, 4), 0);
  assert.equal(xpForImprovement(4, 3), 0);
  assert.equal(xpForImprovement(3, 6), 15);
});
