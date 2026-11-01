import { useState } from "react";
import { login, uploadResults } from "../api.js";

const TOKEN_KEY = "teacherToken";

export default function TeacherPortal() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));

  function handleLogin(newToken) {
    localStorage.setItem(TOKEN_KEY, newToken);
    setToken(newToken);
  }

  function handleLogout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
  }

  return token ? (
    <UploadForm token={token} onLogout={handleLogout} />
  ) : (
    <LoginForm onLogin={handleLogin} />
  );
}

function LoginForm({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await login(username, password);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card narrow">
      <h2>Teacher Login</h2>
      <form onSubmit={handleSubmit} className="stack">
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
        />
        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function UploadForm({ token, onLogout }) {
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setError("");
    setSummary(null);
    try {
      setSummary(await uploadResults(token, file));
    } catch (err) {
      // A 401 means the token is no longer valid — send the teacher back to login.
      if (err.status === 401) onLogout();
      setError(err.message);
      if (err.data?.errors) setSummary(err.data);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div className="result-head">
        <h2>Upload Results (CSV)</h2>
        <button className="secondary" onClick={onLogout}>
          Logout
        </button>
      </div>

      <p className="muted">
        Required columns: <code>student_id, student_name, subject, marks, grade</code>.
        Existing rows (same student_id + subject) are updated.
      </p>

      <form onSubmit={handleSubmit} className="row">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files[0] || null)}
        />
        <button type="submit" disabled={!file || loading}>
          {loading ? "Uploading..." : "Upload"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {summary && (
        <div className="result">
          <p>
            Created: <strong>{summary.created}</strong> &nbsp; Updated:{" "}
            <strong>{summary.updated}</strong> &nbsp; Students affected:{" "}
            <strong>{summary.students_affected}</strong>
          </p>
          {summary.errors?.length > 0 && (
            <>
              <p className="error">{summary.errors.length} row(s) skipped:</p>
              <ul>
                {summary.errors.map((e) => (
                  <li key={e.line}>
                    Line {e.line}: {e.error}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
