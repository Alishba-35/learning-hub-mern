import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';
import { languages } from '../data/languages.js';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const testUser = { id: '1', name: 'Test', email: 't@example.com', role: 'student', purpose: '' };
const loggedIn = () => json(200, { accessToken: 'tok', user: testUser });
const loggedOut = () => json(401, { message: 'Session expired' });

// routes: { '/api/auth/refresh': () => Response, ... }
function mockApi(routes) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url) => (routes[url] ? routes[url]() : json(404, { message: 'Route not found' })))
  );
}

function renderApp(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('welcome page', () => {
  it('reveals the tagline on Start, then offers Go to Login', async () => {
    mockApi({ '/api/auth/refresh': loggedOut });
    renderApp('/');
    const user = userEvent.setup();
    expect(screen.queryByTestId('tagline')).toBeNull();

    await user.click(await screen.findByRole('button', { name: 'Start' }));
    expect(screen.getByTestId('tagline')).toBeTruthy();

    // animation ke baad (~0.9s) button "Go to Login" link ban jata hai
    const link = await screen.findByRole('link', { name: 'Go to Login' }, { timeout: 3000 });
    expect(link.getAttribute('href')).toBe('/login');
  });

  it('offers Go to Languages when already logged in', async () => {
    mockApi({ '/api/auth/refresh': loggedIn });
    renderApp('/');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Start' }));
    const link = await screen.findByRole('link', { name: 'Go to Languages' }, { timeout: 3000 });
    expect(link.getAttribute('href')).toBe('/languages');
  });
});

describe('routing and auth', () => {
  it('sends a logged-out visitor from /languages to the login page', async () => {
    mockApi({ '/api/auth/refresh': loggedOut });
    renderApp('/languages');
    expect(await screen.findByRole('heading', { name: /login/i })).toBeTruthy();
    expect(screen.queryByText('Hi, Test')).toBeNull();
  });

  it('shows all language cards and no navbar on the languages page', async () => {
    mockApi({ '/api/auth/refresh': loggedIn });
    renderApp('/languages');
    expect((await screen.findAllByRole('link', { name: 'Start' })).length).toBe(languages.length);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('shows the navbar with Shorts Study, name and Logout on the shorts page', async () => {
    mockApi({ '/api/auth/refresh': loggedIn });
    renderApp('/shorts');
    expect(await screen.findByRole('navigation')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Shorts Study' }).getAttribute('href')).toBe('/shorts');
    expect(screen.getByText('Hi, Test')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Logout' })).toBeTruthy();
  });

  it('logs in through the form and lands on the languages page', async () => {
    mockApi({
      '/api/auth/refresh': loggedOut,
      '/api/auth/login': loggedIn,
    });
    renderApp('/login');
    const user = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Login form' }));
    await user.type(form.getByLabelText('Email'), 't@example.com');
    await user.type(form.getByLabelText('Password'), 'Test@1234');
    await user.click(form.getByRole('button', { name: 'Login' }));
    expect((await screen.findAllByRole('link', { name: 'Start' })).length).toBe(languages.length);
  });

  it('shows the server message when the password is wrong', async () => {
    mockApi({
      '/api/auth/refresh': loggedOut,
      '/api/auth/login': () => json(401, { message: 'Invalid email or password' }),
    });
    renderApp('/login');
    const user = userEvent.setup();
    const form = within(await screen.findByRole('form', { name: 'Login form' }));
    await user.type(form.getByLabelText('Email'), 't@example.com');
    await user.type(form.getByLabelText('Password'), 'WrongPass1');
    await user.click(form.getByRole('button', { name: 'Login' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Invalid email or password');
  });

  it('slides to signup, hides the login form, and shows per-field server errors', async () => {
    mockApi({
      '/api/auth/refresh': loggedOut,
      '/api/auth/register': () =>
        json(400, { message: 'Validation failed', errors: [{ field: 'email', message: 'Invalid email address' }] }),
    });
    renderApp('/login');
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Sign up' }));

    expect(screen.queryByRole('form', { name: 'Login form' })).toBeNull();
    const form = within(screen.getByRole('form', { name: 'Signup form' }));
    await user.type(form.getByLabelText('Name'), 'Test User');
    await user.type(form.getByLabelText('Email'), 'a@b.co');
    await user.type(form.getByLabelText('Password'), 'Test@1234');
    await user.click(form.getByRole('button', { name: 'Sign up' }));
    expect(await screen.findByText('Invalid email address')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Back to Login' }));
    expect(screen.getByRole('form', { name: 'Login form' })).toBeTruthy();
  });

  it('shows the not-found page for unknown routes and unknown languages', async () => {
    mockApi({ '/api/auth/refresh': loggedIn });
    renderApp('/learn/fortran');
    expect(await screen.findByText('Page not found')).toBeTruthy();
  });
});
