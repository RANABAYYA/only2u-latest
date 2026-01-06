-- ============================================================================
-- Fix Foreign Key Constraints for User Account Linking
-- ============================================================================
-- This script updates foreign key constraints in your Supabase database.
-- It changes the behavior of user_id relationships to "ON UPDATE CASCADE".
-- This allows the app to update a User's ID (to link an old account to a new session)
-- without being blocked by existing orders, addresses, etc.
-- ============================================================================

BEGIN;

-- 1. ORDERS Table
-- Drop existing FK
ALTER TABLE IF EXISTS public.orders
DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Re-add with ON UPDATE CASCADE
ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL; -- Or CASCADE, depending on preference (usually SET NULL for orders is safer)

-- 2. USER_ADDRESSES Table
ALTER TABLE IF EXISTS public.user_addresses
DROP CONSTRAINT IF EXISTS user_addresses_user_id_fkey; -- Name might vary, checking standard

ALTER TABLE public.user_addresses
ADD CONSTRAINT user_addresses_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 3. CART / CART_ITEMS (If linked to user)
-- Assuming a table "cart_items" or "carts" exists with user_id
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
        ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_fkey;
        ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'carts') THEN
        ALTER TABLE public.carts DROP CONSTRAINT IF EXISTS carts_user_id_fkey;
        ALTER TABLE public.carts ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 4. WISHLISTS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlists') THEN
        ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
        ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 5. REVIEWS / PRODUCT_REVIEWS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_reviews') THEN
        ALTER TABLE public.product_reviews DROP CONSTRAINT IF EXISTS product_reviews_user_id_fkey;
        ALTER TABLE public.product_reviews ADD CONSTRAINT product_reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 6. SUPPORT TICKETS (order_support_tickets)
ALTER TABLE IF EXISTS public.order_support_tickets
DROP CONSTRAINT IF EXISTS order_support_tickets_user_id_fkey;

ALTER TABLE public.order_support_tickets
ADD CONSTRAINT order_support_tickets_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 7. SUPPORT MESSAGES (support_messages) - Sender ID
ALTER TABLE IF EXISTS public.support_messages
DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;

ALTER TABLE public.support_messages
ADD CONSTRAINT support_messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 8. COUPONS (created_by field)
ALTER TABLE IF EXISTS public.coupons
DROP CONSTRAINT IF EXISTS coupons_created_by_fkey;

ALTER TABLE public.coupons
ADD CONSTRAINT coupons_created_by_fkey
FOREIGN KEY (created_by)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 9. REFERRAL CODE USAGE
ALTER TABLE IF EXISTS public.referral_code_usage
DROP CONSTRAINT IF EXISTS referral_code_usage_user_id_fkey;

ALTER TABLE public.referral_code_usage
ADD CONSTRAINT referral_code_usage_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 10. PUBLIC.USERS (Self-reference or link to auth.users)
-- IMPORTANT: public.users.id is usually a primary key that MATCHES auth.users.id
-- It often has a foreign key constraint to auth.users(id) too.
ALTER TABLE IF EXISTS public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

COMMIT;

-- ============================================================================
-- End of Script
-- ============================================================================
