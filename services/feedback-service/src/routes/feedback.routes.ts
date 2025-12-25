import { Router } from 'express';
import { FeedbackController } from '../controllers/feedback.controller';

const router = Router();
const feedbackController = new FeedbackController();

router.post('/', feedbackController.createFeedback);
router.get('/user/:userId', feedbackController.getUserFeedback);
router.get('/admin', feedbackController.getAllFeedback);
router.get('/:id', feedbackController.getFeedback);
router.put('/:id/status', feedbackController.updateStatus);

export { router as feedbackRoutes };

