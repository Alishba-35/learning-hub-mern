import Language from '../models/Language.js';
import Topic from '../models/Topic.js';

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Dashboard ki search bar: language ke naam aur lesson ke title mein dhoondta hai
export async function search(req, res) {
  const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 40) : '';
  if (q.length < 2) return res.json({ languages: [], lessons: [] });
  const pattern = new RegExp(escapeRegex(q), 'i');

  const [allLanguages, topics] = await Promise.all([
    Language.find().sort('order').select('slug name -_id').lean(),
    Topic.find({ title: pattern }).sort('order').limit(8).select('languageSlug slug title section -_id').lean(),
  ]);
  const nameBySlug = new Map(allLanguages.map((l) => [l.slug, l.name]));
  res.json({
    languages: allLanguages.filter((l) => pattern.test(l.name) || pattern.test(l.slug)),
    lessons: topics.map((t) => ({ ...t, languageName: nameBySlug.get(t.languageSlug) ?? t.languageSlug })),
  });
}
