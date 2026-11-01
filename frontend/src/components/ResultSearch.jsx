import { useState } from "react";
import { getResult } from "../api.js";

export default function ResultSearch() {
  const [studentId, setStudentId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!studentId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      setResult(await getResult(studentId.trim()));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <h2>Check Your Result</h2>
      <form onSubmit={handleSubmit} className="row">
        <input
          placeholder="Enter Student ID (e.g. STU001)"
          value={studentId}
          onChange={(e) => setStudentId(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result-head">
            <div>
              <strong>{result.student_name}</strong>
              <div className="muted">ID: {result.student_id}</div>
            </div>
            <span className={`badge ${result.source}`}>
              served from {result.source}
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Marks</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              {result.subjects.map((s) => (
                <tr key={s.subject}>
                  <td>{s.subject}</td>
                  <td>{s.marks}</td>
                  <td>{s.grade}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total / Average</td>
                <td colSpan={2}>
                  {result.total_marks} / {result.average}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
