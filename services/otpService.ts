/**
 * Custom SMS OTP Service
 * Uses Sisdial API for OTP generation and verification
 */

interface GenerateOtpResponse {
  result: string;
  otpld?: string;
}

interface VerifyOtpResponse {
  result: string;
}

class OtpService {
  private baseUrl: string = 'http://user.sisdial.in';
  private userId: string = 'Only2u';
  private apiKey: string = 'b045bb17afXX'; // TODO: Move to environment variables
  private defaultTimeToAlive: number = 200; // 200 seconds = ~3.3 minutes
  private defaultMessage: string = 'your One Time Password is: {otp} Thank You';

  /**
   * Generate and send OTP to mobile number
   * @param mobileNo - Mobile number with country code (e.g., +918977835352)
   * @param timeToAlive - OTP validity in seconds (default: 200)
   * @param message - Custom message template with {otp} placeholder
   * @returns Promise with OTP ID if successful
   */
  async generateOtp(
    mobileNo: string,
    timeToAlive: number = this.defaultTimeToAlive,
    message: string = this.defaultMessage
  ): Promise<{ success: boolean; otpId?: string; error?: string }> {
    try {
      // Clean mobile number (remove spaces, ensure + prefix)
      const cleanMobileNo = mobileNo.trim().startsWith('+')
        ? mobileNo.trim()
        : `+${mobileNo.trim()}`;

      // Build URL with query parameters
      const params = new URLSearchParams({
        userid: this.userId,
        key: this.apiKey,
        mobileno: cleanMobileNo,
        timetoalive: timeToAlive.toString(),
        message: message,
      });

      const url = `${this.baseUrl}//generateOtp.jsp?${params.toString()}`;

      console.log('[OTP Service] Generating OTP for:', cleanMobileNo);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to generate OTP: HTTP ${response.status}`,
        };
      }

      const data: GenerateOtpResponse = await response.json();

      if (data.result === 'success') {
        console.log('[OTP Service] OTP generated successfully, OTP ID:', data.otpld);
        return {
          success: true,
          otpId: data.otpld,
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
   * @param otp - 6-digit OTP code
   * @param mobileNo - Mobile number with country code (e.g., +918977835352)
   * @param otpId - Optional OTP ID from generateOtp response
   * @returns Promise with verification result
   */
  async verifyOtp(
    otp: string,
    mobileNo: string,
    otpId?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Clean mobile number
      const cleanMobileNo = mobileNo.trim().startsWith('+')
        ? mobileNo.trim()
        : `+${mobileNo.trim()}`;

      // Clean OTP (remove spaces, ensure it's numeric)
      const cleanOtp = otp.trim().replace(/\D/g, '');

      if (cleanOtp.length !== 6) {
        return {
          success: false,
          error: 'OTP must be 6 digits',
        };
      }

      // Build URL with query parameters
      const params = new URLSearchParams({
        otp: cleanOtp,
        mobileno: cleanMobileNo,
      });

      // Add optional otpid if provided
      if (otpId) {
        params.append('otpid', otpId);
      }

      const url = `${this.baseUrl}//validateOtpApi.jsp?${params.toString()}`;

      console.log('[OTP Service] Verifying OTP for:', cleanMobileNo);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to verify OTP: HTTP ${response.status}`,
        };
      }

      const data: VerifyOtpResponse = await response.json();

      if (data.result === 'success') {
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

// Export singleton instance
const otpService = new OtpService();
export default otpService;

