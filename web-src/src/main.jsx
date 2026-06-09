import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const choiceMarks = ["①", "②", "③", "④", "⑤"];
const DEFAULT_QUESTION_SIZE = 100;
const DEFAULT_FONT_SIZE = 100;
const QUESTION_SIZE_RANGE = { min: 70, max: 140 };
const FONT_SIZE_RANGE = { min: 70, max: 150 };

const questionTypes = [
  ["passage", "지문형"],
  ["listening", "듣기형"],
  ["notice", "안내문/도표"],
  ["table", "표"],
  ["dialogue", "대화문"],
  ["custom", "자유형"],
];

const typeLabel = Object.fromEntries(questionTypes);

function documentFieldKey(field) {
  return `document:${field}`;
}

function questionFieldKey(questionId, field) {
  return `${questionId}:${field}`;
}

function previewTargetKey(target) {
  return target.questionId ? questionFieldKey(target.questionId, target.field) : documentFieldKey(target.field);
}

function previewElementKey(target) {
  const key = previewTargetKey(target);
  return Number.isInteger(target.choiceIndex) ? `${key}:${target.choiceIndex}` : key;
}

function previewEditableProps(target, onPreviewEdit) {
  function activate(event) {
    event.stopPropagation();
    onPreviewEdit?.(target);
  }

  return {
    role: "button",
    tabIndex: 0,
    title: "클릭해서 편집",
    onClick: activate,
    onKeyDown: (event) => {
      if (event.key === "Enter" || event.key === " ") {
        activate(event);
      }
    },
  };
}

