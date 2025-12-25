# Only2U Complete Application Specification

## Document Purpose
This document provides a complete specification for rebuilding the Only2U fashion e-commerce platform from scratch with clean architecture, proper system design, and production-ready code. This specification can be given to an LLM or development team to implement the entire application.

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Application Overview](#application-overview)
3. [Complete Feature List](#complete-feature-list)
4. [System Architecture](#system-architecture)
5. [Database Schema](#database-schema)
6. [API Specifications](#api-specifications)
7. [UI/UX Requirements](#uiux-requirements)
8. [Technology Stack](#technology-stack)
9. [Implementation Guidelines](#implementation-guidelines)
10. [Security Requirements](#security-requirements)
11. [Performance Requirements](#performance-requirements)
12. [Deployment Architecture](#deployment-architecture)

---

## Executive Summary

**Only2U** is an AI-powered fashion e-commerce platform that combines virtual try-on technology with social commerce. The platform allows users to visualize how clothes will look on them using face swap AI before making a purchase.

### Key Differentiators
- **AI Virtual Try-On**: Face swap technology for product visualization
- **Social Commerce**: Reseller, Influencer, and Vendor programs
- **Multi-User Roles**: Customers, Vendors, Influencers, Resellers, Admins
- **Coin-Based Rewards**: Gamified shopping experience
- **Real-time Chat**: User-to-user messaging
- **Comprehensive E-Commerce**: Full shopping cart, orders, payments, reviews

---

## Application Overview

### Platform Type
- **Mobile-First**: React Native application (iOS & Android)
- **Backend**: Microservices architecture
- **Database**: PostgreSQL, Cassandra, Redis
- **Real-time**: WebSocket for chat, push notifications

### User Roles
1. **Customer**: Browse, shop, try-on, review
2. **Vendor**: Sell products, manage inventory, view analytics
3. **Influencer**: Create campaigns, earn commissions
4. **Reseller**: Resell products with custom pricing, earn margins
5. **Admin**: Manage platform, users, products, orders

---

## Complete Feature List

### 1. Authentication & User Management

#### Authentication Methods
- **Email/Password**: Traditional email-based registration and login
- **Phone OTP**: SMS-based OTP authentication (via Sisdial API)
- **Multi-step Signup Flow**:
  1. Phone number input
  2. OTP verification
  3. Name and email collection (for new users)
  4. Password creation
  5. Profile photo upload
  6. Body measurements (size, skin tone, body width)

#### User Profile Features
- Profile photo upload and management
- Personal information (name, email, phone)
- Body measurements (size, skin tone, body width)
- Address book management
- Coin balance tracking
- Referral code generation and sharing
- Account settings and preferences
- Account deletion

#### Onboarding Flow
- Intro screens (first-time user)
- User onboarding wizard
- Profile photo upload
- Size selection
- Skin tone selection
- Body width selection
- Registration success screen

---

### 2. Product Catalog

#### Product Features
- Product listing with images/videos
- Product details page
- Product variants (size, color)
- Product search and filtering
- Category browsing
- Trending products
- Best seller products
- Featured products
- Product recommendations
- Product likes/favorites
- Product sharing

#### Product Details
- Image gallery with zoom
- Video support
- Size selection
- Color selection
- Price display (MRP, RSP, Discount)
- Stock availability
- Product description
- Specifications
- Return policy
- Vendor information

#### Product Management (Admin/Vendor)
- Product CRUD operations
- Category management
- Color management
- Size management
- Inventory management
- Product activation/deactivation
- Bulk operations

---

### 3. Shopping Cart

#### Cart Features
- Add to cart
- Update quantity
- Remove items
- Cart persistence
- Size and color selection
- Reseller pricing display
- Coupon application
- Coin discount application
- Cart total calculation
- Empty cart state

#### Cart Validation
- Size selection required
- Quantity validation (minimum 1)
- Stock availability check
- Visual feedback (jitter animation) for missing selections

---

### 4. Orders & Checkout

#### Checkout Flow
- Cart review
- Address selection/creation
- Payment method selection
- Coupon code application
- Coin discount application
- Order summary
- Payment processing (Razorpay)

#### Order Management
- Order creation
- Order history
- Order details view
- Order status tracking
- Order cancellation
- Order reviews
- Order sharing

#### Order Statuses
- Pending
- Confirmed
- Processing
- Shipped
- Delivered
- Cancelled
- Refunded

---

### 5. Payment Processing

#### Payment Features
- Razorpay integration
- Multiple payment methods (Cards, UPI, Wallets)
- Payment verification
- Refund processing
- Payment history
- Payment status tracking

#### Payment Flow
1. Create Razorpay order
2. Open payment gateway
3. User completes payment
4. Verify payment signature
5. Update order payment status
6. Send confirmation

---

### 6. Virtual Try-On (Face Swap)

#### Face Swap Features
- AI-powered face swap using PiAPI/Akool
- Virtual try-on for products
- Coin-based access (50 coins per try-on)
- Face swap result gallery
- Save favorite results
- Share face swap results
- Face swap history

#### Face Swap Flow
1. User selects product
2. Checks coin balance (minimum 50 coins)
3. Selects size (if required)
4. Consents to face swap
5. Initiates face swap API call
6. Polls for completion
7. Displays results
8. Allows saving/sharing

#### Face Swap Requirements
- User profile photo required
- Valid product image URL
- Coin balance check
- Size selection (for certain products)

---

### 7. Wishlist & Collections

#### Collection Features
- Multiple collections per user
- Default "All" collection
- Custom collection creation
- Collection privacy settings
- Collection sharing
- Add/remove products
- Collection management

#### Wishlist Features
- Quick add to wishlist
- View wishlist
- Remove from wishlist
- Share wishlist
- Move between collections

---

### 8. Reviews & Ratings

#### Review Features
- Product reviews (1-5 stars)
- Review comments
- Review images/videos
- Verified purchase badges
- Helpful votes
- Review moderation
- Review pagination
- Average rating calculation

#### Review Management
- Create review
- Edit review
- Delete review
- Report review
- Review filtering (by rating)

---

### 9. Chat & Messaging

#### Chat Features
- User-to-user messaging
- Real-time message delivery (WebSocket)
- Chat threads/conversations
- Message history
- Read receipts
- Unread count
- Friend search
- Friend management

#### Chat UI
- Chat list
- Chat thread view
- Message input
- Image sharing
- Typing indicators
- Online status

---

### 10. Notifications

#### Notification Types
- Push notifications (Firebase FCM)
- Email notifications
- In-app notifications
- Order updates
- Promotional notifications
- Product recommendations

#### Notification Features
- Notification preferences
- Notification history
- Mark as read
- Delete notifications
- Notification categories

---

### 11. Coupons & Discounts

#### Coupon Features
- Coupon code validation
- Discount calculation (percentage/fixed)
- Minimum order amount
- Usage limits
- Expiration dates
- Referral coupons
- Welcome coupons
- Reward coupons

#### Coupon Types
- Fixed discount (₹100 off)
- Percentage discount (10% off)
- Maximum discount cap
- First order coupons
- Referral reward coupons

---

### 12. Referral System

#### Referral Features
- Referral code generation
- Referral code validation
- Referral redemption
- Welcome coupon for new users
- Referrer reward coupons
- Referral analytics
- Referral sharing (WhatsApp, etc.)

#### Referral Flow
1. User generates referral code
2. Shares code with friends
3. Friend uses code during signup
4. Friend receives welcome coupon (₹100 off)
5. Referrer receives reward coupon (10% off, increasing with referrals)

---

### 13. Vendor System

#### Vendor Features
- Vendor registration
- Vendor profile management
- Product listing
- Inventory management
- Order management
- Earnings dashboard
- Sales analytics
- Vendor verification

#### Vendor Dashboard
- Total products
- Active products
- Total orders
- Pending orders
- Total earnings
- Monthly earnings
- Recent orders
- Top products

---

### 14. Influencer System

#### Influencer Features
- Influencer application
- Influencer profile
- Campaign creation
- Campaign management
- Earnings tracking
- Performance analytics
- Social media integration

#### Influencer Dashboard
- Campaigns list
- Campaign performance
- Earnings overview
- Follower analytics
- Engagement metrics

---

### 15. Reseller System

#### Reseller Features
- Reseller registration
- Product selection for reselling
- Custom pricing (with margin)
- Catalog sharing
- Order tracking
- Earnings management
- Reseller dashboard
- Tier-based commission rates

#### Reseller Tiers
- Starter: 3% commission (₹0-2,500)
- Bronze: 5% commission (₹2,500-5,000)
- Silver: 7% commission (₹5,000-7,500)
- Gold: 7.5% commission (₹7,500-10,000)
- Platinum: 10% commission (₹10,000-20,000)
- Diamond: 12% commission (₹20,000+)

#### Reseller Flow
1. User registers as reseller
2. Selects products to resell
3. Sets custom pricing (with margin)
4. Shares catalog with customers
5. Customer purchases through reseller link
6. Reseller earns margin
7. Earnings tracked and paid out

---

### 16. Coin System

#### Coin Features
- Coin balance tracking
- Coin earning opportunities:
  - Referral sharing
  - Product sharing
  - Face swap usage (costs 50 coins)
  - Order completion
- Coin usage:
  - Face swap (50 coins)
  - Discount application
- Coin history

---

### 17. Address Management

#### Address Features
- Add address
- Edit address
- Delete address
- Set default address
- Address validation
- Pincode serviceability check
- Multiple addresses support

#### Address Fields
- Full name
- Phone number
- Address line 1
- Address line 2 (optional)
- City
- State
- Pincode
- Default flag

---

### 18. Search & Discovery

#### Search Features
- Product search
- Category search
- Filter by:
  - Price range
  - Size
  - Color
  - Category
  - Rating
- Sort by:
  - Price (low to high, high to low)
  - Popularity
  - Newest
  - Rating

---

### 19. Admin Panel

#### Admin Features
- User management
- Product management
- Order management
- Category management
- Color management
- Size management
- Coupon management
- Settings management
- Support tickets
- Analytics dashboard

#### Admin Capabilities
- View all users
- Activate/deactivate users
- View all orders
- Update order status
- Manage products
- Manage categories
- Create coupons
- View analytics

---

### 20. Support & Help

#### Support Features
- Help center
- FAQ
- Contact support
- Support tickets
- Feedback submission
- Privacy policy
- Terms and conditions
- Refund policy

---

### 21. Social Features

#### Social Commerce
- Product sharing
- Collection sharing
- Referral sharing
- Social media integration
- Friend system
- Chat with friends

---

### 22. Analytics & Tracking

#### Analytics Features
- User behavior tracking
- Product performance
- Order analytics
- Revenue tracking
- Conversion funnel
- User engagement metrics

---

## System Architecture

### Microservices Architecture

The application follows a microservices architecture with 13 independent services:

#### Core Services

1. **Auth Service** (Port 3001)
   - User authentication
   - User registration
   - OTP management
   - JWT token generation
   - User profile management
   - Database: PostgreSQL (auth_db)

2. **Product Service** (Port 3002)
   - Product catalog
   - Categories, variants, sizes, colors
   - Product search and filtering
   - Trending products
   - Database: PostgreSQL (products_db)
   - Cache: Redis

3. **Order Service** (Port 3003)
   - Order creation
   - Order management
   - Order status tracking
   - Order history
   - Database: PostgreSQL (orders_db)

4. **Payment Service** (Port 3004)
   - Razorpay integration
   - Payment processing
   - Payment verification
   - Refund processing
   - Webhook handling
   - Database: PostgreSQL (payments_db)

5. **Cart Service** (Port 3005)
   - Shopping cart management
   - Add/update/remove items
   - Cart persistence
   - Primary: Redis
   - Backup: PostgreSQL (cart_db)

#### User Engagement Services

6. **Wishlist Service** (Port 3006)
   - Collections management
   - Wishlist operations
   - Collection sharing
   - Database: PostgreSQL (collections_db)

7. **Review Service** (Port 3007)
   - Product reviews
   - Ratings
   - Review management
   - Database: PostgreSQL (reviews_db)

8. **Chat Service** (Port 3008)
   - Real-time messaging
   - Chat threads
   - Message history
   - Database: Cassandra (chat_keyspace) + PostgreSQL (threads)
   - Real-time: Redis pub/sub + WebSocket

9. **Notification Service** (Port 3014)
   - Push notifications (Firebase FCM)
   - Email notifications
   - In-app notifications
   - Notification preferences
   - Database: Cassandra (notifications_keyspace) + PostgreSQL (preferences)

#### Business Services

10. **Coupon Service** (Port 3016)
    - Coupon management
    - Coupon validation
    - Discount calculation
    - Redemption tracking
    - Database: PostgreSQL (coupons_db)

11. **Referral Service** (Port 3012)
    - Referral code generation
    - Referral validation
    - Referral redemption
    - Reward management
    - Database: PostgreSQL (referrals_db)

12. **Storage Service** (Port 3017)
    - File upload/download
    - Image optimization
    - S3/local storage
    - File metadata
    - Database: PostgreSQL (storage_db)

13. **Feedback Service** (Port 3015)
    - User feedback
    - Feedback management
    - Admin review
    - Database: PostgreSQL (feedback_db)

### Infrastructure Components

#### API Gateway
- **Technology**: Kong or NGINX
- **Functions**:
  - Request routing
  - Authentication/Authorization
  - Rate limiting
  - Load balancing
  - SSL termination

#### Service Discovery
- **Technology**: Kubernetes DNS or Consul
- **Purpose**: Automatic service registration and discovery

#### Message Queue
- **Technology**: RabbitMQ
- **Use Cases**:
  - Order processing
  - Notification delivery
  - Email sending
  - Event streaming

#### Caching Layer
- **Technology**: Redis
- **Use Cases**:
  - Product catalog caching
  - User sessions
  - Cart data
  - API response caching
  - Rate limiting

#### Monitoring & Observability
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger
- **APM**: New Relic or Datadog

---

## Database Schema

### PostgreSQL Schemas

#### 1. Auth Database (auth_db)

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(50) DEFAULT 'customer' CHECK (role IN ('customer', 'admin', 'vendor', 'influencer', 'reseller', 'driver')),
  location TEXT,
  profile_photo TEXT,
  size VARCHAR(10),
  skin_tone VARCHAR(50),
  body_width VARCHAR(50),
  coin_balance INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User addresses
CREATE TABLE user_addresses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  address_line1 VARCHAR(255) NOT NULL,
  address_line2 VARCHAR(255),
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) NOT NULL,
  pincode VARCHAR(10) NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User tokens (FCM)
CREATE TABLE user_tokens (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  fcm_token TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 2. Products Database (products_db)

```sql
-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  image_url TEXT,
  parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Colors
CREATE TABLE colors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  hex_code VARCHAR(7),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sizes
CREATE TABLE sizes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  slug VARCHAR(255) UNIQUE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  base_price DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  featured_type VARCHAR(50), -- 'trending', 'featured', 'new', 'best_seller'
  like_count INTEGER DEFAULT 0,
  return_policy TEXT,
  vendor_name VARCHAR(255),
  alias_vendor VARCHAR(255),
  tags TEXT[],
  meta_title VARCHAR(255),
  meta_description TEXT,
  stock_quantity INTEGER DEFAULT 0,
  weight DECIMAL(8,2),
  dimensions JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Product variants
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color_id UUID REFERENCES colors(id) ON DELETE SET NULL,
  size_id UUID REFERENCES sizes(id) ON DELETE SET NULL,
  sku VARCHAR(255) UNIQUE,
  barcode VARCHAR(255),
  price DECIMAL(10,2) NOT NULL,
  mrp_price DECIMAL(10,2),
  rsp_price DECIMAL(10,2),
  cost_price DECIMAL(10,2),
  discount_percentage INTEGER DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  weight DECIMAL(8,2),
  image_urls TEXT[] DEFAULT '{}',
  video_urls TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, color_id, size_id)
);

-- Product likes
CREATE TABLE product_likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
```

#### 3. Orders Database (orders_db)

```sql
-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  order_number VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded')),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial')),
  payment_method VARCHAR(50),
  payment_id VARCHAR(255),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  coin_discount_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  shipping_address JSONB,
  billing_address JSONB,
  tracking_number VARCHAR(255),
  shipped_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID,
  variant_id UUID,
  product_name VARCHAR(255) NOT NULL,
  product_sku VARCHAR(100),
  product_image TEXT,
  size VARCHAR(20),
  color VARCHAR(50),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  is_reseller BOOLEAN DEFAULT false,
  reseller_price DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Payments Database (payments_db)

```sql
-- Payments
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'INR',
  payment_method VARCHAR(50),
  payment_gateway VARCHAR(50) DEFAULT 'razorpay',
  payment_id VARCHAR(255),
  payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded', 'partial')),
  razorpay_order_id VARCHAR(255),
  refund_id VARCHAR(255),
  refund_amount DECIMAL(10,2),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Refunds
CREATE TABLE refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id VARCHAR(255) NOT NULL,
  order_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  refund_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 5. Collections Database (collections_db)

```sql
-- Collections
CREATE TABLE collections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Collection products
CREATE TABLE collection_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(collection_id, product_id)
);
```

#### 6. Reviews Database (reviews_db)

```sql
-- Product reviews
CREATE TABLE product_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL,
  user_id UUID,
  reviewer_name VARCHAR(255) NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_verified BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);
```

#### 7. Coupons Database (coupons_db)

```sql
-- Coupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  max_discount_amount DECIMAL(10,2),
  minimum_order_amount DECIMAL(10,2),
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  allow_multiple_use BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coupon redemptions
CREATE TABLE coupon_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  order_id UUID NOT NULL,
  discount_amount DECIMAL(10,2) NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 8. Referrals Database (referrals_db)

```sql
-- Referral codes
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE,
  code VARCHAR(50) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Referral redemptions
CREATE TABLE referral_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  referrer_id UUID NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(referral_code_id, user_id)
);
```

#### 9. Storage Database (storage_db)

```sql
-- File metadata
CREATE TABLE file_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  file_name VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  folder VARCHAR(100) DEFAULT 'uploads',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 10. Feedback Database (feedback_db)

```sql
-- Feedback
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_email VARCHAR(255),
  user_name VARCHAR(255) NOT NULL,
  feedback_text TEXT NOT NULL,
  image_urls TEXT[],
  category VARCHAR(50) DEFAULT 'general',
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'closed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 11. Chat Database (chat_db - PostgreSQL for threads)

```sql
-- Chat threads
CREATE TABLE chat_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  last_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user1_id, user2_id)
);
```

#### 12. Notifications Database (notifications_db - PostgreSQL for preferences)

```sql
-- Notification preferences
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY,
  push_enabled BOOLEAN DEFAULT true,
  email_enabled BOOLEAN DEFAULT true,
  order_updates BOOLEAN DEFAULT true,
  promotions BOOLEAN DEFAULT true,
  new_products BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Cassandra Schemas

#### Chat Keyspace (chat_keyspace)

```cql
CREATE KEYSPACE chat_keyspace WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3
};

USE chat_keyspace;

CREATE TABLE messages (
  message_id TIMEUUID,
  thread_id UUID,
  sender_id UUID,
  content TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (thread_id, created_at, message_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND default_time_to_live = 2592000; -- 30 days TTL
```

#### Notifications Keyspace (notifications_keyspace)

```cql
CREATE KEYSPACE notifications_keyspace WITH replication = {
  'class': 'NetworkTopologyStrategy',
  'datacenter1': 3
};

USE notifications_keyspace;

CREATE TABLE notifications (
  notification_id UUID,
  user_id UUID,
  type TEXT,
  title TEXT,
  body TEXT,
  data TEXT,
  created_at TIMESTAMP,
  PRIMARY KEY (user_id, created_at, notification_id)
) WITH CLUSTERING ORDER BY (created_at DESC)
  AND default_time_to_live = 7776000; -- 90 days TTL
```

### Additional Tables (Vendor, Influencer, Reseller)

#### Vendor Tables (vendors_db)

```sql
-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  business_name VARCHAR(255) NOT NULL,
  description TEXT,
  profile_image_url TEXT,
  cover_image_url TEXT,
  website_url TEXT,
  instagram_handle VARCHAR(100),
  tiktok_handle VARCHAR(100),
  location TEXT,
  is_verified BOOLEAN DEFAULT false,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  product_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vendor products
CREATE TABLE vendor_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Influencer Tables (influencers_db)

```sql
-- Influencers
CREATE TABLE influencers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  profile_name VARCHAR(255) NOT NULL,
  bio TEXT,
  profile_image_url TEXT,
  cover_image_url TEXT,
  instagram_handle VARCHAR(100),
  tiktok_handle VARCHAR(100),
  youtube_handle VARCHAR(100),
  follower_count INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Influencer campaigns
CREATE TABLE influencer_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  influencer_id UUID NOT NULL REFERENCES influencers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  campaign_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Reseller Tables (resellers_db)

```sql
-- Resellers
CREATE TABLE resellers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  business_name VARCHAR(255),
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  bank_account_number VARCHAR(50),
  bank_ifsc VARCHAR(20),
  account_holder_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  tier VARCHAR(20) DEFAULT 'starter',
  total_sales DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller products
CREATE TABLE reseller_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  variant_id UUID,
  reseller_price DECIMAL(10,2) NOT NULL,
  margin_percentage DECIMAL(5,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(reseller_id, product_id, variant_id)
);

-- Reseller orders
CREATE TABLE reseller_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  variant_id UUID,
  quantity INTEGER NOT NULL,
  base_unit_price DECIMAL(10,2) NOT NULL,
  reseller_unit_price DECIMAL(10,2) NOT NULL,
  base_total DECIMAL(10,2) NOT NULL,
  reseller_total DECIMAL(10,2) NOT NULL,
  margin_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reseller earnings
CREATE TABLE reseller_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reseller_id UUID NOT NULL REFERENCES resellers(id),
  order_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Face Swap Tables (tryon_db)

```sql
-- Face swap tasks
CREATE TABLE face_swap_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  user_image_url TEXT NOT NULL,
  product_image_url TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_image_url TEXT,
  result_images TEXT[],
  error_message TEXT,
  processing_time INTEGER,
  api_task_id VARCHAR(255),
  api_type VARCHAR(20) DEFAULT 'piapi', -- 'piapi' or 'akool'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User face swap results
CREATE TABLE user_face_swap_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL,
  result_images TEXT[] NOT NULL,
  is_favorite BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);
```

---

## API Specifications

### API Gateway Base URL
```
https://api.only2u.com/v1
```

### Authentication
All protected endpoints require Bearer token:
```
Authorization: Bearer <access-token>
```

### Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Error Response:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

---

### Auth Service APIs

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123",
  "phone": "+919876543210" // Optional
}
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Send OTP
```http
POST /api/auth/otp/send
Content-Type: application/json

{
  "phone": "9876543210",
  "countryCode": "+91"
}
```

#### Verify OTP
```http
POST /api/auth/otp/verify
Content-Type: application/json

{
  "phone": "9876543210",
  "countryCode": "+91",
  "otp": "123456",
  "otpId": "optional-otp-id"
}
```

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "refresh-token"
}
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <token>
```

---

### Product Service APIs

#### List Products
```http
GET /api/products?page=1&limit=20&category_id=xxx&featured_type=trending&search=shirt&min_price=100&max_price=5000
```

#### Get Product Details
```http
GET /api/products/:id
```

#### Get Trending Products
```http
GET /api/products/trending?limit=10
```

#### Search Products
```http
GET /api/products/search?q=shirt&limit=20
```

#### Get Categories
```http
GET /api/products/categories
```

#### Create Product (Admin/Vendor)
```http
POST /api/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Product Name",
  "description": "Product description",
  "category_id": "uuid",
  "base_price": 999.00,
  "image_urls": ["url1", "url2"],
  "video_urls": ["url1"],
  "tags": ["tag1", "tag2"]
}
```

---

### Order Service APIs

#### Create Order
```http
POST /api/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "subtotal": 1000.00,
  "tax_amount": 180.00,
  "shipping_amount": 50.00,
  "discount_amount": 100.00,
  "total_amount": 1130.00,
  "shipping_address": {
    "full_name": "John Doe",
    "phone": "+919876543210",
    "address_line1": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "India"
  },
  "items": [
    {
      "product_id": "uuid",
      "variant_id": "uuid",
      "product_name": "Product Name",
      "quantity": 2,
      "unit_price": 500.00,
      "total_price": 1000.00,
      "size": "L",
      "color": "Red"
    }
  ]
}
```

#### Get User Orders
```http
GET /api/orders/user/:userId?page=1&limit=20
Authorization: Bearer <token>
```

#### Get Order Details
```http
GET /api/orders/:id
Authorization: Bearer <token>
```

#### Update Order Status
```http
PUT /api/orders/:id/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "shipped",
  "tracking_number": "TRACK123456"
}
```

---

### Payment Service APIs

#### Create Razorpay Order
```http
POST /api/payments/create-order
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1130.00,
  "currency": "INR",
  "receipt": "receipt_123"
}
```

#### Verify Payment
```http
POST /api/payments/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

#### Process Refund
```http
POST /api/payments/refund
Authorization: Bearer <token>
Content-Type: application/json

{
  "payment_id": "pay_xxx",
  "order_id": "uuid",
  "amount": 500.00,
  "reason": "Customer request"
}
```

---

### Cart Service APIs

#### Get Cart
```http
GET /api/cart/:userId
Authorization: Bearer <token>
```

#### Add Item to Cart
```http
POST /api/cart/:userId/items
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "variant_id": "uuid",
  "product_name": "Product Name",
  "product_image": "url",
  "size": "L",
  "color": "Red",
  "price": 500.00,
  "quantity": 1
}
```

#### Update Cart Item
```http
PUT /api/cart/:userId/items/:itemId
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 2
}
```

#### Remove Item from Cart
```http
DELETE /api/cart/:userId/items/:itemId
Authorization: Bearer <token>
```

#### Clear Cart
```http
DELETE /api/cart/:userId
Authorization: Bearer <token>
```

---

### Wishlist Service APIs

#### Get User Collections
```http
GET /api/collections/user/:userId
Authorization: Bearer <token>
```

#### Create Collection
```http
POST /api/collections
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "name": "My Wishlist",
  "description": "Items I want to buy",
  "is_private": true
}
```

#### Add Product to Collection
```http
POST /api/collections/:id/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "product_id": "uuid"
}
```

#### Get Collection Products
```http
GET /api/collections/:id/products?userId=uuid
Authorization: Bearer <token>
```

---

### Review Service APIs

#### Get Product Reviews
```http
GET /api/reviews/product/:productId?page=1&limit=20
```

#### Create Review
```http
POST /api/reviews
Authorization: Bearer <token>
Content-Type: application/json

{
  "product_id": "uuid",
  "user_id": "uuid",
  "reviewer_name": "John Doe",
  "rating": 5,
  "comment": "Great product!",
  "profile_image_url": "url"
}
```

#### Update Review
```http
PUT /api/reviews/:id
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "rating": 4,
  "comment": "Updated review"
}
```

---

### Chat Service APIs

#### Get User Threads
```http
GET /api/chat/user/:userId/threads
Authorization: Bearer <token>
```

#### Get or Create Thread
```http
POST /api/chat/threads
Authorization: Bearer <token>
Content-Type: application/json

{
  "user1_id": "uuid",
  "user2_id": "uuid"
}
```

#### Send Message
```http
POST /api/chat/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "thread_id": "uuid",
  "sender_id": "uuid",
  "content": "Hello!"
}
```

#### Get Thread Messages
```http
GET /api/chat/threads/:threadId/messages?limit=50
Authorization: Bearer <token>
```

#### Mark as Read
```http
POST /api/chat/threads/:threadId/read
Authorization: Bearer <token>
Content-Type: application/json

{
  "userId": "uuid"
}
```

#### WebSocket Events
- `join_thread` - Join a chat thread
- `send_message` - Send a message
- `new_message` - Receive new message
- `typing` - Typing indicator

---

### Notification Service APIs

#### Create Notification
```http
POST /api/notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "type": "push",
  "title": "Order Confirmed",
  "body": "Your order #12345 has been confirmed",
  "data": {
    "order_id": "uuid",
    "type": "order_update"
  }
}
```

#### Get User Notifications
```http
GET /api/notifications/user/:userId?limit=50
Authorization: Bearer <token>
```

#### Register FCM Token
```http
POST /api/notifications/register-token
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "fcm_token": "firebase-token"
}
```

#### Get Notification Preferences
```http
GET /api/notifications/user/:userId/preferences
Authorization: Bearer <token>
```

#### Update Preferences
```http
PUT /api/notifications/user/:userId/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "push_enabled": true,
  "email_enabled": true,
  "order_updates": true,
  "promotions": false
}
```

---

### Coupon Service APIs

#### Get Available Coupons
```http
GET /api/coupons?userId=uuid
```

#### Get Coupon by Code
```http
GET /api/coupons/code/:code
```

#### Validate Coupon
```http
POST /api/coupons/validate
Content-Type: application/json

