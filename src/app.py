from __future__ import annotations

import argparse
import json
import os
import re
import sys
import uuid
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, messagebox
import tkinter as tk
from tkinter import ttk
from tkinter.scrolledtext import ScrolledText

from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas as pdf_canvas


APP_NAME = "LaTeX Vibe Coder"
APP_VERSION = "0.3.0"
EXAM_PAGE_SIZE = (842, 1191)

CHOICE_MARKS = ["①", "②", "③", "④", "⑤"]

QUESTION_TYPES = [
    ("passage", "지문형"),
    ("listening", "듣기형"),
    ("notice", "안내문/도표"),
    ("table", "표"),
    ("dialogue", "대화문"),
    ("custom", "자유형"),
]

QUESTION_TYPE_LABEL = dict(QUESTION_TYPES)
QUESTION_TYPE_BY_LABEL = {label: key for key, label in QUESTION_TYPES}

PDF_FONT_REGISTRY: dict[str, str] | None = None


def new_question(number: int, kind: str = "passage") -> dict:
    prompt = {
        "passage": "다음 글의 주제로 가장 적절한 것은?",
        "listening": "대화를 듣고, 여자의 의견으로 가장 적절한 것을 고르시오.",
        "notice": "다음 안내문의 내용과 일치하지 않는 것은?",
        "table": "다음 표의 내용과 일치하지 않는 것은?",
        "dialogue": "다음 대화의 빈칸에 들어갈 말로 가장 적절한 것은?",
        "custom": "문항 발문을 입력하세요.",
    }.get(kind, "문항 발문을 입력하세요.")

    return {
        "id": str(uuid.uuid4()),
        "number": number,
        "kind": kind,
        "score": "",
        "prompt": prompt,
        "passage": "",
        "choices": ["", "", "", "", ""],
        "answer": "",
        "note": "",
        "column": 0,
        "y": 70,
    }


def sample_document() -> dict:
    doc = {
        "title": "영어영역 문제지",
        "subtitle": "과외용 수능 영어 연습",
        "form": "홀수형",
        "copyright": "이 문제지는 과외 수업용으로 제작되었습니다.",
        "questions": [],
    }

    q1 = new_question(18, "passage")
    q1.update(
        {
            "prompt": "다음 글의 목적으로 가장 적절한 것은?",
            "passage": (
                "Dear members of the school reading club,\n\n"
                "We are pleased to announce that our monthly book talk will be held "
                "in the library this Friday. Students who wish to present a short "
                "review should submit the title of their book by Wednesday. We hope "
                "many members will join us and share their thoughts."
            ),
            "choices": [
                "독서 토론 발표 신청을 안내하려고",
                "도서관 이용 규칙 변경을 알리려고",
                "신입 회원 모집 일정을 공지하려고",
                "책 기부 행사의 결과를 보고하려고",
                "학교 축제 부스 운영을 제안하려고",
            ],
        }
    )

    q2 = new_question(19, "passage")
    q2.update(
        {
            "prompt": "다음 글에 드러난 Mina의 심경 변화로 가장 적절한 것은?",
            "passage": (
                "Mina stood in front of the classroom door, holding her speech cards "
                "so tightly that the edges bent. She could hear her classmates talking "
                "inside, and her heart beat faster. When her name was called, she took "
                "a slow breath and began. After a few sentences, she noticed her friend "
                "smiling and nodding. Her voice became steady, and by the end of the "
                "speech she felt proud of herself."
            ),
            "choices": [
                "nervous → confident",
                "bored → disappointed",
                "relieved → jealous",
                "angry → ashamed",
                "curious → confused",
            ],
        }
    )

    q3 = new_question(20, "notice")
    q3.update(
        {
            "prompt": "다음 안내문의 내용과 일치하지 않는 것은?",
            "passage": (
                "School Volunteer Day\n"
                "Date: July 12\n"
                "Place: Green River Park\n"
                "Participants: First- and second-year students\n"
                "Activities: Picking up trash, planting flowers\n"
                "Bring: Water bottle, gloves, and a hat\n"
                "Sign up by July 5 through the school website."
            ),
            "choices": [
                "행사는 7월 12일에 열린다.",
                "장소는 Green River Park이다.",
                "모든 학년 학생이 참가 대상이다.",
                "쓰레기 줍기와 꽃 심기 활동을 한다.",
                "학교 웹사이트를 통해 신청한다.",
            ],
        }
    )

    q4 = new_question(21, "table")
    q4.update(
        {
            "prompt": "다음 표의 내용과 일치하지 않는 것은?",
            "score": "3",
            "passage": (
                "| Club | Day | Time | Room |\n"
                "| Debate | Monday | 4:00 | 201 |\n"
                "| Film | Tuesday | 3:30 | 105 |\n"
                "| Coding | Thursday | 4:30 | Lab 2 |"
            ),
            "choices": [
                "Debate Club은 월요일에 모인다.",
                "Film Club은 3시 30분에 시작한다.",
                "Coding Club은 목요일에 모인다.",
                "Film Club은 Lab 2에서 활동한다.",
                "Debate Club의 활동 장소는 201호이다.",
            ],
        }
    )

    doc["questions"] = [q1, q2, q3, q4]
    for question, column, y in [(q1, 0, 70), (q2, 0, 260), (q3, 1, 70), (q4, 1, 260)]:
        question["column"] = column
        question["y"] = y
    return doc


def question_sort_key(question: dict) -> tuple:
    return (
        int(question.get("column", 0) or 0),
        float(question.get("y", 0) or 0),
        int(question.get("number", 0) or 0),
    )


def ordered_questions(doc: dict) -> list[dict]:
    return sorted(doc.get("questions", []), key=question_sort_key)


def write_project(path: Path, doc: dict) -> None:
    path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")


