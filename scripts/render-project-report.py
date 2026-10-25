"""Render the editable Signalbound Markdown report as a print-ready PDF.

Requires: python -m pip install reportlab pillow. Run from the repository root:
    py scripts/render-project-report.py
The script also draws the two original explanatory diagrams used in the PDF.
"""

from __future__ import annotations

import html
import re
from pathlib import Path

from PIL import Image as PILImage, ImageDraw, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    CondPageBreak, Image, Paragraph, Preformatted, SimpleDocTemplate, Spacer,
    Table, TableStyle,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "docs/signalbound-project-report.md"
OUTPUT = ROOT / "docs/signalbound-project-report.pdf"
ASSETS = ROOT / "docs/report-assets"
INK = colors.HexColor("#15283b")
MUTED = colors.HexColor("#4c6170")
MINT = colors.HexColor("#217e69")
GOLD = colors.HexColor("#c48021")
PALE = colors.HexColor("#edf5f2")
PAGE_W, PAGE_H = A4
LEFT = 49
RIGHT = 49
WIDTH = PAGE_W - LEFT - RIGHT


def font_path(name: str) -> Path:
    choices = [
        Path("C:/Windows/Fonts") / name,
        Path("/usr/share/fonts/truetype/dejavu") / name,
    ]
    for candidate in choices:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(name)


try:
    pdfmetrics.registerFont(TTFont("ReportSans", str(font_path("DejaVuSans.ttf"))))
    pdfmetrics.registerFont(TTFont("ReportSansBold", str(font_path("DejaVuSans-Bold.ttf"))))
    pdfmetrics.registerFont(TTFont("ReportMono", str(font_path("DejaVuSansMono.ttf"))))
except FileNotFoundError:
    # Arial/Consolas are present on the Windows authoring host.
    pdfmetrics.registerFont(TTFont("ReportSans", str(font_path("arial.ttf"))))
    pdfmetrics.registerFont(TTFont("ReportSansBold", str(font_path("arialbd.ttf"))))
    pdfmetrics.registerFont(TTFont("ReportMono", str(font_path("consola.ttf"))))
pdfmetrics.registerFontFamily("ReportSans", normal="ReportSans", bold="ReportSansBold")

STYLES = {
    "title": ParagraphStyle("title", fontName="ReportSansBold", fontSize=28, leading=35,
                            textColor=INK, spaceAfter=15),
    "subtitle": ParagraphStyle("subtitle", fontName="ReportSans", fontSize=15, leading=21,
                               textColor=MUTED, spaceAfter=16),
    "h2": ParagraphStyle("h2", fontName="ReportSansBold", fontSize=15, leading=20,
                         textColor=INK, spaceBefore=21, spaceAfter=9),
    "h3": ParagraphStyle("h3", fontName="ReportSansBold", fontSize=11.2, leading=16,
                         textColor=MINT, spaceBefore=16, spaceAfter=7),
    "body": ParagraphStyle("body", fontName="ReportSans", fontSize=9.1, leading=14.3,
                           textColor=INK, spaceAfter=8),
    "small": ParagraphStyle("small", fontName="ReportSans", fontSize=7.4, leading=10.8,
                            textColor=INK, spaceAfter=3),
    "caption": ParagraphStyle("caption", fontName="ReportSans", fontSize=8.1, leading=12.4,
                              textColor=MUTED, spaceBefore=4, spaceAfter=13),
    "quote": ParagraphStyle("quote", fontName="ReportSans", fontSize=9, leading=14,
                            textColor=MUTED, leftIndent=12, rightIndent=11,
                            backColor=PALE, borderPadding=10, spaceAfter=12),
    "code": ParagraphStyle("code", fontName="ReportMono", fontSize=7.0, leading=10.2,
                           textColor=INK, backColor=colors.HexColor("#f1f4f6"),
                           borderPadding=8, spaceAfter=10),
}


def inline_markup(source: str) -> str:
    source = html.escape(source.replace("  ", " "))
    source = re.sub(r"\[([^\]]+)\]\(([^)]+)\)",
                    lambda m: f'<link href="{m.group(2)}" color="#217e69">{m.group(1)}</link>', source)
    source = re.sub(r"`([^`]+)`", r'<font name="ReportMono" size="8">\1</font>', source)
    source = re.sub(r"\*\*([^*]+)\*\*", r'<b>\1</b>', source)
    source = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r'<i>\1</i>', source)
    return source


def para(text: str, style: str = "body") -> Paragraph:
    return Paragraph(inline_markup(text), STYLES[style])


