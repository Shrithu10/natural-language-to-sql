'use client'
import type { ChatMessage } from '@/types'
import ResultTabs from './ResultTabs'

interface Props {
  message: ChatMessage
}

export default function MessageCard({ message }: Props) {
  return (
    <div className="space-y-3">
      {/* User question */}
      <div className="flex justify-end">
        <div className="max-w-xl bg-zinc-900 text-white text-sm px-4 py-3 rounded-2xl rounded-tr-sm leading-relaxed">
          {message.question}
        </div>
      </div>

      {/* Response */}
      {message.loading ? (
        <div className="flex justify-start">
          <div className="bg-white border border-zinc-100 rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2">
            <div className="flex gap-1">
              {[0, 150, 300].map((d) => (
                <span
                  key={d}
                  className="w-1.5 h-1.5 bg-zinc-300 rounded-full animate-bounce"
                  style={{ animationDelay: `${d}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-zinc-400">Generating SQL…</span>
          </div>
        </div>
      ) : message.error ? (
        <div className="flex justify-start">
          <div className="bg-red-50 border border-red-100 rounded-2xl rounded-tl-sm px-4 py-3 max-w-lg">
            <p className="text-xs text-red-600 font-medium">Error</p>
            <p className="text-sm text-red-500 mt-0.5">{message.error}</p>
          </div>
        </div>
      ) : message.response ? (
        <div className="max-w-3xl w-full">
          <ResultTabs response={message.response} />
        </div>
      ) : null}
    </div>
  )
}
