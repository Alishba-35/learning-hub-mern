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
  students: 3, newStudents: 1, activeWeek: 2, certificates: 4, videos: { pending: 2, approved: 5, rejected: 0 },
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
  certificates: [{ code: 'LH-AAAA-BBBB-CCCC', languageSlug: 'css', languageName: 'CSS', issuedAt: '2026-03-01T00:00:00Z', revoked: false }],
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
      { 'GET /api/admin/stats': () => json(200, stats), 'GET /api/admin/insights': () => json(200, insights), 'GET /api/admin/students/1': () => json(200, detail), 'POST /api/admin/email': () => json(200, { sent: 1, failed: 0, skipped: 0, devLogged: false }),
        'POST /api/admin/nudges/send': () => json(200, { sent: 4, failed: 0, skippedRecent: 1, waiting: 0, devLogged: false }),
        'GET /api/admin/nudges/auto': () => json(200, { enabled: false, groups: ['inactive', 'neverStarted', 'streakBroken'], lastRun: null, cooldownDays: 7, dailyMax: 100, cronReady: true }),
        'PUT /api/admin/nudges/auto': (init) => json(200, { ...JSON.parse(init.body), lastRun: null, cooldownDays: 7, dailyMax: 100, cronReady: true }) },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Insights' }));

    expect(await screen.findByText('Inactive Ina')).toBeTruthy();
    expect(screen.getByText('No activity for 7+ days')).toBeTruthy();
    expect(screen.getAllByText('Nobody here. Good news!').length).toBe(2);
    expect(screen.getByText(/75% wrong \(3 of 4\)/)).toBeTruthy();
    expect(screen.getByText(/Biggest drop: after "Selectors" 75% of students stop/)).toBeTruthy();
    // "Email them" ab ek click mein tayyar paigham sab ko bhejta hai (confirm ke baad); mail app nahi khulti
    expect(screen.queryByRole('link', { name: 'Email them' })).toBeNull();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Email them' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('Stopped learning'));
    expect(await screen.findByText(/Email sent to 4 students\. 1 skipped \(already emailed/)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/admin/nudges/send').body).toEqual({ group: 'inactive' });
    confirm.mockReturnValue(false);
    await userEvent.click(screen.getByRole('button', { name: 'Email them' }));
    expect(calls.filter((c) => c.key === 'POST /api/admin/nudges/send')).toHaveLength(1); // "Cancel" par kuch nahi gaya
    confirm.mockRestore();

    // Apna paigham likh kar bhejna
    await userEvent.click(screen.getByRole('button', { name: 'Write my own' }));
    expect(screen.getByLabelText('Email message').value).toContain('We have not seen you');
    await userEvent.click(screen.getByRole('button', { name: 'Send email' }));
    expect(await screen.findByText(/Email sent to 1 student\./)).toBeTruthy();
    const sent = calls.find((c) => c.key === 'POST /api/admin/email');
    expect(sent.body.userIds).toEqual(['1']);
    expect(sent.body.subject).toBe('We miss you on Learning Hub');

    // Automatic emails ka panel: on karna aur group chunna
    expect(screen.getByRole('switch', { name: 'Send automatically' }).checked).toBe(false);
    expect(screen.getByText('It has not run yet.')).toBeTruthy();
    await userEvent.click(screen.getByRole('switch', { name: 'Send automatically' }));
    await waitFor(() => expect(screen.getByRole('switch', { name: 'Send automatically' }).checked).toBe(true));
    expect(calls.find((c) => c.key === 'PUT /api/admin/nudges/auto').body).toEqual({ enabled: true, groups: ['inactive', 'neverStarted', 'streakBroken'] });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Never started' }));
    await waitFor(() => expect(calls.filter((c) => c.key === 'PUT /api/admin/nudges/auto')).toHaveLength(2));
    expect(calls.filter((c) => c.key === 'PUT /api/admin/nudges/auto')[1].body.groups).toEqual(['inactive', 'streakBroken']);

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

  it('announcements: write one for everyone, see the list, remove one', async () => {
    const sent = { id: 'n1', title: 'Quiz on Friday', body: 'Revise CSS.', level: 'info', audience: 'everyone', recipientCount: null, createdAt: '2026-11-10T10:00:00Z', expiresAt: null, active: true, createdByName: 'Alishba' };
    let list = [sent];
    const calls = mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/announcements': () => json(200, { announcements: list }),
        'POST /api/admin/announcements': () => {
          list = [{ ...sent, id: 'n2', title: 'Holiday on Monday', level: 'important' }, ...list];
          return json(201, { announcement: list[0], recipients: 0 });
        },
        'DELETE /api/admin/announcements/n1': () => {
          list = list.filter((a) => a.id !== 'n1');
          return new Response(null, { status: 204 });
        },
      },
      admin
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Announcements' }));
    expect(await screen.findByText('Quiz on Friday')).toBeTruthy();

    const publish = screen.getByRole('button', { name: 'Publish' });
    expect(publish.disabled).toBe(true);
    await userEvent.type(screen.getByLabelText('Title'), 'Holiday on Monday');
    await userEvent.type(screen.getByLabelText('Message'), 'No class on Monday.');
    await userEvent.selectOptions(screen.getByLabelText('Type'), 'important');
    await userEvent.selectOptions(screen.getByLabelText('Show for'), '7');
    await userEvent.click(publish);
    await waitFor(() => expect(calls.find((c) => c.key === 'POST /api/admin/announcements')?.body).toEqual({ title: 'Holiday on Monday', body: 'No class on Monday.', level: 'important', audience: 'everyone', expiresInDays: 7 }));
    expect(await screen.findByText(/Every student will see it/)).toBeTruthy();
    expect((await screen.findAllByText('Holiday on Monday')).length).toBeGreaterThan(0);

    await userEvent.click((await screen.findAllByRole('button', { name: 'Remove' }))[1]); // purana "Quiz on Friday"
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/admin/announcements/n1')).toBe(true));
    await waitFor(() => expect(screen.queryByText('Quiz on Friday')).toBeNull());
  });

  it('insights: a reminder goes only to the students in that list', async () => {
    const ina = { id: '1', name: 'Inactive Ina', email: 'ina@example.com', joinedAt: '2026-01-01T00:00:00Z', xp: 50, longestStreak: 2, lastActiveDay: null, daysInactive: 10, daysSinceJoined: 40 };
    const insights = {
      thresholds: { inactiveDays: 7, neverStartedDays: 3, minAsked: 3 },
      atRisk: { inactive: { total: 1, students: [ina] }, neverStarted: { total: 0, students: [] }, streakBroken: { total: 0, students: [] } },
      hardQuestions: [],
      dropOff: [],
    };
    const calls = mockApi(
      {
        'GET /api/admin/stats': () => json(200, stats),
        'GET /api/admin/insights': () => json(200, insights),
        'POST /api/admin/announcements': () => json(201, { announcement: {}, recipients: 1 }),
      },
      admin
    );
    renderApp('/admin');
    await userEvent.click(await screen.findByRole('link', { name: 'Insights' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Send reminder' }));
    const box = await screen.findByLabelText(/Reminder for 1 student/);
    expect(box.value).toMatch(/We have not seen you for a while/); // pehle se likha hua paigham
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() =>
      expect(calls.find((c) => c.key === 'POST /api/admin/announcements')?.body).toMatchObject({ title: 'We miss you', audience: 'selected', userIds: ['1'], expiresInDays: 7, level: 'info' })
    );
    expect(await screen.findByText(/Reminder sent to 1 student/)).toBeTruthy();
  });

  it('overview counts the certificates that were issued', async () => {
    mockApi({ 'GET /api/admin/stats': () => json(200, stats) }, admin);
    renderApp('/admin');
    expect(await screen.findByText('Certificates issued')).toBeTruthy();
    expect(screen.getByText('Genuine, not revoked')).toBeTruthy();
  });

  it('a student certificate can be opened, revoked (after confirming) and restored', async () => {
    let revoked = false;
    const calls = mockApi(
      {
        'GET /api/admin/students/1': () => json(200, { ...detail, certificates: [{ ...detail.certificates[0], revoked }] }),
        'PATCH /api/admin/certificates/LH-AAAA-BBBB-CCCC': (init) => {
          revoked = JSON.parse(init.body).revoked;
          return json(200, { code: 'LH-AAAA-BBBB-CCCC', revoked });
        },
      },
      admin
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true);
    renderApp('/admin/students/1');
    expect((await screen.findByRole('link', { name: 'Open PDF' })).getAttribute('href')).toBe('/api/certificates/LH-AAAA-BBBB-CCCC/pdf');

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(confirm).toHaveBeenCalled();
    expect(calls.some((c) => c.key.startsWith('PATCH /api/admin/certificates'))).toBe(false); // "Cancel" dabaya: kuch nahi hua

    await userEvent.click(screen.getByRole('button', { name: 'Revoke' }));
    expect(await screen.findByText('Revoked')).toBeTruthy();
    expect(calls.find((c) => c.key.startsWith('PATCH /api/admin/certificates'))?.body).toEqual({ revoked: true });
    expect(screen.queryByRole('link', { name: 'Open PDF' })).toBeNull(); // revoke ke baad PDF nahi

    await userEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(screen.queryByText('Revoked')).toBeNull());
    expect(screen.getByRole('link', { name: 'Open PDF' })).toBeTruthy();
  });
});

