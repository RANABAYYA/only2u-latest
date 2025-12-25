# Referral Codes Quick Start Guide

## 🚀 Quick Setup (5 minutes)

### Step 1: Run the SQL Migration

1. Open **Supabase Dashboard**
2. Go to **SQL Editor**
3. Open and run the file: `sql/referral_codes_complete.sql`
4. Wait for "Referral codes system created successfully!" message

### Step 2: Create Your First Referral Code

Run this in Supabase SQL Editor:

```sql
INSERT INTO referral_codes (code, description, max_uses, is_active) 
VALUES ('WELCOME100', 'Welcome Campaign - 100 uses', 100, true);
```

### Step 3: Test the Code

1. Open your app
2. Start the signup process (phone OTP)
3. After OTP verification, enter: `WELCOME100`
4. Complete profile creation
5. You should see: "₹100 off coupon added to your account"

### Step 4: Verify It Worked

Check in Supabase:

```sql
-- Check code was used
SELECT * FROM referral_code_usage 
ORDER BY used_at DESC LIMIT 1;

-- Check coupon was created
SELECT * FROM coupons 
WHERE description LIKE 'Welcome to Only2U%'
ORDER BY created_at DESC LIMIT 1;
```

## ✅ What Got Added to Your App

### 1. New Service File
- `services/referralCodeService.ts` - Handles validation and redemption

### 2. Updated Files
- `navigation/tab-navigator.tsx` - Integrated with signup flow

### 3. New SQL Files
- `sql/referral_codes_complete.sql` - Complete database setup

### 4. Documentation
- `REFERRAL_CODES_SYSTEM.md` - Complete documentation
- `REFERRAL_CODES_QUICKSTART.md` - This quick start guide

## 📊 How It Works

```
New User Signs Up
     ↓
Enters Referral Code (Optional)
     ↓
System Validates Code
     ↓
User Creates Profile
     ↓
✨ AUTO-MAGIC ✨
- Usage recorded
- Counter incremented  
- ₹100 coupon created
- User notified
     ↓
User Can Use Coupon!
```

## 🎯 Common Use Cases

### Campaign Code (Limited Uses)
```sql
INSERT INTO referral_codes (code, description, max_uses, is_active) 
VALUES ('LAUNCH2025', 'Product Launch Campaign', 500, true);
```

### VIP Code (Unlimited)
```sql
INSERT INTO referral_codes (code, description, is_active) 
VALUES ('VIPACCESS', 'VIP Member Code', true);
```

### Time-Limited Code
```sql
INSERT INTO referral_codes (code, description, expires_at, is_active) 
VALUES (
  'NEWYEAR', 
  'New Year Special', 
  '2025-01-31 23:59:59+00',
  true
);
```

## 📈 Viewing Results

### Check Code Performance
```sql
SELECT * FROM referral_code_analytics 
WHERE code = 'WELCOME100';
```

### See Recent Signups
```sql
SELECT 
  referral_code,
  user_name,
  user_email,
  used_at
FROM referral_code_usage
ORDER BY used_at DESC
LIMIT 10;
```

### Top Codes
```sql
SELECT 
  code,
  description,
  total_signups,
  status
FROM referral_code_analytics
ORDER BY total_signups DESC
LIMIT 5;
```

## 🔧 Managing Codes

### Deactivate a Code
```sql
UPDATE referral_codes 
SET is_active = false 
WHERE code = 'OLDCODE';
```

### Extend Expiration
```sql
UPDATE referral_codes 
SET expires_at = '2025-12-31 23:59:59+00'
WHERE code = 'WELCOME100';
```

### Check Code Status
```sql
SELECT * FROM validate_referral_code('WELCOME100');
```

## 🎁 The Automatic Coupon

When a user uses a referral code, they automatically get:

- **Discount**: ₹100 OFF
- **Type**: Fixed discount
- **Uses**: 1 time only
- **Minimum**: ₹0 (no minimum order)
- **Code Format**: `WELCOME{userId}{timestamp}`
- **Valid**: Immediately

Example: `WELCOMEABC1231735123456`

## 🐛 Troubleshooting

### "Referral code not found"
→ Check if code exists: `SELECT * FROM referral_codes WHERE code = 'YOUR_CODE';`

### "Referral code is inactive"
→ Activate it: `UPDATE referral_codes SET is_active = true WHERE code = 'YOUR_CODE';`

### "Referral code has expired"
→ Extend date: `UPDATE referral_codes SET expires_at = '2025-12-31' WHERE code = 'YOUR_CODE';`

### "Usage limit reached"
→ Increase limit: `UPDATE referral_codes SET max_uses = 1000 WHERE code = 'YOUR_CODE';`

### Coupon not created
→ Check logs in app console for errors
→ Verify user completed profile creation
→ Check `coupon_usage` table

## 💡 Pro Tips

1. **Use Descriptive Codes**: `INFLUENCER2025` vs `ABC123`
2. **Set Reasonable Limits**: Start with 100-500 uses
3. **Monitor Analytics**: Check performance weekly
4. **Expire Old Codes**: Clean up inactive campaigns
5. **Track Everything**: The system logs all usage automatically

## 📞 Need Help?

1. Check full docs: `REFERRAL_CODES_SYSTEM.md`
2. Review SQL file: `sql/referral_codes_complete.sql`
3. Check service file: `services/referralCodeService.ts`
4. Look at integration: `navigation/tab-navigator.tsx`

## 🎉 You're Done!

Your referral code system is now live! Users can:
- ✅ Enter codes during signup
- ✅ Get instant validation
- ✅ Receive ₹100 coupons automatically
- ✅ Use coupons on their first order

Start creating codes and watch the signups roll in! 🚀

