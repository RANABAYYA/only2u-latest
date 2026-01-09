# Referral Codes System Documentation

## Overview

The referral codes system allows you to create promotional referral codes that new users can apply during signup. When a valid referral code is used, the new user automatically receives a ₹100 off coupon for their first order.

## Features

✅ **Bulk Code Generation**: Create multiple referral codes with different configurations  
✅ **Usage Tracking**: Track how many times each code has been used  
✅ **Usage Limits**: Set maximum uses per code (or unlimited)  
✅ **Expiration Dates**: Set expiration dates for time-limited campaigns  
✅ **Automatic Coupon Creation**: New users automatically get a ₹100 coupon  
✅ **Analytics**: Built-in analytics view for tracking performance  
✅ **Validation**: Real-time validation during signup  

## How It Works

### User Flow

1. **New User Signs Up**: User enters their phone number and receives OTP
2. **Enters Referral Code**: User can optionally enter a referral code before creating profile
3. **Code Validation**: System validates the code in real-time
   - Checks if code exists and is active
   - Checks if code has expired
   - Checks if code has reached usage limit
4. **Profile Creation**: User creates their profile with name
5. **Automatic Rewards**:
   - Referral code usage is recorded in `referral_code_usage` table
   - A ₹100 coupon is automatically created for the user
   - Usage count is automatically incremented
6. **Success**: User sees confirmation and can use their coupon

### Technical Flow

```
User enters code → validate_referral_code() → Record usage → Create coupon → User notified
```

## Database Schema

### Tables

#### `referral_codes`
Stores the referral codes and their configuration.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| code | VARCHAR(50) | Unique referral code (e.g., "WELCOME2025") |
| description | TEXT | Description of the code |
| max_uses | INTEGER | Maximum total uses (NULL = unlimited) |
| usage_count | INTEGER | Current usage count (auto-incremented) |
| is_active | BOOLEAN | Whether the code is active |
| created_at | TIMESTAMPTZ | When the code was created |
| expires_at | TIMESTAMPTZ | Expiration date (NULL = never expires) |
| created_by | VARCHAR(255) | Admin who created the code |
| metadata | JSONB | Additional metadata (campaign info, etc.) |

#### `referral_code_usage`
Tracks individual uses of referral codes.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| referral_code_id | UUID | Reference to referral_codes table |
| referral_code | VARCHAR(50) | Denormalized code for faster queries |
| user_id | UUID | Reference to users table |
| user_email | VARCHAR(255) | User's email |
| user_phone | VARCHAR(50) | User's phone |
| user_name | VARCHAR(255) | User's name |
| used_at | TIMESTAMPTZ | When the code was used |
| ip_address | VARCHAR(50) | User's IP address (optional) |
| user_agent | TEXT | User's browser/app info (optional) |
| metadata | JSONB | Additional tracking data |

#### `referral_code_analytics` (View)
Analytics view for tracking code performance.

| Column | Type | Description |
|--------|------|-------------|
| code | VARCHAR(50) | The referral code |
| total_signups | INTEGER | Total number of signups |
| unique_users | INTEGER | Unique users (by email) |
| first_use_date | TIMESTAMPTZ | First time code was used |
| last_use_date | TIMESTAMPTZ | Last time code was used |
| status | TEXT | Current status (Active/Expired/Inactive/Limit Reached) |

## Setup Instructions

### 1. Run the SQL Migration

Execute the complete SQL migration file:

```bash
# In Supabase SQL Editor, run:
sql/referral_codes_complete.sql
```

Or via command line:

```bash
psql -h <your-db-host> -U postgres -d postgres -f sql/referral_codes_complete.sql
```

### 2. Verify Installation

Check that tables were created:

```sql
SELECT * FROM referral_codes LIMIT 5;
SELECT * FROM validate_referral_code('WELCOME2025');
```

### 3. Test the Flow

1. Create a test referral code in Supabase
2. Open the app and start signup
3. Enter the referral code during signup
4. Complete profile creation
5. Check that coupon was created in `coupons` table

## Managing Referral Codes

### Creating a New Referral Code

