-- Complete Referral Codes System Migration
-- Description: Creates tables for managing referral codes with bulk generation and usage tracking
-- This migration integrates referral codes with the existing coupon system

-- ==============================================
-- STEP 1: Create referral_codes table
-- ==============================================

CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  max_uses INTEGER, -- NULL means unlimited uses
  usage_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by VARCHAR(255), -- admin who created the code
  metadata JSONB DEFAULT '{}'::jsonb -- for storing additional info like campaign name, etc.
);

-- ==============================================
-- STEP 2: Create referral_code_usage table
-- ==============================================

CREATE TABLE IF NOT EXISTS referral_code_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  referral_code VARCHAR(50) NOT NULL, -- denormalized for faster queries
  user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- reference to users table
  user_email VARCHAR(255),
  user_phone VARCHAR(50),
  user_name VARCHAR(255),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address VARCHAR(50),
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb -- for storing additional tracking data
);

-- ==============================================
-- STEP 3: Create indexes for better performance
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_is_active ON referral_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_referral_codes_created_at ON referral_codes(created_at);
CREATE INDEX IF NOT EXISTS idx_referral_code_usage_referral_code_id ON referral_code_usage(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_code_usage_referral_code ON referral_code_usage(referral_code);
CREATE INDEX IF NOT EXISTS idx_referral_code_usage_user_email ON referral_code_usage(user_email);
CREATE INDEX IF NOT EXISTS idx_referral_code_usage_used_at ON referral_code_usage(used_at);
CREATE INDEX IF NOT EXISTS idx_referral_code_usage_user_id ON referral_code_usage(user_id);

-- ==============================================
-- STEP 4: Create trigger function to increment usage count
-- ==============================================

CREATE OR REPLACE FUNCTION increment_referral_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE referral_codes 
  SET usage_count = usage_count + 1
  WHERE id = NEW.referral_code_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- STEP 5: Create trigger to auto-increment usage count
-- ==============================================

DROP TRIGGER IF EXISTS trigger_increment_referral_usage ON referral_code_usage;
CREATE TRIGGER trigger_increment_referral_usage
AFTER INSERT ON referral_code_usage
FOR EACH ROW
EXECUTE FUNCTION increment_referral_usage();

-- ==============================================
-- STEP 6: Create validation function
-- ==============================================

CREATE OR REPLACE FUNCTION validate_referral_code(p_code VARCHAR(50))
RETURNS TABLE (
  is_valid BOOLEAN,
  message TEXT,
  referral_code_id UUID
) AS $$
DECLARE
  v_code_record referral_codes%ROWTYPE;
BEGIN
  -- Check if code exists
  SELECT * INTO v_code_record
  FROM referral_codes
  WHERE code = p_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Referral code not found'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if code is active
  IF NOT v_code_record.is_active THEN
    RETURN QUERY SELECT false, 'Referral code is inactive'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if code has expired
  IF v_code_record.expires_at IS NOT NULL AND v_code_record.expires_at < NOW() THEN
    RETURN QUERY SELECT false, 'Referral code has expired'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check if code has reached max uses
  IF v_code_record.max_uses IS NOT NULL AND v_code_record.usage_count >= v_code_record.max_uses THEN
    RETURN QUERY SELECT false, 'Referral code usage limit reached'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Code is valid
  RETURN QUERY SELECT true, 'Referral code is valid'::TEXT, v_code_record.id;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- STEP 7: Create analytics view
-- ==============================================

CREATE OR REPLACE VIEW referral_code_analytics AS
SELECT 
  rc.id,
  rc.code,
  rc.description,
  rc.max_uses,
  rc.usage_count,
  rc.is_active,
  rc.created_at,
  rc.expires_at,
  rc.created_by,
  rc.metadata,
  COUNT(rcu.id) AS total_signups,
  COUNT(DISTINCT rcu.user_email) AS unique_users,
  MIN(rcu.used_at) AS first_use_date,
  MAX(rcu.used_at) AS last_use_date,
  CASE 
    WHEN rc.expires_at IS NOT NULL AND rc.expires_at < NOW() THEN 'Expired'
    WHEN NOT rc.is_active THEN 'Inactive'
    WHEN rc.max_uses IS NOT NULL AND rc.usage_count >= rc.max_uses THEN 'Limit Reached'
    ELSE 'Active'
  END AS status
FROM referral_codes rc
LEFT JOIN referral_code_usage rcu ON rc.id = rcu.referral_code_id
GROUP BY rc.id, rc.code, rc.description, rc.max_uses, rc.usage_count, 
         rc.is_active, rc.created_at, rc.expires_at, rc.created_by, rc.metadata;

-- ==============================================
-- STEP 8: Insert sample referral codes for testing
-- ==============================================

INSERT INTO referral_codes (code, description, max_uses, is_active, created_by) VALUES
  ('WELCOME2025', 'New Year 2025 Welcome Campaign', NULL, true, 'admin'),
  ('INFLUENCER100', 'Influencer Campaign - 100 uses', 100, true, 'admin'),
  ('FRIEND50', 'Friend Referral Program - Limited', 50, true, 'admin'),
  ('TEST10', 'Test Referral Code - 10 uses', 10, true, 'admin'),
  ('VIPACCESS', 'VIP Access Code - Unlimited', NULL, true, 'admin')
ON CONFLICT (code) DO NOTHING;

-- ==============================================
-- STEP 9: Grant permissions (adjust as needed)
-- ==============================================

-- Allow authenticated users to validate codes
GRANT EXECUTE ON FUNCTION validate_referral_code(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_referral_code(VARCHAR) TO anon;

-- Allow authenticated users to read referral codes (for validation)
GRANT SELECT ON referral_codes TO authenticated;
GRANT SELECT ON referral_codes TO anon;

-- Allow authenticated users to record usage
GRANT INSERT ON referral_code_usage TO authenticated;

-- Allow viewing analytics (admin only - adjust role as needed)
GRANT SELECT ON referral_code_analytics TO authenticated;

-- ==============================================
-- STEP 10: Verification query
-- ==============================================

SELECT 'Referral codes system created successfully!' AS status;

-- Test the validation function
SELECT * FROM validate_referral_code('WELCOME2025');

-- View sample data
SELECT * FROM referral_codes ORDER BY created_at DESC LIMIT 5;

