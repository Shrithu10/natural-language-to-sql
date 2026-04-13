"""FastAPI backend for NL-to-SQL."""
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from agents.adk_agent import ADKNLSQLAgent, DirectNLSQLAgent
from agents.langgraph_agent import LangGraphNLSQLAgent
from agents.crewai_agent import CrewAINLSQLAgent, CREWAI_AVAILABLE
from config import AVAILABLE_MODELS, MODEL_DISPLAY_NAMES, settings
from execution.sql_engine import apply_schema, clear_session, execute_sql, load_csv
from models.model_loader import detect_difficulty, get_model_string
from rag.schema_retrieval import build_index, retrieve_relevant_schema
from schemas.schema_manager import (
    ddl_to_description,
    get_schema,
    set_schema,
    table_builder_to_ddl,
)

app = FastAPI(title="NL-to-SQL API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class QueryRequest(BaseModel):
    question: str
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    model: str = "llama3"
    framework: str = "adk"          # "adk" | "langgraph" | "crewai"
    agent_enabled: bool = True
    rag_enabled: bool = False
    temperature: float = 0.1
    max_tokens: int = 1024
    execute: bool = True


class QueryResponse(BaseModel):
    sql: str
    result: dict
    explanation: str
    intent: str
    tables_used: list[str]
    operations: list[str]
    trace: list[dict]
    attempts: int
    difficulty: str
    session_id: str
    agent_name: str
    rag_tables_retrieved: list[str]
    rag_schema_used: str


class SchemaRequest(BaseModel):
    session_id: str
    ddl: str | None = None
    csv_content: str | None = None
    csv_table_name: str | None = None
    tables: list[dict] | None = None


class SchemaResponse(BaseModel):
    ddl: str
    description: str
    session_id: str


FRAMEWORKS = {
    "adk":       {"label": "ADK",       "desc": "Google Agent Development Kit — LoopAgent pattern", "available": True},
    "langgraph": {"label": "LangGraph",  "desc": "LangChain StateGraph — node-based DAG workflow",  "available": True},
    "crewai":    {"label": "CrewAI",     "desc": "Role-based multi-agent crew (Writer + Reviewer)", "available": CREWAI_AVAILABLE},
}

class ConfigResponse(BaseModel):
    available_models: list[str]
    model_display_names: dict[str, str]
    frameworks: dict
    default_model: str
    max_iterations: int
    ollama_url: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/config", response_model=ConfigResponse)
async def get_config():
    return ConfigResponse(
        available_models=list(AVAILABLE_MODELS.keys()),
        model_display_names=MODEL_DISPLAY_NAMES,
        frameworks=FRAMEWORKS,
        default_model=settings.default_model,
        max_iterations=settings.max_agent_iterations,
        ollama_url=settings.ollama_base_url,
    )


@app.get("/schema/{session_id}", response_model=SchemaResponse)
async def get_schema_endpoint(session_id: str):
    ddl = get_schema(session_id)
    return SchemaResponse(ddl=ddl, description=ddl_to_description(ddl), session_id=session_id)


@app.post("/schema", response_model=SchemaResponse)
async def set_schema_endpoint(req: SchemaRequest):
    if req.ddl:
        ddl = req.ddl
    elif req.tables:
        ddl = table_builder_to_ddl(req.tables)
    elif req.csv_content and req.csv_table_name:
        result = load_csv(req.session_id, req.csv_table_name, req.csv_content)
        if not result["ok"]:
            raise HTTPException(400, result.get("error", "CSV load failed"))
        set_schema(req.session_id, f"-- CSV table: {req.csv_table_name}")
        return SchemaResponse(
            ddl=f"-- CSV table: {req.csv_table_name}",
            description=f"Table {req.csv_table_name} loaded from CSV ({result['rows']} rows)",
            session_id=req.session_id,
        )
    else:
        raise HTTPException(400, "Provide ddl, tables, or csv_content + csv_table_name")

    set_schema(req.session_id, ddl)
    apply_schema(req.session_id, ddl)
    return SchemaResponse(ddl=ddl, description=ddl_to_description(ddl), session_id=req.session_id)


@app.post("/query", response_model=QueryResponse)
async def query(req: QueryRequest):
    schema = get_schema(req.session_id)
    apply_schema(req.session_id, schema)

    # RAG-lite: filter schema to relevant tables
    rag_tables_retrieved: list[str] = []
    if req.rag_enabled:
        effective_schema = retrieve_relevant_schema(req.question, schema)
        rag_tables_retrieved = list(build_index(effective_schema).keys())
    else:
        effective_schema = schema

    difficulty = detect_difficulty(req.question)
    model_str = get_model_string(req.model)
    model_display = MODEL_DISPLAY_NAMES.get(req.model, req.model)

    if not req.agent_enabled:
        agent = DirectNLSQLAgent(model_str=model_str, model_display=model_display)
    elif req.framework == "langgraph":
        agent = LangGraphNLSQLAgent(model_str=model_str, model_display=model_display)
    elif req.framework == "crewai":
        agent = CrewAINLSQLAgent(model_str=model_str, model_display=model_display)
    else:
        agent = ADKNLSQLAgent(model_str=model_str, model_display=model_display)

    try:
        agent_result = await agent.run(
            question=req.question,
            schema=effective_schema,
            session_id=req.session_id,
            temperature=req.temperature,
            max_tokens=req.max_tokens,
        )
    except Exception as e:
        raise HTTPException(500, f"Agent error: {e}")

    exec_result: dict = {"ok": False, "rows": [], "columns": [], "row_count": 0}
    if req.execute and agent_result.sql:
        exec_result = execute_sql(req.session_id, agent_result.sql)

    return QueryResponse(
        sql=agent_result.sql,
        result=exec_result,
        explanation=agent_result.explanation,
        intent=agent_result.intent,
        tables_used=agent_result.tables_used,
        operations=agent_result.operations,
        trace=agent_result.trace,
        attempts=agent_result.attempts,
        difficulty=difficulty,
        session_id=req.session_id,
        agent_name=model_display,
        rag_tables_retrieved=rag_tables_retrieved,
        rag_schema_used=effective_schema if req.rag_enabled else "",
    )


@app.delete("/session/{session_id}")
async def clear_session_endpoint(session_id: str):
    clear_session(session_id)
    return {"ok": True, "session_id": session_id}


@app.get("/health")
async def health():
    return {"status": "ok"}
