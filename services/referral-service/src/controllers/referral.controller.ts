import { Request, Response, NextFunction } from 'express';
import { referralService } from '../services/referral.service';

export class ReferralController {
  generateCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const referralCode = await referralService.generateReferralCode(req.params.userId);
      res.json({
        success: true,
        data: { referralCode },
      });
    } catch (error) {
      next(error);
    }
  };

  validateCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await referralService.validateReferralCode(req.params.code);
      res.json({
        success: result.valid,
        data: result.valid ? { referralCode: result.referralCode } : null,
        error: result.valid ? null : { code: 'INVALID_CODE', message: result.error },
      });
    } catch (error) {
      next(error);
    }
  };

  redeemCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await referralService.redeemReferralCode(req.body);
      res.json({
        success: result.success,
        data: result.success ? { welcomeCoupon: result.welcomeCoupon } : null,
        error: result.success ? null : { code: 'REDEMPTION_FAILED', message: result.error },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const stats = await referralService.getUserReferralStats(req.params.userId);
      res.json({
        success: true,
        data: { stats },
      });
    } catch (error) {
      next(error);
    }
  };
}

