import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminSupabase } from '@/lib/supabase-server'
import { logMessageToMonday } from '@/lib/monday'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

export async function POST(req: NextRequest) {
  try {
    const { conversationId, body, userId, userEmail } = await req.json()

    if (!conversationId || !body) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createAdminSupabase()

    // Get conversation + contact
    const { data: convo, error: convoError } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', conversationId)
      .single()

    if (convoError || !convo) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      )
    }

    const contact = convo.contacts
    const toPhone = contact.phone

    if (!toPhone) {
      return NextResponse.json(
        { error: 'Contact has no phone number' },
        { status: 400 }
      )
    }

    // ✅ Send via Twilio Messaging Service
    await twilioClient.messages.create({
      body,
      to: toPhone,
      messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
    })

    const sentAt = new Date().toISOString()
    const sentByName = userEmail ?? null

    // Save message to DB
    const { error: msgError } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      direction: 'outbound',
      body,
      sent_at: sentAt,
      sent_by: userId ?? null,
      sent_by_name: sentByName,
    })

    if (msgError) throw msgError

    // Update conversation last message
    await supabase
      .from('conversations')
      .update({
        last_message_at: sentAt,
        last_message_body: body,
      })
      .eq('id', conversationId)

    // Log to Monday if contact has a monday_item_id
    if (contact.monday_item_id) {
      await logMessageToMonday({
        mondayItemId: contact.monday_item_id,
        contactName: contact.name,
        phone: contact.phone,
        direction: 'outbound',
        body,
        sentAt,
        sentByName,
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Send error:', err)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
