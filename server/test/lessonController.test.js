import test, { mock, afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Language from '../src/models/Language.js';
import Quiz from '../src/models/Quiz.js';
import Topic from '../src/models/Topic.js';
import { clearCatalog } from '../src/utils/catalog.js';
import { getLanguage, getTopic } from '../src/controllers/lessonController.js';

// Mongoose query chain ki nakal (database ke bagair test)
const query = (value) => ({ select: () => query(value), sort: () => query(value), lean: () => Promise.resolve(value) });
const fakeRes = () => ({
  headers: {},
  statusCode: 200,
  set(k, v) { this.headers[k] = v; return this; },
  status(c) { this.statusCode = c; return this; },
  json(b) { this.body = b; return this; },
});

const lang = { slug: 'html', name: 'HTML', description: 'd', color: '#000' };
const list = [
  { slug: 'a', title: 'A', section: 's', order: 1 },
  { slug: 'b', title: 'B', section: 's', order: 2 },
  { slug: 'c', title: 'C', section: 's', order: 3 },
];
// Catalog cache poore database se parhta hai (languages, topics, quizzes); topics par languageSlug hota hai
const withLang = (rows, languageSlug = 'html') => rows.map((r) => ({ languageSlug, ...r }));
const mockCatalog = ({ languages = [lang], topics = withLang(list) } = {}) => {
  mock.method(Language, 'find', () => query(languages));
  mock.method(Topic, 'find', () => query(topics));
  mock.method(Quiz, 'find', () => query([]));
};

beforeEach(() => clearCatalog());
afterEach(() => mock.restoreAll());

test('getLanguage returns the language with its ordered topics and caches the response', async () => {
  mockCatalog();
  const res = fakeRes();
  await getLanguage({ params: { slug: 'html' } }, res);
  assert.deepEqual(res.body, { language: lang, topics: list });
  assert.match(res.headers['Cache-Control'], /private, max-age=\d+/);
});

test('getLanguage rejects bad slugs without touching the database', async () => {
  const find = mock.method(Language, 'find', () => query([lang]));
  for (const slug of ['../etc', 'A B', 'x'.repeat(60), '{"$ne":1}']) {
    const res = fakeRes();
    await getLanguage({ params: { slug } }, res);
    assert.equal(res.statusCode, 404);
  }
  assert.equal(find.mock.callCount(), 0);
});

test('getLanguage returns 404 for an unknown language', async () => {
  mockCatalog();
  const res = fakeRes();
  await getLanguage({ params: { slug: 'fortran' } }, res);
  assert.equal(res.statusCode, 404);
});

test('getTopic returns the topic with previous and next', async () => {
  const topic = { slug: 'b', title: 'B', order: 2, blocks: [{ kind: 'html', html: '<p>x</p>' }], styles: '' };
  mock.method(Topic, 'findOne', () => query(topic));
  mockCatalog();
  const res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: 'b' } }, res);
  assert.deepEqual(res.body, { topic, prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
});

test('getTopic returns 404 for a missing topic and for bad slugs', async () => {
  mock.method(Topic, 'findOne', () => query(null));
  mockCatalog();
  let res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: 'zzz' } }, res);
  assert.equal(res.statusCode, 404);
  res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: '../x' } }, res);
  assert.equal(res.statusCode, 404);
});

test('the catalog is read from the database once, even for many requests at the same moment, and again after it is cleared', async () => {
  mockCatalog();
  const find = Topic.find;
  const results = await Promise.all(Array.from({ length: 20 }, () => {
    const res = fakeRes();
    return getLanguage({ params: { slug: 'html' } }, res).then(() => res.body.topics.length);
  }));
  assert.deepEqual(results, Array(20).fill(3));
  assert.equal(find.mock.callCount(), 1, '20 simultaneous requests share one load');
  await getLanguage({ params: { slug: 'html' } }, fakeRes());
  assert.equal(find.mock.callCount(), 1, 'later requests use the cache');
  clearCatalog();
  await getLanguage({ params: { slug: 'html' } }, fakeRes());
  assert.equal(find.mock.callCount(), 2);
});

test('a failed load is not cached: the next request tries again', async () => {
  let fail = true;
  const flaky = () => ({ select: flaky, sort: flaky, lean: () => (fail ? Promise.reject(new Error('db down')) : Promise.resolve([lang])) });
  mock.method(Language, 'find', flaky);
  mock.method(Topic, 'find', () => query(withLang(list)));
  mock.method(Quiz, 'find', () => query([]));
  await assert.rejects(() => getLanguage({ params: { slug: 'html' } }, fakeRes()));
  fail = false;
  const res = fakeRes();
  await getLanguage({ params: { slug: 'html' } }, res);
  assert.equal(res.body.language.slug, 'html');
});
