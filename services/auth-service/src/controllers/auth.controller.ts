import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service';
import { AuthRequest } from '../middleware/auth.middleware';

export class AuthController {
  /**
   * Register new user
   */
  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await authService.createUser(req.body);
      res.status(201).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
          },
        },
      });
    } catch (error: any) {
      next(error);
    }
  };

  /**
   * Login with email and password
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await authService.loginWithPassword(req.body);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      error.statusCode = 401;
      next(error);
    }
  };

  /**
   * Send OTP to phone number
   */
  sendOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, countryCode } = req.body;
      const result = await authService.sendOtp(phone, countryCode);
      res.json({
        success: true,
        data: {
          otpId: result.otpId,
          message: 'OTP sent successfully',
        },
      });
    } catch (error: any) {
      error.statusCode = 400;
      next(error);
    }
  };

  /**
   * Verify OTP and login/register
   */
  verifyOtp = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone, countryCode, otp, otpId } = req.body;
      const result = await authService.verifyOtpAndLogin(phone, countryCode, otp, otpId);
      res.json({
        success: true,
        data: result,
      });
    } catch (error: any) {
      error.statusCode = 401;
      next(error);
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const tokens = await authService.refreshToken(refreshToken);
      res.json({
        success: true,
        data: tokens,
      });
    } catch (error: any) {
      error.statusCode = 401;
      next(error);
    }
  };

  /**
   * Get current user
   */
  getMe = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      const user = await authService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: 'User not found',
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            is_active: user.is_active,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
        },
      });
    } catch (error: any) {
      next(error);
    }
  };

  /**
   * Logout
   */
  logout = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated',
          },
        });
        return;
      }

      await authService.logout(userId);
      res.json({
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      });
    } catch (error: any) {
      next(error);
    }
  };
}

