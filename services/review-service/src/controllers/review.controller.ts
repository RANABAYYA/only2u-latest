import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';

export class ReviewController {
  getProductReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await reviewService.getProductReviews(req.params.productId, page, limit);
      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  createReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const review = await reviewService.createReview(req.body);
      res.status(201).json({
        success: true,
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  };

  updateReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.body.user_id;
      const review = await reviewService.updateReview(req.params.id, userId, req.body);
      res.json({
        success: true,
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteReview = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await reviewService.deleteReview(req.params.id, req.params.userId);
      res.json({
        success: true,
        data: { message: 'Review deleted' },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserReviews = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reviews = await reviewService.getUserReviews(req.params.userId);
      res.json({
        success: true,
        data: { reviews },
      });
    } catch (error) {
      next(error);
    }
  };
}

