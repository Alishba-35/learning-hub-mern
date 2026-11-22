// Light mode ka logo, OTP se password reset, profile (naam/photo) aur avatar helper
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import BrandLogo from '../components/BrandLogo.jsx';
import DashboardShell from '../components/dashboard/DashboardShell.jsx';
import ProfileModal from '../components/dashboard/ProfileModal.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';
import { useAuth } from '../hooks/useAuth.js';
import { fileToAvatar } from '../utils/avatar.js';

vi.mock('../utils/avatar.js', async (importOriginal) => {
  const real = await importOriginal();
  return { ...real, fileToAvatar: vi.fn(real.fileToAvatar) };
});

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const sara = { id: '1', name: 'Sara Khan', email: 'sara@example.com', role: 'student', purpose: '', avatar: '' };
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';

function mockApi(handlers, user = sara) {
  const calls = [];
  const all = { 'POST /api/auth/refresh': () => (user ? json(200, { accessToken: 'tok', user }) : json(401, { message: 'Session expired' })), ...handlers };
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

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(fileToAvatar).mockClear();
});

describe('logo in light mode', () => {
  it('a dark-surface logo is never hidden by the theme, only "auto" logos switch', () => {
    const { container, rerender } = render(<BrandLogo surface="dark" />);
    const imgs = () => [...container.querySelectorAll('img')];
    expect(imgs()).toHaveLength(1);
    expect(imgs()[0].className).not.toMatch(/auto/);
    expect(imgs()[0].getAttribute('src')).toBe('/images/logo-light.png');
    rerender(<BrandLogo surface="auto" variant="icon" />);
    expect(imgs().map((i) => i.getAttribute('src'))).toEqual(['/images/logo-icon-light.png', '/images/logo-icon.png']);
    expect(imgs().map((i) => i.className)).toEqual([expect.stringContaining('brand-logo--auto-dark'), expect.stringContaining('brand-logo--auto-light')]);
  });

  it('the css only hides the auto logos, and only for the matching theme', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css).toMatch(/:root\[data-theme='light'\] \.brand-logo--auto-dark \{ display: none; \}/);
    expect(css).toMatch(/:root:not\(\[data-theme='light'\]\) \.brand-logo--auto-light \{ display: none; \}/);
    expect(css).not.toMatch(/\.brand-logo--on-/);
  });
});

describe('password reset with an email code', () => {
  const renderAt = (path) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    );

  it('the login page links to it', async () => {
    mockApi({}, null);
    renderAt('/login');
    const link = await screen.findByRole('link', { name: 'Forgot password?' });
    expect(link.getAttribute('href')).toBe('/forgot-password');
  });

  it('asks for the email, then the code and a new password, then confirms', async () => {
    const calls = mockApi(
      {
        'POST /api/auth/forgot-password': () => json(200, { message: 'If this email is registered, we sent a 6-digit code to it.', resendSeconds: 60 }),
        'POST /api/auth/reset-password': () => json(200, { message: 'Password updated.' }),
      },
      null
    );
    renderAt('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email'), 'sara@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));

    expect(await screen.findByText(/we sent a 6-digit code/)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/forgot-password').body).toEqual({ email: 'sara@example.com' });
    expect(screen.getByRole('button', { name: 'Resend code in 60s' }).disabled).toBe(true);

    const submit = screen.getByRole('button', { name: 'Reset password' });
    expect(submit.disabled).toBe(true); // 6 digit code ke bina band
    await userEvent.type(screen.getByLabelText('6-digit code'), '12a3456x');
    expect(screen.getByLabelText('6-digit code').value).toBe('123456'); // sirf digits
    await userEvent.type(screen.getByLabelText('New password'), 'NewPassword1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'Different1');
    await userEvent.click(submit);
    expect(await screen.findByText('Passwords do not match')).toBeTruthy();
    expect(calls.some((c) => c.key === 'POST /api/auth/reset-password')).toBe(false);

    await userEvent.clear(screen.getByLabelText('Confirm new password'));
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPassword1');
    await userEvent.click(submit);
    expect(await screen.findByText(/Your password has been updated/)).toBeTruthy();
    expect(calls.find((c) => c.key === 'POST /api/auth/reset-password').body).toEqual({ email: 'sara@example.com', otp: '123456', password: 'NewPassword1' });
    expect(screen.getByRole('link', { name: 'Back to Login' }).getAttribute('href')).toBe('/login');
  });

  it('shows the server message when the code is wrong', async () => {
    mockApi(
      {
        'POST /api/auth/forgot-password': () => json(200, { message: 'Code sent.', resendSeconds: 60 }),
        'POST /api/auth/reset-password': () => json(400, { message: 'That code is wrong or has expired. Please request a new one.' }),
      },
      null
    );
    renderAt('/forgot-password');
    await userEvent.type(await screen.findByLabelText('Email'), 'sara@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send code' }));
    await userEvent.type(await screen.findByLabelText('6-digit code'), '111111');
    await userEvent.type(screen.getByLabelText('New password'), 'NewPassword1');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'NewPassword1');
    await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/wrong or has expired/);
  });
});

