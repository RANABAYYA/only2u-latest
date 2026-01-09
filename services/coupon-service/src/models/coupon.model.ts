export interface Coupon {
  id: string;
  code: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount?: number;
  minimum_order_amount?: number;
  valid_from?: Date;
  valid_until?: Date;
  usage_limit?: number;
  usage_count: number;
  allow_multiple_use: boolean;
  is_active: boolean;
  created_at: Date;
}

export interface CreateCouponDto {
  code?: string;
  name: string;
  description?: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_discount_amount?: number;
  minimum_order_amount?: number;
  valid_from?: Date;
  valid_until?: Date;
  usage_limit?: number;
  allow_multiple_use?: boolean;
  is_active?: boolean;
}

export interface ValidateCouponDto {
  code: string;
  user_id?: string;
  order_amount: number;
}

