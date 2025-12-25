import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Coupon, CreateCouponDto, ValidateCouponDto } from '../models/coupon.model';

class CouponService {
  /**
   * Get available coupons
   */
  async getAvailableCoupons(userId?: string): Promise<Coupon[]> {
    const now = new Date();

    let query = `SELECT * FROM coupons
                 WHERE is_active = true
                 AND (valid_from IS NULL OR valid_from <= $1)
                 AND (valid_until IS NULL OR valid_until >= $1)
                 AND (usage_limit IS NULL OR usage_count < usage_limit)`;

    const params: any[] = [now];

    if (userId) {
      // Check if user has already used this coupon
      query += ` AND id NOT IN (
        SELECT DISTINCT coupon_id FROM coupon_redemptions
        WHERE user_id = $2 AND coupon_id IS NOT NULL
      )`;
      params.push(userId);
    }

    query += ' ORDER BY discount_percentage DESC, created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get coupon by code
   */
  async getCouponByCode(code: string): Promise<Coupon | null> {
    const result = await db.query(
      `SELECT * FROM coupons WHERE code = $1 AND is_active = true`,
      [code.toUpperCase()]
    );

    return result.rows[0] || null;
  }

  /**
   * Validate coupon
   */
  async validateCoupon(validateData: ValidateCouponDto): Promise<{
    valid: boolean;
    coupon?: Coupon;
    discount_amount?: number;
    error?: string;
  }> {
    const coupon = await this.getCouponByCode(validateData.code);

    if (!coupon) {
      return { valid: false, error: 'Invalid coupon code' };
    }

    const now = new Date();

    // Check validity dates
    if (coupon.valid_from && coupon.valid_from > now) {
      return { valid: false, error: 'Coupon not yet valid' };
    }

    if (coupon.valid_until && coupon.valid_until < now) {
      return { valid: false, error: 'Coupon has expired' };
    }

    // Check usage limit
    if (coupon.usage_limit && coupon.usage_count >= coupon.usage_limit) {
      return { valid: false, error: 'Coupon usage limit reached' };
    }

    // Check minimum order amount
    if (coupon.minimum_order_amount && validateData.order_amount < coupon.minimum_order_amount) {
      return {
        valid: false,
        error: `Minimum order amount of ₹${coupon.minimum_order_amount} required`,
      };
    }

    // Check if user already used this coupon
    if (validateData.user_id) {
      const redemption = await db.query(
        'SELECT id FROM coupon_redemptions WHERE user_id = $1 AND coupon_id = $2',
        [validateData.user_id, coupon.id]
      );

      if (redemption.rows.length > 0 && !coupon.allow_multiple_use) {
        return { valid: false, error: 'Coupon already used' };
      }
    }

    // Calculate discount amount
    let discount_amount = 0;
    if (coupon.discount_type === 'percentage') {
      discount_amount = (validateData.order_amount * coupon.discount_value) / 100;
      if (coupon.max_discount_amount) {
        discount_amount = Math.min(discount_amount, coupon.max_discount_amount);
      }
    } else {
      discount_amount = coupon.discount_value;
    }

    return {
      valid: true,
      coupon,
      discount_amount: Math.round(discount_amount * 100) / 100,
    };
  }

  /**
   * Redeem coupon
   */
  async redeemCoupon(
    userId: string,
    couponId: string,
    orderId: string,
    discountAmount: number
  ): Promise<void> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Record redemption
      await client.query(
        `INSERT INTO coupon_redemptions (
          id, coupon_id, user_id, order_id, discount_amount, redeemed_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())`,
        [uuidv4(), couponId, userId, orderId, discountAmount]
      );

      // Update coupon usage count
      await client.query(
        'UPDATE coupons SET usage_count = usage_count + 1 WHERE id = $1',
        [couponId]
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create coupon
   */
  async createCoupon(couponData: CreateCouponDto): Promise<Coupon> {
    const id = uuidv4();
    const code = couponData.code?.toUpperCase() || this.generateCouponCode();

    const result = await db.query(
      `INSERT INTO coupons (
        id, code, name, description, discount_type, discount_value,
        max_discount_amount, minimum_order_amount, valid_from, valid_until,
        usage_limit, allow_multiple_use, is_active, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *`,
      [
        id,
        code,
        couponData.name,
        couponData.description || null,
        couponData.discount_type,
        couponData.discount_value,
        couponData.max_discount_amount || null,
        couponData.minimum_order_amount || null,
        couponData.valid_from || null,
        couponData.valid_until || null,
        couponData.usage_limit || null,
        couponData.allow_multiple_use || false,
        couponData.is_active !== false,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get user coupons
   */
  async getUserCoupons(userId: string): Promise<any[]> {
    const result = await db.query(
      `SELECT c.*, cr.redeemed_at, cr.order_id, cr.discount_amount
       FROM coupons c
       JOIN coupon_redemptions cr ON cr.coupon_id = c.id
       WHERE cr.user_id = $1
       ORDER BY cr.redeemed_at DESC`,
      [userId]
    );

    return result.rows;
  }

  /**
   * Generate random coupon code
   */
  private generateCouponCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }
}

export const couponService = new CouponService();
export default couponService;

