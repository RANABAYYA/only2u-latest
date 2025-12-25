import { Platform } from 'react-native';

// Use localhost for iOS simulator, special IP for Android emulator
const BASE_URL = Platform.select({
    ios: 'http://localhost:3001/api/auth',
    android: 'http://10.0.2.2:3001/api/auth',
});

interface SendOtpResponse {
    success: boolean;
    data?: {
        otpId: string;
        message: string;
    };
    error?: {
        code: string;
        message: string;
    };
}

interface VerifyOtpResponse {
    success: boolean;
    data?: {
        user: any;
        tokens: {
            accessToken: string;
            refreshToken: string;
        };
        isNewUser?: boolean;
    };
    error?: {
        code: string;
        message: string;
    };
}

class AuthServiceApi {
    /**
     * Send OTP to phone number
     */
    async sendOtp(phone: string): Promise<SendOtpResponse> {
        try {
            const response = await fetch(`${BASE_URL}/otp/send`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    countryCode: '', // Phone already includes country code in our app logic usually
                }),
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error('[AuthService] Send OTP error:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: error.message || 'Network request failed',
                },
            };
        }
    }

    /**
     * Verify OTP and Login
     */
    async verifyOtp(phone: string, otp: string, otpId?: string): Promise<VerifyOtpResponse> {
        try {
            const response = await fetch(`${BASE_URL}/otp/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    countryCode: '', // Phone already includes country code
                    otp: otp,
                    otpId: otpId,
                }),
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error('[AuthService] Verify OTP error:', error);
            return {
                success: false,
                error: {
                    code: 'NETWORK_ERROR',
                    message: error.message || 'Network request failed',
                },
            };
        }
    }
}

export const authServiceApi = new AuthServiceApi();
export default authServiceApi;
