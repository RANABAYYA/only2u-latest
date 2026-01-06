import express from 'express';
import { pool } from '../config/database';
import { formatDate } from '../utils/formatters';

const router = express.Router();

/**
 * @swagger
 * /orders:
 *   get:
 *     summary: List orders
 *     tags: [Orders]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search by order number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by order status
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user UUID
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Created at from (ISO)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Created at to (ISO)
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
 *         description: List of orders with pagination
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
 *                     orders:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Order'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, status, user_id, from, to, page = 1, limit = 50 } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }
    if (user_id) {
      values.push(user_id);
      where += ` AND user_id = $${values.length}`;
    }
    if (from) {
      values.push(new Date(from));
      where += ` AND created_at >= $${values.length}`;
    }
    if (to) {
      values.push(new Date(to));
      where += ` AND created_at <= $${values.length}`;
    }
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (order_number ILIKE $${values.length})`;
    }

    values.push(Number(limit), offset);



    const { rows } = await pool.query(
      `SELECT * FROM orders ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const customersCache: Record<string, any> = {};

    const enrichedOrders = await Promise.all(rows.map(async (order: any) => {
      // Fetch order lines
      const itemsRes = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
      const orderLines = itemsRes.rows.map((item: any) => ({
        product_code: item.product_sku || 'N/A',
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        discount: 0.00, // Not tracked per line currently
        tax: 0.00, // Not tracked per line currently
        subtotal: Number(item.total_price)
      }));

      // Fetch customer details if available (or use metadata in order)
      let customerData = {
        customer_id: order.user_id,
        name: order.customer_name || 'Guest',
        phone: order.customer_phone || '',
        email: order.customer_email || '',
        billing_address: order.billing_address || {
          street: "", city: "", state: "", zip: "", country: ""
        },
        shipping_address: order.shipping_address || {
          street: "", city: "", state: "", zip: "", country: ""
        }
      };

      // Try to get more user details from users table if not fully populated in order meta
      if (order.user_id && !customersCache[order.user_id]) {
        const userRes = await pool.query('SELECT name, email, phone, location FROM users WHERE id = $1', [order.user_id]);
        if (userRes.rows[0]) {
          customersCache[order.user_id] = userRes.rows[0];
        }
      }

      if (customersCache[order.user_id]) {
        const u = customersCache[order.user_id];
        // Fallback if order meta is missing
        if (!customerData.name || customerData.name === 'Guest') customerData.name = u.name;
        if (!customerData.email) customerData.email = u.email;
        if (!customerData.phone) customerData.phone = u.phone;
        if (!customerData.billing_address.street && u.location) {
          const addr = { street: u.location, city: "", state: "", zip: "", country: "India" };
          customerData.billing_address = addr;
          customerData.shipping_address = addr;
        }
      }

      return {
        sale_order_id: order.order_number,
        order_date: formatDate(order.created_at),
        customer: customerData,
        order_lines: orderLines,
        total_amount: Number(order.total_amount),
        currency: 'INR', // Default
        order_status: order.status
      };
    }));

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM orders ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        orders: enrichedOrders,
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
    next(err);
  }
});

/**
 * @swagger
 * /orders/{id}:
 *   get:
 *     summary: Get order by ID (with items)
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Order details with items
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
 *                     order:
 *                       $ref: '#/components/schemas/Order'
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/OrderItem'
 *       404:
 *         description: Order not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = req.params.id;
    const orderResult = await pool.query('SELECT * FROM orders WHERE id = $1', [id]);
    if (!orderResult.rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json({
      success: true,
      data: {
        order: orderResult.rows[0],
        items: itemsResult.rows,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});


/**
 * @swagger
 * /orders/{id}/items:
 *   get:
 *     summary: List order items for an order
 *     tags: [Orders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of order items
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/OrderItem'
 */
router.get('/:id/items', async (req, res, next) => {
  try {
    const id = req.params.id;
    const { rows } = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at DESC',
      [id]
    );
    res.json({ success: true, data: rows, error: null });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const {
      user_id,
      status,
      payment_status,
      payment_method,
      subtotal,
      tax_amount,
      shipping_amount,
      discount_amount,
      total_amount,
      shipping_address,
      billing_address,
      customer_name,
      customer_email,
      customer_phone,
      notes,
      items,
    } = req.body;

    if (!user_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'user_id and at least one item are required' },
      });
    }

    await client.query('BEGIN');

    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 999) + 1).padStart(3, '0')}`;

    const insertOrder = await client.query(
      `INSERT INTO orders (
        user_id, order_number, status, payment_status, payment_method,
        subtotal, tax_amount, shipping_amount, discount_amount, total_amount,
        shipping_address, billing_address,
        customer_name, customer_email, customer_phone,
        notes
      ) VALUES (
        $1, $2, COALESCE($3, 'pending'), COALESCE($4, 'pending'), $5,
        COALESCE($6, 0), COALESCE($7, 0), COALESCE($8, 0), COALESCE($9, 0), COALESCE($10, 0),
        $11, $12,
        $13, $14, $15,
        $16
      ) RETURNING *`,
      [
        user_id,
        orderNumber,
        status,
        payment_status,
        payment_method || 'cod',
        subtotal,
        tax_amount,
        shipping_amount,
        discount_amount,
        total_amount,
        shipping_address || null,
        billing_address || null,
        customer_name || null,
        customer_email || null,
        customer_phone || null,
        notes || null,
      ]
    );

    const order = insertOrder.rows[0];

    for (const item of items) {
      const {
        product_id,
        product_name,
        product_sku,
        product_image,
        size,
        color,
        quantity,
        unit_price,
        total_price,
      } = item;

      if (!product_name || !quantity || unit_price === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: { code: 'VALIDATION_ERROR', message: 'Each item requires product_name, quantity, unit_price' },
        });
      }

      await client.query(
        `INSERT INTO order_items (
          order_id, product_id, product_name, product_sku, product_image,
          size, color, quantity, unit_price, total_price
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8::int, $9::numeric, COALESCE($10::numeric, ($9::numeric * $8::int))
        )`,
        [
          order.id,
          product_id || null,
          product_name,
          product_sku || null,
          product_image || null,
          size || null,
          color || null,
          Number(quantity),
          Number(unit_price),
          total_price !== undefined ? Number(total_price) : null,
        ]
      );
    }

    await client.query('COMMIT');

    const itemsResult = await pool.query(
      'SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at DESC',
      [order.id]
    );

    res.status(201).json({
      success: true,
      data: {
        order,
        items: itemsResult.rows,
      },
      error: null,
    });
  } catch (err: any) {
    await client.query('ROLLBACK');
    const code = err?.code;
    if (code === '42P01') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Orders or order_items table not configured' },
      });
    }
    next(err);
  } finally {
    client.release();
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { status, payment_status, payment_method, shipping_address, billing_address, notes, tracking_number } = req.body;
    const { rows } = await pool.query(
      `UPDATE orders
       SET status = COALESCE($1, status),
           payment_status = COALESCE($2, payment_status),
           payment_method = COALESCE($3, payment_method),
           shipping_address = COALESCE($4, shipping_address),
           billing_address = COALESCE($5, billing_address),
           notes = COALESCE($6, notes),
           tracking_number = COALESCE($7, tracking_number),
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [status, payment_status, payment_method, shipping_address, billing_address, notes, tracking_number, req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }
    res.json({ success: true, data: rows[0], error: null });
  } catch (err: any) {
    const code = err?.code;
    if (code === '42P01') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Orders table not configured' },
      });
    }
    next(err);
  }
});

export default router;
