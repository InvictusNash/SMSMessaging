import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabase } from '@/lib/supabase-server'

// POST /api/contacts
// Accepts array of contacts from Zapier webhook or CSV upload
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const contacts = Array.isArray(body) ? body : [body]

    if (contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts provided' }, { status: 400 })
    }

    const supabase = createAdminSupabase()

    const rows = contacts.map((c: Record<string, string>) => ({
      name: c.name ?? c.Name ?? '',
      phone: normalizePhone(c.phone ?? c.Phone ?? ''),
      student_name: c.student_name ?? c['Student Name'] ?? c.student ?? null,
      grade: c.grade ?? c.Grade ?? null,
      monday_item_id: c.monday_item_id ?? c['Monday Item ID'] ?? null,
    })).filter(c => c.name && c.phone)

    const { data, error } = await supabase
      .from('contacts')
      .upsert(rows, { onConflict: 'phone' })
      .select()

    if (error) throw error

    return NextResponse.json({ imported: data?.length ?? 0 })
  } catch (err) {
    console.error('Contacts import error:', err)
    return NextResponse.json({ error: 'Import failed' }, { status: 500 })
  }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}
