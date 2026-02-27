import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminSupabase } from '@/lib/supabase-server'
import { logMessageToMonday } from '@/lib/monday'

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
)

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}

function applyMergeFields(template: string, contact: any) {
  return template
    .replace(/{{\s*name\s*}}/gi, contact?.name ?? '')
    .replace(/{{\s*student_name\s*}}/gi, contact?.student_name ?? '')
    .replace(/{{\s*grade\s*}}/gi, contact?.grade ?? '')
    .replace(/{{\s*seat_url\s*}}/gi, contact?.seat_acceptance_url ?? '')
}

export async function POST(req: NextRequest) {
  try {
    const { phoneList, body, userId, userEmail } = await req.json()

    if (!phoneList || !body) {
      return NextResponse.json({ error: 'Missing phone list or body' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    const rawPhones = phoneList
      .split(/[\n,]+/)
      .map((p: string) => p.trim())
      .filter((p: string) => p.length > 0)

    let results = {
      total: rawPhones.length,
      sent: 0,
      failed: 0,
      skipped: 0,
    }

    for (const rawPhone of rawPhones) {
      const phone = normalizePhone(rawPhone)

      if (!phone) {
        results.skipped++
        continue
      }

      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('phone', phone)
          .maybeSingle()

        if (!contact?.seat_acceptance_url) {
          results.skipped++
          continue
        }

        const personalizedMessage = applyMergeFields(body, contact)

        await twilioClient.messages.create({
          body: personalizedMessage,
          from: process.env.TWILIO_FROM_NUMBER!,
          to: phone,
        })

        const sentAt = new Date().toISOString()

        if (contact) {
          // Find or create conversation
          let { data: conversation } = await supabase
            .from('conversations')
            .select('*')
            .eq('contact_id', contact.id)
            .maybeSingle()

          if (!conversation) {
            const { data: newConversation } = await supabase
              .from('conversations')
              .insert({
                contact_id: contact.id,
                last_message_at: sentAt,
                last_message_body: personalizedMessage,
              })
              .select()
              .single()

            conversation = newConversation
          }

          // Insert message tied to conversation
          await supabase.from('messages').insert({
            conversation_id: conversation.id,
            direction: 'outbound',
            body: personalizedMessage,
            sent_at: sentAt,
            sent_by: userId ?? null,
            sent_by_name: userEmail ?? null,
          })

          // Update conversation metadata
          await supabase
            .from('conversations')
            .update({
              last_message_at: sentAt,
              last_message_body: personalizedMessage,
            })
            .eq('id', conversation.id)

          if (contact.monday_item_id) {
            await logMessageToMonday({
              mondayItemId: contact.monday_item_id,
              contactName: contact.name,
              phone,
              direction: 'outbound',
              body: personalizedMessage,
              sentAt,
              sentByName: userEmail ?? null,
            })
          }
        }

        results.sent++
      } catch (err) {
        console.error('Bulk send failed for', rawPhone, err)
        results.failed++
      }
    }

    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('Bulk send error:', err)
    return NextResponse.json({ error: 'Bulk send failed' }, { status: 500 })
  }
}
