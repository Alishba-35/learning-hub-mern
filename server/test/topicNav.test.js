import test from 'node:test';
import assert from 'node:assert/strict';
import { neighbours } from '../src/utils/topicNav.js';

const topics = [
  { slug: 'a', title: 'A' },
  { slug: 'b', title: 'B' },
  { slug: 'c', title: 'C' },
];

test('middle topic has both neighbours', () => {
  assert.deepEqual(neighbours(topics, 'b'), { prev: { slug: 'a', title: 'A' }, next: { slug: 'c', title: 'C' } });
});

test('first topic has no previous, last has no next', () => {
  assert.equal(neighbours(topics, 'a').prev, null);
  assert.equal(neighbours(topics, 'c').next, null);
});

test('unknown slug or single topic gives no neighbours', () => {
  assert.deepEqual(neighbours(topics, 'zzz'), { prev: null, next: null });
  assert.deepEqual(neighbours([topics[0]], 'a'), { prev: null, next: null });
});
