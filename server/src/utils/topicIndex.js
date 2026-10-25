import Topic from '../models/Topic.js';

// Kaun se topics maujood hain (language -> Map slug -> title). 5 minute cache, taake har save par database na jana pare.
const TTL_MS = 5 * 60 * 1000;
const cache = new Map();

async function load(languageSlug) {
  const hit = cache.get(languageSlug);
  if (hit && hit.expires > Date.now()) return hit.titles;
  const rows = await Topic.find({ languageSlug }).select('slug title -_id').lean();
  const titles = new Map(rows.map((r) => [r.slug, r.title]));
  cache.set(languageSlug, { titles, expires: Date.now() + TTL_MS });
  return titles;
}

export async function topicTitle(languageSlug, topicSlug) {
  return (await load(languageSlug)).get(topicSlug) ?? null;
}

export const topicExists = async (languageSlug, topicSlug) => (await topicTitle(languageSlug, topicSlug)) !== null;

export const clearTopicCache = () => cache.clear();
