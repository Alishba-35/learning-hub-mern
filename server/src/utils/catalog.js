import Language from '../models/Language.js';
import Quiz from '../models/Quiz.js';
import Topic from '../models/Topic.js';

// Lessons, languages aur quizzes sirf seed se badalte hain, runtime par nahi. Phir bhi har request par database se poori list
// parhna sab se bara kharch tha (load test mein ek dashboard request = 8 queries, jin mein 3 yehi thin). Is liye memory mein 5 minute cache.
// Ek hi waqt mein bohat saari requests aayen (cold start) to sab ek hi load ka intezar karti hain, alag alag nahi jatin.
const TTL_MS = 5 * 60 * 1000;
let cached = null;
let pending = null;
const quizCache = new Map();

async function load() {
  const [languages, topics, quizzes] = await Promise.all([
    Language.find().sort('order').select('slug name color description -_id').lean(),
    Topic.find().sort('order').select('languageSlug slug title section order -_id').lean(),
    Quiz.find().select('languageSlug slug -_id').lean(),
  ]);
  // topics `order` ke mutabiq sorted hain, is liye har language ke andar bhi wahi tarteeb rehti hai
  const topicsByLanguage = new Map();
  for (const t of topics) {
    if (!topicsByLanguage.has(t.languageSlug)) topicsByLanguage.set(t.languageSlug, []);
    topicsByLanguage.get(t.languageSlug).push({ slug: t.slug, title: t.title, section: t.section, order: t.order });
  }
  const titles = new Map([...topicsByLanguage].map(([lang, rows]) => [lang, new Map(rows.map((r) => [r.slug, r.title]))]));
  return { languages, topicsByLanguage, titles, quizzes };
}

// Wapas: { languages, topicsByLanguage: Map(slug -> [{slug,title,section,order}]), titles: Map(slug -> Map(topic -> title)), quizzes }
// Is data ko badalna nahi (sab requests mein mushtarka hai).
export async function getCatalog() {
  if (cached && cached.expires > Date.now()) return cached.data;
  pending ??= load()
    .then((data) => {
      cached = { data, expires: Date.now() + TTL_MS };
      return data;
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

// Ek poora quiz (sawalon ke jawab samet). 5 minute cache, sirf maujood quizzes ka (na milne wale quiz cache nahi hote).
export async function getQuizDoc(languageSlug, quizSlug) {
  const key = `${languageSlug}/${quizSlug}`;
  const hit = quizCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.quiz;
  const quiz = await Quiz.findOne({ languageSlug, slug: quizSlug }).lean();
  if (quiz) {
    if (quizCache.size > 500) quizCache.clear(); // kabhi be-hisaab na barhe
    quizCache.set(key, { quiz, expires: Date.now() + TTL_MS });
  }
  return quiz;
}

export function clearCatalog() {
  cached = null;
  pending = null;
  quizCache.clear();
}
