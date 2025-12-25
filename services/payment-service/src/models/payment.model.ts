export interface Payment {
  id: string;
  order_id: string;
  user_id: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_gateway: string;
  payment_id?: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
  razorpay_order_id?: string;
  refund_id?: string;
  refund_amount?: number;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePaymentDto {
  order_id: string;
  user_id: string;
  amount: number;
  currency?: string;
  payment_method: string;
  payment_id?: string;
  payment_status?: string;
  razorpay_order_id?: string;
  metadata?: any;
}

export interface VerifyPaymentDto {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RefundDto {
  payment_id: string;
  order_id: string;
  amount: number;
  reason?: string;
  notes?: Record<string, string>;
}

