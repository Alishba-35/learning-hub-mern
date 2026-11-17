// Video API ke routes ko bina MongoDB ke test karta hai: models mock hain, baqi sab (Express, JWT, roles,
// validation, rate limits, upload checks) asli hai.
import test, { after, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

process.env.MONGO_URI = 'mongodb://unused';
process.env.JWT_ACCESS_SECRET = 'video-route-test-secret-video-route-test-secret';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';

const { default: app } = await import('../src/app.js');
const { default: Video } = await import('../src/models/Video.js');
const { default: VideoChunk } = await import('../src/models/VideoChunk.js');
const { CHUNK_SIZE, streamPath } = await import('../src/utils/video.js');
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
  mock.method(Video, 'find', () => chain(rows));
  mock.method(Video, 'countDocuments', async () => rows.length);
  mock.method(Video, 'create', async (doc) => {
    created.push(doc);
    const saved = { ...doc, _id: OID(99), description: doc.description ?? '', createdAt: new Date('2026-01-01') };
    return { ...saved, toObject: () => saved };
  });
  mock.method(Language, 'exists', async ({ slug }) => (['css', 'javascript'].includes(slug) ? { _id: 1 } : null));
  mock.method(User, 'findById', () => chain({ name: 'Sara' }));
});

async function api(method, path, { as, body, raw, headers: extra } = {}) {
  const headers = { ...extra };
  if (as) headers.Authorization = `Bearer ${as.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined) });
  const text = await res.text();
  return { status: res.status, headers: res.headers, data: text && res.headers.get('content-type')?.includes('json') ? JSON.parse(text) : null, text };
}

const yt = { source: 'youtube', title: 'CSS in 60s', youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ' };
const stored = (over = {}) => ({
  _id: OID(50), title: 'Stored', description: '', languageSlug: '', source: 'youtube', youtubeId: 'dQw4w9WgXcQ',
  status: 'approved', uploaderName: 'Admin', uploadedBy: OID(1), createdAt: new Date('2026-01-01'), ...over,
});

test('every video route needs a login', async () => {
  for (const [m, p] of [['GET', '/api/videos'], ['GET', '/api/videos/config'], ['GET', '/api/videos/mine'], ['POST', '/api/videos'], ['POST', '/api/videos/uploads'], ['DELETE', `/api/videos/${OID(5)}`]]) {
    assert.equal((await api(m, p)).status, 401, `${m} ${p}`);
  }
});

test('config tells the page what this user may do', async () => {
  assert.deepEqual((await api('GET', '/api/videos/config', { as: STUDENT })).data, { uploadEnabled: true, maxMb: 25, canReview: false });
  assert.equal((await api('GET', '/api/videos/config', { as: TEACHER })).data.canReview, true);
});

test('list returns approved videos safely shaped, with paging info', async () => {
  rows = [stored({ passwordHash: 'x', chunkCount: 3 })];
  const r = await api('GET', '/api/videos?page=2&language=css', { as: STUDENT });
  assert.equal(r.status, 200);
  assert.deepEqual(Object.keys(r.data), ['videos', 'page', 'pages', 'total']);
  assert.equal(r.data.page, 2);
  const v = r.data.videos[0];
  assert.equal(v.id, OID(50));
  assert.equal(v.canDelete, true, 'owner can delete');
  assert.ok(!('chunkCount' in v) && !('uploadedBy' in v) && !('passwordHash' in v), 'no internal fields leak');
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
    {},
  ]) {
    assert.equal((await api('POST', '/api/videos', { as: STUDENT, body })).status, 400, JSON.stringify(body));
  }
  assert.equal(created.length, 0);
});

test('the same YouTube video cannot be added twice', async () => {
  Video.create.mock.restore();
  mock.method(Video, 'create', async () => { throw Object.assign(new Error('dup'), { code: 11000 }); });
  const r = await api('POST', '/api/videos', { as: STUDENT, body: yt });
  assert.equal(r.status, 409);
  assert.match(r.data.message, /already/);
});

const MP4 = (n) => Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(Math.max(n - 12, 0), 7)]);
const meta = { title: 'My reel', size: 5000, mimeType: 'video/mp4' };
const uploading = (over = {}) => ({
  ...stored({ source: 'upload', youtubeId: undefined, status: 'uploading', fileSize: 5000, mimeType: 'video/mp4', chunkCount: 1 }),
  async save() { this.saved = true; },
  toObject() { return { ...this }; },
  ...over,
});

test('starting an upload creates a hidden "uploading" video and enforces limits', async () => {
  mock.method(Video, 'find', () => chain([]));
  mock.method(Video, 'deleteMany', async () => ({}));
  mock.method(Video, 'aggregate', async () => [{ bytes: 0 }]);
  const r = await api('POST', '/api/videos/uploads', { as: STUDENT, body: meta });
  assert.equal(r.status, 201);
  assert.equal(r.data.chunkSize, CHUNK_SIZE);
  assert.equal(r.data.chunkCount, 1);
  assert.equal(created[0].status, 'uploading');
  assert.equal(created[0].uploadedBy, STUDENT.id);

  const big = await api('POST', '/api/videos/uploads', { as: STUDENT, body: { ...meta, size: 26 * 1024 * 1024 } });
  assert.equal(big.status, 413);
  const exe = await api('POST', '/api/videos/uploads', { as: STUDENT, body: { ...meta, mimeType: 'application/zip' } });
  assert.equal(exe.status, 400);
  const lang = await api('POST', '/api/videos/uploads', { as: STUDENT, body: { ...meta, languageSlug: 'cobol' } });
  assert.equal(lang.status, 400);
  assert.equal(created.length, 1);

  Video.aggregate.mock.restore();
  mock.method(Video, 'aggregate', async () => [{ bytes: 300 * 1024 * 1024 }]);
  assert.equal((await api('POST', '/api/videos/uploads', { as: STUDENT, body: meta })).status, 507, 'library full');
});

test('chunks: owner only, exact size, real video bytes, upserted', async () => {
  const writes = [];
  mock.method(VideoChunk, 'updateOne', async (...args) => writes.push(args));
  let current = uploading();
  mock.method(Video, 'findById', async () => current);
  const put = (as, index, buf) => api('PUT', `/api/videos/uploads/${OID(50)}/${index}`, { as, raw: buf, headers: { 'Content-Type': 'application/octet-stream' } });

  assert.equal((await put(STUDENT, 0, MP4(5000))).status, 204);
  assert.equal(writes.length, 1);
  assert.equal(writes[0][1].$set.data.length, 5000);
  assert.deepEqual(writes[0][2], { upsert: true });

  assert.equal((await put(OTHER, 0, MP4(5000))).status, 404, 'not your upload');
  assert.equal((await put(STUDENT, 0, MP4(4999))).status, 400, 'wrong length');
  assert.equal((await put(STUDENT, 1, MP4(5000))).status, 400, 'part number out of range');
  assert.equal((await put(STUDENT, 0, Buffer.alloc(5000, 65))).status, 400, 'not a video');
  assert.equal((await put(undefined, 0, MP4(5000))).status, 401);
  assert.equal(writes.length, 1);

  current = uploading({ status: 'pending' });
  assert.equal((await put(STUDENT, 0, MP4(5000))).status, 404, 'finished uploads are locked');
});

test('complete: needs every part, then student=pending and teacher=approved', async () => {
  let have = 0;
  mock.method(VideoChunk, 'countDocuments', async () => have);
  let current = uploading({ chunkCount: 2 });
  mock.method(Video, 'findById', async () => current);

  assert.equal((await api('POST', `/api/videos/uploads/${OID(50)}/complete`, { as: STUDENT })).status, 400);
  have = 2;
  const ok = await api('POST', `/api/videos/uploads/${OID(50)}/complete`, { as: STUDENT });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.video.status, 'pending');
  assert.match(ok.data.video.streamUrl, /^\/api\/videos\/\w+\/stream\?exp=\d+&sig=[a-f0-9]{64}$/);

  current = uploading({ uploadedBy: OID(3) });
  have = 1;
  assert.equal((await api('POST', `/api/videos/uploads/${OID(50)}/complete`, { as: TEACHER })).data.video.status, 'approved');
});

test('streaming: signed link required, Range gives 206 with exactly the right bytes', async () => {
  const size = CHUNK_SIZE + 100;
  const file = Buffer.alloc(size);
  for (let i = 0; i < size; i++) file[i] = i % 251;
  const parts = [file.subarray(0, CHUNK_SIZE), file.subarray(CHUNK_SIZE)];
  mock.method(Video, 'findById', () => chain({ source: 'upload', status: 'approved', fileSize: size, mimeType: 'video/mp4' }));
  mock.method(VideoChunk, 'findOne', ({ index }) => ({ select: async () => ({ data: Buffer.from(parts[index]) }) }));
  const url = streamPath(OID(50), process.env.JWT_ACCESS_SECRET);
  const get = async (path, headers) => {
    const res = await fetch(base + path, { headers });
    return { res, body: Buffer.from(await res.arrayBuffer()) };
  };

  assert.equal((await get(`/api/videos/${OID(50)}/stream`)).res.status, 404, 'no signature');
  assert.equal((await get(url.replace(/sig=./, 'sig=0'))).res.status, 404, 'bad signature');
  assert.equal((await get(url.replace(OID(50), OID(51)))).res.status, 404, 'link of another video');

  const all = await get(url);
  assert.equal(all.res.status, 200);
  assert.equal(all.res.headers.get('content-type'), 'video/mp4');
  assert.equal(all.res.headers.get('cross-origin-resource-policy'), 'cross-origin');
  assert.ok(all.body.equals(file), 'whole file identical');

  const mid = await get(url, { Range: `bytes=${CHUNK_SIZE - 10}-${CHUNK_SIZE + 9}` });
  assert.equal(mid.res.status, 206, 'range across two parts');
  assert.equal(mid.res.headers.get('content-range'), `bytes ${CHUNK_SIZE - 10}-${CHUNK_SIZE + 9}/${size}`);
  assert.ok(mid.body.equals(file.subarray(CHUNK_SIZE - 10, CHUNK_SIZE + 10)));

  const tail = await get(url, { Range: 'bytes=-50' });
  assert.ok(tail.body.equals(file.subarray(size - 50)));
  assert.equal((await get(url, { Range: `bytes=${size}-` })).res.status, 416);
});

test('an unfinished upload cannot be streamed', async () => {
  mock.method(Video, 'findById', () => chain({ source: 'upload', status: 'uploading', fileSize: 10, mimeType: 'video/mp4' }));
  const r = await fetch(base + streamPath(OID(50), process.env.JWT_ACCESS_SECRET));
  assert.equal(r.status, 404);
});

test('only teachers and admins can see the review list and approve', async () => {
  assert.equal((await api('GET', '/api/videos/pending', { as: STUDENT })).status, 403);
  assert.equal((await api('PATCH', `/api/videos/${OID(50)}/approve`, { as: STUDENT })).status, 403);
  rows = [stored({ status: 'pending' })];
  assert.equal((await api('GET', '/api/videos/pending', { as: TEACHER })).data.videos.length, 1);

  mock.method(Video, 'findOneAndUpdate', () => chain(stored()));
  const ok = await api('PATCH', `/api/videos/${OID(50)}/approve`, { as: TEACHER });
  assert.equal(ok.status, 200);
  assert.equal(ok.data.video.status, 'approved');
  assert.equal((await api('PATCH', '/api/videos/not-an-id/approve', { as: TEACHER })).status, 404);
});

test('delete: owner or teacher only; an uploaded file loses its parts too', async () => {
  const doc = (over = {}) => ({ ...stored(over), deleted: false, async deleteOne() { this.deleted = true; } });
  let current = doc();
  const removedParts = [];
  mock.method(Video, 'findById', async () => current);
  mock.method(VideoChunk, 'deleteMany', async (q) => removedParts.push(q));

  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: OTHER })).status, 403, 'someone else');
  assert.equal(current.deleted, false);
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: STUDENT })).status, 204, 'owner');
  assert.equal(current.deleted, true);
  assert.equal(removedParts.length, 0, 'youtube video has no parts');

  current = doc({ source: 'upload', youtubeId: undefined });
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: TEACHER })).status, 204, 'teacher');
  assert.equal(removedParts.length, 1);

  current = null;
  assert.equal((await api('DELETE', `/api/videos/${OID(50)}`, { as: TEACHER })).status, 404);
  assert.equal((await api('DELETE', '/api/videos/zzz', { as: TEACHER })).status, 404);
});
