import * as FileSystem from 'expo-file-system';
import { isHlsUrl } from './videoUrlHelpers';

const HLS_CACHE_DIR = `${FileSystem.cacheDirectory}hls_cache/`;
const MAX_CACHE_SIZE_MB = 500; // Maximum cache size in MB
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CachedHLS {
  localM3U8Uri: string;
  cachedAt: number;
  size: number; // in bytes
  originalUrl: string;
}

interface CacheMetadata {
  [url: string]: CachedHLS;
}

let cacheMetadata: CacheMetadata = {};

/**
 * Initialize HLS cache directory
 */
const ensureCacheDir = async () => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(HLS_CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(HLS_CACHE_DIR, { intermediates: true });
    }
  } catch (error) {
    console.error('[HLSCache] Error creating cache directory:', error);
  }
};

/**
 * Get cache key from URL
 */
const getCacheKey = (url: string): string => {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const fileName = pathParts[pathParts.length - 1] || 'playlist';
    return fileName.replace(/[^a-zA-Z0-9]/g, '_');
  } catch {
    return url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  }
};

/**
 * Parse m3u8 playlist to extract segment URLs
 * Handles both master playlists and media playlists
 * Supports BunnyStream and other HLS providers
 */
const parseM3U8 = (content: string, baseUrl: string): string[] => {
  const segments: string[] = [];
  const lines = content.split('\n');
  
  try {
    const baseUrlObj = new URL(baseUrl);
    const basePath = baseUrl.substring(0, baseUrl.lastIndexOf('/') + 1);
    
    // Check if this is a master playlist (contains #EXT-X-STREAM-INF)
    const isMasterPlaylist = content.includes('#EXT-X-STREAM-INF');
    
    if (isMasterPlaylist) {
      // For master playlists, we need to fetch the variant playlist
      // Find the first variant playlist URL (usually the highest quality)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#') && (line.endsWith('.m3u8') || line.includes('.m3u8'))) {
          // This is a variant playlist URL
          let variantUrl = line;
          if (!line.startsWith('http')) {
            if (line.startsWith('/')) {
              variantUrl = `${baseUrlObj.origin}${line}`;
            } else {
              variantUrl = `${basePath}${line}`;
            }
          }
          // Return the variant URL - caller should fetch and parse it
          return [variantUrl];
        }
      }
      return [];
    }
    
    // Parse media playlist (contains actual segments)
    // BunnyStream segments can be in various formats:
    // - Direct .ts files: "segment_0.ts"
    // - In subdirectories: "segments/segment_0.ts"
    // - With query params: "segment_0.ts?token=..."
    // - Just numbers: "0", "1", "2" (less common)
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) {
        continue;
      }
      
      // More flexible segment detection
      // Check for common segment patterns
      const isSegment = 
        line.endsWith('.ts') || 
        line.endsWith('.m4s') ||
        line.includes('.ts') || // Contains .ts anywhere (e.g., with query params)
        line.includes('.m4s') || // Contains .m4s anywhere
        line.includes('segment') || // Contains "segment" keyword
        line.match(/^\d+\.ts/) || // Starts with numbers and .ts
        line.match(/^segment_\d+/) || // segment_123 format
        line.match(/^\d+$/) || // Just numbers (some providers)
        (line.includes('/') && (line.includes('.ts') || line.includes('.m4s'))); // Path with .ts/.m4s
      
      if (isSegment) {
        // Resolve relative URLs
        let segmentUrl = line;
        
        // Remove query parameters for URL resolution (we'll add them back)
        const [segmentPath, queryString] = line.split('?');
        const segmentPathOnly = segmentPath || line;
        
        if (!segmentPathOnly.startsWith('http')) {
          if (segmentPathOnly.startsWith('/')) {
            // Absolute path from domain root
            segmentUrl = `${baseUrlObj.origin}${segmentPathOnly}`;
          } else {
            // Relative path from m3u8 location
            segmentUrl = `${basePath}${segmentPathOnly}`;
          }
        } else {
          segmentUrl = line; // Already absolute URL
        }
        
        // Add query string back if it existed
        if (queryString) {
          segmentUrl = `${segmentUrl}?${queryString}`;
        }
        
        segments.push(segmentUrl);
      }
    }
    
    // If no segments found with standard patterns, try to find any non-comment lines
    // This handles edge cases where segments might be in unexpected formats
    if (segments.length === 0) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#') && line.length > 0) {
          // Try to resolve as a segment URL
          let segmentUrl = line;
          if (!line.startsWith('http')) {
            if (line.startsWith('/')) {
              segmentUrl = `${baseUrlObj.origin}${line}`;
            } else {
              segmentUrl = `${basePath}${line}`;
            }
          }
          segments.push(segmentUrl);
        }
      }
    }
  } catch (error) {
    console.error('[HLSCache] Error parsing m3u8:', error);
  }
  
  return segments;
};

