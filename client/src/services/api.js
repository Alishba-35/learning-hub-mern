const BASE = '/api';

// Access token sirf memory mein rehta hai (localStorage mein nahi), is liye XSS se chori ka khatra kam.
let accessToken = null;
let refreshPromise = null;
let onAuthFailure = () => {};

export const setAccessToken = (token) => {
  accessToken = token;
};
export const setAuthFailureHandler = (handler) => {
  onAuthFailure = handler;
};

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function send(path, { method = 'GET', body, auth = true, keepalive = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(BASE + path, {
    method,
    headers,
    credentials: 'include',
    keepalive, // page band hote waqt bhi request poori hoti hai (auto-save ke liye)
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  if (res.status !== 204) {
    try {
      data = await res.json();
    } catch {
      data = null;
    }
  }
  return { res, data };
}

// Ek waqt mein sirf ek refresh request chalti hai, baqi sab usi ka intezar karti hain.
// (React StrictMode effect do baar chalata hai; warna doosri call token rotation ki wajah se fail hoti.)
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = send('/auth/refresh', { method: 'POST', auth: false })
      .then(({ res, data }) => {
        if (!res.ok) throw new ApiError(data?.message || 'Session expired', res.status);
        accessToken = data.accessToken;
        return data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function request(path, options = {}) {
  let { res, data } = await send(path, options);

  // Token expire ho gaya? Ek baar refresh karke wohi request dobara bhejo.
  if (res.status === 401 && options.auth !== false) {
    try {
      await refreshSession();
    } catch {
      accessToken = null;
      onAuthFailure();
      throw new ApiError('Session expired', 401);
    }
    ({ res, data } = await send(path, options));
  }

  if (!res.ok) throw new ApiError(data?.message || 'Request failed', res.status, data?.errors);
  return data;
}
