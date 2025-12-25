import { Request, Response, NextFunction } from 'express';
import { feedbackService } from '../services/feedback.service';

export class FeedbackController {
  createFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feedback = await feedbackService.createFeedback(req.body);
      res.status(201).json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  };

  getFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feedback = await feedbackService.getFeedbackById(req.params.id);
      if (!feedback) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Feedback not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feedback = await feedbackService.getUserFeedback(req.params.userId);
      res.json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  };

  getAllFeedback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        status: req.query.status as string,
        category: req.query.category as string,
      };
      const result = await feedbackService.getAllFeedback(page, limit, filters);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const feedback = await feedbackService.updateFeedbackStatus(
        req.params.id,
        req.body.status
      );
      res.json({
        success: true,
        data: { feedback },
      });
    } catch (error) {
      next(error);
    }
  };
}

