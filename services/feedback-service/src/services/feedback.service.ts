import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { Feedback, CreateFeedbackDto } from '../models/feedback.model';

class FeedbackService {
  /**
   * Create feedback
   */
  async createFeedback(feedbackData: CreateFeedbackDto): Promise<Feedback> {
    const id = uuidv4();
    const now = new Date();

    const result = await db.query(
      `INSERT INTO feedback (
        id, user_id, user_email, user_name, feedback_text,
        image_urls, category, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        id,
        feedbackData.user_id || null,
        feedbackData.user_email || null,
        feedbackData.user_name || 'Anonymous',
        feedbackData.feedback_text,
        feedbackData.image_urls || null,
        feedbackData.category || 'general',
        'pending',
        now,
      ]
    );

    return result.rows[0];
  }

  /**
   * Get feedback by ID
   */
  async getFeedbackById(feedbackId: string): Promise<Feedback | null> {
    const result = await db.query('SELECT * FROM feedback WHERE id = $1', [feedbackId]);
    return result.rows[0] || null;
  }

  /**
   * Get user feedback
   */
  async getUserFeedback(userId: string): Promise<Feedback[]> {
    const result = await db.query(
      'SELECT * FROM feedback WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  }

  /**
   * Get all feedback (admin)
   */
  async getAllFeedback(
    page: number = 1,
    limit: number = 20,
    filters?: { status?: string; category?: string }
  ): Promise<{ feedback: Feedback[]; total: number; page: number; limit: number }> {
    const offset = (page - 1) * limit;
    let query = 'SELECT * FROM feedback WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (filters?.status) {
      query += ` AND status = $${paramCount++}`;
      params.push(filters.status);
    }

    if (filters?.category) {
      query += ` AND category = $${paramCount++}`;
      params.push(filters.category);
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Get paginated results
    query += ` ORDER BY created_at DESC LIMIT $${paramCount++} OFFSET $${paramCount++}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    return {
      feedback: result.rows,
      total,
      page,
      limit,
    };
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(feedbackId: string, status: string): Promise<Feedback> {
    const result = await db.query(
      'UPDATE feedback SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, feedbackId]
    );

    if (result.rows.length === 0) {
      throw new Error('Feedback not found');
    }

    return result.rows[0];
  }
}

export const feedbackService = new FeedbackService();
export default feedbackService;

