// Image Compression Utility
// Compresses and resizes images to ensure they meet API requirements (max 2048x2048 or 1080p)

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compressFormat?: ImageManipulator.SaveFormat;
}

export class ImageCompressionService {
  // Maximum dimensions for face swap API (2048x2048)
  private static readonly MAX_DIMENSION = 2048;
  // Target resolution for 1080p (1920x1080)
  private static readonly TARGET_WIDTH = 1920;
  private static readonly TARGET_HEIGHT = 1080;
  // Default quality for compression
  private static readonly DEFAULT_QUALITY = 0.85;

  /**
   * Compress and resize an image to meet API requirements
   * Resizes to max 1080p (1920x1080) or ensures max dimension is 2048
   */
  static async compressImage(
    imageUri: string,
    options?: CompressionOptions
  ): Promise<string> {
    try {
      console.log('[ImageCompression] Starting compression for:', imageUri);

      // Get image dimensions
      const imageInfo = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );

      const originalWidth = imageInfo.width;
      const originalHeight = imageInfo.height;

      console.log('[ImageCompression] Original dimensions:', {
        width: originalWidth,
        height: originalHeight,
      });

      // Determine target dimensions
      const maxWidth = options?.maxWidth || this.TARGET_WIDTH;
      const maxHeight = options?.maxHeight || this.TARGET_HEIGHT;
      const maxDimension = Math.max(maxWidth, maxHeight);

      // Calculate new dimensions while maintaining aspect ratio
      let newWidth = originalWidth;
      let newHeight = originalHeight;

      // If image exceeds max dimension, resize it
      if (originalWidth > maxDimension || originalHeight > maxDimension) {
        const aspectRatio = originalWidth / originalHeight;

        if (originalWidth > originalHeight) {
          // Landscape or square
          newWidth = Math.min(originalWidth, maxDimension);
          newHeight = newWidth / aspectRatio;
        } else {
          // Portrait
          newHeight = Math.min(originalHeight, maxDimension);
          newWidth = newHeight * aspectRatio;
        }

        // Ensure we don't exceed maxWidth or maxHeight
        if (newWidth > maxWidth) {
          newWidth = maxWidth;
          newHeight = newWidth / aspectRatio;
        }
        if (newHeight > maxHeight) {
          newHeight = maxHeight;
          newWidth = newHeight * aspectRatio;
        }

        // Round to integers
        newWidth = Math.round(newWidth);
        newHeight = Math.round(newHeight);
      }

      console.log('[ImageCompression] Target dimensions:', {
        width: newWidth,
        height: newHeight,
      });

      // If no resizing needed and quality is acceptable, return original
      if (
        newWidth === originalWidth &&
        newHeight === originalHeight &&
        !options?.quality
      ) {
        console.log('[ImageCompression] No compression needed');
        return imageUri;
      }

      // Resize and compress the image
      const compressedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: newWidth,
              height: newHeight,
            },
          },
        ],
        {
          compress: options?.quality || this.DEFAULT_QUALITY,
          format: options?.compressFormat || ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('[ImageCompression] Compression complete:', {
        original: { width: originalWidth, height: originalHeight },
        compressed: {
          width: compressedImage.width,
          height: compressedImage.height,
        },
        uri: compressedImage.uri,
      });

      return compressedImage.uri;
    } catch (error) {
      console.error('[ImageCompression] Error compressing image:', error);
      // Return original URI if compression fails
      return imageUri;
    }
  }

  /**
   * Compress image specifically for face swap API (max 2048x2048)
   */
  static async compressForFaceSwap(imageUri: string): Promise<string> {
    return this.compressImage(imageUri, {
      maxWidth: this.MAX_DIMENSION,
      maxHeight: this.MAX_DIMENSION,
      quality: this.DEFAULT_QUALITY,
    });
  }

  /**
   * Compress image for profile photo (1080p max)
   */
  static async compressForProfilePhoto(imageUri: string): Promise<string> {
    return this.compressImage(imageUri, {
      maxWidth: this.TARGET_WIDTH,
      maxHeight: this.TARGET_HEIGHT,
      quality: this.DEFAULT_QUALITY,
    });
  }

  /**
   * Get image dimensions without loading full image
   */
  static async getImageDimensions(
    imageUri: string
  ): Promise<{ width: number; height: number } | null> {
    try {
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { format: ImageManipulator.SaveFormat.JPEG }
      );
      return {
        width: result.width,
        height: result.height,
      };
    } catch (error) {
      console.error('[ImageCompression] Error getting dimensions:', error);
      return null;
    }
  }
}

/**
 * Convenience function for compressing images for face swap
 */
export const compressImageForFaceSwap = async (
  imageUri: string
): Promise<string> => {
  return ImageCompressionService.compressForFaceSwap(imageUri);
};

/**
 * Convenience function for compressing images for profile photos
 */
export const compressImageForProfilePhoto = async (
  imageUri: string
): Promise<string> => {
  return ImageCompressionService.compressForProfilePhoto(imageUri);
};

/**
 * Download, compress, and get a compressed image URL
 * Useful for compressing remote images before using them in APIs
 */
export const compressRemoteImage = async (
  imageUrl: string,
  options?: CompressionOptions
): Promise<string> => {
  try {
    console.log('[ImageCompression] Downloading remote image:', imageUrl);

    // Download the image
    const downloadResult = await FileSystem.downloadAsync(
      imageUrl,
      FileSystem.documentDirectory + `temp_image_${Date.now()}.jpg`
    );

    if (!downloadResult.uri) {
      throw new Error('Failed to download image');
    }

    console.log('[ImageCompression] Image downloaded to:', downloadResult.uri);

    // Compress the downloaded image
    const compressedUri = await ImageCompressionService.compressImage(
      downloadResult.uri,
      options
    );

    // Clean up the temporary downloaded file
    try {
      await FileSystem.deleteAsync(downloadResult.uri, { idempotent: true });
    } catch (cleanupError) {
      console.warn('[ImageCompression] Failed to cleanup temp file:', cleanupError);
    }

    // If compression created a new file, return it
    // Otherwise, we need to upload it somewhere accessible
    // For now, return the compressed URI (local file)
    // Note: This will only work if the API accepts local file paths
    // For remote APIs, you'll need to upload the compressed image first
    return compressedUri;
  } catch (error) {
    console.error('[ImageCompression] Error compressing remote image:', error);
    // Return original URL if compression fails
    return imageUrl;
  }
};

