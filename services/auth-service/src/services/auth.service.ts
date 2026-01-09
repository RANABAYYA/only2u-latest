import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { jwtConfig } from '../config/jwt';
import { redis } from '../config/redis';
import { otpService } from './otp.service';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  password_hash?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreateUserDto {
  email: string;
  name: string;
  phone?: string;
  password?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface OtpLoginDto {
  phone: string;
  countryCode: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class AuthService {
  /**
   * Create a new user account
   */
  async createUser(userData: CreateUserDto): Promise<User> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Check if user already exists
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [userData.email.toLowerCase()]
      );

      if (emailCheck.rows.length > 0) {
        throw new Error('User with this email already exists');
      }

      if (userData.phone) {
        const phoneCheck = await client.query(
          'SELECT id FROM users WHERE phone = $1',
          [userData.phone]
        );

        if (phoneCheck.rows.length > 0) {
          throw new Error('User with this phone number already exists');
        }
      }

      // Hash password if provided
      let passwordHash = null;
      if (userData.password) {
        passwordHash = await bcrypt.hash(userData.password, 10);
      }

      const id = uuidv4();
      const now = new Date();

      const result = await client.query(
        `INSERT INTO users (id, email, name, phone, password_hash, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, email, name, phone, is_active, created_at, updated_at`,
        [
          id,
          userData.email.toLowerCase(),
          userData.name,
          userData.phone || null,
          passwordHash,
          true,
          now,
          now,
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Login with email and password
   */
  async loginWithPassword(loginData: LoginDto): Promise<{ user: User; tokens: TokenPair }> {
    const user = await db.query(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [loginData.email.toLowerCase()]
    );

    if (user.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const userRecord = user.rows[0];

    if (!userRecord.password_hash) {
      throw new Error('Password not set for this account');
    }

    const isValidPassword = await bcrypt.compare(loginData.password, userRecord.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    const tokens = this.generateTokenPair(userRecord.id);

    // Store refresh token in Redis
    await redis.setex(
      `refresh_token:${userRecord.id}`,
      30 * 24 * 60 * 60, // 30 days
      tokens.refreshToken
    );

    return {
      user: {
        id: userRecord.id,
        email: userRecord.email,
        name: userRecord.name,
        phone: userRecord.phone,
        is_active: userRecord.is_active,
        created_at: userRecord.created_at,
        updated_at: userRecord.updated_at,
      },
      tokens,
    };
  }

  /**
   * Send OTP to phone number
   */
  async sendOtp(phone: string, countryCode: string = '+91'): Promise<{ otpId: string; success: boolean; error?: string }> {
    const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;

    // Check if user exists
    const user = await db.query('SELECT id FROM users WHERE phone = $1', [fullPhone]);

    // Rate limiting: Check if OTP was sent recently
    const rateLimitKey = `otp_rate_limit:${fullPhone}`;
    const recentOtp = await redis.get(rateLimitKey);
    if (recentOtp) {
      throw new Error('Please wait before requesting another OTP');
    }

    // Generate OTP
    const otpResult = await otpService.generateOtp(fullPhone);

    if (!otpResult.success || !otpResult.otpId) {
      throw new Error(otpResult.error || 'Failed to send OTP');
    }

    // Store OTP ID in Redis with expiration
    const otpKey = `otp:${fullPhone}`;
    await redis.setex(otpKey, 200, otpResult.otpId); // 200 seconds

    // Rate limiting: Set cooldown (60 seconds)
    await redis.setex(rateLimitKey, 60, '1');

    return {
      otpId: otpResult.otpId,
      success: true,
    };
  }

  /**
   * Verify OTP and login/register
   */
  async verifyOtpAndLogin(
    phone: string,
    countryCode: string,
    otp: string,
    otpId?: string
  ): Promise<{ user: User; tokens: TokenPair; isNewUser: boolean }> {
    const fullPhone = `${countryCode}${phone.replace(/\D/g, '')}`;

    // Get stored OTP ID from Redis
    const otpKey = `otp:${fullPhone}`;
    const storedOtpId = await redis.get(otpKey);

    // Verify OTP
    const verifyResult = await otpService.verifyOtp(otp, fullPhone, otpId || storedOtpId || undefined);

    if (!verifyResult.success) {
      throw new Error(verifyResult.error || 'Invalid OTP');
    }

    // Check if user exists
    const userResult = await db.query('SELECT * FROM users WHERE phone = $1', [fullPhone]);
    let user: User;
    let isNewUser = false;

    if (userResult.rows.length === 0) {
      // New user - create account
      isNewUser = true;
      const id = uuidv4();
      const now = new Date();

      const createResult = await db.query(
        `INSERT INTO users (id, email, name, phone, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, email, name, phone, is_active, created_at, updated_at`,
        [id, null, 'User', fullPhone, true, now, now]
      );

      user = createResult.rows[0];
    } else {
      user = userResult.rows[0];
    }

    // Generate tokens
    const tokens = this.generateTokenPair(user.id);

    // Store refresh token in Redis
    await redis.setex(
      `refresh_token:${user.id}`,
      30 * 24 * 60 * 60, // 30 days
      tokens.refreshToken
    );

    // Clear OTP from Redis
    await redis.del(otpKey);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        is_active: user.is_active,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
      tokens,
      isNewUser,
    };
  }

  /**
   * Generate JWT token pair
   */
  private generateTokenPair(userId: string): TokenPair {
    const accessToken = jwt.sign({ userId, type: 'access' }, jwtConfig.secret, {
      expiresIn: jwtConfig.expiresIn,
    });

    const refreshToken = jwt.sign({ userId, type: 'refresh' }, jwtConfig.refreshSecret, {
      expiresIn: jwtConfig.refreshExpiresIn,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, jwtConfig.refreshSecret) as { userId: string; type: string };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Verify token exists in Redis
      const storedToken = await redis.get(`refresh_token:${decoded.userId}`);
      if (storedToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Generate new token pair
      const tokens = this.generateTokenPair(decoded.userId);

      // Update refresh token in Redis
      await redis.setex(
        `refresh_token:${decoded.userId}`,
        30 * 24 * 60 * 60, // 30 days
        tokens.refreshToken
      );

      return tokens;
    } catch (error: any) {
      throw new Error('Invalid refresh token');
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<User | null> {
    const result = await db.query(
      'SELECT id, email, name, phone, is_active, created_at, updated_at FROM users WHERE id = $1',
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Logout (invalidate refresh token)
   */
  async logout(userId: string): Promise<void> {
    await redis.del(`refresh_token:${userId}`);
  }
}

export const authService = new AuthService();
export default authService;

