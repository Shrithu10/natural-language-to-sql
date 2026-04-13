"""
CrewAI NL-to-SQL agent.
Uses a two-agent crew: SQL Writer + SQL Reviewer.
"""
import re
import time

try:
    from crewai import Agent as CrewAgent, Crew, LLM, Task
    CREWAI_AVAILABLE = True
except ImportError:
    CREWAI_AVAILABLE = False

from agents.adk_agent import (
    _add_to_history, _detect_operations, _extract_field,
    _extract_sql, _extract_tables, _get_history, _trace_step, _validate_sql,
)
from agents.base_agent import AgentResult, BaseNLSQLAgent
from config import settings


class CrewAINLSQLAgent(BaseNLSQLAgent):
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
        if not CREWAI_AVAILABLE:
            raise RuntimeError(
                "CrewAI requires Python <3.14 and is not available in this environment. "
                "Use ADK or LangGraph instead."
            )

        import asyncio
        trace: list[dict] = []
        start = time.time()
        agent_name = self.model_display

        # Extract the actual model name for CrewAI LLM
        # model_str is like "ollama_chat/llama3" — crewai uses "ollama/llama3"
        crewai_model = self.model_str.replace("ollama_chat/", "ollama/")

        # Configure LLM
        llm = LLM(
            model=crewai_model,
            base_url=settings.ollama_base_url,
            temperature=temperature,
            max_tokens=max_tokens,
        )

        # SQL Writer agent
        writer = CrewAgent(
            role="SQL Writer",
            goal="Write a correct SQL SELECT query for the given question",
            backstory=(
                f"You are an expert SQL developer using {agent_name}. "
                "You write precise, readable SQL based on the provided schema."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        # SQL Reviewer agent
        reviewer = CrewAgent(
            role="SQL Reviewer",
            goal="Review the SQL query for correctness and suggest fixes if needed",
            backstory=(
                "You are a database architect who reviews SQL queries for correctness, "
                "efficiency, and compliance with the schema."
            ),
            llm=llm,
            verbose=False,
            allow_delegation=False,
        )

        write_task = Task(
            description=(
                f"Convert this question to SQL:\n"
                f"Question: {question}\n\n"
                f"Schema:\n{schema}\n\n"
                f"Return the SQL in a ```sql ... ``` block, then:\n"
                f"Intent: <one sentence>\n"
                f"Tables: <comma-separated>\n"
                f"Operations: <filter/sort/join/aggregate/limit>\n"
                f"Explanation: <1-2 sentences>"
            ),
            expected_output="SQL query in a code block with intent, tables, operations and explanation",
            agent=writer,
        )

        review_task = Task(
            description=(
                "Review the SQL query from the previous task. "
                "Check it matches the schema and answers the question correctly. "
                "If it has errors, provide a corrected version in a ```sql ... ``` block. "
                "Otherwise return the original SQL unchanged."
            ),
            expected_output="Reviewed and possibly corrected SQL in a ```sql ... ``` block",
            agent=reviewer,
            context=[write_task],
        )

        trace.append(_trace_step(
            "generate", f"CrewAI / {agent_name}",
            f"SQL Writer ({agent_name}) drafting query",
            f"Question: {question}",
            time.time() - start,
        ))

        crew = Crew(
            agents=[writer, reviewer],
            tasks=[write_task, review_task],
            verbose=False,
        )

        # CrewAI is sync — run in executor
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff)
        raw_output = str(result)

        trace.append(_trace_step(
            "generate", f"CrewAI / {agent_name}",
            f"SQL Reviewer ({agent_name}) reviewed and finalised",
            raw_output[:800],
            time.time() - start,
        ))

        sql = _extract_sql(raw_output)

        # Validate the final SQL
        if sql:
            valid, error = _validate_sql(sql, schema)
            trace.append(_trace_step(
                "validate_pass" if valid else "validate_fail",
                "DuckDB",
                "CrewAI output validated with DuckDB EXPLAIN" if valid else "CrewAI output failed validation",
                f"SQL: {sql}\n" + (f"\nError: {error}" if not valid else ""),
                time.time() - start,
            ))
            if not valid:
                sql = ""

        _add_to_history(session_id, "user", question)
        _add_to_history(session_id, "assistant", raw_output)

        return AgentResult(
            sql=sql,
            explanation=_extract_field(raw_output, "Explanation") or "Generated via CrewAI multi-agent crew.",
            intent=_extract_field(raw_output, "Intent") or question,
            tables_used=_extract_tables(sql),
            operations=_detect_operations(sql),
            trace=trace,
            attempts=1,
        )
