"""
LangGraph NL-to-SQL agent.
Implements: generate -> validate -> (pass: end | fail: generate) as a StateGraph.
"""
import re
import time
from typing import TypedDict

try:
    from langgraph.graph import StateGraph, START, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False

from agents.adk_agent import (
    _add_to_history, _build_system_prompt, _call_llm,
    _detect_operations, _extract_field, _extract_sql, _extract_tables,
    _get_history, _trace_step, _validate_sql,
)
from agents.base_agent import AgentResult, BaseNLSQLAgent
from config import settings


class SQLState(TypedDict):
    question: str
    schema: str
    model_str: str
    model_display: str
    temperature: float
    max_tokens: int
    messages: list
    sql: str
    last_error: str
    attempts: int
    max_attempts: int
    trace: list
    final_text: str


def _build_graph():
    if not LANGGRAPH_AVAILABLE:
        return None

    async def generate_node(state: SQLState) -> SQLState:
        ts_start = time.time()
        agent = state["model_display"]
        attempt = state["attempts"] + 1

        msgs = list(state["messages"])
        if state["last_error"] and attempt > 1:
            msgs.append({
                "role": "user",
                "content": (
                    f"The previous SQL was rejected.\n"
                    f"Error: {state['last_error']}\n"
                    f"Rewrite the SQL to fix this error."
                ),
            })

        trace = list(state["trace"])
        trace.append(_trace_step(
            "generate", agent,
            f"{agent} generating SQL (attempt {attempt}/{state['max_attempts']})",
            "",
            ts_start,
        ))

        text = await _call_llm(state["model_str"], msgs, state["temperature"], state["max_tokens"])
        msgs.append({"role": "assistant", "content": text})
        trace[-1]["content"] = text[:800]
        trace[-1]["summary"] = f"{agent} returned SQL candidate"

        return {**state, "messages": msgs, "attempts": attempt, "trace": trace, "final_text": text}

    async def validate_node(state: SQLState) -> SQLState:
        ts_start = time.time()
        trace = list(state["trace"])
        text = state["final_text"]
        candidate = _extract_sql(text)

        if not candidate:
            trace.append(_trace_step(
                "validate_fail", "DuckDB",
                "No SQL block found in response — LangGraph will retry",
                f"Response did not contain a ```sql``` block.\nRaw (first 300 chars):\n{text[:300]}",
                ts_start,
            ))
            return {**state, "sql": "", "last_error": "No SQL block in response", "trace": trace}

        valid, error = _validate_sql(candidate, state["schema"])
        if valid:
            trace.append(_trace_step(
                "validate_pass", "DuckDB",
                "LangGraph node: SQL passed DuckDB EXPLAIN validation",
                f"DuckDB accepted:\n{candidate}",
                ts_start,
            ))
            return {**state, "sql": candidate, "last_error": "", "trace": trace}
        else:
            trace.append(_trace_step(
                "validate_fail", "DuckDB",
                "LangGraph node: SQL failed validation — routing back to generate",
                f"DuckDB rejected:\n{candidate}\n\nError:\n{error}",
                ts_start,
            ))
            return {**state, "sql": "", "last_error": error, "trace": trace}

    def should_continue(state: SQLState) -> str:
        if state["sql"]:
            return END
        if state["attempts"] >= state["max_attempts"]:
            return END
        return "generate"

    graph = StateGraph(SQLState)
    graph.add_node("generate", generate_node)
    graph.add_node("validate", validate_node)
    graph.add_edge(START, "generate")
    graph.add_edge("generate", "validate")
    graph.add_conditional_edges("validate", should_continue, {"generate": "generate", END: END})
    return graph.compile()


# Build once at module load
_graph = None

def get_graph():
    global _graph
    if _graph is None and LANGGRAPH_AVAILABLE:
        _graph = _build_graph()
    return _graph


class LangGraphNLSQLAgent(BaseNLSQLAgent):
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
        if not LANGGRAPH_AVAILABLE:
            raise RuntimeError(
                "LangGraph is not installed. Run: pip install langgraph"
            )

        graph = get_graph()
        history = _get_history(session_id)
        messages = [{"role": "system", "content": _build_system_prompt(schema)}]
        messages.extend(history[-6:])
        messages.append({"role": "user", "content": question})

        initial_state: SQLState = {
            "question": question,
            "schema": schema,
            "model_str": self.model_str,
            "model_display": self.model_display,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "messages": messages,
            "sql": "",
            "last_error": "",
            "attempts": 0,
            "max_attempts": settings.max_agent_iterations,
            "trace": [],
            "final_text": "",
        }

        final_state = await graph.ainvoke(initial_state)

        sql = final_state["sql"]
        text = final_state["final_text"]
        _add_to_history(session_id, "user", question)
        _add_to_history(session_id, "assistant", text)

        return AgentResult(
            sql=sql,
            explanation=_extract_field(text, "Explanation") or "Generated via LangGraph workflow.",
            intent=_extract_field(text, "Intent") or question,
            tables_used=_extract_tables(sql),
            operations=_detect_operations(sql),
            trace=final_state["trace"],
            attempts=final_state["attempts"],
        )
