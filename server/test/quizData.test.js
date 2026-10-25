import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (dir, file) => JSON.parse(fs.readFileSync(path.join(here, '../src/seed', dir, file), 'utf8'));
const lessons = Object.fromEntries(fs.readdirSync(path.join(here, '../src/seed/data')).map((f) => [f.replace('.json', ''), read('data', f)]));
const quizFiles = fs.readdirSync(path.join(here, '../src/seed/quizzes')).map((f) => read('quizzes', f));

test('every language has one checkpoint quiz per lesson section, in the same order', () => {
  assert.equal(quizFiles.length, Object.keys(lessons).length);
  for (const { languageSlug, quizzes } of quizFiles) {
    const sections = [...new Set(lessons[languageSlug].topics.map((t) => t.section))];
    assert.deepEqual(quizzes.map((q) => q.section), sections, languageSlug);
    assert.equal(new Set(quizzes.map((q) => q.slug)).size, quizzes.length, `${languageSlug}: duplicate quiz slug`);
    quizzes.forEach((q, i) => assert.equal(q.order, i + 1));
  }
  assert.equal(quizFiles.reduce((n, f) => n + f.quizzes.length, 0), 24);
});

test('every question is well formed and has an explanation', () => {
  const ids = new Set();
  let questions = 0;
  for (const { languageSlug, quizzes } of quizFiles) {
    for (const quiz of quizzes) {
      assert.ok(/^[a-z0-9-]+$/.test(quiz.slug));
      assert.equal(quiz.questions.length, 6, `${quiz.slug}: expected 6 questions`);
      for (const q of quiz.questions) {
        questions++;
        const key = `${languageSlug}/${q.id}`; // ids only have to be unique inside one language
        assert.ok(!ids.has(key), `duplicate id ${key}`);
        ids.add(key);
        assert.ok(q.prompt.trim() && q.explanation.trim(), `${q.id}: prompt/explanation`);
        if (q.type === 'choice') {
          assert.ok(q.options.length >= 2 && q.options.length <= 5, `${q.id}: option count`);
          assert.equal(new Set(q.options).size, q.options.length, `${q.id}: duplicate options`);
          assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < q.options.length, `${q.id}: correctIndex`);
          assert.ok(q.options.every((o) => o.trim()), `${q.id}: empty option`);
        } else {
          assert.equal(q.type, 'fill');
          assert.equal(q.code.split('____').length - 1, 1, `${q.id}: needs exactly one blank`);
          assert.ok(q.answers.length >= 1 && q.answers.every((a) => a.trim()), `${q.id}: answers`);
          assert.equal(typeof q.caseSensitive, 'boolean');
        }
      }
    }
  }
  assert.equal(questions, 144);
});

test('the quizzes include all three kinds: concept choice, code reading and fill-in-the-code', () => {
  const all = quizFiles.flatMap((f) => f.quizzes.flatMap((q) => q.questions));
  assert.ok(all.some((q) => q.type === 'choice' && !q.code), 'concept questions');
  assert.ok(all.some((q) => q.type === 'choice' && q.code), 'code reading questions');
  assert.ok(all.some((q) => q.type === 'fill'), 'fill-in questions');
});

test('correct answers are not always in the same position', () => {
  const positions = new Set(
    quizFiles.flatMap((f) => f.quizzes.flatMap((q) => q.questions)).filter((q) => q.type === 'choice').map((q) => q.correctIndex)
  );
  assert.ok(positions.size >= 3, `only positions ${[...positions]} are used`);
});
