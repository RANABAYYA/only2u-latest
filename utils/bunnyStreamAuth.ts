import CryptoJS from 'crypto-js';

/**
 * Bunny Stream Token Authentication
 * 
 * If your Bunny Stream Pull Zone has token authentication enabled,
 * you need to sign URLs with a security key.
 * 
 * To configure:
 * 1. Add EXPO_PUBLIC_BUNNY_TOKEN_KEY to your .env file
 * 2. Get the token key from Bunny.net Dashboard → Stream → Pull Zones → Token Authentication
 */

const BUNNY_TOKEN_KEY = process.env.EXPO_PUBLIC_BUNNY_TOKEN_KEY || '';

/**
 * Check if Bunny token authentication is enabled
 */
export const isBunnyTokenAuthEnabled = (): boolean => {
  return BUNNY_TOKEN_KEY.length > 0;
};

/**
 * Generate a signed URL for Bunny Stream with token authentication
 * 
 * @param url - The original Bunny Stream URL
 * @param expiresInSeconds - How long the URL should be valid (default: 3600 = 1 hour)
 * @returns Signed URL with token parameters
 */
export const signBunnyStreamUrl = (url: string, expiresInSeconds: number = 3600): string => {
  if (!isBunnyTokenAuthEnabled()) {
    // No token authentication configured, return original URL
    return url;
  }

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    
    // Calculate expiration timestamp
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    // Create the signature base string
    const signatureBase = `${BUNNY_TOKEN_KEY}${path}${expires}`;
    
    // Generate MD5 hash
    const token = CryptoJS.MD5(signatureBase).toString(CryptoJS.enc.Base64)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    // Add token and expiration to URL
    urlObj.searchParams.set('token', token);
    urlObj.searchParams.set('expires', expires.toString());
    
    return urlObj.toString();
  } catch (error) {
    console.error('Error signing Bunny Stream URL:', error);
    return url;
  }
};

/**
 * Check if a URL needs token authentication
 */
export const needsTokenAuth = (url: string): boolean => {
  if (!url) return false;
  
  // Check if it's a Bunny CDN URL and token auth is enabled
  return (url.includes('b-cdn.net') || url.includes('bunnycdn.com')) && 
         isBunnyTokenAuthEnabled();
};

export default {
  signBunnyStreamUrl,
  isBunnyTokenAuthEnabled,
  needsTokenAuth,
};

