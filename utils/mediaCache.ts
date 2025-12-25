import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { getPlayableVideoUrl } from './videoUrlHelpers';
import { getSafeImageUrl } from './imageUtils';

const CACHE_DIR = `${FileSystem.cacheDirectory}only2u_media/`;
const CACHE_METADATA_KEY = '@only2u_media_cache_metadata';
const CACHE_EXPIRY_HOURS = 24; // Cache for 24 hours
const MAX_VIDEOS_TO_CACHE = 50; // Cache first 5 videos
const MAX_IMAGES_TO_CACHE = 50; // Cache first 20 images
const MAX_CACHE_SIZE_MB = 200; // Maximum 200MB cache

interface CachedMedia {
  remoteUrl: string;
  localUri: string;
  productId: string;
  type: 'video' | 'image';
  size: number; // File size in bytes
  timestamp: number;
  expiresAt: number;
}

interface CacheMetadata {
  media: CachedMedia[];
  totalSize: number; // Total cache size in bytes
  lastUpdated: number;
}

/**
 * Initialize cache directory
 */
const initializeCacheDir = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
      console.log('✅ Created media cache directory');
    }
  } catch (error) {
    console.error('Error initializing cache directory:', error);
  }
};

/**
 * Get cache metadata
 */
const getCacheMetadata = async (): Promise<CacheMetadata> => {
  try {
    const metadata = await AsyncStorage.getItem(CACHE_METADATA_KEY);
    if (metadata) {
      return JSON.parse(metadata);
    }
  } catch (error) {
    console.error('Error reading cache metadata:', error);
  }
  return { media: [], totalSize: 0, lastUpdated: Date.now() };
};

/**
 * Save cache metadata
 */
const saveCacheMetadata = async (metadata: CacheMetadata): Promise<void> => {
  try {
    await AsyncStorage.setItem(CACHE_METADATA_KEY, JSON.stringify(metadata));
  } catch (error) {
    console.error('Error saving cache metadata:', error);
  }
};

/**
 * Check if media is cached and still valid
 */
export const getCachedMediaUri = async (remoteUrl: string): Promise<string | null> => {
  try {
    const metadata = await getCacheMetadata();
    const cached = metadata.media.find(m => m.remoteUrl === remoteUrl);

    if (!cached) return null;

    // Check if cache expired
    if (Date.now() > cached.expiresAt) {
      console.log('⏰ Cache expired for:', remoteUrl);
      return null;
    }

    // Check if file still exists
    const fileInfo = await FileSystem.getInfoAsync(cached.localUri);
    if (!fileInfo.exists) {
      console.log('❌ Cached file not found:', cached.localUri);
      return null;
    }

    return cached.localUri;
  } catch (error) {
    console.error('Error getting cached media:', error);
    return null;
  }
};

/**
 * Convert HLS URL to direct MP4 URL for caching
 */
const getDownloadableVideoUrl = (url: string): string => {
  // If it's a Bunny Stream HLS URL (playlist.m3u8), convert to direct MP4
  if (url.includes('b-cdn.net') && url.includes('playlist.m3u8')) {
    // Convert: https://vz-xxx.b-cdn.net/uuid/playlist.m3u8
    // To:      https://vz-xxx.b-cdn.net/uuid/play_720p.mp4
    const mp4Url = url.replace('/playlist.m3u8', '/play_720p.mp4');
    console.log('🔄 Converting HLS to MP4 for cache:', url, '->', mp4Url);
    return mp4Url;
  }

  // If it's already a direct video URL, use as-is
  return url;
};

/**
 * Download and cache a media file
 */
