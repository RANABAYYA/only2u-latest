export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.m3u8'];

const BUNNY_HOST_KEYWORDS = ['b-cdn.net', 'bunnycdn.com', 'bunny.net', 'storage.bunnycdn.com', 'video.bunnycdn', 'mediadelivery.net'];

const normalizeUrl = (url?: string) => (typeof url === 'string' ? url.trim() : '');
const originalUrlMap = new Map<string, string>();

export const isVideoUrl = (url?: string): boolean => {
  const normalized = normalizeUrl(url);
  if (!normalized) return false;
  const lowerUrl = normalized.toLowerCase();
  return (
    VIDEO_EXTENSIONS.some((ext) => lowerUrl.includes(ext)) ||
    lowerUrl.includes('video') ||
    lowerUrl.includes('drive.google.com') ||
    lowerUrl.includes('cloudfront') ||
    lowerUrl.includes('b-cdn.net') ||
    lowerUrl.includes('bunnycdn.com') ||
    lowerUrl.includes('mediadelivery.net')
  );
};

export const isGoogleDriveUrl = (url?: string) => normalizeUrl(url).includes('drive.google.com');

export const convertGoogleDriveVideoUrl = (url: string): string => {
  const normalized = normalizeUrl(url);
  if (!normalized || !isGoogleDriveUrl(normalized)) return normalized;

  try {
    const fileMatch = normalized.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileMatch?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
    }

    const idMatch = normalized.match(/id=([a-zA-Z0-9_-]+)/);
    if (idMatch?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
    }

    return normalized;
  } catch (error) {
    console.error('convertGoogleDriveVideoUrl error:', error);
    return normalized;
  }
};

export const isBunnyStreamUrl = (url?: string) => {
  const normalized = normalizeUrl(url).toLowerCase();
  if (!normalized) return false;
  return BUNNY_HOST_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const isBunnyEmbedUrl = (url?: string) => {
  const normalized = normalizeUrl(url).toLowerCase();
  return normalized.includes('mediadelivery.net') || normalized.includes('mediaembed.net');
};

/**
 * Get optimal video quality based on context
 * Returns: '360p' | '480p' | '720p' | '1080p' | 'hls'
 */
export type VideoQuality = '360p' | '480p' | '720p' | '1080p' | 'hls';

export interface VideoQualityOptions {
  /** Preferred quality - defaults to adaptive based on network */
  preferredQuality?: VideoQuality;
  /** Use HLS for adaptive streaming (recommended) */
  preferHLS?: boolean;
  /** For preloading - use lower quality */
  isPreload?: boolean;
  /** Network connection type hint */
  connectionType?: 'wifi' | 'cellular' | 'slow';
}

/**
 * Detect network speed and return optimal quality
 * Uses connection type hints and defaults to conservative quality
 */
export const getOptimalVideoQuality = (options: VideoQualityOptions = {}): VideoQuality => {
  const { preferredQuality, preferHLS, isPreload, connectionType } = options;

  // If HLS is preferred and available, use it for adaptive streaming
  if (preferHLS) {
    return 'hls';
  }

  // If specific quality requested, use it
  if (preferredQuality) {
    return preferredQuality;
  }

  // For preloading, always use lower quality to save bandwidth
  if (isPreload) {
    return '360p';
  }

  // Network-aware quality selection
  if (connectionType === 'wifi') {
    return '720p'; // Good quality on WiFi
  } else if (connectionType === 'slow' || connectionType === 'cellular') {
    return '480p'; // Lower quality on cellular/slow networks
  }

  // Default: conservative quality (480p) to save bandwidth
  // User can upgrade to higher quality if needed
  return '480p';
};

/**
 * Convert Bunny Stream embed URL to direct MP4 video URL with quality selection
 * Example: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId} 
 * -> https://video.bunnycdn.com/{libraryId}/{videoId}/play_480p.mp4 (or HLS)
 * 
 * This provides direct MP4 access for native video playback in React Native
 * with bandwidth-optimized quality selection
 */
export const convertBunnyEmbedToDirectUrl = (
  url: string,
  quality: VideoQuality = '480p'
): string => {
  const normalized = normalizeUrl(url);
  if (!normalized || !isBunnyEmbedUrl(normalized)) return normalized;

  try {
    // Extract libraryId and videoId from embed URL
    // Format: https://iframe.mediadelivery.net/embed/{libraryId}/{videoId}
    const match = normalized.match(/\/embed\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)/);
    if (match && match[1] && match[2]) {
      const libraryId = match[1];
      const videoId = match[2];
      
      // Use HLS for adaptive streaming (best for bandwidth)
      if (quality === 'hls') {
        return `https://video.bunnycdn.com/${libraryId}/${videoId}/playlist.m3u8`;
      }
      
      // Use quality-specific MP4 URLs
      const qualityMap: Record<VideoQuality, string> = {
        '360p': `https://video.bunnycdn.com/${libraryId}/${videoId}/play_360p.mp4`,
        '480p': `https://video.bunnycdn.com/${libraryId}/${videoId}/play_480p.mp4`,
        '720p': `https://video.bunnycdn.com/${libraryId}/${videoId}/play_720p.mp4`,
        '1080p': `https://video.bunnycdn.com/${libraryId}/${videoId}/play_1080p.mp4`,
        'hls': `https://video.bunnycdn.com/${libraryId}/${videoId}/playlist.m3u8`,
      };
      
      return qualityMap[quality] || qualityMap['480p'];
    }

    console.warn('Could not parse Bunny embed URL:', normalized);
    return normalized;
  } catch (error) {
    console.error('convertBunnyEmbedToDirectUrl error:', error);
    return normalized;
  }
};

