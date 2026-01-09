/**
 * WhatsApp Service for sending OTP messages via Meta Graph API
 */

interface WhatsAppResponse {
    messages?: Array<{ id: string }>;
    error?: {
        message: string;
        type: string;
        code: number;
    };
}

const WHATSAPP_API_URL = 'https://graph.facebook.com/v24.0';

export const sendWhatsAppOTP = async (phone: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> => {
    try {
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '843863555484641';
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

        if (!accessToken) {
            console.error('[WhatsApp] Access token not configured');
            return { success: false, error: 'WhatsApp service not configured' };
        }

        // Clean phone number - ensure it has country code
        const cleanPhone = phone.replace(/\s+/g, '').replace(/^0+/, '');
        const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone.slice(1) : cleanPhone;

        const response = await fetch(`${WHATSAPP_API_URL}/${phoneNumberId}/messages`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'template',
                template: {
                    name: 'otp_new',
                    language: {
                        code: 'en_US',
                    },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                {
                                    type: 'text',
                                    text: otp,
                                },
                            ],
                        },
                        {
                            type: 'button',
                            sub_type: 'url',
                            index: '0',
                            parameters: [
                                {
                                    type: 'text',
                                    text: otp,
                                },
                            ],
                        },
                    ],
                },
            }),
        });

        const data: WhatsAppResponse = await response.json();

        if (!response.ok || data.error) {
            console.error('[WhatsApp] API Error:', data.error);
            return {
                success: false,
                error: data.error?.message || 'Failed to send WhatsApp OTP',
            };
        }

        console.log('[WhatsApp] OTP sent successfully to:', formattedPhone);
        return {
            success: true,
            messageId: data.messages?.[0]?.id,
        };
    } catch (error: any) {
        console.error('[WhatsApp] Exception:', error);
        return {
            success: false,
            error: error?.message || 'Failed to send WhatsApp OTP',
        };
    }
};
