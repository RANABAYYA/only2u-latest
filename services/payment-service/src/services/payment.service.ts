import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Payment, CreatePaymentDto, VerifyPaymentDto, RefundDto } from '../models/payment.model';

class PaymentService {
  private razorpay: Razorpay;

  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID || '',
      key_secret: process.env.RAZORPAY_KEY_SECRET || '',
    });
  }

  /**
   * Create Razorpay order
   */
  async createOrder(amount: number, currency: string = 'INR', receipt?: string): Promise<{
    id: string;
    amount: number;
    currency: string;
    receipt: string;
    status: string;
  }> {
    try {
      const options = {
        amount: Math.round(amount * 100), // Convert to paise
        currency: currency,
        receipt: receipt || `receipt_${Date.now()}_${uuidv4().substring(0, 8)}`,
      };

      const order = await this.razorpay.orders.create(options);

      return {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
      };
    } catch (error: any) {
      throw new Error(`Failed to create Razorpay order: ${error.message}`);
    }
  }

  /**
   * Verify payment signature
   */
  verifyPaymentSignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): boolean {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || '';

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    return generatedSignature === razorpaySignature;
  }

  /**
   * Create payment record
   */
  async createPayment(paymentData: CreatePaymentDto): Promise<Payment> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const id = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO payments (
          id, order_id, user_id, amount, currency, payment_method, payment_gateway,
          payment_id, payment_status, razorpay_order_id, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          id,
          paymentData.order_id,
          paymentData.user_id,
          paymentData.amount,
          paymentData.currency || 'INR',
          paymentData.payment_method,
          'razorpay',
          paymentData.payment_id || null,
          paymentData.payment_status || 'pending',
          paymentData.razorpay_order_id || null,
          paymentData.metadata ? JSON.stringify(paymentData.metadata) : null,
          now,
          now,
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Verify and update payment
   */
  async verifyPayment(verifyData: VerifyPaymentDto): Promise<Payment> {
    const isValid = this.verifyPaymentSignature(
      verifyData.razorpay_order_id,
      verifyData.razorpay_payment_id,
      verifyData.razorpay_signature
    );

    if (!isValid) {
      throw new Error('Invalid payment signature');
    }

    // Update payment status
    const result = await db.query(
      `UPDATE payments 
       SET payment_status = 'paid', 
           payment_id = $1,
           updated_at = NOW()
       WHERE razorpay_order_id = $2
       RETURNING *`,
      [verifyData.razorpay_payment_id, verifyData.razorpay_order_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Payment record not found');
    }

    return result.rows[0];
  }

  /**
   * Process refund
   */
  async processRefund(refundData: RefundDto): Promise<Payment> {
    try {
      // Create refund via Razorpay
      const refund = await this.razorpay.payments.refund(refundData.payment_id, {
        amount: Math.round(refundData.amount * 100), // Convert to paise
        notes: refundData.notes || {},
      });

      // Update payment record
      const result = await db.query(
        `UPDATE payments 
         SET payment_status = 'refunded',
             refund_id = $1,
             refund_amount = $2,
             updated_at = NOW()
         WHERE payment_id = $3
         RETURNING *`,
        [refund.id, refundData.amount, refundData.payment_id]
      );

      // Create refund record
      await db.query(
        `INSERT INTO refunds (
          id, payment_id, order_id, amount, reason, status, refund_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          uuidv4(),
          refundData.payment_id,
          refundData.order_id,
          refundData.amount,
          refundData.reason || 'Customer request',
          'processed',
          refund.id,
        ]
      );

      return result.rows[0];
    } catch (error: any) {
      throw new Error(`Failed to process refund: ${error.message}`);
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    const result = await db.query('SELECT * FROM payments WHERE id = $1', [paymentId]);
    return result.rows[0] || null;
  }

  /**
   * Get payments by order ID
   */
  async getPaymentsByOrderId(orderId: string): Promise<Payment[]> {
    const result = await db.query(
      'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC',
      [orderId]
    );
    return result.rows;
  }

  /**
   * Handle webhook
   */
  async handleWebhook(event: string, payload: any): Promise<void> {
    // Verify webhook signature
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = payload.signature || '';

    const text = JSON.stringify(payload);
    const generatedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== signature) {
      throw new Error('Invalid webhook signature');
    }

    // Handle different event types
    switch (event) {
      case 'payment.captured':
        await this.updatePaymentStatus(payload.payment.entity.id, 'paid');
        break;
      case 'payment.failed':
        await this.updatePaymentStatus(payload.payment.entity.id, 'failed');
        break;
      case 'refund.created':
        await this.updatePaymentStatus(payload.payment.entity.id, 'refunded');
        break;
      default:
        console.log(`Unhandled webhook event: ${event}`);
    }
  }

  private async updatePaymentStatus(paymentId: string, status: string): Promise<void> {
    await db.query(
      'UPDATE payments SET payment_status = $1, updated_at = NOW() WHERE payment_id = $2',
      [status, paymentId]
    );
  }
}

export const paymentService = new PaymentService();
export default paymentService;

