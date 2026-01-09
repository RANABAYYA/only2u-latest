import { Router } from 'express';
import { CouponController } from '../controllers/coupon.controller';

const router = Router();
const couponController = new CouponController();

router.get('/', couponController.getCoupons);
router.get('/code/:code', couponController.getCouponByCode);
router.post('/validate', couponController.validateCoupon);
router.post('/redeem', couponController.redeemCoupon);
router.post('/', couponController.createCoupon);
router.get('/user/:userId', couponController.getUserCoupons);

export { router as couponRoutes };

