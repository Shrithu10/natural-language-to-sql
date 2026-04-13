export interface QueryRequest {
  question: string
  session_id: string
  model: string
  framework: string
  agent_enabled: boolean
  rag_enabled: boolean
  temperature: number
  max_tokens: number
  execute: boolean
}

export interface TraceStep {
  step_type: 'generate' | 'validate_pass' | 'validate_fail' | 'retry' | 'direct' | 'error'
  author: string       // e.g. "LLaMA 3" or "DuckDB" or "Workflow"
  summary: string      // one-liner shown always
  content: string      // detail, shown on expand
  ts: number
}

export interface QueryResponse {
  sql: string
  result: {
    ok: boolean
    columns: string[]
    rows: Record<string, unknown>[]
    row_count: number
    error?: string
  }
  explanation: string
  intent: string
  tables_used: string[]
  operations: string[]
  trace: TraceStep[]
  attempts: number
  difficulty: string
  session_id: string
  agent_name: string
  rag_tables_retrieved: string[]
  rag_schema_used: string
}

export interface ChatMessage {
  id: string
  question: string
  response: QueryResponse | null
  loading: boolean
  error: string | null
  timestamp: Date
}

export interface AppConfig {
  model: string
  framework: 'adk' | 'langgraph' | 'crewai'
  agentEnabled: boolean
  ragEnabled: boolean
  temperature: number
  maxTokens: number
}

export interface SchemaState {
  ddl: string
  description: string
}

export interface BackendConfig {
  frameworks: Record<string, { label: string; desc: string; available: boolean }>
}
