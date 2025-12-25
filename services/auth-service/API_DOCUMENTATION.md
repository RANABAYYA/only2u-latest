# Authentication Service API Documentation

## Base URL
```
http://localhost:3001/api/auth
```

## Authentication

Protected endpoints require a Bearer token in the Authorization header:
```
Authorization: Bearer <access-token>
```

---

## Endpoints

### 1. Register User

Create a new user account with email and password.

**Endpoint:** `POST /api/auth/register`

**Request Body:**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "password": "password123",
  "phone": "+919876543210" // Optional
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": null
    }
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "\"email\" must be a valid email"
      }
    ]
  }
}
```

---

### 2. Login (Email/Password)

Authenticate user with email and password.

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": null,
      "is_active": true,
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid email or password"
  }
}
```

---

### 3. Send OTP

Send OTP to phone number for authentication.

**Endpoint:** `POST /api/auth/otp/send`

**Request Body:**
```json
{
  "phone": "9876543210",
  "countryCode": "+91"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "otpId": "otp-id-from-service",
    "message": "OTP sent successfully"
  }
}
```

**Error Response (400 Bad Request):**
```json
{
  "success": false,
  "error": {
    "code": "ERROR",
    "message": "Please wait before requesting another OTP"
  }
}
```

---

### 4. Verify OTP

Verify OTP and login/register user.

**Endpoint:** `POST /api/auth/otp/verify`

**Request Body:**
```json
{
  "phone": "9876543210",
  "countryCode": "+91",
  "otp": "123456",
  "otpId": "optional-otp-id"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": null,
      "name": "User",
      "phone": "+919876543210",
      "is_active": true,
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    },
    "isNewUser": true
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid OTP"
  }
}
```

---

### 5. Refresh Token

Get new access token using refresh token.

**Endpoint:** `POST /api/auth/refresh`

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "new-jwt-access-token",
    "refreshToken": "new-jwt-refresh-token"
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid refresh token"
  }
}
```

---

### 6. Get Current User

Get authenticated user's information.

**Endpoint:** `GET /api/auth/me`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "John Doe",
      "phone": "+919876543210",
      "is_active": true,
      "created_at": "2025-01-27T10:00:00.000Z",
      "updated_at": "2025-01-27T10:00:00.000Z"
    }
  }
}
```

**Error Response (401 Unauthorized):**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "No token provided"
  }
}
```

---

### 7. Logout

Invalidate refresh token and logout user.

**Endpoint:** `POST /api/auth/logout`

**Headers:**
```
Authorization: Bearer <access-token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Request validation failed |
| `UNAUTHORIZED` | Authentication failed or token invalid |
| `NOT_FOUND` | Resource not found |
| `INTERNAL_ERROR` | Internal server error |

---

## Rate Limiting

- Default: 100 requests per 15 minutes per IP
- OTP sending: 1 request per 60 seconds per phone number

---

## Token Expiration

- **Access Token**: 7 days (configurable)
- **Refresh Token**: 30 days (configurable)

---

## Example Usage

### cURL Examples

```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","name":"John Doe","password":"password123"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Send OTP
curl -X POST http://localhost:3001/api/auth/otp/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","countryCode":"+91"}'

# Verify OTP
curl -X POST http://localhost:3001/api/auth/otp/verify \
  -H "Content-Type: application/json" \
  -d '{"phone":"9876543210","countryCode":"+91","otp":"123456"}'

# Get Current User
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer <access-token>"

# Logout
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer <access-token>"
```

### JavaScript/TypeScript Example

```typescript
// Register
const registerResponse = await fetch('http://localhost:3001/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    name: 'John Doe',
    password: 'password123',
  }),
});

const registerData = await registerResponse.json();

// Login
const loginResponse = await fetch('http://localhost:3001/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
  }),
});

const loginData = await loginResponse.json();
const { accessToken, refreshToken } = loginData.data.tokens;

// Get Current User
const meResponse = await fetch('http://localhost:3001/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});

const meData = await meResponse.json();
```

---

## Health Check

**Endpoint:** `GET /health`

**Response:**
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

