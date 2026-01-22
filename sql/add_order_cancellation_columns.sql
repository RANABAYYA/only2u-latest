-- Add cancellation columns to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
ADD COLUMN IF NOT EXISTS cancellation_description TEXT,
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Add comment for documentation
COMMENT ON COLUMN orders.cancellation_reason IS 'The reason for order cancellation selected by user';
COMMENT ON COLUMN orders.cancellation_description IS 'Additional details provided by user for cancellation';
COMMENT ON COLUMN orders.cancelled_at IS 'Timestamp when the order was cancelled';
