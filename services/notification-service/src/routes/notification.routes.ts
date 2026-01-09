import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller';

const router = Router();
const notificationController = new NotificationController();

router.post('/', notificationController.createNotification);
router.get('/user/:userId', notificationController.getUserNotifications);
router.post('/register-token', notificationController.registerToken);
router.get('/user/:userId/preferences', notificationController.getPreferences);
router.put('/user/:userId/preferences', notificationController.updatePreferences);

export { router as notificationRoutes };

