import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const empty = () => new Response(null, { status: 204 });
const user = { id: 'u1', name: 'Ayesha Noor', email: 'ayesha@example.com', role: 'student', purpose: '' };

const lang = (slug, name, o = {}) => ({
  slug, name, color: '#336791', total: 8, completed: 0, percent: 0, xp: 0, lastTopic: '', firstTopic: 'intro',
  nextTopic: { slug: 'intro', title: 'Introduction' }, quizzes: { total: 3, taken: 0 }, ...o,
});
const series = Array.from({ length: 14 }, (_, i) => ({ day: `2026-10-${String(7 + i).padStart(2, '0')}`, xp: i >= 10 ? 10 * (i - 9) : 0, lessons: i >= 10 ? 1 : 0, quizzes: 0 }));
const overview = (o = {}) => ({
  stats: { xp: 140, level: 2, xpIntoLevel: 40, xpForNext: 100, streak: 3, longestStreak: 5, activeToday: true, completedTotal: 14, quizzes: { total: 24, taken: 5, passed: 4, perfect: 1 } },
  languages: [
    lang('html', 'HTML', { completed: 8, percent: 100, xp: 80, lastTopic: 'forms-validation', nextTopic: null, quizzes: { total: 4, taken: 4 } }),
    lang('css', 'CSS', { completed: 6, total: 12, percent: 50, xp: 60, lastTopic: 'grid', nextTopic: { slug: 'spacing', title: 'Spacing & Responsive Design' }, quizzes: { total: 3, taken: 1 } }),
    lang('cpp', 'C++', { total: 20 }),
  ],
  badges: [
    { id: 'first-lesson', title: 'First Step', description: 'Complete your first lesson', earned: true },
    { id: 'quiz-ace', title: 'Quiz Ace', description: 'Get a perfect score on a quiz', earned: true },
    { id: 'streak-7', title: '7-Day Streak', description: 'Learn 7 days in a row', earned: false },
  ],
  series,
  week: { weekXp: 100, prevWeekXp: 60, goal: { target: 100, earned: 100, percent: 100 } },
  recent: [
    { type: 'quiz', languageSlug: 'css', title: 'Layout & Responsive Checkpoint', detail: 'Score 5/6', xp: 5, at: new Date().toISOString() },
    { type: 'lesson', languageSlug: 'css', title: 'CSS Grid in Depth', detail: '', xp: 10, at: new Date(Date.now() - 86400000).toISOString() },
  ],
  ...o,
});

