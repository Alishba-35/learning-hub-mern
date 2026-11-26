import Topic from '../models/Topic.js';
import { getCatalog } from '../utils/catalog.js';
import { neighbours } from '../utils/topicNav.js';

const SLUG = /^[a-z0-9-]{1,50}$/;

// Lessons kam badalte hain: browser 5 minute cache kar sakta hai (database door ho to bhi tez rehta hai)
const cache = (res) => res.set('Cache-Control', 'private, max-age=300');

export async function getLanguage(req, res) {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return res.status(404).json({ message: 'Language not found' });

  // Language aur uske topics ki list catalog cache se (database nahi)
  const catalog = await getCatalog();
  const l = catalog.languages.find((x) => x.slug === slug);
  if (!l) return res.status(404).json({ message: 'Language not found' });

  cache(res).json({ language: { slug: l.slug, name: l.name, description: l.description, color: l.color }, topics: catalog.topicsByLanguage.get(slug) ?? [] });
}

export async function getTopic(req, res) {
  const { slug, topic: topicSlug } = req.params;
  if (!SLUG.test(slug) || !SLUG.test(topicSlug)) {
    return res.status(404).json({ message: 'Lesson not found' });
  }

  // Sirf is lesson ka matn database se; pichla/agla lesson ki list catalog cache se
  const [topic, catalog] = await Promise.all([
    Topic.findOne({ languageSlug: slug, slug: topicSlug }).select('slug title section order blocks styles -_id').lean(),
    getCatalog(),
  ]);
  if (!topic) return res.status(404).json({ message: 'Lesson not found' });

  cache(res).json({ topic, ...neighbours(catalog.topicsByLanguage.get(slug) ?? [], topicSlug) });
}
