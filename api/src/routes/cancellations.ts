import express from 'express';
import { pool } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * @swagger
 * /cancellations:
 *   get:
 *     summary: List all cancellations
 *     tags: [Cancellations]
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
 *           enum: [pending, approved, rejected]
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
 *         description: List of cancellations
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
 *                     cancellations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Cancellation'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { invoice_id, status, page = 1, limit = 50 } = req.query;
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

    values.push(Number(limit), offset);
    const { rows } = await pool.query(
      `SELECT * FROM cancellations ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM cancellations ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        cancellations: rows,
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
          cancellations: [],
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
 * /cancellations/{id}:
 *   get:
 *     summary: Get cancellation by ID with items
 *     tags: [Cancellations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cancellation with items
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
 *                     cancellation:
 *                       $ref: '#/components/schemas/Cancellation'
 *                     items:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/CancellationItem'
 *       404:
 *         description: Cancellation not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const cancellationResult = await pool.query('SELECT * FROM cancellations WHERE id = $1', [req.params.id]);
    if (!cancellationResult.rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Cancellation not found' },
      });
    }

    const itemsResult = await pool.query(
      'SELECT * FROM cancellation_items WHERE cancellation_id = $1',
      [req.params.id]
    );

    res.json({
      success: true,
      data: {
        cancellation: cancellationResult.rows[0],
        items: itemsResult.rows,
      },
      error: null,
    });
  } catch (err) {
    const code = (err as any)?.code;
    if (code === '42P01') {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_CONFIGURED', message: 'Cancellations table not configured' },
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /cancellations:
 *   post:
 *     summary: Create cancellation
 *     tags: [Cancellations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - invoice_id
 *               - cancel_type
 *             properties:
 *               invoice_id:
 *                 type: string
 *                 format: uuid
 *               cancel_type:
 *                 type: string
 *                 enum: [full, partial]
 *               reason:
 *                 type: string
 *               items:
 *                 type: array
 *                 description: Required for partial cancellations
 *                 items:
 *                   type: object
 *                   required:
 *                     - invoice_item_id
 *                     - quantity
 *                   properties:
 *                     invoice_item_id:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *     responses:
 *       201:
 *         description: Cancellation created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Invoice not found
 */
router.post('/', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { invoice_id, cancel_type, reason, items } = req.body;

    if (!invoice_id || !cancel_type) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'invoice_id and cancel_type are required' },
      });
    }

    if (cancel_type !== 'full' && cancel_type !== 'partial') {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'cancel_type must be "full" or "partial"' },
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

    const cancellationId = uuidv4();

    // Create cancellation
    const cancellationResult = await client.query(
      `INSERT INTO cancellations (id, invoice_id, cancel_type, reason, status)
       VALUES ($1, $2, $3, $4, 'approved')
       RETURNING *`,
      [cancellationId, invoice_id, cancel_type, reason || null]
    );

    // Handle partial cancellation items
    if (cancel_type === 'partial' && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.invoice_item_id || !item.quantity) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            data: null,
            error: { code: 'VALIDATION_ERROR', message: 'Each item must have invoice_item_id and quantity' },
          });
        }

        await client.query(
          `INSERT INTO cancellation_items (cancellation_id, invoice_item_id, quantity)
           VALUES ($1, $2, $3)`,
          [cancellationId, item.invoice_item_id, item.quantity]
        );

        // Restock product
        const itemCheck = await client.query('SELECT product_id, quantity FROM invoice_items WHERE id = $1', [
          item.invoice_item_id,
        ]);
        if (itemCheck.rows[0]) {
          await client.query(
            `UPDATE products
             SET stock_quantity = stock_quantity + $1,
                 updated_at = now()
             WHERE id = $2`,
            [item.quantity, itemCheck.rows[0].product_id]
          );
        }
      }
    } else if (cancel_type === 'full') {
      // Restock all items
      const invoiceItems = await client.query('SELECT product_id, quantity FROM invoice_items WHERE invoice_id = $1', [
        invoice_id,
      ]);
      for (const item of invoiceItems.rows) {
        await client.query(
          `UPDATE products
           SET stock_quantity = stock_quantity + $1,
               updated_at = now()
           WHERE id = $2`,
          [item.quantity, item.product_id]
        );
      }

      // Update invoice status
      await client.query(`UPDATE invoices SET status = 'cancelled', updated_at = now() WHERE id = $1`, [invoice_id]);
    }

    await client.query('COMMIT');

    // Fetch items if partial
    let itemsResult = { rows: [] };
    if (cancel_type === 'partial') {
      itemsResult = await client.query('SELECT * FROM cancellation_items WHERE cancellation_id = $1', [cancellationId]);
    }

    res.status(201).json({
      success: true,
      data: {
        cancellation: cancellationResult.rows[0],
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

/**
 * @swagger
 * /cancellations/{id}/approve:
 *   post:
 *     summary: Approve cancellation
 *     tags: [Cancellations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cancellation approved
 *       404:
 *         description: Cancellation not found
 */
router.post('/:id/approve', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE cancellations
       SET status = 'approved',
           approved_at = now()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Cancellation not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /cancellations/{id}/reject:
 *   post:
 *     summary: Reject cancellation
 *     tags: [Cancellations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Cancellation rejected
 *       404:
 *         description: Cancellation not found
 */
router.post('/:id/reject', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE cancellations SET status = 'rejected' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Cancellation not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

export default router;
