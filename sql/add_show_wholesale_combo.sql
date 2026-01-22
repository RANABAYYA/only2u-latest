-- Add global setting for Wholesale Combo Offer visibility
-- This controls whether the Wholesale Combo Offer section is shown for ALL products

-- Insert the setting (or update if it exists)
INSERT INTO settings (key, value, description)
VALUES (
  'show_wholesale_combo',
  'false',
  'Controls visibility of the Wholesale Combo Offer section in product details. Set to "true" to show, "false" to hide for all products.'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  updated_at = NOW();

-- Success message
SELECT 'Added show_wholesale_combo global setting! 🎉' as status;
