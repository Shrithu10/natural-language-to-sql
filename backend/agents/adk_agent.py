"""
Agent implementations for NL-to-SQL.

ADKNLSQLAgent    — generate -> validate (DuckDB EXPLAIN) -> fix loop.
DirectNLSQLAgent — single call, no loop.
"""
import re
import time

import duckdb
import litellm

from agents.base_agent import AgentResult, BaseNLSQLAgent
from config import settings

litellm.suppress_debug_info = True


# ---------------------------------------------------------------------------
# Conversation memory
# ---------------------------------------------------------------------------
_history: dict[str, list[dict]] = {}

def _get_history(session_id: str) -> list[dict]:
    return _history.setdefault(session_id, [])

def _add_to_history(session_id: str, role: str, content: str) -> None:
    _get_history(session_id).append({"role": role, "content": content})


# ---------------------------------------------------------------------------
# SQL validation via DuckDB EXPLAIN
# ---------------------------------------------------------------------------

def _validate_sql(sql: str, schema_ddl: str) -> tuple[bool, str]:
    try:
        conn = duckdb.connect(":memory:")
        for stmt in schema_ddl.split(";"):
            s = stmt.strip()
            if s.upper().startswith("CREATE"):
                try:
                    conn.execute(s)
                except Exception:
                    pass
        conn.execute(f"EXPLAIN {sql}")
        conn.close()
        return True, ""
    except Exception as e:
        return False, str(e)


# ---------------------------------------------------------------------------
# LLM helpers
# ---------------------------------------------------------------------------

def _build_system_prompt(schema: str) -> str:
    return f"""You are an expert SQL assistant. Convert natural language questions to SQL queries.

Database schema:
{schema}

Rules:
- Output ONLY a valid SQL SELECT statement inside a ```sql ... ``` code block
- Use exact table and column names from the schema
- After the SQL block add:
  Intent: <one sentence describing what the query answers>
  Tables: <comma-separated table names used>
  Operations: <comma-separated from: filter, sort, join, aggregate, limit>
  Explanation: <1-2 sentences explaining how the query works>
- Do NOT include INSERT, UPDATE, or DELETE statements"""


async def _call_llm(model_str: str, messages: list[dict], temperature: float, max_tokens: int) -> str:
    response = await litellm.acompletion(
        model=model_str,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        api_base=settings.ollama_base_url,
    )
    return response.choices[0].message.content or ""


def _trace_step(step_type: str, author: str, summary: str, detail: str, ts: float) -> dict:
    return {
        "step_type": step_type,   # generate | validate_pass | validate_fail | retry | direct | error
        "author": author,          # display name e.g. "LLaMA 3" or "DuckDB"
        "summary": summary,        # short one-liner
        "content": detail,         # full detail (expandable)
        "ts": round(ts, 2),
    }


# ---------------------------------------------------------------------------
# ADK-style agent: generate -> validate -> fix loop
# ---------------------------------------------------------------------------