{
  "code": "WELCOME100",
  "user_id": "uuid",
  "order_amount": 1000.00
}
```

#### Redeem Coupon
```http
POST /api/coupons/redeem
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "coupon_id": "uuid",
  "order_id": "uuid",
  "discount_amount": 100.00
}
```

---

### Referral Service APIs

#### Generate Referral Code
```http
GET /api/referrals/user/:userId/generate
Authorization: Bearer <token>
```

#### Validate Referral Code
```http
GET /api/referrals/validate/:code
```

#### Redeem Referral Code
```http
POST /api/referrals/redeem
Content-Type: application/json

{
  "code": "REF123456",
  "user_id": "uuid"
}
```

#### Get Referral Stats
```http
GET /api/referrals/user/:userId/stats
Authorization: Bearer <token>
```

---

### Storage Service APIs

#### Upload File
```http
POST /api/storage/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <file>
user_id: uuid
folder: product-images
```

#### Get File Metadata
```http
GET /api/storage/:id
Authorization: Bearer <token>
```

#### Get User Files
```http
GET /api/storage/user/:userId?folder=product-images
Authorization: Bearer <token>
```

#### Delete File
```http
DELETE /api/storage/:id?userId=uuid
Authorization: Bearer <token>
```

---

### Feedback Service APIs

#### Submit Feedback
```http
POST /api/feedback
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "uuid",
  "user_email": "user@example.com",
  "user_name": "John Doe",
  "feedback_text": "Great app!",
  "image_urls": ["url1", "url2"],
  "category": "general"
}
```

#### Get User Feedback
```http
GET /api/feedback/user/:userId
Authorization: Bearer <token>
```

#### Get All Feedback (Admin)
```http
GET /api/feedback/admin?page=1&limit=20&status=pending&category=general
Authorization: Bearer <admin-token>
```

#### Update Feedback Status
```http
PUT /api/feedback/:id/status
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "status": "reviewed"
}
```

---

## UI/UX Requirements

### Design System

#### Color Palette
- **Primary Pink**: `#F53F7A`
- **Secondary Pink**: `#FF6EA6`
- **Dark Pink**: `#E91E63`
- **Background**: `#F9FAFB`
- **Text Primary**: `#1f1f1f`
- **Text Secondary**: `#6B7280`
- **Border**: `#E5E7EB`
- **Success**: `#10B981`
- **Error**: `#EF4444`
- **Warning**: `#F59E0B`

