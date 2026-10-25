import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const empty = () => new Response(null, { status: 204 });

const user = { id: 'u1', name: 'Test', email: 't@example.com', role: 'student', purpose: '' };
const htmlLang = {
  language: { slug: 'html', name: 'HTML', description: '', color: '#000' },
  topics: [
    { slug: 'intro', title: 'Introduction', section: 'Start', order: 1 },
    { slug: 'tags', title: 'Basic Tags', section: 'Start', order: 2 },
    { slug: 'forms', title: 'Forms', section: 'More', order: 3 },
  ],
};
const lesson = (slug, title, prev = null, next = null) => ({
  topic: { slug, title, order: 1, blocks: [{ kind: 'html', html: `<h1>${title} lesson</h1>` }], styles: '' },
  prev,
  next,
});

const questions = [
  { id: 'start-1', type: 'choice', prompt: 'Which tag holds the visible page?', options: ['<head>', '<html>', '<body>'] },
  { id: 'start-2', type: 'choice', prompt: 'What does this print?', code: 'console.log(1 + 1)', codeLanguage: 'javascript', options: ['2', '11', 'NaN'] },
  { id: 'start-3', type: 'fill', prompt: 'Complete the heading tag.', code: '<____>Hello</h1>', codeLanguage: 'html' },
];
const quizBody = (best = null) => ({
  quiz: { slug: 'start', title: 'Start Checkpoint', section: 'Start', description: 'Covers: Introduction, Basic Tags.', questions },
  best,
});
const gradedResult = (over = {}) => ({
  score: 2,
  total: 3,
  percent: 67,
  passed: true,
  results: [
    { id: 'start-1', correct: true, yourAnswer: 2, correctAnswer: 2, explanation: 'body holds the visible content.' },
    { id: 'start-2', correct: false, yourAnswer: 1, correctAnswer: 0, explanation: '1 + 1 is the number 2, not text.' },
    { id: 'start-3', correct: true, yourAnswer: 'h1', correctAnswer: 'h1', explanation: 'h1 is the main heading.' },
  ],
  xpGained: 10,
  bestScore: 2,
  previousBest: 0,
  stats: { xp: 10, level: 1, xpIntoLevel: 10, xpForNext: 100, streak: 1, longestStreak: 1 },
  ...over,
});

