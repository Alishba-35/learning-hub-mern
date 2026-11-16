import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';
import { checkVideoFile, uploadThumb, youtubeEmbed } from '../services/shorts.js';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const student = { id: '1', name: 'Sara', email: 's@example.com', role: 'student', purpose: '' };
const teacher = { ...student, id: '2', name: 'Ms Sadia', role: 'teacher' };

const video = (n, extra = {}) => ({
  id: `v${n}`,
  title: `Video ${n}`,
  description: '',
  languageSlug: 'javascript',
  source: 'youtube',
  youtubeId: `abcdefghi${String(n).padStart(2, '0')}`,
  fileUrl: null,
  status: 'approved',
  uploaderName: 'Admin',
  createdAt: '2026-01-01T00:00:00Z',
  canDelete: false,
  ...extra,
});

// handlers: { 'GET /api/videos?page=1': (init) => Response }  (exact "METHOD url" keys)
function mockApi(handlers, user = student) {
  const calls = [];
  const all = { 'POST /api/auth/refresh': () => json(200, { accessToken: 'tok', user }), ...handlers };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      const key = `${init.method || 'GET'} ${url}`;
      calls.push({ key, body: init.body ? JSON.parse(init.body) : undefined });
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Short Study page', () => {
  it('lists approved videos with a Play button and loads the player only on click, one at a time', async () => {
    mockApi({ 'GET /api/videos?page=1': () => json(200, { videos: [video(1), video(2)], page: 1, pages: 1, total: 2 }) });
    renderApp('/shorts');

    expect(await screen.findByRole('heading', { name: 'Video 1' })).toBeTruthy();
    expect(document.querySelectorAll('iframe')).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Play Video 1' }));
    expect(document.querySelector('iframe').getAttribute('src')).toBe(youtubeEmbed('abcdefghi01'));

    await userEvent.click(screen.getByRole('button', { name: 'Play Video 2' }));
    const frames = document.querySelectorAll('iframe');
    expect(frames).toHaveLength(1);
    expect(frames[0].getAttribute('src')).toBe(youtubeEmbed('abcdefghi02'));
    expect(screen.getByRole('button', { name: 'Play Video 1' })).toBeTruthy();
  });

  it('plays an uploaded file in a video element', async () => {
    const up = video(3, { source: 'upload', youtubeId: null, fileUrl: 'https://res.cloudinary.com/demo/video/upload/v1/learning-hub/shorts/a1.mp4' });
    mockApi({ 'GET /api/videos?page=1': () => json(200, { videos: [up], page: 1, pages: 1, total: 1 }) });
    renderApp('/shorts');
    await userEvent.click(await screen.findByRole('button', { name: 'Play Video 3' }));
    expect(document.querySelector('video').getAttribute('src')).toBe(up.fileUrl);
  });

  it('filters by language and asks the server for that language only', async () => {
    const calls = mockApi({
      'GET /api/videos?page=1': () => json(200, { videos: [video(1)], page: 1, pages: 1, total: 1 }),
      'GET /api/videos?page=1&language=css': () => json(200, { videos: [video(9, { languageSlug: 'css' })], page: 1, pages: 1, total: 1 }),
    });
    renderApp('/shorts');
    await screen.findByRole('heading', { name: 'Video 1' });
    await userEvent.click(screen.getByRole('button', { name: 'CSS' }));
    expect(await screen.findByRole('heading', { name: 'Video 9' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Video 1' })).toBeNull();
    expect(calls.some((c) => c.key === 'GET /api/videos?page=1&language=css')).toBe(true);
  });

  it('Load more appends the next page and hides the button on the last page', async () => {
    mockApi({
      'GET /api/videos?page=1': () => json(200, { videos: [video(1)], page: 1, pages: 2, total: 2 }),
      'GET /api/videos?page=2': () => json(200, { videos: [video(2)], page: 2, pages: 2, total: 2 }),
    });
    renderApp('/shorts');
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }));
    expect(await screen.findByRole('heading', { name: 'Video 2' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Video 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  });

  it('shows an empty message and an error with Try again', async () => {
    let fail = true;
    mockApi({
      'GET /api/videos?page=1': () => (fail ? json(500, { message: 'Server down' }) : json(200, { videos: [], page: 1, pages: 1, total: 0 })),
    });
    renderApp('/shorts');
    expect((await screen.findByRole('alert')).textContent).toContain('Server down');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No videos yet/)).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('Add a video', () => {
  const config = (over = {}) => ({ 'GET /api/videos/config': () => json(200, { uploadEnabled: false, maxMb: 50, canReview: false, ...over }) });

  it('checks the title and link before sending anything', async () => {
    const calls = mockApi(config());
    renderApp('/shorts/add');
    await userEvent.type(await screen.findByLabelText('Title'), 'ab');
    await userEvent.click(screen.getByRole('button', { name: 'Add video' }));
    expect(screen.getByText('Title must be at least 3 characters')).toBeTruthy();
    expect(screen.getByText('Paste a YouTube link')).toBeTruthy();
    expect(calls.some((c) => c.key.startsWith('POST /api/videos'))).toBe(false);
  });

  it('sends a YouTube video and tells a student it is waiting for approval', async () => {
    const calls = mockApi({
      ...config(),
      'POST /api/videos': () => json(201, { video: video(5, { status: 'pending' }) }),
    });
    renderApp('/shorts/add');
    await userEvent.type(await screen.findByLabelText('Title'), 'CSS in 60s');
    await userEvent.selectOptions(screen.getByLabelText('Topic'), 'css');
    await userEvent.type(screen.getByLabelText('YouTube link'), 'https://youtu.be/dQw4w9WgXcQ');
    await userEvent.click(screen.getByRole('button', { name: 'Add video' }));
    expect(await screen.findByRole('heading', { name: 'Video sent for approval' })).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/videos').body).toEqual({
      source: 'youtube',
      title: 'CSS in 60s',
      description: '',
      languageSlug: 'css',
      youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    });
  });

  it('shows the server message when the video is rejected', async () => {
    mockApi({ ...config(), 'POST /api/videos': () => json(409, { message: 'This YouTube video is already on Shorts Study' }) });
    renderApp('/shorts/add');
    await userEvent.type(await screen.findByLabelText('Title'), 'Duplicate one');
    await userEvent.type(screen.getByLabelText('YouTube link'), 'dQw4w9WgXcQ');
    await userEvent.click(screen.getByRole('button', { name: 'Add video' }));
    expect((await screen.findByRole('alert')).textContent).toContain('already on Shorts Study');
  });

  it('disables file upload until the server has it set up', async () => {
    mockApi(config({ uploadEnabled: false }));
    renderApp('/shorts/add');
    expect((await screen.findByRole('button', { name: 'Upload a file' })).disabled).toBe(true);
  });

  it('rejects a wrong file type before uploading', async () => {
    const calls = mockApi(config({ uploadEnabled: true }));
    renderApp('/shorts/add');
    await userEvent.click(await screen.findByRole('button', { name: 'Upload a file' }));
    await userEvent.type(screen.getByLabelText('Title'), 'My reel');
    await userEvent.upload(screen.getByLabelText(/Video file/), new File(['x'], 'notes.pdf', { type: 'application/pdf' }), { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: 'Add video' }));
    expect(screen.getByText('Only MP4, MOV or WebM videos are allowed')).toBeTruthy();
    expect(calls.some((c) => c.key.includes('upload-signature'))).toBe(false);
  });
});

describe('My videos', () => {
  it('a student sees only their own videos and no review list', async () => {
    mockApi({
      'GET /api/videos/config': () => json(200, { uploadEnabled: false, maxMb: 50, canReview: false }),
      'GET /api/videos/mine': () => json(200, { videos: [video(1, { status: 'pending', canDelete: true })] }),
    });
    renderApp('/shorts/manage');
    expect(await screen.findByText('Waiting for approval', { selector: '.badge' })).toBeTruthy();
    expect(screen.queryByText(/Waiting for approval \(/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('a teacher can approve a pending video and the list refreshes', async () => {
    let approved = false;
    const calls = mockApi(
      {
        'GET /api/videos/config': () => json(200, { uploadEnabled: true, maxMb: 50, canReview: true }),
        'GET /api/videos/mine': () => json(200, { videos: [] }),
        'GET /api/videos/pending': () => json(200, { videos: approved ? [] : [video(7, { status: 'pending', canDelete: true })] }),
        'PATCH /api/videos/v7/approve': () => {
          approved = true;
          return json(200, { video: video(7) });
        },
      },
      teacher
    );
    renderApp('/shorts/manage');
    const section = (await screen.findByText(/Waiting for approval \(1\)/)).closest('section');
    await userEvent.click(within(section).getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Waiting for approval \(0\)/)).toBeTruthy();
    expect(calls.some((c) => c.key === 'PATCH /api/videos/v7/approve')).toBe(true);
  });

  it('deleting asks for confirmation first', async () => {
    const calls = mockApi({
      'GET /api/videos/config': () => json(200, { uploadEnabled: false, maxMb: 50, canReview: false }),
      'GET /api/videos/mine': () => json(200, { videos: [video(1, { canDelete: true })] }),
      'DELETE /api/videos/v1': () => new Response(null, { status: 204 }),
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    renderApp('/shorts/manage');
    const del = await screen.findByRole('button', { name: 'Delete' });
    await userEvent.click(del);
    expect(calls.some((c) => c.key.startsWith('DELETE'))).toBe(false);
    await userEvent.click(del);
    await waitFor(() => expect(calls.some((c) => c.key === 'DELETE /api/videos/v1')).toBe(true));
    confirm.mockRestore();
  });
});

describe('shorts helpers', () => {
  it('checkVideoFile enforces type and size', () => {
    const mb = (n, type = 'video/mp4') => ({ type, size: n * 1024 * 1024 });
    expect(checkVideoFile(null, 50)).toMatch(/Choose/);
    expect(checkVideoFile(mb(1, 'image/png'), 50)).toMatch(/Only MP4/);
    expect(checkVideoFile(mb(51), 50)).toMatch(/50 MB/);
    expect(checkVideoFile(mb(50), 50)).toBe('');
    expect(checkVideoFile(mb(1, 'video/webm'), 50)).toBe('');
  });
  it('uploadThumb turns a Cloudinary video link into its first-frame image', () => {
    expect(uploadThumb('https://res.cloudinary.com/d/video/upload/v1/learning-hub/shorts/a.MOV')).toBe('https://res.cloudinary.com/d/video/upload/v1/learning-hub/shorts/a.jpg');
  });
});
