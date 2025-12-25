-- =====================================================
-- INFLUENCER APPLICATIONS SYSTEM
-- Complete SQL Schema for Influencer Program
-- =====================================================

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS influencer_metrics CASCADE;
DROP TABLE IF EXISTS influencer_commissions CASCADE;
DROP TABLE IF EXISTS influencer_applications CASCADE;

-- =====================================================
-- 1. INFLUENCER APPLICATIONS TABLE
-- Stores all influencer application submissions
-- =====================================================

CREATE TABLE influencer_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Applicant Information
  full_name VARCHAR(255) NOT NULL,
  instagram_url VARCHAR(500) NOT NULL,
  instagram_handle VARCHAR(100),  -- Extracted handle from URL
  
  -- User Association (if logged in)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email VARCHAR(255),
  user_phone VARCHAR(20),
  
  -- Application Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'on_hold')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Social Media Metrics (can be updated after approval)
  instagram_followers INTEGER,
  instagram_engagement_rate DECIMAL(5,2),  -- Percentage
  instagram_verified BOOLEAN DEFAULT false,
  
  -- Program Details (after approval)
  influencer_code VARCHAR(50) UNIQUE,  -- Unique referral/tracking code
  commission_rate DECIMAL(5,2) DEFAULT 10.00,  -- Percentage
  approved_at TIMESTAMPTZ,
  contract_signed BOOLEAN DEFAULT false,
  contract_signed_at TIMESTAMPTZ,
  
  -- Contact & Communication
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  preferred_contact_method VARCHAR(20) DEFAULT 'email' CHECK (preferred_contact_method IN ('email', 'phone', 'instagram', 'whatsapp')),
  
  -- Activity Tracking
  last_active_at TIMESTAMPTZ,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(12,2) DEFAULT 0.00,
  total_commission_earned DECIMAL(12,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  
  -- Admin Notes
  internal_notes TEXT,
  admin_tags VARCHAR(100)[],  -- Array of tags for categorization
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. INFLUENCER COMMISSIONS TABLE
-- Tracks individual commission earnings
-- =====================================================


CREATE TABLE influencer_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Influencer Reference
  influencer_id UUID NOT NULL REFERENCES influencer_applications(id) ON DELETE CASCADE,
  influencer_code VARCHAR(50) NOT NULL,
  
  -- Order Information
  order_id UUID NOT NULL,  -- References orders table
  customer_id UUID,  -- References customers
  
  -- Commission Details
  order_amount DECIMAL(12,2) NOT NULL,
  commission_rate DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(12,2) NOT NULL,
  
  -- Payment Status
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  payment_method VARCHAR(50),  -- bank_transfer, upi, paypal, etc.
  payment_reference VARCHAR(255),
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  order_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for common queries
  CONSTRAINT fk_influencer FOREIGN KEY (influencer_id) REFERENCES influencer_applications(id)
);

-- =====================================================
-- 3. INFLUENCER METRICS TABLE
-- Stores historical performance metrics
-- =====================================================

CREATE TABLE influencer_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Influencer Reference
  influencer_id UUID NOT NULL REFERENCES influencer_applications(id) ON DELETE CASCADE,
  
  -- Time Period
  metric_date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('daily', 'weekly', 'monthly')),
  
  -- Performance Metrics
  clicks INTEGER DEFAULT 0,
  orders INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0.00,
  commission DECIMAL(12,2) DEFAULT 0.00,
  conversion_rate DECIMAL(5,2) DEFAULT 0.00,
  
  -- Social Media Stats (updated periodically)
  instagram_followers INTEGER,
  instagram_posts INTEGER,
  instagram_engagement_rate DECIMAL(5,2),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique constraint to prevent duplicate metrics
  UNIQUE(influencer_id, metric_date, metric_type)
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Influencer Applications Indexes
CREATE INDEX idx_influencer_applications_status ON influencer_applications(status);
CREATE INDEX idx_influencer_applications_user_id ON influencer_applications(user_id);
CREATE INDEX idx_influencer_applications_instagram_handle ON influencer_applications(instagram_handle);
CREATE INDEX idx_influencer_applications_influencer_code ON influencer_applications(influencer_code);
CREATE INDEX idx_influencer_applications_created_at ON influencer_applications(created_at DESC);
CREATE INDEX idx_influencer_applications_is_active ON influencer_applications(is_active);

-- Commissions Indexes
CREATE INDEX idx_influencer_commissions_influencer_id ON influencer_commissions(influencer_id);
CREATE INDEX idx_influencer_commissions_order_id ON influencer_commissions(order_id);
CREATE INDEX idx_influencer_commissions_status ON influencer_commissions(status);
CREATE INDEX idx_influencer_commissions_order_date ON influencer_commissions(order_date DESC);

-- Metrics Indexes
CREATE INDEX idx_influencer_metrics_influencer_id ON influencer_metrics(influencer_id);
CREATE INDEX idx_influencer_metrics_date ON influencer_metrics(metric_date DESC);
CREATE INDEX idx_influencer_metrics_type ON influencer_metrics(metric_type);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_influencer_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for influencer_applications
CREATE TRIGGER trigger_update_influencer_applications_timestamp
  BEFORE UPDATE ON influencer_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_updated_at();

-- Trigger for influencer_commissions
CREATE TRIGGER trigger_update_influencer_commissions_timestamp
  BEFORE UPDATE ON influencer_commissions
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_updated_at();

