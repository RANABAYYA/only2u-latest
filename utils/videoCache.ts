import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getPlayableVideoUrl } from './videoUrlHelpers';

const VIDEO_CACHE_KEY = '@only2u_video_cache';
const CACHE_EXPIRY_HOURS = 24; // Cache videos for 24 hours

interface CachedVideo {
  url: string;
  processedUrl: string;
  productId: string;
  timestamp: number;
}

interface VideoCache {
  videos: CachedVideo[];
  lastUpdated: number;
}

/**
 * Check if cache is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
  const now = Date.now();
  const expiryMs = CACHE_EXPIRY_HOURS * 60 * 60 * 1000;
  return (now - timestamp) < expiryMs;
};

/**
 * Get cached video URLs
 */
export const getCachedVideoUrls = async (): Promise<CachedVideo[]> => {
  try {
    const cacheData = await AsyncStorage.getItem(VIDEO_CACHE_KEY);
    if (!cacheData) return [];

    const cache: VideoCache = JSON.parse(cacheData);
    
    // Check if cache is still valid
    if (!isCacheValid(cache.lastUpdated)) {
      console.log('📹 Video cache expired, will refresh');
      return [];
    }

    console.log(`✅ Loaded ${cache.videos.length} cached video URLs`);
    return cache.videos;
  } catch (error) {
    console.error('Error loading video cache:', error);
    return [];
  }
};

/**
 * Cache video URLs for faster loading
 */
export const cacheVideoUrls = async (videos: CachedVideo[]): Promise<void> => {
  try {
    const cache: VideoCache = {
      videos,
      lastUpdated: Date.now(),
    };

    await AsyncStorage.setItem(VIDEO_CACHE_KEY, JSON.stringify(cache));
    console.log(`✅ Cached ${videos.length} video URLs`);
  } catch (error) {
    console.error('Error caching video URLs:', error);
  }
};

/**
 * Preload video URLs on app start
 * Fetches trending product videos and processes URLs
 */
export const preloadVideoUrls = async (): Promise<void> => {
  try {
    console.log('🎬 Preloading video URLs...');

    // Check if we have valid cache
    const existingCache = await getCachedVideoUrls();
    if (existingCache.length > 0) {
      console.log('✅ Using cached video URLs');
      return;
    }

    // Fetch trending products with videos
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        video_urls,
        product_variants (
          video_urls
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(20); // Preload top 20 videos

    if (error) {
      console.error('Error fetching videos for preload:', error);
      return;
    }

    if (!products || products.length === 0) {
      console.log('No trending videos to preload');
      return;
    }

    // Process and cache video URLs
    const videosToCache: CachedVideo[] = [];

    for (const product of products) {
      // Get video URLs from product_variants
      const videoUrls: string[] = [];
      
      if (product.product_variants && Array.isArray(product.product_variants)) {
        product.product_variants.forEach((variant: any) => {
          if (variant.video_urls && Array.isArray(variant.video_urls)) {
            videoUrls.push(...variant.video_urls);
          }
        });
      }

      // Get video URLs from product
      if (product.video_urls && Array.isArray(product.video_urls)) {
        videoUrls.push(...product.video_urls);
      }

      // Remove duplicates and process URLs
      const uniqueUrls = [...new Set(videoUrls)];
      
      for (const url of uniqueUrls) {
        if (url) {
          const processedUrl = getPlayableVideoUrl(url);
          videosToCache.push({
            url,
            processedUrl,
            productId: product.id,
            timestamp: Date.now(),
          });
        }
      }
    }

    // Save to cache
    await cacheVideoUrls(videosToCache);
    console.log(`✅ Preloaded ${videosToCache.length} video URLs`);
  } catch (error) {
    console.error('Error preloading video URLs:', error);
  }
};

/**
 * Get processed video URL from cache or process it
 */
export const getProcessedVideoUrl = async (url: string): Promise<string> => {
  try {
    const cachedVideos = await getCachedVideoUrls();
    const cached = cachedVideos.find(v => v.url === url);
    
    if (cached) {
      return cached.processedUrl;
    }

    // Not in cache, process it
    return getPlayableVideoUrl(url);
  } catch (error) {
    console.error('Error getting processed video URL:', error);
    return getPlayableVideoUrl(url);
  }
};

/**
 * Clear video cache
 */
export const clearVideoCache = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(VIDEO_CACHE_KEY);
    console.log('✅ Video cache cleared');
  } catch (error) {
    console.error('Error clearing video cache:', error);
  }
};

export default {
  getCachedVideoUrls,
  cacheVideoUrls,
  preloadVideoUrls,
  getProcessedVideoUrl,
  clearVideoCache,
};

