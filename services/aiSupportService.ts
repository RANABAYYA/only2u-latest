import { GoogleGenerativeAI } from '@google/generative-ai';
// Supabase import removed

// Initialize Gemini API
// Note: In a real app, use an environment variable or secure config
const GEMINI_API_KEY = 'AIzaSyDTa8QoBeKFFjFcj8RzBxOPa61_IxQlkVA'; // Placeholder

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const SYSTEM_PROMPT = `
You are the AI Support Assistant for "Only2U", a premier reseller platform.
Your goal is to help users (resellers) with their inquiries about orders, margins, products, and app usage.

**App Context:**
- **Only2U** is a platform where users can resell products (clothing, accessories) and earn a profit.
- **Resellers** share catalogs/products on social media (WhatsApp, Instagram).
- **Margins:** Resellers set their own profit margin on top of the base price.
- **Payouts:** Earnings are paid out to the reseller's bank account after the return period (usually 7 days) is over.
- **Orders:** Resellers place orders on behalf of their customers.

**Guidelines:**
1.  **Be Helpful & Polite:** Always be courteous and professional.
2.  **Concise Answers:** Keep responses short and easy to read on a mobile screen.
3.  **Escalation:** If you cannot answer a question or if it requires human intervention (e.g., specific refund status, technical bug, account ban), politely say you will flag this for a human agent.
4.  **Formatting:** You can use simple bolding or lists if needed, but avoid complex markdown.
5.  **Identity:** Identify yourself as "Only2U Assistant" if asked.

**Common Topics:**
- *Tracking:* "Check 'My Orders' section for live tracking."
- *Returns:* "We accept returns within 7 days. Go to 'My Orders' -> Select Order -> 'Return'."
- *Payments:* "Payouts are processed every Tuesday/Friday after the return period ends."

If the user asks about a specific Order ID that providing a generic answer regarding how to check status is best unless you are provided context. 
`;

export const aiSupportService = {
    async generateResponse(userMessage: string, chatHistory: { role: 'user' | 'model'; parts: string }[] = []) {
        if (!GEMINI_API_KEY) {
            console.warn('Gemini API Key is missing. AI support is disabled.');
            return null;
        }

        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            // Construct the chat history with system prompt
            // Gemini Pro doesn't strictly support "system" role in history arrays in all client versions yet,
            // so we often prepend it to the first message or use specific config.
            // For simplicity here, we prepend context to the first message or rely on the prompt context window.

            const chat = model.startChat({
                history: [
                    {
                        role: 'user',
                        parts: [{ text: SYSTEM_PROMPT + "\n\nHello" }]
                    },
                    {
                        role: 'model',
                        parts: [{ text: "Hello! I am the Only2U Support Assistant. How can I help you today?" }]
                    },
                    ...chatHistory.map(msg => ({
                        role: msg.role,
                        parts: [{ text: msg.parts }]
                    }))
                ],
            });

            const result = await chat.sendMessage(userMessage);
            const response = result.response;
            return response.text();
        } catch (error) {
            console.error('Error generating AI response:', error);
            return null;
        }
    },

    // logAiResponse method removed as per user request for local-only chat
};