-- Function to generate unique influencer code
CREATE OR REPLACE FUNCTION generate_influencer_code(applicant_name VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  code_base VARCHAR;
  random_suffix VARCHAR;
  new_code VARCHAR;
  code_exists BOOLEAN;
BEGIN
  -- Extract first 4 letters of name, uppercase
  code_base := UPPER(SUBSTRING(REGEXP_REPLACE(applicant_name, '[^a-zA-Z]', '', 'g'), 1, 4));
  
  -- If less than 4 letters, pad with 'INF'
  IF LENGTH(code_base) < 4 THEN
    code_base := code_base || SUBSTRING('INF', 1, 4 - LENGTH(code_base));
  END IF;
  
  LOOP
    -- Generate random 4-digit suffix
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_code := code_base || random_suffix;
    
    -- Check if code exists
    SELECT EXISTS(
      SELECT 1 FROM influencer_applications WHERE influencer_code = new_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically approve influencer and generate code
CREATE OR REPLACE FUNCTION approve_influencer_application(application_id UUID)
RETURNS VOID AS $$
DECLARE
  app_record RECORD;
  new_code VARCHAR;
BEGIN
  -- Get application details
  SELECT * INTO app_record FROM influencer_applications WHERE id = application_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application not found';
  END IF;
  
  -- Generate unique code
  new_code := generate_influencer_code(app_record.full_name);
  
  -- Update application
  UPDATE influencer_applications
  SET 
    status = 'approved',
    approved_at = NOW(),
    influencer_code = new_code,
    reviewed_at = NOW()
  WHERE id = application_id;
  
  -- Log approval
  RAISE NOTICE 'Influencer approved with code: %', new_code;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate total commission for an influencer
CREATE OR REPLACE FUNCTION calculate_influencer_commission(
  influencer_id_param UUID,
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(
  total_orders BIGINT,
  total_revenue DECIMAL,
  total_commission DECIMAL,
  pending_commission DECIMAL,
  paid_commission DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT as total_orders,
    COALESCE(SUM(order_amount), 0)::DECIMAL as total_revenue,
    COALESCE(SUM(commission_amount), 0)::DECIMAL as total_commission,
    COALESCE(SUM(CASE WHEN status IN ('pending', 'approved') THEN commission_amount ELSE 0 END), 0)::DECIMAL as pending_commission,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0)::DECIMAL as paid_commission
  FROM influencer_commissions
  WHERE 
    influencer_id = influencer_id_param
    AND (start_date IS NULL OR order_date >= start_date)
    AND (end_date IS NULL OR order_date <= end_date);
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Active Influencers with Performance Summary
CREATE OR REPLACE VIEW active_influencers_summary AS
SELECT 
  ia.id,
  ia.full_name,
  ia.instagram_handle,
  ia.influencer_code,
  ia.commission_rate,
  ia.instagram_followers,
  ia.approved_at,
  ia.total_orders,
  ia.total_revenue,
  ia.total_commission_earned,
  ia.last_active_at,
  COUNT(DISTINCT ic.id) as total_commission_records,
  COALESCE(SUM(ic.commission_amount) FILTER (WHERE ic.status = 'pending'), 0) as pending_commission,
  COALESCE(SUM(ic.commission_amount) FILTER (WHERE ic.status = 'paid'), 0) as paid_commission
FROM influencer_applications ia
LEFT JOIN influencer_commissions ic ON ia.id = ic.influencer_id
WHERE ia.status = 'approved' AND ia.is_active = true
GROUP BY ia.id
ORDER BY ia.total_revenue DESC;

-- View: Pending Applications
CREATE OR REPLACE VIEW pending_influencer_applications AS
SELECT 
  id,
  full_name,
  instagram_url,
  instagram_handle,
  user_email,
  created_at,
  EXTRACT(DAY FROM NOW() - created_at) as days_pending
FROM influencer_applications
WHERE status = 'pending'
ORDER BY created_at ASC;

-- =====================================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- =====================================================

-- Insert sample pending application
INSERT INTO influencer_applications (
  full_name,
  instagram_url,
  instagram_handle,
  user_email,
  status
) VALUES (
  'Sample Influencer',
  'https://instagram.com/sampleinfluencer',
  'sampleinfluencer',
  'sample@example.com',
  'pending'
);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on tables
ALTER TABLE influencer_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_metrics ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own applications
CREATE POLICY "Users can view own applications" ON influencer_applications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can view all applications
CREATE POLICY "Admins can view all applications" ON influencer_applications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Policy: Anyone can insert applications (public form)
CREATE POLICY "Anyone can insert applications" ON influencer_applications
  FOR INSERT
  WITH CHECK (true);

-- Policy: Influencers can view their own commissions
CREATE POLICY "Influencers can view own commissions" ON influencer_commissions
  FOR SELECT
  USING (
    influencer_id IN (
      SELECT id FROM influencer_applications WHERE user_id = auth.uid()
    )
  );

-- Policy: Admins can manage all commissions
CREATE POLICY "Admins can manage commissions" ON influencer_commissions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE influencer_applications IS 'Stores all influencer program applications and approved influencer details';
COMMENT ON TABLE influencer_commissions IS 'Tracks commission earnings for each influencer by order';
COMMENT ON TABLE influencer_metrics IS 'Historical performance metrics for influencers';

COMMENT ON COLUMN influencer_applications.status IS 'Application status: pending, under_review, approved, rejected, on_hold';
COMMENT ON COLUMN influencer_applications.influencer_code IS 'Unique code for tracking influencer referrals and orders';
COMMENT ON COLUMN influencer_applications.commission_rate IS 'Commission percentage for this influencer (default 10%)';

-- =====================================================
-- END OF SCHEMA
-- =====================================================

