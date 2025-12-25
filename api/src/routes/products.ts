import express from 'express';
import { pool } from '../config/database';

const router = express.Router();

/**
 * @swagger
 * /products:
 *   get:
 *     summary: List all products
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (name, SKU, description)
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *       - in: query
 *         name: min_price
 *         schema:
 *           type: number
 *       - in: query
 *         name: max_price
 *         schema:
 *           type: number
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
 *         description: List of products
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
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, category, status, min_price, max_price, page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      values.push(status);
      where += ` AND status = $${values.length}`;
    }
    if (category) {
      values.push(category);
      where += ` AND category = $${values.length}`;
    }
    if (min_price) {
      values.push(Number(min_price));
      where += ` AND price >= $${values.length}`;
    }
    if (max_price) {
      values.push(Number(max_price));
      where += ` AND price <= $${values.length}`;
    }
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (name ILIKE $${values.length} OR sku ILIKE $${values.length} OR description ILIKE $${values.length})`;
    }

    values.push(Number(limit), offset);
    const { rows } = await pool.query(
      `SELECT * FROM products ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM products ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        products: rows,
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
 * /products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }
    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sku
 *               - name
 *               - price
 *             properties:
 *               sku:
 *                 type: string
 *                 example: "PROD-001"
 *               name:
 *                 type: string
 *                 example: "Premium T-Shirt"
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *                 example: 999.99
 *               mrp:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: "INR"
 *               stock_quantity:
 *                 type: integer
 *                 default: 0
 *               category:
 *                 type: string
 *               image_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       201:
 *         description: Product created
 *       400:
 *         description: Validation error
 *       409:
 *         description: Duplicate SKU
 */
router.post('/', async (req, res, next) => {
  try {
    const { sku, name, description, price, mrp, currency, stock_quantity, category, image_urls } = req.body;

    if (!sku || !name || price === undefined) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'SKU, name, and price are required' },
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO products (sku, name, description, price, mrp, currency, stock_quantity, category, image_urls)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        sku,
        name,
        description || null,
        price,
        mrp || null,
        currency || 'INR',
        stock_quantity || 0,
        category || null,
        image_urls || [],
      ]
    );

    res.status(201).json({ success: true, data: rows[0], error: null });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        data: null,
        error: { code: 'DUPLICATE_ERROR', message: 'Product with this SKU already exists' },
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sku:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               mrp:
 *                 type: number
 *               currency:
 *                 type: string
 *               stock_quantity:
 *                 type: integer
 *               status:
 *                 type: string
 *               category:
 *                 type: string
 *               image_urls:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Product updated
 *       404:
 *         description: Product not found
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { sku, name, description, price, mrp, currency, stock_quantity, status, category, image_urls } = req.body;

    const { rows } = await pool.query(
      `UPDATE products
       SET sku = COALESCE($1, sku),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           price = COALESCE($4, price),
           mrp = COALESCE($5, mrp),
           currency = COALESCE($6, currency),
           stock_quantity = COALESCE($7, stock_quantity),
           status = COALESCE($8, status),
           category = COALESCE($9, category),
           image_urls = COALESCE($10, image_urls),
           updated_at = now()
       WHERE id = $11
       RETURNING *`,
      [sku, name, description, price, mrp, currency, stock_quantity, status, category, image_urls, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /products/{id}/stock:
 *   patch:
 *     summary: Update product stock
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             oneOf:
 *               - properties:
 *                   delta:
 *                     type: number
 *                     description: Change in stock (positive or negative)
 *               - properties:
 *                   stock_quantity:
 *                     type: number
 *                     description: Absolute stock quantity
 *     responses:
 *       200:
 *         description: Stock updated
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 */
router.patch('/:id/stock', async (req, res, next) => {
  try {
    const { delta, stock_quantity } = req.body;

    let query: string;
    let values: any[];

    if (typeof delta === 'number') {
      query = `UPDATE products
               SET stock_quantity = stock_quantity + $1,
                   updated_at = now()
               WHERE id = $2
               RETURNING *`;
      values = [delta, req.params.id];
    } else if (typeof stock_quantity === 'number') {
      query = `UPDATE products
               SET stock_quantity = $1,
                   updated_at = now()
               WHERE id = $2
               RETURNING *`;
      values = [stock_quantity, req.params.id];
    } else {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Either delta or stock_quantity is required' },
      });
    }

    const { rows } = await pool.query(query, values);

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     summary: Soft delete product
 *     tags: [Products]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Product soft deleted
 *       404:
 *         description: Product not found
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE products SET status = 'inactive', updated_at = now() WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    res.json({ success: true, data: rows[0], error: null });
  } catch (err) {
    next(err);
  }
});

export default router;

