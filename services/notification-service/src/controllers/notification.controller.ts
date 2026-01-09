import { Request, Response, NextFunction } from 'express';
import { notificationService } from '../services/notification.service';

export class NotificationController {
  createNotification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await notificationService.createNotification(req.body);
      res.json({
        success: true,
        data: { message: 'Notification sent' },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.getUserNotifications(
        req.params.userId,
        limit
      );
      res.json({
        success: true,
        data: { notifications },
      });
    } catch (error) {
      next(error);
    }
  };

  registerToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id, fcm_token } = req.body;
      await notificationService.registerFCMToken(user_id, fcm_token);
      res.json({
        success: true,
        data: { message: 'Token registered' },
      });
    } catch (error) {
      next(error);
    }
  };

  getPreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const preferences = await notificationService.getPreferences(req.params.userId);
      res.json({
        success: true,
        data: { preferences },
      });
    } catch (error) {
      next(error);
    }
  };

  updatePreferences = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await notificationService.updatePreferences(req.params.userId, req.body);
      res.json({
        success: true,
        data: { message: 'Preferences updated' },
      });
    } catch (error) {
      next(error);
    }
  };
}