#### Typography
- **Heading 1**: 28px, Bold
- **Heading 2**: 24px, Bold
- **Heading 3**: 20px, SemiBold
- **Body**: 16px, Regular
- **Caption**: 14px, Regular
- **Small**: 12px, Regular

#### Spacing
- **XS**: 4px
- **S**: 8px
- **M**: 16px
- **L**: 24px
- **XL**: 32px
- **XXL**: 48px

#### Components
- Buttons (Primary, Secondary, Outline)
- Input Fields (Text, Search, Number)
- Cards (Product, Order, Collection)
- Modals (Bottom Sheet, Full Screen)
- Loading States (Skeleton, Spinner)
- Empty States
- Error States

---

### Screen Specifications

#### 1. Intro Screens
- **Purpose**: First-time user onboarding
- **Screens**: 3-5 slides
- **Content**: App features, benefits, virtual try-on demo
- **Actions**: Skip, Next, Get Started

#### 2. Authentication Flow
- **Phone Input Screen**:
  - Country code selector
  - Phone number input
  - Continue button
  - Terms & Privacy links

- **OTP Verification Screen**:
  - 6-digit OTP input
  - Resend OTP (60s cooldown)
  - Timer display
  - Verify button

- **Signup Details Screen** (New Users):
  - Name input
  - Email input
  - Create password
  - Confirm password
  - Continue button

