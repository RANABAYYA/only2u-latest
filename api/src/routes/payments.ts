import express from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: List all payments
 *     tags: [Payments]
 *     parameters:
 *       - in: query
 *         name: invoice_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, success, failed, refunded]
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [cash, card, upi, bank_transfer, wallet]
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
 *         description: List of payments
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
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payment'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { invoice_id, status, method, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (invoice_id) {
      values.push(invoice_id);
      where += ` AND invoice_id = $${values.length}`;
    }
    if (status) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }
    if (method) {
      values.push(method);
      where += ` AND method = $${values.length}`;
    }

    values.push(Number(limit), offset);
    const { rows } = await pool.query(
      `SELECT * FROM payments ${where} ORDER BY payment_date DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM payments ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        payments: rows,
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
 * /payments/{id}:
 *   get:
 *     summary: Get payment by ID
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Payment not found' },
      });
    }
    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /payments:
 *   post:
 *     summary: Create payment
 *     tags: [Payments]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice_id
 *               - amount
 *               - method
 *             properties:
 *               invoice_id:
 *                 type: string
 *                 format: uuid
 *               payment_date:
 *                 type: string
 *                 format: date-time
 *               amount:
 *                 type: number
 *               method:
 *                 type: string
 *                 enum: [card, upi, netbanking, wallet, cod]
 *               reference:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment created
 *       400:
 *         description: Validation error or amount exceeds balance
 *       404:
 *         description: Invoice not found
 */
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { invoice_id, payment_date, amount, method, reference } = req.body;

    if (!invoice_id || !amount || !method) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'invoice_id, amount, and method are required' },
      });
    }

    await client.query('BEGIN');

    // Validate invoice exists
    const invoiceCheck = await client.query('SELECT * FROM invoices WHERE id = $1', [invoice_id]);
    if (!invoiceCheck.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Invoice not found' },
      });
    }

    const invoice = invoiceCheck.rows[0];

    // Check if payment exceeds balance
    if (amount > invoice.balance_amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        data: null,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Payment amount (${amount}) exceeds balance amount (${invoice.balance_amount})`,
        },
      });
    }

    const paymentId = uuidv4();

    // Create payment
    const paymentResult = await client.query(
      `INSERT INTO payments (id, invoice_id, payment_date, amount, method, reference, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'success')
       RETURNING *`,
      [paymentId, invoice_id, payment_date || new Date().toISOString(), amount, method, reference || null]
    );

    // Update invoice paid_amount and balance_amount
    const newPaidAmount = invoice.paid_amount + amount;
    const newBalanceAmount = invoice.total_amount - newPaidAmount;
    const newStatus = newBalanceAmount <= 0 ? 'paid' : invoice.status === 'open' ? 'partially_paid' : invoice.status;

    await client.query(
      `UPDATE invoices
       SET paid_amount = $1,
           balance_amount = $2,
           status = $3,
           updated_at = now()
       WHERE id = $4`,
      [newPaidAmount, newBalanceAmount, newStatus, invoice_id]
    );

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: paymentResult.rows[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /payments/{id}/mark-success:
 *   post:
 *     summary: Mark payment as successful
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment marked as successful
 *       404:
 *         description: Payment not found
 */
router.post('/:id/mark-success', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE payments SET status = 'success', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Payment not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /payments/{id}/mark-failed:
 *   post:
 *     summary: Mark payment as failed
 *     tags: [Payments]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Payment marked as failed
 *       404:
 *         description: Payment not found
 */
router.post('/:id/mark-failed', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE payments SET status = 'failed', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Payment not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

export default router;

