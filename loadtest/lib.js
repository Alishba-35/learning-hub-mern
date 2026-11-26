// Sab k6 scripts ka mushtarka hissa: nakli students ka ek "safar" (journey) jo asli student jaisa hai.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate } from 'k6/metrics';

export const BASE = __ENV.BASE_URL || 'http://localhost:5055';
const THINK = Number(__ENV.THINK ?? 1); // har qadam ke beech soochne ka waqt (second). Stress mein 0 karein.

const users = new SharedArray('users', () => JSON.parse(open('./data/users.json')).users.filter((u) => u.role === 'student'));
export const catalog = new SharedArray('catalog', () => JSON.parse(open('./data/catalog.json')).filter((l) => l.topics.length));
export const admin = new SharedArray('admin', () => JSON.parse(open('./data/users.json')).users.filter((u) => u.role === 'admin'));
export const password = JSON.parse(open('./data/users.json')).password;
export const loginEmails = new SharedArray('emails', () => JSON.parse(open('./data/users.json')).users.map((u) => u.email));

// Hum 429 (rate limit) ko "ghalti" nahi ginte: wo server ka bachao hai. Alag gin-te hain.
export const failures = new Rate('failures');
export const rateLimited = new Counter('rate_limited');

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const think = () => THINK > 0 && sleep(THINK * (0.5 + Math.random()));

// Har virtual user (VU) ka apna student, aur apna (nakli) IP, taake IP wale limiters sab ko ek na samjhein
export function session(vu = __VU) {
  const u = users[(vu - 1) % users.length];
  return { headers: { Authorization: `Bearer ${u.token}`, 'X-Forwarded-For': `10.${(vu >> 8) & 255}.${vu & 255}.${(vu % 200) + 1}`, 'Content-Type': 'application/json' } };
}

function call(method, path, name, s, body, expect = 200) {
  const res = http.request(method, `${BASE}${path}`, body === undefined ? null : JSON.stringify(body), { headers: s.headers, tags: { name } });
  if (res.status === 429) {
    rateLimited.add(1);
    return res;
  }
  const ok = check(res, { [`${name} is ${expect}`]: (r) => r.status === expect });
  failures.add(!ok);
  return res;
}

// Ek student ka tipical session: dashboard, lesson parhna, progress, kabhi quiz, kabhi search
export function studentJourney() {
  const s = session();
  const lang = pick(catalog);
  const topic = pick(lang.topics);

  call('GET', '/api/auth/me', 'me', s);
  call('GET', '/api/progress', 'progress overview', s);
  call('GET', '/api/announcements', 'announcements', s);
  think();

  call('GET', `/api/languages/${lang.slug}`, 'language', s);
  call('GET', `/api/progress/${lang.slug}`, 'language progress', s);
  think();

  call('GET', `/api/languages/${lang.slug}/topics/${topic}`, 'lesson', s);
  call('PUT', `/api/progress/${lang.slug}/last`, 'save last lesson', s, { topic }, 204);
  think();

  if (Math.random() < 0.4) {
    call('POST', `/api/progress/${lang.slug}/topics/${topic}/complete`, 'complete lesson', s, {});
    think();
  }
  if (Math.random() < 0.25 && lang.quizzes.length) {
    const quiz = pick(lang.quizzes);
    call('GET', `/api/quizzes/${lang.slug}`, 'quiz list', s);
    call('GET', `/api/quizzes/${lang.slug}/${quiz.slug}`, 'quiz', s);
    const answers = {};
    for (const id of quiz.questionIds) answers[id] = 0;
    call('POST', `/api/quizzes/${lang.slug}/${quiz.slug}/submit`, 'submit quiz', s, { answers });
    think();
  }
  if (Math.random() < 0.2) {
    call('GET', `/api/search?q=${pick(['loop', 'array', 'function', 'class', 'select', 'css'])}`, 'search', s);
    think();
  }
  if (Math.random() < 0.15) call('GET', '/api/videos', 'videos', s);
  think();
}

export const baseThresholds = {
  failures: ['rate<0.01'], // 1% se kam ghalti
  http_req_failed: ['rate<0.01'],
};