- **Login Password Screen** (Existing Users):
  - Email/Phone display
  - Password input
  - Forgot password link
  - Login button

#### 3. Onboarding Flow
- **Profile Photo Upload**:
  - Camera/Gallery selection
  - Image crop/rotate
  - Preview
  - Skip option

- **Size Selection**:
  - Size options (XS, S, M, L, XL, XXL)
  - Visual size guide
  - Continue button

- **Skin Tone Selection**:
  - Skin tone options with images
  - Continue button

- **Body Width Selection**:
  - Body width options
  - Continue button

- **Registration Success**:
  - Success animation
  - Welcome message
  - Get Started button

#### 4. Dashboard (Home)
- **Header**:
  - Logo
  - Search bar (expandable)
  - Cart icon with badge
  - Notification icon with badge
  - Profile icon

- **Sections**:
  - Hero banner/Carousel
  - Categories grid
  - Trending products
  - Best seller products
  - Category-wise products
  - Featured collections

- **Features**:
  - Pull to refresh
  - Infinite scroll
  - Product quick view
  - Add to cart from card
  - Swipe to like

#### 5. Product Details
- **Image Gallery**:
  - Swipeable images
  - Image zoom
  - Video support
  - Image indicators

- **Product Info**:
  - Product name
  - Price (MRP, RSP, Discount)
  - Rating and reviews count
  - Description
  - Specifications
  - Return policy
  - Vendor info

