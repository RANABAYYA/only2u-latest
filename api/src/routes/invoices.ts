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
    const { customer_id, status, from_date, to_date, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (customer_id) {
      values.push(customer_id);
      where += ` AND customer_id = $${values.length}`;
    }
    if (status) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }
    if (from_date) {
      values.push(from_date);
      where += ` AND invoice_date >= $${values.length}`;
    }
    if (to_date) {
      values.push(to_date);
      where += ` AND invoice_date <= $${values.length}`;
    }

    values.push(Number(limit), offset);
    const { rows } = await pool.query(
      `SELECT * FROM invoices ${where} ORDER BY invoice_date DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    // Fetch invoice lines for each invoice
    const invoicesWithLines = await Promise.all(
      rows.map(async (invoice) => {
        // Fetch invoice items with product details
        const itemsResult = await pool.query(
          `SELECT 
            ii.*,
            p.sku as product_code,
            p.name as product_name
          FROM invoice_items ii
          LEFT JOIN products p ON ii.product_id = p.id
          WHERE ii.invoice_id = $1`,
          [invoice.id]
        );

        // Transform invoice_items to invoice_lines format
        const invoice_lines = itemsResult.rows.map((item: any) => ({
          product_code: item.product_code || item.product_id,
          product_name: item.product_name || item.description || 'Unknown Product',
          quantity: item.quantity,
          unit_price: parseFloat(item.unit_price) || 0,
          discount: parseFloat(item.discount_amount) || 0,
          tax: parseFloat(item.tax_amount) || 0,
          subtotal: parseFloat(item.line_total) || (item.unit_price * item.quantity - (item.discount_amount || 0) + (item.tax_amount || 0)),
        }));

        // Get partner_id from customer_id (assuming partner_id is the customer_id)
        // If partner_id is stored elsewhere, adjust this query
        const partnerIdResult = await pool.query(
          `SELECT id FROM customers WHERE id = $1`,
          [invoice.customer_id]
        );
        const partner_id = partnerIdResult.rows[0]?.id || invoice.customer_id;

        return {
          ...invoice,
          partner_id: partner_id,
          invoice_lines: invoice_lines,
        };
      })
    );

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM invoices ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        invoices: invoicesWithLines,
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
    if (code === '42P01') {
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
    const invoiceResult = await pool.query('SELECT * FROM invoices WHERE id = $1', [req.params.id]);
    if (!invoiceResult.rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
    }

    const invoice = invoiceResult.rows[0];

    // Fetch invoice items with product details
    const itemsResult = await pool.query(
      `SELECT 
        ii.*,
        p.sku as product_code,
        p.name as product_name
      FROM invoice_items ii
      LEFT JOIN products p ON ii.product_id = p.id
      WHERE ii.invoice_id = $1`,
      [req.params.id]
    );

    // Transform invoice_items to invoice_lines format
    const invoice_lines = itemsResult.rows.map((item: any) => ({
      product_code: item.product_code || item.product_id,
      product_name: item.product_name || item.description || 'Unknown Product',
      quantity: item.quantity,
      unit_price: parseFloat(item.unit_price) || 0,
      discount: parseFloat(item.discount_amount) || 0,
      tax: parseFloat(item.tax_amount) || 0,
      subtotal: parseFloat(item.line_total) || (item.unit_price * item.quantity - (item.discount_amount || 0) + (item.tax_amount || 0)),
    }));

    // Get partner_id from customer_id (assuming partner_id is the customer_id)
    const partnerIdResult = await pool.query(
      `SELECT id FROM customers WHERE id = $1`,
      [invoice.customer_id]
    );
    const partner_id = partnerIdResult.rows[0]?.id || invoice.customer_id;

    res.json({
      success: true,
      data: {
        invoice: {
          ...invoice,
          partner_id: partner_id,
          invoice_lines: invoice_lines,
        },
      },
      error: null,
    });
  } catch (err) {
    const code = (err as any)?.code;
    if (code === '42P01') {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Invoices table not configured' },
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