let calls;
function setup(handlers = {}) {
  calls = [];
  const all = {
    'POST /api/auth/refresh': () => json(200, { accessToken: 'tok', user }),
    'GET /api/languages/html': () => json(200, htmlLang),
    'GET /api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', null, { slug: 'tags', title: 'Basic Tags' })),
    'GET /api/languages/html/topics/tags': () => json(200, lesson('tags', 'Basic Tags', { slug: 'intro', title: 'Introduction' }, { slug: 'forms', title: 'Forms' })),
    'GET /api/progress/html': () => json(200, { completed: [], lastTopic: '', drafts: {} }),
    'PUT /api/progress/html/last': () => empty(),
    'GET /api/quizzes/html': () =>
      json(200, { quizzes: [{ slug: 'start', title: 'Start Checkpoint', section: 'Start', description: '', questionCount: 3, best: null }] }),
    'GET /api/quizzes/html/start': () => json(200, quizBody()),
    ...handlers,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`;
      calls.push({ key, init });
      const handler = all[key] ?? Object.entries(all).find(([k]) => k.endsWith('*') && key.startsWith(k.slice(0, -1)))?.[1];
      return handler ? handler(init) : json(404, { message: 'Not found' });
    })
  );
}
const called = (re) => calls.filter((c) => re.test(c.key));
const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('quiz entry points', () => {
  it('the sidebar shows a checkpoint quiz link at the end of its section, with the best score', async () => {
    setup({
      'GET /api/quizzes/html': () =>
        json(200, { quizzes: [{ slug: 'start', title: 'Start Checkpoint', section: 'Start', description: '', questionCount: 3, best: { score: 2, total: 3, attempts: 1 } }] }),
    });
    const { container } = renderApp('/learn/html/intro');
    await screen.findByRole('heading', { name: 'Introduction lesson' });
    const sidebar = container.querySelector('.topics-sidebar');
    const link = await within(sidebar).findByRole('link', { name: /Start Checkpoint quiz, best score 2 of 3/, hidden: true });
    expect(link.getAttribute('href')).toBe('/learn/html/quiz/start');
    // it sits right after the last topic of its section ("Basic Tags"), before the next section starts
    const items = Array.from(sidebar.querySelectorAll('nav > *')).map((n) => n.textContent);
    expect(items.indexOf('Basic Tags')).toBe(items.findIndex((t) => t.startsWith('Checkpoint quiz')) - 1);
    expect(items.findIndex((t) => t === 'More')).toBeGreaterThan(items.findIndex((t) => t.startsWith('Checkpoint quiz')));
  });

  it('the last lesson of a section offers the quiz, a middle lesson does not', async () => {
    setup();
    renderApp('/learn/html/tags');
    const cta = await screen.findByRole('link', { name: 'Take the checkpoint quiz' });
    expect(cta.getAttribute('href')).toBe('/learn/html/quiz/start');
    cleanup();

    setup();
    renderApp('/learn/html/intro');
    await screen.findByRole('heading', { name: 'Introduction lesson' });
    expect(screen.queryByRole('link', { name: 'Take the checkpoint quiz' })).toBeNull();
  });
});

describe('taking a quiz', () => {
  it('shows an intro with the best score and starts on the first question', async () => {
    setup({ 'GET /api/quizzes/html/start': () => json(200, quizBody({ score: 2, total: 3, attempts: 2 })) });
    renderApp('/learn/html/quiz/start');
    expect(await screen.findByRole('heading', { name: 'Start Checkpoint' })).toBeTruthy();
    expect(screen.getByText('Covers: Introduction, Basic Tags.')).toBeTruthy();
    expect(screen.getByText('Your best: 2/3')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Start again' }));
    expect(screen.getByText('Question 1 of 3')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Which tag holds the visible page?' })).toBeTruthy();
  });

  it('walks through choice, code and fill questions, keeps answers, and submits only what was answered', async () => {
    setup({ 'POST /api/quizzes/html/start/submit': () => json(200, gradedResult()) });
    renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Start quiz' }));

    // Q1: choose "<body>" (index 2)
    expect(screen.getByRole('button', { name: 'Previous' }).disabled).toBe(true);
    await u.click(screen.getByRole('radio', { name: '<body>' }));
    await u.click(screen.getByRole('button', { name: 'Next' }));

    // Q2: code question, leave it unanswered
    expect(screen.getByText('console.log(1 + 1)')).toBeTruthy();
    await u.click(screen.getByRole('button', { name: 'Next' }));

    // Q3: fill
    expect(screen.getByText('Question 3 of 3')).toBeTruthy();
    expect(screen.getByText(/2 questions are unanswered/)).toBeTruthy(); // Q2 and Q3
    await u.type(screen.getByLabelText(/Your answer/), '  h1 ');
    expect(screen.getByText(/1 question is unanswered/)).toBeTruthy(); // only Q2 left

    // going back keeps the earlier answer
    await u.click(screen.getByRole('button', { name: 'Previous' }));
    await u.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('radio', { name: '<body>' }).checked).toBe(true);
    await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Next' }));

    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));
    await screen.findByText('Your score: 2/3 (67%)');

    const [post] = called(/^POST .*submit$/);
    const body = JSON.parse(post.init.body);
    expect(body.answers).toEqual({ 'start-1': 2, 'start-3': '  h1 ' }); // unanswered question is left out; fill is sent as typed
    expect(body.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('results show the score, XP, and for every question the verdict, correct answer and explanation', async () => {
    setup({ 'POST /api/quizzes/html/start/submit': () => json(200, gradedResult()) });
    const { container } = renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Start quiz' }));
    for (let i = 0; i < 2; i++) await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));

    expect(await screen.findByText('Your score: 2/3 (67%)')).toBeTruthy();
    expect(screen.getByText(/Great job, you passed/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('+10 XP');

    const items = within(container.querySelector('.quiz-review')).getAllByRole('listitem');
    expect(items.length).toBe(3);
    expect(items[0].textContent).toContain('Correct');
    expect(items[0].textContent).toContain('body holds the visible content.');
    // the wrong one shows what the user chose, the right answer (as text, not an index) and why
    expect(items[1].textContent).toContain('Incorrect');
    expect(items[1].textContent).toContain('Your answer: 11');
    expect(items[1].textContent).toContain('Correct answer: 2');
    expect(items[1].textContent).toContain('1 + 1 is the number 2, not text.');
    expect(items[2].textContent).toContain('Your answer: h1');
    expect(items[2].textContent).not.toContain('Correct answer');
  });

  it('explains why there is no XP when the score did not beat the best, and Try again starts fresh', async () => {
    setup({
      'GET /api/quizzes/html/start': () => json(200, quizBody({ score: 3, total: 3, attempts: 1 })),
      'POST /api/quizzes/html/start/submit': () => json(200, gradedResult({ xpGained: 0, bestScore: 3, previousBest: 3 })),
    });
    renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Start again' }));
    await u.click(screen.getByRole('radio', { name: '<head>' }));
    for (let i = 0; i < 2; i++) await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));

    expect((await screen.findByRole('status')).textContent).toContain('only when you beat your best score (3/3)');
    expect(screen.queryByText(/\+\d+ XP/)).toBeNull();

    await u.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByText('Question 1 of 3')).toBeTruthy();
    expect(screen.getByRole('radio', { name: '<head>' }).checked).toBe(false); // answers were cleared
  });

  it('a failed (non-passing) attempt encourages another try', async () => {
    setup({ 'POST /api/quizzes/html/start/submit': () => json(200, gradedResult({ score: 1, percent: 33, passed: false, xpGained: 5 })) });
    renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Start quiz' }));
    for (let i = 0; i < 2; i++) await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));
    expect(await screen.findByText(/Not there yet/)).toBeTruthy();
  });

  it('keeps the answers and shows an error when submitting fails', async () => {
    setup({ 'POST /api/quizzes/html/start/submit': () => json(500, { message: 'boom' }) });
    renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    await u.click(await screen.findByRole('button', { name: 'Start quiz' }));
    await u.click(screen.getByRole('radio', { name: '<body>' }));
    for (let i = 0; i < 2; i++) await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Could not submit');
    expect(screen.getByRole('button', { name: 'Submit quiz' }).disabled).toBe(false);
    await u.click(screen.getByRole('button', { name: 'Previous' }));
    await u.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('radio', { name: '<body>' }).checked).toBe(true);
  });

  it('updates the best score badge in the sidebar right after a submit', async () => {
    setup({ 'POST /api/quizzes/html/start/submit': () => json(200, gradedResult()) });
    const { container } = renderApp('/learn/html/quiz/start');
    const u = userEvent.setup();
    const sidebar = () => container.querySelector('.topics-sidebar');
    await u.click(await screen.findByRole('button', { name: 'Start quiz' }));
    expect(within(sidebar()).getByRole('link', { name: 'Start Checkpoint quiz', hidden: true })).toBeTruthy();
    for (let i = 0; i < 2; i++) await u.click(screen.getByRole('button', { name: 'Next' }));
    await u.click(screen.getByRole('button', { name: 'Submit quiz' }));
    await screen.findByText('Your score: 2/3 (67%)');
    expect(within(sidebar()).getByRole('link', { name: 'Start Checkpoint quiz, best score 2 of 3', hidden: true })).toBeTruthy();
  });

  it('shows Page not found for an unknown quiz', async () => {
    setup();
    renderApp('/learn/html/quiz/nope');
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });
});
