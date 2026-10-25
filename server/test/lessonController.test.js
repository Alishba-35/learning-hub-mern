import test, { mock, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import Language from '../src/models/Language.js';
import Topic from '../src/models/Topic.js';
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
  { slug: 'a', title: 'A', order: 1 },
  { slug: 'b', title: 'B', order: 2 },
  { slug: 'c', title: 'C', order: 3 },
];

afterEach(() => mock.restoreAll());

test('getLanguage returns the language with its ordered topics and caches the response', async () => {
  mock.method(Language, 'findOne', () => query(lang));
  mock.method(Topic, 'find', () => query(list));
  const res = fakeRes();
  await getLanguage({ params: { slug: 'html' } }, res);
  assert.deepEqual(res.body, { language: lang, topics: list });
  assert.match(res.headers['Cache-Control'], /private, max-age=\d+/);
});

test('getLanguage rejects bad slugs without touching the database', async () => {
  const find = mock.method(Language, 'findOne', () => query(lang));
  for (const slug of ['../etc', 'A B', 'x'.repeat(60), '{"$ne":1}']) {
    const res = fakeRes();
    await getLanguage({ params: { slug } }, res);
    assert.equal(res.statusCode, 404);
  }
  assert.equal(find.mock.callCount(), 0);
});

test('getLanguage returns 404 for an unknown language', async () => {
  mock.method(Language, 'findOne', () => query(null));
  mock.method(Topic, 'find', () => query([]));
  const res = fakeRes();
  await getLanguage({ params: { slug: 'fortran' } }, res);
  assert.equal(res.statusCode, 404);
});

test('getTopic returns the topic with previous and next', async () => {
  const topic = { slug: 'b', title: 'B', order: 2, blocks: [{ kind: 'html', html: '<p>x</p>' }], styles: '' };
  mock.method(Topic, 'findOne', () => query(topic));
  mock.method(Topic, 'find', () => query(list));
  const res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: 'b' } }, res);
  assert.deepEqual(res.body, { topic, prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
});

test('getTopic returns 404 for a missing topic and for bad slugs', async () => {
  mock.method(Topic, 'findOne', () => query(null));
  mock.method(Topic, 'find', () => query(list));
  let res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: 'zzz' } }, res);
  assert.equal(res.statusCode, 404);
  res = fakeRes();
  await getTopic({ params: { slug: 'html', topic: '../x' } }, res);
  assert.equal(res.statusCode, 404);
});