/**
 * Download and cache a single TS segment
 */
const cacheSegment = async (segmentUrl: string, segmentIndex: number, cacheKey: string): Promise<string | null> => {
  try {
    const segmentFileName = `segment_${segmentIndex}.ts`;
    const localUri = `${HLS_CACHE_DIR}${cacheKey}/${segmentFileName}`;
    
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      return localUri;
    }
    
    // Download segment
    const downloadResult = await FileSystem.downloadAsync(segmentUrl, localUri);
    if (downloadResult.status === 200) {
      return downloadResult.uri;
    }
    
    return null;
  } catch (error) {
    console.error(`[HLSCache] Error caching segment ${segmentIndex}:`, error);
    return null;
  }
};

/**
 * Create local m3u8 file with only the first segment cached
 * All other segments point to original server URLs for seamless streaming
 */
const createLocalM3U8 = async (
  originalM3U8: string,
  cachedSegments: (string | null)[],
  cacheKey: string,
  originalSegmentUrls: string[]
): Promise<string> => {
  try {
    const localM3U8Uri = `${HLS_CACHE_DIR}${cacheKey}/playlist.m3u8`;
    
    // Read original m3u8 to preserve metadata
    const response = await fetch(originalM3U8);
    const originalContent = await response.text();
    
    // Only replace the FIRST segment with local file:// URI
    // Keep all other segments pointing to server for seamless streaming
    let localContent = originalContent;
    const lines = originalContent.split('\n');
    let segmentIndex = 0;
    let firstSegmentReplaced = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Match segment lines (same logic as parseM3U8)
      const isSegment = line && 
        !line.startsWith('#') && 
        (line.endsWith('.ts') || 
         line.endsWith('.m4s') ||
         line.includes('.ts') ||
         line.includes('.m4s') ||
         line.includes('segment') ||
         line.match(/^\d+\.ts/) ||
         line.match(/^segment_\d+/) ||
         (line.includes('/') && (line.includes('.ts') || line.includes('.m4s'))));
      
      if (isSegment) {
        // Only replace the FIRST segment with cached local file
        if (!firstSegmentReplaced && segmentIndex < cachedSegments.length && cachedSegments[segmentIndex]) {
          // Use file:// URI for the first local segment
          const localSegmentPath = cachedSegments[segmentIndex];
          // Ensure file:// protocol
          const fileUri = localSegmentPath.startsWith('file://') 
            ? localSegmentPath 
            : `file://${localSegmentPath}`;
          
          // Replace only the first occurrence of this segment line
          // Use split/join to preserve line structure
          const linesArray = localContent.split('\n');
          for (let j = 0; j < linesArray.length; j++) {
            if (linesArray[j].trim() === line) {
              linesArray[j] = fileUri;
              firstSegmentReplaced = true;
              break;
            }
          }
          localContent = linesArray.join('\n');
        }
        // All other segments keep their original URLs (will stream from server)
        segmentIndex++;
      }
    }
    
    // Write local m3u8 file
    await FileSystem.writeAsStringAsync(localM3U8Uri, localContent);
    
    return localM3U8Uri;
  } catch (error) {
    console.error('[HLSCache] Error creating local m3u8:', error);
    throw error;
  }
};

/**
 * Cache HLS playlist and initial segments
 * Only caches the first few segments for faster initial playback
 */
