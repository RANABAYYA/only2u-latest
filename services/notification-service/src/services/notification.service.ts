import admin from 'firebase-admin';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import { cassandraClient } from '../config/cassandra';
import { redis } from '../config/redis';
import { db } from '../config/database';
import { Notification, CreateNotificationDto } from '../models/notification.model';

class NotificationService {
  private fcm: admin.messaging.Messaging;
  private emailTransporter: nodemailer.Transporter;

  constructor() {
    // Initialize Firebase Admin
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount || {
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }

    this.fcm = admin.messaging();

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  /**
   * Send push notification
   */
  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: Record<string, string>
  ): Promise<void> {
    try {
      // Get user FCM token from database
      const tokenResult = await db.query(
        'SELECT fcm_token FROM user_tokens WHERE user_id = $1',
        [userId]
      );

      if (tokenResult.rows.length === 0 || !tokenResult.rows[0].fcm_token) {
        console.log(`No FCM token found for user ${userId}`);
        return;
      }

      const token = tokenResult.rows[0].fcm_token;

      const message: admin.messaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high' as const,
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
            },
          },
        },
      };

      await this.fcm.send(message);

      // Store notification in Cassandra
      await this.storeNotification(userId, {
        type: 'push',
        title,
        body,
        data,
      });
    } catch (error: any) {
      console.error('Error sending push notification:', error);
      throw error;
    }
  }

  /**
   * Send email notification
   */
  async sendEmailNotification(
    userId: string,
    to: string,
    subject: string,
    html: string
  ): Promise<void> {
    try {
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@only2u.com',
        to,
        subject,
        html,
      });

      // Store notification in Cassandra
      await this.storeNotification(userId, {
        type: 'email',
        title: subject,
        body: html,
      });
    } catch (error: any) {
      console.error('Error sending email notification:', error);
      throw error;
    }
  }

  /**
   * Create and send notification
   */
  async createNotification(notificationData: CreateNotificationDto): Promise<void> {
    const { user_id, type, title, body, data } = notificationData;

    // Store in PostgreSQL for preferences
    await db.query(
      `INSERT INTO notifications (id, user_id, type, title, body, data, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [uuidv4(), user_id, type, title, body, data ? JSON.stringify(data) : null]
    );

    // Store in Cassandra for history
    await this.storeNotification(user_id, notificationData);

    // Send based on type
    if (type === 'push') {
      await this.sendPushNotification(user_id, title, body, data);
    } else if (type === 'email') {
      const userResult = await db.query('SELECT email FROM users WHERE id = $1', [user_id]);
      if (userResult.rows.length > 0 && userResult.rows[0].email) {
        await this.sendEmailNotification(user_id, userResult.rows[0].email, title, body);
      }
    }
  }

  /**
   * Store notification in Cassandra
   */
  private async storeNotification(userId: string, notification: CreateNotificationDto): Promise<void> {
    const notificationId = uuidv4();
    const timestamp = new Date();

    const query = `INSERT INTO notifications (
      notification_id, user_id, type, title, body, data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`;

    await cassandraClient.execute(query, [
      notificationId,
      userId,
      notification.type,
      notification.title,
      notification.body || '',
      notification.data ? JSON.stringify(notification.data) : null,
      timestamp,
    ], { prepare: true });
  }

  /**
   * Get user notifications
   */
  async getUserNotifications(userId: string, limit: number = 50): Promise<Notification[]> {
    const query = `SELECT * FROM notifications
                   WHERE user_id = ?
                   ORDER BY created_at DESC
                   LIMIT ?`;

    const result = await cassandraClient.execute(query, [userId, limit], { prepare: true });

    return result.rows.map((row) => ({
      id: row.notification_id.toString(),
      user_id: row.user_id.toString(),
      type: row.type,
      title: row.title,
      body: row.body,
      data: row.data ? JSON.parse(row.data) : null,
      read: false, // Would need separate read tracking
      created_at: row.created_at,
    }));
  }

  /**
   * Register FCM token
   */
  async registerFCMToken(userId: string, token: string): Promise<void> {
    await db.query(
      `INSERT INTO user_tokens (user_id, fcm_token, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE
       SET fcm_token = $2, updated_at = NOW()`,
      [userId, token]
    );
  }

  /**
   * Get notification preferences
   */
  async getPreferences(userId: string): Promise<any> {
    const result = await db.query(
      'SELECT * FROM notification_preferences WHERE user_id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      // Return defaults
      return {
        push_enabled: true,
        email_enabled: true,
        order_updates: true,
        promotions: true,
        new_products: false,
      };
    }

    return result.rows[0];
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(userId: string, preferences: any): Promise<void> {
    await db.query(
      `INSERT INTO notification_preferences (
        user_id, push_enabled, email_enabled, order_updates, promotions, new_products, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET push_enabled = $2, email_enabled = $3, order_updates = $4,
          promotions = $5, new_products = $6, updated_at = NOW()`,
      [
        userId,
        preferences.push_enabled !== false,
        preferences.email_enabled !== false,
        preferences.order_updates !== false,
        preferences.promotions !== false,
        preferences.new_products || false,
      ]
    );
  }
}

export const notificationService = new NotificationService();
export default notificationService;

