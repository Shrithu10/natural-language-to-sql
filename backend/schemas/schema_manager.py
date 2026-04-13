"""Schema management — stores per-session schemas and provides DDL generation."""
import re

# In-memory schema store: session_id → DDL string
_schemas: dict[str, str] = {}

DEFAULT_SCHEMA = """
CREATE TABLE employees (
    id INTEGER PRIMARY KEY,
    name TEXT,
    department TEXT,
    salary REAL,
    hire_date DATE
);

CREATE TABLE departments (
    id INTEGER PRIMARY KEY,
    name TEXT,
    budget REAL,
    manager_id INTEGER
);

INSERT INTO employees VALUES (1, 'Alice', 'Engineering', 95000, '2020-01-15');
INSERT INTO employees VALUES (2, 'Bob', 'Marketing', 72000, '2019-06-01');
INSERT INTO employees VALUES (3, 'Carol', 'Engineering', 105000, '2018-03-20');
INSERT INTO employees VALUES (4, 'Dave', 'HR', 68000, '2021-09-10');
INSERT INTO employees VALUES (5, 'Eve', 'Marketing', 78000, '2022-04-05');

INSERT INTO departments VALUES (1, 'Engineering', 500000, 3);
INSERT INTO departments VALUES (2, 'Marketing', 300000, 2);
INSERT INTO departments VALUES (3, 'HR', 150000, 4);
""".strip()


def get_schema(session_id: str) -> str:
    return _schemas.get(session_id, DEFAULT_SCHEMA)


def set_schema(session_id: str, ddl: str) -> None:
    _schemas[session_id] = ddl


def table_builder_to_ddl(tables: list[dict]) -> str:
    """Convert table builder JSON to DDL.

    tables = [
        {
            "name": "users",
            "columns": [
                {"name": "id", "type": "INTEGER", "primary_key": true},
                {"name": "email", "type": "TEXT"}
            ],
            "sample_data": [{"id": 1, "email": "a@b.com"}]
        }
    ]
    """
    ddl_parts: list[str] = []
    for table in tables:
        cols = []
        for col in table.get("columns", []):
            col_def = f"    {col['name']} {col.get('type', 'TEXT')}"
            if col.get("primary_key"):
                col_def += " PRIMARY KEY"
            if col.get("not_null"):
                col_def += " NOT NULL"
            cols.append(col_def)
        ddl = f"CREATE TABLE {table['name']} (\n" + ",\n".join(cols) + "\n);"
        ddl_parts.append(ddl)

        # Add sample data
        for row in table.get("sample_data", []):
            keys = ", ".join(row.keys())
            vals = ", ".join(
                f"'{v}'" if isinstance(v, str) else str(v) for v in row.values()
            )
            ddl_parts.append(f"INSERT INTO {table['name']} ({keys}) VALUES ({vals});")

    return "\n\n".join(ddl_parts)


def ddl_to_description(ddl: str) -> str:
    """Extract a human-readable description of the schema."""
    tables: list[str] = []
    current = None
    cols: list[str] = []

    for line in ddl.splitlines():
        line = line.strip()
        m = re.match(r"CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)", line, re.IGNORECASE)
        if m:
            if current:
                tables.append(f"- {current}({', '.join(cols)})")
            current = m.group(1)
            cols = []
        elif current and line and not line.upper().startswith(("PRIMARY", "FOREIGN", ")")):
            col_m = re.match(r"(\w+)\s+(\w+)", line.rstrip(","))
            if col_m:
                cols.append(f"{col_m.group(1)} {col_m.group(2)}")
    if current:
        tables.append(f"- {current}({', '.join(cols)})")

    return "Tables:\n" + "\n".join(tables)