def image_flow(path: Path, max_width=WIDTH, max_height=295):
    with PILImage.open(path) as im:
        w, h = im.size
    factor = min(max_width / w, max_height / h)
    return Image(str(path), width=w * factor, height=h * factor)


def rounded_box(draw, rect, fill, outline, label, font):
    draw.rounded_rectangle(rect, radius=18, fill=fill, outline=outline, width=4)
    bounds = draw.multiline_textbbox((0, 0), label, font=font, spacing=8, align="center")
    tx = (rect[0] + rect[2] - (bounds[2] - bounds[0])) / 2
    ty = (rect[1] + rect[3] - (bounds[3] - bounds[1])) / 2
    draw.multiline_text((tx, ty), label, font=font, fill="#14283b", spacing=8, align="center")


def draw_diagrams():
    ASSETS.mkdir(exist_ok=True)
    fontfile = "C:/Windows/Fonts/arial.ttf"
    if not Path(fontfile).exists():
        fontfile = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    font = ImageFont.truetype(fontfile, 28)
    small = ImageFont.truetype(fontfile, 22)
    im = PILImage.new("RGB", (1460, 710), "#ffffff")
    d = ImageDraw.Draw(im)
    cards = [
        ((40, 55, 355, 190), "Browser\nSolo · rooms · dashboard", "#e9f5ee"),
        ((565, 55, 880, 190), "TLS / WSS\nNginx proxy", "#e9f1f9"),
        ((1090, 55, 1410, 190), "Node server\nHTTP + room state", "#e9f5ee"),
        ((140, 440, 520, 590), "C++ executables\nrouting · rules · replay", "#fff4e1"),
        ((925, 440, 1320, 590), "SQLite\nmarkers · matches · players", "#fff4e1"),
    ]
    for rect, label, fill in cards:
        rounded_box(d, rect, fill, "#708999", label, font)
    def arrow(start, end, label):
        d.line([start, end], fill="#287966", width=8)
        x, y = end
        d.polygon([(x, y), (x - 18, y - 11), (x - 18, y + 11)], fill="#287966")
        d.text(((start[0] + end[0]) / 2 - 45, start[1] - 40), label, font=small, fill="#4c6170")
    arrow((360, 123), (554, 123), "HTTPS")
    arrow((885, 123), (1078, 123), "loopback")
    d.line([(1180, 195), (1180, 340), (325, 340), (325, 429)], fill="#287966", width=8)
    d.polygon([(325, 440), (313, 416), (337, 416)], fill="#287966")
    d.text((490, 300), "seed + actions  →  engine JSON", font=small, fill="#4c6170")
    d.line([(1240, 195), (1240, 428)], fill="#287966", width=8)
    d.polygon([(1240, 440), (1228, 416), (1252, 416)], fill="#287966")
    d.text((1140, 305), "records", font=small, fill="#4c6170")
    d.text((42, 640), "One process on one VM; diagram shows the proposed TLS edge, not a deployed host.", font=small, fill="#4c6170")
    im.save(ASSETS / "architecture.png", optimize=True)

    im = PILImage.new("RGB", (1460, 580), "#ffffff")
    d = ImageDraw.Draw(im)
    row = [
        ((35, 165, 285, 285), "LOBBY", "#e9f1f9"),
        ((400, 165, 650, 285), "PLAYING", "#e9f5ee"),
        ((770, 55, 1070, 175), "FINISHED", "#fff4e1"),
        ((770, 225, 1070, 345), "INTERRUPTED", "#ffece6"),
        ((770, 390, 1070, 510), "ABANDONED", "#ffece6"),
    ]
    for rect, label, fill in row:
        rounded_box(d, rect, fill, "#708999", label, font)
    d.line([(290, 225), (388, 225)], fill="#287966", width=8)
    d.polygon([(400, 225), (377, 212), (377, 238)], fill="#287966")
    d.text((300, 178), "all ready", font=small, fill="#4c6170")
    for sy, ey, label, tx, ty in [
        (188, 115, "round 8", 675, 103),
        (225, 285, "restart", 675, 226),
        (265, 450, "inactivity", 675, 341),
    ]:
        d.line([(655, sy), (758, ey)], fill="#287966", width=8)
        d.polygon([(770, ey), (743, ey - 13), (743, ey + 13)], fill="#287966")
        d.text((tx, ty), label, font=small, fill="#4c6170")
    d.line([(1080, 115), (1310, 115), (1310, 535), (160, 535), (160, 300)], fill="#287966", width=7)
    d.line([(1080, 285), (1310, 285)], fill="#287966", width=7)
    d.polygon([(160, 287), (148, 310), (172, 310)], fill="#287966")
    d.text((1120, 470), "rematch / reopen", font=small, fill="#4c6170")
    im.save(ASSETS / "room-lifecycle.png", optimize=True)


