'use client'
import { useState, useRef, useEffect } from 'react'
import TopBar from '@/components/TopBar'
import Sidebar from '@/components/Sidebar'
import ChatInput from '@/components/ChatInput'
import MessageCard from '@/components/MessageCard'
import SchemaPanel from '@/components/SchemaPanel'
import { useSession } from '@/hooks/useSession'
import { getConfig } from '@/lib/api'
import type { AppConfig, BackendConfig, SchemaState } from '@/types'

const DEFAULT_CONFIG: AppConfig = {
  model: 'llama3',
  framework: 'adk',
  agentEnabled: true,
  ragEnabled: false,
  temperature: 0.1,
  maxTokens: 1024,
}

const EXAMPLES = [
  'Show all employees in Engineering',
  'Average salary by department',
  'Who earns more than 80k?',
  'Top 3 highest paid employees',
]

export default function Home() {
  const { chats, activeChat, activeChatId, newChat, switchChat, deleteChat, ask } = useSession()
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG)
  const [showSchema, setShowSchema] = useState(false)
  const [schema, setSchema] = useState<SchemaState>({ ddl: '', description: '' })
  const [loading, setLoading] = useState(false)
  const [backendConfig, setBackendConfig] = useState<BackendConfig | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getConfig().then(setBackendConfig).catch(() => {})
  }, [])

  const messages = activeChat.messages

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (question: string) => {
    setLoading(true)
    await ask(question, config)
    setLoading(false)
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar config={config} onSchemaClick={() => setShowSchema(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          chats={chats}
          activeChatId={activeChatId}
          onNewChat={newChat}
          onSwitch={switchChat}
          onDelete={deleteChat}
          config={config}
          onConfigChange={setConfig}
          frameworkAvailability={backendConfig?.frameworks ?? null}
        />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center select-none">
                <div className="w-14 h-14 bg-zinc-100 rounded-2xl flex items-center justify-center mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </div>
                <h2 className="text-base font-semibold text-zinc-700 mb-1">Ask anything about your data</h2>
                <p className="text-sm text-zinc-400 max-w-xs leading-relaxed">
                  Type a question in plain English. Configure the agent in the left panel. Click <strong className="text-zinc-600">Schema</strong> to load tables.
                </p>
                <div className="flex flex-wrap gap-2 mt-6 justify-center max-w-sm">
                  {EXAMPLES.map((q) => (
                    <button
                      key={q}
                      onClick={() => handleSubmit(q)}
                      className="text-xs text-zinc-600 bg-white border border-zinc-200 rounded-xl px-3 py-1.5 hover:border-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg) => <MessageCard key={msg.id} message={msg} />)}
                <div ref={bottomRef} />
              </>
            )}
          </div>

          <ChatInput onSubmit={handleSubmit} loading={loading} config={config} />
        </main>
      </div>

      {showSchema && (
        <SchemaPanel
          sessionId={activeChat.sessionId}
          schema={schema}
          onUpdate={setSchema}
          onClose={() => setShowSchema(false)}
        />
      )}
    </div>
  )
}
