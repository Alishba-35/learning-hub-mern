import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const empty = (status = 204) => new Response(null, { status });

const user = { id: 'u1', name: 'Test', email: 't@example.com', role: 'student', purpose: '' };
const htmlLang = {
  language: { slug: 'html', name: 'HTML', description: '', color: '#000' },
  topics: [
    { slug: 'intro', title: 'Introduction', section: 'Start', order: 1 },
    { slug: 'tags', title: 'Basic Tags', section: 'Start', order: 2 },
    { slug: 'forms', title: 'Forms', section: 'Start', order: 3 },
  ],
};
const lesson = (slug, title, blocks, prev = null, next = null) => ({ topic: { slug, title, order: 1, blocks, styles: '' }, prev, next });
const heading = (t) => ({ kind: 'html', html: `<h1>${t}</h1>` });
const playground = { kind: 'playground', language: 'javascript', code: 'console.log("original")' };

let calls;
// handlers: { "METHOD /api/path": (init) => Response }, a trailing * matches any suffix
function setup(handlers = {}) {
  calls = [];
  const all = {
    'POST /api/auth/refresh': () => json(200, { accessToken: 'tok', user }),
    'GET /api/languages/html': () => json(200, htmlLang),
    'GET /api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [heading('Intro lesson')], null, { slug: 'tags', title: 'Basic Tags' })),
    'GET /api/languages/html/topics/tags': () => json(200, lesson('tags', 'Basic Tags', [heading('Tags lesson')], { slug: 'intro', title: 'Introduction' })),
    'GET /api/progress/html': () => json(200, { completed: [], lastTopic: '', drafts: {} }),
    'PUT /api/progress/html/last': () => empty(),
    ...handlers,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`;
      calls.push({ key, init });
      const exact = all[key];
      const prefix = Object.entries(all).find(([k]) => k.endsWith('*') && key.startsWith(k.slice(0, -1)));
      const handler = exact ?? prefix?.[1];
      return handler ? handler(init) : json(404, { message: 'Not found' });
    })
  );
}
const called = (re) => calls.filter((c) => re.test(c.key));

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('progress in the lesson pages', () => {
  it('shows ticks and a progress bar in the topics sidebar for completed lessons', async () => {
    setup({ 'GET /api/progress/html': () => json(200, { completed: ['intro'], lastTopic: 'intro', drafts: {} }) });
    const { container } = renderApp('/learn/html/tags');
    await screen.findByRole('heading', { name: 'Tags lesson' });
    const sidebar = container.querySelector('.topics-sidebar');
    expect(within(sidebar).getByText('1/3 completed')).toBeTruthy();
    expect(sidebar.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe('33');
    expect(within(sidebar).getByRole('link', { name: 'Introduction (completed)', hidden: true })).toBeTruthy();
    expect(within(sidebar).getByRole('link', { name: 'Forms', hidden: true })).toBeTruthy();
  });

  it('Mark as complete saves with the local day, shows the reward and updates the sidebar', async () => {
    setup({
      'POST /api/progress/html/topics/tags/complete': () =>
        json(200, { alreadyCompleted: false, xpGained: 10, stats: { xp: 10, level: 1, xpIntoLevel: 10, xpForNext: 100, streak: 1, longestStreak: 1 } }),
    });
    const { container } = renderApp('/learn/html/tags');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mark as complete' }));

    expect((await screen.findByRole('status')).textContent).toContain('+10 XP');
    expect(screen.getByText(/Completed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as complete' })).toBeNull();
    expect(within(container.querySelector('.topics-sidebar')).getByText('1/3 completed')).toBeTruthy();

    const [post] = called(/^POST .*complete$/);
    expect(JSON.parse(post.init.body).day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('an already completed lesson shows Completed and no button', async () => {
    setup({ 'GET /api/progress/html': () => json(200, { completed: ['tags'], lastTopic: 'tags', drafts: {} }) });
    renderApp('/learn/html/tags');
    expect(await screen.findByText(/Completed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as complete' })).toBeNull();
  });

  it('shows no reward when the server says it was already completed', async () => {
    setup({ 'POST /api/progress/html/topics/tags/complete': () => json(200, { alreadyCompleted: true, xpGained: 0 }) });
    renderApp('/learn/html/tags');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mark as complete' }));
    expect(await screen.findByText(/Completed/)).toBeTruthy();
    expect(screen.queryByText(/XP/)).toBeNull();
  });

  it('keeps the button and shows an error when saving fails', async () => {
    setup({ 'POST /api/progress/html/topics/tags/complete': () => json(500, { message: 'boom' }) });
    renderApp('/learn/html/tags');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Mark as complete' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Could not save');
    expect(screen.getByRole('button', { name: 'Mark as complete' })).toBeTruthy();
  });

  it('lessons still open when the progress API is down (no complete button)', async () => {
    setup({ 'GET /api/progress/html': () => json(500, { message: 'down' }) });
    renderApp('/learn/html/tags');
    expect(await screen.findByRole('heading', { name: 'Tags lesson' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark as complete' })).toBeNull();
  });

  it('remembers the last opened lesson and /learn/html resumes from it', async () => {
    setup({ 'GET /api/progress/html': () => json(200, { completed: [], lastTopic: 'tags', drafts: {} }) });
    renderApp('/learn/html');
    expect(await screen.findByRole('heading', { name: 'Tags lesson' })).toBeTruthy();
    const [put] = called(/^PUT \/api\/progress\/html\/last$/);
    expect(JSON.parse(put.init.body)).toEqual({ topic: 'tags' });
  });
});

describe('dashboard access and logout', () => {
  it('is reachable from the languages page corner, and Logout there works', async () => {
    setup({
      'POST /api/auth/logout': () => empty(),
      'GET /api/progress?day=*': () => new Promise(() => {}), // the page itself is tested in dashboard.test.jsx
    });
    renderApp('/languages');
    await userEvent.setup().click(await screen.findByRole('link', { name: 'Dashboard' }));
    expect(await screen.findByRole('heading', { name: 'Hey, Test!' })).toBeTruthy();
  });

  it('Logout clears locally stored code drafts', async () => {
    localStorage.setItem('lh:draft:u1:html:intro:0', JSON.stringify({ code: 'x', savedAt: 1 }));
    localStorage.setItem('unrelated', 'keep');
    setup({ 'POST /api/auth/logout': () => empty() });
    renderApp('/shorts');
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Logout' }));
    await screen.findByRole('heading', { name: /login/i });
    expect(localStorage.getItem('lh:draft:u1:html:intro:0')).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});

describe('code auto-save', () => {
  const withPlayground = (extra = {}) =>
    setup({
      'GET /api/languages/html/topics/intro': () => json(200, lesson('intro', 'Introduction', [heading('Intro lesson'), playground])),
      'PUT /api/progress/html/topics/intro/drafts/*': () => empty(),
      ...extra,
    });

  it('saves the edited code to the server after a short pause and on this device', async () => {
    withPlayground();
    renderApp('/learn/html/intro');
    const editor = await screen.findByLabelText('Code editor');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    fireEvent.change(editor, { target: { value: 'console.log("mine")' } });
    expect(called(/drafts/).length).toBe(0); // not yet: waiting for the user to pause
    await act(async () => {
      vi.advanceTimersByTime(2100);
    });

    const [put] = called(/^PUT \/api\/progress\/html\/topics\/intro\/drafts\/0$/);
    expect(JSON.parse(put.init.body)).toEqual({ code: 'console.log("mine")' });
    expect(JSON.parse(localStorage.getItem('lh:draft:u1:html:intro:0')).code).toBe('console.log("mine")');
    vi.useRealTimers();
    expect(await screen.findByText('Saved')).toBeTruthy();
  });

  it('saves only once for a burst of typing (debounce)', async () => {
    withPlayground();
    renderApp('/learn/html/intro');
    const editor = await screen.findByLabelText('Code editor');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    for (const v of ['a', 'ab', 'abc', 'abcd']) {
      fireEvent.change(editor, { target: { value: v } });
      await act(async () => vi.advanceTimersByTime(500));
    }
    await act(async () => vi.advanceTimersByTime(2100));
    const puts = called(/drafts\/0$/);
    expect(puts.length).toBe(1);
    expect(JSON.parse(puts[0].init.body).code).toBe('abcd');
  });

  it('restores the saved draft when the lesson is opened again, and Reset brings the original back', async () => {
    withPlayground({
      'GET /api/progress/html': () =>
        json(200, { completed: [], lastTopic: '', drafts: { intro__0: { code: 'console.log("saved earlier")', updatedAt: new Date().toISOString() } } }),
    });
    renderApp('/learn/html/intro');
    const editor = await screen.findByLabelText('Code editor');
    expect(editor.value).toBe('console.log("saved earlier")');
    expect(screen.getByText('Your draft was restored')).toBeTruthy();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Reset code' }));
    expect(editor.value).toBe('console.log("original")');
    expect(screen.queryByRole('button', { name: 'Reset code' })).toBeNull();
    expect(localStorage.getItem('lh:draft:u1:html:intro:0')).toBeNull();
  });

  it('uses the copy on this device when it is newer than the server copy and syncs it', async () => {
    localStorage.setItem('lh:draft:u1:html:intro:0', JSON.stringify({ code: 'console.log("offline edit")', savedAt: Date.now() }));
    withPlayground({
      'GET /api/progress/html': () =>
        json(200, { completed: [], lastTopic: '', drafts: { intro__0: { code: 'old server copy', updatedAt: '2020-01-01T00:00:00.000Z' } } }),
    });
    renderApp('/learn/html/intro');
    expect((await screen.findByLabelText('Code editor')).value).toBe('console.log("offline edit")');
    // the sync is scheduled on mount, so wait for the real (2 second) pause
    await waitFor(() => expect(called(/drafts\/0$/).length).toBe(1), { timeout: 4000 });
    expect(JSON.parse(called(/drafts\/0$/)[0].init.body).code).toBe('console.log("offline edit")');
  });

  it('says it is saved on this device when the server cannot be reached', async () => {
    withPlayground({ 'PUT /api/progress/html/topics/intro/drafts/*': () => json(500, { message: 'down' }) });
    renderApp('/learn/html/intro');
    const editor = await screen.findByLabelText('Code editor');
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    fireEvent.change(editor, { target: { value: 'console.log("x")' } });
    await act(async () => vi.advanceTimersByTime(2100));
    vi.useRealTimers();
    expect(await screen.findByText('Offline: saved on this device')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('lh:draft:u1:html:intro:0')).code).toBe('console.log("x")');
  });

  it('sends unsaved code immediately (keepalive) when the page is being closed', async () => {
    withPlayground();
    renderApp('/learn/html/intro');
    const editor = await screen.findByLabelText('Code editor');
    fireEvent.change(editor, { target: { value: 'console.log("closing")' } });
    expect(called(/drafts/).length).toBe(0);

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    const [put] = called(/drafts\/0$/);
    expect(JSON.parse(put.init.body).code).toBe('console.log("closing")');
    expect(put.init.keepalive).toBe(true);
  });
});
