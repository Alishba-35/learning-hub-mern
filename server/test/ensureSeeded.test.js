import test, { beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'ensure-seeded-test-secret-ensure-seeded-test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { ensureSeeded } = await import('../src/seed/seedData.js');
const { default: Topic } = await import('../src/models/Topic.js');
const { default: Quiz } = await import('../src/models/Quiz.js');
const { default: Language } = await import('../src/models/Language.js');
const { default: Video } = await import('../src/models/Video.js');

const dir = new URL('../src/seed/', import.meta.url);
const read = (sub) =>
  fs.readdirSync(new URL(sub, dir)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(new URL(sub + f, dir), 'utf8')));
const fullTopics = () => read('data/').map((l) => ({ _id: l.slug, n: l.topics.length }));
const fullQuizzes = () => read('quizzes/').map((q) => ({ _id: q.languageSlug, n: q.quizzes.length }));

let topicRows;
let writes;

beforeEach(() => {
  mock.restoreAll();
  writes = 0;
  topicRows = fullTopics();
  mock.method(Topic, 'aggregate', async () => topicRows);
  mock.method(Quiz, 'aggregate', async () => fullQuizzes());
  mock.method(Language, 'updateOne', async () => writes++);
  mock.method(Topic, 'bulkWrite', async () => ({}));
  mock.method(Topic, 'deleteMany', async () => ({ deletedCount: 0 }));
  mock.method(Quiz, 'bulkWrite', async () => ({}));
  mock.method(Quiz, 'deleteMany', async () => ({}));
  mock.method(Video, 'bulkWrite', async () => ({ upsertedCount: 0 }));
});

test('a fully seeded database is left alone', async () => {
  assert.equal(await ensureSeeded(), false);
  assert.equal(writes, 0);
});

test('a missing language (e.g. new languages never seeded) triggers seeding of everything', async () => {
  topicRows = topicRows.filter((r) => r._id !== 'react' && r._id !== 'c');
  assert.equal(await ensureSeeded(), true);
  assert.equal(writes, fullTopics().length, 'every language file is written');
});

test('a language with too few lessons also triggers seeding', async () => {
  topicRows = topicRows.map((r) => (r._id === 'python' ? { ...r, n: r.n - 1 } : r));
  assert.equal(await ensureSeeded(), true);
});
