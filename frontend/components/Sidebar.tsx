'use client'
import { useEffect, useRef, useState } from 'react'
import type { Chat } from '@/hooks/useSession'
import type { AppConfig } from '@/types'

interface Props {
  chats: Chat[]
  activeChatId: string
  onNewChat: () => void
  onSwitch: (chatId: string) => void
  onDelete: (chatId: string) => void
  config: AppConfig
  onConfigChange: (c: AppConfig) => void
  frameworkAvailability: Record<string, { available: boolean }> | null
}

const FRAMEWORKS: { id: AppConfig['framework']; label: string; desc: string }[] = [
  { id: 'adk',       label: 'ADK',       desc: 'Google ADK loop' },
  { id: 'langgraph', label: 'LangGraph',  desc: 'StateGraph DAG' },
  { id: 'crewai',    label: 'CrewAI',     desc: 'Multi-agent crew' },
]

const MODELS: { id: string; label: string; sub: string }[] = [
  { id: 'llama3',   label: 'LLaMA 3',  sub: 'Meta' },
  { id: 'mistral',  label: 'Mistral',   sub: 'Mistral AI' },
  { id: 'sqlcoder', label: 'SQLCoder',  sub: 'Defog' },
]

const MIN_W = 200
const MAX_W = 520
const DEFAULT_W = 260

