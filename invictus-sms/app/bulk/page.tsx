'use client'

import { useState } from 'react'

export default function BulkPage() {
  const [phoneList, setPhoneList] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleSend = async () => {
    if (!phoneList || !message) return

    setLoading(true)
    setResult(null)

    const res = await fetch('/api/send-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phoneList,
        body: message,
      }),
    })

    const data = await res.json()
    setResult(data)
    setLoading(false)
  }

  return (
    <div style={{ maxWidth: 600, margin: '40px auto' }}>
      <h1>Mass Text</h1>

      <label>Phone Numbers (comma or new line separated)</label>
      <textarea
        rows={8}
        value={phoneList}
        onChange={(e) => setPhoneList(e.target.value)}
        style={{ width: '100%', marginBottom: 20 }}
      />

      <label>Message</label>
      <textarea
        rows={4}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ width: '100%', marginBottom: 20 }}
      />

      <button onClick={handleSend} disabled={loading}>
        {loading ? 'Sending...' : 'Send Mass Text'}
      </button>

      {result && (
        <pre style={{ marginTop: 20 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
