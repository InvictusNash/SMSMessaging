import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'
import { logMessageToMonday } from '@/lib/monday'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const from = formData.get('From') as string
    const body = formData.get('Body') as string

    if (!from || !body) {
      return new NextResponse('Missing fields', { status: 400 })
    }

    const supabase = createAdminSupabase()
    const sentAt = new Date().toISOString()

    // Normalize phone to E.164
    const phone = from.trim()

    // Look up contact by phone
    const { data: contact } = await supabase
      .from('contacts')
      .select('*')
      .eq('phone', phone)
      .single()

    // If no contact found, create a placeholder
    let resolvedContact = contact
    if (!resolvedContact) {
      const { data: newContact } = await supabase
        .from('contacts')
        .insert({ name: phone, phone })
        .select()
        .single()
      resolvedContact = newContact
    }

    if (!resolvedContact) {
      return new NextResponse('Could not resolve contact', { status: 500 })
    }

    // Find or create conversation for this contact
    let { data: convo } = await supabase
      .from('conversations')
      .select('*')
      .eq('contact_id', resolvedContact.id)
      .single()

    if (!convo) {
      const { data: newConvo } = await supabase
        .from('conversations')
        .insert({ contact_id: resolvedContact.id, last_message_at: sentAt, last_message_body: body })
        .select()
        .single()
      convo = newConvo
    } else {
      await supabase
        .from('conversations')
        .update({ last_message_at: sentAt, last_message_body: body })
        .eq('id', convo.id)
    }

    if (!convo) {
      return new NextResponse('Could not resolve conversation', { status: 500 })
    }

    // Save message
    await supabase.from('messages').insert({
      conversation_id: convo.id,
      direction: 'inbound',
      body,
      sent_at: sentAt,
      sent_by: null,
      sent_by_name: null,
    })

    // Log to Monday
    if (resolvedContact.monday_item_id) {
      await logMessageToMonday({
        mondayItemId: resolvedContact.monday_item_id,
        contactName: resolvedContact.name,
        phone: resolvedContact.phone,
        direction: 'inbound',
        body,
        sentAt,
      })
    }

    // Return empty TwiML response (no auto-reply)
    return new NextResponse('<Response></Response>', {
      headers: { 'Content-Type': 'text/xml' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new NextResponse('Internal error', { status: 500 })
  }
}
