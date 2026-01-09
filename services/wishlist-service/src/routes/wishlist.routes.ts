import { Router } from 'express';
import { WishlistController } from '../controllers/wishlist.controller';

const router = Router();
const wishlistController = new WishlistController();

router.get('/user/:userId', wishlistController.getUserCollections);
router.post('/', wishlistController.createCollection);
router.get('/:id/products', wishlistController.getCollectionProducts);
router.post('/:id/products', wishlistController.addProduct);
router.delete('/:id/products/:productId', wishlistController.removeProduct);
router.delete('/:id/user/:userId', wishlistController.deleteCollection);

export { router as wishlistRoutes };

