"""RAG-lite schema retrieval using TF-IDF keyword matching."""
import re
from collections import defaultdict


def _tokenize(text: str) -> list[str]:
    return re.findall(r"\w+", text.lower())


def build_index(schema: str) -> dict[str, list[str]]:
    """Extract table → columns mapping from DDL."""
    tables: dict[str, list[str]] = {}
    current_table = None
    for line in schema.splitlines():
        line = line.strip()
        table_m = re.match(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", line, re.IGNORECASE)
        if table_m:
            current_table = table_m.group(1)
            tables[current_table] = []
            continue
        if current_table:
            col_m = re.match(r"(\w+)\s+\w+", line)
            if col_m and col_m.group(1).upper() not in ("PRIMARY", "FOREIGN", "UNIQUE", "INDEX", "KEY", "CONSTRAINT"):
                tables[current_table].append(col_m.group(1))
            if line.startswith(")"):
                current_table = None
    return tables


def retrieve_relevant_schema(question: str, schema: str) -> str:
    """Return only the schema parts most relevant to the question."""
    if not schema.strip():
        return schema

    tables = build_index(schema)
    if not tables:
        return schema  # fallback: return full schema

    question_tokens = set(_tokenize(question))

    scores: dict[str, float] = {}
    for table, columns in tables.items():
        table_tokens = set(_tokenize(table))
        col_tokens = set(_tokenize(" ".join(columns)))
        all_tokens = table_tokens | col_tokens
        score = len(question_tokens & all_tokens)
        # Bonus for table name match
        if table.lower() in question.lower():
            score += 5
        scores[table] = score

    if not scores:
        return schema

    # Keep tables with score > 0, or top-3 if all zero
    relevant = [t for t, s in scores.items() if s > 0]
    if not relevant:
        relevant = sorted(scores, key=scores.get, reverse=True)[:3]  # type: ignore

    # Extract DDL blocks for relevant tables
    lines = schema.splitlines()
    result_lines: list[str] = []
    inside = False
    current = None

    for line in lines:
        table_m = re.match(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", line, re.IGNORECASE)
        if table_m:
            current = table_m.group(1)
            inside = current in relevant
        if inside:
            result_lines.append(line)
        if line.strip().startswith(")") and inside:
            result_lines.append("")
            inside = False

    return "\n".join(result_lines) if result_lines else schema
