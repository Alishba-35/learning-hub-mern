import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Language from '../models/Language.js';
import Quiz from '../models/Quiz.js';
import Topic from '../models/Topic.js';
import Video from '../models/Video.js';
import { loadVideos, withVideos } from './videos.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const quizDir = path.join(here, 'quizzes');

// Lessons ko database mein daalta hai. Dobara chalana safe hai (update hota hai, duplicate nahi banta).
export async function seedAll(log = () => {}) {
  const videos = loadVideos();
  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort()) {
    const { topics: rawTopics, ...language } = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

    const topics = rawTopics.map((t) => withVideos(t, language.slug, videos));
    await Language.updateOne({ slug: language.slug }, { $set: language }, { upsert: true });
    await Topic.bulkWrite(
      topics.map((t) => ({
        updateOne: {
          filter: { languageSlug: language.slug, slug: t.slug },
          update: { $set: { ...t, languageSlug: language.slug } },
          upsert: true,
        },
      }))
    );
    const removed = await Topic.deleteMany({ languageSlug: language.slug, slug: { $nin: topics.map((t) => t.slug) } });
    log(`${language.name}: ${topics.length} topics saved (${removed.deletedCount} old removed)`);
  }

  for (const file of fs.existsSync(quizDir) ? fs.readdirSync(quizDir).filter((f) => f.endsWith('.json')).sort() : []) {
    const { languageSlug, quizzes } = JSON.parse(fs.readFileSync(path.join(quizDir, file), 'utf8'));
    await Quiz.bulkWrite(
      quizzes.map((quiz) => ({
        updateOne: {
          filter: { languageSlug, slug: quiz.slug },
          update: { $set: { ...quiz, languageSlug } },
          upsert: true,
        },
      }))
    );
    await Quiz.deleteMany({ languageSlug, slug: { $nin: quizzes.map((x) => x.slug) } });
    log(`${languageSlug}: ${quizzes.length} quizzes saved`);
  }

  await seedShorts(log);
}

// Starter YouTube videos (shorts.json). Sirf wohi add hote hain jo pehle se nahi hain; users ke videos ko kuch nahi hota.
export async function seedShorts(log = () => {}) {
  const file = path.join(here, 'shorts.json');
  const items = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : [];
  if (!items.length) return;
  const result = await Video.bulkWrite(
    items.map((v) => ({
      updateOne: {
        filter: { youtubeId: v.youtubeId },
        update: {
          $setOnInsert: { title: v.title, languageSlug: v.languageSlug ?? '', source: 'youtube', status: 'approved', uploadedBy: null, uploaderName: 'Admin' },
        },
        upsert: true,
      },
    }))
  );
  log(`Shorts: ${result.upsertedCount} new starter videos added (${items.length} in shorts.json)`);
}

// Lesson/quiz files ki ginti (slug -> kitne topics / quizzes). Database se compare karne ke liye.
function expectedCounts() {
  const topics = {};
  const quizzes = {};
  for (const f of fs.readdirSync(dataDir).filter((x) => x.endsWith('.json'))) {
    const { slug, topics: t } = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    topics[slug] = t.length;
  }
  if (fs.existsSync(quizDir)) {
    for (const f of fs.readdirSync(quizDir).filter((x) => x.endsWith('.json'))) {
      const { languageSlug, quizzes: q } = JSON.parse(fs.readFileSync(path.join(quizDir, f), 'utf8'));
      quizzes[languageSlug] = q.length;
    }
  }
  return { topics, quizzes };
}

const sameCounts = (want, rows) => {
  const have = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  return Object.keys(want).every((slug) => have[slug] === want[slug]);
};

// Server start par chalta hai: agar database mein koi language/lesson/quiz kam hai (jaise nayi languages ka zip lagaya
// magar `npm run seed` nahi chalaya) to khud seed kar deta hai. Sab poora ho to kuch nahi karta, is liye har start par tez.
export async function ensureSeeded(log = () => {}) {
  const want = expectedCounts();
  const [topicRows, quizRows] = await Promise.all([
    Topic.aggregate([{ $group: { _id: '$languageSlug', n: { $sum: 1 } } }]),
    Quiz.aggregate([{ $group: { _id: '$languageSlug', n: { $sum: 1 } } }]),
  ]);
  if (sameCounts(want.topics, topicRows) && sameCounts(want.quizzes, quizRows)) return false;
  log('Lessons missing or out of date in the database: seeding now...');
  await seedAll(log);
  return true;
}
