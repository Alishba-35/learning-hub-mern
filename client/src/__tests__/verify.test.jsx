import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthProvider.jsx';

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const CODE = 'LH-7K3M-9QXA-4TPW';

// Bina login wala visitor: refresh 401 deta hai, aur verify wala raasta public hai
function visit(verifyResponse) {
  const calls = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init = {}) => {
      calls.push(`${init.method || 'GET'} ${url}`);
      if (String(url).includes('/auth/refresh')) return json(401, { message: 'No session' });
      if (String(url).includes('/certificates/verify/')) return verifyResponse();
      return json(404, {});
    })
  );
  render(
    <MemoryRouter initialEntries={[`/verify/${CODE}`]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('certificate verify page (public)', () => {
  it('shows a genuine certificate to a visitor who is not logged in', async () => {
    const calls = visit(() => json(200, { valid: true, code: CODE, studentName: 'Alishba Noor', languageName: 'HTML', lessonCount: 8, issuedAt: '2026-11-20T10:00:00Z' }));
    expect(await screen.findByRole('heading', { name: 'This certificate is genuine' })).toBeTruthy();
    expect(screen.getByText('Alishba Noor')).toBeTruthy();
    expect(screen.getByText('HTML')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.getByText(CODE)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View the certificate (PDF)' }).getAttribute('href')).toBe(`/api/certificates/${CODE}/pdf`);
    expect(calls.some((c) => c.includes(`/certificates/verify/${CODE}`))).toBe(true);
    expect(screen.queryByText('Email')).toBeNull();
  });

  it('says clearly when a certificate was revoked', async () => {
    visit(() => json(200, { valid: false, revoked: true, message: 'This certificate has been revoked' }));
    expect(await screen.findByRole('heading', { name: 'This certificate has been revoked' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View the certificate (PDF)' })).toBeNull();
  });

  it('says when no certificate has that code', async () => {
    visit(() => json(404, { valid: false, message: 'No certificate found for this code' }));
    expect(await screen.findByRole('heading', { name: 'No certificate found' })).toBeTruthy();
    expect(screen.getByText(new RegExp(`code ${CODE}`))).toBeTruthy();
  });

  it('asks to try again later when the check itself fails', async () => {
    visit(() => json(429, { message: 'Too many requests, please try again soon' }));
    expect(await screen.findByRole('heading', { name: 'Could not check right now' })).toBeTruthy();
  });
});