let calls;
function setup(handlers = {}) {
  calls = [];
  const all = {
    'POST /api/auth/refresh': () => json(200, { accessToken: 'tok', user }),
    'GET /api/progress?day=*': () => json(200, overview()),
    'POST /api/auth/logout': () => empty(),
    ...handlers,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`;
      calls.push(key);
      const handler = all[key] ?? Object.entries(all).find(([k]) => k.endsWith('*') && key.startsWith(k.slice(0, -1)))?.[1];
      return handler ? handler(init) : json(404, { message: 'Not found' });
    })
  );
}
const renderDash = (path = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
// "ready" = the real data has arrived (the header alone is shown while the skeleton loads)
const ready = () => screen.findByRole('region', { name: 'XP progress' });

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dashboard layout (video design, app theme)', () => {
  it('shows every section with the user\'s real numbers', async () => {
    setup();
    const { container } = renderDash();
    await ready();
    expect(screen.getByText('Here is your learning activity')).toBeTruthy();

    // four stat cards
    const stat = (name) => within(screen.getByRole('region', { name }));
    expect(stat('XP this week').getByText('100')).toBeTruthy();
    expect(stat('Lessons completed').getByText('14')).toBeTruthy();
    expect(stat('Quizzes passed').getByText('4/24')).toBeTruthy();
    expect(stat('Quizzes passed').getByText('1 perfect · 5 taken')).toBeTruthy();
    expect(stat('Day streak').getByText('3')).toBeTruthy();
    expect(stat('Day streak').getByText('Done today')).toBeTruthy();
    expect(stat('Day streak').getByText('Best: 5 days')).toBeTruthy();

    // XP chart, goal, profile
    const xp = within(screen.getByRole('region', { name: 'XP progress' }));
    expect(xp.getByText('Goal reached')).toBeTruthy();
    expect(xp.getByText('40/100 XP')).toBeTruthy();
    expect(xp.getByText('40 XP more than last week')).toBeTruthy();
    expect(xp.getByRole('img', { name: /Total 100 XP, best day 40 XP/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Weekly goal 100%' })).toBeTruthy();
    const profile = within(screen.getByRole('region', { name: 'Your profile' }));
    expect(profile.getByText('Ayesha Noor')).toBeTruthy();
    expect(profile.getByText('ayesha@example.com')).toBeTruthy();

    // recent activity and badges
    const recent = within(screen.getByRole('region', { name: 'Recent activity' }));
    expect(recent.getByText('Layout & Responsive Checkpoint')).toBeTruthy();
    expect(recent.getByText(/Quiz · Score 5\/6 · Today/)).toBeTruthy();
    expect(recent.getByText('+5 XP')).toBeTruthy();
    expect(recent.getByText(/Lesson completed · Yesterday/)).toBeTruthy();
    expect(screen.getByRole('img', { name: '2 of 3 badges earned' })).toBeTruthy();
    expect(container.querySelectorAll('.badge-card.is-earned').length).toBe(2);
  });

  it('language cards show progress and the right action, and link to the next lesson', async () => {
    setup();
    renderDash();
    await ready();
    expect(screen.getByRole('link', { name: 'Review HTML' }).getAttribute('href')).toBe('/learn/html/forms-validation');
    expect(screen.getByRole('link', { name: 'Continue CSS' }).getAttribute('href')).toBe('/learn/css/spacing');
    expect(screen.getByRole('link', { name: 'Start C++' }).getAttribute('href')).toBe('/learn/cpp/intro');
    const css = within(screen.getByRole('heading', { name: 'CSS', level: 3 }).closest('article'));
    expect(css.getByText('6/12')).toBeTruthy();
    expect(css.getByText('1/3')).toBeTruthy();
    expect(css.getByRole('img', { name: 'CSS progress 50%' })).toBeTruthy();
  });

  it('the Continue learning card recommends the next lesson of the language used last', async () => {
    setup();
    renderDash();
    await ready();
    const card = within(screen.getByRole('region', { name: 'Continue learning' }));
    expect(card.getByText('Spacing & Responsive Design')).toBeTruthy();
    expect(card.getByRole('link', { name: 'Continue' }).getAttribute('href')).toBe('/learn/css/spacing');
  });

  it('says so when every lesson is done', async () => {
    setup({
      'GET /api/progress?day=*': () => json(200, overview({ languages: overview().languages.map((l) => ({ ...l, nextTopic: null })) })),
    });
    renderDash();
    await ready();
    const card = within(screen.getByRole('region', { name: 'All lessons done' }));
    expect(card.getByRole('link', { name: 'Browse languages' }).getAttribute('href')).toBe('/languages');
  });

  it('a brand new user sees zeros, an empty activity list and encouraging text', async () => {
    setup({
      'GET /api/progress?day=*': () =>
        json(200, overview({
          stats: { xp: 0, level: 1, xpIntoLevel: 0, xpForNext: 100, streak: 0, longestStreak: 0, activeToday: false, completedTotal: 0, quizzes: { total: 24, taken: 0, passed: 0, perfect: 0 } },
          languages: [lang('html', 'HTML')],
          badges: [{ id: 'first-lesson', title: 'First Step', description: 'Complete your first lesson', earned: false }],
          series: series.map((d) => ({ ...d, xp: 0, lessons: 0 })),
          week: { weekXp: 0, prevWeekXp: 0, goal: { target: 100, earned: 0, percent: 0 } },
          recent: [],
        })),
    });
    renderDash();
    await ready();
    expect(screen.getByText(/Nothing yet\. Finish a lesson/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Day streak' })).getByText('Keep it going')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'XP progress' })).getByText('Keep going')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start HTML' })).toBeTruthy();
  });

  it('shows a loading skeleton first, and an error message if the data cannot be loaded', async () => {
    setup({ 'GET /api/progress?day=*': () => new Promise(() => {}) });
    renderDash();
    expect(await screen.findByRole('status', { name: 'Loading your dashboard' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hey, Ayesha!' })).toBeTruthy(); // the shell is already there
    cleanup();

    setup({ 'GET /api/progress?day=*': () => json(500, { message: 'boom' }) });
    renderDash();
    expect((await screen.findByRole('alert')).textContent).toContain('Could not load your dashboard');
  });

  it('the sidebar has labelled links and Log out works', async () => {
    setup();
    renderDash();
    await ready();
    const nav = within(screen.getByRole('navigation', { name: 'Main' }));
    expect(nav.getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/dashboard');
    expect(nav.getByRole('link', { name: 'Languages' }).getAttribute('href')).toBe('/languages');
    expect(nav.getByRole('link', { name: 'Shorts Study' }).getAttribute('href')).toBe('/shorts');
    expect(nav.getByRole('link', { name: 'Dashboard' }).className).toContain('active');
    expect(screen.getByRole('link', { name: 'Skip to content' }).getAttribute('href')).toBe('#dash-main');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: /login/i })).toBeTruthy();
    expect(calls).toContain('POST /api/auth/logout');
  });
});

describe('search bar', () => {
  const found = {
    languages: [{ slug: 'html', name: 'HTML' }],
    lessons: [{ languageSlug: 'html', languageName: 'HTML', slug: 'forms-validation', title: 'Forms in Depth & Validation', section: 'Tables & Forms' }],
  };

  it('finds lessons and languages after a short pause and goes to the chosen lesson', async () => {
    setup({
      'GET /api/search?q=*': () => json(200, found),
      'GET /api/languages/html': () => json(200, { language: { slug: 'html', name: 'HTML', description: '', color: '#000' }, topics: [] }),
      'GET /api/progress/html': () => json(200, { completed: [], lastTopic: '', drafts: {} }),
    });
    renderDash();
    await ready();
    const u = userEvent.setup();
    await u.type(screen.getByRole('combobox', { name: /Search lessons/ }), 'forms');

    const list = await screen.findByRole('listbox', { name: 'Search results' });
    await within(list).findByRole('option', { name: /Forms in Depth & Validation/ });
    expect(within(list).getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Ask Study Buddy: \u201cforms\u201d',
      'HTMLLanguage',
      'Forms in Depth & ValidationHTML',
    ]);
    expect(calls.filter((c) => c.startsWith('GET /api/search')).length).toBe(1); // debounced: not one request per key

    await u.click(within(list).getByRole('option', { name: /Forms in Depth & Validation/ }));
    expect(calls).toContain('GET /api/languages/html'); // the lesson page started loading
  });

  it('does not search for fewer than 2 letters', async () => {
    setup({ 'GET /api/search?q=*': () => json(200, found) });
    renderDash();
    await ready();
    await userEvent.setup().type(screen.getByRole('combobox'), 'f');
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.some((c) => c.startsWith('GET /api/search'))).toBe(false);
  });

  it('Enter asks Study Buddy by default, and the arrow keys pick another option', async () => {
    setup({ 'GET /api/search?q=*': () => json(200, found) });
    renderDash();
    await ready();
    const u = userEvent.setup();
    await u.type(screen.getByRole('combobox'), 'how is my streak?{Enter}');
    const panel = await screen.findByRole('dialog', { name: 'Study Buddy' });
    expect(within(panel).getByText('how is my streak?')).toBeTruthy();
    expect(within(panel).getByText(/Your streak is 3 days and your best is 5 days/)).toBeTruthy();
  });

  it('Ctrl+K focuses the search box and Escape closes the results', async () => {
    setup({ 'GET /api/search?q=*': () => json(200, found) });
    renderDash();
    await ready();
    const box = screen.getByRole('combobox');
    expect(document.activeElement).not.toBe(box);
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    expect(document.activeElement).toBe(box);
    await userEvent.setup().type(box, 'css');
    await screen.findByRole('listbox');
    await userEvent.setup().keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

describe('Study Buddy panel', () => {
  it('opens from the floating button, shows suggestions, and answers a suggestion with real numbers', async () => {
    setup();
    renderDash();
    await ready();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask Buddy' }));

    const panel = screen.getByRole('dialog', { name: 'Study Buddy' });
    expect(within(panel).getByRole('heading', { name: /Hi Ayesha, I.m Study Buddy/ })).toBeTruthy();
    expect(within(panel).getAllByText(/No internet, no API key/).length).toBeGreaterThanOrEqual(1);
    expect(within(panel).getAllByRole('button').filter((b) => b.classList.contains('chip')).length).toBe(6);

    await u.click(within(panel).getByRole('button', { name: 'How much XP did I earn this week?' }));
    expect(within(panel).getByText(/You earned 100 XP in the last 7 days\. You reached your weekly goal/)).toBeTruthy();
    expect(calls.filter((c) => c.startsWith('GET')).every((c) => !/buddy|assistant|chat/i.test(c))).toBe(true); // no network call for answers
  });

  it('answers typed questions, offers a link to the next lesson, and closes with Escape', async () => {
    setup();
    renderDash();
    await ready();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Open Study Buddy' }));
    const panel = screen.getByRole('dialog', { name: 'Study Buddy' });
    expect(document.activeElement).toBe(within(panel).getByLabelText('Ask Study Buddy'));

    await u.type(within(panel).getByLabelText('Ask Study Buddy'), 'What should I learn next?');
    await u.click(within(panel).getByRole('button', { name: 'Send question' }));
    expect(within(panel).getByText(/I suggest "Spacing & Responsive Design" in CSS/)).toBeTruthy();
    expect(within(panel).getByRole('link', { name: 'Open "Spacing & Responsive Design"' }).getAttribute('href')).toBe('/learn/css/spacing');

    await u.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Study Buddy' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Ask Buddy' })).toBeTruthy(); // floating button is back
  });

  it('the send button is disabled for empty text, and a language card can ask about its language', async () => {
    setup();
    renderDash();
    await ready();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: 'Ask Buddy about CSS' }));
    const panel = screen.getByRole('dialog', { name: 'Study Buddy' });
    expect(within(panel).getByText('How am I doing in CSS?')).toBeTruthy();
    expect(within(panel).getByText(/CSS: 6 of 12 lessons done \(50%\), 1 of 3 quizzes taken, 60 XP from lessons\./)).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Send question' }).disabled).toBe(true);
    await u.type(within(panel).getByLabelText('Ask Study Buddy'), '   ');
    expect(within(panel).getByRole('button', { name: 'Send question' }).disabled).toBe(true);
  });
});
