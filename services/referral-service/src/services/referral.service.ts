import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { ReferralCode, CreateReferralCodeDto, RedeemReferralCodeDto } from '../models/referral.model';

class ReferralService {
  /**
   * Generate referral code for user
   */
  async generateReferralCode(userId: string): Promise<ReferralCode> {
    // Check if user already has a referral code
    const existing = await db.query(
      'SELECT * FROM referral_codes WHERE user_id = $1',
      [userId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Generate unique code
    const code = this.generateUniqueCode(userId);
    const id = uuidv4();

    const result = await db.query(
      `INSERT INTO referral_codes (
        id, user_id, code, is_active, usage_count, created_at
      ) VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *`,
      [id, userId, code, true, 0]
    );

    return result.rows[0];
  }

  /**
   * Validate referral code
   */
  async validateReferralCode(code: string): Promise<{
    valid: boolean;
    referralCode?: ReferralCode;
    error?: string;
  }> {
    const result = await db.query(
      `SELECT * FROM referral_codes
       WHERE code = $1 AND is_active = true`,
      [code.toUpperCase()]
    );

    if (result.rows.length === 0) {
      return { valid: false, error: 'Invalid referral code' };
    }

    return { valid: true, referralCode: result.rows[0] };
  }

  /**
   * Redeem referral code
   */
  async redeemReferralCode(redeemData: RedeemReferralCodeDto): Promise<{
    success: boolean;
    welcomeCoupon?: { id: string; code: string };
    error?: string;
  }> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Validate code
      const validation = await this.validateReferralCode(redeemData.code);
      if (!validation.valid || !validation.referralCode) {
        return { success: false, error: validation.error };
      }

      const referralCode = validation.referralCode;

      // Check if user already used this code
      const existingUsage = await client.query(
        'SELECT id FROM referral_redemptions WHERE user_id = $1 AND referral_code_id = $2',
        [redeemData.user_id, referralCode.id]
      );

      if (existingUsage.rows.length > 0) {
        return { success: false, error: 'Referral code already used' };
      }

      // Record redemption
      await client.query(
        `INSERT INTO referral_redemptions (
          id, referral_code_id, user_id, referrer_id, redeemed_at
        ) VALUES ($1, $2, $3, $4, NOW())`,
        [uuidv4(), referralCode.id, redeemData.user_id, referralCode.user_id]
      );

      // Update usage count
      await client.query(
        'UPDATE referral_codes SET usage_count = usage_count + 1 WHERE id = $1',
        [referralCode.id]
      );

      // Create welcome coupon for new user
      const couponCode = `WELCOME${redeemData.user_id.slice(-8).toUpperCase()}${Date.now().toString().slice(-6)}`;
      const couponResult = await client.query(
        `INSERT INTO coupons (
          id, code, name, description, discount_type, discount_value,
          minimum_order_amount, usage_limit, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id, code`,
        [
          uuidv4(),
          couponCode,
          'Welcome Gift',
          '₹100 off your first order',
          'fixed',
          100,
          0,
          1,
          true,
        ]
      );

      // Create reward coupon for referrer
      await this.createReferrerReward(referralCode.user_id);

      await client.query('COMMIT');

      return {
        success: true,
        welcomeCoupon: {
          id: couponResult.rows[0].id,
          code: couponResult.rows[0].code,
        },
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Create referrer reward coupon
   */
  private async createReferrerReward(referrerId: string): Promise<void> {
    const rewardCode = `REFREWARD${referrerId.slice(-8).toUpperCase()}`;

    // Check if reward coupon exists
    const existing = await db.query('SELECT * FROM coupons WHERE code = $1', [rewardCode]);

    if (existing.rows.length > 0) {
      // Update existing reward
      const currentCount = parseInt(existing.rows[0].description?.match(/\d+/)?.[0] || '0') + 1;
      const maxDiscount = currentCount * 100;

      await db.query(
        `UPDATE coupons
         SET description = $1, max_discount_amount = $2, updated_at = NOW()
         WHERE code = $3`,
        [
          `Referral Reward: ${currentCount} referrals - 10% off up to ₹${maxDiscount}`,
          maxDiscount,
          rewardCode,
        ]
      );
    } else {
      // Create new reward coupon
      await db.query(
        `INSERT INTO coupons (
          id, code, name, description, discount_type, discount_value,
          max_discount_amount, is_active, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          uuidv4(),
          rewardCode,
          'Referral Reward',
          'Referral Reward: 1 referral - 10% off up to ₹100',
          'percentage',
          10,
          100,
          true,
        ]
      );
    }
  }

  /**
   * Get user referral stats
   */
  async getUserReferralStats(userId: string): Promise<{
    referralCode: string;
    usageCount: number;
    totalReferrals: number;
  }> {
    const codeResult = await db.query(
      'SELECT code, usage_count FROM referral_codes WHERE user_id = $1',
      [userId]
    );

    if (codeResult.rows.length === 0) {
      throw new Error('Referral code not found');
    }

    const totalResult = await db.query(
      'SELECT COUNT(*) as total FROM referral_redemptions WHERE referrer_id = $1',
      [userId]
    );

    return {
      referralCode: codeResult.rows[0].code,
      usageCount: codeResult.rows[0].usage_count,
      totalReferrals: parseInt(totalResult.rows[0].total),
    };
  }

  /**
   * Generate unique referral code
   */
  private generateUniqueCode(userId: string): string {
    const userIdShort = userId.replace(/-/g, '').slice(0, 6).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REF${userIdShort}${random}`;
  }
}

export const referralService = new ReferralService();
export default referralService;

