export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v', '.m3u8'];

const BUNNY_HOST_KEYWORDS = ['b-cdn.net', 'bunnycdn.com', 'bunny.net', 'storage.bunnycdn.com', 'video.bunnycdn'];

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
    lowerUrl.includes('b-cdn.net')
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

export const toBunnyHlsUrl = (url: string): string => {
  const normalized = normalizeUrl(url);
  if (!normalized || !isBunnyStreamUrl(normalized)) return normalized;

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 0) return normalized;

    segments[segments.length - 1] = 'playlist.m3u8';
    parsed.pathname = `/${segments.join('/')}`;
    return parsed.toString();
  } catch (error) {
    console.error('toBunnyHlsUrl error:', error);
    // Fallback: simple string replacement
    if (normalized.includes('.mp4')) {
      return normalized.replace(/\/[^/]*\.mp4/i, '/playlist.m3u8');
    }
    return normalized.endsWith('/') ? `${normalized}playlist.m3u8` : `${normalized}/playlist.m3u8`;
  }
};

const registerMapping = (finalUrl: string, originalUrl: string) => {
  if (!finalUrl || !originalUrl) return;
  originalUrlMap.set(finalUrl, originalUrl);
};

export const isHlsUrl = (url?: string) => normalizeUrl(url).toLowerCase().includes('.m3u8');

export const getPlayableVideoUrl = (url: string): string => {
  const normalized = normalizeUrl(url);
  if (!normalized) return normalized;

  let processed = normalized;

  if (isGoogleDriveUrl(processed)) {
    const converted = convertGoogleDriveVideoUrl(processed);
    registerMapping(converted, normalized);
    processed = converted;
  } else {
    registerMapping(processed, normalized);
  }

  if (isBunnyStreamUrl(processed) && !isHlsUrl(processed)) {
    const hlsUrl = toBunnyHlsUrl(processed);
    registerMapping(hlsUrl, normalized);
    processed = hlsUrl;
  }

  return processed;
};

export const getFallbackVideoUrl = (url?: string): string | null => {
  const normalized = normalizeUrl(url);
  if (!normalized) return null;
  const fallback = originalUrlMap.get(normalized);
  if (fallback && fallback !== normalized) return fallback;

  if (isBunnyStreamUrl(normalized) && normalized.includes('playlist.m3u8')) {
    try {
      const parsed = new URL(normalized);
      parsed.pathname = parsed.pathname.replace(/playlist\.m3u8/i, 'play.mp4');
      return parsed.toString();
    } catch (error) {
      console.error('Bunny fallback generation error:', error);
      return normalized.replace(/playlist\.m3u8/gi, 'play.mp4');
    }
  }

  return null;
};

export default {
  getPlayableVideoUrl,
  getFallbackVideoUrl,
  convertGoogleDriveVideoUrl,
  isVideoUrl,
  isBunnyStreamUrl,
  isHlsUrl,
  toBunnyHlsUrl,
};