export const cacheHLS = async (
  m3u8Url: string,
  maxSegments: number = 5
): Promise<string | null> => {
  if (!isHlsUrl(m3u8Url)) {
    return null;
  }
  
  try {
    await ensureCacheDir();
    
    const cacheKey = getCacheKey(m3u8Url);
    const cacheDir = `${HLS_CACHE_DIR}${cacheKey}/`;
    
    // Check if already cached
    const metadataFile = `${HLS_CACHE_DIR}${cacheKey}_metadata.json`;
    try {
      const metadataContent = await FileSystem.readAsStringAsync(metadataFile);
      const metadata: CachedHLS = JSON.parse(metadataContent);
      
      // Check if cache is still valid
      const cacheAge = Date.now() - metadata.cachedAt;
      if (cacheAge < CACHE_EXPIRY_MS) {
        const fileInfo = await FileSystem.getInfoAsync(metadata.localM3U8Uri);
        if (fileInfo.exists) {
          return metadata.localM3U8Uri;
        }
      }
    } catch {
      // Metadata doesn't exist or is invalid, proceed with caching
    }
    
    // Create cache directory for this playlist
    const dirInfo = await FileSystem.getInfoAsync(cacheDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
    }
    
    // Download and parse m3u8
    let response: Response;
    try {
      response = await fetch(m3u8Url);
      if (!response.ok) {
        console.error(`[HLSCache] Failed to fetch m3u8: ${response.status} ${response.statusText}`);
        return null;
      }
    } catch (error) {
      console.error('[HLSCache] Error fetching m3u8:', error);
      return null;
    }
    
    const m3u8Content = await response.text();
    
    if (!m3u8Content || m3u8Content.trim().length === 0) {
      console.error('[HLSCache] Empty m3u8 content');
      return null;
    }
    
    // Extract segment URLs (might be a variant playlist URL if master playlist)
    let segmentUrls = parseM3U8(m3u8Content, m3u8Url);
    
    // If we got a variant playlist URL, fetch and parse it
    if (segmentUrls.length === 1 && segmentUrls[0].endsWith('.m3u8')) {
      try {
        const variantResponse = await fetch(segmentUrls[0]);
        if (!variantResponse.ok) {
          console.error(`[HLSCache] Failed to fetch variant playlist: ${variantResponse.status}`);
          return null;
        }
        const variantContent = await variantResponse.text();
        const variantBaseUrl = segmentUrls[0];
        segmentUrls = parseM3U8(variantContent, variantBaseUrl);
      } catch (error) {
        console.error('[HLSCache] Error fetching variant playlist:', error);
        return null;
      }
    }
    
    if (segmentUrls.length === 0) {
      console.warn('[HLSCache] No segments found in m3u8');
      console.warn('[HLSCache] M3U8 URL:', m3u8Url);
      console.warn('[HLSCache] Content preview (first 1000 chars):', m3u8Content.substring(0, 1000));
      console.warn('[HLSCache] Content lines:', m3u8Content.split('\n').slice(0, 30));
      // Return null but don't throw - let the player use original URL
      return null;
    }
    
    console.log(`[HLSCache] Found ${segmentUrls.length} segments in m3u8. First segment:`, segmentUrls[0]?.substring(0, 100));
    
    // Only cache the FIRST segment for instant playback start
    // All other segments will stream directly from server for seamless playback
    const firstSegmentUrl = segmentUrls[0];
    if (!firstSegmentUrl) {
      console.warn('[HLSCache] No segments to cache');
      return null;
    }
    
    // Cache only the first segment
    const cachedFirstSegment = await cacheSegment(firstSegmentUrl, 0, cacheKey);
    
    if (!cachedFirstSegment) {
      console.warn('[HLSCache] Failed to cache first segment');
      return null;
    }
    
    const cachedSegments: (string | null)[] = [cachedFirstSegment];
    
    // Create local m3u8 file with only first segment cached
    // All other segments keep original server URLs
    const localM3U8Uri = await createLocalM3U8(m3u8Url, cachedSegments, cacheKey, segmentUrls);
    
    // Calculate cache size (only first segment)
    let totalSize = 0;
    if (cachedFirstSegment) {
      try {
        const segmentInfo = await FileSystem.getInfoAsync(cachedFirstSegment);
        if (segmentInfo.exists && 'size' in segmentInfo) {
          totalSize = segmentInfo.size || 0;
        }
      } catch {
        // Ignore errors
      }
    }
    
    // Save metadata
    const metadata: CachedHLS = {
      localM3U8Uri,
      cachedAt: Date.now(),
      size: totalSize,
      originalUrl: m3u8Url,
    };
    
    await FileSystem.writeAsStringAsync(metadataFile, JSON.stringify(metadata));
    
    console.log(`[HLSCache] Cached first segment for ${cacheKey}. Remaining segments will stream from server.`);
    
    return localM3U8Uri;
  } catch (error) {
    console.error('[HLSCache] Error caching HLS:', error);
    return null;
  }
};

