import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import customersRouter from './routes/customers';
import productsRouter from './routes/products';
import invoicesRouter from './routes/invoices';
import cancellationsRouter from './routes/cancellations';
import paymentsRouter from './routes/payments';
import refundsRouter from './routes/refunds';
import ordersRouter from './routes/orders';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Only2U API Documentation',
}));
app.get('/api-docs.json', (_req, res) => {
  res.json(swaggerSpec);
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    },
    error: null,
  });
});

// API Key Authorization (global)
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const path = req.path || '';
  if (path.startsWith('/api-docs') || path === '/api/health' || path === '/api-docs.json') {
    return next();
  }
  const keysEnv = (process.env.API_KEYS || process.env.API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);
  if (keysEnv.length === 0) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'AUTH_REQUIRED', message: 'API key authorization is not configured' },
    });
  }
  const headerKey = (req.headers['x-api-key'] as string) || '';
  const authHeader = (req.headers['authorization'] as string) || '';
  const bearerKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const key = headerKey || bearerKey;
  if (!key || !keysEnv.includes(key)) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { code: 'UNAUTHORIZED', message: 'Invalid or missing API key' },
    });
  }
  next();
};
app.use(apiKeyAuth);

// API Routes
app.use('/api/customers', customersRouter);
app.use('/api/products', productsRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/cancellations', cancellationsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/refunds', refundsRouter);
app.use('/api/orders', ordersRouter);



// 404 handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    data: null,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
    },
  });
});

// Error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    success: false,
    data: null,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Only2U API Server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
});
