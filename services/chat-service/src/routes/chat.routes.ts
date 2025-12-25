import { Router } from 'express';
import { ChatController } from '../controllers/chat.controller';

const router = Router();
const chatController = new ChatController();

router.get('/user/:userId/threads', chatController.getUserThreads);
router.post('/threads', chatController.getOrCreateThread);
router.post('/messages', chatController.sendMessage);
router.get('/threads/:threadId/messages', chatController.getThreadMessages);
router.post('/threads/:threadId/read', chatController.markAsRead);

export { router as chatRoutes };

