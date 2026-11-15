import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

// videos.json: { "java/intro": "dQw4w9WgXcQ", "sql/joins": ["id1", "id2"], "python/loops": "" }
// Khali ("" ya []) matlab abhi video nahi. Sirf 11 character wali YouTube ID chalti hai.
export function loadVideos(file = path.join(here, 'videos.json')) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

export const idsFor = (videos, languageSlug, topicSlug) =>
  [videos[`${languageSlug}/${topicSlug}`] ?? []].flat().filter(Boolean);

const player = (id, title) =>
  `<div class="video-embed"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${title}" ` +
  `allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen="" referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;

// Lesson mein "Watch the Video" block lagata hai (pehle block ya figure ke baad). Original topic ko change nahi karta.
export function withVideos(topic, languageSlug, videos) {
  const ids = idsFor(videos, languageSlug, topic.slug);
  if (!ids.length) return topic;
  for (const id of ids) if (!VIDEO_ID.test(id)) throw new Error(`${languageSlug}/${topic.slug}: invalid YouTube id "${id}"`);
  const title = `${topic.title} video`.replace(/"/g, '');
  const block = { kind: 'html', html: `<section class="lesson-video"><h3>Watch the Video</h3>${ids.map((id) => player(id, title)).join('')}</section>` };
  const figure = topic.blocks.findIndex((b) => b.kind === 'html' && b.html.includes('lesson-figure'));
  const at = figure >= 0 ? figure + 1 : 1;
  return { ...topic, blocks: [...topic.blocks.slice(0, at), block, ...topic.blocks.slice(at)] };
}
