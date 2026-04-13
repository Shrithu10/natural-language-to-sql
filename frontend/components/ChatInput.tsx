'use client'
import { useState, useRef, KeyboardEvent } from 'react'
import type { AppConfig } from '@/types'

interface Props {
  onSubmit: (question: string) => void
  loading: boolean
  config: AppConfig
}

export default function ChatInput({ onSubmit, loading, config }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const submit = () => {
    const q = value.trim()
    if (!q || loading) return
    onSubmit(q)
    setValue('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }

  return (
    <div className="px-5 pb-5 pt-2">
      <div className="max-w-3xl mx-auto">
        <div className="border border-zinc-200 rounded-2xl bg-white shadow-sm overflow-hidden focus-within:ring-1 focus-within:ring-zinc-300 transition-all">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); autoResize() }}
            onKeyDown={handleKey}
            placeholder="Ask a question about your data..."
            rows={1}
            disabled={loading}
            className="w-full px-4 pt-3.5 pb-2 text-sm text-zinc-800 placeholder-zinc-400 resize-none focus:outline-none bg-transparent leading-relaxed"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />

          <div className="flex items-center px-3 pb-2.5 gap-3">
            {/* Active config summary */}
            <div className="flex items-center gap-2 text-[10px] text-zinc-400 flex-wrap">
              <span>{config.model === 'llama3' ? 'LLaMA 3' : config.model === 'mistral' ? 'Mistral' : 'SQLCoder'}</span>
              <span className="w-px h-3 bg-zinc-200" />
              <span style={{ color: config.agentEnabled ? '#6366f1' : undefined }}>
                {config.agentEnabled ? 'Agent ON' : 'Direct'}
              </span>
              {config.ragEnabled && (
                <>
                  <span className="w-px h-3 bg-zinc-200" />
                  <span style={{ color: '#10b981' }}>RAG</span>
                </>
              )}
              <span className="w-px h-3 bg-zinc-200" />
              <span>temp {config.temperature}</span>
              <span className="w-px h-3 bg-zinc-200" />
              <span>{config.maxTokens} tokens</span>
            </div>

            <div className="flex-1" />

            {loading ? (
              <div className="flex items-center gap-1.5 pr-1">
                {[0, 150, 300].map((d) => (
                  <span
                    key={d}
                    className="inline-block w-1.5 h-1.5 bg-zinc-400 rounded-full animate-bounce"
                    style={{ animationDelay: `${d}ms` }}
                  />
                ))}
              </div>
            ) : (
              <button
                onClick={submit}
                disabled={!value.trim()}
                className="w-8 h-8 bg-zinc-900 hover:bg-zinc-700 disabled:bg-zinc-200 text-white rounded-xl flex items-center justify-center transition-colors"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-[11px] text-zinc-400 mt-2">
          Enter to send  ·  Shift+Enter for newline  ·  Settings to adjust temperature and tokens
        </p>
      </div>
    </div>
  )
}
