# Invictus SMS

Internal staff tool for two-way SMS with families via Twilio.

---

## Setup (do these in order)

### 1. Supabase
1. Go to https://supabase.com/dashboard/project/fbhftonmcetltcmypyoy/sql/new
2. Paste the contents of `supabase-schema.sql` and run it
3. Go to Settings → API and grab your **anon key** (starts with `eyJ...`)
4. **Rotate your service role key** (Settings → API → Regenerate) — the old one was shared in chat

### 2. Twilio
1. **Rotate your Auth Token** at https://console.twilio.com — the old one was shared in chat
2. Get your Twilio phone number from the console
3. After deploying to Vercel, set the webhook URL:
   - Twilio Console → Phone Numbers → your number → Messaging
   - Webhook: `https://YOUR_APP.vercel.app/api/webhooks/twilio`
   - Method: POST

### 3. Monday.com
1. **Rotate your API token** at https://invictus-nash.monday.com/apps/manage/tokens — the old one was shared in chat

### 4. Environment Variables
Copy `.env.local.example` to `.env.local` and fill in all values.

### 5. GitHub + Vercel
1. Create a new repo at https://github.com/new
2. Push this folder to it (instructions below)
3. Go to https://vercel.com/new → Import your GitHub repo
4. In Vercel project settings → Environment Variables, add all vars from `.env.local`
5. Deploy

### Push to GitHub (copy/paste these commands)
```bash
cd invictus-sms
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main
```

### 6. Create Staff Accounts
Go to Supabase → Authentication → Users → Invite user
Add each staff member's email. They'll receive a link to set a password.

---

## Adding Contacts

### Option A: Zapier
- Trigger: New row in Google Sheet (or wherever your contact list lives)
- Action: POST to `https://YOUR_APP.vercel.app/api/contacts`
- Body (JSON):
```json
{
  "name": "Parent Name",
  "phone": "6155551234",
  "student_name": "Student Name",
  "grade": "3rd",
  "monday_item_id": "1234567890"
}
```

### Option B: Manual (via API)
POST to `/api/contacts` with the same JSON shape. Can be an array for bulk.

---

## How It Works

- **Inbound**: Family texts your Twilio number → webhook fires → saved to DB → logged to Monday
- **Outbound**: Staff types in UI → saved to DB → sent via Twilio → logged to Monday
- **Polling**: UI refreshes every 10 seconds automatically
- **Monday**: Each message creates an update on the contact's Monday item (matched by `monday_item_id`)
