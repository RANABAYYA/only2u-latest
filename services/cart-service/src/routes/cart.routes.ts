import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';

const router = Router();
const cartController = new CartController();

router.get('/:userId', cartController.getCart);
router.post('/:userId/items', cartController.addItem);
router.put('/:userId/items/:itemId', cartController.updateItem);
router.delete('/:userId/items/:itemId', cartController.removeItem);
router.delete('/:userId', cartController.clearCart);

export { router as cartRoutes };

