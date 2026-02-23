const MONDAY_API_URL = 'https://api.monday.com/v2'

interface LogMessageParams {
  mondayItemId: string
  contactName: string
  phone: string
  direction: 'inbound' | 'outbound'
  body: string
  sentAt: string
  sentByName?: string | null
}

export async function logMessageToMonday(params: LogMessageParams) {
  const { mondayItemId, contactName, phone, direction, body, sentAt, sentByName } = params

  const messageType = direction === 'inbound' ? 'Incoming' : 'Outgoing'
  const summary = body.length > 100 ? body.slice(0, 97) + '...' : body
  const dateFormatted = new Date(sentAt).toISOString().split('T')[0]

  // First get column IDs dynamically from the board
  const columnsQuery = `
    query {
      boards(ids: ${process.env.MONDAY_BOARD_ID}) {
        columns { id title type }
      }
    }
  `

  const columnsRes = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN!,
    },
    body: JSON.stringify({ query: columnsQuery }),
  })

  const columnsData = await columnsRes.json()
  const columns: { id: string; title: string }[] = columnsData?.data?.boards?.[0]?.columns ?? []

  const colId = (title: string) =>
    columns.find((c) => c.title.toLowerCase().includes(title.toLowerCase()))?.id

  const contactNameCol = colId('contact name')
  const messageTypeCol = colId('message type')
  const messageDateCol = colId('message date')
  const phoneCol = colId('phone')
  const summaryCol = colId('message content')

  // Build column values object
  const columnValues: Record<string, unknown> = {}
  if (contactNameCol) columnValues[contactNameCol] = { text: contactName }
  if (messageTypeCol) columnValues[messageTypeCol] = { label: messageType }
  if (messageDateCol) columnValues[messageDateCol] = { date: dateFormatted }
  if (phoneCol) columnValues[phoneCol] = { text: phone }
  if (summaryCol) columnValues[summaryCol] = { text: summary }

  const updateName = `${contactName} – ${new Date(sentAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${messageType}`

  const mutation = `
    mutation {
      create_item(
        board_id: ${process.env.MONDAY_BOARD_ID},
        group_id: "linked_contacts",
        item_name: ${JSON.stringify(updateName)},
        column_values: ${JSON.stringify(JSON.stringify(columnValues))}
      ) {
        id
      }
    }
  `

  // Log as update on existing item if mondayItemId provided
  const updateMutation = `
    mutation {
      create_update(
        item_id: ${mondayItemId},
        body: ${JSON.stringify(`📱 ${messageType} – ${new Date(sentAt).toLocaleString()}\n${sentByName ? `Staff: ${sentByName}\n` : ''}${body}`)}
      ) {
        id
      }
    }
  `

  const res = await fetch(MONDAY_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: process.env.MONDAY_API_TOKEN!,
    },
    body: JSON.stringify({ query: updateMutation }),
  })

  if (!res.ok) {
    console.error('Monday API error:', await res.text())
  }
}
