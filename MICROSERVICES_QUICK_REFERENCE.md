# Only2U Microservices - Quick Reference Guide

## Service Overview

| Service | Port | Database | Key Responsibility |
|---------|------|----------|-------------------|
| User Service | 3001 | PostgreSQL (users_db) | Authentication, User Management |
| Product Service | 3002 | PostgreSQL (products_db) | Product Catalog, Inventory |
| Order Service | 3003 | PostgreSQL (orders_db) | Order Management |
| Payment Service | 3004 | PostgreSQL (payments_db) | Payment Processing |
| Cart Service | 3005 | Redis + PostgreSQL | Shopping Cart |
| Wishlist Service | 3006 | PostgreSQL (collections_db) | Collections, Wishlists |
| Review Service | 3007 | PostgreSQL (reviews_db) | Reviews, Ratings |
| Chat Service | 3008 | **Cassandra** + Redis | Messaging (High Throughput) |
| Vendor Service | 3009 | PostgreSQL (vendors_db) | Vendor Management |
| Influencer Service | 3010 | PostgreSQL (influencers_db) | Influencer Management |
| Reseller Service | 3011 | PostgreSQL (resellers_db) | Reseller Management |
| Referral Service | 3012 | PostgreSQL (referrals_db) | Referral System |
| Virtual Try-On Service | 3013 | PostgreSQL (tryon_db) | Face Swap, AI |
| Notification Service | 3014 | **Cassandra** + Redis + PostgreSQL | Push, Email Notifications |
| Feedback Service | 3015 | PostgreSQL (feedback_db) | User Feedback |
| Coupon Service | 3016 | PostgreSQL (coupons_db) | Discount Codes |
| Storage Service | 3017 | PostgreSQL (storage_db) | File Management |
| Recommendation Service | 3018 | PostgreSQL + Redis | ML Recommendations |
| Analytics Service | 3019 | **Cassandra** + Redis | User Behavior, Metrics |
| Event Logging Service | 3020 | **Cassandra** | Audit Trails, Events |

---

## API Endpoints Quick Reference

### User Service
```
POST   /api/users              - Register user
POST   /api/users/login        - Login
GET    /api/users/:id          - Get user
PUT    /api/users/:id          - Update user
POST   /api/users/otp/send     - Send OTP
POST   /api/users/otp/verify   - Verify OTP
```

### Product Service
```
GET    /api/products           - List products
GET    /api/products/:id      - Get product
GET    /api/products/search   - Search products
GET    /api/products/trending - Trending products
GET    /api/categories         - List categories
```

### Order Service
```
POST   /api/orders             - Create order
GET    /api/orders/:id         - Get order
GET    /api/orders/user/:userId - User orders
PUT    /api/orders/:id/status  - Update status
POST   /api/orders/:id/cancel  - Cancel order
```

### Payment Service
```
POST   /api/payments/create-order - Create Razorpay order
POST   /api/payments/verify       - Verify payment
POST   /api/payments/refund       - Process refund
GET    /api/payments/:id          - Get payment
```

### Cart Service
```
GET    /api/cart/:userId           - Get cart
POST   /api/cart/:userId/items     - Add item
PUT    /api/cart/:userId/items/:id - Update item
DELETE /api/cart/:userId/items/:id - Remove item
POST   /api/cart/:userId/apply-coupon - Apply coupon
```

---

## Technology Stack

### Backend
- **Language**: TypeScript/Node.js
- **Framework**: Express.js
- **Databases**: PostgreSQL, Apache Cassandra
- **Cache**: Redis
- **Search**: Elasticsearch
- **Message Queue**: RabbitMQ
- **API Gateway**: Kong/NGINX

### Infrastructure
- **Containerization**: Docker
- **Orchestration**: Kubernetes
- **CI/CD**: GitHub Actions
- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack

---

## Communication Patterns

### Synchronous (HTTP/REST)
- Direct API calls via API Gateway
- Used for: User requests, real-time operations

### Asynchronous (Message Queue)
- Event-driven via RabbitMQ
- Used for: Order processing, notifications, background jobs

### Events
```
order.created
order.cancelled
payment.completed
user.registered
product.updated
```

---

## Database Strategy

### Database per Service
- Each service owns its database
- No shared databases
- Service-specific schemas

### Data Consistency
- **Saga Pattern**: For distributed transactions
- **Event Sourcing**: For audit trails
- **CQRS**: Separate read/write models

---

## Deployment

### Development
```bash
docker-compose up
```

### Production
```bash
kubectl apply -f k8s/
```

---

## Monitoring

### Key Metrics
- Request latency (p95 < 200ms)
- Error rate (< 0.1%)
- Throughput
- Service uptime (> 99.9%)

### Endpoints
- `/health` - Health check
- `/metrics` - Prometheus metrics

---

## Security

### Authentication
- JWT tokens for service-to-service
- OAuth 2.0 for user authentication
- API keys for external services

### Network
- Private networks for services
- mTLS for service-to-service
- Firewall rules

---

## Quick Commands

### Start Service
```bash
cd services/user-service
npm install
npm run dev
```

### Run Tests
```bash
npm test
```

### Build Docker Image
```bash
docker build -t only2u/user-service .
```

### Deploy to Kubernetes
```bash
kubectl apply -f k8s/user-service/
```

---

## Migration Priority

1. **Phase 1**: User, Product, Order, Payment
2. **Phase 2**: Cart, Wishlist, Review, Notification
3. **Phase 3**: Vendor, Influencer, Reseller, Referral
4. **Phase 4**: Virtual Try-On, Chat, Feedback, Recommendation

---

## Support & Resources

- **Architecture Doc**: `MICROSERVICES_ARCHITECTURE.md`
- **Implementation Guide**: `MICROSERVICES_IMPLEMENTATION_GUIDE.md`
- **API Documentation**: Swagger UI at `/api-docs`

