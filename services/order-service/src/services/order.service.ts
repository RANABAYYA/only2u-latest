import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Order, OrderItem, CreateOrderDto, UpdateOrderStatusDto } from '../models/order.model';

class OrderService {
  /**
   * Create new order
   */
  async createOrder(orderData: CreateOrderDto): Promise<Order> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Generate order number
      const orderNumber = await this.generateOrderNumber();

      const orderId = uuidv4();
      const now = new Date();

      // Create order
      const orderResult = await client.query(
        `INSERT INTO orders (
          id, user_id, order_number, status, payment_status, payment_method, payment_id,
          subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
          shipping_address, billing_address, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *`,
        [
          orderId,
          orderData.user_id,
          orderNumber,
          orderData.status || 'pending',
          orderData.payment_status || 'pending',
          orderData.payment_method || null,
          orderData.payment_id || null,
          orderData.subtotal,
          orderData.tax_amount || 0,
          orderData.shipping_amount || 0,
          orderData.discount_amount || 0,
          orderData.total_amount,
          JSON.stringify(orderData.shipping_address),
          orderData.billing_address ? JSON.stringify(orderData.billing_address) : null,
          orderData.notes || null,
          now,
          now,
        ]
      );

      // Create order items
      if (orderData.items && orderData.items.length > 0) {
        for (const item of orderData.items) {
          await client.query(
            `INSERT INTO order_items (
              id, order_id, product_id, variant_id, product_name, product_sku,
              product_image, size, color, quantity, unit_price, total_price, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              uuidv4(),
              orderId,
              item.product_id,
              item.variant_id || null,
              item.product_name,
              item.product_sku || null,
              item.product_image || null,
              item.size || null,
              item.color || null,
              item.quantity,
              item.unit_price,
              item.total_price,
              now,
            ]
          );
        }
      }

      await client.query('COMMIT');

      // Get full order with items
      const fullOrder = await this.getOrderById(orderId);
      return fullOrder!;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<Order | null> {
    const orderResult = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderResult.rows.length === 0) {
      return null;
    }

    const order = orderResult.rows[0];
    const itemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);

    return {
      ...order,
      shipping_address: typeof order.shipping_address === 'string' 
        ? JSON.parse(order.shipping_address) 
        : order.shipping_address,
      billing_address: order.billing_address 
        ? (typeof order.billing_address === 'string' 
          ? JSON.parse(order.billing_address) 
          : order.billing_address)
        : null,
      items: itemsResult.rows,
    };
  }

  /**
   * Get user orders
   */
  async getUserOrders(userId: string, page: number = 1, limit: number = 20): Promise<{
    orders: Order[];
    total: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    const countResult = await db.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [userId]
    );
    const total = parseInt(countResult.rows[0].count);

    const ordersResult = await db.query(
      `SELECT * FROM orders 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    const orders = await Promise.all(
      ordersResult.rows.map(async (order) => {
        const itemsResult = await db.query(
          'SELECT * FROM order_items WHERE order_id = $1',
          [order.id]
        );
        return {
          ...order,
          shipping_address: typeof order.shipping_address === 'string' 
            ? JSON.parse(order.shipping_address) 
            : order.shipping_address,
          billing_address: order.billing_address 
            ? (typeof order.billing_address === 'string' 
              ? JSON.parse(order.billing_address) 
              : order.billing_address)
            : null,
          items: itemsResult.rows,
        };
      })
    );

    return { orders, total, page, limit };
  }

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, statusData: UpdateOrderStatusDto): Promise<Order> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (statusData.status) {
      fields.push(`status = $${paramCount++}`);
      values.push(statusData.status);
    }

    if (statusData.payment_status) {
      fields.push(`payment_status = $${paramCount++}`);
      values.push(statusData.payment_status);
    }

    if (statusData.tracking_number) {
      fields.push(`tracking_number = $${paramCount++}`);
      values.push(statusData.tracking_number);
    }

    if (statusData.shipped_at) {
      fields.push(`shipped_at = $${paramCount++}`);
      values.push(statusData.shipped_at);
    }

    if (statusData.delivered_at) {
      fields.push(`delivered_at = $${paramCount++}`);
      values.push(statusData.delivered_at);
    }

    fields.push(`updated_at = NOW()`);
    values.push(orderId);

    const query = `UPDATE orders SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
    const result = await db.query(query, values);

    return await this.getOrderById(orderId)!;
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `ORD${timestamp}${random}`;
  }
}

export const orderService = new OrderService();
export default orderService;

