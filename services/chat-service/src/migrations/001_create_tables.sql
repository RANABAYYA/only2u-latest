-- PostgreSQL tables for thread metadata
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Chat threads table
CREATE TABLE IF NOT EXISTS chat_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  last_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);

CREATE INDEX IF NOT EXISTS idx_threads_user1 ON chat_threads(user1_id);
CREATE INDEX IF NOT EXISTS idx_threads_user2 ON chat_threads(user2_id);

-- Cassandra schema (run separately)
-- CREATE KEYSPACE IF NOT EXISTS chat_keyspace WITH replication = {
--   'class': 'NetworkTopologyStrategy',
--   'datacenter1': 3
-- };
--
-- USE chat_keyspace;
--
-- CREATE TABLE IF NOT EXISTS messages (
--   message_id TIMEUUID,
--   thread_id UUID,
--   sender_id UUID,
--   content TEXT,
--   created_at TIMESTAMP,
--   PRIMARY KEY (thread_id, created_at, message_id)
-- ) WITH CLUSTERING ORDER BY (created_at DESC);

