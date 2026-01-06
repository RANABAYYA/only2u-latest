-- ============================================================================
-- Fix Foreign Key Constraints (v5 - Comprehensive & Robust)
-- ============================================================================
-- ADDED: collections, shared_collection_views, product_likes, influencer_applications
-- PREVIOUS: orders, addresses, cart, wishlist, reviews, support, reseller, etc.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. CORE E-COMMERCE TABLES
-- ============================================================================

-- ORDERS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'orders') THEN
        DELETE FROM public.orders WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_user_id_fkey;
        ALTER TABLE public.orders ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- USER ADDRESSES
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_addresses') THEN
        DELETE FROM public.user_addresses WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.user_addresses DROP CONSTRAINT IF EXISTS user_addresses_user_id_fkey;
        ALTER TABLE public.user_addresses ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- CART ITEMS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cart_items') THEN
        DELETE FROM public.cart_items WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_fkey;
        ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- WISHLISTS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'wishlists') THEN
        DELETE FROM public.wishlists WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.wishlists DROP CONSTRAINT IF EXISTS wishlists_user_id_fkey;
        ALTER TABLE public.wishlists ADD CONSTRAINT wishlists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- REVIEWS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reviews') THEN
        DELETE FROM public.reviews WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
        ALTER TABLE public.reviews ADD CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- COUPONS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'coupons') THEN
        UPDATE public.coupons SET created_by = NULL WHERE created_by IS NOT NULL AND created_by NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.coupons DROP CONSTRAINT IF EXISTS coupons_created_by_fkey;
        ALTER TABLE public.coupons ADD CONSTRAINT coupons_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- REFERRAL CODE USAGE
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'referral_code_usage') THEN
        DELETE FROM public.referral_code_usage WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.referral_code_usage DROP CONSTRAINT IF EXISTS referral_code_usage_user_id_fkey;
        ALTER TABLE public.referral_code_usage ADD CONSTRAINT referral_code_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 2. SUPPORT & SOCIAL
-- ============================================================================

-- SUPPORT TICKETS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'order_support_tickets') THEN
        DELETE FROM public.order_support_tickets WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.order_support_tickets DROP CONSTRAINT IF EXISTS order_support_tickets_user_id_fkey;
        ALTER TABLE public.order_support_tickets ADD CONSTRAINT order_support_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- SUPPORT MESSAGES
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'support_messages') THEN
        DELETE FROM public.support_messages WHERE sender_id IS NOT NULL AND sender_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.support_messages DROP CONSTRAINT IF EXISTS support_messages_sender_id_fkey;
        ALTER TABLE public.support_messages ADD CONSTRAINT support_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- PRODUCT LIKES
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'product_likes') THEN
        DELETE FROM public.product_likes WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.product_likes DROP CONSTRAINT IF EXISTS product_likes_user_id_fkey;
        ALTER TABLE public.product_likes ADD CONSTRAINT product_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- 3. COLLECTIONS & SHARING
-- ============================================================================

-- COLLECTIONS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'collections') THEN
        DELETE FROM public.collections WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.collections DROP CONSTRAINT IF EXISTS collections_user_id_fkey;
        ALTER TABLE public.collections ADD CONSTRAINT collections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

-- SHARED COLLECTION VIEWS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'shared_collection_views') THEN
        DELETE FROM public.shared_collection_views WHERE viewer_user_id IS NOT NULL AND viewer_user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.shared_collection_views DROP CONSTRAINT IF EXISTS shared_collection_views_viewer_user_id_fkey;
        ALTER TABLE public.shared_collection_views ADD CONSTRAINT shared_collection_views_viewer_user_id_fkey FOREIGN KEY (viewer_user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 4. RESELLER & INFLUENCER
-- ============================================================================

-- RESELLER ORDERS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reseller_orders') THEN
        -- Customer ID
        DELETE FROM public.reseller_orders WHERE customer_id IS NOT NULL AND customer_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.reseller_orders DROP CONSTRAINT IF EXISTS reseller_orders_customer_id_fkey;
        ALTER TABLE public.reseller_orders ADD CONSTRAINT reseller_orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
        
        -- Reseller ID (check column)
        IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reseller_orders' AND column_name = 'reseller_id') THEN
             DELETE FROM public.reseller_orders WHERE reseller_id IS NOT NULL AND reseller_id NOT IN (SELECT id FROM auth.users);
             ALTER TABLE public.reseller_orders DROP CONSTRAINT IF EXISTS reseller_orders_reseller_id_fkey;
             ALTER TABLE public.reseller_orders ADD CONSTRAINT reseller_orders_reseller_id_fkey FOREIGN KEY (reseller_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

-- INFLUENCER APPLICATIONS
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'influencer_applications') THEN
        -- User ID
        UPDATE public.influencer_applications SET user_id = NULL WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.influencer_applications DROP CONSTRAINT IF EXISTS influencer_applications_user_id_fkey;
        ALTER TABLE public.influencer_applications ADD CONSTRAINT influencer_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
        
        -- Reviewed By
        UPDATE public.influencer_applications SET reviewed_by = NULL WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth.users);
         -- Assuming the constraint name might vary, but usually autogenerated standard:
        ALTER TABLE public.influencer_applications DROP CONSTRAINT IF EXISTS influencer_applications_reviewed_by_fkey;
        ALTER TABLE public.influencer_applications ADD CONSTRAINT influencer_applications_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================================================
-- 5. PUBLIC USERS TABLE (FINAL CLEANUP)
-- ============================================================================

-- PUBLIC.USERS
-- Must be done LAST after all other dependencies are fixed or cleared
DO $$ BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        DELETE FROM public.users WHERE id NOT IN (SELECT id FROM auth.users);
        ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;
        ALTER TABLE public.users ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE;
    END IF;
END $$;

COMMIT;