- **Variants**:
  - Size selection (required)
  - Color selection (optional)
  - Stock availability
  - Variant-specific images

- **Actions**:
  - Add to Cart button
  - Buy Now button
  - Like/Unlike button
  - Share button
  - Virtual Try-On button (if profile photo exists)

- **Sections**:
  - Reviews section
  - Similar products
  - Recently viewed

- **Bottom Sheet**:
  - Size selection modal
  - Quantity selector
  - Add to cart confirmation

#### 6. Cart Screen
- **Cart Items**:
  - Product image
  - Product name
  - Size and color badges
  - Price (with reseller price if applicable)
  - Quantity selector
  - Remove button
  - Item total

- **Summary**:
  - Subtotal
  - Shipping
  - Discount (coupon)
  - Coin discount
  - Total

- **Actions**:
  - Apply coupon
  - Apply coins
  - Proceed to checkout

- **Empty State**:
  - Empty cart illustration
  - "Start Shopping" button

#### 7. Checkout Screen
- **Address Selection**:
  - Address cards
  - Add new address button
  - Edit address

- **Order Summary**:
  - Items list
  - Pricing breakdown
  - Coupon applied
  - Coin discount

- **Payment Method**:
  - Online payment (Razorpay)
  - Cash on delivery (if available)

- **Place Order Button**:
  - Total amount display
  - Place order action

