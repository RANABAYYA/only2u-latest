-- 1. Create the tables if they don't exist
CREATE TABLE IF NOT EXISTS public.special_referral_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.shubhamastu_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    is_assigned BOOLEAN DEFAULT FALSE,
    assigned_to_user_id UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Insert the Special Code into 'special_referral_codes'
INSERT INTO public.special_referral_codes (code, description, is_active)
VALUES ('SPECIAL50', 'Test Special Referral Code', true)
ON CONFLICT (code) DO NOTHING;

-- 3. CRITICAL: Insert the SAME code into the main 'referral_codes' table
-- Corrected schema based on finding in 'sql/referral_codes_complete.sql'
-- Removing 'discount_type' and 'discount_value' columns as they don't exist.
INSERT INTO public.referral_codes (code, is_active, description, created_by, max_uses)
VALUES (
    'SPECIAL50', 
    true, 
    'Special Referral Code Reward - Triggers Shubhamastu Coupon', 
    'admin', -- Assuming 'admin' or NULL is acceptable for created_by
    NULL -- Unlimited uses
)
ON CONFLICT (code) DO NOTHING;


-- 4. Seed Shubhamastu Codes
INSERT INTO public.shubhamastu_codes (code, is_assigned)
VALUES 
  ('SHUBH-TEST-001', false),
  ('SHUBH-TEST-002', false),
  ('SHUBH-TEST-003', false),
  ('SHUBH-TEST-004', false),
  ('SHUBH-TEST-005', false)
ON CONFLICT (code) DO NOTHING;
