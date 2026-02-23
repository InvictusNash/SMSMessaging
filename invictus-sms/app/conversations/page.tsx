'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Conversation } from '@/types'
import { formatDistanceToNow } from 'date-fns'
import Link from 'next/link'

export default function ConversationsPage() {
  const router = useRouter()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  const fetchConversations = useCallback(async () => {
    const { data, error } = await supabase
      .from('conversations')
      .select(`
        id,
        contact_id,
        last_message_at,
        last_message_body,
        contacts (id, name, phone, student_name, grade, monday_item_id)
      `)
      .order('last_message_at', { ascending: false })
      .limit(100)

    if (!error && data) {
      setConversations(
        data.map((row: Record<string, unknown>) => ({
          ...(row as object),
          contact: row.contacts,
        })) as unknown as Conversation[]
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchConversations()
    const interval = setInterval(fetchConversations, 10000)
    return () => clearInterval(interval)
  }, [fetchConversations])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shrink-0">
        <h1 className="text-base font-semibold text-gray-900">Invictus SMS</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign out
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {loading ? (
          <div className="p-6 text-center text-sm text-gray-400">Loading...</div>
        ) : conversations.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">No conversations yet.</div>
        ) : (
          conversations.map((convo) => (
            <Link
              key={convo.id}
              href={`/conversations/${convo.id}`}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium shrink-0 mt-0.5">
                {convo.contact?.name?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {convo.contact?.name ?? convo.contact?.phone}
                  </span>
                  <span className="text-xs text-gray-400 shrink-0">
                    {convo.last_message_at
                      ? formatDistanceToNow(new Date(convo.last_message_at), { addSuffix: true })
                      : ''}
                  </span>
                </div>
                {convo.contact?.student_name && (
                  <p className="text-xs text-gray-400 truncate">{convo.contact.student_name}</p>
                )}
                {convo.last_message_body && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{convo.last_message_body}</p>
                )}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
