import React, { useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const choiceMarks = ["①", "②", "③", "④", "⑤"];

const questionTypes = [
  ["passage", "지문형"],
  ["listening", "듣기형"],
  ["notice", "안내문/도표"],
  ["table", "표"],
  ["dialogue", "대화문"],
  ["custom", "자유형"],
];

const typeLabel = Object.fromEntries(questionTypes);

function createQuestion(number, kind = "passage") {
  const prompts = {
    passage: "다음 글의 주제로 가장 적절한 것은?",
    listening: "대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.",
    notice: "다음 안내문의 내용과 일치하지 않는 것은?",
    table: "다음 표의 내용과 일치하지 않는 것은?",
    dialogue: "다음 대화의 빈칸에 들어갈 말로 가장 적절한 것은?",
    custom: "문항 발문을 입력하세요.",
  };
  return {
    id: crypto.randomUUID(),
    number,
    kind,
    score: "",
    prompt: prompts[kind] || prompts.custom,
    passage: "",
    choices: ["", "", "", "", ""],
    answer: "",
    note: "",
  };
}

function sampleDocument() {
  return {
    title: "영어영역 문제지",
    examTitle: "2026학년도 대학수학능력시험 문제지",
    subtitle: "과외용 수능 영어 연습",
    form: "홀수형",
    copyright: "이 문제지는 과외 수업용으로 제작되었습니다.",
    questions: [
      {
        ...createQuestion(18, "passage"),
        prompt: "다음 글의 목적으로 가장 적절한 것은?",
        passage:
          "Dear members of the school reading club,\n\nWe are pleased to announce that our monthly book talk will be held in the library this Friday. Students who wish to present a short review should submit the title of their book by Wednesday. We hope many members will join us and share their thoughts.",
        choices: [
          "독서 토론 발표 신청을 안내하려고",
          "도서관 이용 규칙 변경을 알리려고",
          "신입 회원 모집 일정을 공지하려고",
          "책 기부 행사의 결과를 보고하려고",
          "학교 축제 부스 운영을 제안하려고",
        ],
      },
      {
        ...createQuestion(19, "passage"),
        prompt: "다음 글에 드러난 Mina의 심경 변화로 가장 적절한 것은?",
        passage:
          "Mina stood in front of the classroom door, holding her speech cards so tightly that the edges bent. She could hear her classmates talking inside, and her heart beat faster. When her name was called, she took a slow breath and began. After a few sentences, she noticed her friend smiling and nodding. Her voice became steady, and by the end of the speech she felt proud of herself.",
        choices: [
          "nervous → confident",
          "bored → disappointed",
          "relieved → jealous",
          "angry → ashamed",
          "curious → confused",
        ],
      },
      {
        ...createQuestion(20, "notice"),
        prompt: "다음 안내문의 내용과 일치하지 않는 것은?",
        passage:
          "School Volunteer Day\nDate: July 12\nPlace: Green River Park\nParticipants: First- and second-year students\nActivities: Picking up trash, planting flowers\nBring: Water bottle, gloves, and a hat\nSign up by July 5 through the school website.",
        choices: [
          "행사는 7월 12일에 열린다.",
          "장소는 Green River Park이다.",
          "모든 학년 학생이 참가 대상이다.",
          "쓰레기 줍기와 꽃 심기 활동을 한다.",
          "학교 웹사이트를 통해 신청한다.",
        ],
      },
      {
        ...createQuestion(21, "table"),
        prompt: "다음 표의 내용과 일치하지 않는 것은?",
        score: "3",
        passage:
          "| Club | Day | Time | Room |\n| Debate | Monday | 4:00 | 201 |\n| Film | Tuesday | 3:30 | 105 |\n| Coding | Thursday | 4:30 | Lab 2 |",
        choices: [
          "Debate Club은 월요일에 모인다.",
          "Film Club은 3시 30분에 시작한다.",
          "Coding Club은 목요일에 모인다.",
          "Film Club은 Lab 2에서 활동한다.",
          "Debate Club의 활동 장소는 201호이다.",
        ],
      },
    ],
  };
}

function parsePipeTable(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.includes("|") && line.replace(/[|:\-\s]/g, ""))
    .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
}

