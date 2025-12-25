# 🌟 Influencer Application System

Complete system for managing influencer applications, tracking commissions, and monitoring performance.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Database Schema](#database-schema)
3. [Setup Instructions](#setup-instructions)
4. [API/Service Usage](#apiservice-usage)
5. [Admin Functions](#admin-functions)
6. [Frontend Integration](#frontend-integration)
7. [Testing](#testing)

---

## 🎯 Overview

The Influencer Application System allows content creators to:
- Submit applications through a beautiful mobile interface
- Track their commission earnings
- Get approved with unique influencer codes
- Monitor their performance metrics

### Features
✅ **Application Submission** - Simple 2-field form (Name + Instagram)  
✅ **Automatic Code Generation** - Unique influencer codes (e.g., `JOHN1234`)  
✅ **Commission Tracking** - Track earnings per order  
✅ **Performance Analytics** - Daily/weekly/monthly metrics  
✅ **Admin Approval System** - Review and approve/reject applications  
✅ **Row Level Security** - Secure data access policies  

---

## 🗄️ Database Schema

### Tables

#### 1. `influencer_applications`
Stores all influencer applications and approved influencer data.

**Key Fields:**
- `id` (UUID) - Primary key
- `full_name` (VARCHAR) - Applicant's full name
- `instagram_url` (VARCHAR) - Instagram profile URL
- `instagram_handle` (VARCHAR) - Extracted handle
- `status` - `pending | under_review | approved | rejected | on_hold`
- `influencer_code` (VARCHAR) - Unique tracking code (generated on approval)
- `commission_rate` (DECIMAL) - Percentage commission (default 10%)
- `total_orders` (INTEGER) - Total orders tracked
- `total_revenue` (DECIMAL) - Total sales generated
- `total_commission_earned` (DECIMAL) - Total commission earned

#### 2. `influencer_commissions`
Tracks individual commission earnings per order.

**Key Fields:**
- `id` (UUID) - Primary key
- `influencer_id` (UUID) - Foreign key to applications
- `order_id` (UUID) - Order reference
- `order_amount` (DECIMAL) - Order total
- `commission_rate` (DECIMAL) - Commission percentage
- `commission_amount` (DECIMAL) - Calculated commission
- `status` - `pending | approved | paid | cancelled`
- `paid_at` (TIMESTAMPTZ) - Payment timestamp

#### 3. `influencer_metrics`
Historical performance metrics.

**Key Fields:**
- `influencer_id` (UUID) - Foreign key
- `metric_date` (DATE) - Date of metric
- `metric_type` - `daily | weekly | monthly`
- `clicks`, `orders`, `revenue`, `commission`
- `conversion_rate` (DECIMAL)

---

## 🚀 Setup Instructions

### 1. Run SQL Schema

```bash
# Connect to your PostgreSQL/Supabase database
psql -U your_username -d your_database -f sql/influencer_applications.sql
```

Or in Supabase dashboard:
1. Go to **SQL Editor**
2. Create new query
3. Paste contents of `sql/influencer_applications.sql`
4. Run query

### 2. Verify Tables

```sql
-- Check if tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'influencer%';

-- Should return:
-- influencer_applications
-- influencer_commissions
-- influencer_metrics
```

### 3. Test Functions

```sql
-- Test influencer code generation
SELECT generate_influencer_code('John Doe');
-- Returns: JOHN1234 (or similar)

-- Test commission calculation
SELECT * FROM calculate_influencer_commission(
  'YOUR_INFLUENCER_ID_HERE'::UUID,
  NULL,
  NULL
);
```

---

## 💻 API/Service Usage

### Submitting an Application

```typescript
import { submitInfluencerApplication } from '~/services/influencerService';

const handleSubmit = async () => {
  const result = await submitInfluencerApplication({
    full_name: 'John Doe',
    instagram_url: 'https://instagram.com/johndoe',
    user_email: 'john@example.com',
  });

  if (result.success) {
    console.log('Application submitted:', result.data);
  } else {
    console.error('Error:', result.error);
  }
};
```

### Checking User's Applications

```typescript
import { getUserInfluencerApplications } from '~/services/influencerService';

const fetchMyApplications = async (userId: string) => {
  const result = await getUserInfluencerApplications(userId);
  
  if (result.success) {
    console.log('Applications:', result.data);
  }
};
```

### Checking if User is Approved Influencer

```typescript
import { isUserApprovedInfluencer } from '~/services/influencerService';

const checkInfluencerStatus = async (userId: string) => {
  const result = await isUserApprovedInfluencer(userId);
  
  if (result.isApproved) {
    console.log('Influencer code:', result.data?.influencer_code);
    console.log('Commission rate:', result.data?.commission_rate);
  }
};
```

### Getting Commission Stats

```typescript
import { getInfluencerStats } from '~/services/influencerService';

const fetchStats = async (influencerId: string) => {
  const result = await getInfluencerStats(influencerId);
  
  if (result.success) {
    console.log('Total orders:', result.data?.total_orders);
    console.log('Total revenue:', result.data?.total_revenue);
    console.log('Total commission:', result.data?.total_commission);
    console.log('Pending commission:', result.data?.pending_commission);
    console.log('Paid commission:', result.data?.paid_commission);
  }
};
```

---

## 👨‍💼 Admin Functions

### Approving an Application

```typescript
import { approveInfluencerApplication } from '~/services/influencerService';

const approveInfluencer = async (applicationId: string) => {
  const result = await approveInfluencerApplication(
    applicationId,
    12.5 // Optional custom commission rate (default is 10%)
  );
  
  if (result.success) {
    console.log('Approved! Code:', result.data?.influencer_code);
  }
};
```

Or via SQL:

```sql
-- Approve and auto-generate code
SELECT approve_influencer_application('APPLICATION_ID_HERE'::UUID);

-- Check the generated code
SELECT influencer_code, status, approved_at
FROM influencer_applications
WHERE id = 'APPLICATION_ID_HERE'::UUID;
```

### Rejecting an Application

```typescript
import { rejectInfluencerApplication } from '~/services/influencerService';

const rejectInfluencer = async (applicationId: string) => {
  const result = await rejectInfluencerApplication(
    applicationId,
    'Instagram account does not meet minimum follower requirements'
  );
  
  if (result.success) {
    console.log('Application rejected');
  }
};
```

### View Pending Applications (SQL)

```sql
-- Using the pre-built view
SELECT * FROM pending_influencer_applications
ORDER BY days_pending DESC;
```

### View Active Influencers Performance (SQL)

```sql
-- Using the pre-built view
SELECT 
  full_name,
  influencer_code,
  total_orders,
  total_revenue,
  total_commission_earned,
  pending_commission,
  paid_commission
FROM active_influencers_summary
ORDER BY total_revenue DESC
LIMIT 10;
```

---

## 📱 Frontend Integration

The influencer form is already integrated in `screens/JoinInfluencer.tsx`.

### Navigation

```typescript
// From any screen, navigate to influencer form
navigation.navigate('JoinInfluencer' as never);
```

### Form Flow

1. **User fills form** - Name + Instagram handle/URL
2. **Validation** - Checks format before submission
3. **Submit** - Calls `submitInfluencerApplication()`
4. **Success** - Shows animation and confirmation toast
5. **Database** - Stores in `influencer_applications` table with status `pending`

### Creating Influencer Dashboard Screen

Example screen to show influencer stats:

```typescript
// screens/InfluencerDashboard.tsx
import { getInfluencerStats, getInfluencerCommissions } from '~/services/influencerService';

const InfluencerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [commissions, setCommissions] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Get stats
    const statsResult = await getInfluencerStats(influencerId);
    if (statsResult.success) {
      setStats(statsResult.data);
    }

    // Get recent commissions
    const commissionsResult = await getInfluencerCommissions(influencerId, {
      limit: 10
    });
    if (commissionsResult.success) {
      setCommissions(commissionsResult.data);
    }
  };

  return (
    <View>
      <Text>Total Revenue: ₹{stats?.total_revenue}</Text>
      <Text>Pending Commission: ₹{stats?.pending_commission}</Text>
      {/* Display commissions list */}
    </View>
  );
};
```

---

## 🧪 Testing

### 1. Test Application Submission

```typescript
// In your app
const testSubmission = async () => {
  const result = await submitInfluencerApplication({
    full_name: 'Test User',
    instagram_url: 'https://instagram.com/testuser',
  });
  console.log(result);
};
```

### 2. Test Application Approval (SQL)

```sql
-- 1. Insert test application
INSERT INTO influencer_applications (full_name, instagram_url, instagram_handle)
VALUES ('Test Influencer', 'https://instagram.com/testinf', 'testinf')
RETURNING id;

-- 2. Approve it (replace ID)
SELECT approve_influencer_application('YOUR_ID_HERE'::UUID);

-- 3. Verify
SELECT influencer_code, status, approved_at
FROM influencer_applications
WHERE id = 'YOUR_ID_HERE'::UUID;
```

### 3. Test Commission Tracking (SQL)

```sql
-- Insert test commission
INSERT INTO influencer_commissions (
  influencer_id,
  influencer_code,
  order_id,
  order_amount,
  commission_rate,
  commission_amount,
  order_date
) VALUES (
  'YOUR_INFLUENCER_ID'::UUID,
  'TEST1234',
  uuid_generate_v4(),
  10000.00,
  10.00,
  1000.00,
  NOW()
);

-- Check stats
SELECT * FROM calculate_influencer_commission('YOUR_INFLUENCER_ID'::UUID, NULL, NULL);
```

---

## 📊 Useful Queries

### Get Top Performing Influencers

```sql
SELECT 
  full_name,
  influencer_code,
  total_orders,
  total_revenue,
  total_commission_earned,
  (total_revenue / NULLIF(total_orders, 0)) as avg_order_value
FROM influencer_applications
WHERE status = 'approved' AND is_active = true
ORDER BY total_revenue DESC
LIMIT 10;
```

### Monthly Commission Report

```sql
SELECT 
  DATE_TRUNC('month', order_date) as month,
  COUNT(*) as total_orders,
  SUM(order_amount) as total_revenue,
  SUM(commission_amount) as total_commission,
  AVG(commission_amount) as avg_commission
FROM influencer_commissions
WHERE influencer_id = 'YOUR_ID'::UUID
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY month DESC;
```

### Pending Payouts

```sql
SELECT 
  ia.full_name,
  ia.influencer_code,
  ia.contact_email,
  COUNT(ic.id) as pending_orders,
  SUM(ic.commission_amount) as pending_amount
FROM influencer_applications ia
JOIN influencer_commissions ic ON ia.id = ic.influencer_id
WHERE ic.status = 'approved' -- Ready to be paid
GROUP BY ia.id, ia.full_name, ia.influencer_code, ia.contact_email
HAVING SUM(ic.commission_amount) > 0
ORDER BY pending_amount DESC;
```

---

## 🔒 Security Features

1. **Row Level Security (RLS)** - Users can only view their own data
2. **Admin Policies** - Only admins can approve/reject applications
3. **Public Submission** - Anyone can submit (even without login)
4. **Unique Codes** - Auto-generated unique influencer codes
5. **Audit Trail** - Timestamps for all actions

---

## 🎨 UI Features

- ✅ Modern gradient design
- ✅ Smooth carousel with auto-scroll
- ✅ Animated dot indicators
- ✅ Real-time form validation
- ✅ Focus animations on inputs
- ✅ Success animation overlay
- ✅ Haptic feedback
- ✅ Toast notifications

---

## 📝 Notes

- Default commission rate is **10%** (configurable per influencer)
- Influencer codes are **8 characters** (4 letters + 4 digits)
- Applications require manual admin approval
- Commission status flow: `pending` → `approved` → `paid`
- All monetary values stored in **DECIMAL(12,2)** format

---

## 🚀 Future Enhancements

Potential additions:
- Automated approval based on Instagram follower count
- Direct integration with Instagram API for metrics
- Automated payout processing
- Mobile app for influencers to track earnings
- QR code generation for influencer codes
- Tiered commission rates based on performance
- Referral bonuses for bringing other influencers

---

**For questions or issues, contact the development team.**

