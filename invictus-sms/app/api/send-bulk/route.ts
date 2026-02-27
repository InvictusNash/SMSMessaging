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

export async function POST(req: NextRequest) {
  try {
    const { phoneList, body, userId, userEmail } = await req.json()

    if (!phoneList || !body) {
      return NextResponse.json({ error: 'Missing phone list or body' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    // Split by comma, newline, or space
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
        // Try to match contact (optional but helpful)
        const { data: contact } = await supabase
          .from('contacts')
          .select('*')
          .eq('phone', phone)
          .maybeSingle()

        await twilioClient.messages.create({
          body,
          from: process.env.TWILIO_FROM_NUMBER!,
          to: phone,
        })

        const sentAt = new Date().toISOString()

        if (contact) {
          await supabase.from('messages').insert({
            conversation_id: null,
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
              phone,
              direction: 'outbound',
              body,
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