def decorate(canvas, doc):
    canvas.saveState()
    page = doc.page
    canvas.setFillColor(INK)
    canvas.rect(0, PAGE_H - 8, PAGE_W, 8, stroke=0, fill=1)
    canvas.setFont("ReportSansBold", 7.5)
    canvas.drawString(LEFT, PAGE_H - 31, "SIGNALBOUND  /  TECHNICAL REPORT")
    canvas.setStrokeColor(colors.HexColor("#d5e0e4"))
    canvas.line(LEFT, 42, PAGE_W - RIGHT, 42)
    canvas.setFont("ReportSans", 7.4)
    canvas.setFillColor(MUTED)
    canvas.drawString(LEFT, 28, "phase-6 · c60da0e · 25 October 2026")
    canvas.drawRightString(PAGE_W - RIGHT, 28, f"{page}")
    canvas.restoreState()


def table_from(lines):
    rows = []
    for line in lines:
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if all(re.fullmatch(r":?-{3,}:?", c) for c in cells):
            continue
        rows.append(cells)
    n = max(len(row) for row in rows)
    widths = [WIDTH / n] * n
    if n == 3:
        widths = [WIDTH * 0.24, WIDTH * 0.30, WIDTH * 0.46]
    elif n == 4:
        widths = [WIDTH * 0.17, WIDTH * 0.17, WIDTH * 0.42, WIDTH * 0.24]
    data = []
    for row in rows:
        data.append([para(cell, "small") for cell in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#ccd9da")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    return t


def build():
    draw_diagrams()
    lines = SOURCE.read_text(encoding="utf-8").splitlines()
    story = []
    index = 0
    while index < len(lines):
        line = lines[index].strip()
        if not line:
            index += 1
            continue
        if line.startswith("```mermaid"):
            while index < len(lines) and not lines[index].strip() == "```":
                index += 1
            image = ASSETS / ("architecture.png" if not any(
                getattr(item, "filename", "").endswith("architecture.png") for item in story
            ) else "room-lifecycle.png")
            story.append(image_flow(image, max_height=245))
            index += 1
            continue
        if line.startswith("```"):
            index += 1
            code = []
            while index < len(lines) and not lines[index].strip() == "```":
                code.append(lines[index].rstrip())
                index += 1
            # Paragraph wraps long lines; Preformatted is reserved for short blocks.
            if max((len(s) for s in code), default=0) < 88:
                story.append(Preformatted("\n".join(code), STYLES["code"], maxLineLength=85))
            else:
                for raw in code:
                    story.append(para("`" + raw + "`", "small"))
            index += 1
            continue
        if line.startswith("|"):
            rows = []
            while index < len(lines) and lines[index].strip().startswith("|"):
                rows.append(lines[index])
                index += 1
            story.append(table_from(rows))
            story.append(Spacer(1, 10))
            continue
        if line.startswith("!["):
            match = re.match(r"!\[[^]]*\]\(([^)]+)\)", line)
            if match:
                path = SOURCE.parent / match.group(1)
                max_height = 375 if "mobile" in path.name else 280
                max_width = 245 if "mobile" in path.name else WIDTH
                story.append(CondPageBreak(160))
                story.append(image_flow(path, max_width=max_width, max_height=max_height))
            index += 1
            continue
        if line.startswith("# "):
            story.append(Spacer(1, 95))
            story.append(para(line[2:], "title"))
            index += 1
            continue
        if line.startswith("## "):
            heading = line[3:]
            story.append(CondPageBreak(85))
            story.append(para(heading, "subtitle" if heading.startswith("A technical") else "h2"))
            index += 1
            continue
        if line.startswith("### "):
            story.append(CondPageBreak(65))
            story.append(para(line[4:], "h3"))
            index += 1
            continue
        if line.startswith("> "):
            story.append(para(line[2:], "quote"))
            index += 1
            continue
        if line.startswith("- "):
            story.append(para("• " + line[2:], "body"))
            index += 1
            continue
        if line.startswith("**Figure "):
            story.append(para(line, "caption"))
            index += 1
            continue
        block = [line]
        index += 1
        while index < len(lines) and lines[index].strip() and not re.match(
            r"^(#|>|\||```|!\[|- )", lines[index].strip()
        ):
            block.append(lines[index].strip())
            index += 1
        story.append(para(" ".join(block)))
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, leftMargin=LEFT,
                            rightMargin=RIGHT, topMargin=50, bottomMargin=55,
                            title="Signalbound: technical report", author="Signalbound project")
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate)
    print(OUTPUT)


if __name__ == "__main__":
    build()