const downloadAndCacheMedia = async (
  url: string,
  productId: string,
  type: 'video' | 'image'
): Promise<CachedMedia | null> => {
  try {
    // For videos, convert HLS URLs to direct MP4 for caching
    const downloadUrl = type === 'video' ? getDownloadableVideoUrl(url) : url;

    const fileExtension = type === 'video' ? '.mp4' : '.jpg';
    const fileName = `${productId}_${Date.now()}${fileExtension}`;
    const localUri = `${CACHE_DIR}${fileName}`;

    console.log(`📥 Downloading ${type}:`, downloadUrl);

    const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);

    if (downloadResult.status !== 200) {
      console.error(`❌ Download failed with status ${downloadResult.status}`);

      // If 720p failed, try 480p fallback
      if (type === 'video' && downloadUrl.includes('play_720p.mp4')) {
        console.log('⚠️ 720p failed, trying 480p fallback...');
        const fallbackUrl = downloadUrl.replace('play_720p.mp4', 'play_480p.mp4');
        const fallbackResult = await FileSystem.downloadAsync(fallbackUrl, localUri);

        if (fallbackResult.status !== 200) {
          console.log('⚠️ 480p failed, trying original play.mp4 fallback...');
          // Try original play.mp4 as last resort
          const originalFallbackUrl = downloadUrl.replace('play_720p.mp4', 'play.mp4');
          const originalResult = await FileSystem.downloadAsync(originalFallbackUrl, localUri);

          if (originalResult.status !== 200) {
            console.error(`❌ All fallbacks failed. Last status: ${originalResult.status}`);
            return null;
          }
        }
      } else {
        return null;
      }
    }

    const fileInfo = await FileSystem.getInfoAsync(localUri);
    const size = 'size' in fileInfo ? fileInfo.size : 0;

    console.log(`✅ Downloaded ${type} (${(size / 1024 / 1024).toFixed(2)}MB):`, fileName);

    return {
      remoteUrl: url, // Store original URL (HLS)
      localUri,       // Store local MP4 file
      productId,
      type,
      size,
      timestamp: Date.now(),
      expiresAt: Date.now() + (CACHE_EXPIRY_HOURS * 60 * 60 * 1000),
    };
  } catch (error) {
    console.error(`Error downloading ${type}:`, error);
    return null;
  }
};

/**
 * Clean expired cache entries
 */
const cleanExpiredCache = async (): Promise<void> => {
  try {
    const metadata = await getCacheMetadata();
    const now = Date.now();
    const validMedia: CachedMedia[] = [];
    let freedSpace = 0;

    for (const media of metadata.media) {
      if (now > media.expiresAt) {
        // Delete expired file
        try {
          await FileSystem.deleteAsync(media.localUri, { idempotent: true });
          freedSpace += media.size;
          console.log('🗑️ Deleted expired cache:', media.localUri);
        } catch (error) {
          console.error('Error deleting expired cache:', error);
        }
      } else {
        validMedia.push(media);
      }
    }

    if (freedSpace > 0) {
      console.log(`🧹 Cleaned ${(freedSpace / 1024 / 1024).toFixed(2)}MB of expired cache`);
      await saveCacheMetadata({
        media: validMedia,
        totalSize: metadata.totalSize - freedSpace,
        lastUpdated: Date.now(),
      });
    }
  } catch (error) {
    console.error('Error cleaning expired cache:', error);
  }
};

/**
 * Check if cache size is within limits
 */
const isCacheSizeOk = (currentSize: number, newFileSize: number): boolean => {
  const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
  return (currentSize + newFileSize) < maxSizeBytes;
};

/**
 * Cache media for a list of products
 * @param products list of products to cache media for
 * @param onCacheUpdate optional callback when a new media is cached
 */
