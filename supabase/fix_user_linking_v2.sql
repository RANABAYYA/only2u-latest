-- ============================================================================
-- Fix Foreign Key Constraints (v2 - With Data Cleanup)
-- ============================================================================
-- The previous script failed because you have "Orphaned Records" in your database.
-- (e.g., Orders that belong to a User ID that no longer exists in auth.users).
--
-- This script will:
-- 1. CLEANUP: Delete/Nullify orphaned records ensuring data integrity.
-- 2. APPLY: The ON UPDATE CASCADE constraints.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- STEP 1: CLEANUP ORPHANED DATA
-- ----------------------------------------------------------------------------
-- We must remove/fix records indicating users that don't exist, otherwise
-- the database will correctly refuse to create the strict link.

-- Cleanup Orders
DELETE FROM public.orders 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Cleanup User Addresses
DELETE FROM public.user_addresses 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Cleanup Support Tickets
DELETE FROM public.order_support_tickets 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Cleanup Support Messages (Sender)
DELETE FROM public.support_messages 
WHERE sender_id IS NOT NULL 
AND sender_id NOT IN (SELECT id FROM auth.users);

-- Cleanup Referral Code Usage
DELETE FROM public.referral_code_usage 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Cleanup Public Users Table (orphaned profiles)
DELETE FROM public.users 
WHERE id NOT IN (SELECT id FROM auth.users);

-- ----------------------------------------------------------------------------
-- STEP 2: APPLY CONSTRAINTS (ON UPDATE CASCADE)
-- ----------------------------------------------------------------------------

-- 1. ORDERS Table
ALTER TABLE IF EXISTS public.orders
DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

ALTER TABLE public.orders
ADD CONSTRAINT orders_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL; 

-- 2. USER_ADDRESSES Table
ALTER TABLE IF EXISTS public.user_addresses
DROP CONSTRAINT IF EXISTS user_addresses_user_id_fkey;

ALTER TABLE public.user_addresses
ADD CONSTRAINT user_addresses_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 3. CART / CART_ITEMS (If linked to user)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
        -- Cleanup first
        DELETE FROM public.cart_items WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        
        ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_fkey;
        ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 4. WISHLISTS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlists') THEN
        -- Cleanup first
        DELETE FROM public.wishlists WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);

        ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
        ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 5. REVIEWS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        -- Cleanup first
        DELETE FROM public.reviews WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);

        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 6. SUPPORT TICKETS
ALTER TABLE IF EXISTS public.order_support_tickets
DROP CONSTRAINT IF EXISTS order_support_tickets_user_id_fkey;

ALTER TABLE public.order_support_tickets
ADD CONSTRAINT order_support_tickets_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- 7. SUPPORT MESSAGES
ALTER TABLE IF EXISTS public.support_messages
DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;

ALTER TABLE public.support_messages
ADD CONSTRAINT support_messages_sender_id_fkey
FOREIGN KEY (sender_id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

-- 8. COUPONS
ALTER TABLE IF EXISTS public.coupons
DROP CONSTRAINT IF EXISTS coupons_created_by_fkey;

-- Cleanup coupons first (set creator to null if user invalid, don't delete coupon)
UPDATE public.coupons SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth.users);

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

-- 10. PUBLIC.USERS
ALTER TABLE IF EXISTS public.users
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users
ADD CONSTRAINT users_id_fkey
FOREIGN KEY (id)
REFERENCES auth.users(id)
ON UPDATE CASCADE
ON DELETE CASCADE;

COMMIT;
