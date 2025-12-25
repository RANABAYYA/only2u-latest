-- PostgreSQL tables for preferences and tokens
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Notification preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  new_products BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User FCM tokens
CREATE TABLE IF NOT EXISTS user_tokens (
  user_id UUID PRIMARY KEY,
  fcm_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table (for preferences tracking)
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT,
  data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- Cassandra schema (run separately)
-- CREATE KEYSPACE IF NOT EXISTS notifications_keyspace WITH replication = {
--   'class': 'NetworkTopologyStrategy',
--   'datacenter1': 3
-- };
--
-- USE notifications_keyspace;
--
-- CREATE TABLE IF NOT EXISTS notifications (
--   notification_id UUID,
--   user_id UUID,
--   type TEXT,
--   title TEXT,
--   body TEXT,
--   data TEXT,
--   created_at TIMESTAMP,
--   PRIMARY KEY (user_id, created_at, notification_id)
-- ) WITH CLUSTERING ORDER BY (created_at DESC);