class ADKNLSQLAgent(BaseNLSQLAgent):
    def __init__(self, model_str: str, model_display: str):
        self.model_str = model_str
        self.model_display = model_display

    async def run(
        self,
        question: str,
        schema: str,
        session_id: str,
        temperature: float,
        max_tokens: int,
    ) -> AgentResult:
        trace: list[dict] = []
        start = time.time()
        agent = self.model_display

        history = _get_history(session_id)
        system = _build_system_prompt(schema)
        messages: list[dict] = [{"role": "system", "content": system}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": question})

        sql = ""
        last_error = ""
        attempts = 0
        final_text = ""

        for attempt in range(settings.max_agent_iterations):
            attempts += 1
            ts = lambda: time.time() - start  # noqa: E731

            # Inject fix prompt on retry
            if last_error and attempt > 0:
                fix_msg = (
                    f"The previous SQL was rejected by the validator.\n"
                    f"Error: {last_error}\n"
                    f"Please rewrite the SQL to fix this error."
                )
                messages.append({"role": "user", "content": fix_msg})
                trace.append(_trace_step(
                    "retry", "Workflow",
                    f"Retrying — injecting error context into {agent}",
                    f"Validation error passed back to {agent}:\n{last_error}",
                    ts(),
                ))

            # LLM generates SQL
            trace.append(_trace_step(
                "generate", agent,
                f"{agent} generating SQL (attempt {attempts}/{settings.max_agent_iterations})",
                "",
                ts(),
            ))

            try:
                text = await _call_llm(self.model_str, messages, temperature, max_tokens)
            except Exception as e:
                trace.append(_trace_step("error", agent, f"{agent} call failed", str(e), ts()))
                raise

            final_text = text
            messages.append({"role": "assistant", "content": text})

            # Update the generate step with the actual output
            trace[-1]["content"] = text[:800]
            trace[-1]["summary"] = f"{agent} returned SQL candidate"

            # Extract SQL from response
            candidate = _extract_sql(text)
            if not candidate:
                last_error = "No SQL block found in the response"
                trace.append(_trace_step(
                    "validate_fail", "DuckDB",
                    "No SQL extracted from response",
                    f"The model response did not contain a ```sql``` block.\nRaw output (first 300 chars):\n{text[:300]}",
                    ts(),
                ))
                continue

            # DuckDB validates
            valid, error = _validate_sql(candidate, schema)
            if valid:
                trace.append(_trace_step(
                    "validate_pass", "DuckDB",
                    "SQL passed syntax validation (EXPLAIN)",
                    f"DuckDB EXPLAIN accepted the query:\n{candidate}",
                    ts(),
                ))
                sql = candidate
                break
            else:
                trace.append(_trace_step(
                    "validate_fail", "DuckDB",
                    "SQL failed validation — will retry",
                    f"DuckDB EXPLAIN rejected the query:\n{candidate}\n\nError:\n{error}",
                    ts(),
                ))
                last_error = error

        _add_to_history(session_id, "user", question)
        _add_to_history(session_id, "assistant", final_text)

        return AgentResult(
            sql=sql,
            explanation=_extract_field(final_text, "Explanation") or "Generated via agent workflow.",
            intent=_extract_field(final_text, "Intent") or question,
            tables_used=_extract_tables(sql),
            operations=_detect_operations(sql),
            trace=trace,
            attempts=attempts,
        )


# ---------------------------------------------------------------------------
# Direct: single LLM call, no loop
# ---------------------------------------------------------------------------

class DirectNLSQLAgent(BaseNLSQLAgent):
    def __init__(self, model_str: str, model_display: str):
        self.model_str = model_str
        self.model_display = model_display

    async def run(
        self,
        question: str,
        schema: str,
        session_id: str,
        temperature: float,
        max_tokens: int,
    ) -> AgentResult:
        start = time.time()
        agent = self.model_display

        history = _get_history(session_id)
        messages: list[dict] = [{"role": "system", "content": _build_system_prompt(schema)}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": question})

        text = await _call_llm(self.model_str, messages, temperature, max_tokens)
        sql = _extract_sql(text)

        _add_to_history(session_id, "user", question)
        _add_to_history(session_id, "assistant", text)

        return AgentResult(
            sql=sql,
            explanation=_extract_field(text, "Explanation") or text[:200],
            intent=_extract_field(text, "Intent") or question,
            tables_used=_extract_tables(sql),
            operations=_detect_operations(sql),
            trace=[_trace_step(
                "direct", agent,
                f"{agent} generated SQL (direct, no validation loop)",
                text[:800],
                time.time() - start,
            )],
            attempts=1,
        )


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_sql(text: str) -> str:
    m = re.search(r"```sql\s*(.*?)\s*```", text, re.DOTALL | re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"(SELECT\b.+?)(?:;|$)", text, re.DOTALL | re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _extract_field(text: str, field: str) -> str:
    m = re.search(rf"{field}:\s*(.+?)(?:\n|$)", text, re.IGNORECASE)
    return m.group(1).strip() if m else ""


def _extract_tables(sql: str) -> list[str]:
    pairs = re.findall(r"\bFROM\s+(\w+)|\bJOIN\s+(\w+)", sql, re.IGNORECASE)
    return list({t for pair in pairs for t in pair if t})


def _detect_operations(sql: str) -> list[str]:
    u = sql.upper()
    ops = []
    if "WHERE" in u:       ops.append("filter")
    if "ORDER BY" in u:    ops.append("sort")
    if "JOIN" in u:        ops.append("join")
    if any(k in u for k in ("GROUP BY", "COUNT(", "SUM(", "AVG(", "MAX(", "MIN(")):
        ops.append("aggregate")
    if "HAVING" in u:      ops.append("having")
    if "LIMIT" in u:       ops.append("limit")
    return ops or ["select"]
