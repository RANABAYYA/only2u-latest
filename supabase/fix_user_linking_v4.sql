-- ============================================================================
-- Fix Foreign Key Constraints (v4 - Including Reseller Orders)
-- ============================================================================
-- Added handling for 'reseller_orders' table which was blocking the cleanup.
-- ============================================================================

BEGIN;

-- 1. ORDERS Table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        DELETE FROM public.orders WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 2. USER_ADDRESSES Table
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_addresses') THEN
        DELETE FROM public.user_addresses WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.user_addresses DROP CONSTRAINT IF EXISTS user_addresses_user_id_fkey;
        ALTER TABLE public.user_addresses ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 3. CART_ITEMS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cart_items') THEN
        DELETE FROM public.cart_items WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_fkey;
        ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 4. WISHLISTS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wishlists') THEN
        DELETE FROM public.wishlists WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
        ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 5. REVIEWS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
        DELETE FROM public.reviews WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 6. SUPPORT TICKETS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'order_support_tickets') THEN
        DELETE FROM public.order_support_tickets WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.order_support_tickets DROP CONSTRAINT IF EXISTS order_support_tickets_user_id_fkey;
        ALTER TABLE public.order_support_tickets ADD CONSTRAINT order_support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;

    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
        DELETE FROM public.support_tickets WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.support_tickets DROP CONSTRAINT IF EXISTS support_tickets_user_id_fkey;
        ALTER TABLE public.support_tickets ADD CONSTRAINT support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 7. SUPPORT MESSAGES
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_messages') THEN
        DELETE FROM public.support_messages WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;
        ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- 8. COUPONS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'coupons') THEN
        UPDATE public.coupons SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_created_by_fkey;
        ALTER TABLE public.coupons ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 9. REFERRAL CODE USAGE
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'referral_code_usage') THEN
        DELETE FROM public.referral_code_usage WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.referral_code_usage DROP CONSTRAINT IF EXISTS referral_code_usage_user_id_fkey;
        ALTER TABLE public.referral_code_usage ADD CONSTRAINT referral_code_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- 10. RESELLER ORDERS (NEW ADDITION)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reseller_orders') THEN
        -- Cleanup Customer ID
        DELETE FROM public.reseller_orders WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM auth.users);
        
        -- Cleanup Reseller ID (if it exists)
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reseller_orders' AND column_name = 'reseller_id') THEN
            DELETE FROM public.reseller_orders WHERE reseller_id IS NOT NULL AND reseller_id NOT IN (SELECT id FROM auth.users);
        END IF;

        -- Fix FK Customer ID
        ALTER TABLE public.reseller_orders DROP CONSTRAINT IF EXISTS reseller_orders_customer_id_fkey;
        ALTER TABLE public.reseller_orders ADD CONSTRAINT reseller_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
        
        -- Fix FK Reseller ID
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reseller_orders' AND column_name = 'reseller_id') THEN
            ALTER TABLE public.reseller_orders DROP CONSTRAINT IF EXISTS reseller_orders_reseller_id_fkey;
            ALTER TABLE public.reseller_orders ADD CONSTRAINT reseller_orders_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- 11. PUBLIC.USERS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
        ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
