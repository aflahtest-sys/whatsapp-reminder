const BASE = import.meta.env.VITE_API_URL || '/api';

let token = localStorage.getItem('token') || '';

export function setToken(value) {
  token = value || '';
  if (value) localStorage.setItem('token', value);
  else localStorage.removeItem('token');
}

export function getToken() {
  return token;
}

export default async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || res.statusText || 'Request failed');
    if (res.status === 401) setToken(null);
    throw err;
  }
  return data;
}
