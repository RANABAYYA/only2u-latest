import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

interface GenerateOtpResponse {
  result: string;
  otpld?: string;
}

interface VerifyOtpResponse {
  result: string;
}

class OtpService {
  private baseUrl: string;
  private userId: string;
  private apiKey: string;
  private timeToAlive: number;
  private defaultMessage: string = 'your One Time Password is: {otp} Thank You';

  constructor() {
    this.baseUrl = process.env.OTP_SERVICE_URL || 'http://user.sisdial.in';
    this.userId = process.env.OTP_USER_ID || 'Only2u';
    this.apiKey = process.env.OTP_API_KEY || '';
    this.timeToAlive = parseInt(process.env.OTP_TIME_TO_ALIVE || '200');
  }

  /**
   * Generate and send OTP to mobile number
   */
  async generateOtp(
    mobileNo: string,
    timeToAlive?: number,
    message?: string
  ): Promise<{ success: boolean; otpId?: string; error?: string }> {
    try {
      const cleanMobileNo = mobileNo.trim().startsWith('+')
        ? mobileNo.trim()
        : `+${mobileNo.trim()}`;

      const params = new URLSearchParams({
        userid: this.userId,
        key: this.apiKey,
        mobileno: cleanMobileNo,
        timetoalive: (timeToAlive || this.timeToAlive).toString(),
        message: message || this.defaultMessage,
      });

      const url = `${this.baseUrl}//generateOtp.jsp?${params.toString()}`;

      console.log('[OTP Service] Generating OTP for:', cleanMobileNo);

      const response = await axios.get<GenerateOtpResponse>(url, {
        headers: {
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.result === 'success') {
        console.log('[OTP Service] OTP generated successfully, OTP ID:', response.data.otpld);
        return {
          success: true,
          otpId: response.data.otpld,
        };
      } else {
        return {
          success: false,
          error: 'Failed to generate OTP',
        };
      }
    } catch (error: any) {
      console.error('[OTP Service] Error generating OTP:', error);
      return {
        success: false,
        error: error?.message || 'Failed to generate OTP. Please try again.',
      };
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOtp(
    otp: string,
    mobileNo: string,
    otpId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const cleanMobileNo = mobileNo.trim().startsWith('+')
        ? mobileNo.trim()
        : `+${mobileNo.trim()}`;

      const cleanOtp = otp.trim().replace(/\D/g, '');

      if (cleanOtp.length !== 6) {
        return {
          success: false,
          error: 'OTP must be 6 digits',
        };
      }

      const params = new URLSearchParams({
        otp: cleanOtp,
        mobileno: cleanMobileNo,
      });

      if (otpId) {
        params.append('otpid', otpId);
      }

      const url = `${this.baseUrl}//validateOtpApi.jsp?${params.toString()}`;

      console.log('[OTP Service] Verifying OTP for:', cleanMobileNo);

      const response = await axios.get<VerifyOtpResponse>(url, {
        headers: {
          Accept: 'application/json',
        },
        timeout: 10000,
      });

      if (response.data.result === 'success') {
        console.log('[OTP Service] OTP verified successfully');
        return {
          success: true,
        };
      } else {
        return {
          success: false,
          error: 'Invalid OTP code',
        };
      }
    } catch (error: any) {
      console.error('[OTP Service] Error verifying OTP:', error);
      return {
        success: false,
        error: error?.message || 'Failed to verify OTP. Please try again.',
      };
    }
  }
}

export const otpService = new OtpService();
export default otpService;

