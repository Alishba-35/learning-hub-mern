import test from 'node:test';
import assert from 'node:assert/strict';
import { VIDEO_ID, idsFor, loadVideos, withVideos } from '../src/seed/videos.js';

const topic = { slug: 'intro', title: 'Intro', blocks: [{ kind: 'html', html: '<p>a</p>' }, { kind: 'demo', code: 'x', output: 'y' }] };

test('no video id means the topic is returned unchanged', () => {
  assert.equal(withVideos(topic, 'java', { 'java/intro': '' }), topic);
  assert.equal(withVideos(topic, 'java', {}), topic);
});

test('a valid id adds one player block after the first block and keeps the original untouched', () => {
  const out = withVideos(topic, 'java', { 'java/intro': 'dQw4w9WgXcQ' });
  assert.equal(out.blocks.length, 3);
  assert.match(out.blocks[1].html, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ/);
  assert.equal(topic.blocks.length, 2);
});

test('the player goes after the Visual Overview figure when there is one', () => {
  const t = { ...topic, blocks: [topic.blocks[0], { kind: 'html', html: '<figure class="lesson-figure"></figure>' }, topic.blocks[1]] };
  assert.match(withVideos(t, 'sql', { 'sql/intro': 'dQw4w9WgXcQ' }).blocks[2].html, /Watch the Video/);
});

test('several ids make several players, bad ids are rejected', () => {
  assert.equal(idsFor({ 'a/b': ['x', '', 'y'] }, 'a', 'b').length, 2);
  assert.throws(() => withVideos(topic, 'java', { 'java/intro': '<script>' }), /invalid YouTube id/);
  assert.ok(!VIDEO_ID.test('short'));
});

test('videos.json only holds valid or empty ids for real lessons', () => {
  for (const [key, value] of Object.entries(loadVideos())) {
    assert.match(key, /^[a-z0-9-]+\/[a-z0-9-]+$/);
    for (const id of [value].flat().filter(Boolean)) assert.match(id, VIDEO_ID, key);
  }
});
