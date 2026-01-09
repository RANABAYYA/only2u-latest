import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';

const router = Router();
const paymentController = new PaymentController();

router.post('/create-order', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/', paymentController.createPayment);
router.post('/refund', paymentController.processRefund);
router.get('/:id', paymentController.getPayment);
router.get('/order/:orderId', paymentController.getPaymentsByOrder);
router.post('/webhook', paymentController.handleWebhook);

export { router as paymentRoutes };

