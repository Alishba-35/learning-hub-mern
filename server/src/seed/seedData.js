import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Language from '../models/Language.js';
import Quiz from '../models/Quiz.js';
import Topic from '../models/Topic.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(here, 'data');
const quizDir = path.join(here, 'quizzes');

// Lessons ko database mein daalta hai. Dobara chalana safe hai (update hota hai, duplicate nahi banta).
export async function seedAll(log = () => {}) {
  for (const file of fs.readdirSync(dataDir).filter((f) => f.endsWith('.json')).sort()) {
    const { topics, ...language } = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));

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
}
