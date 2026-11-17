import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHUNK_SIZE, chunkCountFor, expectedChunkLength, looksLikeVideo, parseRange, parseYouTubeId, streamPath, verifyStreamLink,
} from '../src/utils/video.js';
import { createVideoSchema, startUploadSchema } from '../src/validators/videoSchemas.js';

const ID = 'dQw4w9WgXcQ';

test('parseYouTubeId understands every common link shape', () => {
  const ok = [
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=42s`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtu.be/${ID}?si=abc`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/embed/${ID}?si=abc`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `youtube.com/watch?v=${ID}`,
    `  ${ID}  `,
  ];
  for (const link of ok) assert.equal(parseYouTubeId(link), ID, link);
});

test('parseYouTubeId rejects anything that is not a YouTube video', () => {
  const bad = [
    '',
    null,
    undefined,
    'hello',
    'https://evil.com/watch?v=' + ID,
    `https://youtube.com.evil.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=short`,
    `https://www.youtube.com/watch?v=${ID}x`,
    `javascript:alert(1)`,
    `https://www.youtube.com/channel/${ID}`,
    `https://www.youtube.com/watch`,
    `ftp://youtu.be/${ID}`,
  ];
  for (const link of bad) assert.equal(parseYouTubeId(link), null, String(link));
});

test('chunk maths: every part is CHUNK_SIZE except the last', () => {
  const size = CHUNK_SIZE * 2 + 10;
  assert.equal(chunkCountFor(size), 3);
  assert.equal(chunkCountFor(CHUNK_SIZE), 1);
  assert.deepEqual([0, 1, 2].map((i) => expectedChunkLength(size, i)), [CHUNK_SIZE, CHUNK_SIZE, 10]);
});

test('looksLikeVideo checks real file bytes, not names', () => {
  const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(8)]);
  const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(16)]);
  assert.ok(looksLikeVideo(mp4));
  assert.ok(looksLikeVideo(webm));
  assert.ok(!looksLikeVideo(Buffer.from('MZ\x90\x00 this is an exe, not a video')));
  assert.ok(!looksLikeVideo(Buffer.alloc(4)));
  assert.ok(!looksLikeVideo(null));
});

test('stream links verify only for the right video, unexpired and untampered', () => {
  const secret = 'x'.repeat(40);
  const now = 1_700_000_000_000;
  const q = new URL(streamPath('a'.repeat(24), secret, now), 'http://x').searchParams;
  const ok = (id, exp, sig, at = now) => verifyStreamLink(id, exp, sig, secret, at);
  assert.ok(ok('a'.repeat(24), q.get('exp'), q.get('sig')));
  assert.ok(!ok('b'.repeat(24), q.get('exp'), q.get('sig')), 'other video');
  assert.ok(!ok('a'.repeat(24), Number(q.get('exp')) + 1, q.get('sig')), 'changed expiry');
  assert.ok(!ok('a'.repeat(24), q.get('exp'), 'f'.repeat(64)), 'wrong signature');
  assert.ok(!ok('a'.repeat(24), q.get('exp'), 'short'), 'malformed signature');
  assert.ok(!ok('a'.repeat(24), q.get('exp'), q.get('sig'), now + 7 * 3600 * 1000), 'expired');
  assert.ok(!verifyStreamLink('a'.repeat(24), q.get('exp'), q.get('sig'), 'y'.repeat(40), now), 'other secret');
});

test('parseRange handles open, closed, suffix and bad ranges', () => {
  assert.equal(parseRange(undefined, 100), null);
  assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
  assert.deepEqual(parseRange('bytes=10-', 100), { start: 10, end: 99 });
  assert.deepEqual(parseRange('bytes=90-500', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRange('bytes=-20', 100), { start: 80, end: 99 });
  for (const bad of ['bytes=100-', 'bytes=5-2', 'bytes=-', 'bytes=-0', 'items=0-1', 'bytes=0-1,5-6', 'junk']) {
    assert.equal(parseRange(bad, 100), 'invalid', bad);
  }
});

test('createVideoSchema: a YouTube video needs a valid link and a real title', () => {
  const good = createVideoSchema.safeParse({ source: 'youtube', title: '  CSS in 60s ', youtubeUrl: `https://youtu.be/${ID}` });
  assert.ok(good.success);
  assert.equal(good.data.title, 'CSS in 60s');
  assert.equal(good.data.description, '');
  assert.equal(good.data.languageSlug, '');
  for (const bad of [
    { source: 'youtube', title: 'ab', youtubeUrl: `https://youtu.be/${ID}` },
    { source: 'youtube', title: 'Fine title', youtubeUrl: 'https://example.com' },
    { source: 'youtube', title: 'x'.repeat(101), youtubeUrl: ID },
    { source: 'youtube', title: 'Fine title', youtubeUrl: ID, languageSlug: 'Not A Slug!' },
    { source: 'zip', title: 'Fine title' },
    { title: 'Fine title', youtubeUrl: ID },
  ]) {
    assert.ok(!createVideoSchema.safeParse(bad).success, JSON.stringify(bad));
  }
});

test('startUploadSchema: only real video types and a sensible size', () => {
  const ok = { title: 'My reel', size: 5_000_000, mimeType: 'video/mp4' };
  assert.ok(startUploadSchema.safeParse(ok).success);
  assert.ok(startUploadSchema.safeParse({ ...ok, mimeType: 'video/webm' }).success);
  for (const bad of [
    { ...ok, mimeType: 'application/x-msdownload' },
    { ...ok, mimeType: 'video/x-flv' },
    { ...ok, size: 10 },
    { ...ok, size: 1.5 },
    { ...ok, size: '5000000' },
    { ...ok, title: 'x' },
  ]) {
    assert.ok(!startUploadSchema.safeParse(bad).success, JSON.stringify(bad));
  }
});
