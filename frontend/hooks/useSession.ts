'use client'
import { useState, useCallback } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { sendQuery } from '@/lib/api'
import type { AppConfig, ChatMessage, QueryResponse } from '@/types'

export interface Chat {
  id: string          // chat UI id
  sessionId: string   // backend session id
  title: string       // derived from first question
  messages: ChatMessage[]
  createdAt: Date
}

function makeChat(): Chat {
  return {
    id: uuidv4(),
    sessionId: uuidv4(),
    title: 'New chat',
    messages: [],
    createdAt: new Date(),
  }
}

export function useSession() {
  const [chats, setChats] = useState<Chat[]>(() => [makeChat()])
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    // will be set on first render — matches first chat id
    return ''
  })

  // Resolve active chat (fallback to first)
  const activeChat = chats.find((c) => c.id === activeChatId) ?? chats[0]

  const newChat = useCallback(() => {
    const chat = makeChat()
    setChats((prev) => [chat, ...prev])
    setActiveChatId(chat.id)
  }, [])

  const switchChat = useCallback((chatId: string) => {
    setActiveChatId(chatId)
  }, [])

  const ask = useCallback(
    async (question: string, config: AppConfig): Promise<QueryResponse | null> => {
      const msgId = uuidv4()
      const chatId = activeChat.id
      const sessionId = activeChat.sessionId

      const pending: ChatMessage = {
        id: msgId,
        question,
        response: null,
        loading: true,
        error: null,
        timestamp: new Date(),
      }

      // Append message & set title from first question
      setChats((prev) =>
        prev.map((c) =>
          c.id === chatId
            ? {
                ...c,
                title: c.messages.length === 0 ? question.slice(0, 40) : c.title,
                messages: [...c.messages, pending],
              }
            : c
        )
      )

      try {
        const response = await sendQuery({
          question,
          session_id: sessionId,
          model: config.model,
          framework: config.framework,
          agent_enabled: config.agentEnabled,
          rag_enabled: config.ragEnabled,
          temperature: config.temperature,
          max_tokens: config.maxTokens,
          execute: true,
        })
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, response, loading: false } : m
                  ),
                }
              : c
          )
        )
        return response
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Unknown error'
        setChats((prev) =>
          prev.map((c) =>
            c.id === chatId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === msgId ? { ...m, error, loading: false } : m
                  ),
                }
              : c
          )
        )
        return null
      }
    },
    [activeChat]
  )

  const deleteChat = useCallback(
    (chatId: string) => {
      setChats((prev) => {
        const next = prev.filter((c) => c.id !== chatId)
        if (next.length === 0) {
          const fresh = makeChat()
          setActiveChatId(fresh.id)
          return [fresh]
        }
        if (chatId === activeChatId) {
          setActiveChatId(next[0].id)
        }
        return next
      })
    },
    [activeChatId]
  )

  return {
    chats,
    activeChat,
    activeChatId: activeChat.id,
    newChat,
    switchChat,
    deleteChat,
    ask,
  }
}