export default function Sidebar({
  chats, activeChatId, onNewChat, onSwitch, onDelete, config, onConfigChange, frameworkAvailability,
}: Props) {
  const set = (patch: Partial<AppConfig>) => onConfigChange({ ...config, ...patch })
  const isFrameworkAvailable = (id: string) =>
    frameworkAvailability ? (frameworkAvailability[id]?.available ?? true) : true

  const [historyOpen, setHistoryOpen] = useState(false)

  // ── Resize ────────────────────────────────────────────────────────────────
  const [width, setWidth] = useState(DEFAULT_W)
  const resizing = useRef(false)
  const startX   = useRef(0)
  const startW   = useRef(0)

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return
      setWidth(Math.max(MIN_W, Math.min(MAX_W, startW.current + e.clientX - startX.current)))
    }
    const onUp = () => {
      if (!resizing.current) return
      resizing.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault()
    resizing.current = true
    startX.current = e.clientX
    startW.current = width
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  const tempPct  = config.temperature * 100
  const tokenPct = ((config.maxTokens - 128) / (4096 - 128)) * 100

  return (
    <aside
      className="shrink-0 border-r border-zinc-100 flex flex-col bg-white h-full relative"
      style={{ width }}
    >
      {/* Drag handle */}
      <div
        onMouseDown={startResize}
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize z-20 hover:bg-indigo-300 transition-colors"
      >
        <div className="absolute inset-y-0 -right-1 -left-1" />
      </div>

      {/* ── Top bar: New chat + History ── */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-zinc-100 shrink-0">
        <button
          onClick={onNewChat}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-dashed border-zinc-300 text-zinc-500 hover:border-zinc-700 hover:text-zinc-800 hover:bg-zinc-50 transition-all text-xs font-medium group"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className="group-hover:rotate-90 transition-transform duration-200 shrink-0">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New
        </button>

        <button
          onClick={() => setHistoryOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: historyOpen ? '#eef2ff' : 'transparent',
            color: historyOpen ? '#4f46e5' : '#52525b',
            border: `1px solid ${historyOpen ? '#a5b4fc' : '#e5e7eb'}`,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          History
          {chats.length > 0 && (
            <span
              className="text-[10px] px-1 py-0 rounded-full font-semibold"
              style={{
                background: historyOpen ? '#c7d2fe' : '#f4f4f5',
                color: historyOpen ? '#4338ca' : '#71717a',
              }}
            >
              {chats.length}
            </span>
          )}
        </button>
      </div>

      {/* ── History dropdown overlay ── */}
      {historyOpen && (
        <div className="absolute top-[53px] left-0 right-1 z-10 bg-white border border-zinc-200 border-t-0 shadow-lg rounded-b-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: 'calc(100% - 53px)' }}
        >
          <div className="overflow-y-auto flex-1 px-2 py-2">
            {chats.length === 0 && (
              <p className="text-[11px] text-zinc-400 text-center py-6">No conversations yet</p>
            )}
            {chats.map((chat) => {
              const isActive = chat.id === activeChatId
              const loading = chat.messages[chat.messages.length - 1]?.loading
              return (
                <div key={chat.id} className="relative group mb-0.5">
                  <button
                    onClick={() => { onSwitch(chat.id); setHistoryOpen(false) }}
                    className="w-full text-left px-3 py-2 rounded-xl transition-colors pr-8"
                    style={{ background: isActive ? '#eef2ff' : 'transparent' }}
                  >
                    <p className="text-xs font-medium truncate" style={{ color: isActive ? '#4f46e5' : '#52525b' }}>
                      {chat.messages.length === 0 ? 'New chat' : chat.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                      {loading
                        ? <span style={{ color: '#6366f1' }}>Thinking...</span>
                        : chat.messages.length === 0
                          ? 'Empty'
                          : `${chat.messages.length} message${chat.messages.length !== 1 ? 's' : ''}`}
                    </p>
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(chat.id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg text-zinc-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
          {/* Close strip */}
          <button
            onClick={() => setHistoryOpen(false)}
            className="flex items-center justify-center gap-1 py-2 text-[10px] text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50 transition-colors border-t border-zinc-100"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            Close
          </button>
        </div>
      )}

      {/* ── Settings — main content ── */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Framework */}
        <Section label="Framework">
          <div className="flex flex-col gap-1">
            {FRAMEWORKS.map((f) => {
              const active = config.framework === f.id
              const notAvailable = !isFrameworkAvailable(f.id)
              const disabled = !config.agentEnabled || notAvailable
              return (
                <button
                  key={f.id}
                  onClick={() => !disabled && set({ framework: f.id })}
                  disabled={disabled}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all"
                  style={{
                    background: active && !disabled ? '#eef2ff' : 'transparent',
                    border: `1px solid ${active && !disabled ? '#a5b4fc' : '#e5e7eb'}`,
                    opacity: disabled ? 0.4 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold" style={{ color: active && !disabled ? '#4f46e5' : '#3f3f46' }}>
                      {f.label}
                      {notAvailable && <span className="ml-1 text-[9px] font-normal text-zinc-400">(unavailable)</span>}
                    </p>
                    <p className="text-[10px] text-zinc-400 leading-none mt-0.5">{f.desc}</p>
                  </div>
                  {active && !disabled && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1', flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
          {!config.agentEnabled && (
            <p className="text-[10px] text-zinc-400 mt-1.5 px-0.5">Enable Agent to select a framework</p>
          )}
          {config.agentEnabled && !isFrameworkAvailable('crewai') && (
            <p className="text-[10px] text-zinc-400 mt-1.5 px-0.5">CrewAI requires Python &lt;3.14</p>
          )}
        </Section>

        {/* Model */}
        <Section label="Model">
          <div className="flex flex-col gap-1">
            {MODELS.map((m) => {
              const active = config.model === m.id
              return (
                <button
                  key={m.id}
                  onClick={() => set({ model: m.id })}
                  className="flex items-center justify-between px-2.5 py-2 rounded-lg text-left transition-all"
                  style={{
                    background: active ? '#f8fafc' : 'transparent',
                    border: `1px solid ${active ? '#cbd5e1' : '#e5e7eb'}`,
                  }}
                >
                  <div>
                    <p className="text-xs font-semibold" style={{ color: active ? '#0f172a' : '#3f3f46' }}>{m.label}</p>
                    <p className="text-[10px] text-zinc-400 leading-none mt-0.5">{m.sub}</p>
                  </div>
                  {active && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                  )}
                </button>
              )
            })}
          </div>
        </Section>

        {/* Workflow */}
        <Section label="Workflow">
          <div className="space-y-2.5">
            <ToggleRow
              label="Agent loop"
              desc={config.agentEnabled ? 'generate → validate → fix' : 'single call, no loop'}
              value={config.agentEnabled}
              onChange={(v) => set({ agentEnabled: v })}
              color="#6366f1"
            />
            <ToggleRow
              label="RAG"
              desc={config.ragEnabled ? 'schema filtered by relevance' : 'full schema sent'}
              value={config.ragEnabled}
              onChange={(v) => set({ ragEnabled: v })}
              color="#10b981"
            />
          </div>
        </Section>

        {/* Temperature */}
        <Section label="Temperature">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-zinc-400">
              {config.temperature <= 0.15 ? 'Deterministic' : config.temperature <= 0.5 ? 'Balanced' : 'Creative'}
            </p>
            <span className="text-xs font-mono font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
              {config.temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range" min={0} max={1} step={0.05}
            value={config.temperature}
            onChange={(e) => set({ temperature: parseFloat(e.target.value) })}
            className="slider w-full"
            style={{ '--pct': `${tempPct}%` } as React.CSSProperties}
          />
          <div className="flex justify-between mt-1">
            {[0, 0.25, 0.5, 0.75, 1].map((v) => (
              <button key={v} onClick={() => set({ temperature: v })}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors">{v}</button>
            ))}
          </div>
        </Section>

        {/* Max tokens */}
        <Section label="Max tokens">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-zinc-400">
              {config.maxTokens <= 512 ? 'Short' : config.maxTokens <= 1024 ? 'Standard' : 'Extended'}
            </p>
            <span className="text-xs font-mono font-semibold text-zinc-700 bg-zinc-100 px-1.5 py-0.5 rounded">
              {config.maxTokens >= 1000 ? `${(config.maxTokens / 1000).toFixed(config.maxTokens % 1000 === 0 ? 0 : 1)}k` : config.maxTokens}
            </span>
          </div>
          <input
            type="range" min={128} max={4096} step={128}
            value={config.maxTokens}
            onChange={(e) => set({ maxTokens: parseInt(e.target.value) })}
            className="slider w-full"
            style={{ '--pct': `${tokenPct}%` } as React.CSSProperties}
          />
          <div className="flex justify-between mt-1">
            {[256, 512, 1024, 2048, 4096].map((v) => (
              <button key={v} onClick={() => set({ maxTokens: v })}
                className="text-[10px] text-zinc-400 hover:text-zinc-700 transition-colors">
                {v >= 1000 ? `${v / 1000}k` : v}
              </button>
            ))}
          </div>
        </Section>

      </div>

      <style>{`
        .slider { -webkit-appearance: none; height: 4px; border-radius: 2px;
          background: linear-gradient(to right, #6366f1 var(--pct), #e5e7eb var(--pct));
          outline: none; cursor: pointer; }
        .slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px;
          border-radius: 50%; background: #6366f1; border: 2px solid white;
          box-shadow: 0 1px 4px rgba(99,102,241,0.35); cursor: pointer; }
        .slider::-moz-range-thumb { width: 16px; height: 16px; border-radius: 50%;
          background: #6366f1; border: 2px solid white;
          box-shadow: 0 1px 4px rgba(99,102,241,0.35); cursor: pointer; }
      `}</style>
    </aside>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-3 py-3 border-b border-zinc-100">
      <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  )
}

function ToggleRow({ label, desc, value, onChange, color }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void; color: string
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="min-w-0 mr-3">
        <p className="text-xs font-medium text-zinc-700">{label}</p>
        <p className="text-[10px] text-zinc-400 leading-snug">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        style={{ width: 34, height: 18, borderRadius: 9, flexShrink: 0,
          background: value ? color : '#d4d4d8', position: 'relative', transition: 'background 0.2s' }}
      >
        <div style={{ position: 'absolute', top: 2, left: value ? 18 : 2,
          width: 14, height: 14, borderRadius: '50%',
          background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
      </button>
    </div>
  )
}
