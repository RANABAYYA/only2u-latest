import express from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: List all invoices
 *     tags: [Invoices]
 *     parameters:
 *       - in: query
 *         name: customer_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, paid, partially_paid, cancelled, refunded]
 *       - in: query
 *         name: from_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: to_date
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: List of invoices
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoices:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Invoice'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { user_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (user_id) {
      values.push(user_id);
      where += ` AND o.user_id = $${values.length}`;
    }
    if (status) {
      values.push(status);
      where += ` AND o.status = $${values.length}`;
    }
    if (from_date) {
      values.push(from_date);
      where += ` AND o.created_at >= $${values.length}`;
    }
    if (to_date) {
      values.push(to_date);
      where += ` AND o.created_at <= $${values.length}`;
    }

    values.push(Number(limit), offset);
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.payment_method,
        o.payment_status,
        o.payment_id,
        o.total_amount,
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.shipping_amount,
        o.shipping_address,
        o.user_id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.is_reseller_order
      FROM orders o
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${values.length - 1} OFFSET $${values.length}
    `;

    const { rows: orders } = await pool.query(ordersQuery, values);

    // Fetch order items for each order and transform to invoice format
    const invoices = await Promise.all(
      orders.map(async (order) => {
        // Fetch order items
        const itemsResult = await pool.query(
          `SELECT 
            oi.id,
            oi.product_id,
            oi.product_name,
            oi.product_image,
            oi.quantity,
            oi.unit_price,
            oi.total_price,
            oi.size,
            oi.color
          FROM order_items oi
          WHERE oi.order_id = $1`,
          [order.id]
        );

        // Transform order_items to invoice_lines format
        const invoice_lines = itemsResult.rows.map((item: any) => ({
          product_code: item.product_id || 'N/A',
          product_name: item.product_name || 'Unknown Product',
          quantity: item.quantity || 1,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: 0,
          tax: 0,
          subtotal: parseFloat(item.total_price) || (parseFloat(item.unit_price) * item.quantity),
        }));

        // Determine invoice type based on order
        const invoiceType = order.is_reseller_order ? 'B2B' : 'B2C';

        // Map payment method
        const paymentModeMap: Record<string, string> = {
          'cod': 'COD',
          'upi': 'UPI',
          'card': 'Card',
          'netbanking': 'NEFT',
          'wallet': 'Wallet',
          'razorpay': 'Online',
        };
        const paymentMode = paymentModeMap[order.payment_method?.toLowerCase()] || order.payment_method || 'COD';

        // Extract state from shipping address for place_of_supply
        const addressParts = order.shipping_address?.split(',') || [];
        const state = addressParts.length > 2 ? addressParts[addressParts.length - 2]?.trim() : 'Telangana';

        return {
          id: order.id,
          invoice_no: order.order_number,
          invoice_date: order.created_at,
          invoice_type: invoiceType,
          supply_type: 'IntraState',
          transaction_type: 'Sale',
          place_of_supply: state,
          place_of_delivery: state,
          payment_mode: paymentMode,
          payment_transaction_id: order.payment_id || null,
          payment_date_time: order.payment_status === 'paid' ? order.created_at : null,
          partner_id: order.user_id,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          customer_phone: order.customer_phone,
          shipping_address: order.shipping_address,
          status: order.status,
          payment_status: order.payment_status,
          subtotal: parseFloat(order.subtotal) || 0,
          discount_amount: parseFloat(order.discount_amount) || 0,
          tax_amount: parseFloat(order.tax_amount) || 0,
          shipping_amount: parseFloat(order.shipping_amount) || 0,
          total_amount: parseFloat(order.total_amount) || 0,
          is_reseller_order: order.is_reseller_order,
          invoice_lines: invoice_lines,
        };
      })
    );

    // Get total count
    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM orders o ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        invoices: invoices,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
      error: null,
    });
  } catch (err) {
    const code = (err as any)?.code;
    if (code === '42P01' || code === '42703') {
      return res.json({
        success: true,
        data: {
          invoices: [],
          pagination: {
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 50,
            total: 0,
            totalPages: 0,
          },
        },
        error: null,
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice by ID with items
 *     tags: [Invoices]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Invoice with items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoice:
 *                       $ref: '#/components/schemas/Invoice'
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/InvoiceItem'
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    // Fetch order by ID
    const orderResult = await pool.query(
      `SELECT 
        o.id,
        o.order_number,
        o.created_at,
        o.status,
        o.payment_method,
        o.payment_status,
        o.payment_id,
        o.total_amount,
        o.subtotal,
        o.discount_amount,
        o.tax_amount,
        o.shipping_amount,
        o.shipping_address,
        o.user_id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.is_reseller_order
      FROM orders o
      WHERE o.id = $1`,
      [req.params.id]
    );

    if (!orderResult.rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
    }

    const order = orderResult.rows[0];

    // Fetch order items
    const itemsResult = await pool.query(
      `SELECT 
        oi.id,
        oi.product_id,
        oi.product_name,
        oi.product_image,
        oi.quantity,
        oi.unit_price,
        oi.total_price,
        oi.size,
        oi.color
      FROM order_items oi
      WHERE oi.order_id = $1`,
      [req.params.id]
    );

    // Transform order_items to invoice_lines format
    const invoice_lines = itemsResult.rows.map((item: any) => ({
      product_code: item.product_id || 'N/A',
      product_name: item.product_name || 'Unknown Product',
      quantity: item.quantity || 1,
      unit_price: parseFloat(item.unit_price) || 0,
      discount: 0,
      tax: 0,
      subtotal: parseFloat(item.total_price) || (parseFloat(item.unit_price) * item.quantity),
    }));

    // Determine invoice type
    const invoiceType = order.is_reseller_order ? 'B2B' : 'B2C';

    // Map payment method
    const paymentModeMap: Record<string, string> = {
      'cod': 'COD',
      'upi': 'UPI',
      'card': 'Card',
      'netbanking': 'NEFT',
      'wallet': 'Wallet',
      'razorpay': 'Online',
    };
    const paymentMode = paymentModeMap[order.payment_method?.toLowerCase()] || order.payment_method || 'COD';

    // Extract state from shipping address
    const addressParts = order.shipping_address?.split(',') || [];
    const state = addressParts.length > 2 ? addressParts[addressParts.length - 2]?.trim() : 'Telangana';

    const invoice = {
      id: order.id,
      invoice_no: order.order_number,
      invoice_date: order.created_at,
      invoice_type: invoiceType,
      supply_type: 'IntraState',
      transaction_type: 'Sale',
      place_of_supply: state,
      place_of_delivery: state,
      payment_mode: paymentMode,
      payment_transaction_id: order.payment_id || null,
      payment_date_time: order.payment_status === 'paid' ? order.created_at : null,
      partner_id: order.user_id,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      customer_phone: order.customer_phone,
      shipping_address: order.shipping_address,
      status: order.status,
      payment_status: order.payment_status,
      subtotal: parseFloat(order.subtotal) || 0,
      discount_amount: parseFloat(order.discount_amount) || 0,
      tax_amount: parseFloat(order.tax_amount) || 0,
      shipping_amount: parseFloat(order.shipping_amount) || 0,
      total_amount: parseFloat(order.total_amount) || 0,
      is_reseller_order: order.is_reseller_order,
      invoice_lines: invoice_lines,
    };

    res.json({
      success: true,
      data: { invoice },
      error: null,
    });
  } catch (err) {
    const code = (err as any)?.code;
    if (code === '42P01' || code === '42703') {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Orders table not configured' },
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /invoices:
 *   post:
 *     summary: Create new invoice
 *     tags: [Invoices]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customer_id
 *               - items
 *             properties:
 *               customer_id:
 *                 type: string
 *                 format: uuid
 *               invoice_date:
 *                 type: string
 *                 format: date-time
 *               currency:
 *                 type: string
 *                 default: "INR"
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - product_id
 *                     - quantity
 *                     - unit_price
 *                   properties:
 *                     product_id:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                     unit_price:
 *                       type: number
 *                     description:
 *                       type: string
 *                     discount_amount:
 *                       type: number
 *                     tax_amount:
 *                       type: number
 *               discount_amount:
 *                 type: number
 *                 default: 0
 *               tax_amount:
 *                 type: number
 *                 default: 0
 *     responses:
 *       201:
 *         description: Invoice created
 *       400:
 *         description: Validation error or insufficient stock
 *       404:
 *         description: Customer or product not found
 */
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      customer_id,
      invoice_date,
      currency,
      items,
      discount_amount = 0,
      tax_amount = 0,
    } = req.body;

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'customer_id and items array are required' },
      });
    }

    await client.query('BEGIN');

    // Validate customer exists
    const customerCheck = await client.query('SELECT id FROM customers WHERE id = $1 AND status = $2', [
      customer_id,
      'active',
    ]);
    if (!customerCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer not found or inactive' },
      });
    }

    // Calculate totals
    let subtotal = 0;
    for (const item of items) {
      if (!item.product_id || !item.quantity || !item.unit_price) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Each item must have product_id, quantity, and unit_price' },
        });
      }

      // Check product stock
      const productCheck = await client.query('SELECT stock_quantity FROM products WHERE id = $1', [item.product_id]);
      if (!productCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: `Product ${item.product_id} not found` },
        });
      }
      if (productCheck.rows[0].stock_quantity < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: 'INSUFFICIENT_STOCK', message: `Insufficient stock for product ${item.product_id}` },
        });
      }

      subtotal += item.unit_price * item.quantity - (item.discount_amount || 0);
    }

    const total_amount = subtotal - discount_amount + tax_amount;
    const invoiceId = uuidv4();
    const invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create invoice
    const invoiceResult = await client.query(
      `INSERT INTO invoices
       (id, invoice_number, customer_id, invoice_date, currency, subtotal, discount_amount, tax_amount, total_amount, paid_amount, balance_amount)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $9)
       RETURNING *`,
      [
        invoiceId,
        invoiceNumber,
        customer_id,
        invoice_date || new Date().toISOString(),
        currency || 'INR',
        subtotal,
        discount_amount,
        tax_amount,
        total_amount,
      ]
    );

    // Insert items and update stock
    for (const item of items) {
      const lineTotal =
        item.unit_price * item.quantity - (item.discount_amount || 0) + (item.tax_amount || 0);

      await client.query(
        `INSERT INTO invoice_items
         (invoice_id, product_id, description, quantity, unit_price, discount_amount, tax_amount, line_total)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoiceId,
          item.product_id,
          item.description || null,
          item.quantity,
          item.unit_price,
          item.discount_amount || 0,
          item.tax_amount || 0,
          lineTotal,
        ]
      );

      // Update product stock
      await client.query(
        `UPDATE products
         SET stock_quantity = stock_quantity - $1,
             updated_at = now()
         WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    await client.query('COMMIT');

    // Fetch items for response
    const itemsResult = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoiceId]);

    res.status(201).json({
      success: true,
      data: {
        invoice: invoiceResult.rows[0],
        items: itemsResult.rows,
      },
      error: null,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

export default router;
