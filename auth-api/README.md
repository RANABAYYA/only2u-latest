# Only2U WhatsApp Authentication API

A REST API for WhatsApp OTP-based authentication with Swagger documentation.

## Features

- 📱 WhatsApp OTP authentication via Meta Graph API
- 🔐 Session token management
- 📚 Swagger/OpenAPI documentation
- 🛡️ API key authentication (optional)

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/send-otp` | Send OTP via WhatsApp |
| POST | `/api/auth/verify-otp` | Verify OTP and get session token |
| POST | `/api/auth/refresh` | Refresh session token |
| POST | `/api/auth/logout` | Invalidate session |
| POST | `/api/auth/validate` | Validate session token |
| GET | `/api/health` | Health check |

## Quick Start

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your WhatsApp API credentials
# WHATSAPP_ACCESS_TOKEN=your_token_here

# Start development server
npm run dev
```

Open http://localhost:4001/api-docs for Swagger documentation.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `4001` |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business phone ID | - |
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API access token | - |
| `OTP_EXPIRY_SECONDS` | OTP validity duration | `300` |
| `OTP_LENGTH` | OTP digit count | `6` |
| `API_KEYS` | Comma-separated API keys (optional) | - |

## API Usage

### Send OTP
```bash
curl -X POST http://localhost:4001/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

### Verify OTP
```bash
curl -X POST http://localhost:4001/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210", "otp": "123456", "otpId": "uuid-from-send-otp"}'
```

## Production Deployment

```bash
# Build
npm run build

# Start
npm start
```

## License

MIT
