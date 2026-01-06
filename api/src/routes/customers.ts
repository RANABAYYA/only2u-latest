import express from 'express';
import { pool } from '../config/database';
import { formatDate } from '../utils/formatters';

const router = express.Router();

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: List all customers
 *     tags: [Customers]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: Search query (name, email, phone)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         description: Filter by status
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: List of customers
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
 *                     customers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Customer'
 *                     pagination:
 *                       $ref: '#/components/schemas/PaginationMeta'
 *                 error:
 *                   nullable: true
 */
router.get('/', async (req, res, next) => {
  try {
    const { q, status, page = 1, limit = 50 } = req.query as Record<string, string>;
    const offset = (Number(page) - 1) * Number(limit);
    const values: any[] = [];
    let where = 'WHERE 1=1';

    if (status) {
      const isActive = status === 'active' ? true : status === 'inactive' ? false : undefined;
      if (typeof isActive === 'boolean') {
        values.push(isActive);
        where += ` AND is_active = $${values.length}`;
      }
    }
    if (q) {
      values.push(`%${q}%`);
      where += ` AND (name ILIKE $${values.length} OR email ILIKE $${values.length} OR phone ILIKE $${values.length})`;
    }

    values.push(Number(limit), offset);
    const { rows } = await pool.query(
      `SELECT id, name, email, phone, is_active, created_at, updated_at, location FROM users ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );
    const mapped = rows.map((r: any) => ({
      customer_id: r.id, // Changed key to match Odoo req if needed, or keep id
      name: r.name,
      email: r.email,
      phone: r.phone,
      billing_address: r.location ? {
        // Assuming location is stored as "Street, City, State, Zip" string for now, or just mapping to street
        // Since we don't have structured address, we provide what we have
        street: r.location,
        city: "",
        state: "",
        zip: "",
        country: "India"
      } : {
        street: "",
        city: "",
        state: "",
        zip: "",
        country: ""
      },
      shipping_address: r.location ? {
        street: r.location,
        city: "",
        state: "",
        zip: "",
        country: "India"
      } : {
        street: "",
        city: "",
        state: "",
        zip: "",
        country: ""
      },
      status: r.is_active ? 'active' : 'inactive',
      created_at: formatDate(r.created_at),
      updated_at: formatDate(r.updated_at),
    }));

    const countValues = values.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM users ${where}`, countValues);
    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        customers: mapped,
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
 * /customers/{id}:
 *   get:
 *     summary: Get customer by ID
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Customer UUID
 *     responses:
 *       200:
 *         description: Customer details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *                 error:
 *                   nullable: true
 *       404:
 *         description: Customer not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, phone, is_active, created_at, updated_at, location FROM users WHERE id = $1',
      [req.params.id]
    );
    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      });
    }
    const r = rows[0];
    res.json({
      success: true,
      data: {
        customer_id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        billing_address: r.location ? {
          street: r.location,
          city: "",
          state: "",
          zip: "",
          country: "India"
        } : {
          street: "",
          city: "",
          state: "",
          zip: "",
          country: ""
        },
        shipping_address: r.location ? {
          street: r.location,
          city: "",
          state: "",
          zip: "",
          country: "India"
        } : {
          street: "",
          city: "",
          state: "",
          zip: "",
          country: ""
        },
        status: r.is_active ? 'active' : 'inactive',
        created_at: formatDate(r.created_at),
        updated_at: formatDate(r.updated_at),
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create new customer
 *     tags: [Customers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *                 example: Nischal R
 *               email:
 *                 type: string
 *                 example: user@example.com
 *               phone:
 *                 type: string
 *                 example: "+919876543210"
 *               billing_address:
 *                 type: string
 *                 example: "123 Main St, City, State, PIN"
 *               shipping_address:
 *                 type: string
 *                 example: "123 Main St, City, State, PIN"
 *     responses:
 *       201:
 *         description: Customer created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *                 error:
 *                   nullable: true
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        data: null,
        error: { code: 'VALIDATION_ERROR', message: 'Name and phone are required' },
      });
    }

    const { rows } = await pool.query(
      `INSERT INTO users (name, email, phone, is_active)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, name, email, phone, is_active, created_at, updated_at`,
      [name, email || null, phone]
    );

    const r = rows[0];
    res.status(201).json({
      success: true,
      data: {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        billing_address: null,
        shipping_address: null,
        status: r.is_active ? 'active' : 'inactive',
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      error: null,
    });
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        data: null,
        error: { code: 'DUPLICATE_ERROR', message: 'Customer with this phone/email already exists' },
      });
    }
    next(err);
  }
});

/**
 * @swagger
 * /customers/{id}:
 *   put:
 *     summary: Update customer
 *     tags: [Customers]
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
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               billing_address:
 *                 type: string
 *               shipping_address:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *     responses:
 *       200:
 *         description: Customer updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       404:
 *         description: Customer not found
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { name, email, phone, status } = req.body;
    const isActive =
      typeof status === 'string'
        ? status === 'active'
        : undefined;

    const { rows } = await pool.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           email = COALESCE($2, email),
           phone = COALESCE($3, phone),
           is_active = COALESCE($4, is_active),
           updated_at = now()
       WHERE id = $5
       RETURNING id, name, email, phone, is_active, created_at, updated_at`,
      [name, email, phone, typeof isActive === 'boolean' ? isActive : null, req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      });
    }

    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        billing_address: null,
        shipping_address: null,
        status: r.is_active ? 'active' : 'inactive',
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     summary: Soft delete customer
 *     tags: [Customers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Customer soft deleted
 *       404:
 *         description: Customer not found
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `UPDATE users SET is_active = FALSE, updated_at = now() WHERE id = $1
       RETURNING id, name, email, phone, is_active, created_at, updated_at`,
      [req.params.id]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        data: null,
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
      });
    }

    const r = rows[0];
    res.json({
      success: true,
      data: {
        id: r.id,
        name: r.name,
        email: r.email,
        phone: r.phone,
        billing_address: null,
        shipping_address: null,
        status: r.is_active ? 'active' : 'inactive',
        created_at: r.created_at,
        updated_at: r.updated_at,
      },
      error: null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