```sql
INSERT INTO referral_codes (
  code, 
  description, 
  max_uses, 
  is_active,
  expires_at,
  created_by
) VALUES (
  'SUMMER2025',
  'Summer Campaign 2025',
  100,  -- Max 100 uses
  true,
  '2025-08-31 23:59:59+00',  -- Expires end of August
  'admin'
);
```

### Creating an Unlimited Code

```sql
INSERT INTO referral_codes (
  code, 
  description, 
  max_uses,  -- NULL = unlimited
  is_active
) VALUES (
  'VIPUNLIMITED',
  'VIP Access - Unlimited Uses',
  NULL,
  true
);
```

### Deactivating a Code

```sql
UPDATE referral_codes 
SET is_active = false 
WHERE code = 'OLDCODE';
```

### Extending Expiration

```sql
UPDATE referral_codes 
SET expires_at = '2025-12-31 23:59:59+00'
WHERE code = 'WELCOME2025';
```

### Viewing Code Analytics

```sql
-- View all codes with analytics
SELECT * FROM referral_code_analytics 
ORDER BY total_signups DESC;

-- View specific code performance
SELECT * FROM referral_code_analytics 
WHERE code = 'WELCOME2025';

-- View most popular active codes
SELECT 
  code,
  description,
  total_signups,
  unique_users,
  status
FROM referral_code_analytics
WHERE status = 'Active'
ORDER BY total_signups DESC
LIMIT 10;
```

### Viewing Usage History

```sql
-- Recent code usage
SELECT 
  rcu.referral_code,
  rcu.user_name,
  rcu.user_email,
  rcu.used_at,
  u.id as user_id
FROM referral_code_usage rcu
LEFT JOIN users u ON rcu.user_id = u.id
ORDER BY rcu.used_at DESC
LIMIT 20;

-- Usage by specific code
SELECT 
  user_name,
  user_email,
  user_phone,
  used_at
FROM referral_code_usage
WHERE referral_code = 'WELCOME2025'
ORDER BY used_at DESC;
```

## Validation Rules

The system performs the following validations automatically:

| Check | Description |
|-------|-------------|
| Code Exists | Code must exist in `referral_codes` table |
| Is Active | `is_active` must be `true` |
| Not Expired | Current time < `expires_at` (if set) |
| Within Limit | `usage_count` < `max_uses` (if set) |

## Coupon Creation

When a valid referral code is used, the system automatically:

1. **Records Usage**: Inserts record in `referral_code_usage`
2. **Increments Counter**: Auto-increments `usage_count` via trigger
3. **Creates Coupon**: Creates a new coupon with these properties:
   - **Code**: `WELCOME{userId}{timestamp}` (unique per user)
   - **Type**: Fixed discount
   - **Value**: ₹100
   - **Max Uses**: 1 (one-time use)
   - **Per User Limit**: 1
   - **Min Order Value**: ₹0 (no minimum)
   - **Description**: "Welcome to Only2U! ₹100 off your first order"

## API Functions

### validateReferralCode(code: string)

Validates a referral code and returns validation result.

**Returns:**
```typescript
{
  isValid: boolean;
  message: string;
  referralCodeId: string | null;
}
```

**Example:**
```typescript
const result = await validateReferralCode('WELCOME2025');
if (result.isValid) {
  console.log('Code is valid:', result.referralCodeId);
} else {
  console.log('Validation failed:', result.message);
}
```

### redeemReferralCode(...)

Redeems a referral code and creates welcome coupon for user.

**Parameters:**
- `referralCodeId`: ID from validation
- `referralCode`: The code string
- `userId`: New user's ID
- `userEmail`: User's email (optional)
- `userName`: User's name (optional)
- `userPhone`: User's phone (optional)

**Returns:**
```typescript
{
  coupon: {
    id: string;
    code: string;
  }
}
```

## Bulk Code Generation

### Generate Multiple Codes at Once

```sql
-- Generate 10 campaign codes
DO $$
DECLARE
  i INTEGER;
BEGIN
  FOR i IN 1..10 LOOP
    INSERT INTO referral_codes (
      code,
      description,
      max_uses,
      is_active
    ) VALUES (
      'CAMPAIGN' || LPAD(i::TEXT, 3, '0'),  -- CAMPAIGN001, CAMPAIGN002, etc.
      'Campaign Code #' || i,
      50,
      true
    );
  END LOOP;
END $$;
```

### Generate Random Unique Codes