#### 8. Orders Screen
- **Order List**:
  - Order card with:
    - Order number
    - Order date
    - Status badge
    - Product images
    - Total amount
    - Track order button
    - View details button

- **Filters**:
  - All orders
  - Pending
  - Confirmed
  - Shipped
  - Delivered
  - Cancelled

- **Order Details**:
  - Order information
  - Shipping address
  - Items list
  - Payment information
  - Tracking information
  - Cancel order (if applicable)
  - Review products

#### 9. Profile Screen
- **Profile Header**:
  - Profile photo
  - Name
  - Email/Phone
  - Edit profile button

- **Quick Stats**:
  - Orders count
  - Wishlist count
  - Coins balance

- **Menu Items**:
  - My Orders
  - Wishlist
  - Addresses
  - Body Measurements
  - Referral Code
  - Coins
  - Coupons
  - Chat/Messages
  - Notifications
  - Help Center
  - Feedback
  - Settings
  - Become Seller
  - Join Influencer
  - Reseller Dashboard (if reseller)
  - Vendor Dashboard (if vendor)
  - Admin Panel (if admin)
  - Logout

#### 10. Wishlist Screen
- **Collections List**:
  - Default "All" collection
  - Custom collections
  - Create collection button

- **Collection View**:
  - Collection name
  - Product count
  - Share button
  - Products grid
  - Empty state

#### 11. Chat Screen
- **Chat List**:
  - Thread cards with:
    - Friend avatar
    - Friend name
    - Last message preview
    - Timestamp
    - Unread badge

- **Chat Thread**:
  - Message bubbles
  - Timestamps
  - Read receipts
  - Message input
  - Send button
  - Image attachment

#### 12. Virtual Try-On Screen
- **Image Selection**:
  - User photo (from profile)
  - Product image selection
  - Size selection (if required)

- **Consent Modal**:
  - Face swap consent
  - Terms acceptance
  - Coin cost display (50 coins)

- **Processing**:
  - Loading animation
  - Progress indicator
  - Estimated time

- **Results**:
  - Result images gallery
  - Save to favorites
  - Share results
  - Try another product

#### 13. Vendor Dashboard
- **Stats Cards**:
  - Total products
  - Active products
  - Total orders
  - Total earnings

- **Quick Actions**:
  - Add product
  - View products
  - View orders
  - View earnings

- **Recent Orders**:
  - Order list
  - Status updates

#### 14. Reseller Dashboard
- **Stats Cards**:
  - Total products
  - Active products
  - Total orders
  - Total earnings
  - Pending earnings
  - Current tier

- **Earnings Overview**:
  - Total earnings
  - This month
  - Last month
  - Pending

- **Quick Actions**:
  - Add products
  - Share catalog
  - View orders
  - View earnings

#### 15. Admin Panel
- **Dashboard**:
  - Total users
  - Total products
  - Total orders
  - Revenue

- **Management Sections**:
  - User management
  - Product management
  - Order management
  - Category management
  - Coupon management
  - Settings

---

## Technology Stack

### Frontend (Mobile App)

#### Framework
- **React Native**: 0.79.5
- **Expo**: 53.0.20
- **TypeScript**: 5.8.3

#### Navigation
- **React Navigation**: 7.x
  - `@react-navigation/native`
  - `@react-navigation/bottom-tabs`
  - `@react-navigation/stack`
  - `@react-navigation/native-stack`

#### UI Components
- **Expo Vector Icons**: `@expo/vector-icons`
- **Bottom Sheet**: `@gorhom/bottom-sheet`
- **Linear Gradient**: `expo-linear-gradient`
- **Image Picker**: `expo-image-picker`
- **Toast Messages**: `react-native-toast-message`

#### State Management
- **React Context API**: For global state
- **React Hooks**: useState, useEffect, useCallback, useMemo

#### Storage
- **AsyncStorage**: `@react-native-async-storage/async-storage`

#### Media
- **Expo Image**: `expo-image`
- **Expo AV**: `expo-av` (for videos)
- **Image Manipulator**: `expo-image-manipulator`

