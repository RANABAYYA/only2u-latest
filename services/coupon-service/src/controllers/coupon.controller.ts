import { Request, Response, NextFunction } from 'express';
import { couponService } from '../services/coupon.service';

export class CouponController {
  getCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string;
      const coupons = await couponService.getAvailableCoupons(userId);
      res.json({
        success: true,
        data: { coupons },
      });
    } catch (error) {
      next(error);
    }
  };

  getCouponByCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupon = await couponService.getCouponByCode(req.params.code);
      if (!coupon) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Coupon not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: { coupon },
      });
    } catch (error) {
      next(error);
    }
  };

  validateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await couponService.validateCoupon(req.body);
      res.json({
        success: result.valid,
        data: result.valid
          ? { coupon: result.coupon, discount_amount: result.discount_amount }
          : null,
        error: result.valid ? null : { code: 'INVALID_COUPON', message: result.error },
      });
    } catch (error) {
      next(error);
    }
  };

  redeemCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { user_id, coupon_id, order_id, discount_amount } = req.body;
      await couponService.redeemCoupon(user_id, coupon_id, order_id, discount_amount);
      res.json({
        success: true,
        data: { message: 'Coupon redeemed successfully' },
      });
    } catch (error) {
      next(error);
    }
  };

  createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupon = await couponService.createCoupon(req.body);
      res.status(201).json({
        success: true,
        data: { coupon },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const coupons = await couponService.getUserCoupons(req.params.userId);
      res.json({
        success: true,
        data: { coupons },
      });
    } catch (error) {
      next(error);
    }
  };
}