function previewEditableClassName(baseClass, activeFieldKey, target) {
  return [
    baseClass,
    "preview-editable",
    activeFieldKey === previewElementKey(target) ? "preview-editable-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function clampPercent(value, range, fallback = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(number)));
}

function questionSize(question) {
  return clampPercent(question.size, QUESTION_SIZE_RANGE, DEFAULT_QUESTION_SIZE);
}

function questionFontSize(question) {
  return clampPercent(question.fontSize, FONT_SIZE_RANGE, DEFAULT_FONT_SIZE);
}

function pt(value) {
  return `${Number(value.toFixed(2))}pt`;
}

function questionStyle(question) {
  const sizeScale = questionSize(question) / 100;
  const fontScale = questionFontSize(question) / 100;
  const effectiveFontScale = sizeScale * fontScale;
  return {
    "--question-margin-bottom": pt(8 * sizeScale),
    "--question-font-size": pt(9.35 * effectiveFontScale),
    "--question-heading-gap": pt(4 * sizeScale),
    "--question-heading-margin-bottom": pt(3 * sizeScale),
    "--question-heading-font-size": pt(10.2 * effectiveFontScale),
    "--question-score-margin-left": pt(2 * sizeScale),
    "--question-score-font-size": pt(9 * effectiveFontScale),
    "--question-paragraph-margin-bottom": pt(4 * sizeScale),
    "--question-choice-margin-top": pt(2 * sizeScale),
    "--question-choice-gap": pt(5 * sizeScale),
    "--question-choice-margin-bottom": pt(1.2 * sizeScale),
    "--question-choice-mark-width": pt(12 * sizeScale),
    "--question-notice-margin-top": pt(4 * sizeScale),
    "--question-notice-margin-bottom": pt(5 * sizeScale),
    "--question-notice-padding-y": pt(8 * sizeScale),
    "--question-notice-padding-x": pt(9 * sizeScale),
    "--question-table-margin-top": pt(5 * sizeScale),
    "--question-table-margin-bottom": pt(6 * sizeScale),
    "--question-table-font-size": pt(8.3 * effectiveFontScale),
    "--question-table-padding-y": pt(3 * sizeScale),
    "--question-table-padding-x": pt(4 * sizeScale),
  };
}

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
    size: DEFAULT_QUESTION_SIZE,
    fontSize: DEFAULT_FONT_SIZE,
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

function QuestionBody({ activeFieldKey, onPreviewEdit, question }) {
  const passage = question.passage?.trim();
  if (!passage) return null;
  const passageTarget = { questionId: question.id, field: "passage" };

  if (question.kind === "table") {
    const rows = parsePipeTable(passage);
    if (rows.length) {
      return (
        <table
          className={previewEditableClassName("exam-table", activeFieldKey, passageTarget)}
          {...previewEditableProps(passageTarget, onPreviewEdit)}
        >
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
      <div
        className={previewEditableClassName("notice-box", activeFieldKey, passageTarget)}
        {...previewEditableProps(passageTarget, onPreviewEdit)}
      >
        {passage.split(/\r?\n/).map((line, index) => (
          <p key={index}>{line || "\u00a0"}</p>
        ))}
      </div>
    );
  }

  return (
    <div
      className={previewEditableClassName(mostlyLatin(passage) ? "passage latin" : "passage", activeFieldKey, passageTarget)}
      {...previewEditableProps(passageTarget, onPreviewEdit)}
    >
      {passage.split(/\n\s*\n/).map((paragraph, index) => (
        <p key={index}>{paragraph.replace(/\s+/g, " ").trim()}</p>
      ))}
    </div>
  );
}

function ExamQuestion({ activeFieldKey, onPreviewEdit, question, selectedId }) {
  const visibleChoices = question.choices
    .map((choice, index) => ({ choice, index }))
    .filter(({ choice }) => choice.trim());
  const sizeTarget = { questionId: question.id, field: "size" };
  const numberTarget = { questionId: question.id, field: "number" };
  const promptTarget = { questionId: question.id, field: "prompt" };
  const scoreTarget = { questionId: question.id, field: "score" };
  const isSizingActive = activeFieldKey === previewElementKey(sizeTarget);
  return (
    <section
      className={[
        "exam-question",
        "preview-question-clickable",
        question.id === selectedId ? "preview-question-selected" : "",
        isSizingActive ? "preview-question-size-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={questionStyle(question)}
      title="문제 크기 조정"
      onClick={() => onPreviewEdit?.(sizeTarget)}
    >
      <h3>
        <span
          className={previewEditableClassName("question-number", activeFieldKey, numberTarget)}
          {...previewEditableProps(numberTarget, onPreviewEdit)}
        >
          {question.number}.
        </span>
        <span
          className={previewEditableClassName("question-prompt", activeFieldKey, promptTarget)}
          {...previewEditableProps(promptTarget, onPreviewEdit)}
        >
          {question.prompt}
          {question.score ? (
            <em
              className={previewEditableClassName("question-score", activeFieldKey, scoreTarget)}
              {...previewEditableProps(scoreTarget, onPreviewEdit)}
            >
              [{question.score}점]
            </em>
          ) : null}
        </span>
      </h3>
      <QuestionBody activeFieldKey={activeFieldKey} onPreviewEdit={onPreviewEdit} question={question} />
      {visibleChoices.length ? (
        <ol className="choices">
          {visibleChoices.slice(0, 5).map(({ choice, index }, visibleIndex) => {
            const choiceTarget = { questionId: question.id, field: "choices", choiceIndex: index };
            return (
              <li
                key={index}
                className={previewEditableClassName(mostlyLatin(choice) ? "latin" : "", activeFieldKey, choiceTarget)}
                {...previewEditableProps(choiceTarget, onPreviewEdit)}
              >
                <span className="choice-mark">{choiceMarks[visibleIndex]}</span>
                <span>{choice}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function ExamPreview({ activeFieldKey, document, onPreviewEdit, selectedId }) {
  const subject = (document.title || "").replace(" 문제지", "") || "영어영역";
  const examTitleTarget = { field: "examTitle" };
  const titleTarget = { field: "title" };
  const formTarget = { field: "form" };
  const copyrightTarget = { field: "copyright" };
  return (
    <article className="exam-page">
      <header className="exam-header">
        <div
          className={previewEditableClassName("exam-title", activeFieldKey, examTitleTarget)}
          {...previewEditableProps(examTitleTarget, onPreviewEdit)}
        >
          {document.examTitle || ""}
        </div>
        <div className="exam-rule" />
        <div className="exam-meta">
          <span>제3교시</span>
          <strong
            className={previewEditableClassName("", activeFieldKey, titleTarget)}
            {...previewEditableProps(titleTarget, onPreviewEdit)}
          >
            {subject}
          </strong>
          <span
            className={previewEditableClassName("", activeFieldKey, formTarget)}
            {...previewEditableProps(formTarget, onPreviewEdit)}
          >
            {document.form || ""}
          </span>
        </div>
        <div className="exam-rule" />
      </header>
      <main className="exam-columns">
        {document.questions.map((question) => (
          <ExamQuestion
            key={question.id}
            activeFieldKey={activeFieldKey}
            onPreviewEdit={onPreviewEdit}
            question={question}
            selectedId={selectedId}
          />
        ))}
      </main>
      <footer className="exam-footer">
        <span
          className={previewEditableClassName("", activeFieldKey, copyrightTarget)}
          {...previewEditableProps(copyrightTarget, onPreviewEdit)}
        >
          {document.copyright || ""}
        </span>
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
  const [focusRequest, setFocusRequest] = useState(null);
  const importRef = useRef(null);
  const fieldRefs = useRef({});

  const selected = useMemo(
    () => document.questions.find((question) => question.id === selectedId) || document.questions[0],
    [document.questions, selectedId],
  );
  const activeFieldKey = focusRequest?.key || "";
  const activePreviewKey = focusRequest ? previewElementKey(focusRequest) : "";

  useEffect(() => {
    if (!focusRequest) return;
    const input = fieldRefs.current[focusRequest.key];
    if (!input) return;

    input.scrollIntoView({ behavior: "smooth", block: "center" });
    window.requestAnimationFrame(() => {
      input.focus({ preventScroll: true });
      if (
        focusRequest.field === "choices" &&
        Number.isInteger(focusRequest.choiceIndex) &&
        typeof input.setSelectionRange === "function"
      ) {
        const lines = input.value.split("\n");
        const start = lines
          .slice(0, focusRequest.choiceIndex)
          .reduce((total, line) => total + line.length + 1, 0);
        const end = start + (lines[focusRequest.choiceIndex]?.length || 0);
        input.setSelectionRange(start, end);
      } else if (typeof input.select === "function") {
        input.select();
      }
    });
  }, [focusRequest]);

  function bindField(key) {
    return (node) => {
      if (node) fieldRefs.current[key] = node;
    };
  }

  function fieldLabelClassName(key, baseClass = "") {
    return [baseClass, activeFieldKey === key ? "linked-field" : ""].filter(Boolean).join(" ") || undefined;
  }

  function focusPreviewTarget(target) {
    if (target.questionId) setSelectedId(target.questionId);
    setFocusRequest({ ...target, key: previewTargetKey(target), stamp: Date.now() });
  }

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

  function patchQuestionSizing(field, value) {
    if (!selected) return;
    const range = field === "fontSize" ? FONT_SIZE_RANGE : QUESTION_SIZE_RANGE;
    const fallback = field === "fontSize" ? DEFAULT_FONT_SIZE : DEFAULT_QUESTION_SIZE;
    patchQuestion(selected.id, { [field]: clampPercent(value, range, fallback) });
  }

  function applySizingToAllQuestions() {
    if (!selected) return;
    const size = questionSize(selected);
    const fontSize = questionFontSize(selected);
    updateDocument((doc) => ({
      ...doc,
      questions: doc.questions.map((question) => ({ ...question, size, fontSize })),
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
          <ExamPreview
            activeFieldKey={activePreviewKey}
            document={document}
            onPreviewEdit={focusPreviewTarget}
            selectedId={selected?.id}
          />
        </div>
      </section>

      <aside className="inspector glass">
        <h2>편집</h2>
        {selected ? (
          <div className="form-grid">
            <div className="sizing-panel wide">
              <label className={fieldLabelClassName(questionFieldKey(selected.id, "size"), "sizing-label")}>
                <span>문제 크기</span>
                <div className="range-line">
                  <input
                    ref={bindField(questionFieldKey(selected.id, "size"))}
                    type="range"
                    min={QUESTION_SIZE_RANGE.min}
                    max={QUESTION_SIZE_RANGE.max}
                    value={questionSize(selected)}
                    onChange={(event) => patchQuestionSizing("size", event.target.value)}
                  />
                  <input
                    aria-label="문제 크기 값"
                    className="percent-input"
                    type="number"
                    min={QUESTION_SIZE_RANGE.min}
                    max={QUESTION_SIZE_RANGE.max}
                    value={questionSize(selected)}
                    onChange={(event) => patchQuestionSizing("size", event.target.value)}
                  />
                </div>
              </label>
              <label className={fieldLabelClassName(questionFieldKey(selected.id, "fontSize"), "sizing-label")}>
                <span>폰트 크기</span>
                <div className="range-line">
                  <input
                    ref={bindField(questionFieldKey(selected.id, "fontSize"))}
                    type="range"
                    min={FONT_SIZE_RANGE.min}
                    max={FONT_SIZE_RANGE.max}
                    value={questionFontSize(selected)}
                    onChange={(event) => patchQuestionSizing("fontSize", event.target.value)}
                  />
                  <input
                    aria-label="폰트 크기 값"
                    className="percent-input"
                    type="number"
                    min={FONT_SIZE_RANGE.min}
                    max={FONT_SIZE_RANGE.max}
                    value={questionFontSize(selected)}
                    onChange={(event) => patchQuestionSizing("fontSize", event.target.value)}
                  />
                </div>
              </label>
              <button className="apply-all" onClick={applySizingToAllQuestions}>
                전체 문제에 적용
              </button>
            </div>
            <label className={fieldLabelClassName(documentFieldKey("examTitle"), "wide")}>
              시험지 제목
              <input
                ref={bindField(documentFieldKey("examTitle"))}
                value={document.examTitle || ""}
                onChange={(event) => updateDocument((doc) => ({ ...doc, examTitle: event.target.value }))}
              />
            </label>
            <label className={fieldLabelClassName(documentFieldKey("title"))}>
              영역명
              <input
                ref={bindField(documentFieldKey("title"))}
                value={document.title || ""}
                onChange={(event) => updateDocument((doc) => ({ ...doc, title: event.target.value }))}
              />
            </label>
            <label className={fieldLabelClassName(documentFieldKey("form"))}>
              형식
              <input
                ref={bindField(documentFieldKey("form"))}
                value={document.form || ""}
                onChange={(event) => updateDocument((doc) => ({ ...doc, form: event.target.value }))}
              />
            </label>
            <label className={fieldLabelClassName(documentFieldKey("copyright"), "wide")}>
              꼬리말
              <input
                ref={bindField(documentFieldKey("copyright"))}
                value={document.copyright || ""}
                onChange={(event) => updateDocument((doc) => ({ ...doc, copyright: event.target.value }))}
              />
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "kind"))}>
              유형
              <select
                ref={bindField(questionFieldKey(selected.id, "kind"))}
                value={selected.kind}
                onChange={(event) => patchQuestion(selected.id, { kind: event.target.value })}
              >
                {questionTypes.map(([kind, label]) => (
                  <option key={kind} value={kind}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "number"))}>
              번호
              <input
                ref={bindField(questionFieldKey(selected.id, "number"))}
                value={selected.number}
                onChange={(event) => patchQuestion(selected.id, { number: event.target.value })}
              />
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "score"))}>
              배점
              <select
                ref={bindField(questionFieldKey(selected.id, "score"))}
                value={selected.score}
                onChange={(event) => patchQuestion(selected.id, { score: event.target.value })}
              >
                <option value="">없음</option>
                <option value="2">2점</option>
                <option value="3">3점</option>
              </select>
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "prompt"), "wide")}>
              발문
              <textarea
                ref={bindField(questionFieldKey(selected.id, "prompt"))}
                value={selected.prompt}
                onChange={(event) => patchQuestion(selected.id, { prompt: event.target.value })}
              />
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "passage"), "wide")}>
              지문 / 안내문 / 표
              <textarea
                ref={bindField(questionFieldKey(selected.id, "passage"))}
                className="passage-editor"
                value={selected.passage}
                onChange={(event) => patchQuestion(selected.id, { passage: event.target.value })}
              />
            </label>
            <label className={fieldLabelClassName(questionFieldKey(selected.id, "choices"), "wide")}>
              선택지
              <textarea
                ref={bindField(questionFieldKey(selected.id, "choices"))}
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

const rootElement = document.getElementById("root");
const root = rootElement._latexVibeCoderRoot || createRoot(rootElement);
rootElement._latexVibeCoderRoot = root;
root.render(<App />);
