-- =====================================================
-- INFLUENCER PROFILES SYSTEM
-- Complete schema for influencer user profiles
-- =====================================================

-- Drop existing table if exists
DROP TABLE IF EXISTS influencer_posts CASCADE;
DROP TABLE IF EXISTS influencer_profiles CASCADE;

-- =====================================================
-- 1. INFLUENCER PROFILES TABLE
-- Stores influencer user profile information
-- =====================================================

CREATE TABLE influencer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User Association
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Profile Information
  name VARCHAR(255) NOT NULL,
  username VARCHAR(100) UNIQUE NOT NULL,  -- Display name/handle
  bio TEXT,
  profile_photo TEXT,
  
  -- Social Media Links
  instagram_handle VARCHAR(100),
  youtube_handle VARCHAR(100),
  tiktok_handle VARCHAR(100),
  twitter_handle VARCHAR(100),
  
  -- Contact Information
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  website_url TEXT,
  
  -- Influencer Stats
  total_followers INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  total_products_promoted INTEGER DEFAULT 0,
  
  -- Commission & Earnings
  influencer_code VARCHAR(50) UNIQUE,  -- From influencer_applications
  commission_rate DECIMAL(5,2) DEFAULT 10.00,
  total_earnings DECIMAL(12,2) DEFAULT 0.00,
  
  -- Verification & Status
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Additional Settings
  allow_messages BOOLEAN DEFAULT true,
  show_contact_info BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 2. INFLUENCER POSTS TABLE
-- Stores influencer content (videos/posts)
-- =====================================================

CREATE TABLE influencer_posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Influencer Reference
  influencer_id UUID NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  
  -- Post Content
  title VARCHAR(255),
  description TEXT,
  video_url TEXT NOT NULL,  -- Primary video URL
  thumbnail_url TEXT,
  
  -- Associated Product (Optional)
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  
  -- Engagement Stats
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  
  -- Post Metadata
  duration INTEGER,  -- Video duration in seconds
  tags VARCHAR(100)[],
  
  -- Visibility
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  
  -- Timestamps
  published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 3. ADD INFLUENCER COLUMN TO PRODUCTS TABLE
-- =====================================================

-- Add influencer_id column to products table (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'influencer_id'
  ) THEN
    ALTER TABLE products ADD COLUMN influencer_id UUID REFERENCES influencer_profiles(id) ON DELETE SET NULL;
    CREATE INDEX idx_products_influencer_id ON products(influencer_id);
  END IF;
END $$;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Influencer Profiles Indexes
CREATE INDEX idx_influencer_profiles_user_id ON influencer_profiles(user_id);
CREATE INDEX idx_influencer_profiles_username ON influencer_profiles(username);
CREATE INDEX idx_influencer_profiles_is_verified ON influencer_profiles(is_verified);
CREATE INDEX idx_influencer_profiles_is_active ON influencer_profiles(is_active);
CREATE INDEX idx_influencer_profiles_influencer_code ON influencer_profiles(influencer_code);

-- Influencer Posts Indexes
CREATE INDEX idx_influencer_posts_influencer_id ON influencer_posts(influencer_id);
CREATE INDEX idx_influencer_posts_product_id ON influencer_posts(product_id);
CREATE INDEX idx_influencer_posts_published_at ON influencer_posts(published_at DESC);
CREATE INDEX idx_influencer_posts_is_published ON influencer_posts(is_published);
CREATE INDEX idx_influencer_posts_is_featured ON influencer_posts(is_featured);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_influencer_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER trigger_update_influencer_profiles_timestamp
  BEFORE UPDATE ON influencer_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_profile_timestamp();

CREATE TRIGGER trigger_update_influencer_posts_timestamp
  BEFORE UPDATE ON influencer_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_influencer_profile_timestamp();

-- Function to increment post count when new post is added
CREATE OR REPLACE FUNCTION increment_influencer_post_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE influencer_profiles
  SET total_posts = total_posts + 1
  WHERE id = NEW.influencer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_increment_influencer_post_count
  AFTER INSERT ON influencer_posts
  FOR EACH ROW
  EXECUTE FUNCTION increment_influencer_post_count();

-- Function to decrement post count when post is deleted
CREATE OR REPLACE FUNCTION decrement_influencer_post_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE influencer_profiles
  SET total_posts = total_posts - 1
  WHERE id = OLD.influencer_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_decrement_influencer_post_count
  AFTER DELETE ON influencer_posts
  FOR EACH ROW
  EXECUTE FUNCTION decrement_influencer_post_count();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View: Active Influencers with Stats
