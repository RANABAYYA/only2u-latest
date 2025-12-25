import { Request, Response, NextFunction } from 'express';
import { cartService } from '../services/cart.service';
import { v4 as uuidv4 } from 'uuid';

export class CartController {
  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId;
      const cart = await cartService.getCart(userId);
      res.json({
        success: true,
        data: { items: cart },
      });
    } catch (error) {
      next(error);
    }
  };

  addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId;
      const item = {
        id: uuidv4(),
        ...req.body,
      };
      const cart = await cartService.addItem(userId, item);
      res.json({
        success: true,
        data: { items: cart },
      });
    } catch (error) {
      next(error);
    }
  };

  updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId;
      const itemId = req.params.itemId;
      const { quantity } = req.body;
      const cart = await cartService.updateItem(userId, itemId, quantity);
      res.json({
        success: true,
        data: { items: cart },
      });
    } catch (error) {
      next(error);
    }
  };

  removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId;
      const itemId = req.params.itemId;
      const cart = await cartService.removeItem(userId, itemId);
      res.json({
        success: true,
        data: { items: cart },
      });
    } catch (error) {
      next(error);
    }
  };

  clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.params.userId;
      await cartService.clearCart(userId);
      res.json({
        success: true,
        data: { message: 'Cart cleared' },
      });
    } catch (error) {
      next(error);
    }
  };
}

