import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Review, CreateReviewDto, UpdateReviewDto } from '../models/review.model';

class ReviewService {
  /**
   * Get product reviews
   */
  async getProductReviews(productId: string, page: number = 1, limit: number = 20): Promise<{
    reviews: Review[];
    total: number;
    averageRating: number;
    page: number;
    limit: number;
  }> {
    const offset = (page - 1) * limit;

    // Get total count and average rating
    const statsResult = await db.query(
      `SELECT COUNT(*) as total, AVG(rating) as avg_rating
       FROM product_reviews
       WHERE product_id = $1`,
      [productId]
    );

    const total = parseInt(statsResult.rows[0].total);
    const averageRating = parseFloat(statsResult.rows[0].avg_rating) || 0;

    // Get reviews
    const reviewsResult = await db.query(
      `SELECT * FROM product_reviews
       WHERE product_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    );

    return {
      reviews: reviewsResult.rows,
      total,
      averageRating: Math.round(averageRating * 10) / 10,
      page,
      limit,
    };
  }

  /**
   * Create review
   */
  async createReview(reviewData: CreateReviewDto): Promise<Review> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Check if user already reviewed this product
      const existing = await client.query(
        'SELECT id FROM product_reviews WHERE product_id = $1 AND user_id = $2',
        [reviewData.product_id, reviewData.user_id]
      );

      if (existing.rows.length > 0) {
        throw new Error('User has already reviewed this product');
      }

      const id = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO product_reviews (
          id, product_id, user_id, reviewer_name, rating, comment,
          is_verified, profile_image_url, helpful_count, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          id,
          reviewData.product_id,
          reviewData.user_id || null,
          reviewData.reviewer_name,
          reviewData.rating,
          reviewData.comment || null,
          reviewData.is_verified || false,
          reviewData.profile_image_url || null,
          0,
          now,
          now,
        ]
      );

      // Update product like_count (if needed) or create separate rating aggregation
      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update review
   */
  async updateReview(reviewId: string, userId: string, reviewData: UpdateReviewDto): Promise<Review> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (reviewData.rating !== undefined) {
      fields.push(`rating = $${paramCount++}`);
      values.push(reviewData.rating);
    }

    if (reviewData.comment !== undefined) {
      fields.push(`comment = $${paramCount++}`);
      values.push(reviewData.comment);
    }

    fields.push(`updated_at = NOW()`);
    values.push(reviewId, userId);

    const query = `UPDATE product_reviews 
                   SET ${fields.join(', ')} 
                   WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
                   RETURNING *`;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Review not found or access denied');
    }

    return result.rows[0];
  }

  /**
   * Delete review
   */
  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const result = await db.query(
      'DELETE FROM product_reviews WHERE id = $1 AND user_id = $2 RETURNING id',
      [reviewId, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Review not found or access denied');
    }
  }

  /**
   * Get user reviews
   */
  async getUserReviews(userId: string): Promise<Review[]> {
    const result = await db.query(
      'SELECT * FROM product_reviews WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return result.rows;
  }
}

export const reviewService = new ReviewService();
export default reviewService;

