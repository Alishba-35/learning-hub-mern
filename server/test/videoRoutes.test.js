// Video API ke routes ko bina MongoDB ke test karta hai: models mock hain, baqi sab (Express, JWT, roles,
// validation, rate limits, upload checks) asli hai.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'video-route-test-secret-video-route-test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.CLOUDINARY_CLOUD_NAME = 'democloud';
process.env.CLOUDINARY_API_KEY = '123456';
process.env.CLOUDINARY_API_SECRET = 'cloud-secret-value';

const { default: app } = await import('../src/app.js');
const { default: Video } = await import('../src/models/Video.js');
const { default: Language } = await import('../src/models/Language.js');
const { default: User } = await import('../src/models/User.js');

const OID = (n) => String(n).padStart(24, '0');
const token = (id, role) => jwt.sign({ sub: id, role }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: '5m' });
const STUDENT = { id: OID(1), token: token(OID(1), 'student') };
const OTHER = { id: OID(2), token: token(OID(2), 'student') };
const TEACHER = { id: OID(3), token: token(OID(3), 'teacher') };

let server;
let base;
let created;
let rows;
let fetchCalls;

before(() => {
  server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const chain = (result) => {
  const c = { sort: () => c, skip: () => c, limit: () => c, select: () => c, lean: async () => result };
  return c;
};

beforeEach(() => {
  mock.restoreAll();
  created = [];
  rows = [];
  fetchCalls = [];
  mock.method(Video, 'find', () => chain(rows));
  mock.method(Video, 'countDocuments', async () => rows.length);
  mock.method(Video, 'create', async (doc) => {
    created.push(doc);
    const saved = { ...doc, _id: OID(99), description: doc.description ?? '', createdAt: new Date('2026-01-01') };
    return { ...saved, toObject: () => saved };
  });
  mock.method(Language, 'exists', async ({ slug }) => (['css', 'javascript'].includes(slug) ? { _id: 1 } : null));
  mock.method(User, 'findById', () => chain({ name: 'Sara' }));
  mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).startsWith('http://127.0.0.1')) return realFetch(url, init);
    fetchCalls.push({ url: String(url), init });
    return { ok: true };
  });
});

