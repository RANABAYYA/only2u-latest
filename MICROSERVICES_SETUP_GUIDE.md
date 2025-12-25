# Only2U Microservices Setup Guide

Complete guide to set up and run all microservices.

## Services Created

1. **Auth Service** (Port 3001) - Authentication & User Management
2. **Product Service** (Port 3002) - Product Catalog
3. **Order Service** (Port 3003) - Order Management
4. **Cart Service** (Port 3005) - Shopping Cart

## Prerequisites

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose (optional)

## Quick Start with Docker Compose

### 1. Create docker-compose.yml in root

```yaml
version: '3.8'

services:
  # Databases
  auth-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - auth-db-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  products-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: products_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - products-db-data:/var/lib/postgresql/data
    ports:
      - "5433:5432"

  orders-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: orders_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - orders-db-data:/var/lib/postgresql/data
    ports:
      - "5434:5432"

  cart-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: cart_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - cart-db-data:/var/lib/postgresql/data
    ports:
      - "5435:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

volumes:
  auth-db-data:
  products-db-data:
  orders-db-data:
  cart-db-data:
  redis-data:
```

### 2. Start Infrastructure

```bash
docker-compose up -d
```

### 3. Setup Each Service

```bash
# Auth Service
cd services/auth-service
npm install
cp .env.example .env
# Edit .env with your config
npm run migrate
npm run dev

# Product Service
cd services/product-service
npm install
npm run migrate
npm run dev

# Order Service
cd services/order-service
npm install
npm run migrate
npm run dev

# Cart Service
cd services/cart-service
npm install
npm run migrate
npm run dev
```

## Environment Variables

Each service needs its own `.env` file. See `.env.example` in each service directory.

### Common Variables

- `PORT` - Service port
- `DB_HOST` - Database host
- `DB_NAME` - Database name
- `DB_USER` - Database user
- `DB_PASSWORD` - Database password
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port

## API Endpoints Summary

### Auth Service (3001)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/otp/send`
- `POST /api/auth/otp/verify`
- `GET /api/auth/me`

### Product Service (3002)
- `GET /api/products`
- `GET /api/products/:id`
- `GET /api/products/trending`
- `GET /api/products/search`

### Order Service (3003)
- `POST /api/orders`
- `GET /api/orders/:id`
- `GET /api/orders/user/:userId`

### Cart Service (3005)
- `GET /api/cart/:userId`
- `POST /api/cart/:userId/items`
- `PUT /api/cart/:userId/items/:itemId`
- `DELETE /api/cart/:userId/items/:itemId`

## Health Checks

All services expose `/health` endpoint:

```bash
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3005/health
```

## Next Steps

1. Set up API Gateway (Kong/NGINX)
2. Configure service discovery
3. Set up monitoring (Prometheus + Grafana)
4. Configure CI/CD pipelines
5. Add remaining services (Payment, Wishlist, etc.)

