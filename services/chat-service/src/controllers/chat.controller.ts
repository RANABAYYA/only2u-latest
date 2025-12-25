import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';

export class ChatController {
  getUserThreads = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const threads = await chatService.getUserThreads(req.params.userId);
      res.json({
        success: true,
        data: { threads },
      });
    } catch (error) {
      next(error);
    }
  };

  getOrCreateThread = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user1_id, user2_id } = req.body;
      const thread = await chatService.getOrCreateThread(user1_id, user2_id);
      res.json({
        success: true,
        data: { thread },
      });
    } catch (error) {
      next(error);
    }
  };

  sendMessage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const message = await chatService.sendMessage(req.body);
      res.status(201).json({
        success: true,
        data: { message },
      });
    } catch (error) {
      next(error);
    }
  };

  getThreadMessages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const messages = await chatService.getThreadMessages(req.params.threadId, limit);
      res.json({
        success: true,
        data: { messages },
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { userId } = req.body;
      await chatService.markAsRead(req.params.threadId, userId);
      res.json({
        success: true,
        data: { message: 'Messages marked as read' },
      });
    } catch (error) {
      next(error);
    }
  };
}

