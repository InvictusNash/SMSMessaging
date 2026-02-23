'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useParams, useRouter } from 'next/navigation'
import { Message, Conversation } from '@/types'
import { format } from 'date-fns'
import Link from 'next/link'

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('sent_at', { ascending: true })
    if (data) setMessages(data as Message[])
  }, [id])

  const fetchConversation = useCallback(async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', id)
      .single()
    if (data) setConversation(data as unknown as Conversation)
  }, [id])

  useEffect(() => {
    fetchConversation()
    fetchMessages()
    const interval = setInterval(fetchMessages, 10000)
    return () => clearInterval(interval)
  }, [fetchConversation, fetchMessages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!body.trim() || sending) return
    setSending(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()

    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: id,
        body: body.trim(),
        userId: user?.id,
        userEmail: user?.email,
      }),
    })

    if (res.ok) {
      setBody('')
      await fetchMessages()
    } else {
      const data = await res.json()
      setError(data.error ?? 'Failed to send')
    }
    setSending(false)
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shrink-0">
        <Link href="/conversations" className="text-blue-600 text-sm hover:underline">
          ← Back
        </Link>
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {conversation?.contact?.name ?? conversation?.contact?.phone ?? '...'}
          </p>
          {conversation?.contact?.student_name && (
            <p className="text-xs text-gray-500">{conversation.contact.student_name} · {conversation.contact.grade}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.direction === 'outbound' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-3 py-2 rounded-2xl text-sm ${
                msg.direction === 'outbound'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-200 text-gray-900 rounded-bl-sm'
              }`}
            >
              {msg.body}
            </div>
            <span className="text-xs text-gray-400 mt-1 px-1">
              {format(new Date(msg.sent_at), 'MMM d, h:mm a')}
              {msg.direction === 'outbound' && msg.sent_by_name ? ` · ${msg.sent_by_name}` : ''}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Compose */}
      <div className="bg-white border-t px-4 py-3 shrink-0">
        {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 border border-gray-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={sending || !body.trim()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-full disabled:opacity-40"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}
