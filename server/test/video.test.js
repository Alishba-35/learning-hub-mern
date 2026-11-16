import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ALLOWED_FORMATS, UPLOAD_FOLDER, buildUploadSignature, destroyUpload, isOwnUpload, parseYouTubeId, signParams } from '../src/utils/video.js';
import { createVideoSchema } from '../src/validators/videoSchemas.js';

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

test('signParams is the documented Cloudinary signature (sorted params + secret, sha1)', () => {
  const expected = crypto.createHash('sha1').update('folder=a&timestamp=1315060510' + 'secret').digest('hex');
  assert.equal(signParams({ timestamp: 1315060510, folder: 'a', skip: '', nope: undefined }, 'secret'), expected);
});

test('buildUploadSignature signs folder, formats and timestamp and never exposes the secret', () => {
  const cfg = { cloudName: 'demo', apiKey: '123', apiSecret: 'topsecret' };
  const sig = buildUploadSignature(cfg, 1_700_000_000_000);
  assert.equal(sig.timestamp, 1_700_000_000);
  assert.equal(sig.folder, UPLOAD_FOLDER);
  assert.equal(sig.allowedFormats, ALLOWED_FORMATS.join(','));
  assert.equal(sig.signature, signParams({ allowed_formats: sig.allowedFormats, folder: UPLOAD_FOLDER, timestamp: 1_700_000_000 }, 'topsecret'));
  assert.ok(!JSON.stringify(sig).includes('topsecret'));
});

test('isOwnUpload accepts only our cloud, our folder and our video formats', () => {
  const publicId = `${UPLOAD_FOLDER}/abc123_XYZ`;
  const url = (over = {}) => `https://res.cloudinary.com/${over.cloud ?? 'demo'}/video/upload/${over.v ?? 'v1700000000/'}${over.id ?? publicId}.${over.ext ?? 'mp4'}`;
  assert.ok(isOwnUpload({ fileUrl: url(), publicId }, 'demo'));
  assert.ok(isOwnUpload({ fileUrl: url({ v: '' }), publicId }, 'demo'));
  assert.ok(isOwnUpload({ fileUrl: url({ ext: 'webm' }), publicId }, 'demo'));
  assert.ok(!isOwnUpload({ fileUrl: url({ cloud: 'other' }), publicId }, 'demo'), 'other cloud');
  assert.ok(!isOwnUpload({ fileUrl: url({ ext: 'exe' }), publicId }, 'demo'), 'bad extension');
  assert.ok(!isOwnUpload({ fileUrl: url({ id: 'other/abc' }), publicId }, 'demo'), 'url and id differ');
  assert.ok(!isOwnUpload({ fileUrl: url({ id: 'secret/abc', }), publicId: 'secret/abc' }, 'demo'), 'wrong folder');
  assert.ok(!isOwnUpload({ fileUrl: `http://res.cloudinary.com/demo/video/upload/${publicId}.mp4`, publicId }, 'demo'), 'http');
  assert.ok(!isOwnUpload({ fileUrl: `https://evil.com/res.cloudinary.com/demo/video/upload/${publicId}.mp4`, publicId }, 'demo'), 'other host');
  assert.ok(!isOwnUpload({ fileUrl: url(), publicId: `${UPLOAD_FOLDER}/../x` }, 'demo'), 'path traversal');
  assert.ok(!isOwnUpload({ fileUrl: url(), publicId }, undefined), 'no cloud name');
});

test('destroyUpload posts a signed delete request and reports success', async () => {
  let call;
  const ok = await destroyUpload(`${UPLOAD_FOLDER}/x`, { cloudName: 'demo', apiKey: 'k', apiSecret: 's' }, async (url, init) => {
    call = { url, body: init.body };
    return { ok: true };
  });
  assert.equal(ok, true);
  assert.equal(call.url, 'https://api.cloudinary.com/v1_1/demo/video/destroy');
  assert.equal(call.body.get('public_id'), `${UPLOAD_FOLDER}/x`);
  assert.equal(call.body.get('api_key'), 'k');
  assert.ok(!call.body.toString().includes('=s&') && call.body.get('signature').length === 40);
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

test('createVideoSchema: an upload needs fileUrl and publicId', () => {
  assert.ok(createVideoSchema.safeParse({ source: 'upload', title: 'My reel', fileUrl: 'https://x', publicId: 'a/b' }).success);
  assert.ok(!createVideoSchema.safeParse({ source: 'upload', title: 'My reel', fileUrl: 'https://x' }).success);
});
