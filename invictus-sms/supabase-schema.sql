-- ============================================
-- Invictus SMS - Supabase Schema
-- Run this in: Supabase > SQL Editor > New Query
-- ============================================

-- Contacts (populated via CSV upload or Zapier)
create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,
  student_name text,
  grade text,
  monday_item_id text,
  created_at timestamptz default now()
);

-- One conversation per contact
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts(id) on delete cascade not null,
  last_message_at timestamptz default now(),
  last_message_body text,
  created_at timestamptz default now()
);

create unique index if not exists conversations_contact_id_idx on conversations(contact_id);

-- Individual messages
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  body text not null,
  sent_at timestamptz default now(),
  sent_by uuid references auth.users(id) on delete set null,
  sent_by_name text
);

create index if not exists messages_conversation_id_idx on messages(conversation_id);
create index if not exists messages_sent_at_idx on messages(sent_at);

-- Enable Row Level Security (permissive for V1 - all authenticated staff see everything)
alter table contacts enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

-- V1: any authenticated user can read/write everything
create policy "Authenticated users can read contacts" on contacts
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert contacts" on contacts
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update contacts" on contacts
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read conversations" on conversations
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert conversations" on conversations
  for insert with check (auth.role() = 'authenticated');

create policy "Authenticated users can update conversations" on conversations
  for update using (auth.role() = 'authenticated');

create policy "Authenticated users can read messages" on messages
  for select using (auth.role() = 'authenticated');

create policy "Authenticated users can insert messages" on messages
  for insert with check (auth.role() = 'authenticated');