/**
 * Get cached HLS URL or cache it if not available
 * Only caches first segment for instant playback, rest streams from server
 */
export const getCachedHLS = async (
  m3u8Url: string,
  maxSegments: number = 1 // Only cache first segment
): Promise<string> => {
  if (!isHlsUrl(m3u8Url)) {
    return m3u8Url;
  }
  
  try {
    // Try to get from cache (only first segment)
    const cached = await cacheHLS(m3u8Url, 1); // Always cache only first segment
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.error('[HLSCache] Error getting cached HLS:', error);
  }
  
  // Fallback to original URL if caching fails
  return m3u8Url;
};

/**
 * Preload HLS for next video (background caching)
 * Only caches first segment for instant playback
 */
export const preloadHLS = async (m3u8Url: string, maxSegments: number = 1): Promise<void> => {
  if (!isHlsUrl(m3u8Url)) {
    return;
  }
  
  // Run in background, don't wait for completion
  // Only cache first segment for seamless playback
  cacheHLS(m3u8Url, 1).catch((error) => {
    console.error('[HLSCache] Background preload failed:', error);
  });
};

/**
 * Clear old cache entries
 */
export const clearOldCache = async (): Promise<void> => {
  try {
    await ensureCacheDir();
    
    const dirInfo = await FileSystem.getInfoAsync(HLS_CACHE_DIR);
    if (!dirInfo.exists) {
      return;
    }
    
    // Get all metadata files
    const files = await FileSystem.readDirectoryAsync(HLS_CACHE_DIR);
    const metadataFiles = files.filter(f => f.endsWith('_metadata.json'));
    
    let totalSize = 0;
    const entries: Array<{ key: string; metadata: CachedHLS; age: number }> = [];
    
    for (const metadataFile of metadataFiles) {
      try {
        const content = await FileSystem.readAsStringAsync(`${HLS_CACHE_DIR}${metadataFile}`);
        const metadata: CachedHLS = JSON.parse(content);
        const age = Date.now() - metadata.cachedAt;
        
        totalSize += metadata.size;
        entries.push({
          key: metadataFile.replace('_metadata.json', ''),
          metadata,
          age,
        });
      } catch {
        // Skip invalid metadata
      }
    }
    
    // Sort by age (oldest first)
    entries.sort((a, b) => a.age - b.age);
    
    // Remove expired entries
    for (const entry of entries) {
      if (entry.age > CACHE_EXPIRY_MS) {
        try {
          const cacheDir = `${HLS_CACHE_DIR}${entry.key}/`;
          await FileSystem.deleteAsync(cacheDir, { idempotent: true });
          await FileSystem.deleteAsync(`${HLS_CACHE_DIR}${entry.key}_metadata.json`, { idempotent: true });
        } catch {
          // Ignore errors
        }
      }
    }
    
    // If cache is too large, remove oldest entries
    const maxSizeBytes = MAX_CACHE_SIZE_MB * 1024 * 1024;
    let currentSize = totalSize;
    
    for (const entry of entries) {
      if (currentSize <= maxSizeBytes) {
        break;
      }
      
      try {
        const cacheDir = `${HLS_CACHE_DIR}${entry.key}/`;
        await FileSystem.deleteAsync(cacheDir, { idempotent: true });
        await FileSystem.deleteAsync(`${HLS_CACHE_DIR}${entry.key}_metadata.json`, { idempotent: true });
        currentSize -= entry.metadata.size;
      } catch {
        // Ignore errors
      }
    }
  } catch (error) {
    console.error('[HLSCache] Error clearing old cache:', error);
  }
};

/**
 * Clear all HLS cache
 */
export const clearAllHLSCache = async (): Promise<void> => {
  try {
    const dirInfo = await FileSystem.getInfoAsync(HLS_CACHE_DIR);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(HLS_CACHE_DIR, { idempotent: true });
    }
  } catch (error) {
    console.error('[HLSCache] Error clearing all cache:', error);
  }
};

// Initialize cache cleanup on module load
clearOldCache().catch(() => {});