def read_project(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if "questions" not in data or not isinstance(data["questions"], list):
        raise ValueError("프로젝트 파일에 questions 목록이 없습니다.")
    return data


def parse_pipe_table(text: str) -> list[list[str]]:
    rows = []
    for raw in str(text or "").splitlines():
        line = raw.strip()
        if not line or "|" not in line:
            continue
        markerless = line.replace("|", "").replace(":", "").replace("-", "").strip()
        if not markerless:
            continue
        rows.append([cell.strip() for cell in line.strip("|").split("|")])
    return rows


def normalize_text(text: object) -> str:
    return str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def mostly_latin(text: str) -> bool:
    letters = [ch for ch in str(text or "") if ch.isalpha()]
    if not letters:
        return False
    latin = sum(1 for ch in letters if "A" <= ch <= "Z" or "a" <= ch <= "z")
    return latin / len(letters) > 0.72


def find_font_path(candidates: list[str]) -> str | None:
    roots = [
        Path(os.environ.get("WINDIR", r"C:\Windows")) / "Fonts",
        Path(__file__).resolve().parent / "fonts",
    ]
    for root in roots:
        for name in candidates:
            path = root / name
            if path.exists():
                return str(path)
    return None


def register_pdf_fonts() -> dict[str, str]:
    global PDF_FONT_REGISTRY
    if PDF_FONT_REGISTRY is not None:
        return PDF_FONT_REGISTRY

    regular = find_font_path(["HANBatang.ttf", "batang.ttc", "NotoSerifKR-VF.ttf", "malgun.ttf"])
    bold = find_font_path(["HANBatangB.ttf", "HANBatang.ttf", "NotoSerifKR-VF.ttf", "malgunbd.ttf"])
    latin = find_font_path(["times.ttf"])
    latin_bold = find_font_path(["timesbd.ttf", "times.ttf"])

    if regular:
        pdfmetrics.registerFont(TTFont("ExamBody", regular))
    else:
        PDF_FONT_REGISTRY = {
            "regular": "Times-Roman",
            "bold": "Times-Bold",
            "latin": "Times-Roman",
            "latin_bold": "Times-Bold",
        }
        return PDF_FONT_REGISTRY

    if bold:
        pdfmetrics.registerFont(TTFont("ExamBold", bold))
    else:
        pdfmetrics.registerFont(TTFont("ExamBold", regular))

    if latin:
        pdfmetrics.registerFont(TTFont("ExamLatin", latin))
    if latin_bold:
        pdfmetrics.registerFont(TTFont("ExamLatinBold", latin_bold))

    PDF_FONT_REGISTRY = {
        "regular": "ExamBody",
        "bold": "ExamBold",
        "latin": "ExamLatin" if latin else "Times-Roman",
        "latin_bold": "ExamLatinBold" if latin_bold else "Times-Bold",
    }
    return PDF_FONT_REGISTRY


def string_width(text: str, font: str, size: float) -> float:
    return pdfmetrics.stringWidth(text, font, size)


def wrap_text(text: str, font: str, size: float, max_width: float) -> list[str]:
    text = re.sub(r"[ \t]+", " ", str(text or "").strip())
    if not text:
        return []

    tokens = re.findall(r"\S+\s*", text)
    lines: list[str] = []
    current = ""

    def emit_long_token(token: str) -> None:
        nonlocal current
        token = token.strip()
        for char in token:
            trial = current + char
            if current and string_width(trial, font, size) > max_width:
                lines.append(current.rstrip())
                current = char
            else:
                current = trial

    for token in tokens:
        trial = current + token
        if not current or string_width(trial.rstrip(), font, size) <= max_width:
            current = trial
            continue
        if string_width(token.strip(), font, size) > max_width:
            if current.strip():
                lines.append(current.rstrip())
                current = ""
            emit_long_token(token)
        else:
            lines.append(current.rstrip())
            current = token

    if current.strip():
        lines.append(current.rstrip())
    return lines


@dataclass
class PdfStyle:
    page_width: float
    page_height: float
    margin_left: float = 88
    margin_right: float = 94
    margin_top: float = 86
    margin_bottom: float = 118
    column_gap: float = 38
    title_size: float = 15.0
    subject_size: float = 15.8
    header_size: float = 9.0
    prompt_size: float = 10.2
    body_size: float = 9.35
    choice_size: float = 9.25
    leading: float = 13.15

    @property
    def column_width(self) -> float:
        return (self.page_width - self.margin_left - self.margin_right - self.column_gap) / 2

    @property
    def top_y(self) -> float:
        return 951

    @property
    def bottom_y(self) -> float:
        return self.margin_bottom


class DirectPdfRenderer:
    def __init__(self, doc: dict, path: Path) -> None:
        self.doc = doc
        self.path = Path(path)
        self.fonts = register_pdf_fonts()
        self.canvas = pdf_canvas.Canvas(str(self.path), pagesize=EXAM_PAGE_SIZE)
        self.style = PdfStyle(*EXAM_PAGE_SIZE)
        self.estimated_total_pages = max(1, (len(doc.get("questions", [])) + 11) // 12)
        self.page_no = 0
        self.column = 0
        self.y = 0.0

    def render(self) -> Path:
        self.new_page()
        for question in ordered_questions(self.doc):
            self.draw_question(question)
        self.canvas.save()
        return self.path

    @property
    def x(self) -> float:
        return self.style.margin_left + self.column * (self.style.column_width + self.style.column_gap)

    def new_page(self) -> None:
        if self.page_no:
            self.canvas.showPage()
        self.page_no += 1
        self.column = 0
        self.y = self.style.top_y
        self.draw_page_header()

    def next_column(self) -> None:
        if self.column == 0:
            self.column = 1
            self.y = self.style.top_y
        else:
            self.new_page()

    def ensure_space(self, height: float) -> None:
        if self.y - height < self.style.bottom_y:
            self.next_column()

    def draw_page_header(self) -> None:
        c = self.canvas
        s = self.style
        regular = self.fonts["regular"]
        bold = self.fonts["bold"]
        latin = self.fonts["latin"]
        subject = str(self.doc.get("title", "영어영역 문제지")).replace(" 문제지", "").strip() or "영어영역"
        exam_title = str(self.doc.get("exam_title", "2026학년도 대학수학능력시험 문제지"))
        form = str(self.doc.get("form", "홀수형"))

        c.setFillColor(colors.black)
        c.setFont(bold, s.title_size)
        c.drawCentredString(s.page_width / 2, 1057, exam_title)
        c.setLineWidth(0.45)
        c.setStrokeColor(colors.black)
        c.line(s.margin_left, 1042, s.page_width - s.margin_right, 1042)

        c.setFont(bold, s.header_size + 1.6)
        c.drawString(s.margin_left + 10, 1011, "제3교시")
        c.setFont(bold, s.subject_size)
        c.drawCentredString(s.page_width / 2, 1010, subject)
        c.setFont(bold, s.header_size + 1.6)
        c.drawRightString(s.page_width - s.margin_right - 10, 1011, form)
        c.line(s.margin_left, 990, s.page_width - s.margin_right, 990)

        c.setFont(regular, 7.7)
        c.drawRightString(s.page_width - 95, 77, str(self.doc.get("copyright", "")))
        c.setFont(latin, 8.8)
        c.drawCentredString(s.page_width / 2, 97, f"{self.page_no} {self.estimated_total_pages}")

        c.setStrokeColor(colors.HexColor("#bcbcbc"))
        c.setLineWidth(0.25)
        separator_x = s.margin_left + s.column_width + s.column_gap / 2
        c.line(separator_x, s.top_y + 5, separator_x, s.bottom_y - 8)

    def draw_question(self, question: dict) -> None:
        height = self.measure_question(question)
        column_height = self.style.top_y - self.style.bottom_y
        if height < column_height:
            self.ensure_space(height)
        else:
            self.ensure_space(30)

        self.draw_prompt(question)
        kind = question.get("kind", "passage")
        passage = normalize_text(question.get("passage", ""))
        if passage:
            if kind == "table":
                self.draw_table(passage)
            elif kind in {"notice", "dialogue"}:
                self.draw_boxed_text(passage)
            else:
                self.draw_passage(passage)
        self.draw_choices(question)
        self.y -= 8

    def measure_question(self, question: dict) -> float:
        total = 15
        prompt = self.prompt_line(question)
        total += len(wrap_text(prompt, self.fonts["bold"], self.style.prompt_size, self.style.column_width)) * 13.2
        passage = normalize_text(question.get("passage", ""))
        kind = question.get("kind", "passage")
        if passage:
            if kind == "table":
                total += self.measure_table(passage) + 6
            elif kind in {"notice", "dialogue"}:
                total += self.measure_boxed_text(passage) + 6
            else:
                total += self.measure_passage(passage) + 5
        total += self.measure_choices(question) + 6
        return total

    def prompt_line(self, question: dict) -> str:
        score = f" [{question.get('score')}점]" if question.get("score") else ""
        return f"{question.get('number', '')}. {question.get('prompt', '')}{score}"

    def draw_prompt(self, question: dict) -> None:
        c = self.canvas
        s = self.style
        text = self.prompt_line(question)
        lines = wrap_text(text, self.fonts["bold"], s.prompt_size, s.column_width)
        self.ensure_space(max(15, len(lines) * 13.2 + 3))
        c.setFillColor(colors.black)
        c.setFont(self.fonts["bold"], s.prompt_size)
        for line in lines:
            c.drawString(self.x, self.y, line)
            self.y -= 13.2
        self.y -= 1.5

    def measure_passage(self, passage: str) -> float:
        total = 0
        for paragraph in re.split(r"\n\s*\n", passage):
            text = " ".join(line.strip() for line in paragraph.splitlines())
            font = self.fonts["latin"] if mostly_latin(text) else self.fonts["regular"]
            lines = wrap_text(text, font, self.style.body_size, self.style.column_width)
            total += len(lines) * self.style.leading + 4
        return total

    def draw_passage(self, passage: str) -> None:
        c = self.canvas
        s = self.style
        c.setFillColor(colors.black)
        for paragraph in re.split(r"\n\s*\n", passage):
            text = " ".join(line.strip() for line in paragraph.splitlines() if line.strip())
            font = self.fonts["latin"] if mostly_latin(text) else self.fonts["regular"]
            c.setFont(font, s.body_size)
            for line in wrap_text(text, font, s.body_size, s.column_width):
                self.ensure_space(s.leading)
                c.drawString(self.x, self.y, line)
                self.y -= s.leading
            self.y -= 3.5

    def measure_boxed_text(self, text: str) -> float:
        inner_width = self.style.column_width - 16
        total = 14
        for raw in text.splitlines():
            if raw.strip():
                total += max(1, len(wrap_text(raw, self.fonts["regular"], self.style.body_size, inner_width))) * self.style.leading
            else:
                total += 5
        return total

    def draw_boxed_text(self, text: str) -> None:
        c = self.canvas
        s = self.style
        height = self.measure_boxed_text(text)
        if height < s.top_y - s.bottom_y:
            self.ensure_space(height + 4)
        x = self.x
        y_top = self.y
        c.setFillColor(colors.white)
        c.setStrokeColor(colors.black)
        c.setLineWidth(0.45)
        c.rect(x, y_top - height, s.column_width, height, stroke=1, fill=0)
        c.setFillColor(colors.black)
        c.setFont(self.fonts["regular"], s.body_size)
        self.y -= 10
        for raw in text.splitlines():
            if not raw.strip():
                self.y -= 5
                continue
            for line in wrap_text(raw, self.fonts["regular"], s.body_size, s.column_width - 16):
                if self.y < s.bottom_y + s.leading:
                    self.next_column()
                c.drawString(x + 8, self.y, line)
                self.y -= s.leading
        self.y = y_top - height - 6

    def measure_table(self, text: str) -> float:
        rows = parse_pipe_table(text)
        if not rows:
            return self.measure_boxed_text(text)
        row_height = 20
        return max(28, len(rows) * row_height + 2)

    def draw_table(self, text: str) -> None:
        rows = parse_pipe_table(text)
        if not rows:
            self.draw_boxed_text(text)
            return
        c = self.canvas
        s = self.style
        height = self.measure_table(text)
        self.ensure_space(height + 6)
        width = s.column_width
        max_cols = max(len(row) for row in rows)
        col_width = width / max_cols
        row_height = height / len(rows)
        x = self.x
        y_top = self.y

        c.setStrokeColor(colors.black)
        c.setLineWidth(0.45)
        for row_idx, row in enumerate(rows):
            y = y_top - row_height * (row_idx + 1)
            c.setFillColor(colors.white)
            c.rect(x, y, width, row_height, stroke=1, fill=0)
            for col_idx in range(max_cols):
                c.line(x + col_width * col_idx, y, x + col_width * col_idx, y + row_height)
                cell = row[col_idx] if col_idx < len(row) else ""
                font = self.fonts["bold"] if row_idx == 0 else self.fonts["regular"]
                c.setFont(font, 7.8)
                c.setFillColor(colors.black)
                lines = wrap_text(cell, font, 7.8, col_width - 6)[:2]
                text_y = y + row_height - 8
                for line in lines:
                    c.drawString(x + col_width * col_idx + 3, text_y, line)
                    text_y -= 8.3
            c.line(x + width, y, x + width, y + row_height)
        c.line(x, y_top - height, x + width, y_top - height)
        self.y -= height + 7

    def measure_choices(self, question: dict) -> float:
        choices = [choice for choice in question.get("choices", []) if str(choice).strip()]
        total = 0
        for choice in choices[:5]:
            font = self.fonts["latin"] if mostly_latin(str(choice)) else self.fonts["regular"]
            lines = wrap_text(str(choice), font, self.style.choice_size, self.style.column_width - 18)
            total += max(1, len(lines)) * 12.6 + 0.5
        return total

    def draw_choices(self, question: dict) -> None:
        c = self.canvas
        s = self.style
        choices = [choice for choice in question.get("choices", []) if str(choice).strip()]
        if not choices:
            return
        c.setFillColor(colors.black)
        self.y -= 1
        for idx, choice in enumerate(choices[:5]):
            marker = CHOICE_MARKS[idx]
            font = self.fonts["latin"] if mostly_latin(str(choice)) else self.fonts["regular"]
            lines = wrap_text(str(choice), font, s.choice_size, s.column_width - 18)
            self.ensure_space(max(13, len(lines) * 12.6))
            line_y = self.y
            if lines:
                c.setFont(self.fonts["regular"], s.choice_size)
                c.drawString(self.x, line_y, marker)
                c.setFont(font, s.choice_size)
                c.drawString(self.x + 17, line_y, lines[0])
                line_y -= 12.6
                for line in lines[1:]:
                    c.drawString(self.x + 17, line_y, line)
                    line_y -= 12.6
            self.y = line_y - 0.5


def export_pdf_direct(doc: dict, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    return DirectPdfRenderer(doc, path).render()


def rounded_rect(canvas: tk.Canvas, x1: float, y1: float, x2: float, y2: float, radius: float, **kwargs) -> int:
    points = [
        x1 + radius,
        y1,
        x2 - radius,
        y1,
        x2,
        y1,
        x2,
        y1 + radius,
        x2,
        y2 - radius,
        x2,
        y2,
        x2 - radius,
        y2,
        x1 + radius,
        y2,
        x1,
        y2,
        x1,
        y2 - radius,
        x1,
        y1 + radius,
        x1,
        y1,
    ]
    return canvas.create_polygon(points, smooth=True, splinesteps=20, **kwargs)


class MakerApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title(f"{APP_NAME} {APP_VERSION}")
        self.geometry("1280x780")
        self.minsize(1060, 660)
        try:
            self.attributes("-alpha", 0.985)
        except tk.TclError:
            pass

        self.doc = sample_document()
        self.project_path: Path | None = None
        self.current_id: str | None = self.doc["questions"][0]["id"] if self.doc["questions"] else None
        self.loading_editor = False
        self.editor_after_id: str | None = None
        self.drag_state: dict | None = None

        self.palette = {
            "bg": "#eaf3ff",
            "glass": "#f8fbff",
            "glass2": "#eff7ff",
            "stroke": "#bfd4ed",
            "text": "#111827",
            "muted": "#5b677a",
            "accent": "#1478ff",
            "accent2": "#7cc7ff",
            "danger": "#e5484d",
        }

        self._build_style()
        self._build_menu()
        self._build_layout()
        self.refresh_all()

    def _build_style(self) -> None:
        style = ttk.Style(self)
        try:
            style.theme_use("clam")
        except tk.TclError:
            pass

        bg = self.palette["bg"]
        glass = self.palette["glass"]
        text = self.palette["text"]
        muted = self.palette["muted"]
        accent = self.palette["accent"]
        stroke = self.palette["stroke"]

        self.configure(bg=bg)
        style.configure(".", font=("Malgun Gothic", 10), background=bg, foreground=text)
        style.configure("Glass.TFrame", background=glass)
        style.configure("Root.TFrame", background=bg)
        style.configure("TLabel", background=glass, foreground=text)
        style.configure("Root.TLabel", background=bg, foreground=text)
        style.configure("Title.TLabel", background=glass, foreground=text, font=("Malgun Gothic", 13, "bold"))
        style.configure("Muted.TLabel", background=glass, foreground=muted, font=("Malgun Gothic", 9))
        style.configure("TButton", padding=(11, 6), background="#ffffff", bordercolor=stroke, focusthickness=0)
        style.map("TButton", background=[("active", "#edf6ff")], foreground=[("active", text)])
        style.configure("Accent.TButton", padding=(12, 7), background=accent, foreground="#ffffff", bordercolor=accent)
        style.map("Accent.TButton", background=[("active", "#0f66db")], foreground=[("active", "#ffffff")])
        style.configure("Danger.TButton", padding=(11, 6), background="#fff5f6", foreground=self.palette["danger"], bordercolor="#ffd5db")
        style.map("Danger.TButton", background=[("active", "#ffecef")])
        style.configure("TEntry", fieldbackground="#ffffff", bordercolor=stroke, lightcolor=stroke, darkcolor=stroke)
        style.configure("TCombobox", fieldbackground="#ffffff", background="#ffffff", bordercolor=stroke)

    def _build_menu(self) -> None:
        menubar = tk.Menu(self)
        file_menu = tk.Menu(menubar, tearoff=False)
        file_menu.add_command(label="새 프로젝트", command=self.new_project, accelerator="Ctrl+N")
        file_menu.add_command(label="열기...", command=self.open_project, accelerator="Ctrl+O")
        file_menu.add_command(label="저장", command=self.save_project, accelerator="Ctrl+S")
        file_menu.add_command(label="다른 이름으로 저장...", command=self.save_project_as)
        file_menu.add_separator()
        file_menu.add_command(label="PDF 바로 만들기...", command=self.export_pdf, accelerator="Ctrl+P")
        file_menu.add_separator()
        file_menu.add_command(label="종료", command=self.destroy)

        doc_menu = tk.Menu(menubar, tearoff=False)
        doc_menu.add_command(label="문서 설정...", command=self.edit_document_settings)
        doc_menu.add_command(label="문항 번호 다시 매기기", command=self.renumber_questions)
        doc_menu.add_command(label="문항 자동 정렬", command=self.auto_arrange_questions)

        help_menu = tk.Menu(menubar, tearoff=False)
        help_menu.add_command(label="사용 팁", command=self.show_help)

        menubar.add_cascade(label="파일", menu=file_menu)
        menubar.add_cascade(label="문서", menu=doc_menu)
        menubar.add_cascade(label="도움말", menu=help_menu)
        self.config(menu=menubar)

        self.bind_all("<Control-n>", lambda _event: self.new_project())
        self.bind_all("<Control-o>", lambda _event: self.open_project())
        self.bind_all("<Control-s>", lambda _event: self.save_project())
        self.bind_all("<Control-p>", lambda _event: self.export_pdf())

    def _build_layout(self) -> None:
        root = ttk.Frame(self, style="Root.TFrame", padding=14)
        root.pack(fill=tk.BOTH, expand=True)

        self.hero_canvas = tk.Canvas(root, height=74, bg=self.palette["bg"], highlightthickness=0)
        self.hero_canvas.pack(fill=tk.X, pady=(0, 12))
        self.hero_canvas.bind("<Configure>", self.draw_hero)

        body = ttk.PanedWindow(root, orient=tk.HORIZONTAL)
        body.pack(fill=tk.BOTH, expand=True)

        self.left_frame = ttk.Frame(body, style="Glass.TFrame", padding=12)
        self.center_frame = ttk.Frame(body, style="Glass.TFrame", padding=12)
        self.right_frame = ttk.Frame(body, style="Glass.TFrame", padding=12)
        body.add(self.left_frame, weight=0)
        body.add(self.center_frame, weight=1)
        body.add(self.right_frame, weight=0)

        self._build_left_panel()
        self._build_canvas_panel()
        self._build_editor_panel()

    def draw_hero(self, _event: tk.Event | None = None) -> None:
        c = self.hero_canvas
        c.delete("all")
        w = max(1, c.winfo_width())
        h = max(1, c.winfo_height())
        for i in range(0, h, 2):
            shade = 245 - int(i / max(h, 1) * 14)
            color = f"#{shade:02x}{min(255, shade + 7):02x}ff"
            c.create_rectangle(0, i, w, i + 2, outline=color, fill=color)
        rounded_rect(c, 8, 8, w - 8, h - 8, 22, fill="#f8fbff", outline="#c9ddf4", width=1)
        c.create_oval(w - 220, -80, w + 40, 130, fill="#d9f0ff", outline="")
        c.create_oval(w - 360, -35, w - 120, 150, fill="#edf7ff", outline="")
        c.create_text(30, 26, anchor="w", text="LaTeX Vibe Coder", font=("Malgun Gothic", 18, "bold"), fill=self.palette["text"])
        c.create_text(31, 52, anchor="w", text="LaTeX 없이 바로 PDF로 만드는 수능 영어 문제지 편집기", font=("Malgun Gothic", 9), fill=self.palette["muted"])
        c.create_text(w - 32, 38, anchor="e", text="Direct PDF Engine", font=("Malgun Gothic", 10, "bold"), fill=self.palette["accent"])

    def _build_left_panel(self) -> None:
        ttk.Label(self.left_frame, text="문항 목록", style="Title.TLabel").pack(anchor="w")
        ttk.Label(self.left_frame, text="카드 배치 순서 그대로 PDF에 들어갑니다.", style="Muted.TLabel").pack(anchor="w", pady=(2, 9))

        list_area = ttk.Frame(self.left_frame, style="Glass.TFrame")
        list_area.pack(fill=tk.BOTH, expand=True)
        self.question_list = tk.Listbox(
            list_area,
            height=18,
            width=28,
            activestyle="none",
            exportselection=False,
            bg="#fbfdff",
            fg=self.palette["text"],
            selectbackground="#dceeff",
            selectforeground=self.palette["text"],
            highlightthickness=1,
            highlightcolor=self.palette["stroke"],
            highlightbackground=self.palette["stroke"],
            borderwidth=0,
            font=("Malgun Gothic", 10),
        )
        list_scroll = ttk.Scrollbar(list_area, orient=tk.VERTICAL, command=self.question_list.yview)
        self.question_list.configure(yscrollcommand=list_scroll.set)
        self.question_list.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        list_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.question_list.bind("<<ListboxSelect>>", self.on_list_select)

        add_row = ttk.Frame(self.left_frame, style="Glass.TFrame")
        add_row.pack(fill=tk.X, pady=(10, 0))
        ttk.Button(add_row, text="추가", command=self.add_question_dialog, style="Accent.TButton").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        ttk.Button(add_row, text="복제", command=self.duplicate_question).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)
        ttk.Button(add_row, text="삭제", command=self.delete_question, style="Danger.TButton").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(4, 0))

        move_row = ttk.Frame(self.left_frame, style="Glass.TFrame")
        move_row.pack(fill=tk.X, pady=(8, 0))
        ttk.Button(move_row, text="위", command=lambda: self.bump_question(-1)).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        ttk.Button(move_row, text="아래", command=lambda: self.bump_question(1)).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=4)
        ttk.Button(move_row, text="번호", command=self.renumber_questions).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(4, 0))

        ttk.Separator(self.left_frame).pack(fill=tk.X, pady=12)
        ttk.Button(self.left_frame, text="문항 자동 정렬", command=self.auto_arrange_questions).pack(fill=tk.X)
        ttk.Button(self.left_frame, text="PDF 바로 만들기", command=self.export_pdf, style="Accent.TButton").pack(fill=tk.X, pady=(8, 0))

        self.status_var = tk.StringVar(value="준비됨")
        ttk.Label(self.left_frame, textvariable=self.status_var, style="Muted.TLabel", wraplength=235).pack(fill=tk.X, pady=(12, 0))

    def _build_canvas_panel(self) -> None:
        header = ttk.Frame(self.center_frame, style="Glass.TFrame")
        header.pack(fill=tk.X)
        ttk.Label(header, text="문제지 배치", style="Title.TLabel").pack(side=tk.LEFT)
        ttk.Label(header, text="끌어서 열과 순서를 조정하세요.", style="Muted.TLabel").pack(side=tk.LEFT, padx=(10, 0))

        canvas_holder = ttk.Frame(self.center_frame, style="Glass.TFrame")
        canvas_holder.pack(fill=tk.BOTH, expand=True, pady=(8, 0))
        self.canvas = tk.Canvas(canvas_holder, background="#dfeeff", highlightthickness=0)
        y_scroll = ttk.Scrollbar(canvas_holder, orient=tk.VERTICAL, command=self.canvas.yview)
        x_scroll = ttk.Scrollbar(canvas_holder, orient=tk.HORIZONTAL, command=self.canvas.xview)
        self.canvas.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)
        self.canvas.grid(row=0, column=0, sticky="nsew")
        y_scroll.grid(row=0, column=1, sticky="ns")
        x_scroll.grid(row=1, column=0, sticky="ew")
        canvas_holder.columnconfigure(0, weight=1)
        canvas_holder.rowconfigure(0, weight=1)

        self.canvas.bind("<ButtonPress-1>", self.on_canvas_press)
        self.canvas.bind("<B1-Motion>", self.on_canvas_drag)
        self.canvas.bind("<ButtonRelease-1>", self.on_canvas_release)

    def _build_editor_panel(self) -> None:
        ttk.Label(self.right_frame, text="문항 편집", style="Title.TLabel").pack(anchor="w")
        ttk.Label(self.right_frame, text="수정하면 PDF 미리 배치가 바로 갱신됩니다.", style="Muted.TLabel").pack(anchor="w", pady=(2, 8))

        form = ttk.Frame(self.right_frame, style="Glass.TFrame")
        form.pack(fill=tk.BOTH, expand=True)
        form.columnconfigure(1, weight=1)

        self.kind_var = tk.StringVar()
        self.number_var = tk.StringVar()
        self.score_var = tk.StringVar()
        self.answer_var = tk.StringVar()

        row = 0
        ttk.Label(form, text="유형").grid(row=row, column=0, sticky="w", pady=3)
        self.kind_combo = ttk.Combobox(
            form,
            textvariable=self.kind_var,
            values=[label for _, label in QUESTION_TYPES],
            state="readonly",
            width=16,
        )
        self.kind_combo.grid(row=row, column=1, sticky="ew", pady=3)
        self.kind_combo.bind("<<ComboboxSelected>>", self.queue_editor_save)

        row += 1
        ttk.Label(form, text="번호").grid(row=row, column=0, sticky="w", pady=3)
        ttk.Entry(form, textvariable=self.number_var, width=8).grid(row=row, column=1, sticky="ew", pady=3)

        row += 1
        ttk.Label(form, text="배점").grid(row=row, column=0, sticky="w", pady=3)
        ttk.Combobox(form, textvariable=self.score_var, values=["", "2", "3"], width=8).grid(row=row, column=1, sticky="ew", pady=3)

        row += 1
        ttk.Label(form, text="정답").grid(row=row, column=0, sticky="w", pady=3)
        ttk.Entry(form, textvariable=self.answer_var, width=8).grid(row=row, column=1, sticky="ew", pady=3)

        for variable in (self.number_var, self.score_var, self.answer_var):
            variable.trace_add("write", lambda *_args: self.queue_editor_save())

        row += 1
        ttk.Label(form, text="발문").grid(row=row, column=0, columnspan=2, sticky="w", pady=(10, 3))
        row += 1
        self.prompt_text = self.make_text(form, height=3)
        self.prompt_text.grid(row=row, column=0, columnspan=2, sticky="nsew")

        row += 1
        ttk.Label(form, text="지문 / 안내문 / 표").grid(row=row, column=0, columnspan=2, sticky="w", pady=(10, 3))
        row += 1
        self.passage_text = self.make_text(form, height=12)
        self.passage_text.grid(row=row, column=0, columnspan=2, sticky="nsew")
        form.rowconfigure(row, weight=1)

        row += 1
        ttk.Label(form, text="선택지 (한 줄에 하나)").grid(row=row, column=0, columnspan=2, sticky="w", pady=(10, 3))
        row += 1
        self.choices_text = self.make_text(form, height=7)
        self.choices_text.grid(row=row, column=0, columnspan=2, sticky="nsew")

        row += 1
        ttk.Label(form, text="메모").grid(row=row, column=0, columnspan=2, sticky="w", pady=(10, 3))
        row += 1
        self.note_text = self.make_text(form, height=3)
        self.note_text.grid(row=row, column=0, columnspan=2, sticky="ew")

        for widget in (self.prompt_text, self.passage_text, self.choices_text, self.note_text):
            widget.bind("<KeyRelease>", self.queue_editor_save)
            widget.bind("<FocusOut>", self.queue_editor_save)

        action_row = ttk.Frame(self.right_frame, style="Glass.TFrame")
        action_row.pack(fill=tk.X, pady=(10, 0))
        ttk.Button(action_row, text="적용", command=self.save_current_editor).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        ttk.Button(action_row, text="PDF 만들기", command=self.export_pdf, style="Accent.TButton").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(4, 0))

    def make_text(self, parent: ttk.Frame, height: int) -> ScrolledText:
        return ScrolledText(
            parent,
            height=height,
            wrap=tk.WORD,
            font=("Malgun Gothic", 10),
            undo=True,
            bg="#fbfdff",
            fg=self.palette["text"],
            insertbackground=self.palette["accent"],
            relief=tk.FLAT,
            borderwidth=1,
            highlightthickness=1,
            highlightcolor=self.palette["stroke"],
            highlightbackground=self.palette["stroke"],
        )

    def refresh_all(self) -> None:
        self.refresh_listbox()
        self.load_editor()
        self.render_canvas()
        self.update_title()

    def current_question(self) -> dict | None:
        for question in self.doc.get("questions", []):
            if question.get("id") == self.current_id:
                return question
        if self.doc.get("questions"):
            self.current_id = self.doc["questions"][0]["id"]
            return self.doc["questions"][0]
        return None

    def refresh_listbox(self) -> None:
        selected_id = self.current_id
        self.question_list.delete(0, tk.END)
        for question in ordered_questions(self.doc):
            label = QUESTION_TYPE_LABEL.get(question.get("kind"), "문항")
            prompt = re.sub(r"\s+", " ", str(question.get("prompt", ""))).strip()
            if len(prompt) > 22:
                prompt = prompt[:22] + "..."
            self.question_list.insert(tk.END, f"{question.get('number', '')}. [{label}] {prompt}")
        if selected_id:
            for index, question in enumerate(ordered_questions(self.doc)):
                if question.get("id") == selected_id:
                    self.question_list.selection_clear(0, tk.END)
                    self.question_list.selection_set(index)
                    self.question_list.see(index)
                    break

    def load_editor(self) -> None:
        question = self.current_question()
        self.loading_editor = True
        try:
            for text_widget in (self.prompt_text, self.passage_text, self.choices_text, self.note_text):
                text_widget.delete("1.0", tk.END)
            if not question:
                self.kind_var.set("")
                self.number_var.set("")
                self.score_var.set("")
                self.answer_var.set("")
                return
            self.kind_var.set(QUESTION_TYPE_LABEL.get(question.get("kind"), "지문형"))
            self.number_var.set(str(question.get("number", "")))
            self.score_var.set(str(question.get("score", "")))
            self.answer_var.set(str(question.get("answer", "")))
            self.prompt_text.insert("1.0", question.get("prompt", ""))
            self.passage_text.insert("1.0", question.get("passage", ""))
            self.choices_text.insert("1.0", "\n".join(question.get("choices", [])))
            self.note_text.insert("1.0", question.get("note", ""))
        finally:
            self.loading_editor = False

    def save_current_editor(self) -> None:
        if self.loading_editor:
            return
        question = self.current_question()
        if not question:
            return
        label = self.kind_var.get()
        question["kind"] = QUESTION_TYPE_BY_LABEL.get(label, question.get("kind", "passage"))
        try:
            question["number"] = int(self.number_var.get().strip())
        except ValueError:
            question["number"] = self.number_var.get().strip() or question.get("number", "")
        question["score"] = self.score_var.get().strip()
        question["answer"] = self.answer_var.get().strip()
        question["prompt"] = self.prompt_text.get("1.0", "end-1c").strip()
        question["passage"] = self.passage_text.get("1.0", "end-1c").strip()
        question["choices"] = [line.strip() for line in self.choices_text.get("1.0", "end-1c").splitlines()]
        question["note"] = self.note_text.get("1.0", "end-1c").strip()
        self.refresh_listbox()
        self.render_canvas()
        self.status_var.set("편집 내용 반영됨")

    def queue_editor_save(self, _event: object | None = None) -> None:
        if self.loading_editor:
            return
        if self.editor_after_id:
            self.after_cancel(self.editor_after_id)
        self.editor_after_id = self.after(320, self.save_current_editor)

    def on_list_select(self, _event: object | None = None) -> None:
        selection = self.question_list.curselection()
        if not selection:
            return
        self.save_current_editor()
        ordered = ordered_questions(self.doc)
        index = selection[0]
        if index < len(ordered):
            self.current_id = ordered[index]["id"]
            self.load_editor()
            self.render_canvas()

    def estimate_card_height(self, question: dict) -> int:
        prompt_len = len(str(question.get("prompt", "")))
        passage_len = len(str(question.get("passage", "")))
        choices_len = sum(len(str(choice)) for choice in question.get("choices", []))
        lines = 2 + prompt_len // 34 + passage_len // 70 + choices_len // 60
        return max(86, min(230, 54 + lines * 12))

    def render_canvas(self) -> None:
        self.canvas.delete("all")
        page_width = 615
        margin = 34
        gap = 24
        col_width = (page_width - margin * 2 - gap) // 2
        page_x = 42
        page_y = 28

        questions = self.doc.get("questions", [])
        max_y = max([float(q.get("y", 70) or 70) + self.estimate_card_height(q) for q in questions] + [760])
        page_height = int(max(830, max_y + 94))

        for i in range(0, page_height + 120, 6):
            color = "#dfeeff" if i % 12 == 0 else "#e7f3ff"
            self.canvas.create_rectangle(0, i, page_x + page_width + 90, i + 6, fill=color, outline=color)

        rounded_rect(self.canvas, page_x + 7, page_y + 9, page_x + page_width + 7, page_y + page_height + 9, 20, fill="#c6d9ef", outline="")
        rounded_rect(self.canvas, page_x, page_y, page_x + page_width, page_y + page_height, 20, fill="#fffdfb", outline="#b8cce5", width=1)
        self.canvas.create_text(
            page_x + page_width // 2,
            page_y + 30,
            text=str(self.doc.get("title", "영어영역 문제지")),
            font=("Malgun Gothic", 15, "bold"),
            fill="#111827",
        )
        self.canvas.create_text(
            page_x + page_width // 2,
            page_y + 53,
            text=f"{self.doc.get('subtitle', '')} · {self.doc.get('form', '')}",
            font=("Malgun Gothic", 9),
            fill="#5b677a",
        )
        sep_x = page_x + margin + col_width + gap // 2
        self.canvas.create_line(sep_x, page_y + 76, sep_x, page_y + page_height - 30, fill="#c7d4e5")

        for question in ordered_questions(self.doc):
            column = max(0, min(1, int(question.get("column", 0) or 0)))
            y = max(70, float(question.get("y", 70) or 70))
            x1 = page_x + margin + column * (col_width + gap)
            y1 = page_y + y
            x2 = x1 + col_width
            height = self.estimate_card_height(question)
            y2 = y1 + height
            selected = question.get("id") == self.current_id
            fill = "#eef8ff" if selected else "#ffffff"
            outline = "#1478ff" if selected else "#c4d3e5"
            rounded_rect(self.canvas, x1 + 4, y1 + 5, x2 + 4, y2 + 5, 11, fill="#d3dfec", outline="")
            rounded_rect(self.canvas, x1, y1, x2, y2, 11, fill=fill, outline=outline, width=2 if selected else 1)
            if selected:
                self.canvas.create_line(x1 + 12, y1 + 2, x2 - 12, y1 + 2, fill="#7cc7ff", width=2)
            label = QUESTION_TYPE_LABEL.get(question.get("kind"), "문항")
            prompt = re.sub(r"\s+", " ", str(question.get("prompt", ""))).strip()
            passage = re.sub(r"\s+", " ", str(question.get("passage", ""))).strip()
            if len(prompt) > 42:
                prompt = prompt[:42] + "..."
            if len(passage) > 135:
                passage = passage[:135] + "..."
            score = f" [{question.get('score')}점]" if question.get("score") else ""
            text = f"{question.get('number', '')}. {prompt}{score}\n{label}\n{passage}"
            item_text = self.canvas.create_text(
                x1 + 12,
                y1 + 12,
                text=text,
                anchor="nw",
                width=col_width - 24,
                font=("Malgun Gothic", 9),
                fill="#111827",
                tags=(f"qid:{question['id']}", "question_card"),
            )
            self.canvas.addtag_withtag(f"qid:{question['id']}", item_text)

        self.canvas.configure(scrollregion=(0, 0, page_x + page_width + 50, page_y + page_height + 50))

    def question_from_canvas_item(self, item: int) -> dict | None:
        tags = self.canvas.gettags(item)
        qid = None
        for tag in tags:
            if tag.startswith("qid:"):
                qid = tag[4:]
                break
        if not qid:
            return None
        for question in self.doc.get("questions", []):
            if question.get("id") == qid:
                return question
        return None

    def on_canvas_press(self, event: tk.Event) -> None:
        item_tuple = self.canvas.find_closest(self.canvas.canvasx(event.x), self.canvas.canvasy(event.y))
        if not item_tuple:
            return
        question = self.question_from_canvas_item(item_tuple[0])
        if not question:
            return
        self.save_current_editor()
        self.current_id = question["id"]
        self.load_editor()
        self.render_canvas()
        self.drag_state = {"id": question["id"]}

    def on_canvas_drag(self, event: tk.Event) -> None:
        if not self.drag_state:
            return
        question = self.current_question()
        if not question:
            return
        page_x = 42
        page_y = 28
        margin = 34
        gap = 24
        page_width = 615
        col_width = (page_width - margin * 2 - gap) // 2
        x = self.canvas.canvasx(event.x)
        y = self.canvas.canvasy(event.y)
        column_mid = page_x + margin + col_width + gap / 2
        question["column"] = 1 if x >= column_mid else 0
        question["y"] = max(70, y - page_y - 30)
        self.render_canvas()

    def on_canvas_release(self, _event: tk.Event) -> None:
        if self.drag_state:
            self.drag_state = None
            self.refresh_listbox()
            self.status_var.set("문항 위치 조정됨")

    def add_question_dialog(self) -> None:
        win = tk.Toplevel(self)
        win.title("문항 추가")
        win.transient(self)
        win.grab_set()
        win.resizable(False, False)
        frame = ttk.Frame(win, padding=14)
        frame.pack(fill=tk.BOTH, expand=True)
        ttk.Label(frame, text="추가할 문항 유형을 선택하세요.").pack(anchor="w")
        kind_var = tk.StringVar(value=QUESTION_TYPES[0][1])
        combo = ttk.Combobox(frame, textvariable=kind_var, values=[label for _, label in QUESTION_TYPES], state="readonly", width=24)
        combo.pack(pady=(8, 12), fill=tk.X)
        combo.focus_set()

        def confirm() -> None:
            kind = QUESTION_TYPE_BY_LABEL.get(kind_var.get(), "passage")
            self.add_question(kind)
            win.destroy()

        row = ttk.Frame(frame)
        row.pack(fill=tk.X)
        ttk.Button(row, text="추가", command=confirm, style="Accent.TButton").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        ttk.Button(row, text="취소", command=win.destroy).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(4, 0))
        win.bind("<Return>", lambda _event: confirm())
        win.bind("<Escape>", lambda _event: win.destroy())

    def add_question(self, kind: str = "passage") -> None:
        self.save_current_editor()
        question = new_question(self.next_question_number(), kind)
        self.place_new_question(question)
        self.doc.setdefault("questions", []).append(question)
        self.current_id = question["id"]
        self.refresh_all()
        self.status_var.set("새 문항 추가됨")

    def next_question_number(self) -> int:
        numbers = []
        for question in self.doc.get("questions", []):
            try:
                numbers.append(int(question.get("number", 0)))
            except (TypeError, ValueError):
                continue
        return max(numbers, default=17) + 1

    def place_new_question(self, question: dict) -> None:
        columns = {0: 70, 1: 70}
        for existing in self.doc.get("questions", []):
            col = max(0, min(1, int(existing.get("column", 0) or 0)))
            bottom = float(existing.get("y", 70) or 70) + self.estimate_card_height(existing) + 16
            columns[col] = max(columns[col], bottom)
        column = 0 if columns[0] <= columns[1] else 1
        question["column"] = column
        question["y"] = columns[column]

    def duplicate_question(self) -> None:
        self.save_current_editor()
        question = self.current_question()
        if not question:
            return
        clone = json.loads(json.dumps(question, ensure_ascii=False))
        clone["id"] = str(uuid.uuid4())
        clone["number"] = self.next_question_number()
        clone["y"] = float(question.get("y", 70) or 70) + self.estimate_card_height(question) + 14
        self.doc.setdefault("questions", []).append(clone)
        self.current_id = clone["id"]
        self.refresh_all()
        self.status_var.set("문항 복제됨")

    def delete_question(self) -> None:
        question = self.current_question()
        if not question:
            return
        if not messagebox.askyesno("문항 삭제", f"{question.get('number', '')}번 문항을 삭제할까요?"):
            return
        self.doc["questions"] = [q for q in self.doc.get("questions", []) if q.get("id") != question.get("id")]
        self.current_id = self.doc["questions"][0]["id"] if self.doc.get("questions") else None
        self.refresh_all()
        self.status_var.set("문항 삭제됨")

    def bump_question(self, direction: int) -> None:
        self.save_current_editor()
        ordered = ordered_questions(self.doc)
        question = self.current_question()
        if not question or question not in ordered:
            return
        index = ordered.index(question)
        new_index = max(0, min(len(ordered) - 1, index + direction))
        if new_index == index:
            return
        other = ordered[new_index]
        question["column"], other["column"] = other.get("column", 0), question.get("column", 0)
        question["y"], other["y"] = other.get("y", 70), question.get("y", 70)
        self.refresh_all()
        self.status_var.set("문항 순서 변경됨")

    def renumber_questions(self) -> None:
        self.save_current_editor()
        for index, question in enumerate(ordered_questions(self.doc), start=1):
            question["number"] = index
        self.refresh_all()
        self.status_var.set("문항 번호 다시 매김")

    def auto_arrange_questions(self) -> None:
        self.save_current_editor()
        columns = {0: 70, 1: 70}
        for question in ordered_questions(self.doc):
            column = 0 if columns[0] <= columns[1] else 1
            question["column"] = column
            question["y"] = columns[column]
            columns[column] += self.estimate_card_height(question) + 16
        self.refresh_all()
        self.status_var.set("문항 자동 정렬됨")

    def update_title(self) -> None:
        marker = "" if self.project_path else " - 새 프로젝트"
        self.title(f"{APP_NAME} {APP_VERSION}{marker}")

    def new_project(self) -> None:
        if not self.confirm_discard():
            return
        self.doc = sample_document()
        self.project_path = None
        self.current_id = self.doc["questions"][0]["id"] if self.doc["questions"] else None
        self.refresh_all()
        self.status_var.set("새 프로젝트")

    def confirm_discard(self) -> bool:
        return messagebox.askyesno("확인", "현재 프로젝트를 닫고 진행할까요? 저장하지 않은 내용은 사라질 수 있습니다.")

    def open_project(self) -> None:
        if not self.confirm_discard():
            return
        path = filedialog.askopenfilename(
            title="프로젝트 열기",
            filetypes=[("문제지 프로젝트", "*.json"), ("모든 파일", "*.*")],
        )
        if not path:
            return
        try:
            self.doc = read_project(Path(path))
        except Exception as exc:
            messagebox.showerror("열기 실패", str(exc))
            return
        self.project_path = Path(path)
        self.current_id = self.doc["questions"][0]["id"] if self.doc.get("questions") else None
        self.refresh_all()
        self.status_var.set(f"열림: {Path(path).name}")

    def save_project(self) -> None:
        self.save_current_editor()
        if not self.project_path:
            self.save_project_as()
            return
        try:
            write_project(self.project_path, self.doc)
        except Exception as exc:
            messagebox.showerror("저장 실패", str(exc))
            return
        self.status_var.set(f"저장됨: {self.project_path.name}")

    def save_project_as(self) -> None:
        self.save_current_editor()
        path = filedialog.asksaveasfilename(
            title="프로젝트 저장",
            defaultextension=".json",
            initialfile="english_exam_project.json",
            filetypes=[("문제지 프로젝트", "*.json"), ("모든 파일", "*.*")],
        )
        if not path:
            return
        self.project_path = Path(path)
        self.save_project()
        self.update_title()

    def export_pdf(self) -> None:
        self.save_current_editor()
        path = filedialog.asksaveasfilename(
            title="PDF 바로 만들기",
            defaultextension=".pdf",
            initialfile="english_exam.pdf",
            filetypes=[("PDF 파일", "*.pdf"), ("모든 파일", "*.*")],
        )
        if not path:
            return
        pdf_path = Path(path)
        try:
            export_pdf_direct(self.doc, pdf_path)
        except Exception as exc:
            messagebox.showerror("PDF 생성 실패", str(exc))
            return
        self.status_var.set(f"PDF 저장됨: {pdf_path.name}")
        messagebox.showinfo("PDF 생성 완료", f"PDF를 만들었습니다.\n{pdf_path}")

    def edit_document_settings(self) -> None:
        win = tk.Toplevel(self)
        win.title("문서 설정")
        win.transient(self)
        win.grab_set()
        win.resizable(False, False)
        frame = ttk.Frame(win, padding=14)
        frame.pack(fill=tk.BOTH, expand=True)
        fields = [
            ("title", "제목"),
            ("subtitle", "부제"),
            ("form", "형식"),
            ("copyright", "상단 문구"),
        ]
        variables: dict[str, tk.StringVar] = {}
        for row, (key, label) in enumerate(fields):
            ttk.Label(frame, text=label).grid(row=row, column=0, sticky="w", pady=4)
            var = tk.StringVar(value=str(self.doc.get(key, "")))
            variables[key] = var
            ttk.Entry(frame, textvariable=var, width=48).grid(row=row, column=1, sticky="ew", pady=4, padx=(8, 0))
        frame.columnconfigure(1, weight=1)

        def confirm() -> None:
            for key, var in variables.items():
                self.doc[key] = var.get().strip()
            win.destroy()
            self.refresh_all()
            self.status_var.set("문서 설정 변경됨")

        row = ttk.Frame(frame)
        row.grid(row=len(fields), column=0, columnspan=2, sticky="ew", pady=(12, 0))
        ttk.Button(row, text="적용", command=confirm, style="Accent.TButton").pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(0, 4))
        ttk.Button(row, text="취소", command=win.destroy).pack(side=tk.LEFT, expand=True, fill=tk.X, padx=(4, 0))
        win.bind("<Return>", lambda _event: confirm())
        win.bind("<Escape>", lambda _event: win.destroy())

    def show_help(self) -> None:
        messagebox.showinfo(
            "사용 팁",
            "\n".join(
                [
                    "1. 왼쪽에서 문항을 추가하고 오른쪽에서 발문, 지문, 선택지를 수정합니다.",
                    "2. 가운데 카드들을 드래그하면 열과 출력 순서를 바꿀 수 있습니다.",
                    "3. 표 문항은 | Club | Day | Time | 같은 파이프 형식으로 입력하면 PDF 표로 변환됩니다.",
                    "4. PDF는 앱이 직접 생성하므로 LaTeX, MiKTeX, TeX Live가 필요 없습니다.",
                    "5. 프로젝트 JSON 저장/불러오기로 수업별 문제지를 계속 편집할 수 있습니다.",
                ]
            ),
        )


def run_cli(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=APP_NAME)
    parser.add_argument("--demo-pdf", type=Path, help="샘플 문제지를 PDF로 저장합니다.")
    parser.add_argument("--demo-project", type=Path, help="샘플 프로젝트 JSON을 저장합니다.")
    args = parser.parse_args(argv)

    if args.demo_pdf:
        export_pdf_direct(sample_document(), args.demo_pdf)
        print(args.demo_pdf)
        return 0
    if args.demo_project:
        args.demo_project.parent.mkdir(parents=True, exist_ok=True)
        write_project(args.demo_project, sample_document())
        print(args.demo_project)
        return 0
    return -1


def main() -> None:
    cli_result = run_cli(sys.argv[1:])
    if cli_result >= 0:
        raise SystemExit(cli_result)
    app = MakerApp()
    app.mainloop()


if __name__ == "__main__":
    main()
