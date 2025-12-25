import { Router } from 'express';
import { ReferralController } from '../controllers/referral.controller';

const router = Router();
const referralController = new ReferralController();

router.get('/user/:userId/generate', referralController.generateCode);
router.get('/validate/:code', referralController.validateCode);
router.post('/redeem', referralController.redeemCode);
router.get('/user/:userId/stats', referralController.getUserStats);

export { router as referralRoutes };

