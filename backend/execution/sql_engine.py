"""SQL execution engine using DuckDB (in-memory, per-session)."""
import json
from typing import Any

import duckdb


# Per-session DuckDB connections
_connections: dict[str, duckdb.DuckDBPyConnection] = {}


def get_connection(session_id: str) -> duckdb.DuckDBPyConnection:
    if session_id not in _connections:
        _connections[session_id] = duckdb.connect(":memory:")
    return _connections[session_id]


def clear_session(session_id: str) -> None:
    if session_id in _connections:
        _connections[session_id].close()
        del _connections[session_id]


def apply_schema(session_id: str, ddl: str) -> dict:
    """Execute DDL statements to create tables in the session database."""
    conn = get_connection(session_id)
    errors = []
    statements = [s.strip() for s in ddl.split(";") if s.strip()]
    for stmt in statements:
        try:
            conn.execute(stmt)
        except Exception as e:
            errors.append(str(e))
    return {"ok": len(errors) == 0, "errors": errors}


def execute_sql(session_id: str, sql: str) -> dict:
    """Execute a SELECT query and return results."""
    conn = get_connection(session_id)
    try:
        result = conn.execute(sql).fetchdf()
        columns = list(result.columns)
        rows = result.to_dict(orient="records")
        # Convert non-serializable types
        for row in rows:
            for k, v in row.items():
                if hasattr(v, "item"):
                    row[k] = v.item()
                elif v is None:
                    row[k] = None
        return {
            "ok": True,
            "columns": columns,
            "rows": rows,
            "row_count": len(rows),
        }
    except Exception as e:
        return {"ok": False, "error": str(e), "columns": [], "rows": [], "row_count": 0}


def load_csv(session_id: str, table_name: str, csv_content: str) -> dict:
    """Load CSV data into a table."""
    import io
    import pandas as pd

    conn = get_connection(session_id)
    try:
        df = pd.read_csv(io.StringIO(csv_content))
        conn.register(table_name, df)
        return {"ok": True, "rows": len(df), "columns": list(df.columns)}
    except Exception as e:
        return {"ok": False, "error": str(e)}
