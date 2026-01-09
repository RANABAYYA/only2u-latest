-- Only2U E-Commerce API Database Schema
-- Run this SQL in your Supabase SQL Editor or via migration script

-- 1. Customer Master
CREATE TABLE IF NOT EXISTS customers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT NOT NULL,
  billing_address  TEXT,
  shipping_address TEXT,
  status        TEXT NOT NULL DEFAULT 'active', -- active | inactive
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- 2. Product Master
CREATE TABLE IF NOT EXISTS products (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku            TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  description    TEXT,
  price          NUMERIC(12,2) NOT NULL,
  mrp            NUMERIC(12,2),
  currency       TEXT NOT NULL DEFAULT 'INR',
  stock_quantity INT NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'active', -- active | inactive
  category       TEXT,
  image_urls     TEXT[] DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 3. Sale Invoice (header + items)
CREATE TABLE IF NOT EXISTS invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number  TEXT UNIQUE NOT NULL,
  customer_id     UUID NOT NULL REFERENCES customers(id),
  invoice_date    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'open', -- open | paid | cancelled | partially_paid | refunded
  currency        TEXT NOT NULL DEFAULT 'INR',
  subtotal        NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);

CREATE TABLE IF NOT EXISTS invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id),
  description     TEXT,
  quantity        INT NOT NULL,
  unit_price      NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total      NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice_items(product_id);

-- 4. Sale Cancellation
CREATE TABLE IF NOT EXISTS cancellations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id),
  reason        TEXT,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  cancel_type   TEXT NOT NULL,                  -- full | partial
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_cancellations_invoice ON cancellations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cancellations_status ON cancellations(status);

CREATE TABLE IF NOT EXISTS cancellation_items (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cancellation_id  UUID NOT NULL REFERENCES cancellations(id) ON DELETE CASCADE,
  invoice_item_id  UUID NOT NULL REFERENCES invoice_items(id),
  quantity         INT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cancellation_items_cancellation ON cancellation_items(cancellation_id);
CREATE INDEX IF NOT EXISTS idx_cancellation_items_invoice_item ON cancellation_items(invoice_item_id);

-- 5. Payments (invoice against payment)
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id),
  payment_date  TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount        NUMERIC(12,2) NOT NULL,
  method        TEXT NOT NULL, -- card | upi | netbanking | wallet | cod
  reference     TEXT,
  status        TEXT NOT NULL DEFAULT 'success', -- pending | success | failed | refunded
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_method ON payments(method);

-- 6. Refunds
CREATE TABLE IF NOT EXISTS refunds (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id),
  cancellation_id UUID REFERENCES cancellations(id),
  payment_id      UUID REFERENCES payments(id),
  refund_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
  amount          NUMERIC(12,2) NOT NULL,
  method          TEXT NOT NULL,
  reference       TEXT,
  status          TEXT NOT NULL DEFAULT 'processed', -- pending | processed | failed
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_cancellation ON refunds(cancellation_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

