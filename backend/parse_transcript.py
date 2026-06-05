"""
SMU Transcript Parser
=====================
Parses an SMU unofficial transcript PDF into structured JSON.
No LLM required — uses regex and rule-based line parsing.

Usage:
    python parse_transcript.py <path_to_transcript.pdf>

Output:
    Prints JSON to stdout. Redirect to a file if needed:
    python parse_transcript.py transcript.pdf > output.json

Dependencies:
    pip install pdfplumber
"""

import re
import json
import sys
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("Error: pdfplumber not installed. Run: pip install pdfplumber", file=sys.stderr)
    sys.exit(1)


# ---------------------------------------------------------------------------
# Grade mappings
# ---------------------------------------------------------------------------

GRADE_POINTS = {
    "A+": 4.3, "A": 4.0, "A-": 3.7,
    "B+": 3.3, "B": 3.0, "B-": 2.7,
    "C+": 2.3, "C": 2.0, "C-": 1.7,
    "D+": 1.3, "D": 1.0, "F": 0.0,
}

# Grades that don't contribute to GPA
NON_GRADED = {"P", "IP", "I", "W", "-", ""}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_text(pdf_path: str) -> str:
    """Extract full text from all pages, stripping repeated page headers."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text() or ""
            pages.append(text)
    return "\n".join(pages)


def clean_text(raw: str) -> list[str]:
    """
    Strip boilerplate lines that repeat on every page and return a clean
    list of non-empty lines.
    """
    boilerplate = {
        "singapore management university",
        "course description",
        "units grade points",
        "taken/earned per unit",
        "grade",
        "page 1 of 2",
        "page 2 of 2",
        "continued",
        "end of transcript",
    }

    lines = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        # Skip lines that are purely boilerplate
        if stripped.lower() in boilerplate:
            continue
        # Skip the repeated header lines containing name/student ID/dates
        if re.match(r"^(Name:|Date of Enrolment:|Date of Birth:)", stripped):
            continue
        lines.append(stripped)
    return lines


def parse_enrolment_year(lines: list[str]) -> int:
    """Extract enrolment year from header — needed for semester label mapping."""
    for line in lines[:10]:
        m = re.search(r"Date of Enrolment:\s*\d{1,2} \w+ (\d{4})", line)
        if m:
            return int(m.group(1))
    return 2022  # fallback


def parse_term_header(line: str):
    """
    Match a term header like '2022-23 Term 1' or '2024-25 Term 3A'.
    Returns (academic_year_str, term_num_str) or None.
    """
    m = re.match(r"^(\d{4}-\d{2}) Term (\d+[A-Z]?)$", line)
    if m:
        return m.group(1), m.group(2)
    return None


def parse_course_line(line: str):
    """
    Match a course row like:
        Fashioning a Nation   1.0 / 1.0   A-   3.7
        Marketing             1.0 / 0.0   IP   -

    Returns a dict or None if the line doesn't look like a course row.
    """
    # Pattern: <name> <units_taken> / <units_earned> <grade> <grade_points|-|->
    m = re.match(
        r"^(.+?)\s+([\d.]+)\s*/\s*([\d.]+)\s+([A-Z][+\-]?|IP|I|P|W|-)\s+([\d.]+|-)\s*$",
        line,
    )
    if not m:
        return None

    name        = m.group(1).strip()
    units_taken = float(m.group(2))
    units_earned= float(m.group(3))
    grade       = m.group(4).strip()
    gp_raw      = m.group(5).strip()
    grade_points= float(gp_raw) if gp_raw != "-" else None

    in_progress = grade == "IP"
    graded      = grade not in NON_GRADED

    return {
        "name":         name,
        "units_taken":  units_taken,
        "units_earned": units_earned,
        "grade":        grade,
        "grade_points": grade_points,
        "in_progress":  in_progress,
        "graded":       graded,
    }


def parse_term_total(line: str):
    """
    Match lines like:
        Term Total: Course Units Attempted = 5.0; Earned = 5.0; Term Grade Point Average = 3.62
        Term Total: Course Units Transferred = 4.0
    Returns term_gpa (float) or None if not a graded term.
    """
    m = re.search(r"Term Grade Point Average\s*=\s*([\d.]+)", line)
    if m:
        return float(m.group(1))
    return None


def parse_cumulative(lines: list[str]) -> dict:
    """Extract cumulative totals from the bottom of the transcript."""
    cumulative = {}
    in_section = False
    for line in lines:
        if line.startswith("Cumulative Total"):
            in_section = True
            continue
        if in_section:
            m = re.search(r"Cumulative Grade Point Average\s*=\s*([\d.]+)", line)
            if m:
                cumulative["gpa"] = float(m.group(1))
            m = re.search(r"Course Units Earned\s*=\s*([\d.]+)", line)
            if m:
                cumulative["units_earned"] = float(m.group(1))
            m = re.search(r"Course Units Exempted\s*=\s*([\d.]+)", line)
            if m:
                cumulative["units_exempted"] = float(m.group(1))
            m = re.search(r"Course Units Accepted for Transfer\s*=\s*([\d.]+)", line)
            if m:
                cumulative["units_transferred"] = float(m.group(1))
            # Stop at grading system table
            if line.startswith("Grading System") or line.startswith("Student Status"):
                break
    return cumulative


def semester_label(enrolment_year: int, academic_year_str: str, term_num: str) -> str:
    """
    Convert '2022-23 Term 1' → '1.1', '2023-24 Term 2' → '2.2', etc.
    Term 3A returns None (excluded from GPA mapping).
    """
    if not term_num.isdigit():
        return None  # e.g. Term 3A

    start_year = int(academic_year_str.split("-")[0])
    year_num   = start_year - enrolment_year + 1
    term_int   = int(term_num)

    if term_int not in (1, 2):
        return None  # Term 3/3A — short terms, skip

    return f"{year_num}.{term_int}"


# ---------------------------------------------------------------------------
# Main parser
# ---------------------------------------------------------------------------

def parse_transcript(pdf_path: str) -> dict:
    raw   = extract_text(pdf_path)
    lines = clean_text(raw)

    enrol_year = parse_enrolment_year(lines)
    cumulative = parse_cumulative(lines)

    semesters  = []
    current_term = None  # holds the term being built

    i = 0
    while i < len(lines):
        line = lines[i]

        # ── Term header ────────────────────────────────────────────────────
        term_match = parse_term_header(line)
        if term_match:
            # Save previous term if exists
            if current_term:
                semesters.append(current_term)

            acad_year, term_num = term_match
            label = semester_label(enrol_year, acad_year, term_num)

            current_term = {
                "label":         label,
                "academic_year": acad_year,
                "term":          term_num,
                "type":          "regular",
                "term_gpa":      None,
                "courses":       [],
            }
            i += 1
            continue

        # ── Special term content ───────────────────────────────────────────
        if current_term:

            # Leave of Absence
            if line == "Leave of Absence":
                current_term["type"] = "leave_of_absence"
                i += 1
                continue

            # Exchange programme block
            if "International Student Exchange Programme" in line:
                current_term["type"] = "exchange"
                i += 1
                continue

            # Subtitle line (e.g. '- Wealth and Poverty', '- SMU-X')
            # Append to the last course name
            if line.startswith("- ") and current_term["courses"]:
                subtitle = line[2:].strip()
                current_term["courses"][-1]["name"] += f" ({subtitle})"
                i += 1
                continue

            # Term total line
            if line.startswith("Term Total:"):
                gpa = parse_term_total(line)
                # Only store non-zero GPAs (Term 3A and IP semesters return 0.00)
                if gpa and gpa > 0:
                    current_term["term_gpa"] = gpa
                i += 1
                continue

            # Skip transfer credit lines inside exchange block
            if current_term["type"] == "exchange" and (
                "Transfer of Credits" in line or
                re.search(r"^\S.+- / \d+\.\d+ - -$", line)
            ):
                i += 1
                continue

            # Course row
            course = parse_course_line(line)
            if course:
                current_term["courses"].append(course)
                i += 1
                continue

        # ── Stop parsing at cumulative/grading section ─────────────────────
        if line.startswith("Cumulative Total") or line.startswith("Grading System"):
            break

        i += 1

    # Append last term
    if current_term:
        semesters.append(current_term)

    # ── Post-process: filter out terms with no label and no GPA relevance ──
    # Keep all terms for completeness but flag skipped ones
    for sem in semesters:
        if sem["label"] is None:
            sem["included_in_gpa_chart"] = False
        else:
            sem["included_in_gpa_chart"] = (
                sem["type"] not in ("leave_of_absence", "exchange")
                and sem["term_gpa"] is not None
                and sem["term_gpa"] > 0
            )

    return {
        "semesters":  semesters,
        "cumulative": cumulative,
    }


# ---------------------------------------------------------------------------
# GPA chart data — convenience export matching your existing viz format
# ---------------------------------------------------------------------------

def to_chart_data(parsed: dict) -> list[dict]:
    """
    Returns a list of { sem, label, term_gpa, courses, note } objects
    for only the semesters that should appear on the GPA chart.

    'note' flags Exchange/Internship terms (label exists but type is exchange).
    """
    chart = []
    for sem in parsed["semesters"]:
        if not sem.get("included_in_gpa_chart"):
            continue
        note = "Exchange / Internship" if sem["type"] == "exchange" else ""
        chart.append({
            "sem":      sem["label"],
            "label":    f"Y{sem['label'].split('.')[0]} S{sem['label'].split('.')[1]}",
            "term_gpa": sem["term_gpa"],
            "courses":  sem["courses"],
            "note":     note,
        })
    return chart


# ---------------------------------------------------------------------------
# CLI entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse_transcript.py <transcript.pdf>", file=sys.stderr)
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not Path(pdf_path).exists():
        print(f"Error: file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    result = parse_transcript(pdf_path)
    result["chart_data"] = to_chart_data(result)

    print(json.dumps(result, indent=2))
