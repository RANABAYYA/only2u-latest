-- Enable RLS on support tables if not already enabled
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

-- SUPPORT TICKETS POLICIES
-- Users can view their own tickets
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
CREATE POLICY "Users can view own tickets"
ON support_tickets FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own tickets
DROP POLICY IF EXISTS "Users can create own tickets" ON support_tickets;
CREATE POLICY "Users can create own tickets"
ON support_tickets FOR INSERT
WITH CHECK (user_id = auth.uid());

-- SUPPORT MESSAGES POLICIES
-- Users can view messages for their own tickets
DROP POLICY IF EXISTS "Users can view messages for own tickets" ON support_messages;
CREATE POLICY "Users can view messages for own tickets"
ON support_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);

-- Users can insert messages to their own tickets
DROP POLICY IF EXISTS "Users can insert messages to own tickets" ON support_messages;
CREATE POLICY "Users can insert messages to own tickets"
ON support_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);

-- Allow AI/Admins to insert messages (assuming service role or specific handling, but for now open it up or ensure AI service uses service key if strict)
-- For AI service running with anon key but usually we might need a broader policy if the AI user is 'system'.
-- If AI uses a special user ID or just inserts as admin, we need to handle that.
-- For now, let's assume the AI service runs as a user or we use a service role client in the backend. 
-- Wait, the current implementation uses the client-side supabase instance? 
-- The aiSupportService uses `import { supabase } from '~/utils/supabase';` which is the client instance with ANON KEY.
-- This means the AI inserts will be subject to RLS.
-- The AI service inserts with `sender_id: 'AI_ASSISTANT'` and `sender_type: 'admin'`.
-- The policy above checks `EXISTS (SELECT 1 FROM support_tickets WHERE ... user_id = auth.uid())`.
-- Since the current auth user is the USER, `auth.uid()` matches the ticket owner.
-- So the USER is technically performing the insert on behalf of the AI in the current code structure (client-side generation).
-- So the policy "Users can insert messages to own tickets" should cover the AI response insert as well, 
-- AS LONG AS the `ticket_id` belongs to them.
