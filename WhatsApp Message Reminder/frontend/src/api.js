// In development the Vite proxy forwards /api to the backend (see vite.config.js).
// In production there is no proxy, so VITE_API_URL must be set at BUILD time --
// Vite inlines it into the bundle, it is not read at runtime.
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const TOKEN_KEY = 'token';

let token = '';
try {
  token = localStorage.getItem(TOKEN_KEY) || '';
} catch {
  // Private browsing can throw on access; fall back to memory-only auth.
  token = '';
}

const listeners = new Set();

export function setToken(value) {
  token = value || '';
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* memory-only is fine */
  }
  if (!value) listeners.forEach((fn) => fn());
}

export function getToken() {
  return token;
}

/** Called when the server rejects our token, so the app can show the login screen. */
export function onSignedOut(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function withQuery(path, query) {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export default async function api(path, { method = 'GET', body, query, signal } = {}) {
  let res;
  try {
    res = await fetch(BASE + withQuery(path, query), {
      method,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    // fetch only rejects on a genuine network failure, so say so plainly rather
    // than surfacing "Failed to fetch".
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  // The body read can fail too -- a connection dropped after the headers
  // arrived should still read as "cannot reach the server", not as a raw
  // TypeError shown to the user.
  let text = '';
  try {
    text = await res.text();
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Lost connection while loading the response. Please try again.');
  }

  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    if (res.status === 401) setToken(null);
    if (res.status === 429) {
      throw new Error(data.error || 'Too many requests. Please wait a moment.');
    }
    throw new Error(data.error || res.statusText || 'Request failed');
  }

  return data;
}