/**
 * Convert Bunny Stream CDN URL to optimized URL with quality selection
 * Example: https://only2u-media.b-cdn.net/{videoId}/play.mp4
 * -> https://only2u-media.b-cdn.net/{videoId}/playlist.m3u8 (HLS) or play_480p.mp4
 * 
 * For b-cdn.net URLs, we prefer HLS for adaptive streaming to save bandwidth
 */
export const toBunnyDirectUrl = (
  url: string,
  quality: VideoQuality = 'hls'
): string => {
  const normalized = normalizeUrl(url);
  if (!normalized || !isBunnyStreamUrl(normalized)) return normalized;

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return normalized;

    // Prefer HLS for adaptive streaming (saves bandwidth)
    if (quality === 'hls' || (!normalized.includes('.mp4') && !normalized.includes('play_'))) {
      // Replace last segment with 'playlist.m3u8' for HLS streaming
      segments[segments.length - 1] = 'playlist.m3u8';
      parsed.pathname = `/${segments.join('/')}`;
      return parsed.toString();
    }

    // For MP4 URLs, convert to quality-specific version
    if (normalized.includes('.mp4') || normalized.includes('play_')) {
      const videoId = segments[segments.length - 1]?.replace(/\.(mp4|m3u8)$/i, '') || segments[segments.length - 1];
      const qualityMap: Record<VideoQuality, string> = {
        '360p': 'play_360p.mp4',
        '480p': 'play_480p.mp4',
        '720p': 'play_720p.mp4',
        '1080p': 'play_1080p.mp4',
        'hls': 'playlist.m3u8',
      };
      
      segments[segments.length - 1] = qualityMap[quality] || qualityMap['480p'];
      parsed.pathname = `/${segments.join('/')}`;
      return parsed.toString();
    }

    return normalized;
  } catch (error) {
    console.error('toBunnyDirectUrl error:', error);
    // Fallback: simple string replacement
    if (normalized.includes('.mp4')) {
      return quality === 'hls' 
        ? normalized.replace(/\/[^/]*\.mp4/i, '/playlist.m3u8')
        : normalized.replace(/\/[^/]*\.mp4/i, `/play_${quality}.mp4`);
    }
    return normalized.endsWith('/') 
      ? `${normalized}${quality === 'hls' ? 'playlist.m3u8' : `play_${quality}.mp4`}`
      : `${normalized}/${quality === 'hls' ? 'playlist.m3u8' : `play_${quality}.mp4`}`;
  }
};

// Track logged URLs to prevent duplicate logs
const loggedUrls = new Set<string>();

const registerMapping = (finalUrl: string, originalUrl: string) => {
  if (!finalUrl || !originalUrl) return;
  originalUrlMap.set(finalUrl, originalUrl);
};

export const isHlsUrl = (url?: string) => {
  const normalized = normalizeUrl(url).toLowerCase();
  // Check for m3u8 files only
  return normalized.includes('.m3u8');
};

