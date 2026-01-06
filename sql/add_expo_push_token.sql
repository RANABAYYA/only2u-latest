-- Add expo_push_token column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS expo_push_token TEXT;

-- Create index for faster lookups when sending notifications
CREATE INDEX IF NOT EXISTS idx_users_expo_push_token ON users(expo_push_token);

-- Update RLS policies to allow users to update their own token
-- (Existing policy "Users can update their own profile" should cover this if it uses UPDATE on users)