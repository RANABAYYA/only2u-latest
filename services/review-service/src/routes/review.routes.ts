import { Router } from 'express';
import { ReviewController } from '../controllers/review.controller';

const router = Router();
const reviewController = new ReviewController();

router.get('/product/:productId', reviewController.getProductReviews);
router.get('/user/:userId', reviewController.getUserReviews);
router.post('/', reviewController.createReview);
router.put('/:id', reviewController.updateReview);
router.delete('/:id/user/:userId', reviewController.deleteReview);

export { router as reviewRoutes };