function mostlyLatin(text) {
  const letters = Array.from(text).filter((ch) => /\p{L}/u.test(ch));
  if (!letters.length) return false;
  const latin = letters.filter((ch) => /[A-Za-z]/.test(ch)).length;
  return latin / letters.length > 0.72;
}

function normalizeChoiceLines(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  return Array.from({ length: Math.max(5, lines.length) }, (_, index) => lines[index] || "");
}

function QuestionBody({ question }) {
  const passage = question.passage?.trim();
  if (!passage) return null;

  if (question.kind === "table") {
    const rows = parsePipeTable(passage);
    if (rows.length) {
      return (
        <table className="exam-table">
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className={rowIndex === 0 ? "head-cell" : ""}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  }

  if (question.kind === "notice" || question.kind === "dialogue") {
    return (
      <div className="notice-box">
        {passage.split(/\r?\n/).map((line, index) => (
          <p key={index}>{line || "\u00a0"}</p>
        ))}
      </div>
    );
  }

  return (
    <div className={mostlyLatin(passage) ? "passage latin" : "passage"}>
      {passage.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph.replace(/\s+/g, " ").trim()}</p>
      ))}
    </div>
  );
}

function ExamQuestion({ question }) {
  const visibleChoices = question.choices.filter((choice) => choice.trim());
  return (
    <section className="exam-question">
      <h3>
        <span>{question.number}.</span>
        <span>
          {question.prompt}
          {question.score ? <em>[{question.score}점]</em> : null}
        </span>
      </h3>
      <QuestionBody question={question} />
      {visibleChoices.length ? (
        <ol className="choices">
          {visibleChoices.slice(0, 5).map((choice, index) => (
            <li key={index} className={mostlyLatin(choice) ? "latin" : ""}>
              <span className="choice-mark">{choiceMarks[index]}</span>
              <span>{choice}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}

function ExamPreview({ document }) {
  const subject = document.title.replace(" 문제지", "") || "영어영역";
  return (
    <article className="exam-page">
      <header className="exam-header">
        <div className="exam-title">{document.examTitle}</div>
        <div className="exam-rule" />
        <div className="exam-meta">
          <span>제3교시</span>
          <strong>{subject}</strong>
          <span>{document.form}</span>
        </div>
        <div className="exam-rule" />
      </header>
      <main className="exam-columns">
        {document.questions.map((question) => (
          <ExamQuestion key={question.id} question={question} />
        ))}
      </main>
      <footer className="exam-footer">
        <span>{document.copyright}</span>
        <b>1 1</b>
      </footer>
    </article>
  );
}

function App() {
  const saved = localStorage.getItem("latex-vibe-coder-doc");
  const [document, setDocument] = useState(() => {
    if (!saved) return sampleDocument();
    try {
      return JSON.parse(saved);
    } catch {
      return sampleDocument();
    }
  });
  const [selectedId, setSelectedId] = useState(document.questions[0]?.id || "");
  const [dragId, setDragId] = useState("");
  const importRef = useRef(null);

  const selected = useMemo(
    () => document.questions.find((question) => question.id === selectedId) || document.questions[0],
    [document.questions, selectedId],
  );

  function updateDocument(next) {
    const value = typeof next === "function" ? next(document) : next;
    setDocument(value);
    localStorage.setItem("latex-vibe-coder-doc", JSON.stringify(value));
  }

  function patchQuestion(id, patch) {
    updateDocument((doc) => ({
      ...doc,
      questions: doc.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    }));
  }

  function addQuestion(kind = "passage") {
    const nextNumber = Math.max(17, ...document.questions.map((q) => Number(q.number) || 0)) + 1;
    const question = createQuestion(nextNumber, kind);
    updateDocument((doc) => ({ ...doc, questions: [...doc.questions, question] }));
    setSelectedId(question.id);
  }

  function duplicateQuestion() {
    if (!selected) return;
    const clone = { ...selected, id: crypto.randomUUID(), number: Number(selected.number || 0) + 1 };
    updateDocument((doc) => ({ ...doc, questions: [...doc.questions, clone] }));
    setSelectedId(clone.id);
  }

  function deleteQuestion() {
    if (!selected || document.questions.length <= 1) return;
    const nextQuestions = document.questions.filter((question) => question.id !== selected.id);
    updateDocument((doc) => ({ ...doc, questions: nextQuestions }));
    setSelectedId(nextQuestions[0]?.id || "");
  }

  function reorder(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    updateDocument((doc) => {
      const list = [...doc.questions];
      const from = list.findIndex((q) => q.id === fromId);
      const to = list.findIndex((q) => q.id === toId);
      if (from < 0 || to < 0) return doc;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return { ...doc, questions: list };
    });
  }

  function renumber() {
    updateDocument((doc) => ({
      ...doc,
      questions: doc.questions.map((question, index) => ({ ...question, number: index + 1 })),
    }));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(window.document.createElement("a"), {
      href: url,
      download: "latex-vibe-coder-project.json",
    });
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = JSON.parse(String(reader.result));
        if (!Array.isArray(next.questions)) throw new Error("questions 배열이 없습니다.");
        updateDocument(next);
        setSelectedId(next.questions[0]?.id || "");
      } catch (error) {
        alert(`프로젝트를 열 수 없습니다: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>LaTeX Vibe Coder</strong>
          <span>GitHub Pages용 웹 편집기</span>
        </div>
        <nav>
          <button onClick={() => importRef.current?.click()}>JSON 열기</button>
          <button onClick={exportJson}>JSON 저장</button>
          <button className="primary" onClick={() => window.print()}>
            PDF 저장
          </button>
          <input ref={importRef} type="file" accept="application/json" onChange={importJson} hidden />
        </nav>
      </header>

      <aside className="sidebar glass">
        <div className="panel-title">
          <h2>문항</h2>
          <button onClick={() => addQuestion("passage")}>추가</button>
        </div>
        <div className="type-row">
          {questionTypes.slice(0, 4).map(([kind, label]) => (
            <button key={kind} onClick={() => addQuestion(kind)}>
              {label}
            </button>
          ))}
        </div>
        <div className="question-list">
          {document.questions.map((question) => (
            <button
              key={question.id}
              draggable
              className={question.id === selected?.id ? "selected" : ""}
              onClick={() => setSelectedId(question.id)}
              onDragStart={() => setDragId(question.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => reorder(dragId, question.id)}
            >
              <span>{question.number}</span>
              <b>{typeLabel[question.kind]}</b>
              <small>{question.prompt}</small>
            </button>
          ))}
        </div>
        <div className="sidebar-actions">
          <button onClick={duplicateQuestion}>복제</button>
          <button onClick={renumber}>번호 정리</button>
          <button className="danger" onClick={deleteQuestion}>
            삭제
          </button>
        </div>
      </aside>

      <section className="preview-shell glass">
        <div className="preview-toolbar">
          <div>
            <h1>{document.title}</h1>
            <p>시험지 미리보기는 출력 양식에 맞춰 표시됩니다.</p>
          </div>
          <button className="primary" onClick={() => window.print()}>
            PDF로 저장
          </button>
        </div>
        <div className="paper-scroll">
          <ExamPreview document={document} />
        </div>
      </section>

      <aside className="inspector glass">
        <h2>편집</h2>
        {selected ? (
          <div className="form-grid">
            <label>
              유형
              <select value={selected.kind} onChange={(event) => patchQuestion(selected.id, { kind: event.target.value })}>
                {questionTypes.map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              번호
              <input value={selected.number} onChange={(event) => patchQuestion(selected.id, { number: event.target.value })} />
            </label>
            <label>
              배점
              <select value={selected.score} onChange={(event) => patchQuestion(selected.id, { score: event.target.value })}>
                <option value="">없음</option>
                <option value="2">2점</option>
                <option value="3">3점</option>
              </select>
            </label>
            <label>
              형식
              <input value={document.form} onChange={(event) => updateDocument((doc) => ({ ...doc, form: event.target.value }))} />
            </label>
            <label className="wide">
              발문
              <textarea value={selected.prompt} onChange={(event) => patchQuestion(selected.id, { prompt: event.target.value })} />
            </label>
            <label className="wide">
              지문 / 안내문 / 표
              <textarea
                className="passage-editor"
                value={selected.passage}
                onChange={(event) => patchQuestion(selected.id, { passage: event.target.value })}
              />
            </label>
            <label className="wide">
              선택지
              <textarea
                value={selected.choices.join("\n")}
                onChange={(event) => patchQuestion(selected.id, { choices: normalizeChoiceLines(event.target.value) })}
              />
            </label>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
