import { Request, Response, NextFunction } from 'express';
import { wishlistService } from '../services/wishlist.service';

export class WishlistController {
  getUserCollections = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const collections = await wishlistService.getUserCollections(req.params.userId);
      res.json({
        success: true,
        data: { collections },
      });
    } catch (error) {
      next(error);
    }
  };

  createCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const collection = await wishlistService.createCollection(req.body);
      res.status(201).json({
        success: true,
        data: { collection },
      });
    } catch (error) {
      next(error);
    }
  };

  getCollectionProducts = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.query.userId as string;
      const products = await wishlistService.getCollectionProducts(req.params.id, userId);
      res.json({
        success: true,
        data: { products },
      });
    } catch (error) {
      next(error);
    }
  };

  addProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.body.user_id;
      await wishlistService.addProductToCollection(
        req.params.id,
        req.body.product_id,
        userId
      );
      res.json({
        success: true,
        data: { message: 'Product added to collection' },
      });
    } catch (error) {
      next(error);
    }
  };

  removeProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.body.user_id;
      await wishlistService.removeProductFromCollection(
        req.params.id,
        req.params.productId,
        userId
      );
      res.json({
        success: true,
        data: { message: 'Product removed from collection' },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCollection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await wishlistService.deleteCollection(req.params.id, req.params.userId);
      res.json({
        success: true,
        data: { message: 'Collection deleted' },
      });
    } catch (error) {
      next(error);
    }
  };
}

