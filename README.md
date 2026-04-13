# Natural Language to SQL

A full-stack application that converts plain English questions into SQL queries and executes them against your schema. Built with Next.js, FastAPI, and local LLMs via Ollama.

## Overview

Type a question in natural language, select a model and agent framework, and the system generates, validates, and executes a SQL query — returning results, an explanation, and a full agent trace.

## Features

- Natural language to SQL conversion using local LLMs (LLaMA 3, Mistral, SQLCoder)
- Three agent frameworks: ADK (generate-validate-fix loop), LangGraph (StateGraph DAG), CrewAI (Writer + Reviewer crew)
- Direct mode (single LLM call, no loop) or agent loop with automatic SQL validation and retry
- SQL execution via DuckDB with per-session isolation
- RAG-lite: keyword-based schema filtering to send only relevant tables to the model
- Dynamic schema input: paste DDL, upload CSV, or use the table builder
- Multi-turn chat with session memory per conversation
- Result visualization: table view and auto-detected bar chart for numeric data
- Difficulty detection: simple queries go direct, complex queries use the agent loop
- Full agent trace showing each step (generate, validate, retry) with timings

## Tech Stack

**Frontend**
- Next.js 16 (App Router, TypeScript)
- Tailwind CSS v4
- SVG-based chart visualization (no external charting library)

**Backend**
- FastAPI + Uvicorn
- LiteLLM for unified LLM calls
- DuckDB for SQL execution
- LangGraph for StateGraph-based agent workflow
- Google ADK (conceptual pattern, implemented via direct LiteLLM loop)
- CrewAI for multi-agent workflow (requires Python < 3.14)

**LLMs**
- Ollama (local inference)
- LLaMA 3, Mistral, SQLCoder

## Prerequisites

- Python 3.10 - 3.13 (CrewAI requires < 3.14; other frameworks work on 3.14)
- Node.js 18+
- [Ollama](https://ollama.com) running locally with at least one model pulled

```
ollama pull llama3
ollama pull mistral
ollama pull sqlcoder
```

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

The backend reads from environment variables or defaults:

| Variable | Default | Description |
|---|---|---|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `MAX_ITERATIONS` | `3` | Max agent retry attempts |

Set them in `backend/.env` or export before running.

## Project Structure

```
.
├── backend/
│   ├── agents/
│   │   ├── adk_agent.py          # ADK-style loop + Direct agent
│   │   ├── langgraph_agent.py    # LangGraph StateGraph agent
│   │   ├── crewai_agent.py       # CrewAI Writer + Reviewer crew
│   │   └── base_agent.py         # Abstract base class
│   ├── execution/
│   │   └── sql_engine.py         # DuckDB execution + per-session state
│   ├── rag/
│   │   └── schema_retrieval.py   # TF-IDF keyword schema filtering
│   ├── models/
│   │   └── model_loader.py       # Difficulty detection, model resolution
│   ├── schemas/
│   │   └── schema_manager.py     # DDL parsing, CSV ingestion, table builder
│   ├── config.py
│   ├── main.py                   # FastAPI app, routes
│   └── requirements.txt
└── frontend/
    ├── app/
    │   └── page.tsx              # Main page, session wiring
    ├── components/
    │   ├── Sidebar.tsx           # Resizable sidebar: history + settings
    │   ├── TopBar.tsx            # Header with config breadcrumb
    │   ├── ChatInput.tsx         # Query input
    │   ├── MessageCard.tsx       # Question + response card
    │   ├── ResultTabs.tsx        # SQL / Result / Chart / Explanation / Trace tabs
    │   └── SchemaPanel.tsx       # Schema input modal
    ├── hooks/
    │   └── useSession.ts         # Multi-chat session state
    ├── lib/
    │   └── api.ts                # Backend API calls
    └── types/
        └── index.ts              # Shared TypeScript types
```

## Usage

1. Start Ollama and pull a model.
2. Start the backend and frontend.
3. Click **Schema** in the top bar to load your database schema (DDL or CSV).
4. Select a model and framework in the sidebar settings.
5. Type a question and press Enter.
6. View the generated SQL, result table, chart, explanation, and agent trace in the response tabs.

## Agent Frameworks

| Framework | Mode | Description |
|---|---|---|
| ADK | Agent | Manual generate-validate-fix loop via LiteLLM |
| LangGraph | Agent | StateGraph with conditional retry edge |
| CrewAI | Agent | SQL Writer agent + SQL Reviewer agent (Python < 3.14 only) |
| Direct | No agent | Single LLM call, no validation or retry |

## License

MIT
