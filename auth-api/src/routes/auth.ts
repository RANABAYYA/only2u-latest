import { Router, Request, Response } from 'express';
import { sendWhatsAppOTP } from '../services/whatsappService';
import {
    createOtp,
    verifyOtp,
    createSession,
    refreshSession,
    invalidateSession,
    validateSession,
} from '../services/otpService';

const router = Router();

/**
 * @openapi
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP via WhatsApp
 *     description: Generates a 6-digit OTP and sends it to the specified phone number via WhatsApp
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SendOtpRequest'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SendOtpResponse'
 *       400:
 *         description: Invalid request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Failed to send OTP
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/send-otp', async (req: Request, res: Response) => {
    try {
        const { phone, countryCode } = req.body;

        if (!phone) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_REQUEST', message: 'Phone number is required' },
            });
        }

        // Normalize phone number
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+') && countryCode) {
            normalizedPhone = `+${countryCode}${normalizedPhone}`;
        } else if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = `+91${normalizedPhone}`; // Default to India
        }

        // Create OTP
        const { otpId, otp, expiresAt } = createOtp(normalizedPhone);

        // Send via WhatsApp
        const result = await sendWhatsAppOTP(normalizedPhone, otp);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                data: null,
                error: { code: 'SEND_FAILED', message: result.error || 'Failed to send OTP' },
            });
        }

        res.json({
            success: true,
            data: {
                otpId,
                expiresAt: expiresAt.toISOString(),
                message: 'OTP sent successfully via WhatsApp',
            },
            error: null,
        });
    } catch (error: any) {
        console.error('[Auth] Send OTP error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to send OTP' },
        });
    }
});

/**
 * @openapi
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and create session
 *     description: Verifies the OTP and returns a session token on success
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VerifyOtpRequest'
 *     responses:
 *       200:
 *         description: OTP verified successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VerifyOtpResponse'
 *       400:
 *         description: Invalid OTP or request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
    try {
        const { phone, otp, otpId } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_REQUEST', message: 'Phone and OTP are required' },
            });
        }

        // Normalize phone number
        let normalizedPhone = phone.trim();
        if (!normalizedPhone.startsWith('+')) {
            normalizedPhone = `+91${normalizedPhone}`;
        }

        // Verify OTP
        const verification = verifyOtp(normalizedPhone, otp.trim(), otpId);

        if (!verification.success) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_OTP', message: verification.error || 'Invalid OTP' },
            });
        }

        // Create session
        const { sessionToken, expiresAt } = createSession(normalizedPhone);

        res.json({
            success: true,
            data: {
                verified: true,
                sessionToken,
                expiresAt: expiresAt.toISOString(),
                user: {
                    phone: normalizedPhone,
                    isNewUser: false, // Can be determined by checking database
                },
            },
            error: null,
        });
    } catch (error: any) {
        console.error('[Auth] Verify OTP error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to verify OTP' },
        });
    }
});

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Refresh session token
 *     description: Generates a new session token from an existing valid token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenRequest'
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 *       401:
 *         description: Invalid or expired session
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_REQUEST', message: 'Session token is required' },
            });
        }

        const result = refreshSession(sessionToken);

        if (!result.success) {
            return res.status(401).json({
                success: false,
                data: null,
                error: { code: 'INVALID_SESSION', message: result.error || 'Invalid session' },
            });
        }

        res.json({
            success: true,
            data: {
                sessionToken: result.newToken,
                expiresAt: result.expiresAt?.toISOString(),
            },
            error: null,
        });
    } catch (error: any) {
        console.error('[Auth] Refresh error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to refresh session' },
        });
    }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Logout and invalidate session
 *     description: Invalidates the session token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *     responses:
 *       200:
 *         description: Logged out successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LogoutResponse'
 */
router.post('/logout', async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_REQUEST', message: 'Session token is required' },
            });
        }

        invalidateSession(sessionToken);

        res.json({
            success: true,
            data: {
                message: 'Logged out successfully',
            },
            error: null,
        });
    } catch (error: any) {
        console.error('[Auth] Logout error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to logout' },
        });
    }
});

/**
 * @openapi
 * /auth/validate:
 *   post:
 *     summary: Validate session token
 *     description: Checks if a session token is valid
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - sessionToken
 *             properties:
 *               sessionToken:
 *                 type: string
 *                 description: Session token to validate
 *     responses:
 *       200:
 *         description: Session validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     valid:
 *                       type: boolean
 *                     phone:
 *                       type: string
 *                 error:
 *                   nullable: true
 */
router.post('/validate', async (req: Request, res: Response) => {
    try {
        const { sessionToken } = req.body;

        if (!sessionToken) {
            return res.status(400).json({
                success: false,
                data: null,
                error: { code: 'INVALID_REQUEST', message: 'Session token is required' },
            });
        }

        const result = validateSession(sessionToken);

        res.json({
            success: true,
            data: {
                valid: result.valid,
                phone: result.phone,
            },
            error: result.valid ? null : { code: 'INVALID_SESSION', message: result.error },
        });
    } catch (error: any) {
        console.error('[Auth] Validate error:', error);
        res.status(500).json({
            success: false,
            data: null,
            error: { code: 'INTERNAL_ERROR', message: error.message || 'Failed to validate session' },
        });
    }
});

export default router;
