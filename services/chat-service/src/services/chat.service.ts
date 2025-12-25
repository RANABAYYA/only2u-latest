import { v4 as uuidv4 } from 'uuid';
import { cassandraClient } from '../config/cassandra';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { Message, ChatThread, CreateMessageDto } from '../models/chat.model';

class ChatService {
  /**
   * Get user chat threads
   */
  async getUserThreads(userId: string): Promise<ChatThread[]> {
    // Get from PostgreSQL for thread metadata
    const result = await db.query(
      `SELECT * FROM chat_threads
       WHERE user1_id = $1 OR user2_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      user1_id: row.user1_id,
      user2_id: row.user2_id,
      last_message: row.last_message,
      updated_at: row.updated_at,
    }));
  }

  /**
   * Create or get thread
   */
  async getOrCreateThread(user1Id: string, user2Id: string): Promise<ChatThread> {
    // Check if thread exists
    const existing = await db.query(
      `SELECT * FROM chat_threads
       WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)`,
      [user1Id, user2Id]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0];
    }

    // Create new thread
    const threadId = uuidv4();
    const result = await db.query(
      `INSERT INTO chat_threads (id, user1_id, user2_id, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       RETURNING *`,
      [threadId, user1Id, user2Id]
    );

    return result.rows[0];
  }

  /**
   * Send message
   */
  async sendMessage(messageData: CreateMessageDto): Promise<Message> {
    const threadId = messageData.thread_id;
    const messageId = uuidv4();
    const timestamp = new Date();

    // Store in Cassandra
    const query = `INSERT INTO messages (
      message_id, thread_id, sender_id, content, created_at
    ) VALUES (?, ?, ?, ?, ?)`;

    await cassandraClient.execute(
      query,
      [messageId, threadId, messageData.sender_id, messageData.content, timestamp],
      { prepare: true }
    );

    // Update thread in PostgreSQL
    await db.query(
      `UPDATE chat_threads
       SET last_message = $1, updated_at = NOW()
       WHERE id = $2`,
      [messageData.content, threadId]
    );

    // Publish to Redis for real-time delivery
    await redis.publish(
      `chat:thread:${threadId}`,
      JSON.stringify({
        message_id: messageId,
        thread_id: threadId,
        sender_id: messageData.sender_id,
        content: messageData.content,
        created_at: timestamp.toISOString(),
      })
    );

    return {
      id: messageId,
      thread_id: threadId,
      sender_id: messageData.sender_id,
      content: messageData.content,
      created_at: timestamp,
    };
  }

  /**
   * Get thread messages
   */
  async getThreadMessages(threadId: string, limit: number = 50): Promise<Message[]> {
    const query = `SELECT * FROM messages
                   WHERE thread_id = ?
                   ORDER BY created_at DESC
                   LIMIT ?`;

    const result = await cassandraClient.execute(query, [threadId, limit], { prepare: true });

    return result.rows
      .map((row) => ({
        id: row.message_id.toString(),
        thread_id: row.thread_id.toString(),
        sender_id: row.sender_id.toString(),
        content: row.content,
        created_at: row.created_at,
      }))
      .reverse(); // Reverse to show oldest first
  }

  /**
   * Mark messages as read
   */
  async markAsRead(threadId: string, userId: string): Promise<void> {
    // Store read status in Redis
    await redis.set(`chat:read:${threadId}:${userId}`, Date.now().toString());
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    // This would need to be calculated based on last read timestamps
    // For now, return 0 as placeholder
    return 0;
  }
}

export const chatService = new ChatService();
export default chatService;

