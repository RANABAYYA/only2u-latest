import { Request, Response, NextFunction } from 'express';
import { paymentService } from '../services/payment.service';

export class PaymentController {
  createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { amount, currency, receipt } = req.body;
      const order = await paymentService.createOrder(amount, currency, receipt);
      res.json({
        success: true,
        data: { order },
      });
    } catch (error: any) {
      error.statusCode = 400;
      next(error);
    }
  };

  verifyPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payment = await paymentService.verifyPayment(req.body);
      res.json({
        success: true,
        data: { payment },
      });
    } catch (error: any) {
      error.statusCode = 400;
      next(error);
    }
  };

  createPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payment = await paymentService.createPayment(req.body);
      res.status(201).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  };

  processRefund = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payment = await paymentService.processRefund(req.body);
      res.json({
        success: true,
        data: { payment },
      });
    } catch (error: any) {
      error.statusCode = 400;
      next(error);
    }
  };

  getPayment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payment = await paymentService.getPaymentById(req.params.id);
      if (!payment) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Payment not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      next(error);
    }
  };

  getPaymentsByOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const payments = await paymentService.getPaymentsByOrderId(req.params.orderId);
      res.json({
        success: true,
        data: { payments },
      });
    } catch (error) {
      next(error);
    }
  };

  handleWebhook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const event = req.headers['x-razorpay-event'] as string;
      await paymentService.handleWebhook(event, req.body);
      res.json({ success: true });
    } catch (error: any) {
      error.statusCode = 400;
      next(error);
    }
  };
}

