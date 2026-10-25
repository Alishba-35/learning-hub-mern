import Language from '../models/Language.js';
import Topic from '../models/Topic.js';
import { neighbours } from '../utils/topicNav.js';

const SLUG = /^[a-z0-9-]{1,50}$/;

// Lessons kam badalte hain: browser 5 minute cache kar sakta hai (database door ho to bhi tez rehta hai)
const cache = (res) => res.set('Cache-Control', 'private, max-age=300');

export async function getLanguage(req, res) {
  const { slug } = req.params;
  if (!SLUG.test(slug)) return res.status(404).json({ message: 'Language not found' });

  const [language, topics] = await Promise.all([
    Language.findOne({ slug }).select('slug name description color -_id').lean(),
    Topic.find({ languageSlug: slug }).sort('order').select('slug title section order -_id').lean(),
  ]);
  if (!language) return res.status(404).json({ message: 'Language not found' });

  cache(res).json({ language, topics });
}

export async function getTopic(req, res) {
  const { slug, topic: topicSlug } = req.params;
  if (!SLUG.test(slug) || !SLUG.test(topicSlug)) {
    return res.status(404).json({ message: 'Lesson not found' });
  }

  const [topic, all] = await Promise.all([
    Topic.findOne({ languageSlug: slug, slug: topicSlug }).select('slug title section order blocks styles -_id').lean(),
    Topic.find({ languageSlug: slug }).sort('order').select('slug title -_id').lean(),
  ]);
  if (!topic) return res.status(404).json({ message: 'Lesson not found' });

  cache(res).json({ topic, ...neighbours(all, topicSlug) });
}