```sql
-- Function to generate random codes
CREATE OR REPLACE FUNCTION generate_referral_codes(count INTEGER)
RETURNS VOID AS $$
DECLARE
  i INTEGER;
  random_code VARCHAR(10);
BEGIN
  FOR i IN 1..count LOOP
    -- Generate random 8-character code
    random_code := UPPER(substring(md5(random()::text) from 1 for 8));
    
    INSERT INTO referral_codes (
      code,
      description,
      max_uses,
      is_active
    ) VALUES (
      random_code,
      'Auto-generated code',
      NULL,
      true
    )
    ON CONFLICT (code) DO NOTHING;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate 100 random codes
SELECT generate_referral_codes(100);
```

## Monitoring and Reports

### Daily Signup Report

```sql
SELECT 
  DATE(used_at) as signup_date,
  COUNT(*) as total_signups,
  COUNT(DISTINCT referral_code) as codes_used
FROM referral_code_usage
WHERE used_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(used_at)
ORDER BY signup_date DESC;
```

### Top Performing Codes

```sql
SELECT 
  rc.code,
  rc.description,
  COUNT(rcu.id) as signups,
  rc.max_uses,
  rc.usage_count
FROM referral_codes rc
LEFT JOIN referral_code_usage rcu ON rc.id = rcu.referral_code_id
GROUP BY rc.id, rc.code, rc.description, rc.max_uses, rc.usage_count
ORDER BY signups DESC
LIMIT 10;
```

### Codes Nearing Limit

```sql
SELECT 
  code,
  description,
  usage_count,
  max_uses,
  (max_uses - usage_count) as remaining_uses
FROM referral_codes
WHERE max_uses IS NOT NULL
  AND usage_count >= (max_uses * 0.8)  -- 80% used
  AND is_active = true
ORDER BY remaining_uses ASC;
```

## Troubleshooting

### Code Validation Fails

1. Check if code exists:
```sql
SELECT * FROM referral_codes WHERE code = 'YOUR_CODE';
```

2. Check if code is active:
```sql
SELECT code, is_active, expires_at, usage_count, max_uses
FROM referral_codes 
WHERE code = 'YOUR_CODE';
```

### Coupon Not Created

1. Check if usage was recorded:
```sql
SELECT * FROM referral_code_usage 
WHERE user_id = 'USER_ID' 
ORDER BY used_at DESC;
```

2. Check if coupon exists:
```sql
SELECT * FROM coupons 
WHERE created_by = 'USER_ID' 
AND description LIKE 'Welcome to Only2U%';
```

3. Check application logs for errors

### Usage Count Not Incrementing

1. Check if trigger exists:
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'trigger_increment_referral_usage';
```

2. Manually fix if needed:
```sql
UPDATE referral_codes rc
SET usage_count = (
  SELECT COUNT(*) 
  FROM referral_code_usage rcu 
  WHERE rcu.referral_code_id = rc.id
)
WHERE id = 'CODE_ID';
```

## Security Considerations

- ✅ Codes are validated server-side using database function
- ✅ Usage tracking prevents duplicate redemptions
- ✅ Automatic limits prevent abuse
- ✅ All operations are logged for audit trail
- ✅ User data is properly referenced with foreign keys

## Integration Points

The referral code system integrates with:

1. **Signup Flow** (`navigation/tab-navigator.tsx`)
   - Referral code input during onboarding
   - Real-time validation
   - Auto-redemption on profile creation

2. **Coupon System** (`coupons` table)
   - Automatic coupon creation
   - Integration with existing coupon logic
   - Usage tracked in `coupon_usage` table

3. **User System** (`users` table)
   - Links usage to user accounts
   - Tracks user information

## Future Enhancements

Potential features to add:

- [ ] Admin dashboard for code management
- [ ] Batch code export/import
- [ ] A/B testing for different code types
- [ ] Referrer rewards (if tracking referrer)
- [ ] Multi-tier rewards (different values per code)
- [ ] Geographic restrictions
- [ ] Device/IP limiting
- [ ] Integration with marketing analytics

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review Supabase logs for errors
3. Check application logs for detailed error messages
4. Verify database permissions are correctly set

---

**Created:** 2025
**Version:** 1.0
**Last Updated:** 2025-01-27

