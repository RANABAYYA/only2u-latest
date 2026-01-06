import express from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';
import { formatDate } from '../utils/formatters';

const router = express.Router();

/**
 * @swagger
 * /refunds:
 *   get:
 *     summary: List all refunds
 *     tags: [Refunds]
 *     parameters:
 *       - in: query
 *         name: invoice_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: payment_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: cancellation_id
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processed, failed]
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
 *         description: List of refunds
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
 *                     refunds:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Refund'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { invoice_id, payment_id, cancellation_id, status, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (invoice_id) {
      values.push(invoice_id);
      where += ` AND invoice_id = $${values.length}`;
    }
    if (payment_id) {
      values.push(payment_id);
      where += ` AND payment_id = $${values.length}`;
    }
    if (cancellation_id) {
      values.push(cancellation_id);
      where += ` AND cancellation_id = $${values.length}`;
    }
    if (status) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }

    values.push(Number(limit), offset);


    const { rows } = await pool.query(
      `SELECT * FROM refunds ${where} ORDER BY refund_date DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const mapped = rows.map((r: any) => ({
      ...r,
      refund_date: formatDate(r.refund_date),
    }));

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM refunds ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        refunds: mapped,
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
          refunds: [],
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
 * /refunds/{id}:
 *   get:
 *     summary: Get refund by ID
 *     tags: [Refunds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Refund details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Refund'
 *       404:
 *         description: Refund not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM refunds WHERE id = $1', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Refund not found' },
      });
    }
    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    const code = (err as any)?.code;
    if (code === '42P01') {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Refunds table not configured' },
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /refunds:
 *   post:
 *     summary: Create refund
 *     tags: [Refunds]
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
 *               cancellation_id:
 *                 type: string
 *                 format: uuid
 *               payment_id:
 *                 type: string
 *                 format: uuid
 *               refund_date:
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
 *         description: Refund created
 *       400:
 *         description: Validation error or refund amount exceeds payment
 *       404:
 *         description: Invoice, payment, or cancellation not found
 */
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { invoice_id, cancellation_id, payment_id, refund_date, amount, method, reference } = req.body;

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

    // If payment_id provided, validate it
    if (payment_id) {
      const paymentCheck = await client.query('SELECT * FROM payments WHERE id = $1 AND invoice_id = $2', [
        payment_id,
        invoice_id,
      ]);
      if (!paymentCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Payment not found or does not belong to this invoice' },
        });
      }

      // Check if refund amount exceeds payment amount
      const totalRefunds = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = $1`,
        [payment_id]
      );
      const refundedAmount = parseFloat(totalRefunds.rows[0].total);
      if (refundedAmount + amount > paymentCheck.rows[0].amount) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          data: null,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Refund amount exceeds payment amount. Already refunded: ${refundedAmount}, Payment: ${paymentCheck.rows[0].amount}`,
          },
        });
      }
    }

    // If cancellation_id provided, validate it
    if (cancellation_id) {
      const cancellationCheck = await client.query('SELECT * FROM cancellations WHERE id = $1 AND invoice_id = $2', [
        cancellation_id,
        invoice_id,
      ]);
      if (!cancellationCheck.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          data: null,
          error: { code: 'NOT_FOUND', message: 'Cancellation not found or does not belong to this invoice' },
        });
      }
    }

    const refundId = uuidv4();

    // Create refund
    const refundResult = await client.query(
      `INSERT INTO refunds
       (id, invoice_id, cancellation_id, payment_id, refund_date, amount, method, reference, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processed')
       RETURNING *`,
      [
        refundId,
        invoice_id,
        cancellation_id || null,
        payment_id || null,
        refund_date || new Date().toISOString(),
        amount,
        method,
        reference || null,
      ]
    );

    // Update payment status if fully refunded
    if (payment_id) {
      const totalRefunds = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM refunds WHERE payment_id = $1`,
        [payment_id]
      );
      const refundedAmount = parseFloat(totalRefunds.rows[0].total);
      const paymentCheck = await client.query('SELECT amount FROM payments WHERE id = $1', [payment_id]);
      if (paymentCheck.rows[0] && refundedAmount >= paymentCheck.rows[0].amount) {
        await client.query(`UPDATE payments SET status = 'refunded', updated_at = now() WHERE id = $1`, [payment_id]);
      }
    }

    // Update invoice status if fully cancelled and refunded
    const invoice = invoiceCheck.rows[0];
    if (invoice.status === 'cancelled' && invoice.paid_amount <= amount) {
      await client.query(`UPDATE invoices SET status = 'refunded', updated_at = now() WHERE id = $1`, [invoice_id]);
    }

    await client.query('COMMIT');

    res.status(201).json({ success: true, data: refundResult.rows[0], error: null });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

/**
 * @swagger
 * /refunds/{id}/mark-failed:
 *   post:
 *     summary: Mark refund as failed
 *     tags: [Refunds]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Refund marked as failed
 *       404:
 *         description: Refund not found
 */
router.post('/:id/mark-failed', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE refunds SET status = 'failed', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Refund not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
