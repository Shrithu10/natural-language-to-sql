'use client'
import type { AppConfig } from '@/types'

interface Props {
  config: AppConfig
  onSchemaClick: () => void
}

const FRAMEWORK_LABELS: Record<string, string> = {
  adk: 'ADK', langgraph: 'LangGraph', crewai: 'CrewAI',
}
const MODEL_LABELS: Record<string, string> = {
  llama3: 'LLaMA 3', mistral: 'Mistral', sqlcoder: 'SQLCoder',
}

export default function TopBar({ config, onSchemaClick }: Props) {
  return (
    <header className="h-12 border-b border-zinc-100 flex items-center px-5 gap-4 shrink-0 bg-white sticky top-0 z-20">
      <span className="text-sm font-semibold tracking-tight text-zinc-900">NL→SQL</span>

      <div className="w-px h-4 bg-zinc-200" />

      {/* Active configuration breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <span className="font-medium text-zinc-600">{MODEL_LABELS[config.model] ?? config.model}</span>
        <span>via</span>
        <span
          className="font-medium px-1.5 py-0.5 rounded"
          style={{
            color: config.agentEnabled ? '#4f46e5' : '#71717a',
            background: config.agentEnabled ? '#eef2ff' : '#f4f4f5',
          }}
        >
          {config.agentEnabled ? FRAMEWORK_LABELS[config.framework] : 'Direct'}
        </span>
        {config.ragEnabled && (
          <>
            <span>+</span>
            <span className="font-medium text-emerald-600 px-1.5 py-0.5 rounded bg-emerald-50">RAG</span>
          </>
        )}
      </div>

      <div className="flex-1" />

      <button
        onClick={onSchemaClick}
        className="text-xs text-zinc-500 hover:text-zinc-900 border border-zinc-200 hover:border-zinc-400 rounded-lg px-3 py-1.5 transition-colors"
      >
        Schema
      </button>
    </header>
  )
}
