// All requests go to the same origin under /api; nginx (or the Vite dev
// server) forwards them to Django. No backend URL is baked into the build.
const API = "/api";

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data.detail ||
      data.non_field_errors?.[0] ||
      `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export function getResult(studentId) {
  return fetch(`${API}/results/${encodeURIComponent(studentId)}/`).then(handle);
}

export function login(username, password) {
  return fetch(`${API}/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  }).then(handle);
}

export function uploadResults(token, file) {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${API}/results/upload/`, {
    method: "POST",
    headers: { Authorization: `Token ${token}` },
    body: form,
  }).then(handle);
}
