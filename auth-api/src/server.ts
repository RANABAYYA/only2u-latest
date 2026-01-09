import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

import authRouter from './routes/auth';
import { swaggerSpec } from './config/swagger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors({
    origin: '*',
    credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Only2U Auth API Documentation',
}));
app.get('/api-docs.json', (_req, res) => {
    res.json(swaggerSpec);
});

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: ok
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: 1.0.0
 */
app.get('/api/health', (_req, res) => {
    res.json({
        success: true,
        data: {
            status: 'ok',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
        },
        error: null,
    });
});

// API Key Authorization (optional - can be disabled for public auth endpoints)
const apiKeyAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const path = req.path || '';

    // Skip auth for docs and health check
    if (path.startsWith('/api-docs') || path === '/api/health' || path === '/api-docs.json') {
        return next();
    }

    // Check if API key auth is enabled
    const keysEnv = (process.env.API_KEYS || process.env.API_KEY || '').split(',').map(k => k.trim()).filter(Boolean);

    // If no API keys configured, allow all requests (for development)
    if (keysEnv.length === 0) {
        return next();
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
app.use('/api/auth', authRouter);

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
    console.log(`🚀 Only2U Auth API Server running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
});
