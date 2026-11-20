import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const admin = { id: '9', name: 'Alishba', email: 'a@example.com', role: 'admin', purpose: '' };
const student = { ...admin, id: '1', name: 'Sara', role: 'student' };

function mockApi(handlers, user) {
  const calls = [];
  const all = { 'POST /api/auth/refresh': () => json(200, { accessToken: 'tok', user }), ...handlers };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`;
      calls.push({ key, body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      return all[key] ? all[key](init) : json(404, { message: `No mock for ${key}` });
    })
  );
  return calls;
}

const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

const stats = {
  students: 3, newStudents: 1, activeWeek: 2, videos: { pending: 2, approved: 5, rejected: 0 },
  signups: Array.from({ length: 30 }, (_, i) => ({ day: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`, count: i === 29 ? 2 : 0 })),
  topLearners: [{ id: '1', name: 'Sara', xp: 230, level: 3, streak: 3 }],
  popularLanguages: [{ slug: 'css', name: 'CSS', color: '#1f4e78', learners: 2, lessons: 7 }],
  quizzes: { attempts: 4, takers: 2, averagePercent: 60 },
};
const studentRow = { id: '1', name: 'Sara', email: 'sara@example.com', purpose: '', role: 'student', disabled: false, joinedAt: '2026-02-01T00:00:00Z', stats: { xp: 230, level: 3, streak: 3, lastActiveDay: null }, videos: { pending: 1, approved: 0, rejected: 0, total: 1 } };
const detail = {
  student: { id: '1', name: 'Sara', email: 'sara@example.com', purpose: 'Learn web', role: 'student', disabled: false, disabledReason: '', joinedAt: '2026-02-01T00:00:00Z', sessions: 2 },
  stats: { xp: 230, level: 3, xpIntoLevel: 30, xpForNext: 100, streak: 3, longestStreak: 5, lastActiveDay: null, completedTotal: 3, quizzes: { total: 4, taken: 1, passed: 1, perfect: 0 } },
  languages: [{ slug: 'css', name: 'CSS', color: '#1f4e78', total: 6, completed: 3, percent: 50, lastTopic: 'c', quizzesTaken: 1, score: { earned: 4, possible: 5, percent: 80, passed: 1 } }, { slug: 'html', name: 'HTML', color: '#9b2d30', total: 4, completed: 0, percent: 0, lastTopic: '', quizzesTaken: 0, score: { earned: 0, possible: 0, percent: null, passed: 0 } }],
  quizzes: [{ languageSlug: 'css', quizSlug: 'css-basics', title: 'CSS Basics', bestScore: 4, total: 5, percent: 80, attempts: 2, lastAt: '2026-03-01T00:00:00Z' }],
  badges: [{ id: 'first-lesson', title: 'First Step', description: 'Complete your first lesson' }],
  series: Array.from({ length: 14 }, (_, i) => ({ day: `2026-11-${String(i + 1).padStart(2, '0')}`, xp: i === 13 ? 10 : 0, lessons: 0, quizzes: 0 })),
  recent: [{ type: 'lesson', languageSlug: 'css', title: 'Selectors', detail: '', xp: 10, at: '2026-11-14T10:00:00Z' }],
  videos: { pending: 1, approved: 0, rejected: 0, total: 1 },
};
const pendingVideo = {
  id: 'v1', title: 'Cat memes', description: '', languageSlug: '', source: 'youtube', youtubeId: 'abcdefghi01', streamUrl: null,
  status: 'pending', rejectReason: '', uploaderName: 'Sara', uploaderId: '1', createdAt: '2026-01-01T00:00:00Z', canDelete: true,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('admin panel', () => {
  it('keeps students away from /admin and never calls the admin API', async () => {
    const calls = mockApi({ 'GET /api/dashboard': () => json(404, {}) }, student);
    renderApp('/admin');
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Admin panel' })).toBeNull());
    expect(calls.some((c) => c.key.includes('/api/admin'))).toBe(false);
  });

  it('shows the admin the signed-up students with their video counts', async () => {
    mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/students?role=student&page=1': () => json(200, { students: [studentRow], page: 1, pages: 1, total: 1 }),
      },
      admin
    );
    renderApp('/admin');
    expect(await screen.findByText('Students signed up')).toBeTruthy();
    await userEvent.click(screen.getByRole('link', { name: 'Students' }));
    expect(await screen.findByText('sara@example.com')).toBeTruthy();
    expect(screen.getByText(/1 waiting/)).toBeTruthy();
    expect(screen.getByText('Level 3')).toBeTruthy();
  });

  it('opens one student: progress, quizzes, badges and activity', async () => {
    mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/students?role=student&page=1': () => json(200, { students: [studentRow], page: 1, pages: 1, total: 1 }),
        'GET /api/admin/students/1': () => json(200, detail),
      },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Students' }));
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    expect(await screen.findByText('Why they joined: Learn web')).toBeTruthy();
    expect(screen.getByText('3/6 lessons, quizzes 80%')).toBeTruthy();
    expect(screen.getByText(/Not started: HTML/)).toBeTruthy();
    expect(screen.getByText('CSS Basics')).toBeTruthy();
    expect(screen.getByText('First Step')).toBeTruthy();
    expect(screen.getByText('Selectors')).toBeTruthy();
  });

  it('suspending asks for a reason; deleting needs the email typed', async () => {
    const calls = mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/students?role=student&page=1': () => json(200, { students: [studentRow], page: 1, pages: 1, total: 1 }),
        'GET /api/admin/students/1': () => json(200, detail),
        'PATCH /api/admin/students/1/suspension': () => json(200, { id: '1', disabled: true, disabledReason: 'Spam' }),
        'DELETE /api/admin/students/1?confirm=SARA%40example.com': () => new Response(null, { status: 204 }),
      },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Students' }));
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Suspend' }));
    const suspend = screen.getByRole('button', { name: 'Confirm suspend' });
    expect(suspend.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/Why are you suspending/), 'Spam');
    await userEvent.click(suspend);
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/admin/students/1/suspension')?.body).toEqual({ disabled: true, reason: 'Spam' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm suspend' })).toBeNull()); // form band hone tak ruko

    await userEvent.click(await screen.findByRole('button', { name: 'Delete account' }));
    const del = screen.getByRole('button', { name: 'Delete forever' });
    expect(del.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/permanently deletes/), 'SARA@example.com');
    expect(del.disabled).toBe(false);
    await userEvent.click(del);
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/admin/students/1?confirm=SARA%40example.com')).toBe(true));
    expect(await screen.findByText('1 student')).toBeTruthy(); // delete ke baad list par wapas
  });

  it('rejecting a video asks for a reason first, then sends it', async () => {
    const calls = mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/videos?status=pending&page=1': () => json(200, { videos: [pendingVideo], page: 1, pages: 1, total: 1 }),
        'PATCH /api/admin/videos/v1/status': () => json(200, { video: { ...pendingVideo, status: 'rejected' } }),
      },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Videos' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    const confirm = screen.getByRole('button', { name: 'Confirm reject' });
    expect(confirm.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText(/Why is it rejected/), 'Not about programming');
    await userEvent.click(confirm);
    await waitFor(() => expect(calls.find((c) => c.key === 'PATCH /api/admin/videos/v1/status')?.body).toEqual({ status: 'rejected', reason: 'Not about programming' }));
  });

  it('insights: shows who needs a nudge, the hardest questions, and where students stop', async () => {
    const ina = { id: '1', name: 'Inactive Ina', email: 'ina@example.com', joinedAt: '2026-01-01T00:00:00Z', xp: 50, longestStreak: 2, lastActiveDay: null, daysInactive: 10, daysSinceJoined: 40 };
    const insights = {
      thresholds: { inactiveDays: 7, neverStartedDays: 3, minAsked: 3 },
      atRisk: { inactive: { total: 1, students: [ina] }, neverStarted: { total: 0, students: [] }, streakBroken: { total: 0, students: [] } },
      hardQuestions: [{ languageSlug: 'css', language: 'CSS', quizSlug: 'q1', quizTitle: 'CSS Checkpoint', questionId: 'q1-2', prompt: 'Which unit is relative?', asked: 4, wrong: 3, wrongPercent: 75 }],
      dropOff: [
        {
          slug: 'css', name: 'CSS', color: '#1f4e78', starters: 5,
          lessons: [{ slug: 'a', title: 'Intro', completed: 5, percent: 100 }, { slug: 'b', title: 'Selectors', completed: 4, percent: 80 }, { slug: 'c', title: 'Flexbox', completed: 1, percent: 20 }],
          biggestDrop: { from: 'Selectors', to: 'Flexbox', fromCount: 4, toCount: 1, dropPercent: 75 },
        },
      ],
    };
    const calls = mockApi(
      { 'GET /api/admin/stats': () => json(200, stats), 'GET /api/admin/insights': () => json(200, insights), 'GET /api/admin/students/1': () => json(200, detail) },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Insights' }));

    expect(await screen.findByText('Inactive Ina')).toBeTruthy();
    expect(screen.getByText('No activity for 7+ days')).toBeTruthy();
    expect(screen.getAllByText('Nobody here. Good news!').length).toBe(2);
    expect(screen.getByText(/75% wrong \(3 of 4\)/)).toBeTruthy();
    expect(screen.getByText(/Biggest drop: after "Selectors" 75% of students stop/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Email them' }).getAttribute('href')).toContain('bcc=ina%40example.com');

    await userEvent.click(screen.getByRole('button', { name: 'View' }));
    expect(await screen.findByText('Why they joined: Learn web')).toBeTruthy(); // student ki detail khul gayi
    expect(calls.some((c) => c.key === 'GET /api/admin/students/1')).toBe(true);
  });

  it('has its own admin shell (sidebar), not the student navbar', async () => {
    mockApi({ 'GET /api/admin/stats': () => json(200, stats) }, admin);
    renderApp('/admin');
    expect(await screen.findByText('Students signed up')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Admin sections' });
    expect(['Overview', 'Students', 'Insights', 'Videos'].every((n) => nav.textContent.includes(n))).toBe(true);
    expect(screen.getByText('Administrator')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Shorts Study' })).toBeNull(); // student navbar nahi
    expect(screen.getByRole('link', { name: 'Back to student site' })).toBeTruthy();
  });

  it('each admin page has its own address: a student page opens directly, and their videos are filtered', async () => {
    const calls = mockApi(
      {
        'GET /api/admin/students/1': () => json(200, detail),
        'GET /api/admin/videos?status=all&student=1&page=1': () => json(200, { videos: [pendingVideo], page: 1, pages: 1, total: 1 }),
      },
      admin
    );
    renderApp('/admin/students/1');
    expect(await screen.findByText('Why they joined: Learn web')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Their videos/ }));
    expect(await screen.findByText(/Showing videos by/)).toBeTruthy();
    expect(screen.getByText('Sara', { selector: 'strong' })).toBeTruthy();
    expect(calls.some((c) => c.key === 'GET /api/admin/videos?status=all&student=1&page=1')).toBe(true);
  });
});
