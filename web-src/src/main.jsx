import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const choiceMarks = ["①", "②", "③", "④", "⑤"];
const STORE_KEY = "problem-editor-store-v1";
const LEGACY_DOC_KEY = "latex-vibe-coder-doc";
const DEFAULT_QUESTION_SIZE = 100;
const DEFAULT_FONT_SIZE = 100;
const DEFAULT_QUESTION_SPACING = 10;
const QUESTION_SIZE_RANGE = { min: 70, max: 140 };
const FONT_SIZE_RANGE = { min: 70, max: 150 };
const QUESTION_SPACING_RANGE = { min: 0, max: 44 };

const questionTypes = [
  ["passage", "지문형"],
  ["listening", "듣기형"],
  ["notice", "안내문/도표"],
  ["table", "표"],
  ["dialogue", "대화문"],
  ["custom", "자유형"],
];

const typeLabel = Object.fromEntries(questionTypes);

function createId(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso() {
  return new Date().toISOString();
}

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

function clampNumber(value, range, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(number)));
}

function questionSize(question) {
  return clampNumber(question?.size, QUESTION_SIZE_RANGE, DEFAULT_QUESTION_SIZE);
}

function questionFontSize(question) {
  return clampNumber(question?.fontSize, FONT_SIZE_RANGE, DEFAULT_FONT_SIZE);
}

function questionSpacing(question) {
  return clampNumber(question?.spacing, QUESTION_SPACING_RANGE, DEFAULT_QUESTION_SPACING);
}

function pt(value) {
  return `${Number(value.toFixed(2))}pt`;
}

