/**
 * OTP Service for generating, storing, and validating OTPs
 * Uses in-memory storage (can be replaced with Redis or database)
 */

import { v4 as uuidv4 } from 'uuid';

interface OtpRecord {
    otp: string;
    phone: string;
    expiresAt: Date;
    attempts: number;
    verified: boolean;
}

interface SessionRecord {
    phone: string;
    createdAt: Date;
    expiresAt: Date;
    isValid: boolean;
}

// In-memory storage (replace with Redis or database in production)
const otpStore = new Map<string, OtpRecord>();
const sessionStore = new Map<string, SessionRecord>();

const OTP_LENGTH = parseInt(process.env.OTP_LENGTH || '6', 10);
const OTP_EXPIRY_SECONDS = parseInt(process.env.OTP_EXPIRY_SECONDS || '300', 10);
const MAX_ATTEMPTS = 3;
const SESSION_EXPIRY_HOURS = 24 * 7; // 7 days

/**
 * Generate a random numeric OTP
 */
const generateOtpCode = (length: number = OTP_LENGTH): string => {
    let otp = '';
    for (let i = 0; i < length; i++) {
        otp += Math.floor(Math.random() * 10).toString();
    }
    return otp;
};

/**
 * Create and store an OTP for a phone number
 */
export const createOtp = (phone: string): { otpId: string; otp: string; expiresAt: Date } => {
    const otpId = uuidv4();
    const otp = generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_SECONDS * 1000);

    otpStore.set(otpId, {
        otp,
        phone,
        expiresAt,
        attempts: 0,
        verified: false,
    });

    console.log(`[OTP] Created OTP ${otp} for ${phone}, expires at ${expiresAt.toISOString()}`);

    return { otpId, otp, expiresAt };
};

/**
 * Verify an OTP
 */
export const verifyOtp = (
    phone: string,
    otp: string,
    otpId?: string
): { success: boolean; error?: string } => {
    // If otpId is provided, use it to find the OTP
    if (otpId) {
        const record = otpStore.get(otpId);

        if (!record) {
            return { success: false, error: 'OTP session not found' };
        }

        if (record.phone !== phone) {
            return { success: false, error: 'Phone number mismatch' };
        }

        if (record.verified) {
            return { success: false, error: 'OTP already used' };
        }

        if (new Date() > record.expiresAt) {
            otpStore.delete(otpId);
            return { success: false, error: 'OTP expired' };
        }

        if (record.attempts >= MAX_ATTEMPTS) {
            otpStore.delete(otpId);
            return { success: false, error: 'Maximum attempts exceeded' };
        }

        record.attempts++;

        if (record.otp !== otp) {
            return { success: false, error: `Invalid OTP. ${MAX_ATTEMPTS - record.attempts} attempts remaining` };
        }

        record.verified = true;
        console.log(`[OTP] Verified OTP for ${phone}`);
        return { success: true };
    }

    // If no otpId, search for a matching OTP by phone
    for (const [id, record] of otpStore.entries()) {
        if (record.phone === phone && !record.verified && new Date() <= record.expiresAt) {
            record.attempts++;

            if (record.attempts > MAX_ATTEMPTS) {
                otpStore.delete(id);
                continue;
            }

            if (record.otp === otp) {
                record.verified = true;
                console.log(`[OTP] Verified OTP for ${phone}`);
                return { success: true };
            }
        }
    }

    return { success: false, error: 'Invalid or expired OTP' };
};

/**
 * Create a session token after successful OTP verification
 */
export const createSession = (phone: string): { sessionToken: string; expiresAt: Date } => {
    const sessionToken = uuidv4();
    const expiresAt = new Date(Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000);

    sessionStore.set(sessionToken, {
        phone,
        createdAt: new Date(),
        expiresAt,
        isValid: true,
    });

    console.log(`[Session] Created session for ${phone}, expires at ${expiresAt.toISOString()}`);

    return { sessionToken, expiresAt };
};

/**
 * Validate a session token
 */
export const validateSession = (sessionToken: string): { valid: boolean; phone?: string; error?: string } => {
    const session = sessionStore.get(sessionToken);

    if (!session) {
        return { valid: false, error: 'Session not found' };
    }

    if (!session.isValid) {
        return { valid: false, error: 'Session invalidated' };
    }

    if (new Date() > session.expiresAt) {
        sessionStore.delete(sessionToken);
        return { valid: false, error: 'Session expired' };
    }

    return { valid: true, phone: session.phone };
};

/**
 * Refresh a session token
 */
export const refreshSession = (sessionToken: string): { success: boolean; newToken?: string; expiresAt?: Date; error?: string } => {
    const validation = validateSession(sessionToken);

    if (!validation.valid || !validation.phone) {
        return { success: false, error: validation.error };
    }

    // Invalidate old session
    sessionStore.delete(sessionToken);

    // Create new session
    const newSession = createSession(validation.phone);

    return {
        success: true,
        newToken: newSession.sessionToken,
        expiresAt: newSession.expiresAt,
    };
};

/**
 * Invalidate a session (logout)
 */
export const invalidateSession = (sessionToken: string): { success: boolean } => {
    const session = sessionStore.get(sessionToken);

    if (session) {
        session.isValid = false;
        console.log(`[Session] Invalidated session for ${session.phone}`);
    }

    return { success: true };
};

/**
 * Clean up expired OTPs and sessions (call periodically)
 */
export const cleanup = (): void => {
    const now = new Date();

    for (const [id, record] of otpStore.entries()) {
        if (now > record.expiresAt) {
            otpStore.delete(id);
        }
    }

    for (const [token, session] of sessionStore.entries()) {
        if (now > session.expiresAt) {
            sessionStore.delete(token);
        }
    }
};

// Run cleanup every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);