export const cacheProductMedia = async (
  products: any[],
  onCacheUpdate?: (url: string, localUri: string) => void
): Promise<void> => {
  try {
    if (!products || products.length === 0) return;

    // Initialize cache directory
    await initializeCacheDir();

    // Clean expired cache first (mildly expensive but keeps it clean)
    const metadata = await getCacheMetadata();
    if (Date.now() - metadata.lastUpdated > 1000 * 60 * 60) {
      await cleanExpiredCache();
    }

    // Refresh metadata after clean
    const currentMetadata = await getCacheMetadata();
    let currentCacheSize = currentMetadata.totalSize;
    let newCachedMedia: CachedMedia[] = [...currentMetadata.media];

    const MAX_ITEMS_TO_PROCESS = 5; // Process in batches
    let processedCount = 0;

    for (const product of products) {
      if (processedCount >= MAX_ITEMS_TO_PROCESS) break;

      // 1. Cache Videos
      const videoUrls: string[] = [];
      // From variants
      if (product.variants && Array.isArray(product.variants)) {
        product.variants.forEach((variant: any) => {
          if (variant.video_urls && Array.isArray(variant.video_urls)) {
            videoUrls.push(...variant.video_urls);
          }
        });
      }
      // From product
      if (product.video_urls && Array.isArray(product.video_urls)) {
        videoUrls.push(...product.video_urls);
      }

      const uniqueVideoUrls = [...new Set(videoUrls)];

      for (const videoUrlRaw of uniqueVideoUrls) {
        const videoUrl = getPlayableVideoUrl(videoUrlRaw);
        if (!videoUrl) continue;

        // Check if already cached
        const alreadyCached = newCachedMedia.some(m => m.remoteUrl === videoUrl);
        if (!alreadyCached) {
          const cached = await downloadAndCacheMedia(videoUrl, product.id, 'video');
          if (cached && isCacheSizeOk(currentCacheSize, cached.size)) {
            newCachedMedia.push(cached);
            currentCacheSize += cached.size;
            // Notify UI immediately
            if (onCacheUpdate) {
              onCacheUpdate(videoUrl, cached.localUri);
            }
          }
        } else if (onCacheUpdate) {
          // Already cached, still notify so UI can use it if it hasn't yet
          const existingCache = newCachedMedia.find(m => m.remoteUrl === videoUrl);
          if (existingCache) {
            onCacheUpdate(videoUrl, existingCache.localUri);
          }
        }
      }

      processedCount++;
    }

    // Save updated metadata
    await saveCacheMetadata({
      media: newCachedMedia,
      totalSize: currentCacheSize,
      lastUpdated: Date.now(),
    });

  } catch (error) {
    console.error('Error caching product media:', error);
  }
};

/**
 * Preload and cache trending media
 */
export const preloadTrendingMedia = async (): Promise<void> => {
  try {
    console.log('🎬 Preloading trending media...');

    // Fetch trending products
    const { data: products, error } = await supabase
      .from('products')
      .select(`
        id,
        name,
        image_urls,
        video_urls,
        product_variants (
          image_urls,
          video_urls
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10); // Limit to top 10

    if (error) {
      console.error('Error fetching trending products:', error);
      return;
    }

    if (!products || products.length === 0) {
      console.log('No trending products to cache');
      return;
    }

    // Reuse the main caching logic
    await cacheProductMedia(products);
    console.log('✅ Finished preloading trending media');

  } catch (error) {
    console.error('Error preloading trending media:', error);
  }
};

/**
 * Clear all cached media
 */
export const clearMediaCache = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
      console.log('✅ Cleared media cache directory');
    }

    await AsyncStorage.removeItem(CACHE_METADATA_KEY);
    console.log('✅ Cleared cache metadata');
  } catch (error) {
    console.error('Error clearing media cache:', error);
  }
};

/**
 * Get cache statistics
 */
export const getCacheStats = async (): Promise<{
  videos: number;
  images: number;
  totalSizeMB: number;
  oldestCacheDate: Date | null;
}> => {
  try {
    const metadata = await getCacheMetadata();

    const videos = metadata.media.filter(m => m.type === 'video').length;
    const images = metadata.media.filter(m => m.type === 'image').length;
    const totalSizeMB = metadata.totalSize / 1024 / 1024;

    const oldestTimestamp = Math.min(...metadata.media.map(m => m.timestamp));
    const oldestCacheDate = metadata.media.length > 0 ? new Date(oldestTimestamp) : null;

    return {
      videos,
      images,
      totalSizeMB,
      oldestCacheDate,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { videos: 0, images: 0, totalSizeMB: 0, oldestCacheDate: null };
  }
};

export default {
  getCachedMediaUri,
  preloadTrendingMedia,
  cacheProductMedia,
  clearMediaCache,
  getCacheStats,
};

