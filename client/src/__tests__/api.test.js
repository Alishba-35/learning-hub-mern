import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshSession, request, setAccessToken } from '../services/api.js';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  setAccessToken(null);
});

describe('api service', () => {
  it('shares one refresh request between simultaneous callers', async () => {
    const fetchMock = vi.fn(async () => json(200, { accessToken: 'tok1', user: { name: 'A' } }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([refreshSession(), refreshSession()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.accessToken).toBe('tok1');
    expect(b.accessToken).toBe('tok1');
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const calls = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, opts) => {
        calls.push([url, opts.headers.Authorization]);
        if (url === '/api/auth/refresh') return json(200, { accessToken: 'fresh', user: {} });
        return calls.filter(([u]) => u === '/api/auth/me').length === 1
          ? json(401, { message: 'Invalid or expired token' })
          : json(200, { user: { name: 'A' } });
      })
    );
    setAccessToken('stale');

    const data = await request('/auth/me');

    expect(data.user.name).toBe('A');
    expect(calls.map(([u]) => u)).toEqual(['/api/auth/me', '/api/auth/refresh', '/api/auth/me']);
    expect(calls[2][1]).toBe('Bearer fresh');
  });

  it('does not try to refresh when login itself returns 401', async () => {
    const fetchMock = vi.fn(async () => json(401, { message: 'Invalid email or password' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toThrow(
      'Invalid email or password'
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('can send a keepalive request so it survives the page closing', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    await request('/progress/html/topics/intro/drafts/0', { method: 'PUT', body: { code: 'x' }, keepalive: true });
    expect(fetchMock.mock.calls[0][1].keepalive).toBe(true);
  });
});
