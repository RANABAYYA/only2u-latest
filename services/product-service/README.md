# Only2U Product Service

Product catalog microservice with caching, search, and filtering capabilities.

## Features

- Product CRUD operations
- Category management
- Product variants (size/color)
- Search and filtering
- Trending products
- Redis caching
- Pagination

## Quick Start

```bash
npm install
npm run migrate
npm run dev
```

## API Endpoints

- `GET /api/products` - List products (with filters)
- `GET /api/products/:id` - Get product details
- `GET /api/products/trending` - Get trending products
- `GET /api/products/search?q=query` - Search products
- `GET /api/products/categories` - Get categories
- `POST /api/products` - Create product
- `PUT /api/products/:id` - Update product

## Environment Variables

- `PORT` - Service port (default: 3002)
- `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL config
- `REDIS_HOST`, `REDIS_PORT` - Redis config

