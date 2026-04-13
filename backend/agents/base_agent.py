from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class AgentResult:
    sql: str
    explanation: str
    intent: str
    tables_used: list[str]
    operations: list[str]
    trace: list[dict]
    attempts: int
    error: str | None = None
    rag_tables_retrieved: list[str] = field(default_factory=list)
    rag_schema_used: str = ""


class BaseNLSQLAgent(ABC):
    @abstractmethod
    async def run(
        self,
        question: str,
        schema: str,
        session_id: str,
        temperature: float,
        max_tokens: int,
    ) -> AgentResult:
        ...
