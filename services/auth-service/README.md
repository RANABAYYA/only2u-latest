# Only2U Authentication Microservice

A standalone authentication microservice for the Only2U platform supporting email/password and OTP-based authentication.

## Features

- ✅ Email/Password authentication
- ✅ OTP-based authentication (SMS via Sisdial API)
- ✅ JWT token generation (access + refresh tokens)
- ✅ User registration and management
- ✅ Rate limiting
- ✅ Redis caching for sessions and OTP
- ✅ PostgreSQL database
- ✅ Health checks
- ✅ Request logging
- ✅ Input validation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL 15+
- **Cache**: Redis 7+
- **Authentication**: JWT
- **OTP Service**: Sisdial API

## Project Structure

```
auth-service/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Auth, validation, error handling
│   ├── migrations/      # Database migrations
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── server.ts        # Entry point
├── dist/                # Compiled JavaScript
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── README.md
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Database Setup

```bash
# Run migrations
npm run migrate
```

### Development

```bash
# Start in development mode
npm run dev
```

### Production

```bash
# Build
npm run build

# Start
npm start
```

### Docker

```bash
# Start all services (PostgreSQL, Redis, Auth Service)
docker-compose up -d

# View logs
docker-compose logs -f auth-service

# Stop services
docker-compose down
```

## API Endpoints

### Public Endpoints

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123"
}
```

#### Login (Email/Password)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Send OTP
```http
POST /api/auth/otp/send
Content-Type: application/json

{
  "phone": "9876543210",
  "countryCode": "+91"
}
```

#### Verify OTP
```http
POST /api/auth/otp/verify
Content-Type: application/json

{
  "phone": "9876543210",
  "countryCode": "+91",
  "otp": "123456",
  "otpId": "optional-otp-id"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "your-refresh-token"
}
```

### Protected Endpoints

#### Get Current User
```http
GET /api/auth/me
Authorization: Bearer <access-token>
```

#### Logout
```http
POST /api/auth/logout
Authorization: Bearer <access-token>
```

## Environment Variables

See `.env.example` for all available environment variables.

### Required Variables

- `PORT` - Service port (default: 3001)
- `DB_HOST` - PostgreSQL host
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `JWT_SECRET` - JWT signing secret
- `JWT_REFRESH_SECRET` - JWT refresh token secret
- `OTP_API_KEY` - Sisdial API key

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Testing

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## Health Check

```bash
curl http://localhost:3001/health
```

Response:
```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "auth-service",
    "timestamp": "2025-01-27T10:00:00.000Z"
  }
}
```

## Security Features

- ✅ Helmet.js for security headers
- ✅ Rate limiting
- ✅ Input validation (Joi)
- ✅ Password hashing (bcrypt)
- ✅ JWT token expiration
- ✅ Refresh token rotation
- ✅ OTP rate limiting

## Monitoring

The service includes:
- Request logging
- Error logging
- Health check endpoint
- Prometheus metrics (optional)

## License

MIT

