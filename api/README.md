# Only2U E-Commerce API

RESTful API for Only2U e-commerce platform built with Node.js, Express, TypeScript, and PostgreSQL (via Supabase).

## Features

- ✅ **Customer Master** - CRUD operations for customers
- ✅ **Product Master** - CRUD operations for products with stock management
- ✅ **Sale Invoice Transactions** - Create invoices with line items, automatic stock deduction
- ✅ **Sale Cancellation** - Full/partial cancellations with automatic stock restoration
- ✅ **Sale Invoice Against Payment** - Payment processing with invoice balance updates
- ✅ **Refund Against Cancellation** - Refund management linked to cancellations and payments

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL (via Supabase)
- **ORM:** pg (PostgreSQL client)

## Setup

### 1. Install Dependencies

```bash
cd api
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update with your Supabase database connection string:

```bash
cp .env.example .env
```

Edit `.env`:
```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.ljnheixbsweamlbntwvh.supabase.co:5432/postgres
PORT=4000
CORS_ORIGINS=http://localhost:3000,http://localhost:8081
```

**To get your Supabase connection string:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings** → **Database**
4. Copy the **Connection string** (URI format)
5. Replace `[YOUR-PASSWORD]` with your database password

### 3. Create Database Tables

Run the SQL schema in your Supabase SQL Editor:

1. Go to Supabase Dashboard → **SQL Editor**
2. Copy contents of `schema.sql`
3. Paste and execute

Or use the migration script:
```bash
npm run build
npm run migrate
```

### 4. Start the Server

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

Server will run on `http://localhost:4000`

## 📚 API Documentation (Swagger)

**Interactive Swagger UI is available at:**
- **http://localhost:4000/api-docs**

Once the server is running, open this URL in your browser to:
- Browse all API endpoints
- See request/response schemas
- Test API calls directly from the browser
- View example requests and responses

**Raw OpenAPI JSON spec:**
- **http://localhost:4000/api-docs.json** (can be imported into Postman, Insomnia, etc.)

## API Endpoints

### Health Check
```
GET /api/health
```

### Customer Master
```
GET    /api/customers              # List customers (query: ?q=, ?status=, ?page=, ?limit=)
GET    /api/customers/:id          # Get customer
POST   /api/customers              # Create customer
PUT    /api/customers/:id          # Update customer
DELETE /api/customers/:id         # Soft delete customer
```

### Product Master
```
GET    /api/products               # List products (query: ?q=, ?category=, ?status=, ?min_price=, ?max_price=)
GET    /api/products/:id           # Get product
POST   /api/products               # Create product
PUT    /api/products/:id          # Update product
PATCH  /api/products/:id/stock    # Update stock (body: {delta: -1} or {stock_quantity: 10})
DELETE /api/products/:id          # Soft delete product
```

### Sale Invoice Transactions
```
GET    /api/invoices               # List invoices (query: ?customer_id=, ?status=, ?from_date=, ?to_date=)
GET    /api/invoices/:id           # Get invoice with items
POST   /api/invoices               # Create invoice (body includes items array)
```

### Sale Cancellation
```
GET    /api/cancellations          # List cancellations (query: ?invoice_id=, ?status=)
GET    /api/cancellations/:id     # Get cancellation with items
POST   /api/cancellations         # Create cancellation (body: {invoice_id, cancel_type: 'full'|'partial', reason, items?})
POST   /api/cancellations/:id/approve  # Approve cancellation
POST   /api/cancellations/:id/reject   # Reject cancellation
```

### Payments
```
GET    /api/payments               # List payments (query: ?invoice_id=, ?status=, ?method=)
GET    /api/payments/:id           # Get payment
POST   /api/payments               # Create payment (body: {invoice_id, amount, method, reference?})
POST   /api/payments/:id/mark-success  # Mark payment as successful
POST   /api/payments/:id/mark-failed    # Mark payment as failed
```

### Refunds
```
GET    /api/refunds                # List refunds (query: ?invoice_id=, ?payment_id=, ?cancellation_id=, ?status=)
GET    /api/refunds/:id            # Get refund
POST   /api/refunds                # Create refund (body: {invoice_id, cancellation_id?, payment_id?, amount, method, reference?})
POST   /api/refunds/:id/mark-failed     # Mark refund as failed
```

## Request/Response Format

All responses follow this format:

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

**Error:**
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error message"
  }
}
```

## Example Requests

### Create Customer
```bash
curl -X POST http://localhost:4000/api/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nischal R",
    "email": "user@example.com",
    "phone": "+919876543210",
    "billing_address": "123 Main St, City, State, PIN"
  }'
```

### Create Product
```bash
curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-001",
    "name": "Pink Pattu Saree",
    "description": "Silk saree with gold border",
    "price": 2500,
    "mrp": 5000,
    "stock_quantity": 10,
    "category": "Sarees",
    "image_urls": ["https://example.com/image.jpg"]
  }'
```

### Create Invoice
```bash
curl -X POST http://localhost:4000/api/invoices \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "customer-uuid",
    "currency": "INR",
    "items": [
      {
        "product_id": "product-uuid",
        "quantity": 1,
        "unit_price": 2500,
        "discount_amount": 0,
        "tax_amount": 125
      }
    ],
    "discount_amount": 200,
    "tax_amount": 150
  }'
```

### Create Payment
```bash
curl -X POST http://localhost:4000/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "invoice_id": "invoice-uuid",
    "amount": 1000,
    "method": "upi",
    "reference": "TXN123456"
  }'
```

## Database Schema

See `schema.sql` for complete database schema with all tables, indexes, and relationships.

## Development

```bash
# Watch mode (auto-restart on changes)
npm run dev

# Build TypeScript
npm run build

# Run migrations
npm run migrate
```

## Production Deployment

1. Build the project: `npm run build`
2. Set environment variables
3. Run migrations: `npm run migrate`
4. Start server: `npm start`

## Notes

- All timestamps are in UTC
- All monetary values use NUMERIC(12,2) for precision
- Soft deletes are used (status = 'inactive') instead of hard deletes
- Stock is automatically updated when invoices are created/cancelled
- Invoice balances are automatically updated when payments are made
- Payment status is automatically updated when refunds are processed

## License

MIT

