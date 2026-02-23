export type Contact = {
  id: string
  name: string
  phone: string
  student_name: string | null
  grade: string | null
  monday_item_id: string | null
}

export type Conversation = {
  id: string
  contact_id: string
  last_message_at: string
  contact: Contact
  last_message_body: string | null
}

export type Message = {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  body: string
  sent_at: string
  sent_by_name: string | null
}
