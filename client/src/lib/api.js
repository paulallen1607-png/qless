// Talks to the QLess server (server/src/routes.js) over HTTP.
// Login is remembered on this device ("Keep me logged in"), and each browser tab also keeps
// its own login, so one laptop can run a student tab and a staff tab side by side.
const TAB_KEY = 'qless_session';
const REMEMBER_KEY = 'qless_remembered_session';
let memToken = null;

const safe = (fn, fallback = null) => {
  try {
    return fn();
  } catch {
    return fallback;
  }
};

export const getToken = () =>
  safe(() => sessionStorage.getItem(TAB_KEY)) || safe(() => localStorage.getItem(REMEMBER_KEY)) || memToken;

export const setToken = (t, { remember = true } = {}) => {
  const previous = getToken();
  memToken = t || null;
  if (t) {
    safe(() => sessionStorage.setItem(TAB_KEY, t));
    if (remember) safe(() => localStorage.setItem(REMEMBER_KEY, t));
    else if (safe(() => localStorage.getItem(REMEMBER_KEY)) === t) safe(() => localStorage.removeItem(REMEMBER_KEY));
  } else {
    safe(() => sessionStorage.removeItem(TAB_KEY));
    if (safe(() => localStorage.getItem(REMEMBER_KEY)) === previous) safe(() => localStorage.removeItem(REMEMBER_KEY));
  }
};

export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError("Can't reach the QLess server. Check that it is running and you're on the same Wi-Fi.", 0);
  }
  const data = await res.json().catch(() => ({}));
  // A rejected session logs you out. A wrong password on a login form does not.
  const isLoginForm = /^\/auth\/(student|staff)\/(login|signup|forgot|reset)/.test(path);
  if (res.status === 401 && token && !isLoginForm) window.dispatchEvent(new Event('qless:unauthorized'));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status, data.fields);
  return data;
}