function questionStyle(question) {
  const sizeScale = questionSize(question) / 100;
  const fontScale = questionFontSize(question) / 100;
  const effectiveFontScale = sizeScale * fontScale;
  return {
    "--question-margin-bottom": pt(questionSpacing(question) * sizeScale),
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

function createPage(number = 1) {
  return {
    id: createId("page"),
    title: `${number}쪽`,
  };
}

function createQuestion(number, kind = "passage", pageId = "") {
  const prompts = {
    passage: "다음 글의 주제로 가장 적절한 것은?",
    listening: "대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.",
    notice: "다음 안내문의 내용과 일치하지 않는 것은?",
    table: "다음 표의 내용과 일치하지 않는 것은?",
    dialogue: "다음 대화의 빈칸에 들어갈 말로 가장 적절한 것은?",
    custom: "문항 발문을 입력하세요.",
  };
  return {
    id: createId("question"),
    pageId,
    number,
    kind,
    score: "",
    prompt: prompts[kind] || prompts.custom,
    passage: "",
    choices: ["", "", "", "", ""],
    size: DEFAULT_QUESTION_SIZE,
    fontSize: DEFAULT_FONT_SIZE,
    spacing: DEFAULT_QUESTION_SPACING,
    answer: "",
    note: "",
  };
}

function sampleDocument() {
  const firstPage = createPage(1);
  return {
    title: "영어영역 문제지",
    examTitle: "2026학년도 대학수학능력시험 문제지",
    subtitle: "과외용 수능 영어 연습",
    form: "홀수형",
    copyright: "이 문제지는 과외 수업용으로 제작되었습니다.",
    pages: [firstPage],
    questions: [
      {
        ...createQuestion(18, "passage", firstPage.id),
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
        ...createQuestion(19, "passage", firstPage.id),
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
        ...createQuestion(20, "notice", firstPage.id),
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
        ...createQuestion(21, "table", firstPage.id),
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

function normalizeChoiceArray(value) {
  const choices = Array.isArray(value) ? value.map((choice) => String(choice || "")) : [];
  return Array.from({ length: Math.max(5, choices.length) }, (_, index) => choices[index] || "");
}

function normalizeChoiceLines(value) {
  const lines = value.split(/\r?\n/).map((line) => line.trim());
  return Array.from({ length: Math.max(5, lines.length) }, (_, index) => lines[index] || "");
}

function normalizeDocument(input) {
  const fallback = sampleDocument();
  const raw = input && typeof input === "object" ? input : fallback;
  const rawPages = Array.isArray(raw.pages) && raw.pages.length ? raw.pages : [{ title: "1쪽" }];
  const pages = rawPages.map((page, index) => ({
    id: page?.id || createId("page"),
    title: page?.title || `${index + 1}쪽`,
  }));
  const validPageIds = new Set(pages.map((page) => page.id));
  const firstPageId = pages[0].id;
  const rawQuestions = Array.isArray(raw.questions) && raw.questions.length ? raw.questions : fallback.questions;
  const questions = rawQuestions.map((question, index) => {
    const kind = question?.kind || "passage";
    const base = createQuestion(Number(question?.number) || 18 + index, kind, firstPageId);
    return {
      ...base,
      ...question,
      id: question?.id || base.id,
      pageId: validPageIds.has(question?.pageId) ? question.pageId : firstPageId,
      kind,
      choices: normalizeChoiceArray(question?.choices),
      size: questionSize(question),
      fontSize: questionFontSize(question),
      spacing: questionSpacing(question),
    };
  });

  return {
    title: raw.title || fallback.title,
    examTitle: raw.examTitle || fallback.examTitle,
    subtitle: raw.subtitle || fallback.subtitle,
    form: raw.form || fallback.form,
    copyright: raw.copyright || fallback.copyright,
    pages,
    questions,
  };
}

function orderedQuestions(document) {
  const knownPageIds = new Set(document.pages.map((page) => page.id));
  const ordered = document.pages.flatMap((page) => document.questions.filter((question) => question.pageId === page.id));
  const orphaned = document.questions.filter((question) => !knownPageIds.has(question.pageId));
  return [...ordered, ...orphaned];
}

function resequenceDocument(document, startNumber = 18) {
  const ordered = orderedQuestions(document).map((question, index) => ({ ...question, number: startNumber + index }));
  return { ...document, questions: ordered };
}

function emptyStore() {
  return {
    activeUserId: "",
    activeStudentIdByUser: {},
    activeFileIdByUser: {},
    users: [],
    students: [],
    files: [],
  };
}

function normalizeStore(input) {
  const store = input && typeof input === "object" ? input : emptyStore();
  return {
    ...emptyStore(),
    ...store,
    activeStudentIdByUser: store.activeStudentIdByUser || {},
    activeFileIdByUser: store.activeFileIdByUser || {},
    users: Array.isArray(store.users) ? store.users : [],
    students: Array.isArray(store.students) ? store.students : [],
    files: Array.isArray(store.files)
      ? store.files.map((file) => ({ ...file, document: normalizeDocument(file.document) }))
      : [],
  };
}

function loadStore() {
  try {
    return normalizeStore(JSON.parse(localStorage.getItem(STORE_KEY) || "null"));
  } catch {
    return emptyStore();
  }
}

function loadLegacyDocument() {
  try {
    const value = localStorage.getItem(LEGACY_DOC_KEY);
    return value ? normalizeDocument(JSON.parse(value)) : sampleDocument();
  } catch {
    return sampleDocument();
  }
}

function saveStore(store) {
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

function createStudent(userId, name) {
  return {
    id: createId("student"),
    userId,
    name: name || "미분류",
    createdAt: nowIso(),
  };
}

function createFile(userId, studentId, name, document = sampleDocument()) {
  return {
    id: createId("file"),
    userId,
    studentId,
    name: name || "새 문제지",
    document: normalizeDocument(document),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function ensureUserWorkspace(store, userId) {
  const next = normalizeStore(store);
  let students = next.students.filter((student) => student.userId === userId);
  if (!students.length) {
    const student = createStudent(userId, "미분류");
    next.students = [...next.students, student];
    students = [student];
  }

  let activeStudentId = next.activeStudentIdByUser[userId];
  if (!students.some((student) => student.id === activeStudentId)) {
    activeStudentId = students[0].id;
    next.activeStudentIdByUser = { ...next.activeStudentIdByUser, [userId]: activeStudentId };
  }

  let files = next.files.filter((file) => file.userId === userId && file.studentId === activeStudentId);
  if (!files.length) {
    const file = createFile(userId, activeStudentId, "새 문제지", loadLegacyDocument());
    next.files = [...next.files, file];
    files = [file];
  }

  let activeFileId = next.activeFileIdByUser[userId];
  if (!files.some((file) => file.id === activeFileId)) {
    activeFileId = files[0].id;
    next.activeFileIdByUser = { ...next.activeFileIdByUser, [userId]: activeFileId };
  }

  return next;
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

function ExamPreview({ activeFieldKey, document, onPreviewEdit, page, pageNumber, questions, selectedId, totalPages }) {
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
        {questions.length ? (
          questions.map((question) => (
            <ExamQuestion
              key={question.id}
              activeFieldKey={activeFieldKey}
              onPreviewEdit={onPreviewEdit}
              question={question}
              selectedId={selectedId}
            />
          ))
        ) : (
          <div className="empty-page-note">{page?.title || `${pageNumber}쪽`}에 문항이 없습니다.</div>
        )}
      </main>
      <footer className="exam-footer">
        <span
          className={previewEditableClassName("", activeFieldKey, copyrightTarget)}
          {...previewEditableProps(copyrightTarget, onPreviewEdit)}
        >
          {document.copyright || ""}
        </span>
        <b>
          {pageNumber} / {totalPages}
        </b>
      </footer>
    </article>
  );
}

function LoginScreen({ loginName, onChangeLoginName, onLogin, users }) {
  return (
    <div className="login-shell">
      <section className="login-card glass">
        <h1>문제 편집기</h1>
        <p>이 브라우저 안에 저장되는 로컬 계정으로 로그인합니다.</p>
        <form onSubmit={onLogin}>
          <label>
            계정 이름
            <input
              autoFocus
              value={loginName}
              placeholder="예: 김쌤"
              onChange={(event) => onChangeLoginName(event.target.value)}
            />
          </label>
          <button className="primary" type="submit">
            로그인
          </button>
        </form>
        {users.length ? (
          <div className="recent-users">
            {users.map((user) => (
              <button key={user.id} onClick={() => onChangeLoginName(user.name)}>
                {user.name}
              </button>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function App() {
  const [store, setStore] = useState(loadStore);
  const [loginName, setLoginName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [fileName, setFileName] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [document, setDocument] = useState(() => normalizeDocument(loadLegacyDocument()));
  const [activePageId, setActivePageId] = useState(document.pages[0]?.id || "");
  const [selectedId, setSelectedId] = useState(document.questions[0]?.id || "");
  const [dragId, setDragId] = useState("");
  const [focusRequest, setFocusRequest] = useState(null);
  const importRef = useRef(null);
  const fieldRefs = useRef({});

  const activeUser = store.users.find((user) => user.id === store.activeUserId) || null;
  const userStudents = useMemo(
    () => (activeUser ? store.students.filter((student) => student.userId === activeUser.id) : []),
    [activeUser, store.students],
  );
  const activeStudentId = activeUser ? store.activeStudentIdByUser[activeUser.id] || userStudents[0]?.id || "" : "";
  const activeStudent = userStudents.find((student) => student.id === activeStudentId) || userStudents[0] || null;
  const studentFiles = useMemo(
    () =>
      activeUser && activeStudent
        ? store.files.filter((file) => file.userId === activeUser.id && file.studentId === activeStudent.id)
        : [],
    [activeStudent, activeUser, store.files],
  );
  const activeFileId = activeUser ? store.activeFileIdByUser[activeUser.id] || studentFiles[0]?.id || "" : "";
  const activeFile = studentFiles.find((file) => file.id === activeFileId) || studentFiles[0] || null;
  const activePage = document.pages.find((page) => page.id === activePageId) || document.pages[0];
  const activePageIndex = Math.max(0, document.pages.findIndex((page) => page.id === activePage?.id));
  const pageQuestions = useMemo(
    () => document.questions.filter((question) => question.pageId === activePage?.id),
    [activePage, document.questions],
  );
  const selected = useMemo(
    () => document.questions.find((question) => question.id === selectedId) || pageQuestions[0] || document.questions[0],
    [document.questions, pageQuestions, selectedId],
  );
  const activeFieldKey = focusRequest?.key || "";
  const activePreviewKey = focusRequest ? previewElementKey(focusRequest) : "";

  useEffect(() => {
    if (!activeFile) return;
    const nextDocument = normalizeDocument(activeFile.document);
    setDocument(nextDocument);
    const nextPageId = nextDocument.pages[0]?.id || "";
    setActivePageId(nextPageId);
    setSelectedId(nextDocument.questions.find((question) => question.pageId === nextPageId)?.id || nextDocument.questions[0]?.id || "");
    setFocusRequest(null);
  }, [activeFile?.id]);

  useEffect(() => {
    if (!document.pages.some((page) => page.id === activePageId)) {
      setActivePageId(document.pages[0]?.id || "");
    }
  }, [activePageId, document.pages]);

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

  function commitStore(nextStore) {
    const normalized = normalizeStore(nextStore);
    setStore(normalized);
    saveStore(normalized);
  }

  function updateActiveFileDocument(nextDocument, nextStore = store) {
    if (!activeFile) return nextStore;
    const normalized = normalizeDocument(nextDocument);
    return {
      ...nextStore,
      files: nextStore.files.map((file) =>
        file.id === activeFile.id ? { ...file, document: normalized, updatedAt: nowIso() } : file,
      ),
    };
  }

  function updateDocument(next) {
    const value = normalizeDocument(typeof next === "function" ? next(document) : next);
    setDocument(value);
    localStorage.setItem(LEGACY_DOC_KEY, JSON.stringify(value));
    if (activeFile) {
      commitStore(updateActiveFileDocument(value));
      setSaveStatus("자동 저장됨");
    }
  }

  function login(event) {
    event.preventDefault();
    const name = loginName.trim();
    if (!name) return;
    let nextStore = normalizeStore(store);
    let user = nextStore.users.find((item) => item.name === name);
    if (!user) {
      user = { id: createId("user"), name, createdAt: nowIso() };
      nextStore = { ...nextStore, users: [...nextStore.users, user] };
    }
    nextStore = ensureUserWorkspace({ ...nextStore, activeUserId: user.id }, user.id);
    commitStore(nextStore);
    setLoginName("");
  }

  function logout() {
    commitStore({ ...store, activeUserId: "" });
    setSaveStatus("");
  }

  function saveCurrentFile() {
    if (!activeFile) return;
    commitStore(updateActiveFileDocument(document));
    setSaveStatus("저장됨");
  }

  function addStudent() {
    if (!activeUser) return;
    const name = studentName.trim() || `학생 ${userStudents.length + 1}`;
    const student = createStudent(activeUser.id, name);
    const file = createFile(activeUser.id, student.id, "새 문제지", sampleDocument());
    commitStore({
      ...store,
      students: [...store.students, student],
      files: [...store.files, file],
      activeStudentIdByUser: { ...store.activeStudentIdByUser, [activeUser.id]: student.id },
      activeFileIdByUser: { ...store.activeFileIdByUser, [activeUser.id]: file.id },
    });
    setStudentName("");
  }

  function addFile() {
    if (!activeUser || !activeStudent) return;
    const name = fileName.trim() || `문제지 ${studentFiles.length + 1}`;
    const file = createFile(activeUser.id, activeStudent.id, name, sampleDocument());
    commitStore({
      ...store,
      files: [...store.files, file],
      activeFileIdByUser: { ...store.activeFileIdByUser, [activeUser.id]: file.id },
    });
    setFileName("");
  }

  function changeStudent(studentId) {
    if (!activeUser) return;
    const files = store.files.filter((file) => file.userId === activeUser.id && file.studentId === studentId);
    let nextStore = {
      ...store,
      activeStudentIdByUser: { ...store.activeStudentIdByUser, [activeUser.id]: studentId },
      activeFileIdByUser: { ...store.activeFileIdByUser, [activeUser.id]: files[0]?.id || "" },
    };
    if (!files.length) {
      const file = createFile(activeUser.id, studentId, "새 문제지", sampleDocument());
      nextStore = {
        ...nextStore,
        files: [...nextStore.files, file],
        activeFileIdByUser: { ...nextStore.activeFileIdByUser, [activeUser.id]: file.id },
      };
    }
    commitStore(nextStore);
  }

  function changeFile(fileId) {
    if (!activeUser) return;
    commitStore({
      ...store,
      activeFileIdByUser: { ...store.activeFileIdByUser, [activeUser.id]: fileId },
    });
  }

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

  function patchQuestion(id, patch) {
    updateDocument((doc) => ({
      ...doc,
      questions: doc.questions.map((question) => (question.id === id ? { ...question, ...patch } : question)),
    }));
  }

  function patchQuestionLayout(field, value) {
    if (!selected) return;
    const range =
      field === "fontSize" ? FONT_SIZE_RANGE : field === "spacing" ? QUESTION_SPACING_RANGE : QUESTION_SIZE_RANGE;
    const fallback =
      field === "fontSize" ? DEFAULT_FONT_SIZE : field === "spacing" ? DEFAULT_QUESTION_SPACING : DEFAULT_QUESTION_SIZE;
    patchQuestion(selected.id, { [field]: clampNumber(value, range, fallback) });
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

  function applySpacingToAllQuestions() {
    if (!selected) return;
    const spacing = questionSpacing(selected);
    updateDocument((doc) => ({
      ...doc,
      questions: doc.questions.map((question) => ({ ...question, spacing })),
    }));
  }

  function selectPage(pageId) {
    setActivePageId(pageId);
    const firstQuestion = document.questions.find((question) => question.pageId === pageId);
    setSelectedId(firstQuestion?.id || "");
    setFocusRequest(null);
  }

  function addPage() {
    const page = createPage(document.pages.length + 1);
    updateDocument((doc) => ({ ...doc, pages: [...doc.pages, page] }));
    setActivePageId(page.id);
    setSelectedId("");
    setFocusRequest(null);
  }

  function moveSelectedToPage(pageId) {
    if (!selected || selected.pageId === pageId) return;
    patchQuestion(selected.id, { pageId });
    setActivePageId(pageId);
  }

  function moveSelectedToAdjacentPage(offset) {
    if (!selected) return;
    const nextPage = document.pages[activePageIndex + offset];
    if (nextPage) moveSelectedToPage(nextPage.id);
  }

  function addQuestion(kind = "passage") {
    const pageId = activePage?.id || document.pages[0]?.id;
    if (!pageId) return;
    const nextNumber = Math.max(17, ...document.questions.map((q) => Number(q.number) || 0)) + 1;
    const question = createQuestion(nextNumber, kind, pageId);
    updateDocument((doc) => ({ ...doc, questions: [...doc.questions, question] }));
    setSelectedId(question.id);
    setFocusRequest({ questionId: question.id, field: "size", key: questionFieldKey(question.id, "size"), stamp: Date.now() });
  }

  function duplicateQuestion() {
    if (!selected) return;
    const clone = { ...selected, id: createId("question"), number: Number(selected.number || 0) + 1 };
    const startNumber = Number(document.questions[0]?.number) || 18;
    updateDocument((doc) => {
      const list = [...doc.questions];
      const sourceIndex = list.findIndex((question) => question.id === selected.id);
      const targetIndex = sourceIndex < 0 ? list.length : sourceIndex + 1;
      list.splice(targetIndex, 0, clone);
      return resequenceDocument({ ...doc, questions: list }, startNumber);
    });
    setSelectedId(clone.id);
    setFocusRequest({ questionId: clone.id, field: "size", key: questionFieldKey(clone.id, "size"), stamp: Date.now() });
  }

  function deleteQuestion() {
    if (!selected || document.questions.length <= 1) return;
    const startNumber = Number(document.questions[0]?.number) || 18;
    const samePage = document.questions.filter((question) => question.pageId === selected.pageId);
    const selectedPageIndex = samePage.findIndex((question) => question.id === selected.id);
    const nextSamePage = samePage[selectedPageIndex + 1] || samePage[selectedPageIndex - 1];
    updateDocument((doc) =>
      resequenceDocument(
        {
          ...doc,
          questions: doc.questions.filter((question) => question.id !== selected.id),
        },
        startNumber,
      ),
    );
    setSelectedId(nextSamePage?.id || "");
    if (nextSamePage) {
      setFocusRequest({
        questionId: nextSamePage.id,
        field: "size",
        key: questionFieldKey(nextSamePage.id, "size"),
        stamp: Date.now(),
      });
    }
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
    const startNumber = Number(document.questions[0]?.number) || 18;
    updateDocument((doc) => resequenceDocument(doc, startNumber));
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(document, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(window.document.createElement("a"), {
      href: url,
      download: "problem-editor-project.json",
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
        const next = normalizeDocument(JSON.parse(String(reader.result)));
        updateDocument(next);
        setActivePageId(next.pages[0]?.id || "");
        setSelectedId(next.questions[0]?.id || "");
      } catch (error) {
        alert(`프로젝트를 열 수 없습니다: ${error.message}`);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!activeUser) {
    return (
      <LoginScreen
        loginName={loginName}
        onChangeLoginName={setLoginName}
        onLogin={login}
        users={store.users}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <strong>문제 편집기</strong>
          <span>{activeFile ? `${activeStudent?.name || "미분류"} / ${activeFile.name}` : "로컬 저장소"}</span>
        </div>
        <nav>
          <button onClick={() => importRef.current?.click()}>JSON 열기</button>
          <button onClick={exportJson}>JSON 저장</button>
          <button onClick={saveCurrentFile}>저장</button>
          <button onClick={logout}>로그아웃</button>
          <button className="primary" onClick={() => window.print()}>
            PDF 저장
          </button>
          <input ref={importRef} type="file" accept="application/json" onChange={importJson} hidden />
        </nav>
      </header>

      <aside className="sidebar glass">
        <section className="library-panel">
          <div className="library-heading">
            <b>{activeUser.name}</b>
            <span>{saveStatus || "자동 저장"}</span>
          </div>
          <label>
            학생 폴더
            <select value={activeStudentId} onChange={(event) => changeStudent(event.target.value)}>
              {userStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-actions">
            <input value={studentName} placeholder="학생 이름" onChange={(event) => setStudentName(event.target.value)} />
            <button onClick={addStudent}>추가</button>
          </div>
          <label>
            문제지 파일
            <select value={activeFileId} onChange={(event) => changeFile(event.target.value)}>
              {studentFiles.map((file) => (
                <option key={file.id} value={file.id}>
                  {file.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-actions">
            <input value={fileName} placeholder="파일 이름" onChange={(event) => setFileName(event.target.value)} />
            <button onClick={addFile}>새 파일</button>
          </div>
        </section>

        <section className="page-panel">
          <div className="panel-title">
            <h2>페이지</h2>
            <button onClick={addPage}>추가</button>
          </div>
          <div className="page-tabs">
            {document.pages.map((page, index) => (
              <button
                key={page.id}
                className={page.id === activePage?.id ? "selected" : ""}
                onClick={() => selectPage(page.id)}
              >
                {page.title || `${index + 1}쪽`}
              </button>
            ))}
          </div>
        </section>

        <section className="question-panel">
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
            {pageQuestions.length ? (
              pageQuestions.map((question) => (
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
              ))
            ) : (
              <div className="empty-list">이 페이지에는 문항이 없습니다.</div>
            )}
          </div>
          <div className="sidebar-actions">
            <button onClick={duplicateQuestion} disabled={!selected}>
              문제 복사
            </button>
            <button onClick={renumber}>번호 정리</button>
            <button className="danger" disabled={!selected || document.questions.length <= 1} onClick={deleteQuestion}>
              문제 삭제
            </button>
          </div>
        </section>
      </aside>

      <section className="preview-shell glass">
        <div className="preview-toolbar">
          <div>
            <h1>{document.title}</h1>
            <p>
              {activePage?.title || `${activePageIndex + 1}쪽`} · {pageQuestions.length}문항
            </p>
          </div>
          <button className="primary" onClick={() => window.print()}>
            PDF로 저장
          </button>
        </div>
        <div className="paper-scroll">
          <div className="screen-page">
            <ExamPreview
              activeFieldKey={activePreviewKey}
              document={document}
              onPreviewEdit={focusPreviewTarget}
              page={activePage}
              pageNumber={activePageIndex + 1}
              questions={pageQuestions}
              selectedId={selected?.id}
              totalPages={document.pages.length}
            />
          </div>
          <div className="print-pages">
            {document.pages.map((page, index) => (
              <ExamPreview
                key={page.id}
                activeFieldKey=""
                document={document}
                onPreviewEdit={null}
                page={page}
                pageNumber={index + 1}
                questions={document.questions.filter((question) => question.pageId === page.id)}
                selectedId=""
                totalPages={document.pages.length}
              />
            ))}
          </div>
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
                    onChange={(event) => patchQuestionLayout("size", event.target.value)}
                  />
                  <input
                    aria-label="문제 크기 값"
                    className="percent-input"
                    type="number"
                    min={QUESTION_SIZE_RANGE.min}
                    max={QUESTION_SIZE_RANGE.max}
                    value={questionSize(selected)}
                    onChange={(event) => patchQuestionLayout("size", event.target.value)}
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
                    onChange={(event) => patchQuestionLayout("fontSize", event.target.value)}
                  />
                  <input
                    aria-label="폰트 크기 값"
                    className="percent-input"
                    type="number"
                    min={FONT_SIZE_RANGE.min}
                    max={FONT_SIZE_RANGE.max}
                    value={questionFontSize(selected)}
                    onChange={(event) => patchQuestionLayout("fontSize", event.target.value)}
                  />
                </div>
              </label>
              <label className={fieldLabelClassName(questionFieldKey(selected.id, "spacing"), "sizing-label")}>
                <span>문제 간격</span>
                <div className="range-line">
                  <input
                    ref={bindField(questionFieldKey(selected.id, "spacing"))}
                    type="range"
                    min={QUESTION_SPACING_RANGE.min}
                    max={QUESTION_SPACING_RANGE.max}
                    value={questionSpacing(selected)}
                    onChange={(event) => patchQuestionLayout("spacing", event.target.value)}
                  />
                  <input
                    aria-label="문제 간격 값"
                    className="percent-input"
                    type="number"
                    min={QUESTION_SPACING_RANGE.min}
                    max={QUESTION_SPACING_RANGE.max}
                    value={questionSpacing(selected)}
                    onChange={(event) => patchQuestionLayout("spacing", event.target.value)}
                  />
                </div>
              </label>
              <button className="apply-all" onClick={applySizingToAllQuestions}>
                크기/폰트 전체 적용
              </button>
              <button className="apply-all" onClick={applySpacingToAllQuestions}>
                간격 전체 적용
              </button>
              <div className="question-edit-actions">
                <button onClick={duplicateQuestion}>문제 복사</button>
                <button className="danger" disabled={document.questions.length <= 1} onClick={deleteQuestion}>
                  문제 삭제
                </button>
              </div>
            </div>

            <label className="wide">
              현재 문제 페이지
              <select value={selected.pageId} onChange={(event) => moveSelectedToPage(event.target.value)}>
                {document.pages.map((page, index) => (
                  <option key={page.id} value={page.id}>
                    {page.title || `${index + 1}쪽`}
                  </option>
                ))}
              </select>
            </label>
            <div className="page-move-actions wide">
              <button disabled={activePageIndex <= 0} onClick={() => moveSelectedToAdjacentPage(-1)}>
                이전 페이지로
              </button>
              <button disabled={activePageIndex >= document.pages.length - 1} onClick={() => moveSelectedToAdjacentPage(1)}>
                다음 페이지로
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
        ) : (
          <div className="empty-inspector">문항을 추가하거나 다른 페이지에서 문항을 선택하세요.</div>
        )}
      </aside>
    </div>
  );
}

const rootElement = document.getElementById("root");
const root = rootElement._problemEditorRoot || createRoot(rootElement);
rootElement._problemEditorRoot = root;
root.render(<App />);
