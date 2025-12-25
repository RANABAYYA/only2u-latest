export const sendWhatsAppOTP = async (phone: string, otp: string) => {
    try {
        const response = await fetch('https://graph.facebook.com/v24.0/843863555484641/messages', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer EAAbUzyQQgW4BQI1Nn7gcwZCZBCUbKh17YbsMiqgYmENeZCSh9f6erf85LAKvl2hHglyxPxGYP4pdIci9AXnxwkrAyGx0Bx9i3OYglYLNZACPbeMIwHUSEfpe355BvRBU6vsyyqo2tmZCdFPajxlWxXXoTyRNGM2pIGLpyMzEHhx7rZCkFwS7ze0vN4AtLwcwZDZD',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                to: phone,
                type: "template",
                template: {
                    name: "otp_new",
                    language: {
                        code: "en_US"
                    },
                    components: [
                        {
                            type: "body",
                            parameters: [
                                {
                                    type: "text",
                                    text: otp
                                }
                            ]
                        },
                        {
                            type: "button",
                            sub_type: "url",
                            index: "0",
                            parameters: [
                                {
                                    type: "text",
                                    text: otp
                                }
                            ]
                        }
                    ]
                }
            }),
        });

        const data = await response.json();
        if (!response.ok) {
            console.error('WhatsApp API Error:', data);
            throw new Error(data?.error?.message || 'Failed to send WhatsApp OTP');
        }
        return data;
    } catch (error) {
        console.error('Send WhatsApp OTP Error:', error);
        throw error;
    }
};
