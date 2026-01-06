import { supabase } from '~/utils/supabase';

/**
 * Service for handling referral codes from the referral_codes table
 * Validates codes and creates welcome coupons for new users
 */

interface ReferralCodeValidation {
  isValid: boolean;
  message: string;
  referralCodeId: string | null;
}

interface ReferralCodeUsageData {
  referralCodeId: string;
  referralCode: string;
  userId?: string;
  userEmail?: string;
  userPhone?: string;
  userName?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Validates a referral code using the database function
 * @param code - The referral code to validate
 * @returns Validation result with status and message
 */
export const validateReferralCode = async (code: string): Promise<ReferralCodeValidation> => {
  try {
    if (!code || code.trim() === '') {
      return {
        isValid: false,
        message: 'Please enter a referral code',
        referralCodeId: null,
      };
    }

    // Call the database function to validate the code
    const { data, error } = await supabase.rpc('validate_referral_code', {
      p_code: code.trim().toUpperCase(),
    });

    if (error) {
      console.error('[ReferralCode] Validation error:', error);
      return {
        isValid: false,
        message: 'Error validating referral code',
        referralCodeId: null,
      };
    }

    // The function returns a single row with is_valid, message, and referral_code_id
    const result = Array.isArray(data) ? data[0] : data;

    return {
      isValid: result?.is_valid || false,
      message: result?.message || 'Invalid referral code',
      referralCodeId: result?.referral_code_id || null,
    };
  } catch (error) {
    console.error('[ReferralCode] Exception during validation:', error);
    return {
      isValid: false,
      message: 'Error validating referral code',
      referralCodeId: null,
    };
  }
};

/**
 * Records the usage of a referral code
 * @param usageData - Data about the referral code usage
 */
export const recordReferralCodeUsage = async (
  usageData: ReferralCodeUsageData
): Promise<void> => {
  try {
    const { error } = await supabase.from('referral_code_usage').insert({
      referral_code_id: usageData.referralCodeId,
      referral_code: usageData.referralCode,
      user_id: usageData.userId || null,
      user_email: usageData.userEmail || null,
      user_phone: usageData.userPhone || null,
      user_name: usageData.userName || null,
      ip_address: usageData.ipAddress || null,
      user_agent: usageData.userAgent || null,
      used_at: new Date().toISOString(),
    });

    if (error) {
      console.error('[ReferralCode] Error recording usage:', error);
      throw error;
    }

    console.log('[ReferralCode] ✅ Usage recorded successfully');
  } catch (error) {
    console.error('[ReferralCode] Exception recording usage:', error);
    throw error;
  }
};

/**
 * Creates a welcome coupon for a new user who used a referral code
 * @param userId - The user's ID
 * @param userName - The user's name (optional)
 * @returns The created coupon data
 */
export const createWelcomeCouponForReferral = async (
  userId: string,
  userName?: string
): Promise<{ id: string; code: string }> => {
  try {
    if (!userId) {
      throw new Error('User ID is required to create welcome coupon');
    }

    // Generate a unique coupon code for this user
    const timestamp = Date.now().toString().slice(-6);
    const userIdShort = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const couponCode = `WELCOME${userIdShort}${timestamp}`;

    // Create the coupon
    const { data, error } = await supabase
      .from('coupons')
      .insert({
        code: couponCode,
        description: `Welcome to Only2U! ₹100 off your first order${userName ? ` - ${userName}` : ''}`,
        discount_type: 'fixed',
        discount_value: 100,
        max_uses: 1,
        per_user_limit: 1,
        min_order_value: 0,
        is_active: true,
        created_by: userId,
      })
      .select('id, code')
      .single();

    if (error) {
      console.error('[ReferralCode] Error creating welcome coupon:', error);
      throw error;
    }

    console.log('[ReferralCode] ✅ Welcome coupon created:', data.code);
    return data;
  } catch (error) {
    console.error('[ReferralCode] Exception creating welcome coupon:', error);
    throw error;
  }
};

/**
 * Complete referral code redemption process:
 * 1. Records the usage
 * 2. Creates a welcome coupon for the new user
 * @param referralCodeId - The ID of the referral code
 * @param referralCode - The referral code string
 * @param userId - The new user's ID
 * @param userEmail - The new user's email
 * @param userName - The new user's name
 * @param userPhone - The new user's phone
 * @returns The created coupon
 */
export const redeemReferralCode = async (
  referralCodeId: string,
  referralCode: string,
  userId: string,
  userEmail?: string,
  userName?: string,
  userPhone?: string
): Promise<{ coupon: { id: string; code: string } }> => {
  try {
    // Record the usage
    await recordReferralCodeUsage({
      referralCodeId,
      referralCode,
      userId,
      userEmail,
      userName,
      userPhone,
    });

    // Create welcome coupon
    const coupon = await createWelcomeCouponForReferral(userId, userName);

    console.log('[ReferralCode] ✅ Referral code redeemed successfully');

    return { coupon };
  } catch (error) {
    console.error('[ReferralCode] Error redeeming referral code:', error);
    throw error;
  }
};

/**
 * Get referral code analytics for a specific code
 * @param code - The referral code
 * @returns Analytics data
 */
export const getReferralCodeAnalytics = async (code: string) => {
  try {
    const { data, error } = await supabase
      .from('referral_code_analytics')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    if (error) {
      console.error('[ReferralCode] Error fetching analytics:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('[ReferralCode] Exception fetching analytics:', error);
    return null;
  }
};