CREATE OR REPLACE VIEW active_influencers_with_stats AS
SELECT 
  ip.id,
  ip.user_id,
  ip.name,
  ip.username,
  ip.bio,
  ip.profile_photo,
  ip.instagram_handle,
  ip.is_verified,
  ip.total_followers,
  ip.total_posts,
  ip.total_products_promoted,
  ip.total_earnings,
  COUNT(DISTINCT ipo.id) as actual_post_count,
  COUNT(DISTINCT ipo.product_id) FILTER (WHERE ipo.product_id IS NOT NULL) as products_with_content
FROM influencer_profiles ip
LEFT JOIN influencer_posts ipo ON ip.id = ipo.influencer_id AND ipo.is_published = true
WHERE ip.is_active = true
GROUP BY ip.id
ORDER BY ip.total_followers DESC;

-- View: Featured Influencers
CREATE OR REPLACE VIEW featured_influencers AS
SELECT 
  ip.*,
  COUNT(ipo.id) as featured_post_count
FROM influencer_profiles ip
LEFT JOIN influencer_posts ipo ON ip.id = ipo.influencer_id AND ipo.is_featured = true
WHERE ip.is_verified = true AND ip.is_active = true
GROUP BY ip.id
HAVING COUNT(ipo.id) > 0
ORDER BY COUNT(ipo.id) DESC;

-- =====================================================
-- 4. INFLUENCER FOLLOWS TABLE
-- Tracks follower relationships
-- =====================================================

CREATE TABLE IF NOT EXISTS influencer_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  influencer_id UUID NOT NULL REFERENCES influencer_profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, influencer_id)
);

CREATE INDEX idx_influencer_follows_follower_id ON influencer_follows(follower_id);
CREATE INDEX idx_influencer_follows_influencer_id ON influencer_follows(influencer_id);

-- =====================================================
-- 5. INFLUENCER POST LIKES TABLE
-- Tracks post likes
-- =====================================================

CREATE TABLE IF NOT EXISTS influencer_post_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES influencer_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

CREATE INDEX idx_influencer_post_likes_user_id ON influencer_post_likes(user_id);
CREATE INDEX idx_influencer_post_likes_post_id ON influencer_post_likes(post_id);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE influencer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_posts ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active influencer profiles
CREATE POLICY "Anyone can view active influencer profiles" ON influencer_profiles
  FOR SELECT
  USING (is_active = true);

-- Policy: Influencers can update their own profile
CREATE POLICY "Influencers can update own profile" ON influencer_profiles
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Policy: Admins can manage all influencer profiles
CREATE POLICY "Admins can manage influencer profiles" ON influencer_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND user_type = 'admin'
    )
  );

-- Policy: Anyone can view published posts
CREATE POLICY "Anyone can view published posts" ON influencer_posts
  FOR SELECT
  USING (is_published = true);

-- Policy: Influencers can manage their own posts
CREATE POLICY "Influencers can manage own posts" ON influencer_posts
  FOR ALL
  USING (
    influencer_id IN (
      SELECT id FROM influencer_profiles WHERE user_id = auth.uid()
    )
  );

-- Enable RLS on interaction tables
ALTER TABLE influencer_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE influencer_post_likes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view follows
CREATE POLICY "Anyone can view follows" ON influencer_follows
  FOR SELECT
  USING (true);

-- Policy: Users can manage their own follows
CREATE POLICY "Users can manage own follows" ON influencer_follows
  FOR ALL
  USING (auth.uid() = follower_id);

-- Policy: Anyone can view likes
CREATE POLICY "Anyone can view likes" ON influencer_post_likes
  FOR SELECT
  USING (true);

-- Policy: Users can manage their own likes
CREATE POLICY "Users can manage own likes" ON influencer_post_likes
  FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- SAMPLE DATA FOR TESTING
-- =====================================================

-- Insert sample influencer profile
INSERT INTO influencer_profiles (
  name,
  username,
  bio,
  instagram_handle,
  influencer_code,
  is_verified,
  total_followers
) VALUES (
  'Sample Influencer',
  'sampleinfluencer',
  'Fashion enthusiast & Only2U brand ambassador 💫',
  'sampleinfluencer',
  'SAMP1234',
  true,
  10000
);

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE influencer_profiles IS 'Stores influencer user profiles with social media links and stats';
COMMENT ON TABLE influencer_posts IS 'Stores influencer content/posts with associated products';
COMMENT ON COLUMN products.influencer_id IS 'Optional influencer who promoted this product';

-- =====================================================
-- END OF SCHEMA
-- =====================================================

