/**
 * Recently Viewed Products Service
 * Client-side caching of recently viewed product IDs using AsyncStorage
 * Optimized for minimal memory usage - stores only product IDs
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getFirstSafeProductImage } from './imageUtils';

const STORAGE_KEY = 'ONLY2U_RECENTLY_VIEWED_PRODUCTS';
const MAX_ITEMS = 10;

export interface RecentProduct {
    id: string;
    name: string;
    price: number;
    mrp_price?: number;
    discount_percentage?: number;
    image_url: string;
    product_variants?: any[];
}

/**
 * Add a product ID to the recently viewed list
 * Called when a user views a product
 */
export const addToRecentlyViewed = async (productId: string): Promise<void> => {
    try {
        // Ensure we only store the UUID (first 36 chars) to avoid composite ID errors
        const cleanId = productId && productId.length > 36 ? productId.substring(0, 36) : productId;

        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        let productIds: string[] = stored ? JSON.parse(stored) : [];

        // Remove if already exists (to move to front)
        productIds = productIds.filter(id => id !== cleanId);

        // Add to front
        productIds.unshift(cleanId);

        // Keep only MAX_ITEMS
        if (productIds.length > MAX_ITEMS) {
            productIds = productIds.slice(0, MAX_ITEMS);
        }

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(productIds));
    } catch (error) {
        console.warn('[RecentlyViewed] Failed to save:', error);
    }
};

/**
 * Get recently viewed product IDs
 */
export const getRecentlyViewedIds = async (): Promise<string[]> => {
    try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.warn('[RecentlyViewed] Failed to get IDs:', error);
        return [];
    }
};

/**
 * Fetch recently viewed products with minimal data for display
 * Includes product_variants for proper image/price extraction
 */
export const fetchRecentlyViewedProducts = async (): Promise<RecentProduct[]> => {
    try {
        const storedIds = await getRecentlyViewedIds();

        // Sanitize IDs: extract UUIDs and remove duplicates
        // This fixes the "invalid input syntax for type uuid" error if composite IDs were stored
        const productIds = [...new Set(storedIds.map(id =>
            id && id.length > 36 ? id.substring(0, 36) : id
        ))].filter(Boolean);

        if (productIds.length === 0) {
            return [];
        }

        // Fetch product data including variants (for images and pricing)
        const { data, error } = await supabase
            .from('products')
            .select(`
        id,
        name,
        image_urls,
        product_variants (
          id,
          price,
          mrp_price,
          rsp_price,
          discount_percentage,
          image_urls
        )
      `)
            .in('id', productIds);

        if (error) {
            console.error('[RecentlyViewed] Fetch error:', error.message, error.details);
            return [];
        }

        if (!data) {
            return [];
        }

        // Map to RecentProduct and maintain order from cache
        const productMap = new Map<string, RecentProduct>();

        for (const p of data) {
            const variants = p.product_variants || [];

            // Get price from first variant (sorted by price ascending)
            const sortedVariants = [...variants].sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
            const firstVariant = sortedVariants[0];
            const price = firstVariant?.price || firstVariant?.rsp_price || 0;
            const mrpPrice = firstVariant?.mrp_price || 0;
            const discountPercentage = firstVariant?.discount_percentage || 0;

            // Get image using the proper helper that checks variants first
            const imageUrl = getFirstSafeProductImage({
                id: p.id,
                name: p.name,
                image_urls: p.image_urls,
                product_variants: variants,
            });

            productMap.set(p.id, {
                id: p.id,
                name: p.name,
                price: price,
                mrp_price: mrpPrice,
                discount_percentage: discountPercentage,
                image_url: imageUrl,
                product_variants: variants,
            });
        }

        // Return in order of recently viewed (most recent first)
        const orderedProducts: RecentProduct[] = [];
        for (const id of productIds) {
            const product = productMap.get(id);
            if (product) {
                orderedProducts.push(product);
            }
        }
        return orderedProducts;

    } catch (error) {
        console.error('[RecentlyViewed] Failed to fetch products:', error);
        return [];
    }
};

/**
 * Clear all recently viewed products
 */
export const clearRecentlyViewed = async (): Promise<void> => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('[RecentlyViewed] Failed to clear:', error);
    }
};