const realFetch = globalThis.fetch;
async function api(method, path, { as, body } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await realFetch(base + path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

const yt = { source: 'youtube', title: 'CSS in 60s', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' };
const stored = (over = {}) => ({
  _id: OID(50), title: 'Stored', description: '', languageSlug: '', source: 'youtube', youtubeId: 'dQw4w9WgXcQ',
  status: 'approved', uploaderName: 'Admin', uploadedBy: OID(1), createdAt: new Date('2026-01-01'), ...over,
});

test('every video route needs a login', async () => {
  for (const [m, p] of [['GET', '/api/videos'], ['GET', '/api/videos/config'], ['GET', '/api/videos/mine'], ['POST', '/api/videos'], ['POST', '/api/videos/upload-signature'], ['DELETE', `/api/videos/${OID(5)}`]]) {
    assert.equal((await api(m, p)).status, 401, `${m} ${p}`);
  }
});

test('config tells the page what this user may do', async () => {
  assert.deepEqual((await api('GET', '/api/videos/config', { as: STUDENT })).data, { uploadEnabled: true, maxMb: 50, canReview: false });
  assert.equal((await api('GET', '/api/videos/config', { as: TEACHER })).data.canReview, true);
});

test('list returns approved videos safely shaped, with paging info', async () => {
  rows = [stored({ passwordHash: 'x', publicId: 'secret/id' })];
  const r = await api('GET', '/api/videos?page=2&language=css', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data), ['videos', 'page', 'pages', 'total']);
  assert.equal(r.data.page, 2);
  const v = r.data.videos[0];
  assert.equal(v.id, OID(50));
  assert.equal(v.canDelete, true, 'owner can delete');
  assert.ok(!('publicId' in v) && !('uploadedBy' in v) && !('passwordHash' in v), 'no internal fields leak');
  assert.equal((await api('GET', '/api/videos?language=Bad!', { as: STUDENT })).status, 400);
});

test('a student video waits for approval, a teacher video is live at once', async () => {
  const s = await api('POST', '/api/videos', { as: STUDENT, body: yt });
  assert.equal(s.status, 201);
  assert.equal(created[0].status, 'pending');
  assert.equal(created[0].youtubeId, 'dQw4w9WgXcQ');
  assert.equal(created[0].uploadedBy, STUDENT.id);
  assert.equal(created[0].uploaderName, 'Sara');
  assert.equal(s.data.video.status, 'pending');

  await api('POST', '/api/videos', { as: TEACHER, body: { ...yt, languageSlug: 'css' } });
  assert.equal(created[1].status, 'approved');
  assert.equal(created[1].languageSlug, 'css');
});

test('bad input is rejected before anything is saved', async () => {
  for (const body of [
    { ...yt, youtubeUrl: 'https://example.com/x' },
    { ...yt, title: 'x' },
    { ...yt, languageSlug: 'cobol' },
    { source: 'upload', title: 'Reel', fileUrl: 'https://evil.com/a.mp4', publicId: 'learning-hub/shorts/a' },
    { source: 'upload', title: 'Reel', fileUrl: 'https://res.cloudinary.com/othercloud/video/upload/learning-hub/shorts/a.mp4', publicId: 'learning-hub/shorts/a' },
    { source: 'upload', title: 'Reel', fileUrl: 'https://res.cloudinary.com/democloud/video/upload/private/a.mp4', publicId: 'private/a' },
    {},
  ]) {
    assert.equal((await api('POST', '/api/videos', { as: STUDENT, body })).status, 400, JSON.stringify(body));
  }
  assert.equal(created.length, 0);
});

test('an upload from our own Cloudinary folder is accepted', async () => {
  const body = {
    source: 'upload', title: 'My reel',
    fileUrl: 'https://res.cloudinary.com/democloud/video/upload/v1700000000/learning-hub/shorts/ab12_X.mp4',
    publicId: 'learning-hub/shorts/ab12_X',
  };
  const r = await api('POST', '/api/videos', { as: STUDENT, body });
  assert.equal(r.status, 201);
  assert.equal(created[0].fileUrl, body.fileUrl);
  assert.equal(created[0].youtubeId, undefined);
});

test('the same YouTube video cannot be added twice', async () => {
  Video.create.mock.restore();
  mock.method(Video, 'create', async () => { throw Object.assign(new Error('dup'), { code: 11000 }); });
  const r = await api('POST', '/api/videos', { as: STUDENT, body: yt });
  assert.equal(r.status, 409);
  assert.match(r.data.message, /already/);
});

test('upload signature is signed and never contains the secret', async () => {
  const r = await api('POST', '/api/videos/upload-signature', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.equal(r.data.cloudName, 'democloud');
  assert.equal(r.data.signature.length, 40);
  assert.ok(!JSON.stringify(r.data).includes('cloud-secret-value'));
});

test('only teachers and admins can see the review list and approve', async () => {
  assert.equal((await api('GET', '/api/videos/pending', { as: STUDENT })).status, 403);
  assert.equal((await api('PATCH', `/api/videos/${OID(50)}/approve`, { as: STUDENT })).status, 403);
  rows = [stored({ status: 'pending' })];
  assert.equal((await api('GET', '/api/videos/pending', { as: TEACHER })).data.videos.length, 1);

  mock.method(Video, 'findByIdAndUpdate', () => chain(stored()));
  const ok = await api('PATCH', `/api/videos/${OID(50)}/approve`, { as: TEACHER });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.video.status, 'approved');
  assert.equal((await api('PATCH', '/api/videos/not-an-id/approve', { as: TEACHER })).status, 404);
});

test('delete: owner or teacher only; uploaded files are removed from Cloudinary too', async () => {
  const doc = (over = {}) => ({ ...stored(over), deleted: false, async deleteOne() { this.deleted = true; } });
  let current = doc();
  mock.method(Video, 'findById', async () => current);

  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: OTHER })).status, 403, 'someone else');
  assert.equal(current.deleted, false);
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: STUDENT })).status, 204, 'owner');
  assert.equal(current.deleted, true);
  assert.equal(fetchCalls.length, 0, 'youtube video: nothing to remove from Cloudinary');

  current = doc({ source: 'upload', publicId: 'learning-hub/shorts/ab12', youtubeId: undefined });
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: TEACHER })).status, 204, 'teacher');
  await new Promise((r) => setImmediate(r));
  assert.equal(fetchCalls[0].url, 'https://api.cloudinary.com/v1_1/democloud/video/destroy');

  current = null;
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: TEACHER })).status, 404);
  assert.equal((await api('DELETE', '/api/videos/zzz', { as: TEACHER })).status, 404);
});