#### Other Libraries
- **Axios**: HTTP client
- **Moment.js**: Date formatting
- **React Native Razorpay**: Payment gateway
- **Firebase**: Push notifications, Firestore (chat)

---

### Backend (Microservices)

#### Runtime
- **Node.js**: 18+
- **TypeScript**: 5.3.3

#### Framework
- **Express.js**: 4.18.2

#### Databases
- **PostgreSQL**: 15+ (Primary database)
- **Apache Cassandra**: 4.x (High-volume data)
- **Redis**: 7+ (Caching, sessions)

#### Database Drivers
- **pg**: PostgreSQL client
- **cassandra-driver**: Cassandra client
- **ioredis**: Redis client

#### Authentication
- **jsonwebtoken**: JWT tokens
- **bcryptjs**: Password hashing

#### External Services
- **Razorpay SDK**: Payment processing
- **Firebase Admin SDK**: Push notifications
- **Nodemailer**: Email sending
- **Axios**: HTTP requests

#### Validation
- **Joi**: Input validation

#### Security
- **Helmet**: Security headers
- **express-rate-limit**: Rate limiting
- **CORS**: Cross-origin resource sharing

#### Real-time
- **Socket.io**: WebSocket for chat

---

### Infrastructure

#### Containerization
- **Docker**: Containerization
- **Docker Compose**: Local development

#### Orchestration
- **Kubernetes**: Production orchestration

#### API Gateway
- **Kong** or **NGINX**: Request routing

#### Message Queue
- **RabbitMQ**: Async messaging

#### Monitoring
- **Prometheus**: Metrics collection
- **Grafana**: Metrics visualization
- **ELK Stack**: Logging
- **Jaeger**: Distributed tracing

#### CI/CD
- **GitHub Actions** or **GitLab CI**: Continuous integration

---

## Implementation Guidelines

### Project Structure

#### Frontend Structure
```
mobile-app/
├── src/
│   ├── screens/          # All screen components
│   ├── components/       # Reusable components
│   │   ├── common/      # Common components
│   │   ├── Home/        # Home-specific components
│   │   └── Profile/     # Profile-specific components
│   ├── navigation/      # Navigation configuration
│   ├── contexts/        # React Context providers
│   ├── services/         # API services
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript types
│   ├── assets/          # Images, fonts, etc.
│   └── locales/         # i18n translations
├── App.tsx              # Root component
├── package.json
└── tsconfig.json
```

#### Backend Structure (Per Service)
```
service-name/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── services/         # Business logic
│   ├── models/          # Data models
│   ├── repositories/    # Data access layer
│   ├── middleware/      # Middleware functions
│   ├── routes/          # API routes
│   ├── migrations/     # Database migrations
│   └── server.ts        # Entry point
├── tests/               # Test files
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

### Code Standards

#### TypeScript
- Strict mode enabled
- All functions typed
- Interfaces for all data structures
- No `any` types (use `unknown` if needed)

#### Naming Conventions
- **Files**: camelCase for components, kebab-case for utilities
- **Components**: PascalCase
- **Functions**: camelCase
- **Constants**: UPPER_SNAKE_CASE
- **Types/Interfaces**: PascalCase

#### Code Organization
- One component per file
- Separate concerns (UI, logic, data)
- Reusable components
- Custom hooks for complex logic
- Service layer for API calls

#### Error Handling
- Try-catch blocks for async operations
- User-friendly error messages
- Error logging
- Fallback UI states

#### Performance
- React.memo for expensive components
- useMemo for expensive calculations
- useCallback for event handlers
- Lazy loading for screens
- Image optimization
- List virtualization (FlatList)

---

### Authentication Flow

#### Phone-First Authentication
1. User enters phone number with country code
2. System checks if user exists
3. If new user:
   - Send OTP via SMS (Sisdial API)
   - User verifies OTP
   - Collect name and email
   - Create password
   - Create user account
4. If existing user:
   - Send OTP via SMS
   - User verifies OTP
   - Prompt for password
   - Login user

#### Token Management
- Access token: 7 days expiry
- Refresh token: 30 days expiry
- Token stored securely (AsyncStorage)
- Automatic token refresh
- Logout clears tokens

---

### Virtual Try-On Flow

#### Requirements
- User must have profile photo
- Minimum 50 coins required
- Valid product image URL
- Size selection (for certain products)

#### Flow
1. User clicks "Try On" button
2. Check coin balance (minimum 25)
3. Check profile photo exists
4. Select size (if required)
5. Show consent modal
6. User accepts consent
7. Deduct 50 coins
8. Call PiAPI/Akool API
9. Poll for completion
10. Display results
11. Allow save/share

#### API Integration
- **PiAPI**: Primary face swap service
- **Akool**: Fallback service
- Task polling every 5 seconds
- Maximum 5 minutes timeout
- Error handling with coin refund

---

### Payment Flow

#### Razorpay Integration
1. User clicks "Place Order"
2. Create Razorpay order (server-side)
3. Open Razorpay checkout (client-side)
4. User completes payment
5. Verify payment signature (server-side)
6. Create order in database
7. Send confirmation notification
8. Clear cart

#### Payment Verification
- HMAC-SHA256 signature verification
- Server-side verification only
- Webhook handling for status updates

---

### State Management

#### Context Providers
- **AuthContext**: User authentication state
- **UserContext**: User profile data
- **CartContext**: Shopping cart state
- **WishlistContext**: Wishlist state
- **ChatContext**: Chat state
- **NotificationContext**: Notifications state

#### Local State
- Component-level state with useState
- Form state management
- UI state (modals, loading, etc.)

---

## Security Requirements

### Authentication Security
- Password hashing (bcrypt, 10 rounds)
- JWT token expiration
- Refresh token rotation
- Rate limiting on auth endpoints
- OTP expiration (200 seconds)
- OTP rate limiting (60 seconds between requests)

### API Security
- HTTPS only
- CORS configuration
- Rate limiting
- Input validation
- SQL injection prevention
- XSS prevention
- CSRF protection

### Data Security
- Sensitive data encryption
- Secure token storage
- API key protection
- Payment data never stored
- PII encryption

### Network Security
- Private networks for services
- Firewall rules
- VPN for admin access
- mTLS for service-to-service

---

## Performance Requirements

### Response Times
- API response: < 200ms (p95)
- Page load: < 2 seconds
- Image load: < 1 second
- Search results: < 500ms

### Scalability
- Horizontal scaling support
- Database read replicas
- Redis caching
- CDN for static assets
- Image optimization

### Optimization
- Code splitting
- Lazy loading
- Image lazy loading
- List virtualization
- Memoization
- Debouncing search

---

## Deployment Architecture

### Development Environment
- Docker Compose for local services
- Local PostgreSQL/Redis/Cassandra
- Hot reload for development

### Staging Environment
- Kubernetes cluster
- Staging databases
- CI/CD pipeline

### Production Environment
- Kubernetes cluster (multi-node)
- Production databases (replicated)
- Load balancer
- CDN
- Monitoring and alerting

---

## Testing Requirements

### Unit Tests
- Service layer tests
- Utility function tests
- Component tests
- Test coverage > 80%

### Integration Tests
- API endpoint tests
- Database integration tests
- Service-to-service tests

### E2E Tests
- Critical user flows
- Payment flow
- Order flow
- Authentication flow

---

## Additional Features

### Coin System
- **Earning**:
  - Referral sharing: 2 coins
  - Product sharing: 2 coins
  - Order completion: 10 coins
- **Usage**:
  - Face swap: 50 coins
  - Discount: 1 coin = ₹1 discount

### Referral System Details
- **Referral Code Format**: `REF{USERID_SHORT}{RANDOM}`
- **New User Reward**: ₹100 fixed discount coupon
- **Referrer Reward**: 10% discount coupon (increases with referrals)
- **Reward Tiers**: Based on number of successful referrals

### Reseller System Details
- **Margin Calculation**: Reseller sets custom price
- **Commission Tiers**: Based on total sales
- **Payout**: Monthly payout to bank account
- **Catalog Sharing**: Shareable product catalog links

### Vendor System Details
- **Registration**: Business details, documents
- **Verification**: Admin approval required
- **Product Listing**: Vendor can list products
- **Earnings**: Commission on sales

### Influencer System Details
- **Application**: Social media handles, follower count
- **Approval**: Admin approval required
- **Campaigns**: Create product campaigns
- **Earnings**: Commission on referred sales

---

## External API Integrations

### Sisdial OTP API
- **Endpoint**: `http://user.sisdial.in`
- **Generate OTP**: `/generateOtp.jsp`
- **Verify OTP**: `/validateOtpApi.jsp`
- **Credentials**: User ID and API Key