export const getPlayableVideoUrl = (
  url: string,
  options: VideoQualityOptions = {}
): string => {
  const normalized = normalizeUrl(url);
  if (!normalized) return normalized;

  // Determine optimal quality
  const quality = getOptimalVideoQuality(options);

  // Bunny Stream CDN HLS URLs (vz-*.b-cdn.net with playlist.m3u8)
  // These are ready for native playback - no conversion needed
  if (normalized.includes('b-cdn.net') && normalized.includes('playlist.m3u8')) {
    // Only log once per unique URL
    if (!loggedUrls.has(normalized)) {
      console.log('✅ Bunny Stream HLS URL (ready for adaptive playback):', normalized);
      loggedUrls.add(normalized);
    }
    registerMapping(normalized, normalized);
    return normalized;
  }

  // Handle legacy Bunny Stream embed URLs (iframe.mediadelivery.net)
  // Convert them to direct video URLs with optimal quality for bandwidth savings
  if (isBunnyEmbedUrl(normalized)) {
    const directUrl = convertBunnyEmbedToDirectUrl(normalized, quality);
    // Only log once per unique URL
    if (!loggedUrls.has(normalized)) {
      console.log(`🎥 Converting Bunny embed URL (${quality}):`, normalized.substring(0, 60) + '...', '->', directUrl.substring(0, 60) + '...');
      loggedUrls.add(normalized);
    }
    registerMapping(directUrl, normalized);
    return directUrl;
  }

  // For other Bunny Stream CDN URLs, optimize with quality selection
  if (isBunnyStreamUrl(normalized)) {
    // If it's already an MP4, convert to optimal quality
    if (normalized.includes('.mp4') && !normalized.includes('play_')) {
      const optimizedUrl = toBunnyDirectUrl(normalized, quality);
      registerMapping(optimizedUrl, normalized);
      return optimizedUrl;
    }
    // If it's a directory or base URL, prefer HLS for adaptive streaming
    if (!normalized.includes('.mp4') && !normalized.includes('playlist.m3u8')) {
      const optimizedUrl = toBunnyDirectUrl(normalized, 'hls');
      registerMapping(optimizedUrl, normalized);
      return optimizedUrl;
    }
    registerMapping(normalized, normalized);
    return normalized;
  }

  // Legacy Google Drive URLs (if any exist)
  if (isGoogleDriveUrl(normalized)) {
    const converted = convertGoogleDriveVideoUrl(normalized);
    registerMapping(converted, normalized);
    return converted;
  }

  // For any other URL, return as-is
  registerMapping(normalized, normalized);
  return normalized;
};

export const getFallbackVideoUrl = (url?: string, errorCode?: string): string | null => {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  
  // If it's a 403 error on Bunny Stream, provide helpful context
  if (errorCode === '403' && normalized.includes('b-cdn.net')) {
    console.error('❌ BUNNY STREAM 403 ERROR - TOKEN AUTHENTICATION ISSUE');
    console.error('📋 To fix: Go to Bunny.net Dashboard → Stream → Pull Zones → Security');
    console.error('   → Disable "Token Authentication" for mobile app access');
    console.error('   → See BUNNY_STREAM_403_FIX.md for detailed instructions');
  }
  
  // Check if we have a stored original URL
  const fallback = originalUrlMap.get(normalized);
  if (fallback && fallback !== normalized) return fallback;

  // For Bunny Stream CDN HLS URLs, fallback to direct MP4
  if (normalized.includes('b-cdn.net') && normalized.includes('playlist.m3u8')) {
    // Try direct MP4 instead of HLS
    console.log('⚠️ HLS failed, trying direct MP4 fallback');
    return normalized.replace('/playlist.m3u8', '/play_720p.mp4');
  }

  // For Bunny Stream direct MP4 URLs, try different quality fallbacks
  if (normalized.includes('b-cdn.net') && normalized.includes('.mp4')) {
    // If 720p failed, try 480p, then 360p
    if (normalized.includes('play_720p.mp4')) {
      return normalized.replace('play_720p.mp4', 'play_480p.mp4');
    }
    if (normalized.includes('play_480p.mp4')) {
      return normalized.replace('play_480p.mp4', 'play_360p.mp4');
    }
    if (normalized.includes('play_360p.mp4')) {
      return normalized.replace('play_360p.mp4', 'play.mp4');
    }
  }

  // For video.bunnycdn.com URLs, try different quality fallbacks
  if (normalized.includes('video.bunnycdn.com')) {
    if (normalized.includes('play_720p.mp4')) {
      return normalized.replace('play_720p.mp4', 'play_480p.mp4');
    }
    if (normalized.includes('play_480p.mp4')) {
      return normalized.replace('play_480p.mp4', 'play_360p.mp4');
    }
    if (normalized.includes('play_360p.mp4')) {
      return normalized.replace('play_360p.mp4', 'play.mp4');
    }
  }

  return null;
};

export default {
  getPlayableVideoUrl,
  getFallbackVideoUrl,
  convertGoogleDriveVideoUrl,
  convertBunnyEmbedToDirectUrl,
  isVideoUrl,
  isBunnyStreamUrl,
  isBunnyEmbedUrl,
  isHlsUrl,
  toBunnyDirectUrl,
  getOptimalVideoQuality,
};
