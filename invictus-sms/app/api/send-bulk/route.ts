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
    const { contactIds, body, userId, userEmail } = await req.json()

    if (!contactIds || !Array.isArray(contactIds) || !body) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    const { data: contacts, error } = await supabase
      .from('contacts')
      .select('*')
      .in('id', contactIds)

    if (error || !contacts) {
      return NextResponse.json({ error: 'Contacts not found' }, { status: 400 })
    }

    let results = {
      sent: 0,
      failed: 0,
    }

    for (const contact of contacts) {
      try {
        await twilioClient.messages.create({
          body,
          from: process.env.TWILIO_FROM_NUMBER!,
          to: contact.phone,
        })

        const sentAt = new Date().toISOString()

        await supabase.from('messages').insert({
          conversation_id: null, // optional: you can improve later
          direction: 'outbound',
          body,
          sent_at: sentAt,
          sent_by: userId ?? null,
          sent_by_name: userEmail ?? null,
        })

        if (contact.monday_item_id) {
          await logMessageToMonday({
            mondayItemId: contact.monday_item_id,
            contactName: contact.name,
            phone: contact.phone,
            direction: 'outbound',
            body,
            sentAt,
            sentByName: userEmail ?? null,
          })
        }

        results.sent++
      } catch (err) {
        console.error('Bulk send failed for', contact.phone, err)
        results.failed++
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('Bulk send error:', err)
    return NextResponse.json({ error: 'Bulk send failed' }, { status: 500 })
  }
}