describe('edit profile', () => {
  function Host({ onClose = () => {}, who }) {
    const { user } = useAuth();
    return user ? <ProfileModal user={who ?? user} onClose={onClose} /> : null;
  }
  const renderModal = (props) =>
    render(
      <AuthProvider>
        <Host {...props} />
      </AuthProvider>
    );

  it('saves a new name', async () => {
    const onClose = vi.fn();
    const calls = mockApi({ 'PATCH /api/auth/profile': () => json(200, { user: { ...sara, name: 'Sara K' } }) });
    renderModal({ onClose });
    const name = await screen.findByLabelText('Name');
    await userEvent.clear(name);
    await userEvent.type(name, ' Sara K ');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(calls.find((c) => c.key === 'PATCH /api/auth/profile').body).toEqual({ name: 'Sara K' });
  });

  it('adds a photo (resized by the helper) and removes it again', async () => {
    vi.mocked(fileToAvatar).mockResolvedValue(PHOTO);
    const onClose = vi.fn();
    const calls = mockApi({ 'PATCH /api/auth/profile': () => json(200, { user: { ...sara, avatar: PHOTO } }) });
    const { unmount } = renderModal({ onClose });
    await screen.findByLabelText('Name');
    await userEvent.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(fileToAvatar).toHaveBeenCalled();
    await waitFor(() => expect(document.querySelector('img.profile-avatar').getAttribute('src')).toBe(PHOTO));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(calls.find((c) => c.key === 'PATCH /api/auth/profile').body).toEqual({ avatar: PHOTO });
    unmount();

    // ab photo wale user ke liye "Remove"
    calls.length = 0;
    mockApi({ 'PATCH /api/auth/profile': () => json(200, { user: sara }) }, { ...sara, avatar: PHOTO });
    renderModal({});
    await userEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ avatar: null }) })));
  });

  it('closes without calling the server when nothing changed, and shows an image error', async () => {
    vi.mocked(fileToAvatar).mockRejectedValue(new Error('Please choose an image file'));
    const onClose = vi.fn();
    const calls = mockApi({});
    renderModal({ onClose });
    await screen.findByLabelText('Name');
    await userEvent.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'doc.txt', { type: 'text/plain' }), { applyAccept: false });
    expect((await screen.findByRole('alert')).textContent).toBe('Please choose an image file');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClose).toHaveBeenCalled();
    expect(calls.some((c) => c.key.startsWith('PATCH'))).toBe(false);
  });

  it('opens from the avatar in the dashboard sidebar, which shows the photo', async () => {
    mockApi({}, { ...sara, avatar: PHOTO });
    function Shell() {
      const { user } = useAuth();
      return user ? (
        <MemoryRouter>
          <DashboardShell user={user} onLogout={() => {}} ctx={{}} title="Hi" subtitle="">
            <p>content</p>
          </DashboardShell>
        </MemoryRouter>
      ) : null;
    }
    render(
      <AuthProvider>
        <Shell />
      </AuthProvider>
    );
    const button = await screen.findByRole('button', { name: 'Edit profile' });
    expect(button.querySelector('img').getAttribute('src')).toBe(PHOTO);
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Edit profile' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('avatar helper', () => {
  it('refuses files that are not images or are far too big', async () => {
    const real = (await vi.importActual('../utils/avatar.js')).fileToAvatar;
    await expect(real(new File(['x'], 'a.txt', { type: 'text/plain' }))).rejects.toThrow(/image/);
    const big = new File(['x'], 'big.png', { type: 'image/png' });
    Object.defineProperty(big, 'size', { value: 11 * 1024 * 1024 });
    await expect(real(big)).rejects.toThrow(/too big/);
  });
});
