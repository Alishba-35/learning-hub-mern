import { clearCatalog, getCatalog } from './catalog.js';

// Kaun se topics maujood hain (language -> topic -> title). Catalog ke 5 minute cache se, taake har save par database na jana pare.
export async function topicTitle(languageSlug, topicSlug) {
  return (await getCatalog()).titles.get(languageSlug)?.get(topicSlug) ?? null;
}

export const topicExists = async (languageSlug, topicSlug) => (await topicTitle(languageSlug, topicSlug)) !== null;

export const clearTopicCache = clearCatalog;
