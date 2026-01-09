import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Collection, CollectionProduct, CreateCollectionDto } from '../models/wishlist.model';

class WishlistService {
  /**
   * Get user collections
   */
  async getUserCollections(userId: string): Promise<Collection[]> {
    const result = await db.query(
      `SELECT c.*, 
       COUNT(cp.id) as product_count
       FROM collections c
       LEFT JOIN collection_products cp ON cp.collection_id = c.id
       WHERE c.user_id = $1
       GROUP BY c.id
       ORDER BY c.is_default DESC, c.created_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      ...row,
      product_count: parseInt(row.product_count),
    }));
  }

  /**
   * Create collection
   */
  async createCollection(collectionData: CreateCollectionDto): Promise<Collection> {
    const id = uuidv4();
    const now = new Date();

    const result = await db.query(
      `INSERT INTO collections (
        id, user_id, name, description, is_private, is_default, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        id,
        collectionData.user_id,
        collectionData.name,
        collectionData.description || null,
        collectionData.is_private !== false,
        collectionData.is_default || false,
        now,
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Add product to collection
   */
  async addProductToCollection(
    collectionId: string,
    productId: string,
    userId: string
  ): Promise<void> {
    // Verify collection belongs to user
    const collection = await db.query(
      'SELECT id FROM collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );

    if (collection.rows.length === 0) {
      throw new Error('Collection not found or access denied');
    }

    // Check if already exists
    const existing = await db.query(
      'SELECT id FROM collection_products WHERE collection_id = $1 AND product_id = $2',
      [collectionId, productId]
    );

    if (existing.rows.length > 0) {
      return; // Already exists
    }

    await db.query(
      `INSERT INTO collection_products (id, collection_id, product_id, added_at)
       VALUES ($1, $2, $3, NOW())`,
      [uuidv4(), collectionId, productId]
    );
  }

  /**
   * Remove product from collection
   */
  async removeProductFromCollection(
    collectionId: string,
    productId: string,
    userId: string
  ): Promise<void> {
    // Verify collection belongs to user
    const collection = await db.query(
      'SELECT id FROM collections WHERE id = $1 AND user_id = $2',
      [collectionId, userId]
    );

    if (collection.rows.length === 0) {
      throw new Error('Collection not found or access denied');
    }

    await db.query(
      'DELETE FROM collection_products WHERE collection_id = $1 AND product_id = $2',
      [collectionId, productId]
    );
  }

  /**
   * Get collection products
   */
  async getCollectionProducts(collectionId: string, userId: string): Promise<CollectionProduct[]> {
    // Verify collection belongs to user or is public
    const collection = await db.query(
      'SELECT * FROM collections WHERE id = $1 AND (user_id = $2 OR is_private = false)',
      [collectionId, userId]
    );

    if (collection.rows.length === 0) {
      throw new Error('Collection not found or access denied');
    }

    const result = await db.query(
      `SELECT cp.*, p.name as product_name, p.image_urls, p.base_price
       FROM collection_products cp
       JOIN products p ON p.id = cp.product_id
       WHERE cp.collection_id = $1
       ORDER BY cp.added_at DESC`,
      [collectionId]
    );

    return result.rows;
  }

  /**
   * Delete collection
   */
  async deleteCollection(collectionId: string, userId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM collections WHERE id = $1 AND user_id = $2 RETURNING id',
      [collectionId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Collection not found or access denied');
    }
  }
}

export const wishlistService = new WishlistService();
export default wishlistService;