### Razorpay API
- **Endpoint**: `https://api.razorpay.com/v1`
- **Create Order**: `POST /orders`
- **Verify Payment**: Signature verification
- **Refund**: `POST /payments/{payment_id}/refund`

### PiAPI Face Swap
- **Endpoint**: `https://api.piapi.ai`
- **Initiate**: `POST /faceswap`
- **Check Status**: `GET /faceswap/{task_id}`
- **API Key**: Required

### Akool Face Swap (Fallback)
- **Endpoint**: Akool API
- **Face Detection**: Required before swap
- **Face Swap**: Async processing
- **Status Polling**: Required

### Firebase
- **FCM**: Push notifications
- **Firestore**: Chat messages (optional, can use Cassandra)

---

## Environment Variables

### Frontend (.env)
```env
EXPO_PUBLIC_API_URL=https://api.only2u.com
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_RAZORPAY_KEY_ID=your-razorpay-key
FIREBASE_API_KEY=your-firebase-key
```

### Backend (.env per service)
```env
PORT=3001
NODE_ENV=production
DB_HOST=localhost
DB_NAME=service_db
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret
RAZORPAY_KEY_ID=your-key
RAZORPAY_KEY_SECRET=your-secret
OTP_USER_ID=Only2u
OTP_API_KEY=your-api-key
FIREBASE_SERVICE_ACCOUNT=your-service-account-json
```

---

## Implementation Phases

### Phase 1: Foundation (Weeks 1-4)
1. Set up project structure
2. Configure development environment
3. Set up databases
4. Implement Auth Service
5. Implement basic UI screens

### Phase 2: Core Features (Weeks 5-8)
1. Product Service
2. Product catalog UI
3. Cart Service
4. Cart UI
5. Order Service
6. Checkout flow

### Phase 3: E-Commerce (Weeks 9-12)
1. Payment Service
2. Payment integration
3. Order management
4. Address management
5. Reviews system

### Phase 4: User Features (Weeks 13-16)
1. Wishlist Service
2. Chat Service
3. Notification Service
4. Profile management
5. Settings

### Phase 5: Advanced Features (Weeks 17-20)
1. Virtual Try-On integration
2. Referral system
3. Coupon system
4. Coin system
5. Social features

### Phase 6: Business Features (Weeks 21-24)
1. Vendor system
2. Influencer system
3. Reseller system
4. Admin panel
5. Analytics

### Phase 7: Polish & Launch (Weeks 25-28)
1. Testing
2. Performance optimization
3. Bug fixes
4. Documentation
5. Deployment

---

## Success Criteria

### Functional Requirements
- ✅ All features implemented
- ✅ All APIs working
- ✅ Payment processing functional
- ✅ Virtual try-on working
- ✅ Real-time chat working
- ✅ Push notifications working

### Non-Functional Requirements
- ✅ API response time < 200ms
- ✅ App load time < 2 seconds
- ✅ 99.9% uptime
- ✅ Error rate < 0.1%
- ✅ Test coverage > 80%

---

## Notes for LLM/Development Team

### Critical Implementation Points

1. **Authentication Flow**: Phone-first with OTP, then email/password for new users
2. **Virtual Try-On**: Requires coin balance check, profile photo, size selection
3. **Payment**: Server-side Razorpay order creation and signature verification
4. **Cart**: Redis primary, PostgreSQL backup for persistence
5. **Chat**: Cassandra for messages, WebSocket for real-time
6. **Notifications**: Cassandra for history, PostgreSQL for preferences

### Key Business Rules

1. **Face Swap**: Costs 50 coins, requires profile photo
2. **Referral**: New user gets ₹100 coupon, referrer gets 10% coupon
3. **Reseller Tiers**: Commission based on total sales
4. **Order Status**: Cannot cancel after shipped
5. **Coupon**: One-time use unless specified otherwise

### Important Considerations

1. **Error Handling**: Always provide user-friendly messages
2. **Loading States**: Show loading indicators for async operations
3. **Empty States**: Provide helpful empty state messages
4. **Offline Support**: Cache critical data, queue actions
5. **Accessibility**: Support screen readers, proper labels
6. **Internationalization**: Support multiple languages (English, Telugu)

---

## Conclusion

This specification provides a complete blueprint for rebuilding Only2U from scratch. Follow the architecture, implement all features, and ensure clean code practices throughout. The microservices architecture allows for independent scaling and deployment of each service.

**Key Principles**:
- Clean architecture
- Separation of concerns
- Type safety (TypeScript)
- Error handling
- Performance optimization
- Security first
- User experience focus

Good luck with the implementation! 🚀

