import { useState } from "react";
import ResultSearch from "./components/ResultSearch.jsx";
import TeacherPortal from "./components/TeacherPortal.jsx";

export default function App() {
  const [tab, setTab] = useState("student");

  return (
    <div className="container">
      <header>
        <h1>Result Portal</h1>
        <nav>
          <button
            className={tab === "student" ? "active" : ""}
            onClick={() => setTab("student")}
          >
            Check Result
          </button>
          <button
            className={tab === "teacher" ? "active" : ""}
            onClick={() => setTab("teacher")}
          >
            Teacher Portal
          </button>
        </nav>
      </header>

      <main>{tab === "student" ? <ResultSearch /> : <TeacherPortal />}</main>
    </div>
  );
}
