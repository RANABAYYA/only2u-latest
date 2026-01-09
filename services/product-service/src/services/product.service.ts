import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { redis } from '../config/redis';
import {
  Product,
  ProductVariant,
  Category,
  Color,
  Size,
  CreateProductDto,
  UpdateProductDto,
  ProductWithVariants,
} from '../models/product.model';

class ProductService {
  private readonly CACHE_TTL = 3600; // 1 hour

  /**
   * Get all products with pagination and filters
   */
  async getProducts(
    page: number = 1,
    limit: number = 20,
    filters?: {
      category_id?: string;
      featured_type?: string;
      is_active?: boolean;
      search?: string;
      min_price?: number;
      max_price?: number;
    }
  ): Promise<{ products: Product[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    const cacheKey = `products:${page}:${limit}:${JSON.stringify(filters)}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    let query = 'SELECT * FROM products WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.category_id) {
      query += ` AND category_id = $${paramCount++}`;
      params.push(filters.category_id);
    }

    if (filters?.featured_type) {
      query += ` AND featured_type = $${paramCount++}`;
      params.push(filters.featured_type);
    }

    if (filters?.is_active !== undefined) {
      query += ` AND is_active = $${paramCount++}`;
      params.push(filters.is_active);
    }

    if (filters?.search) {
      query += ` AND (name ILIKE $${paramCount} OR description ILIKE $${paramCount})`;
      params.push(`%${filters.search}%`);
      paramCount++;
    }

    if (filters?.min_price !== undefined) {
      query += ` AND base_price >= $${paramCount++}`;
      params.push(filters.min_price);
    }

    if (filters?.max_price !== undefined) {
      query += ` AND base_price <= $${paramCount++}`;
      params.push(filters.max_price);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    const products = result.rows;

    const response = { products, total, page, limit };

    // Cache result
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(response));

    return response;
  }

  /**
   * Get product by ID with variants
   */
  async getProductById(productId: string): Promise<ProductWithVariants | null> {
    const cacheKey = `product:${productId}`;

    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get product
    const productResult = await db.query('SELECT * FROM products WHERE id = $1', [productId]);
    if (productResult.rows.length === 0) {
      return null;
    }

    const product = productResult.rows[0];

    // Get variants
    const variantsResult = await db.query(
      'SELECT * FROM product_variants WHERE product_id = $1 AND is_active = true',
      [productId]
    );

    // Get category if exists
    let category = null;
    if (product.category_id) {
      const categoryResult = await db.query('SELECT * FROM categories WHERE id = $1', [
        product.category_id,
      ]);
      category = categoryResult.rows[0] || null;
    }

    const productWithVariants: ProductWithVariants = {
      ...product,
      variants: variantsResult.rows,
      category,
    };

    // Cache result
    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(productWithVariants));

    return productWithVariants;
  }

  /**
   * Create new product
   */
  async createProduct(productData: CreateProductDto): Promise<Product> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const id = uuidv4();
      const slug = productData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const result = await client.query(
        `INSERT INTO products (
          id, name, description, slug, category_id, image_urls, video_urls,
          base_price, featured_type, vendor_name, tags, stock_quantity, is_active, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
        RETURNING *`,
        [
          id,
          productData.name,
          productData.description || null,
          slug,
          productData.category_id || null,
          productData.image_urls || [],
          productData.video_urls || [],
          productData.base_price,
          productData.featured_type || null,
          productData.vendor_name || null,
          productData.tags || [],
          productData.stock_quantity || 0,
          true,
        ]
      );

      await client.query('COMMIT');

      // Invalidate cache
      await this.invalidateProductCache();

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update product
   */
  async updateProduct(productId: string, productData: UpdateProductDto): Promise<Product> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      const fields: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (productData.name) {
        fields.push(`name = $${paramCount++}`);
        values.push(productData.name);
      }
      if (productData.description !== undefined) {
        fields.push(`description = $${paramCount++}`);
        values.push(productData.description);
      }
      if (productData.category_id !== undefined) {
        fields.push(`category_id = $${paramCount++}`);
        values.push(productData.category_id);
      }
      if (productData.image_urls) {
        fields.push(`image_urls = $${paramCount++}`);
        values.push(productData.image_urls);
      }
      if (productData.video_urls) {
        fields.push(`video_urls = $${paramCount++}`);
        values.push(productData.video_urls);
      }
      if (productData.base_price !== undefined) {
        fields.push(`base_price = $${paramCount++}`);
        values.push(productData.base_price);
      }
      if (productData.is_active !== undefined) {
        fields.push(`is_active = $${paramCount++}`);
        values.push(productData.is_active);
      }
      if (productData.featured_type !== undefined) {
        fields.push(`featured_type = $${paramCount++}`);
        values.push(productData.featured_type);
      }
      if (productData.stock_quantity !== undefined) {
        fields.push(`stock_quantity = $${paramCount++}`);
        values.push(productData.stock_quantity);
      }

      fields.push(`updated_at = NOW()`);
      values.push(productId);

      const query = `UPDATE products SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      const result = await client.query(query, values);

      await client.query('COMMIT');

      // Invalidate cache
      await redis.del(`product:${productId}`);
      await this.invalidateProductCache();

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get categories
   */
  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories:all';

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await db.query(
      'SELECT * FROM categories WHERE is_active = true ORDER BY sort_order, name'
    );

    await redis.setex(cacheKey, this.CACHE_TTL, JSON.stringify(result.rows));

    return result.rows;
  }

  /**
   * Get trending products
   */
  async getTrendingProducts(limit: number = 10): Promise<Product[]> {
    const cacheKey = `products:trending:${limit}`;

    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const result = await db.query(
      `SELECT * FROM products 
       WHERE is_active = true AND featured_type = 'trending'
       ORDER BY like_count DESC, created_at DESC
       LIMIT $1`,
      [limit]
    );

    await redis.setex(cacheKey, 1800, JSON.stringify(result.rows)); // 30 min cache

    return result.rows;
  }

  /**
   * Search products
   */
  async searchProducts(query: string, limit: number = 20): Promise<Product[]> {
    const result = await db.query(
      `SELECT * FROM products 
       WHERE is_active = true 
       AND (name ILIKE $1 OR description ILIKE $1 OR tags::text ILIKE $1)
       ORDER BY 
         CASE WHEN name ILIKE $2 THEN 1 ELSE 2 END,
         like_count DESC
       LIMIT $3`,
      [`%${query}%`, `${query}%`, limit]
    );

    return result.rows;
  }

  /**
   * Invalidate product cache
   */
  private async invalidateProductCache(): Promise<void> {
    const keys = await redis.keys('products:*');
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del('categories:all');
  }
}

export const productService = new ProductService();
export default productService;

