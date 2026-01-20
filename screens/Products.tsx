import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform, Dimensions, Vibration,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import { PanGestureHandler, Pressable } from 'react-native-gesture-handler';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute, useIsFocused } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { useUser } from '~/contexts/UserContext';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { usePreview } from '~/contexts/PreviewContext';
import { SaveToCollectionSheet, CustomNotification, Only2ULogo, ProfilePhotoRequiredModal } from '~/components/common';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetModal, BottomSheetModalProvider, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  getFirstSafeImageUrl,
  getProductImages,
  getFirstSafeProductImage,
  FALLBACK_IMAGES,
  getAllSafeProductMedia,
  getSafeImageUrl,
} from '../utils/imageUtils';
import { isHlsUrl, getFallbackVideoUrl } from '../utils/videoUrlHelpers';
import type { Product } from '~/types/product';
import OverlayLabel from '~/components/overlay';
import { Image, ImageBackground } from 'expo-image';
import { ResizeMode, Video } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto, validateImage } from '~/utils/profilePhotoUpload';

// Get screen dimensions
const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Try-on tutorial constants
const TRYON_TUTORIAL_VIDEO_URL = 'https://vz-025b9bde-754.b-cdn.net/eee865c8-7e76-4830-b662-00ed3f645d95/playlist.m3u8';
const TRYON_TUTORIAL_STORAGE_KEY = 'ONLY2U_TRYON_TUTORIAL_SEEN';

// Products view tutorial constants
const PRODUCTS_VIEW_TUTORIAL_VIDEO_URL = 'https://vz-025b9bde-754.b-cdn.net/b8c6aa4f-3488-4259-8a58-4e7cefaea5d3/playlist.m3u8';
const PRODUCTS_VIEW_TUTORIAL_STORAGE_KEY = 'ONLY2U_PRODUCTS_VIEW_TUTORIAL_SEEN';

// Size sorting helper functions
const SIZE_PRIORITY = [
  'XXS',
  'XS',
  'S',
  'M',
  'L',
  'XL',
  '2XL',
  '3XL',
  '4XL',
  '5XL',
  '6XL',
  '7XL',
  '8XL',
];

const getSizeSortValue = (sizeName: string) => {
  if (!sizeName) return Number.MAX_SAFE_INTEGER;
  const normalized = sizeName.trim().toUpperCase();
  const priorityIndex = SIZE_PRIORITY.indexOf(normalized);
  if (priorityIndex !== -1) return priorityIndex;

  const numericValue = parseFloat(normalized.replace(/[^0-9.]/g, ''));
  if (!Number.isNaN(numericValue)) {
    return SIZE_PRIORITY.length + numericValue;
  }

  return SIZE_PRIORITY.length + normalized.charCodeAt(0);
};

const sortSizesAscending = <T extends { name: string }>(sizes: T[]): T[] => {
  return [...sizes].sort((a, b) => getSizeSortValue(a.name) - getSizeSortValue(b.name));
};

const extractProductSizes = (product?: Product | null): { id: string; name: string }[] => {
  if (!product?.variants?.length) return [];
  const unique = new Map<string, { id: string; name: string }>();
  product.variants.forEach((variant) => {
    if (!variant.size_id) return;
    const label = variant.size?.name || variant.size_id;
    if (!unique.has(variant.size_id)) {
      unique.set(variant.size_id, { id: variant.size_id, name: label });
    }
  });
  return Array.from(unique.values());
};

// Dynamic cardHeight based on screen size - account for header, tab bar, and safe areas
const cardHeight = screenHeight <= 667 // iPhone SE/8
  ? Math.min(screenHeight * 0.70, 550)  // Smaller screens: 70%
  : screenHeight <= 812 // iPhone X/11 Pro/12 Mini
    ? Math.min(screenHeight * 0.72, 600)  // Medium screens: 72%
    : Math.min(screenHeight * 0.75, 680); // Larger screens: 75%
// Export cardHeight for external use
export { cardHeight };

// Coming Soon Screen Component
interface ComingSoonScreenProps {
  categoryName: string;
  categoryId: string;
  userId?: string;
}

// Helper function to validate UUID format
const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
};

const ComingSoonScreen: React.FC<ComingSoonScreenProps> = ({ categoryName, categoryId, userId }: ComingSoonScreenProps) => {
  const [hasResponded, setHasResponded] = useState(false);
  const [isInterested, setIsInterested] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check if user has already responded for this category
    checkExistingResponse();
  }, [categoryId, userId]);

  const checkExistingResponse = async () => {
    if (!userId || !categoryId) return;

    // Only check database if categoryId is a valid UUID
    if (!isValidUUID(categoryId)) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('category_interest_poll')
        .select('is_interested')
        .eq('user_id', userId)
        .eq('category_id', categoryId)
        .maybeSingle();

      if (!error && data) {
        setHasResponded(true);
        setIsInterested(data.is_interested);
      }
    } catch (error) {
      console.error('Error checking existing response:', error);
    }
  };

  const handleInterestResponse = async (interested: boolean) => {
    if (!userId) {
      Toast.show({
        type: 'comingSoonInterest',
        text1: 'Please log in',
        text2: 'You need to be logged in to submit your interest',
        position: 'top',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Only save to database if categoryId is a valid UUID
      // Skip database save for featured types like "best_sellers" which are not UUIDs
      if (categoryId && isValidUUID(categoryId)) {
        const { error } = await supabase
          .from('category_interest_poll')
          .upsert({
            user_id: userId,
            category_id: categoryId,
            category_name: categoryName,
            is_interested: interested,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id,category_id'
          });

        if (error) {
          console.error('Error submitting interest:', error);
          // Still show success toast even if database save fails
          // The user's feedback is still acknowledged
        }
      }

      // Always show success toast regardless of database save result
      setHasResponded(true);
      setIsInterested(interested);
      Toast.show({
        type: 'comingSoonInterest',
        text1: 'Thank you!',
        text2: interested
          ? "We'll notify you when products are available"
          : "Your feedback helps us improve",
        position: 'top',
      });
    } catch (error) {
      console.error('Error submitting interest:', error);
      // Even on error, show a positive message
      setHasResponded(true);
      setIsInterested(interested);
      Toast.show({
        type: 'comingSoonInterest',
        text1: 'Thank you!',
        text2: 'Your feedback has been received',
        position: 'top',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.comingSoonContainer}>
      <View style={styles.comingSoonContent}>
        {/* Icon */}
        <View style={styles.comingSoonIconContainer}>
          <Ionicons name="hourglass-outline" size={80} color="#F53F7A" />
        </View>

        {/* Title */}
        <Text style={styles.comingSoonTitle}>Coming Soon!</Text>

        {/* Description */}
        <Text style={styles.comingSoonDescription}>
          We're working hard to bring you amazing {categoryName.toLowerCase()} products.
        </Text>

        {/* Interest Poll */}
        {!hasResponded ? (
          <View style={styles.pollContainer}>
            <Text style={styles.pollQuestion}>
              Would you be interested in {categoryName.toLowerCase()} products?
            </Text>

            <View style={styles.pollButtons}>
              <TouchableOpacity
                style={[styles.pollButton, styles.pollButtonInterested]}
                onPress={() => handleInterestResponse(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="heart" size={24} color="#fff" />
                    <Text style={styles.pollButtonText}>Yes, I'm Interested!</Text>
                  </>
                )}
              </TouchableOpacity>




              <TouchableOpacity
                style={[styles.pollButton, styles.pollButtonNotInterested]}
                onPress={() => handleInterestResponse(false)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#666" />
                ) : (
                  <>
                    <Ionicons name="close-circle-outline" size={24} color="#666" />
                    <Text style={[styles.pollButtonText, { color: '#666' }]}>Not Interested</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.pollResponseContainer}>
            <View style={styles.pollResponseCard}>
              <Ionicons
                name={isInterested ? "checkmark-circle" : "information-circle"}
                size={48}
                color={isInterested ? "#10B981" : "#F59E0B"}
              />
              <Text style={styles.pollResponseTitle}>
                {isInterested ? "Thank You!" : "Thanks for Your Feedback"}
              </Text>
              <Text style={styles.pollResponseMessage}>
                {isInterested
                  ? "We'll notify you as soon as products are available in this category."
                  : "Your feedback helps us understand what you're looking for."}
              </Text>
              <TouchableOpacity
                style={styles.changeResponseButton}
                onPress={() => setHasResponded(false)}
              >
                <Text style={styles.changeResponseText}>Change Response</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Additional Info */}
        <View style={styles.comingSoonFooter}>
          <Text style={styles.comingSoonFooterText}>
            In the meantime, explore other categories
          </Text>
        </View>
      </View>
    </View>
  );
};

interface Category {
  id: string;
  name: string;
  description: string;
  image_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type RouteParams = {
  category: Category;
  featuredType?: 'trending' | 'best_seller';
  vendorId?: string;
};

// Tinder Card Component
const TinderCard = ({
  product,
  index,
  onSwipe,
  productPrices,
  ratingData,
  getUserPrice,
  isInWishlist,
  removeFromWishlist,
  setSelectedProduct,
  setShowCollectionSheet,
  addToAllCollection,
  navigation,
}: any) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const rotateStr = rotate.interpolate({
    inputRange: [-100, 0, 100],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        // Real-time physics updates for smoother card movement
        const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;

        // Enhanced rotation based on velocity and position
        const rotationValue = (translationX / 8) + (velocityX * 0.001);
        rotate.setValue(rotationValue);

        // Dynamic scaling based on distance and velocity
        const distance = Math.sqrt(translationX * translationX + translationY * translationY);
        const maxDistance = screenWidth * 0.6;
        const velocityFactor = Math.min(Math.abs(velocityX) / 1000, 0.5);
        const scaleValue = Math.max(0.88, 1 - (distance / maxDistance) * 0.12 - velocityFactor * 0.08);

        scale.setValue(scaleValue);

        // Subtle vertical movement based on horizontal velocity
        const verticalOffset = translationY + (velocityX * 0.05);
        translateY.setValue(verticalOffset);
      }
    }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) {
      // ACTIVE - Enhanced physics with momentum
      const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
      const threshold = screenWidth * 0.2; // Reduced threshold for easier swipes
      const velocityThreshold = 500; // Minimum velocity for quick swipes

      const shouldSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;

      if (shouldSwipe) {
        // Add haptic feedback for swipe action
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 50, 100, 50]);
        } else {
          Vibration.vibrate(100);
        }

        // Calculate momentum-based values
        const direction = translationX > 0 ? 'right' : 'left';
        const momentumFactor = Math.min(Math.abs(velocityX) / 1000, 2); // Cap momentum factor

        // Enhanced exit animation with natural physics
        const baseDistance = screenWidth * 1.5;
        const toValue = translationX > 0 ? baseDistance * (1.2 + momentumFactor) : -baseDistance * (1.2 + momentumFactor);
        const rotateValue = (translationX > 0 ? 40 : -40) * (1 + momentumFactor * 0.4);
        const scaleValue = Math.max(0.5, 0.85 - momentumFactor * 0.25);

        // More natural vertical movement with physics
        const gravity = 0.3; // Simulate gravity effect
        const verticalVelocity = velocityY * 0.2;
        const verticalOffset = translationY + verticalVelocity + (translationY > 0 ? 150 : -150);

        // Smooth single-phase animation
        Animated.parallel([
          Animated.timing(translateX, {
            toValue,
            duration: 350, // Fixed smooth duration
            useNativeDriver: false,
          }),
          Animated.timing(translateY, {
            toValue: verticalOffset,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(rotate, {
            toValue: rotateValue,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(scale, {
            toValue: scaleValue,
            duration: 350,
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 300, // Slightly faster fade
            useNativeDriver: false,
          }),
        ]).start(() => {
          // Small delay before showing next card
          setTimeout(() => {
            onSwipe(direction, product);
          }, 50);
        });
      } else {
        // Enhanced return-to-center with natural bounce physics
        const distanceFromCenter = Math.sqrt(translationX * translationX + translationY * translationY);
        const bounceIntensity = Math.min(distanceFromCenter / (screenWidth * 0.3), 1.5);

        Animated.sequence([
          // Initial return with overshoot
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              tension: 500,
              friction: 25,
              useNativeDriver: false,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              tension: 500,
              friction: 25,
              useNativeDriver: false,
            }),
            Animated.spring(rotate, {
              toValue: 0,
              tension: 500,
              friction: 25,
              useNativeDriver: false,
            }),
            Animated.spring(scale, {
              toValue: 1 + (bounceIntensity * 0.05), // Slight overshoot in scale
              tension: 500,
              friction: 25,
              useNativeDriver: false,
            }),
          ]),
          // Subtle settle animation
          Animated.parallel([
            Animated.spring(scale, {
              toValue: 1,
              tension: 800,
              friction: 30,
              useNativeDriver: false,
            }),
          ]),
        ]).start();
      }
    } else {
      // Add subtle haptic feedback when crossing threshold
      const { translationX } = event.nativeEvent;
      const threshold = screenWidth * 0.15;
      if (Math.abs(translationX) > threshold && Math.abs(translationX - threshold) < 10) {
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 20]);
        } else {
          Vibration.vibrate(50);
        }
      }
    }
  };

  // Compute local min price for this product in this scope
  const _pricesLocal = product.variants?.map((v: any) => v.price) || [0];
  const _minPriceLocal = Math.min(..._pricesLocal);

  const handleProductPress = () => {
    const userPrice = _minPriceLocal;
    const hasDiscount =
      product.variants?.some((v: any) => v.discount_percentage && v.discount_percentage > 0) ||
      false;
    const originalPrice = hasDiscount
      ? userPrice /
      (1 -
        Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const actualStock =
      product.variants?.reduce((sum: any, variant: any) => sum + (variant.quantity || 0), 0) || 0;
    const totalStock = Math.max(actualStock, 2); // Always show minimum 2 stock

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: userPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])),
      rating: ratingData?.rating || 0,
      reviews: ratingData?.reviews || 0,
      image: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: product.video_urls || [],
      description: product.description,
      stock: totalStock.toString(),
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
    };
    navigation.navigate('ProductDetails', { product: productForDetails });
  };

  const userPrice = _minPriceLocal;
  const hasDiscount =
    product.variants?.some((v: any) => v.discount_percentage && v.discount_percentage > 0) || false;
  const originalPrice = hasDiscount
    ? userPrice /
    (1 -
      Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
    : userPrice;
  const actualStock =
    product.variants?.reduce((sum: any, variant: any) => sum + (variant.quantity || 0), 0) || 0;
  const totalStock = Math.max(actualStock, 2); // Always show minimum 2 stock

  return (
    <PanGestureHandler
      onGestureEvent={onPanGestureEvent}
      onHandlerStateChange={onPanHandlerStateChange}>
      <Animated.View
        style={[
          styles.tinderCard,
          {
            transform: [
              { translateX },
              { translateY },
              { rotate: rotateStr },
              {
                scale: scale.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95 - index * 0.05, 1 - index * 0.05],
                }),
              },
            ],
            opacity,
            zIndex: 1000 - index,
            top: index * 10,
          },
        ]}>
        <TouchableOpacity
          style={styles.cardTouchable}
          onPress={handleProductPress}
          activeOpacity={0.95}>
          {/* Product Image */}
          <View style={styles.tinderImageContainer}>
            <Image
              source={{ uri: getFirstSafeProductImage(product) }}
              style={styles.tinderImage}
              resizeMode="cover"
            />

            {/* Gradient Overlay */}
            <View style={styles.gradientOverlay} />

            {/* Featured Badge */}
            {product.featured_type && (
              <View
                style={[
                  styles.tinderFeaturedBadge,
                  { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' },
                ]}>
                <Text style={styles.tinderFeaturedText}>
                  {product.featured_type === 'trending' ? 'TRENDING' : 'BEST SELLER'}
                </Text>
              </View>
            )}

            {/* Wishlist Button */}
            <TouchableOpacity
              style={styles.tinderWishlistButton}
              onPress={async (e) => {
                e.stopPropagation();
                if (isInWishlist(product.id)) {
                  // Show collection sheet to manually remove from collections
                  setSelectedProduct({
                    ...product,
                    price: _minPriceLocal,
                    featured_type: product.featured_type || undefined,
                  });
                  setShowCollectionSheet(true);
                } else {
                  // Add to "All" collection first
                  addToAllCollection(product);
                  // Then show collection sheet to optionally add to other folders
                  setSelectedProduct({
                    ...product,
                    price: _minPriceLocal,
                    featured_type: product.featured_type || undefined,
                  });
                  setTimeout(() => {
                    setShowCollectionSheet(true);
                  }, 500);
                }
              }}
              activeOpacity={0.7}>
              <Ionicons
                name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
                size={26}
                color={isInWishlist(product.id) ? '#F53F7A' : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Product Info */}
          <View style={styles.tinderProductInfo}>
            <View style={styles.tinderProductHeader}>
              <Text style={styles.tinderProductName} numberOfLines={2}>
                {product.name}
              </Text>
              <View style={styles.tinderStockBadge}>
                <Text style={styles.tinderStockText}>{totalStock} left</Text>
              </View>
            </View>

            <Text style={styles.tinderCategory} numberOfLines={1}>
              {product.category?.name || ''}
            </Text>

            <View style={styles.tinderPriceContainer}>
              <View style={styles.tinderPriceRow}>
                <Text style={styles.tinderPrice}>₹{Math.round(getUserPrice(product))}</Text>
                {hasDiscount && (
                  <Text style={styles.tinderOriginalPrice}>₹{Math.round(originalPrice)}</Text>
                )}
              </View>

              <View style={styles.tinderMetaRow}>
                {hasDiscount && (
                  <View style={styles.tinderDiscountBadge}>
                    <Text style={styles.tinderDiscountText}>
                      {Math.round(
                        Math.max(
                          ...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])
                        )
                      )}
                      % OFF
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Enhanced Swipe Indicators with Gradient Overlays */}
        <Animated.View
          style={[
            styles.swipeIndicator,
            styles.likeIndicator,
            {
              opacity: translateX.interpolate({
                inputRange: [0, screenWidth * 0.15, screenWidth * 0.25],
                outputRange: [0, 0.7, 1],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: translateX.interpolate({
                    inputRange: [0, screenWidth * 0.2],
                    outputRange: [0.7, 1.2],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: translateX.interpolate({
                    inputRange: [0, screenWidth * 0.2],
                    outputRange: ['-8deg', '8deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              shadowOpacity: translateX.interpolate({
                inputRange: [0, screenWidth * 0.2],
                outputRange: [0, 0.6],
                extrapolate: 'clamp',
              }),
              shadowRadius: translateX.interpolate({
                inputRange: [0, screenWidth * 0.2],
                outputRange: [0, 15],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <LinearGradient
            colors={['rgba(76, 175, 80, 0.4)', 'rgba(76, 175, 80, 0.25)', 'rgba(76, 175, 80, 0.1)']}
            style={styles.gradientOverlay}
          />
          <Text style={styles.swipeIndicatorText}>LIKE</Text>
        </Animated.View>

        <Animated.View
          style={[
            styles.swipeIndicator,
            styles.passIndicator,
            {
              opacity: translateX.interpolate({
                inputRange: [-screenWidth * 0.25, -screenWidth * 0.15, 0],
                outputRange: [1, 0.7, 0],
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  scale: translateX.interpolate({
                    inputRange: [-screenWidth * 0.2, 0],
                    outputRange: [1.2, 0.7],
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: translateX.interpolate({
                    inputRange: [-screenWidth * 0.2, 0],
                    outputRange: ['8deg', '-8deg'],
                    extrapolate: 'clamp',
                  }),
                },
              ],
              shadowOpacity: translateX.interpolate({
                inputRange: [-screenWidth * 0.2, 0],
                outputRange: [0.6, 0],
                extrapolate: 'clamp',
              }),
              shadowRadius: translateX.interpolate({
                inputRange: [-screenWidth * 0.2, 0],
                outputRange: [15, 0],
                extrapolate: 'clamp',
              }),
            },
          ]}>
          <LinearGradient
            colors={['rgba(244, 67, 54, 0.4)', 'rgba(244, 67, 54, 0.25)', 'rgba(244, 67, 54, 0.1)']}
            style={styles.gradientOverlay}
          />
          <Text style={styles.swipeIndicatorText}>PASS</Text>
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
};

// Create dynamic styles function - Enhanced Tinder-like design
const createSwipeCardStyles = (cardHeight: number, cardIndex: number = 0) => {
  // Different shadow intensities and scales based on card position in stack
  const shadowIntensity = Math.max(0.1, 0.4 - (cardIndex * 0.15));
  const elevationIntensity = Math.max(5, 30 - (cardIndex * 12));
  const scaleValue = Math.max(0.8, 1 - (cardIndex * 0.1));
  const translateY = cardIndex * 8;

  return {
    swipeCardContainer: {
      width: screenWidth - 32,
      height: cardHeight,
      borderRadius: 28,
      backgroundColor: cardIndex === 0 ? '#fff' : cardIndex === 1 ? '#f5f5f5' : '#eeeeee',
      shadowColor: cardIndex === 0 ? '#F53F7A' : '#000',
      shadowOpacity: cardIndex === 0 ? 0.6 : shadowIntensity,
      shadowRadius: cardIndex === 0 ? 45 : 30,
      shadowOffset: { width: 0, height: cardIndex === 0 ? 25 : 20 },
      elevation: elevationIntensity,
      overflow: 'visible' as const,
      alignSelf: 'center' as const,
      borderWidth: 1,
      borderColor: cardIndex === 0 ? 'rgba(245, 63, 122, 0.15)' : cardIndex === 1 ? 'rgba(0, 0, 0, 0.15)' : 'rgba(0, 0, 0, 0.2)',
      transform: [
        { scale: scaleValue },
        { translateY: translateY }
      ],
    },
    swipeCardInner: {
      borderRadius: 28,
      overflow: 'hidden' as const,
      backgroundColor: '#fff',
      height: cardHeight, // Fixed height
    },
    swipeImageContainer: {
      height: cardHeight * 0.75, // 75% for image - more vertical space
      position: 'relative' as const,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      overflow: 'hidden' as const,
    },
    swipeImageBackground: {
      width: screenWidth - 32,
      height: cardHeight * 0.75,
      justifyContent: 'flex-end' as const,
    },
    swipeVideoStyle: {
      width: screenWidth - 32,
      height: cardHeight * 0.75,
    },
    swipeImageGradient: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      right: 0,
      height: 100,
    },
    swipeInfoPanel: {
      backgroundColor: '#fff',
      paddingHorizontal: 16,
      paddingTop: 10,
      paddingBottom: 12,
      borderBottomLeftRadius: 28,
      borderBottomRightRadius: 28,
      height: cardHeight * 0.25, // 25% for info panel - more compact
      justifyContent: 'space-between' as const, // Distribute space between elements
    },
  };
};

// Product Card Swipe Component (moved up for CustomSwipeView to use)
const ProductCardSwipe = React.memo(({
  product,
  cardHeight,
  cardIndex = 0,
  navigation,
  userData,
  isInWishlist,
  addToWishlist,
  removeFromWishlist,
  setSelectedProduct,
  setShowCollectionSheet,
  addToAllCollection,
  getUserPrice,
  ratingData,
  openReviewsSheet,
  isScreenFocused,
}: {
  product: Product;
  cardHeight: number;
  cardIndex?: number;
  navigation: any;
  userData: any;
  isInWishlist: (id: string) => boolean;
  addToWishlist: (product: any) => void;
  removeFromWishlist: (id: string) => void;
  setSelectedProduct: (product: any) => void;
  setShowCollectionSheet: (show: boolean) => void;
  addToAllCollection: (product: Product) => void;
  getUserPrice: (product: Product) => number;
  ratingData: { rating: number; reviews: number };
  openReviewsSheet: (product: Product) => void;
  isScreenFocused: boolean;
}) => {
  // Calculate original price and discount
  const flatListRef = useRef<FlatList<any>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(true);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const videoRef = useRef<any>(null);
  const wasPlayingBeforeBlurRef = useRef(true);

  // Reset media index to 0 when product changes (when swiping to a new card)
  useEffect(() => {
    setCurrentIndex(0);
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToIndex({ index: 0, animated: false });
      } catch (error) {
        // Ignore scroll errors
      }
    }
  }, [product.id]);

  // Try-on state
  const { showLoginSheet } = useLoginSheet();
  const { addToPreview } = usePreview();
  const { userData: contextUserData, setUserData: setContextUserData } = useUser();
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [showTryOnCompleteModal, setShowTryOnCompleteModal] = useState(false);
  const [showTryOnTutorialModal, setShowTryOnTutorialModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSizeSelectionModal, setShowSizeSelectionModal] = useState(false);
  const [tryOnTutorialDontShowAgain, setTryOnTutorialDontShowAgain] = useState(false);
  const [hasSeenTryOnTutorial, setHasSeenTryOnTutorial] = useState(false);
  const [coinBalance, setCoinBalance] = useState(contextUserData?.coin_balance || 0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [sizeSelectionDraft, setSizeSelectionDraft] = useState<string | null>(null);
  const [sizeSelectionError, setSizeSelectionError] = useState('');
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [showCoinsModal, setShowCoinsModal] = useState(false);
  const [videoFallbackOverrides, setVideoFallbackOverrides] = useState<Record<string, string>>({});
  const [profilePhotoModalContext, setProfilePhotoModalContext] = useState<'virtual_try_on' | 'video_face_swap'>('virtual_try_on');
  const [showPhotoPickerModal, setShowPhotoPickerModal] = useState(false);
  const [uploadingProfilePhoto, setUploadingProfilePhoto] = useState(false);
  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; context: 'camera' | 'gallery' }>({ visible: false, context: 'camera' });
  const [completedFaceSwapProduct, setCompletedFaceSwapProduct] = useState<any>(null);
  const [isTutorialVideoPlaying, setIsTutorialVideoPlaying] = useState(true);
  const tutorialVideoRef = useRef<any>(null);

  // Refs for cleanup
  const faceSwapPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const dynamicStyles = createSwipeCardStyles(cardHeight, cardIndex);
  const variants = product.variants || [];

  // Load tutorial seen status and coin balance
  useEffect(() => {
    const loadTutorialStatus = async () => {
      try {
        const tryOnStored = await AsyncStorage.getItem(TRYON_TUTORIAL_STORAGE_KEY);
        setHasSeenTryOnTutorial(tryOnStored === 'true');
      } catch (error) {
        console.warn('Error loading tutorial status:', error);
      }
    };
    loadTutorialStatus();

    if (contextUserData?.coin_balance !== undefined) {
      setCoinBalance(contextUserData.coin_balance);
    }
  }, [contextUserData?.coin_balance]);

  const goToIndex = (index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index);
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  };

  const stopCurrentVideoPlayback = useCallback(async () => {
    try {
      if (videoRef.current?.pauseAsync) {
        await videoRef.current.pauseAsync();
      }
      if (videoRef.current?.setStatusAsync) {
        await videoRef.current.setStatusAsync({ shouldPlay: false });
      }
    } catch (error) {
      console.warn('Error stopping swipe video:', error);
    } finally {
      setIsVideoPlaying(false);
      wasPlayingBeforeBlurRef.current = false;
    }
  }, []);

  const toggleVideoPlayPause = async () => {
    if (videoRef.current) {
      if (isVideoPlaying) {
        await videoRef.current.pauseAsync();
        setIsVideoPlaying(false);
        wasPlayingBeforeBlurRef.current = false;
      } else {
        await videoRef.current.playAsync();
        setIsVideoPlaying(true);
        wasPlayingBeforeBlurRef.current = true;
      }
    }
  };

  const toggleVideoMute = async () => {
    const nextMuted = !isVideoMuted;
    setIsVideoMuted(nextMuted);

    try {
      if (videoRef.current) {
        await videoRef.current.setIsMutedAsync(nextMuted);
      }
    } catch (error) {
      console.warn('Error toggling video mute:', error);
    }
  };

  useEffect(() => {
    if (!isScreenFocused) {
      wasPlayingBeforeBlurRef.current = isVideoPlaying;
      if (videoRef.current?.pauseAsync) {
        videoRef.current.pauseAsync().catch(() => { });
      }
      if (isVideoPlaying) {
        setIsVideoPlaying(false);
      }
    } else if (wasPlayingBeforeBlurRef.current) {
      if (!isVideoPlaying) {
        setIsVideoPlaying(true);
      }
      if (videoRef.current?.playAsync) {
        videoRef.current.playAsync().catch(() => { });
      }
    }
  }, [isScreenFocused]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Cleanup video
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => { });
        videoRef.current.unloadAsync().catch(() => { });
      }
      // Cleanup polling interval
      if (faceSwapPollingIntervalRef.current) {
        clearInterval(faceSwapPollingIntervalRef.current);
        faceSwapPollingIntervalRef.current = null;
      }
    };
  }, []);

  const images = getAllSafeProductMedia(product);

  // Try-on flow functions
  const promptLoginForTryOn = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Login Required',
      text2: 'Please login to use Face Swap.',
    });
    showLoginSheet();
  }, [showLoginSheet]);


  const handleTryOnButtonPress = useCallback(async () => {
    if (!contextUserData?.id) {
      promptLoginForTryOn();
      return;
    }

    if (!hasSeenTryOnTutorial) {
      setShowTryOnTutorialModal(true);
      return;
    }

    const sizeOptions = sortSizesAscending(extractProductSizes(product));
    if (sizeOptions.length > 0) {
      const preferredSize =
        (selectedSize && sizeOptions.find((size) => size.id === selectedSize)) ||
        sizeOptions.find((size) => size.name === contextUserData?.size);
      const initialSizeId = preferredSize?.id || sizeOptions[0].id;
      setSizeSelectionDraft(initialSizeId);
      setSizeSelectionError('');
      setShowSizeSelectionModal(true);
    } else {
      setSelectedSize(null);
      setSizeSelectionDraft(null);
      setSizeSelectionError('');
      setShowConsentModal(true);
    }
  }, [
    hasSeenTryOnTutorial,
    promptLoginForTryOn,
    contextUserData?.id,
    contextUserData?.size,
    product,
    selectedSize,
  ]);

  const handleDismissTryOnTutorial = useCallback(() => {
    setTryOnTutorialDontShowAgain(false);
    setShowTryOnTutorialModal(false);
  }, []);

  const handleContinueTryOnTutorial = useCallback(async () => {
    try {
      // Always mark tutorial as seen for this session
      setHasSeenTryOnTutorial(true);

      // Only persist to storage if user checked "Do not show again"
      if (tryOnTutorialDontShowAgain) {
        await AsyncStorage.setItem(TRYON_TUTORIAL_STORAGE_KEY, 'true');
      }
    } catch (error) {
      console.warn('Failed to persist try-on tutorial flag', error);
    }

    // Close the tutorial modal
    setShowTryOnTutorialModal(false);
    setTryOnTutorialDontShowAgain(false);

    // Directly proceed to size selection instead of calling handleTryOnButtonPress
    // to avoid state timing issues
    const sizeOptions = sortSizesAscending(extractProductSizes(product));
    if (sizeOptions.length > 0) {
      const preferredSize =
        (selectedSize && sizeOptions.find((size) => size.id === selectedSize)) ||
        sizeOptions.find((size) => size.name === contextUserData?.size);
      const initialSizeId = preferredSize?.id || sizeOptions[0].id;
      setSizeSelectionDraft(initialSizeId);
      setSizeSelectionError('');
      setShowSizeSelectionModal(true);
    } else {
      setSelectedSize(null);
      setSizeSelectionDraft(null);
      setSizeSelectionError('');
      setShowConsentModal(true);
    }
  }, [
    tryOnTutorialDontShowAgain,
    product,
    selectedSize,
    contextUserData?.size,
  ]);

  const handleConfirmSizeSelection = () => {
    if (!sizeSelectionDraft) {
      setSizeSelectionError('Please choose a size to continue.');
      return;
    }
    setSelectedSize(sizeSelectionDraft);
    setShowSizeSelectionModal(false);
    setSizeSelectionError('');
    setShowConsentModal(true);
  };

  const handleCancelSizeSelection = () => {
    setShowSizeSelectionModal(false);
    setSizeSelectionDraft(null);
    setSizeSelectionError('');
  };

  const handleConsentCancel = () => {
    setShowConsentModal(false);
    setSelectedSize(null);
    setSizeSelectionDraft(null);
  };

  const handleConsentAgree = () => {
    setShowConsentModal(false);
    setShowTryOnModal(true);
  };

  const handleStartFaceSwap = () => {
    handleVirtualTryOn();
  };

  const selectedSizeName = useMemo(() => {
    if (!selectedSize) return null;
    const sizeOptions = sortSizesAscending(extractProductSizes(product));
    return sizeOptions.find((s) => s.id === selectedSize)?.name || null;
  }, [selectedSize, product]);

  const handleVirtualTryOn = async () => {
    try {
      if (!contextUserData?.id) {
        setShowTryOnModal(false);
        setSelectedSize(null);
        setSizeSelectionDraft(null);
        promptLoginForTryOn();
        return;
      }

      if (!contextUserData?.profilePhoto) {
        setProfilePhotoModalContext('virtual_try_on');
        setShowProfilePhotoModal(true);
        setShowTryOnModal(false);
        setSelectedSize(null);
        setSizeSelectionDraft(null);
        return;
      }

      if (coinBalance < 50) {
        Alert.alert('Insufficient Coins', 'You need at least 50 coins for Face Swap. Please purchase more coins.');
        return;
      }

      if (!product?.id) {
        Alert.alert('Product Error', 'Product information is not available. Please try again.');
        return;
      }

      const productId = product.id;

      // Get image from selected variant if available
      let productImageUrl = null;

      if (selectedSize) {
        const selectedVariant = variants.find((v: any) => {
          return v.size_id === selectedSize && v.image_urls && v.image_urls.length > 0;
        });

        if (selectedVariant?.image_urls?.[0]) {
          productImageUrl = selectedVariant.image_urls[0];
        }
      }

      // Fallback to first variant with image, or product default image
      if (!productImageUrl) {
        const firstVariantWithImage = variants.find((v: any) => v.image_urls && v.image_urls.length > 0);
        productImageUrl = firstVariantWithImage?.image_urls?.[0] || product.image_urls?.[0];
      }

      if (!productImageUrl) {
        Alert.alert('Product Image Error', 'Product image is not available for Face Swap. Please try a different product.');
        return;
      }

      // Process the product image URL to ensure it's safe and accessible
      const safeProductImageUrl = getSafeImageUrl(productImageUrl, 'product');

      // Check if we got a fallback image (which means the original URL was invalid)
      if (safeProductImageUrl === FALLBACK_IMAGES.product && productImageUrl !== FALLBACK_IMAGES.product) {
        console.warn('Product image URL invalid, using fallback:', productImageUrl);
        Alert.alert('Product Image Error', 'Product image URL is not accessible. Please try a different product.');
        return;
      }

      setShowTryOnModal(false);

      // Update coin balance (deduct 50 coins for face swap)
      setCoinBalance((prev) => prev - 50);

      // Also update user context
      if (contextUserData) {
        setContextUserData({ ...contextUserData, coin_balance: (contextUserData.coin_balance || 0) - 50 });
      }

      // Deduct coins from database
      const { error: coinUpdateError } = await supabase
        .from('users')
        .update({ coin_balance: (contextUserData?.coin_balance || 0) - 50 })
        .eq('id', contextUserData?.id);

      if (coinUpdateError) {
        console.error('Error updating coin balance:', coinUpdateError);
        // Refund coins on database error
        setCoinBalance((prev) => prev + 50);
        if (contextUserData) {
          setContextUserData({ ...contextUserData, coin_balance: (contextUserData.coin_balance || 0) + 50 });
        }
        Alert.alert('Error', 'Failed to update coin balance. Please try again.');
        return;
      }

      // Check if piAPIVirtualTryOnService is available
      if (!piAPIVirtualTryOnService || typeof piAPIVirtualTryOnService.initiateVirtualTryOn !== 'function') {
        // Refund coins on service error
        setCoinBalance((prev) => prev + 50);
        if (contextUserData) {
          setContextUserData({ ...contextUserData, coin_balance: (contextUserData.coin_balance || 0) + 50 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (contextUserData?.coin_balance || 0) + 50 })
          .eq('id', contextUserData?.id);

        Alert.alert('Service Unavailable', 'Face Swap service is currently unavailable. Please try again later.');
        return;
      }

      // Initiate face swap with PiAPI
      const response = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl: contextUserData.profilePhoto,
        productImageUrl: safeProductImageUrl,
        userId: contextUserData.id,
        productId: productId,
        batchSize: 1,
      });

      if (response && response.success && response.taskId) {
        startFaceSwapPolling(productId, response.taskId);

        Toast.show({
          type: 'success',
          text1: 'Face Swap Started',
          text2: 'Your face swap is being processed. This may take a few minutes.',
        });
      } else {
        // Refund coins on failure
        setCoinBalance((prev) => prev + 50);
        if (contextUserData) {
          setContextUserData({ ...contextUserData, coin_balance: (contextUserData.coin_balance || 0) + 50 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (contextUserData?.coin_balance || 0) + 50 })
          .eq('id', contextUserData?.id);

        Alert.alert('Face Swap Failed', response?.error || 'Failed to start face swap. Your coins have been refunded.');
      }
    } catch (error) {
      console.error('Error starting face swap:', error);

      // Refund coins on any error
      setCoinBalance((prev) => prev + 50);
      if (contextUserData) {
        setContextUserData({ ...contextUserData, coin_balance: (contextUserData.coin_balance || 0) + 50 });
      }

      try {
        await supabase
          .from('users')
          .update({ coin_balance: (contextUserData?.coin_balance || 0) + 50 })
          .eq('id', contextUserData?.id);
      } catch (refundError) {
        console.error('Error refunding coins:', refundError);
      }

      Alert.alert('Error', 'An unexpected error occurred. Your coins have been refunded. Please try again.');
    } finally {
      setSelectedSize(null);
      setSizeSelectionDraft(null);
    }
  };

  const startFaceSwapPolling = (productId: string, taskId: string) => {
    // Clear any existing polling interval
    if (faceSwapPollingIntervalRef.current) {
      clearInterval(faceSwapPollingIntervalRef.current);
      faceSwapPollingIntervalRef.current = null;
    }

    let pollCount = 0;
    const maxPollAttempts = 60; // 5 minutes timeout (60 * 5 seconds)

    const interval = setInterval(async () => {
      // Check if component is still mounted
      if (!isMountedRef.current) {
        clearInterval(interval);
        faceSwapPollingIntervalRef.current = null;
        return;
      }

      try {
        pollCount++;
        console.log(`[Products] Polling attempt ${pollCount}/${maxPollAttempts}`);

        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);

        if (status.status === 'completed' && status.resultImages) {
          clearInterval(interval);
          faceSwapPollingIntervalRef.current = null;

          // Prefer API-rendered image first
          const orderedImages = (status.resultImages || []).sort((a, b) => {
            const aApi = /theapi\.app/i.test(a) ? 0 : 1;
            const bApi = /theapi\.app/i.test(b) ? 0 : 1;
            return aApi - bApi;
          });

          const personalizedProduct = {
            id: `virtual_tryon_${productId}_${Date.now()}`,
            name: product.name,
            description: `Face Swap: ${product.name} - See how it looks on you`,
            image: orderedImages[0],
            image_urls: orderedImages,
            price: getUserPrice(product),
            vendor_name: product.vendor_name || product.alias_vendor || 'Only2U',
            category: product.category,
            featured_type: 'virtual_tryon',
            isPersonalized: true,
            originalProductImage: getProductImages(product)[0] || '',
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId,
          };

          addToPreview(personalizedProduct);

          // Store the product data for navigation
          setCompletedFaceSwapProduct({
            id: personalizedProduct.id,
            name: product.name,
            description: product.description || '',
            image_urls: orderedImages,
            video_urls: [],
            faceSwapDate: new Date().toISOString(),
            originalProductId: productId,
            isVideoPreview: false,
            originalProductImage: getProductImages(product)[0] || '',
          });

          if (isMountedRef.current) {
            setShowTryOnCompleteModal(true);
          }
        } else if (status.status === 'failed') {
          clearInterval(interval);
          faceSwapPollingIntervalRef.current = null;
          if (isMountedRef.current) {
            Alert.alert('Face Swap Failed', status.error || 'The face swap process failed. Please try again.');
          }
        } else if (pollCount >= maxPollAttempts) {
          clearInterval(interval);
          faceSwapPollingIntervalRef.current = null;
          if (isMountedRef.current) {
            Alert.alert('Timeout', 'Face swap is taking longer than expected. Please check your previews later.');
          }
        }
      } catch (error) {
        console.error('Error polling face swap status:', error);
        if (pollCount >= maxPollAttempts) {
          clearInterval(interval);
          faceSwapPollingIntervalRef.current = null;
          if (isMountedRef.current) {
            Alert.alert('Error', 'Unable to check face swap status. Please check your previews later.');
          }
        }
      }
    }, 5000); // Poll every 5 seconds

    faceSwapPollingIntervalRef.current = interval;
  };

  const requestCameraPermissions = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'camera' });
      return false;
    }
    return true;
  };

  const requestGalleryPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      setPermissionModal({ visible: true, context: 'gallery' });
      return false;
    }
    return true;
  };

  const handleProfilePhotoUpload = async (uri: string) => {
    if (!contextUserData?.id) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please log in to update your profile photo.',
      });
      return;
    }

    try {
      setUploadingProfilePhoto(true);

      const validation = await validateImage(uri);
      if (!validation.valid) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: validation.error || 'Please select a valid image file.',
        });
        return;
      }

      const uploadResult = await uploadProfilePhoto(uri);

      if (uploadResult.success && uploadResult.url) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ profilePhoto: uploadResult.url })
          .eq('id', contextUserData.id);

        if (updateError) {
          throw updateError;
        }

        setContextUserData({ ...contextUserData, profilePhoto: uploadResult.url });

        Toast.show({
          type: 'profilePhotoSuccess',
          text1: 'Photo Updated',
          text2: 'Your profile photo has been updated successfully!',
        });

        setShowPhotoPickerModal(false);
        setShowProfilePhotoModal(false);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: uploadResult.error || 'Failed to upload profile photo. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error uploading profile photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading your photo.',
      });
    } finally {
      setUploadingProfilePhoto(false);
    }
  };

  const takeProfilePhoto = async () => {
    if (uploadingProfilePhoto) return;
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProfilePhotoUpload(result.assets[0].uri);
    }
  };

  const pickProfilePhotoFromGallery = async () => {
    if (uploadingProfilePhoto) return;
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      await handleProfilePhotoUpload(result.assets[0].uri);
    }
  };

  const closePermissionModal = () => setPermissionModal((prev) => ({ ...prev, visible: false }));

  const openSettingsForPermissions = async () => {
    closePermissionModal();
    try {
      if (Linking.openSettings) {
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch (error) {
      console.warn('Unable to open settings:', error);
    }
  };

  // Get MRP, RSP and discount from variants
  const mrpPrices = product.variants?.map((v: any) => v.mrp_price || v.price) || [0];
  const rspPrices = product.variants?.map((v: any) => v.rsp_price || v.price) || [0];
  const discountPercentages = product.variants?.map((v: any) => v.discount_percentage || 0) || [0];

  // Use the minimum prices for display
  const minMrpPrice = Math.min(...mrpPrices);
  const minRspPrice = Math.min(...rspPrices);
  const maxDiscountPercentage = Math.max(...discountPercentages);

  // Calculate discount if not provided in discount_percentage
  const calculatedDiscount = maxDiscountPercentage > 0
    ? maxDiscountPercentage
    : (minMrpPrice > minRspPrice ? Math.round(((minMrpPrice - minRspPrice) / minMrpPrice) * 100) : 0);

  // Calculate total stock from variants
  const totalStock =
    product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

  return (
    <View style={dynamicStyles.swipeCardContainer}>
      <View style={dynamicStyles.swipeCardInner}>
        {/* Main Image Container */}
        <View style={dynamicStyles.swipeImageContainer}>
          {/* Featured badge */}
          {product.featured_type && (
            <View style={styles.swipeFeaturedBadge}>
              <Text style={styles.swipeFeaturedText}>
                {product.featured_type.toUpperCase()}
              </Text>
            </View>
          )}

          {/* Wishlist Heart Button */}
          <TouchableOpacity
            style={styles.swipeWishlistIcon}
            onPress={(e) => {
              e.stopPropagation();
              if (isInWishlist(product.id)) {
                // Show collection sheet to manually remove from collections
                setSelectedProduct({
                  ...product,
                  price: getUserPrice(product),
                });
                setShowCollectionSheet(true);
              } else {
                // Add to "All" collection first
                addToAllCollection(product);
                // Then show collection sheet to optionally add to other folders
                setSelectedProduct({
                  ...product,
                  price: getUserPrice(product),
                });
                setTimeout(() => {
                  setShowCollectionSheet(true);
                }, 500);
              }
            }}
          >
            <Ionicons
              name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
              size={24}
              color={isInWishlist(product.id) ? '#F53F7A' : '#666'}
            />
          </TouchableOpacity>

          {/* Mute/Unmute Button - Positioned under wishlist */}
          {images.length > 0 && images[currentIndex]?.type === 'video' && (
            <TouchableOpacity
              style={styles.swipeMuteButton}
              activeOpacity={0.85}
              onPress={toggleVideoMute}
            >
              <Ionicons
                name={isVideoMuted ? 'volume-mute' : 'volume-high'}
                size={22}
                color="#fff"
              />
            </TouchableOpacity>
          )}

          {/* Image/Video Display */}
          {images.length > 0 ? (
            <FlatList
              ref={flatListRef}
              data={images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={3}
              windowSize={5}
              initialNumToRender={2}
              getItemLayout={(data, index) => ({
                length: screenWidth - 32,
                offset: (screenWidth - 32) * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / (screenWidth - 32));
                setCurrentIndex(index);
              }}
              renderItem={({ item, index }) => (
                <View style={dynamicStyles.swipeImageBackground}>
                  {item.type === 'video' ? (
                    <Video
                      ref={(ref) => {
                        if (index === currentIndex && ref) {
                          videoRef.current = ref;
                          if (ref.setIsMutedAsync) {
                            ref.setIsMutedAsync(isVideoMuted).catch(() => { });
                          }
                        }
                      }}
                      source={{
                        uri: videoFallbackOverrides[item.url] || item.url,
                        overrideFileExtensionAndroid: isHlsUrl(videoFallbackOverrides[item.url] || item.url) ? 'm3u8' : 'mp4',
                      }}
                      style={dynamicStyles.swipeVideoStyle}
                      shouldPlay={index === currentIndex && isScreenFocused}
                      isLooping
                      resizeMode={ResizeMode.COVER}
                      isMuted={false}
                      useNativeControls={true}
                      onError={(error) => {
                        console.error('Products screen video error:', error);
                        // Extract error code - handle both object and string errors
                        let errorCode = '';
                        if (typeof error === 'object' && error !== null) {
                          errorCode = (error as any)?.code || (error as any)?.message?.match(/(\d{3})/)?.[0] || '';
                        } else if (typeof error === 'string') {
                          errorCode = error.match(/(\d{3})/)?.[0] || '';
                        }
                        const fallbackUrl = getFallbackVideoUrl(item.url, errorCode);
                        if (fallbackUrl && fallbackUrl !== item.url) {
                          setVideoFallbackOverrides((prev) => ({
                            ...prev,
                            [item.url]: fallbackUrl,
                          }));
                        }
                      }}
                    />
                  ) : (
                    <ImageBackground
                      source={{ uri: item.url }}
                      style={dynamicStyles.swipeImageBackground}
                      imageStyle={{ borderRadius: 20 }}
                    >
                      <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.3)']}
                        style={dynamicStyles.swipeImageGradient}
                      />
                    </ImageBackground>
                  )}
                </View>
              )}
              keyExtractor={(item, index) => `${item.url}-${index}`}
            />
          ) : (
            <View style={styles.swipeImageError}>
              <Ionicons name="image-outline" size={50} color="#ccc" />
              <Text style={styles.swipeImageErrorText}>No Image</Text>
            </View>
          )}

          {/* Navigation dots */}
          {images.length > 1 && (
            <View style={styles.swipeNavButton}>
              <TouchableOpacity
                style={[styles.swipeNavLeft, { opacity: currentIndex > 0 ? 1 : 0.3 }]}
                onPress={() => goToIndex(currentIndex - 1)}
                disabled={currentIndex === 0}
              >
                <Ionicons name="chevron-back" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.swipeNavRight, { opacity: currentIndex < images.length - 1 ? 1 : 0.3 }]}
                onPress={() => goToIndex(currentIndex + 1)}
                disabled={currentIndex === images.length - 1}
              >
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}

          {/* Top overlay with product info */}
          <View style={styles.swipeTopOverlay}>
            <View style={styles.swipeProductHeaderRow}>
              <Text style={styles.swipeProductName} numberOfLines={2}>
                {product.name}
              </Text>
            </View>
          </View>
        </View>

        {/* Product Info Panel */}
        <View style={dynamicStyles.swipeInfoPanel}>
          {/* Vendor Name and Rating Badge Row */}
          <View style={styles.swipeVendorRatingRow}>
            <Text style={styles.swipeVendorName} numberOfLines={1}>
              {product.vendor_name || product.alias_vendor || 'Only2U'}
            </Text>
            <TouchableOpacity
              onPress={() => openReviewsSheet(product)}
              activeOpacity={0.7}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View style={styles.swipeInfoRatingBadge}>
                <Ionicons name="star" size={14} color="#FFD600" />
                <Text style={styles.swipeInfoRatingText}>{ratingData.rating.toFixed(1)}</Text>
                {ratingData.reviews > 0 && (
                  <Text style={[styles.swipeInfoRatingText, { marginLeft: 4, fontWeight: '500', color: '#666', fontSize: 11 }]}>
                    ({ratingData.reviews})
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Product Title */}
          <View style={styles.swipeProductInfoHeader}>
            <Text style={styles.swipeProductTitle} numberOfLines={2}>
              {product.name}
            </Text>
          </View>

          {/* Price Row with Stock - Enhanced visibility like grid view */}
          <View style={styles.swipePriceRow}>
            <View style={styles.swipePriceGroup}>
              <View style={styles.swipePriceContainer}>
                {/* Show MRP striked out if different from RSP */}
                {minMrpPrice > minRspPrice && (
                  <Text style={styles.swipeMRPStrike}>
                    ₹{minMrpPrice.toLocaleString()}
                  </Text>
                )}
                {/* Show RSP price */}
                <Text style={styles.swipePrice}>
                  ₹{minRspPrice.toLocaleString()}
                </Text>
                {/* Show discount badge if there's a discount */}
                {calculatedDiscount > 0 && (
                  <Text style={styles.swipeDiscountBadge}>
                    {calculatedDiscount}% OFF
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.swipeButtonRow}>
            {String(product.category?.name || '').toLowerCase().trim() !== 'dress material' && (
              <TouchableOpacity
                style={styles.swipeTryButton}
                onPress={handleTryOnButtonPress}
              >
                <Ionicons name="camera-outline" size={16} color="#F53F7A" />
                <Text style={styles.swipeTryButtonText}>Try On</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.swipeShopButton}
              onPress={async () => {
                await stopCurrentVideoPlayback();
                navigation.navigate('ProductDetails', { product });
              }}
            >
              <Ionicons name="bag-outline" size={16} color="#fff" />
              <Text style={styles.swipeShopButtonText}>Shop Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Try On Modals */}
      {/* Consent Modal */}
      <Modal
        visible={showConsentModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowConsentModal(false)}
      >
        <View style={styles.consentOverlay}>
          <View style={styles.consentModal}>
            <View style={styles.consentIconCircle}>
              <Ionicons name="shield-checkmark" size={40} color="#F53F7A" />
            </View>
            <Text style={styles.consentTitle}>Privacy & Consent</Text>
            <View style={styles.consentContent}>
              <View style={styles.consentPoint}>
                <View style={styles.consentBullet}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.consentPointText}>
                  I have the right to use this photo
                </Text>
              </View>
              <View style={styles.consentPoint}>
                <View style={styles.consentBullet}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.consentPointText}>
                  I consent to AI processing for face swap
                </Text>
              </View>
              <View style={styles.consentPoint}>
                <View style={styles.consentBullet}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                </View>
                <Text style={styles.consentPointText}>
                  Generated previews may be stored to improve my experience
                </Text>
              </View>
            </View>

            {/* Disclaimer */}
            <View style={styles.consentDisclaimer}>
              <Ionicons name="information-circle" size={18} color="#F59E0B" style={{ marginRight: 8 }} />
              <Text style={styles.consentDisclaimerText}>
                Please note: The results are AI-generated and may not be perfect. The preview is for reference purposes only.
              </Text>
            </View>

            <View style={styles.consentButtons}>
              <TouchableOpacity
                style={styles.consentCancelButton}
                onPress={handleConsentCancel}
                activeOpacity={0.8}
              >
                <Text style={styles.consentCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.consentAgreeButton}
                onPress={handleConsentAgree}
                activeOpacity={0.8}
              >
                <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.consentAgreeText}>I Agree</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Try On Tutorial Modal */}
      <Modal
        visible={showTryOnTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={handleDismissTryOnTutorial}
      >
        <View style={styles.resellTutorialOverlay}>
          <View style={styles.resellTutorialCard}>
            <View style={styles.resellTutorialHeader}>
              <View style={styles.resellTutorialIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.resellTutorialTitle}>Virtual Try-On Guide</Text>
                <Text style={styles.resellTutorialSubtitle}>
                  Learn how to preview outfits with your face and perfect size.
                </Text>
              </View>
              <TouchableOpacity onPress={handleDismissTryOnTutorial}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>
            <View style={styles.resellTutorialVideoWrapper}>
              <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                onPress={() => {
                  if (tutorialVideoRef.current) {
                    if (isTutorialVideoPlaying) {
                      tutorialVideoRef.current.pauseAsync();
                    } else {
                      tutorialVideoRef.current.playAsync();
                    }
                    setIsTutorialVideoPlaying(!isTutorialVideoPlaying);
                  }
                }}
              >
                <Video
                  ref={tutorialVideoRef}
                  source={{ uri: TRYON_TUTORIAL_VIDEO_URL }}
                  style={styles.resellTutorialVideo}
                  resizeMode={ResizeMode.COVER}
                  shouldPlay={isTutorialVideoPlaying}
                  isLooping
                  isMuted
                />
                {/* Play/Pause Overlay Button */}
                <View style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <View style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}>
                    <Ionicons
                      name={isTutorialVideoPlaying ? 'pause' : 'play'}
                      size={24}
                      color="#fff"
                    />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
            <Text style={styles.resellTutorialDescription}>
              Upload a clear photo, pick your size, and instantly preview outfits. Share your looks
              with friends or save them for later!
            </Text>
            <TouchableOpacity
              style={styles.resellTutorialCheckboxRow}
              onPress={() => setTryOnTutorialDontShowAgain(!tryOnTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.resellTutorialCheckbox,
                  tryOnTutorialDontShowAgain && styles.resellTutorialCheckboxChecked,
                ]}
              >
                {tryOnTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.resellTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>
            <View style={styles.resellTutorialActions}>
              <TouchableOpacity
                style={styles.resellTutorialSecondaryBtn}
                onPress={handleDismissTryOnTutorial}
              >
                <Text style={styles.resellTutorialSecondaryText}>Maybe later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.resellTutorialPrimaryBtn}
                onPress={handleContinueTryOnTutorial}
              >
                <Text style={styles.resellTutorialPrimaryText}>Try it now</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Try On Modal - Using proper Modal component to prevent swipe-through */}
      <Modal
        visible={showTryOnModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowTryOnModal(false);
          setSelectedSize(null);
          setSizeSelectionDraft(null);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}>
          <View style={styles.akoolModal}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => {
                setShowTryOnModal(false);
                setSelectedSize(null);
                setSizeSelectionDraft(null);
              }}
            >
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
            <Text style={styles.akoolSubtitle}>Try on with Face Swap AI</Text>

            <View style={{
              width: '100%',
              height: 180,
              backgroundColor: '#000',
              borderRadius: 16,
              overflow: 'hidden',
              marginBottom: 16,
            }}>
              <Video
                source={{ uri: TRYON_TUTORIAL_VIDEO_URL }}
                style={{ width: '100%', height: '100%' }}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                isLooping
                isMuted
              />
            </View>

            <View style={styles.tryOnInfoCard}>
              <View style={styles.tryOnInfoHeader}>
                <Ionicons name="sparkles" size={20} color="#F53F7A" />
                <Text style={styles.tryOnInfoTitle}>Photo Face Swap</Text>
              </View>
              <Text style={styles.tryOnInfoDesc}>
                See how this outfit looks on you with AI-powered face swap
              </Text>
              {selectedSizeName && (
                <Text style={styles.tryOnInfoDesc}>
                  Preview size: {selectedSizeName}
                </Text>
              )}
              <View style={styles.tryOnInfoCost}>
                <Ionicons name="diamond-outline" size={16} color="#F53F7A" />
                <Text style={styles.tryOnInfoCostText}>50 coins</Text>
              </View>
            </View>

            <Text style={styles.akoolBalance}>
              Available balance:{' '}
              <Text style={{ color: '#F53F7A', fontWeight: 'bold' }}>
                {coinBalance} coins
              </Text>
            </Text>
            <TouchableOpacity style={styles.akoolContinueBtn} onPress={handleStartFaceSwap}>
              <Text style={styles.akoolContinueText}>Start Face Swap</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Size Selection Modal */}
      <Modal
        visible={showSizeSelectionModal}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSizeSelection}
      >
        <View style={styles.sizeModalOverlay}>
          <View style={styles.sizeModalContainer}>
            <View style={styles.sizeModalHeader}>
              <Text style={styles.sizeModalTitle}>Select Your Size</Text>
              <TouchableOpacity
                style={styles.sizeModalCloseButton}
                onPress={handleCancelSizeSelection}
                activeOpacity={0.8}
              >
                <Ionicons name="close" size={20} color="#1C1C1E" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sizeModalSubtitle}>
              Choose the size you want to preview before running Face Swap.
            </Text>
            <View style={styles.sizeOptionsWrap}>
              {sortSizesAscending(extractProductSizes(product)).map((size) => {
                const isSelected = sizeSelectionDraft === size.id;
                return (
                  <TouchableOpacity
                    key={size.id}
                    style={[
                      styles.sizeOptionChip,
                      isSelected && styles.sizeOptionChipSelected,
                    ]}
                    onPress={() => {
                      setSizeSelectionDraft(size.id);
                      setSizeSelectionError('');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.sizeOptionChipText,
                        isSelected && styles.sizeOptionChipTextSelected,
                      ]}
                    >
                      {size.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {!!sizeSelectionError && (
              <Text style={styles.sizeSelectionError}>{sizeSelectionError}</Text>
            )}
            <TouchableOpacity
              style={styles.sizeModalConfirmButton}
              onPress={handleConfirmSizeSelection}
              activeOpacity={0.85}
            >
              <Text style={styles.sizeModalConfirmText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Try On Complete Modal */}
      <Modal
        visible={showTryOnCompleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTryOnCompleteModal(false)}
      >
        <View style={styles.tryOnCompleteOverlay}>
          <View style={styles.tryOnCompleteModal}>
            <View style={styles.tryOnCompleteIconCircle}>
              <Ionicons name="checkmark-circle" size={60} color="#10B981" />
            </View>
            <Text style={styles.tryOnCompleteTitle}>Try-On Ready! ✨</Text>
            <Text style={styles.tryOnCompleteSubtitle}>
              Your personalized preview is ready! Check it out in your previews.
            </Text>
            <View style={styles.tryOnCompleteButtons}>
              <TouchableOpacity
                style={styles.tryOnCompleteCancelButton}
                onPress={() => setShowTryOnCompleteModal(false)}
              >
                <Text style={styles.tryOnCompleteCancelText}>Later</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.tryOnCompleteViewButton}
                onPress={() => {
                  setShowTryOnCompleteModal(false);
                  if (completedFaceSwapProduct) {
                    (navigation as any).navigate('PersonalizedProductResult', {
                      product: completedFaceSwapProduct,
                    });
                  }
                }}
              >
                <Text style={styles.tryOnCompleteViewText}>View</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Profile Photo Required Modal */}
      <ProfilePhotoRequiredModal
        visible={showProfilePhotoModal}
        onDismiss={() => setShowProfilePhotoModal(false)}
        onUpload={() => {
          setShowProfilePhotoModal(false);
          setShowPhotoPickerModal(true);
        }}
      />

      {/* Photo Picker Modal */}
      <Modal
        visible={showPhotoPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoPickerModal(false)}
      >
        <View style={styles.photoPickerOverlay}>
          <View style={styles.photoPickerModal}>
            <View style={styles.photoPickerHeader}>
              <Text style={styles.photoPickerTitle}>Upload Profile Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoPickerModal(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.photoPickerScrollView}
              showsVerticalScrollIndicator={false}
            >
              {/* Sample Photo Section */}
              <View style={styles.photoGuideSection}>
                <View style={styles.samplePhotoContainer}>
                  <View style={styles.samplePhotoPlaceholder}>
                    <Image
                      source={require('../assets/photo-guide.png')}
                      style={styles.samplePhotoImage}
                      resizeMode="contain"
                    />
                    <View style={styles.samplePhotoBadge}>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.samplePhotoBadgeText}>Perfect Example</Text>
                    </View>
                  </View>
                </View>

                {/* Instructions */}
                <View style={styles.photoInstructionsContainer}>
                  <Text style={styles.photoInstructionsTitle}>📸 Perfect Photo Guidelines</Text>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>Clear face:</Text> Face should be clearly visible and in focus
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>Space around face:</Text> Leave adequate space around your face (shoulders visible)
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>Good lighting:</Text> Well-lit photo with natural or bright light
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>Face forward:</Text> Look straight at the camera, face centered
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>No obstructions:</Text> Remove sunglasses, masks, or anything covering your face
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>Neutral background:</Text> Simple, uncluttered background works best
                    </Text>
                  </View>

                  <View style={styles.photoInstructionItem}>
                    <Ionicons name="checkmark-circle" size={18} color="#F53F7A" />
                    <Text style={styles.photoInstructionText}>
                      <Text style={styles.photoInstructionBold}>High quality:</Text> Use a clear, high-resolution photo for best results
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.photoPickerOptions}>
                <TouchableOpacity
                  style={styles.photoPickerOption}
                  onPress={takeProfilePhoto}
                  disabled={uploadingProfilePhoto}
                >
                  <Ionicons name="camera" size={32} color="#F53F7A" />
                  <Text style={styles.photoPickerOptionText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.photoPickerOption}
                  onPress={pickProfilePhotoFromGallery}
                  disabled={uploadingProfilePhoto}
                >
                  <Ionicons name="image" size={32} color="#F53F7A" />
                  <Text style={styles.photoPickerOptionText}>Choose from Gallery</Text>
                </TouchableOpacity>
              </View>

              {uploadingProfilePhoto && (
                <ActivityIndicator size="large" color="#F53F7A" style={{ marginTop: 20, marginBottom: 20 }} />
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Permission Modal */}
      <Modal
        visible={permissionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePermissionModal}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <Ionicons
              name={permissionModal.context === 'camera' ? 'camera-outline' : 'images-outline'}
              size={48}
              color="#F53F7A"
            />
            <Text style={styles.permissionTitle}>
              {permissionModal.context === 'camera' ? 'Camera Permission Required' : 'Gallery Permission Required'}
            </Text>
            <Text style={styles.permissionMessage}>
              Please enable {permissionModal.context === 'camera' ? 'camera' : 'gallery'} access in your settings to upload photos.
            </Text>
            <View style={styles.permissionButtons}>
              <TouchableOpacity
                style={styles.permissionCancelButton}
                onPress={closePermissionModal}
              >
                <Text style={styles.permissionCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionSettingsButton}
                onPress={openSettingsForPermissions}
              >
                <Text style={styles.permissionSettingsText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  // Return true if props are equal (skip re-render), false if different (trigger re-render)

  // Check rating data directly
  if (prevProps.ratingData?.rating !== nextProps.ratingData?.rating ||
    prevProps.ratingData?.reviews !== nextProps.ratingData?.reviews) {
    return false; // Props are different, re-render
  }

  // Check other important props
  if (prevProps.product.id !== nextProps.product.id) return false;
  if (prevProps.cardHeight !== nextProps.cardHeight) return false;
  if (prevProps.isScreenFocused !== nextProps.isScreenFocused) return false;

  return true; // Props are equal, skip re-render
});

// Custom Swipe View Component
const CustomSwipeView = ({
  products,
  cardHeight,
  onSwipeRight,
  onSwipeLeft,
  navigation,
  userData,
  isInWishlist,
  addToWishlist,
  removeFromWishlist,
  setSelectedProduct,
  setShowCollectionSheet,
  addToAllCollection,
  getUserPrice,
  productRatings,
  openReviewsSheet,
  isScreenFocused,
}: {
  products: Product[];
  cardHeight: number;
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  navigation: any;
  userData: any;
  isInWishlist: (id: string) => boolean;
  addToWishlist: (product: any) => void;
  removeFromWishlist: (id: string) => void;
  setSelectedProduct: (product: any) => void;
  setShowCollectionSheet: (show: boolean) => void;
  addToAllCollection: (product: Product) => void;
  getUserPrice: (product: Product) => number;
  productRatings: { [productId: string]: { rating: number; reviews: number } };
  openReviewsSheet: (product: Product) => void;
  isScreenFocused: boolean;
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX, translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onPanHandlerStateChange = (event: any) => {
    if (event.nativeEvent.oldState === 4) { // ACTIVE
      const { translationX, translationY, velocityX, velocityY } = event.nativeEvent;
      const threshold = screenWidth * 0.2;
      const velocityThreshold = 600;

      const shouldSwipe = Math.abs(translationX) > threshold || Math.abs(velocityX) > velocityThreshold;

      if (shouldSwipe) {
        // Add haptic feedback for swipe action
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 50, 100, 50]);
        } else {
          Vibration.vibrate(100);
        }

        setIsAnimating(true);
        const direction = translationX > 0 ? 'right' : 'left';
        setSwipeDirection(direction);

        // Enhanced momentum-based calculations with natural physics
        const momentumFactor = Math.min(Math.abs(velocityX) / 1200, 1.5);
        const baseDistance = screenWidth * 1.4;
        const toValue = translationX > 0 ? baseDistance * (1.1 + momentumFactor) : -baseDistance * (1.1 + momentumFactor);
        const rotateValue = (translationX > 0 ? 35 : -35) * (1 + momentumFactor * 0.5);

        // Natural vertical movement with physics
        const verticalVelocity = velocityY * 0.15;
        const verticalOffset = translationY + verticalVelocity + (translationY > 0 ? 120 : -120);

        // Staggered animation for more natural movement
        Animated.sequence([
          // Initial acceleration phase
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: toValue * 0.6,
              duration: Math.max(200, 280 - momentumFactor * 60),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: verticalOffset * 0.7,
              duration: Math.max(200, 280 - momentumFactor * 60),
              useNativeDriver: true,
            }),
          ]),
          // Final acceleration and fade
          Animated.parallel([
            Animated.timing(translateX, {
              toValue,
              duration: Math.max(150, 220 - momentumFactor * 80),
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: verticalOffset,
              duration: Math.max(150, 220 - momentumFactor * 80),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: Math.max(120, 180 - momentumFactor * 50),
              useNativeDriver: true,
            }),
          ]),
        ]).start(() => {
          // Handle swipe action
          const currentProduct = products[currentIndex];
          if (direction === 'right') {
            onSwipeRight(currentProduct);
          } else {
            onSwipeLeft(currentProduct);
          }

          // Move to next card
          setCurrentIndex(prev => prev + 1);
          setSwipeDirection(null);
          setIsAnimating(false);

          // Reset animations with smooth transition
          Animated.parallel([
            Animated.timing(translateX, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 1,
              duration: 0,
              useNativeDriver: true,
            }),
          ]).start();
        });
      } else {
        // Enhanced return-to-center with natural bounce physics
        const distanceFromCenter = Math.sqrt(translationX * translationX + translationY * translationY);
        const bounceIntensity = Math.min(distanceFromCenter / (screenWidth * 0.25), 1.2);

        Animated.sequence([
          // Initial return with natural bounce
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              tension: 550,
              friction: 28,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              tension: 550,
              friction: 28,
              useNativeDriver: true,
            }),
          ]),
          // Subtle settle animation for natural feel
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: 0,
              tension: 900,
              friction: 35,
              useNativeDriver: true,
            }),
            Animated.spring(translateY, {
              toValue: 0,
              tension: 900,
              friction: 35,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      }
    } else {
      // Add subtle haptic feedback when crossing threshold
      const { translationX } = event.nativeEvent;
      const threshold = screenWidth * 0.15;
      if (Math.abs(translationX) > threshold && Math.abs(translationX - threshold) < 10) {
        if (Platform.OS === 'ios') {
          Vibration.vibrate([0, 20]);
        } else {
          Vibration.vibrate(50);
        }
      }
    }
  };

  const rotateStr = translateX.interpolate({
    inputRange: [-screenWidth, 0, screenWidth],
    outputRange: ['-30deg', '0deg', '30deg'],
    extrapolate: 'clamp',
  });

  if (currentIndex >= products.length) {
    return (
      <View style={styles.noMoreCardsContainer}>
        <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
        <Text style={styles.noMoreCardsTitle}>All done!</Text>
        <Text style={styles.noMoreCardsSubtitle}>
          You've seen all products in this category
        </Text>
        <TouchableOpacity
          style={styles.resetButton}
          onPress={() => setCurrentIndex(0)}
        >
          <Text style={styles.resetButtonText}>Start Over</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.customSwipeContainer}>
      {/* Stacked cards behind */}
      {products.slice(currentIndex, currentIndex + 3).map((product, index) => {
        if (index === 0) return null; // Skip the front card

        const scale = 1 - (index * 0.05);
        const translateY = index * 8;
        const opacity = 1 - (index * 0.1);

        return (
          <Animated.View
            key={`${product.id}-${currentIndex + index}`}
            style={[
              styles.stackedCard,
              {
                transform: [
                  { scale },
                  { translateY },
                ],
                opacity,
                zIndex: 10 - index,
              },
            ]}
          >
            <ProductCardSwipe
              product={product}
              cardHeight={cardHeight}
              cardIndex={index}
              navigation={navigation}
              userData={userData}
              isInWishlist={isInWishlist}
              addToWishlist={addToWishlist}
              removeFromWishlist={removeFromWishlist}
              setSelectedProduct={setSelectedProduct}
              setShowCollectionSheet={setShowCollectionSheet}
              addToAllCollection={addToAllCollection}
              getUserPrice={getUserPrice}
              ratingData={productRatings[String(product.id)] ?? { rating: 0, reviews: 0 }}
              openReviewsSheet={openReviewsSheet}
              isScreenFocused={isScreenFocused}
            />
          </Animated.View>
        );
      })}

      {/* Front card */}
      <PanGestureHandler
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanHandlerStateChange}
        enabled={!isAnimating}
      >
        <Animated.View
          style={[
            styles.frontCard,
            {
              transform: [
                { translateX },
                { translateY },
                { rotate: rotateStr },
              ],
              opacity,
              zIndex: 1000,
            },
          ]}
        >
          {/* Debug: Log what rating is being passed */}
          {(() => {
            const productId = String(products[currentIndex]?.id);
            const rating = productRatings[productId];
            console.log(`🎴 Front card product: ${productId}, rating found:`, rating, 'keys in productRatings:', Object.keys(productRatings).length);
            return null;
          })()}
          <ProductCardSwipe
            product={products[currentIndex]}
            cardHeight={cardHeight}
            cardIndex={0}
            navigation={navigation}
            userData={userData}
            isInWishlist={isInWishlist}
            addToWishlist={addToWishlist}
            removeFromWishlist={removeFromWishlist}
            setSelectedProduct={setSelectedProduct}
            setShowCollectionSheet={setShowCollectionSheet}
            addToAllCollection={addToAllCollection}
            getUserPrice={getUserPrice}
            ratingData={productRatings[String(products[currentIndex]?.id)] ?? { rating: 0, reviews: 0 }}
            openReviewsSheet={openReviewsSheet}
            isScreenFocused={isScreenFocused}
          />

          {/* Enhanced Swipe overlays with gradient and shadow effects */}
          <Animated.View
            style={[
              styles.swipeOverlay,
              styles.rightOverlay,
              {
                opacity: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.15, screenWidth * 0.25],
                  outputRange: [0, 0.8, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: translateX.interpolate({
                      inputRange: [0, screenWidth * 0.2],
                      outputRange: [0.7, 1.2],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    rotate: translateX.interpolate({
                      inputRange: [0, screenWidth * 0.2],
                      outputRange: ['-8deg', '8deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                shadowOpacity: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.2],
                  outputRange: [0, 0.7],
                  extrapolate: 'clamp',
                }),
                shadowRadius: translateX.interpolate({
                  inputRange: [0, screenWidth * 0.2],
                  outputRange: [0, 20],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <LinearGradient
              colors={['rgba(76, 175, 80, 0.4)', 'rgba(76, 175, 80, 0.25)', 'rgba(76, 175, 80, 0.1)']}
              style={styles.fullGradientOverlay}
            />
            <Text style={[styles.swipeText, styles.rightText]}>LIKE</Text>
          </Animated.View>

          <Animated.View
            style={[
              styles.swipeOverlay,
              styles.leftOverlay,
              {
                opacity: translateX.interpolate({
                  inputRange: [-screenWidth * 0.25, -screenWidth * 0.15, 0],
                  outputRange: [1, 0.8, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: translateX.interpolate({
                      inputRange: [-screenWidth * 0.2, 0],
                      outputRange: [1.2, 0.7],
                      extrapolate: 'clamp',
                    }),
                  },
                  {
                    rotate: translateX.interpolate({
                      inputRange: [-screenWidth * 0.2, 0],
                      outputRange: ['8deg', '-8deg'],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
                shadowOpacity: translateX.interpolate({
                  inputRange: [-screenWidth * 0.2, 0],
                  outputRange: [0.7, 0],
                  extrapolate: 'clamp',
                }),
                shadowRadius: translateX.interpolate({
                  inputRange: [-screenWidth * 0.2, 0],
                  outputRange: [20, 0],
                  extrapolate: 'clamp',
                }),
              },
            ]}>
            <LinearGradient
              colors={['rgba(244, 67, 54, 0.4)', 'rgba(244, 67, 54, 0.25)', 'rgba(244, 67, 54, 0.1)']}
              style={styles.fullGradientOverlay}
            />
            <Text style={[styles.swipeText, styles.leftText]}>PASS</Text>
          </Animated.View>
        </Animated.View>
      </PanGestureHandler>
    </View>
  );
};

const Products = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { category, featuredType, vendorId } = route.params as RouteParams;
  const insets = useSafeAreaInsets();
  const isScreenFocused = useIsFocused();
  const { userData } = useUser();
  const [showCoinsModal, setShowCoinsModal] = useState(false);

  // Video ref and state for products view tutorial
  const productsViewTutorialVideoRef = useRef<Video>(null);
  const [isProductsViewTutorialVideoPlaying, setIsProductsViewTutorialVideoPlaying] = useState(true);

  // Review media viewer state
  const [showReviewMediaViewer, setShowReviewMediaViewer] = useState(false);
  const [reviewMediaIndex, setReviewMediaIndex] = useState(0);
  const [reviewMediaItems, setReviewMediaItems] = useState<Array<{ type: 'image' | 'video', url: string }>>([]);
  const reviewMediaScrollViewRef = useRef<ScrollView>(null);

  // Calculate dynamic card height based on actual screen dimensions and safe areas
  const headerHeight = 60; // Header height from design
  const titleSectionHeight = 60; // Title and toggle buttons section
  const bottomTabHeight = 60; // Bottom tab navigation
  const availableHeight = screenHeight - insets.top - insets.bottom - headerHeight - titleSectionHeight - bottomTabHeight - 20; // Reduced padding
  const dynamicCardHeight = Math.max(availableHeight * 0.85, screenHeight * 0.55); // Use 85% of available height, minimum 55% of screen height

  // Function to get or create a category-specific "Swiped" collection
  const getOrCreateSwipedCollection = async (categoryName: string): Promise<string | null> => {
    if (!userData?.id) {
      console.log('No user ID, cannot create collection');
      return null;
    }

    // Use just the category name without "Swiped -" prefix to merge with heart-clicked items
    const collectionName = categoryName;
    console.log('Getting or creating collection:', collectionName, 'for user:', userData.id);

    try {
      // Check if collection already exists
      const { data: existingCollection, error: fetchError } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', userData.id)
        .eq('name', collectionName)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching existing collection:', fetchError);
      }

      if (existingCollection) {
        console.log('Found existing collection:', existingCollection.id, 'for name:', collectionName);
        return existingCollection.id;
      }

      console.log('Creating new collection:', collectionName);
      // Create new collection if it doesn't exist
      const { data: newCollection, error: createError } = await supabase
        .from('collections')
        .insert({
          user_id: userData.id,
          name: collectionName,
          is_private: false,
        })
        .select('id')
        .single();

      if (createError) {
        console.error('Error creating swiped collection:', createError);
        return null;
      }

      console.log('Created new collection:', newCollection?.id, 'with name:', collectionName);
      return newCollection?.id || null;
    } catch (error) {
      console.error('Error in getOrCreateSwipedCollection:', error);
      return null;
    }
  };

  // Swipe handlers for custom swipe view
  const handleSwipeRight = async (product: Product) => {
    // Increment swipe count FIRST, before any action
    const newCount = rightSwipeCount + 1;
    setRightSwipeCount(newCount);
    console.log('Right swipe count:', newCount);

    // If already in wishlist, do nothing - keep it in wishlist
    if (isInWishlist(product.id)) {
      // Item is already in wishlist, no action needed
      return;
    } else {
      addToWishlist({
        ...product,
        price: productPrices[product.id as string] || 0,
        featured_type: product.featured_type || undefined,
      });

      if (userData?.id) {
        // First, add to "All" collection
        const allCollectionId = await getOrCreateSwipedCollection('All');
        if (allCollectionId) {
          try {
            const { data: existingInAll } = await supabase
              .from('collection_products')
              .select('id')
              .eq('product_id', product.id)
              .eq('collection_id', allCollectionId)
              .single();

            if (!existingInAll) {
              await supabase
                .from('collection_products')
                .insert({
                  product_id: product.id,
                  collection_id: allCollectionId,
                });
              console.log('Added to "All" collection');
            }
          } catch (error) {
            console.error('Error adding to "All" collection:', error);
          }
        }

        // Then, add to category-specific collection
        // Get the product's category name from the product itself
        let productCategoryName = product.category?.name;

        // If category name is not in the product, fetch it from the database
        if (!productCategoryName && product.category_id) {
          try {
            const { data: categoryData } = await supabase
              .from('categories')
              .select('name')
              .eq('id', product.category_id)
              .single();

            if (categoryData) {
              productCategoryName = categoryData.name;
            }
          } catch (error) {
            console.error('Error fetching category name:', error);
          }
        }

        // Use the product's category name or fall back to "Uncategorized"
        const categoryNameForCollection = `Swiped - ${productCategoryName}` || 'Uncategorized';

        // Get or create the category-specific collection for this product's category
        const collectionId = await getOrCreateSwipedCollection(categoryNameForCollection);

        // Add to category-specific "Swiped" collection
        if (collectionId) {
          try {
            // Check if product is already in this collection
            const { data: existingProduct } = await supabase
              .from('collection_products')
              .select('id')
              .eq('product_id', product.id)
              .eq('collection_id', collectionId)
              .single();

            if (existingProduct) {
              console.log('Product already exists in collection:', collectionId);
            } else {
              const { data: insertedProduct, error: insertError } = await supabase
                .from('collection_products')
                .insert({
                  product_id: product.id,
                  collection_id: collectionId,
                })
                .select();

              if (insertError) {
                console.error('Error adding to swiped collection:', insertError);
              } else {
                console.log('Successfully added to swiped collection:', collectionId, 'for category:', categoryNameForCollection);
                console.log('Inserted product data:', insertedProduct);
              }
            }
          } catch (error) {
            console.error('Error in collection insertion process:', error);
          }
        } else {
          console.log('No collection ID available for swiped collection');
        }
      }
    }

    // Show toast notification every 5 swipes
    if (newCount % 5 === 0) {
      console.log('Showing toast for 5 swipes!');
      // Show toast notification with view button

      // Show custom notification for milestone
      setTimeout(() => {
        // We'll update CustomNotification component to handle view action
        showNotification(
          'added',
          `🎉 ${newCount} items added to wishlist!`,
          'Keep discovering amazing products'
        );
      }, 100);
    }
  };

  const handleSwipeLeft = (product: Product) => {
    // Handle left swipe (pass)
    console.log('Passed on:', product.name);
  };

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<
    'name' | 'price' | 'created_at' | 'like_count' | 'discount_percentage' | 'rating'
  >('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { wishlist, toggleWishlist, addToWishlist, isInWishlist, removeFromWishlist } =
    useWishlist();
  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [layout, setLayout] = useState(true); // true for grid/tinder, false for list

  // Custom notification state
  const [notificationVisible, setNotificationVisible] = useState(false);
  const [notificationType, setNotificationType] = useState<'added' | 'removed'>('added');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationSubtitle, setNotificationSubtitle] = useState('');
  const { t } = useTranslation();
  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const reviewsSheetRef = useRef<BottomSheetModal>(null);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [filterInStock, setFilterInStock] = useState(false);
  const [selectedProductForReviews, setSelectedProductForReviews] = useState<Product | null>(null);
  const [productReviews, setProductReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);

  // New filter states for the redesigned UI
  const [activeFilterCategory, setActiveFilterCategory] = useState('Brand');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedDeliveryTimes, setSelectedDeliveryTimes] = useState<string[]>([]);
  const [selectedInfluencerIds, setSelectedInfluencerIds] = useState<string[]>([]);
  const [influencerSearchQuery, setInfluencerSearchQuery] = useState('');
  const [showInfluencerSuggestions, setShowInfluencerSuggestions] = useState(false);
  const [activeBrandInfluencerTab, setActiveBrandInfluencerTab] = useState<'brands' | 'influencers'>('brands');
  const [filteredInfluencers, setFilteredInfluencers] = useState<any[]>([]);

  useEffect(() => {
    if (vendorId) {
      setSelectedVendorIds(prev =>
        prev.length === 1 && prev[0] === vendorId ? prev : [vendorId]
      );
    }
  }, [vendorId]);

  // Additional filter data states
  const [vendors, setVendors] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [deliveryTimes, setDeliveryTimes] = useState<any[]>([]);
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);

  // Filter categories - Category only shows for best_seller section
  const filterCategories = useMemo(() => {
    const base = ['Size', 'Brand/Influencer', 'Price Range'];
    return featuredType === 'best_seller' ? ['Category', ...base] : base;
  }, [featuredType]);

  // Set default active filter category based on available filters
  useEffect(() => {
    if (featuredType === 'best_seller') {
      setActiveFilterCategory('Category');
    } else {
      setActiveFilterCategory('Size');
    }
  }, [featuredType]);

  // Helper functions for other filter types
  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId)
        ? prev.filter(v => v !== vendorId)
        : [...prev, vendorId]
    );
  };

  const toggleSelectAllVendors = () => {
    if (selectedVendorIds.length === filteredVendors.length) {
      setSelectedVendorIds([]);
    } else {
      setSelectedVendorIds(filteredVendors.map((v: any) => v.id));
    }
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSizeSelection = (sizeId: string) => {
    setSelectedSizes(prev =>
      prev.includes(sizeId)
        ? prev.filter(s => s !== sizeId)
        : [...prev, sizeId]
    );
  };

  const toggleCountrySelection = (countryName: string) => {
    setSelectedCountries(prev =>
      prev.includes(countryName)
        ? prev.filter(c => c !== countryName)
        : [...prev, countryName]
    );
  };

  const toggleDeliveryTimeSelection = (deliveryTime: string) => {
    setSelectedDeliveryTimes(prev =>
      prev.includes(deliveryTime)
        ? prev.filter(d => d !== deliveryTime)
        : [...prev, deliveryTime]
    );
  };

  const toggleInfluencerSelection = (influencerId: string) => {
    setSelectedInfluencerIds(prev =>
      prev.includes(influencerId)
        ? prev.filter(i => i !== influencerId)
        : [...prev, influencerId]
    );
  };

  // Calculate influencer suggestions based on search query
  const influencerSuggestions = useMemo(() => {
    if (!influencerSearchQuery.trim()) return [];
    const query = influencerSearchQuery.toLowerCase();
    const suggestions = filteredInfluencers
      .filter(influencer =>
        influencer.name?.toLowerCase().includes(query) ||
        influencer.username?.toLowerCase().includes(query)
      )
      .slice(0, 5);
    return suggestions;
  }, [influencerSearchQuery, filteredInfluencers]);

  const handleClearAllFilters = () => {
    setSelectedVendorIds(vendorId ? [vendorId] : []);
    setSelectedCategories([]);
    setSelectedCountries([]);
    setSelectedSizes([]);
    setSelectedDeliveryTimes([]);
    setSelectedInfluencerIds([]);
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setFilterInStock(false);
  };

  // Check if a filter category has active filters
  const hasActiveFilters = (category: string): boolean => {
    switch (category) {
      case 'Brand':
      case 'Brand/Influencer':
        // Check vendors and influencers
        if (vendorId) {
          return selectedVendorIds.length > 1 ||
            (selectedVendorIds.length === 1 && selectedVendorIds[0] !== vendorId) ||
            selectedInfluencerIds.length > 0;
        }
        return selectedVendorIds.length > 0 || selectedInfluencerIds.length > 0;
      case 'Category':
        return selectedCategories.length > 0;
      case 'Size':
        return selectedSizes.length > 0;
      case 'Price Range':
        return filterMinPrice !== '' || filterMaxPrice !== '';
      default:
        return false;
    }
  };

  const handleApplyFilters = () => {
    filterSheetRef.current?.dismiss();
    fetchProducts();
    Toast.show({
      type: 'filtersApplied',
      text1: 'Filters Applied',
      text2: 'Your product list has been updated',
      position: 'top',
      visibilityTime: 1500,
    });
  };
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const [productRatings, setProductRatings] = useState<{
    [productId: string]: { rating: number; reviews: number };
  }>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{
    [productId: string]: 'loading' | 'loaded' | 'error';
  }>({});
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [tinderMode, setTinderMode] = useState(true); // Start in swipe view by default
  const [rightSwipeCount, setRightSwipeCount] = useState(0); // Track right swipes for toast notification
  const [hasSeenSwipeTutorial, setHasSeenSwipeTutorial] = useState(false); // Track if user has seen swipe tutorial
  const [dontShowSwipeTutorial, setDontShowSwipeTutorial] = useState<boolean>(false);
  const [dontShowAgainChecked, setDontShowAgainChecked] = useState<boolean>(false); // Checkbox state

  // Products view tutorial modal state
  const [showProductsViewTutorial, setShowProductsViewTutorial] = useState(false);
  const [productsViewTutorialDontShowAgain, setProductsViewTutorialDontShowAgain] = useState(false);

  // Onboarding states
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'views' | 'swipe' | 'complete'>('views');
  const onboardingAnimation = useRef(new Animated.Value(0)).current;
  const viewHighlightAnimation = useRef(new Animated.Value(0)).current;
  const swipeTutorialAnimation = useRef(new Animated.Value(0)).current;
  const spotlightAnimation = useRef(new Animated.Value(0)).current;
  const swipeSpotlightAnimation = useRef(new Animated.Value(0)).current;

  // Dynamic layout measurements for spotlight positioning
  const [viewToggleLayout, setViewToggleLayout] = useState({ x: -1, y: -1, width: 0, height: 0 });
  const [swipeContainerLayout, setSwipeContainerLayout] = useState({ x: -1, y: -1, width: 0, height: 0 });
  const viewToggleRef = useRef<View>(null);
  const swipeContainerRef = useRef<View>(null);

  // Sort options mapping
  const sortOptions = [
    { label: t('whats_new'), value: { by: 'created_at', order: 'desc' } },
    { label: t('price_high_to_low'), value: { by: 'price', order: 'desc' } },
    { label: t('popularity'), value: { by: 'like_count', order: 'desc' } },
    { label: t('discount'), value: { by: 'discount_percentage', order: 'desc' } },
    { label: t('price_low_to_high'), value: { by: 'price', order: 'asc' } },
    { label: t('customer_rating'), value: { by: 'rating', order: 'desc' } },
  ];

  // Helper to get current sort label
  const getCurrentSortLabel = () => {
    const found = sortOptions.find((o) => o.value.by === sortBy && o.value.order === sortOrder);
    return found ? found.label : t('whats_new');
  };

  // Update sort logic for new options
  const handleSortOption = (option: (typeof sortOptions)[0]) => {
    setSortBy(option.value.by as any);
    setSortOrder(option.value.order as any);
  };

  useEffect(() => {
    fetchProducts();
    fetchFilterData();
  }, [
    category.id,
    featuredType,
    vendorId,
    sortBy,
    sortOrder,
    selectedVendorIds,
    selectedCategories,
    selectedSizes,
    selectedCountries,
    selectedDeliveryTimes,
    filterMinPrice,
    filterMaxPrice,
    filterInStock,
  ]);

  // Fetch filter data (vendors, categories, sizes, etc.)
  const fetchFilterData = async () => {
    try {
      // Fetch vendors that have active products
      const { data: activeProducts, error: productError } = await supabase
        .from('products')
        .select('vendor_id')
        .eq('is_active', true);

      if (productError) {
        console.error('Error fetching active product vendors:', productError);
      }

      const activeVendorIds = [...new Set(activeProducts?.map(p => p.vendor_id).filter(Boolean))];

      const { data: vendorsData, error: vendorsError } = await supabase
        .from('vendors')
        .select('business_name, id, profile_image_url')
        .in('id', activeVendorIds)
        .order('business_name');

      if (vendorsError) {
        console.error('Error fetching vendors:', vendorsError);
      }

      if (!vendorsError && vendorsData) {
        console.log('Fetched vendors:', vendorsData.length);
        setVendors(vendorsData);
        setFilteredVendors(vendorsData);
      } else {
        console.log('No vendors data or error occurred');
      }

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (!categoriesError && categoriesData) {
        setCategories(categoriesData);
      }

      // Fetch sizes from database
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('id, name');

      if (sizesError) {
        console.error('Error fetching sizes:', sizesError);
      } else if (sizesData && sizesData.length > 0) {
        console.log('Sizes fetched from database:', sizesData);

        // Custom sort function for sizes (S, M, L, XL, XXL, 3XL, 4XL, 5XL, etc.)
        const sizeOrder: { [key: string]: number } = {
          'XS': 1,
          'S': 2,
          'M': 3,
          'L': 4,
          'XL': 5,
          'XXL': 6,
          '2XL': 6,
          '3XL': 7,
          'XXXL': 7,
          '4XL': 8,
          '5XL': 9,
          '6XL': 10,
          '7XL': 11,
          '8XL': 12,
        };

        const sortedSizes = [...sizesData].sort((a, b) => {
          const aUpper = a.name.toUpperCase().trim();
          const bUpper = b.name.toUpperCase().trim();

          const aOrder = sizeOrder[aUpper] || 999;
          const bOrder = sizeOrder[bUpper] || 999;

          // If both have defined order, sort by order
          if (aOrder !== 999 && bOrder !== 999) {
            return aOrder - bOrder;
          }

          // If one has defined order and other doesn't, prioritize the one with order
          if (aOrder !== 999) return -1;
          if (bOrder !== 999) return 1;

          // Otherwise sort alphabetically
          return aUpper.localeCompare(bUpper);
        });

        setSizes(sortedSizes);
      } else {
        console.log('No sizes found in database');
      }

      // Sample countries (you can fetch from database if you have a countries table)
      setCountries([
        { id: '1', name: 'India' },
        { id: '2', name: 'China' },
        { id: '3', name: 'Bangladesh' },
        { id: '4', name: 'Vietnam' },
      ]);

      // Sample delivery times
      setDeliveryTimes([
        { id: '1', name: '1-2 Days' },
        { id: '2', name: '3-5 Days' },
        { id: '3', name: '1 Week' },
        { id: '4', name: '2 Weeks' },
      ]);

      // Fetch influencers that have products
      const { data: productsWithInfluencers } = await supabase
        .from('products')
        .select('influencer_id')
        .not('influencer_id', 'is', null)
        .eq('is_active', true);

      if (productsWithInfluencers) {
        const influencerIds = [...new Set(productsWithInfluencers.map((p: any) => p.influencer_id).filter(Boolean))];

        if (influencerIds.length > 0) {
          const { data: influencersData, error: influencersError } = await supabase
            .from('influencer_profiles')
            .select('*')
            .in('id', influencerIds)
            .order('name');

          if (!influencersError && influencersData) {
            console.log('Fetched influencers with products:', influencersData.length);
            setFilteredInfluencers(influencersData);
          }
        }
      }

    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  // Vendor search functionality
  const handleVendorSearch = (query: string) => {
    setVendorSearchQuery(query);
    if (query.trim() === '') {
      setFilteredVendors(vendors);
    } else {
      const filtered = vendors.filter(vendor =>
        vendor.business_name.toLowerCase().includes(query.toLowerCase())
      );
      setFilteredVendors(filtered);
    }
  };

  // Check if user wants to suppress tutorial - show every time unless "don't show again" is checked
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const dontShow = await AsyncStorage.getItem('products_view_tutorial_dont_show');
        setProductsViewTutorialDontShowAgain(dontShow === 'true');

        // Show tutorial every time unless user has explicitly chosen "don't show again"
        if (dontShow !== 'true') {
          // Show tutorial after screen loads
          setTimeout(() => {
            setShowProductsViewTutorial(true);
          }, 800);
        }
      } catch (error) {
        console.log('Error checking tutorial status:', error);
        // If error, show tutorial anyway
        setTimeout(() => {
          setShowProductsViewTutorial(true);
        }, 800);
      }
    };

    checkTutorialStatus();
  }, []);

  // Onboarding logic disabled - only showing video tutorial modal now
  // Removed the spotlight/highlight animation onboarding

  // Load swipe tutorial suppression immediately on mount as well (independent of user)
  useEffect(() => {
    const loadSwipeSuppression = async () => {
      try {
        const dontShowSwipe = await AsyncStorage.getItem('products_swipe_tutorial_dont_show');
        setDontShowSwipeTutorial(dontShowSwipe === 'true');
      } catch { }
    };
    loadSwipeSuppression();
  }, []);

  // Spotlight animation not needed for modal, keep refs for potential reuse

  const startSwipeTutorial = () => {
    // Set onboarding step to 'swipe' so overlays are visible
    setOnboardingStep('swipe');

    // Smooth transition: hide view tutorial
    Animated.timing(spotlightAnimation, {
      toValue: 0,
      duration: 400,
      useNativeDriver: false,
    }).start();

    // Start swipe tutorial with smooth transition
    setTimeout(() => {
      // Measure the swipe container layout before starting animation
      swipeContainerRef.current?.measureInWindow((x, y, width, height) => {
        console.log('Swipe Container Layout:', { x, y, width, height });
        setSwipeContainerLayout({ x, y, width, height });
      });

      swipeSpotlightAnimation.setValue(0);
      swipeTutorialAnimation.setValue(0);

      Animated.sequence([
        // Fade in swipe spotlight
        Animated.timing(swipeSpotlightAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        // Pause for user to read
        Animated.delay(800),
        // Start smooth swipe demonstration loop
        Animated.loop(
          Animated.sequence([
            // Left swipe demonstration (smooth)
            Animated.timing(swipeTutorialAnimation, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: false,
            }),
            Animated.delay(600),
            // Right swipe demonstration (smooth)
            Animated.timing(swipeTutorialAnimation, {
              toValue: 2,
              duration: 1000,
              useNativeDriver: false,
            }),
            Animated.delay(600),
            // Reset smoothly
            Animated.timing(swipeTutorialAnimation, {
              toValue: 0,
              duration: 500,
              useNativeDriver: false,
            }),
            Animated.delay(400),
          ]),
          { iterations: 3 }
        ),
      ]).start();
    }, 400);
  };

  // Track if tutorial modal was just closed (to show swipe animation on first swipe view)
  const [tutorialModalJustClosed, setTutorialModalJustClosed] = useState(false);

  // Handle products view tutorial dismiss - just close, don't save preference
  const handleDismissProductsViewTutorial = useCallback(() => {
    setShowProductsViewTutorial(false);
    // Reset checkbox state for next time
    setProductsViewTutorialDontShowAgain(false);
    // Mark that tutorial was just closed - will trigger swipe animation if user selects swipe
    setTutorialModalJustClosed(true);
  }, []);

  const completeOnboarding = async (dontShowAgain: boolean = false) => {
    try {
      await supabase
        .from('user_settings')
        .upsert({
          user_id: userData?.id,
          products_onboarding_completed: true,
        });
    } catch (error) {
      console.log('Error saving onboarding status:', error);
    }

    // If user selected "don't show again", save to AsyncStorage
    if (dontShowAgain) {
      try {
        await AsyncStorage.setItem('products_tutorial_dont_show', 'true');
        await AsyncStorage.setItem('products_swipe_tutorial_dont_show', 'true');
        setDontShowSwipeTutorial(true);
      } catch (error) {
        console.log('Error saving dont show again preference:', error);
      }
    }

    // Mark that user has seen swipe tutorial
    setHasSeenSwipeTutorial(true);

    // Hide all spotlights
    Animated.parallel([
      Animated.timing(spotlightAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(swipeSpotlightAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
      Animated.timing(swipeTutorialAnimation, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start(() => {
      setShowOnboarding(false);
      setOnboardingStep('views');
    });
  };

  const skipOnboarding = () => {
    completeOnboarding();
  };

  // Function to fetch ratings for products
  const fetchProductRatings = async (productIds: string[]) => {
    try {
      if (productIds.length === 0) return {};

      // Convert all product IDs to strings for consistent handling
      const stringProductIds = productIds.map(id => String(id));

      // Fetch in batches to avoid Supabase query limits
      const batchSize = 50;
      let allReviews: { product_id: string; rating: number }[] = [];

      for (let i = 0; i < stringProductIds.length; i += batchSize) {
        const batch = stringProductIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('product_reviews')
          .select('product_id, rating')
          .in('product_id', batch);

        if (error) {
          console.error('Error fetching product ratings batch:', error);
          continue;
        }

        if (data) {
          allReviews = [...allReviews, ...data];
        }
      }

      console.log('📊 Fetched reviews data:', allReviews.length, 'reviews for', stringProductIds.length, 'products');
      console.log('📊 Product IDs queried:', stringProductIds.slice(0, 5), '...');
      console.log('📊 Reviews returned for products:', allReviews.slice(0, 5).map(r => r.product_id), '...');

      // Calculate average rating and count for each product
      const ratings: { [productId: string]: { rating: number; reviews: number } } = {};

      // Group reviews by product_id (using string conversion for consistent matching)
      const reviewsByProduct: { [key: string]: number[] } = {};

      // Initialize all products with empty arrays
      stringProductIds.forEach(id => {
        reviewsByProduct[id] = [];
      });

      // Group the fetched reviews
      if (allReviews && allReviews.length > 0) {
        allReviews.forEach((review) => {
          const reviewProductId = String(review.product_id);
          if (reviewsByProduct[reviewProductId]) {
            reviewsByProduct[reviewProductId].push(review.rating);
          } else {
            // Try to find a matching product ID (handles edge cases like leading zeros, etc.)
            const matchingKey = stringProductIds.find(id => String(id) === reviewProductId);
            if (matchingKey) {
              reviewsByProduct[matchingKey].push(review.rating);
            }
          }
        });
      }

      // Calculate ratings for each product
      stringProductIds.forEach((productId) => {
        const productReviewRatings = reviewsByProduct[productId] || [];
        const totalRating = productReviewRatings.reduce((sum, rating) => sum + rating, 0);
        const averageRating = productReviewRatings.length > 0 ? totalRating / productReviewRatings.length : 0;

        ratings[productId] = {
          rating: averageRating,
          reviews: productReviewRatings.length,
        };

        // Debug log for products with reviews
        if (productReviewRatings.length > 0) {
          console.log(`📊 Product ${productId}: ${productReviewRatings.length} reviews, avg rating: ${averageRating.toFixed(1)}`);
        }
      });

      setProductRatings((prev) => ({ ...prev, ...ratings }));
      return ratings; // Return ratings so caller can use them immediately
    } catch (error) {
      console.error('Error fetching product ratings:', error);
      return {}; // Return empty object on error
    }
  };

  // Function to fetch detailed reviews for a product
  const fetchProductReviews = async (productId: string) => {
    setReviewsLoading(true);
    try {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        setProductReviews([]);
        return;
      }

      setProductReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setProductReviews([]);
    } finally {
      setReviewsLoading(false);
    }
  };

  // Function to open reviews bottom sheet
  const openReviewsSheet = async (product: Product) => {
    setSelectedProductForReviews(product);
    await fetchProductReviews(product.id);
    reviewsSheetRef.current?.present();
  };

  // Auto-hide saved popup with smooth animation
  // Removed wishlist popup animation - now using toast notifications only

  // Shimmer animation effect
  useEffect(() => {
    const shimmerLoop = () => {
      Animated.sequence([
        Animated.timing(shimmerAnimation, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnimation, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(shimmerLoop);
    };
    shimmerLoop();
  }, [shimmerAnimation]);

  // Helper function to show custom notification
  const showNotification = (type: 'added' | 'removed', title: string, subtitle?: string) => {
    setNotificationType(type);
    setNotificationTitle(title);
    setNotificationSubtitle(subtitle || '');
    setNotificationVisible(true);
  };

  // Helper function to add product directly to "All" collection
  const addToAllCollection = async (product: Product) => {
    if (!userData?.id) {
      console.log('No user ID, cannot add to collection');
      return;
    }

    // Show custom notification immediately when heart is clicked
    showNotification('added', 'Added to Wishlist', `${product.name} saved to All folder`);

    try {
      // Get or create "All" collection
      let allCollectionId = null;
      const { data: existingAllCollection } = await supabase
        .from('collections')
        .select('id')
        .eq('user_id', userData.id)
        .eq('name', 'All')
        .single();

      if (existingAllCollection) {
        allCollectionId = existingAllCollection.id;
      } else {
        // Create "All" collection
        const { data: newCollection, error: createError } = await supabase
          .from('collections')
          .insert({
            user_id: userData.id,
            name: 'All',
            is_private: false,
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating All collection:', createError);
          return;
        }
        allCollectionId = newCollection.id;
      }

      // Check if product already exists in "All" collection
      const { data: existingProduct } = await supabase
        .from('collection_products')
        .select('id')
        .eq('product_id', product.id)
        .eq('collection_id', allCollectionId)
        .single();

      if (!existingProduct) {
        // Add product to "All" collection
        const { error: insertError } = await supabase
          .from('collection_products')
          .insert({
            product_id: product.id,
            collection_id: allCollectionId,
          });

        if (insertError) {
          console.error('Error adding to All collection:', insertError);
        } else {
          console.log('Successfully added to All collection');

          // Add to wishlist context with complete product object
          const wishlistProduct = {
            id: product.id,
            name: product.name,
            description: product.description || '',
            price: getUserPrice(product),
            image_url: product.image_urls?.[0] || '',
            image_urls: product.image_urls || [],
            video_urls: product.video_urls || [],
            featured_type: product.featured_type || '',
            category: product.category,
            stock_quantity: product.variants?.[0]?.quantity || 0,
            variants: product.variants || [],
          };

          await addToWishlist(wishlistProduct);

          // Toast already shown at the beginning
        }
      } else {
        console.log('Product already in All collection');
      }
    } catch (error) {
      console.error('Error in addToAllCollection:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('products')
        .select(
          `
          id,
          name,
          description,
          category_id,
          category:categories(name),
          vendor_id,
          image_urls,
          video_urls,
          is_active,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          created_at,
          updated_at,
          product_variants(
            id,
            price,
            sku,
            mrp_price,
            rsp_price,
            cost_price,
            discount_percentage,
            quantity,
            image_urls,
            video_urls,
            color_id,
            size_id,
            size:sizes(id, name)
          )
        `
        )
        .eq('is_active', true);

      // If featuredType is provided, filter by featured_type instead of category_id
      if (featuredType) {
        query = query.eq('featured_type', featuredType);
      } else {
        query = query.eq('category_id', category.id);
      }
      // Apply price range filters

      // Apply stock filter
      if (filterInStock) query = query.gt('stock_quantity', 0);

      // Apply vendor filter at DB level by vendor_id
      if (vendorId) {
        query = query.eq('vendor_id', vendorId);
      } else if (selectedVendorIds.length > 0) {
        query = query.in('vendor_id', selectedVendorIds);
      }

      // Apply influencer filter
      if (selectedInfluencerIds.length > 0) {
        query = query.in('influencer_id', selectedInfluencerIds);
      }

      // Apply category filters
      if (selectedCategories.length > 0) {
        query = query.in('category_id', selectedCategories);
      }

      // Apply size filters (will be filtered in JavaScript since sizes are in variants)
      // Note: Size filtering will be handled in JavaScript after fetching

      // For non-price sorting, we can sort at database level
      if (sortBy !== 'price') {
        query = query.order(sortBy, { ascending: sortOrder === 'asc' });
      } else {
        // For price sorting, we'll sort in JavaScript after fetching
        query = query.order('created_at', { ascending: false }); // Default order
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching products:', error);
        return;
      }
      const fixedData = (data || []).map((item: any) => {
        const extractedImages = getProductImages(item);
        const normalizedVariants = (item.product_variants || []).map((variant: any) => {
          const normalizedSize = Array.isArray(variant.size) ? variant.size[0] : variant.size;
          return {
            ...variant,
            size: normalizedSize,
          };
        });

        // Sort variants to prioritize 'M' size
        normalizedVariants.sort((a: any, b: any) => {
          const sizeA = a.size?.name || '';
          const sizeB = b.size?.name || '';

          // Debug logs for specific product to check data
          // if (item.name.includes('Denim')) console.log('Sorting variant:', sizeA, sizeB);

          const normA = sizeA.trim().toUpperCase();
          const normB = sizeB.trim().toUpperCase();

          if (normA === 'M' && normB !== 'M') return -1;
          if (normB === 'M' && normA !== 'M') return 1;

          return getSizeSortValue(normA) - getSizeSortValue(normB);
        });

        return {
          ...item,
          image_urls: extractedImages,
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: normalizedVariants,
        };
      });

      let filteredData = fixedData;

      const minPriceValue = filterMinPrice !== '' ? Number(filterMinPrice) : null;
      const maxPriceValue = filterMaxPrice !== '' ? Number(filterMaxPrice) : null;
      if ((minPriceValue !== null && !Number.isNaN(minPriceValue)) || (maxPriceValue !== null && !Number.isNaN(maxPriceValue))) {
        filteredData = filteredData.filter((product) => {
          const variantPrices = (product.variants || [])
            .map((variant: any) => Number(variant.price))
            .filter((price: number) => !Number.isNaN(price));

          if (variantPrices.length === 0) {
            return false;
          }

          return variantPrices.some((price: number) => {
            const meetsMin = minPriceValue === null || Number.isNaN(minPriceValue) || price >= minPriceValue;
            const meetsMax = maxPriceValue === null || Number.isNaN(maxPriceValue) || price <= maxPriceValue;
            return meetsMin && meetsMax;
          });
        });
      }

      // Vendor filtering already applied at DB level

      // Apply size filters by size_id (since sizes are in variants)
      if (selectedSizes.length > 0) {
        console.log('Applying size filter for size IDs:', selectedSizes);
        filteredData = filteredData.filter((product) => {
          const hasMatchingSize = product.variants?.some((variant: any) => {
            // Match by size_id from variant
            const matches = variant.size_id && selectedSizes.includes(variant.size_id);
            if (matches) {
              console.log('Matched variant:', variant.size_id, 'Size:', variant.size?.name);
            }
            return matches;
          });
          return hasMatchingSize;
        });
        console.log('Products after size filter:', filteredData.length);
      }

      // Apply country filters (if you have country field in products)
      if (selectedCountries.length > 0) {
        filteredData = filteredData.filter((product) => {
          // Assuming products have a country_of_origin field
          return product.country_of_origin && selectedCountries.includes(product.country_of_origin);
        });
      }

      // Apply delivery time filters (if you have delivery_time field in products)
      if (selectedDeliveryTimes.length > 0) {
        filteredData = filteredData.filter((product) => {
          // Assuming products have a delivery_time field
          return product.delivery_time && selectedDeliveryTimes.includes(product.delivery_time);
        });
      }

      // Apply JavaScript sorting for price and other complex sorts
      let sortedData = filteredData;
      if (sortBy === 'price') {
        sortedData = [...filteredData].sort((a, b) => {
          const priceA = getUserPrice(a);
          const priceB = getUserPrice(b);
          return sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });
      } else if (sortBy === 'rating') {
        sortedData = [...filteredData].sort((a, b) => {
          const ratingA = productRatings[String(a.id)]?.rating || (a.rating as number) || 0;
          const ratingB = productRatings[String(b.id)]?.rating || (b.rating as number) || 0;
          return sortOrder === 'asc' ? ratingA - ratingB : ratingB - ratingA;
        });
      } else if (sortBy === 'like_count') {
        sortedData = [...filteredData].sort((a, b) => {
          const likesA = (a.like_count as number) || 0;
          const likesB = (b.like_count as number) || 0;
          return sortOrder === 'asc' ? likesA - likesB : likesB - likesA;
        });
      } else if (sortBy === 'discount_percentage') {
        sortedData = [...filteredData].sort((a, b) => {
          const discountA = (a.discount_percentage as number) || 0;
          const discountB = (b.discount_percentage as number) || 0;
          return sortOrder === 'asc' ? discountA - discountB : discountB - discountA;
        });
      }

      // Fetch ratings BEFORE setting products so they're available when cards render
      const productIds = fixedData.map((product) => product.id);
      const fetchedRatings = await fetchProductRatings(productIds);

      // Force a synchronous state update with the ratings FIRST, then products
      // This ensures ratings are committed before products trigger card rendering
      setProductRatings(prev => ({ ...prev, ...fetchedRatings }));

      // Use a microtask to ensure ratings state is committed before products
      await new Promise(resolve => setTimeout(resolve, 50));

      setProducts(sortedData);
      setCurrentCardIndex(0); // Reset card index when products change
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    navigation.goBack();
  };

  // Function to get user-specific price for a product
  const getUserPrice = useCallback(
    (product: Product) => {
      if (!product.variants || product.variants.length === 0) {
        return 1400; // No variants available
      }

      // If user has a size preference, try to find that size
      if (userData?.size) {
        const userSizeVariant = product.variants.find((v) => v.size?.name === userData.size);
        if (userSizeVariant) {
          return userSizeVariant.price;
        }
      }

      // If user size not found or no user size, return the smallest price
      const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
      return sortedVariants[0]?.price || 0;
    },
    [userData?.size]
  );

  // Memoize product prices to prevent unnecessary recalculations
  const productPrices = useMemo(() => {
    const prices: { [key: string]: number } = {};
    products.forEach((product) => {
      prices[product.id] = getUserPrice(product);
    });
    return prices;
  }, [products, getUserPrice]);

  // Calculate product count for each size
  const sizeProductCounts = useMemo(() => {
    const counts: { [sizeId: string]: number } = {};

    sizes.forEach((size) => {
      counts[size.id] = products.filter((product) => {
        return product.variants?.some((variant: any) => variant.size_id === size.id);
      }).length;
    });

    return counts;
  }, [products, sizes]);

  // Function to get the smallest price for a product
  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  // Handle tinder card swipe
  const handleTinderSwipe = (direction: 'left' | 'right', product: Product) => {
    if (direction === 'right') {
      // Right swipe = like/add to wishlist
      if (!isInWishlist(product.id)) {
        setSelectedProduct({
          ...product,
          price: productPrices[product.id as string] || 0,
          featured_type: product.featured_type || undefined,
        } as any);
        setShowCollectionSheet(true);
      }
    }

    // Move to next card
    setCurrentCardIndex((prev) => prev + 1);
  };

  const renderProductCard = (product: Product) => {
    // Calculate original price and discount
    const userPrice = productPrices[product.id as string] || 0;
    const hasDiscount =
      product.variants?.some((v) => v.discount_percentage && v.discount_percentage > 0) || false;
    const originalPrice = hasDiscount
      ? userPrice /
      (1 - Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const discountedPrice = userPrice;

    // Calculate total stock from variants
    const totalStock =
      product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

    // Get rating data for badge
    const ratingData = productRatings[String(product.id)] ?? { rating: 0, reviews: 0 };

    return (
      <TouchableOpacity
        style={layout && !tinderMode ? styles.productCard : styles.productListStyle}
        onPress={() => {
          // Transform Product to match ProductDetails expected format
          const productForDetails = {
            id: product.id,
            name: product.name,
            price: discountedPrice,
            originalPrice: hasDiscount ? originalPrice : undefined,
            discount: Math.max(
              ...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])
            ),
            rating: productRatings[String(product.id)]?.rating || 0, // Real rating from product_reviews
            reviews: productRatings[String(product.id)]?.reviews || 0, // Real review count from product_reviews
            image: getFirstSafeProductImage(product),
            image_urls: getProductImages(product),
            video_urls: product.video_urls || [],
            description: product.description,
            stock: totalStock.toString(),
            featured: product.featured_type !== null,
            images: 1,
            sku: product.variants?.[0]?.sku || '',
            category: product.category?.name || '',
            vendor_name: product.vendor_name || '',
            alias_vendor: product.alias_vendor || '',
            return_policy: product.return_policy || '',
          };
          (navigation as any).navigate('ProductDetails', { product: productForDetails });
        }}>
        {/* Wishlist icon - now opens collection sheet and shows filled if in wishlist */}
        <TouchableOpacity
          style={styles.wishlistIcon}
          onPress={async (e) => {
            e.stopPropagation();
            if (isInWishlist(product.id)) {
              // Show collection sheet to manually remove from collections
              setSelectedProduct({
                ...product,
                price: productPrices[product.id as string] || 0,
                featured_type: product.featured_type || undefined,
              } as any);
              setShowCollectionSheet(true);
            } else {
              // Add to "All" collection first
              addToAllCollection(product);
              // Then show collection sheet to optionally add to other folders
              setSelectedProduct({
                ...product,
                price: productPrices[product.id as string] || 0,
                featured_type: product.featured_type || undefined,
              } as any);
              setTimeout(() => {
                setShowCollectionSheet(true);
              }, 500);
            }
          }}
          activeOpacity={0.7}>
          <Ionicons
            name={isInWishlist(product.id) ? 'heart' : 'heart-outline'}
            size={22}
            color={isInWishlist(product.id) ? '#F53F7A' : '#999'}
          />
        </TouchableOpacity>

        {product.featured_type && (
          <View
            style={[
              styles.featuredBadge,
              { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' },
            ]}>
            <Text style={styles.featuredBadgeText}>
              {product.featured_type === 'trending' ? t('trending') : t('best_seller')}
            </Text>
          </View>
        )}
        <View style={styles.productImageWrapper}>
          {imageLoadingStates[product.id] === 'error' ? (
            // Show skeleton when image failed to load
            <View
              style={
                layout && !tinderMode
                  ? [styles.productImage, styles.imageSkeleton]
                  : styles.listImageContainer
              }>
              <Animated.View
                style={[
                  styles.skeletonShimmer,
                  {
                    opacity: shimmerAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.3, 0.7],
                    }),
                  },
                ]}
              />
              <Ionicons name="image-outline" size={32} color="#ccc" />
            </View>
          ) : (
            <Image
              source={{ uri: getFirstSafeProductImage(product) }}
              style={layout && !tinderMode ? styles.productImage : styles.listImage}
              onLoadStart={() => {
                setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'loading' }));
              }}
              onLoad={() => {
                setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'loaded' }));
              }}
              onError={(error) => {
                setImageLoadingStates((prev) => ({ ...prev, [product.id]: 'error' }));
              }}
            />
          )}
          {/* Rating Badge Overlay on Image */}
          <View style={styles.gridRatingBadgeOverlay}>
            <View style={styles.gridRatingBadge}>
              <Ionicons name="star" size={14} color="#FFD600" />
              <Text style={styles.gridRatingText}>{ratingData.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>
        <View style={styles.productInfo}>
          {/* Vendor name above product title */}
          <Text style={styles.vendorName} numberOfLines={1}>
            {product.vendor_name || product.alias_vendor || 'Only2U'}
          </Text>

          <Text style={styles.productName} numberOfLines={2}>
            {product.name}
          </Text>

          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              {hasDiscount && (
                <Text style={styles.originalPrice}>₹{Math.round(originalPrice)}</Text>
              )}
              <Text style={styles.price}>₹{Math.round(getUserPrice(product))}</Text>
              {/* Discount badge beside price */}
              {hasDiscount && (
                <View style={styles.discountBadgeInline}>
                  <Text style={styles.discountBadgeTextInline}>
                    {Math.round(
                      Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0]))
                    )}
                    % OFF
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.discountAndRatingRow}>
              <View style={styles.reviewsContainer}>
                <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
                <Text style={styles.reviews}>
                  {productRatings[String(product.id)]?.rating?.toFixed(1) || '0.0'}
                </Text>
                {ratingData.reviews > 0 && (
                  <Text style={[styles.reviews, { marginLeft: 4, fontWeight: '500', color: '#666' }]}>
                    ({ratingData.reviews})
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };
  const blurhash =
    '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

  // Create dynamic styles function - Enhanced Tinder-like design


  // These functions are now defined above

  const handleProductClick = (product: Product) => {
    const userPrice = productPrices[product.id as string] || 0;
    const hasDiscount =
      product.variants?.some((v) => v.discount_percentage && v.discount_percentage > 0) || false;
    const originalPrice = hasDiscount
      ? userPrice /
      (1 - Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])) / 100)
      : userPrice;
    const totalStock =
      product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || 0;

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: userPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0])),
      rating: productRatings[String(product.id)]?.rating || 0,
      reviews: productRatings[String(product.id)]?.reviews || 0,
      image: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: product.video_urls || [],
      description: product.description,
      stock: totalStock.toString(),
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
    };
    (navigation as any).navigate('ProductDetails', { product: productForDetails });
  };

  const renderStars = (rating: number, size: number = 14) => {
    const filledStars = Math.floor(rating);
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i < filledStars ? 'star' : 'star-outline'}
          size={size}
          color="#facc15"
        />
      );
    }
    return stars;
  };

  const renderItem = ({ item }: { item: Product }) => {
    const ratingData = productRatings[String(item.id)] ?? { rating: 0, reviews: 0 };
    const vendorName = item.vendor_name || item.alias_vendor || 'Only2U';

    const RatingBadge = ({ style }: { style?: any }) => (
      <View style={[styles.ratingBadgePill, style]}>
        <Ionicons name="star" size={14} color="#FFD600" />
        <Text style={styles.ratingBadgeValue}>{ratingData.rating.toFixed(1)}</Text>
      </View>
    );

    return layout && !tinderMode ? (
      // Horizontal Card (List View)
      <TouchableOpacity onPress={() => handleProductClick(item)} style={styles.horizontalCard}>
        <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.horizontalImage} />
        <View style={styles.horizontalDetails}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.category}>{item.category?.name || ''}</Text>
          <Text style={styles.horizontalPrice}>₹{productPrices[item.id] || 0}</Text>
          <RatingBadge />
        </View>
      </TouchableOpacity>
    ) : (
      // Vertical Card (Grid View)
      <TouchableOpacity onPress={() => handleProductClick(item)} style={styles.verticalCardWrapper}>
        <View style={styles.verticalCard}>
          <View style={styles.verticalImageContainer}>
            <Image source={{ uri: getFirstSafeProductImage(item) }} style={styles.verticalImage} />
            {/* Rating badge overlaid on top-left of image */}
            <View style={styles.ratingBadgeOverlay}>
              <RatingBadge style={styles.ratingBadgeOnImage} />
            </View>
          </View>
          <View style={styles.verticalDetails}>
            <Text style={styles.verticalVendorText} numberOfLines={1}>{vendorName}</Text>
            <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
            <Text style={styles.category} numberOfLines={1}>{item.category?.name || ''}</Text>
            <Text style={styles.verticalPrice}>₹{productPrices[item.id] || 0}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Tinder Cards
  const renderTinderCards = () => {
    if (products.length === 0) return null;

    const visibleCards = products.slice(currentCardIndex, currentCardIndex + 3);

    return (
      <View style={styles.tinderContainer}>
        {visibleCards.length === 0 ? (
          <View style={styles.noMoreCardsContainer}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            <Text style={styles.noMoreCardsTitle}>All done!</Text>
            <Text style={styles.noMoreCardsSubtitle}>
              You've seen all products in this category
            </Text>
            <TouchableOpacity style={styles.resetButton} onPress={() => setCurrentCardIndex(0)}>
              <Text style={styles.resetButtonText}>Start Over</Text>
            </TouchableOpacity>
          </View>
        ) : (
          visibleCards
            .map((product, index) => (
              <TinderCard
                key={`${product.id}-${currentCardIndex + index}`}
                product={product}
                index={index}
                onSwipe={handleTinderSwipe}
                productPrices={productPrices}
                ratingData={productRatings[String(product.id)] ?? { rating: 0, reviews: 0 }}
                getUserPrice={getUserPrice}
                isInWishlist={isInWishlist}
                removeFromWishlist={removeFromWishlist}
                setSelectedProduct={setSelectedProduct}
                setShowCollectionSheet={setShowCollectionSheet}
                addToAllCollection={addToAllCollection}
                navigation={navigation}
              />
            ))
            .reverse()
        )}
      </View>
    );
  };

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            <Only2ULogo size="medium" />
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.currencyContainer}
                onPress={() => setShowCoinsModal(true)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons name="face-man-shimmer" size={16} color="#F53F7A" />
                <Text style={styles.currencyText}>{userData?.coin_balance || 0}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => (navigation as any).navigate('TabNavigator', {
                  screen: 'Home',
                  params: {
                    screen: 'Wishlist'
                  }
                })}>
                <Ionicons name="heart-outline" size={22} color="#F53F7A" />
                {wishlist.length > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{wishlist.length > 99 ? '99+' : wishlist.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => (navigation as any).navigate('Profile')}>
                {userData?.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <Ionicons name="person-outline" size={16} color="#333" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.titleContainer}>
          <View style={styles.titleLeft}>
            <Text style={styles.title}>{category.name}</Text>
          </View>
          {/* View Toggle Buttons */}
          <Animated.View
            ref={viewToggleRef}
            style={[
              styles.viewToggleContainer,
              // no glowing highlight when using modal tutorial
            ]}
            onLayout={() => {
              // Measure position relative to window (absolute screen position) with delay
              setTimeout(() => {
                viewToggleRef.current?.measureInWindow((x, y, width, height) => {
                  console.log('onLayout - View Toggle:', { x, y, width, height });
                  setViewToggleLayout({ x, y, width, height });
                });
              }, 50);
            }}>
            <TouchableOpacity
              style={[styles.viewToggleButton, !tinderMode && layout && styles.activeViewToggle]}
              onPress={() => {
                setLayout(true);
                setTinderMode(false);
              }}>
              <Ionicons name="grid" size={16} color={!tinderMode && layout ? '#F53F7A' : '#666'} />
              <Text style={[styles.viewToggleText, !tinderMode && layout && styles.activeViewToggleText]}>
                Grid
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.viewToggleButton, tinderMode && styles.activeViewToggle]}
              onPress={() => {
                const wasNotInTinderMode = !tinderMode;
                setLayout(true);
                setTinderMode(true);

                // Show swipe tutorial animation if:
                // 1. Tutorial modal was just closed (user saw the video tutorial)
                // 2. User is switching to swipe mode for the first time
                // 3. Swipe tutorial is not suppressed
                if (wasNotInTinderMode && tutorialModalJustClosed && !dontShowSwipeTutorial) {
                  setTimeout(() => {
                    setOnboardingStep('swipe'); // Set step so overlays are visible
                    startSwipeTutorial();
                    setTutorialModalJustClosed(false); // Reset after showing
                  }, 300);
                } else if (wasNotInTinderMode && !hasSeenSwipeTutorial && !dontShowSwipeTutorial && userData?.id) {
                  // Also show for first-time users even if modal wasn't just closed
                  setTimeout(() => {
                    setOnboardingStep('swipe'); // Set step so overlays are visible
                    startSwipeTutorial();
                  }, 300);
                }
              }}>
              <Ionicons name="layers" size={16} color={tinderMode ? '#F53F7A' : '#666'} />
              <Text style={[styles.viewToggleText, tinderMode && styles.activeViewToggleText]}>
                Swipe
              </Text>
            </TouchableOpacity>

            {/* Filter Button */}
            <TouchableOpacity
              style={styles.filterButton}
              onPress={() => filterSheetRef.current?.present()}>
              <Ionicons name="filter-outline" size={16} color="#666" />
              <Text style={styles.filterButtonText}>Filter</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Products */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F53F7A" />
            <Text style={styles.loadingText}>{t('loading_products')}</Text>
          </View>
        ) : products.length === 0 ? (
          <ComingSoonScreen
            categoryName={category.name}
            categoryId={category.id}
            userId={userData?.id}
          />
        ) : layout && tinderMode ? (
          // Tinder Mode
          <View
            ref={swipeContainerRef}
            style={[styles.tinderModeContainer, {
              paddingTop: 4,
              paddingBottom: 12,
              height: screenHeight - insets.top - (screenHeight <= 667 ? 70 : screenHeight <= 812 ? 80 : 90)
            }]}
            onLayout={() => {
              // Measure position relative to window (absolute screen position)
              swipeContainerRef.current?.measureInWindow((x, y, width, height) => {
                setSwipeContainerLayout({ x, y, width, height });
              });
            }}>
            <CustomSwipeView
              key={`swipe-${Object.keys(productRatings).length}-${Object.values(productRatings).reduce((sum, r) => sum + r.reviews, 0)}`}
              products={products}
              cardHeight={cardHeight}
              onSwipeRight={handleSwipeRight}
              onSwipeLeft={handleSwipeLeft}
              navigation={navigation}
              userData={userData}
              isInWishlist={isInWishlist}
              addToWishlist={addToWishlist}
              removeFromWishlist={removeFromWishlist}
              setSelectedProduct={setSelectedProduct}
              setShowCollectionSheet={setShowCollectionSheet}
              addToAllCollection={addToAllCollection}
              getUserPrice={getUserPrice}
              productRatings={productRatings}
              openReviewsSheet={openReviewsSheet}
              isScreenFocused={isScreenFocused}
            />
          </View>
        ) : (
          // Regular Grid/List Mode
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <FlatList
              data={products}
              renderItem={({ item }) => renderProductCard(item)}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.productList}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={true}
              maxToRenderPerBatch={10}
              windowSize={10}
              initialNumToRender={10}
              updateCellsBatchingPeriod={50}
              extraData={productRatings}
              key={`'normal'}`} // Force re-render on layout change
            />
          </KeyboardAvoidingView>
        )}

        {/* Tinder Action Buttons */}
        {/* {layout && tinderMode && products.length > 0 && currentCardIndex < products.length && (
        <View style={styles.tinderActionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.passButton]}
            onPress={() => handleTinderSwipe('left', products[currentCardIndex])}>
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.likeButton]}
            onPress={() => handleTinderSwipe('right', products[currentCardIndex])}>
            <Ionicons name="heart" size={30} color="#fff" />
          </TouchableOpacity>
        </View>
      )} */}

        {/* New Filter UI - Two Column Layout */}
        <BottomSheetModal
          ref={filterSheetRef}
          snapPoints={['90%']}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: '#fff' }}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}>

          <View style={styles.newFilterContainer}>
            {/* Header */}
            <View style={styles.filterHeader}>
              <Text style={styles.filterHeaderTitle}>Filters</Text>
              <TouchableOpacity onPress={handleClearAllFilters}>
                <Text style={styles.clearAllButton}>CLEAR ALL</Text>
              </TouchableOpacity>
            </View>

            {/* Two Column Layout */}
            <View style={styles.filterTwoColumn}>
              {/* Left Column - Filter Categories */}
              <View style={styles.filterLeftColumn}>
                <Text style={styles.filterCategoriesTitle}>Filters</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {filterCategories.map((category) => {
                    const hasFilters = hasActiveFilters(category);
                    return (
                      <TouchableOpacity
                        key={category}
                        style={[
                          styles.filterCategoryItem,
                          activeFilterCategory === category && styles.filterCategoryItemActive
                        ]}
                        onPress={() => setActiveFilterCategory(category)}>
                        <View style={styles.filterCategoryTextContainer}>
                          <Text style={[
                            styles.filterCategoryText,
                            activeFilterCategory === category && styles.filterCategoryTextActive
                          ]}>
                            {category}
                          </Text>
                          {hasFilters && (
                            <View style={styles.filterIndicatorDot} />
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Right Column - Filter Options */}
              <View style={styles.filterRightColumn}>
                <View style={{ flex: 1 }}>
                  {/* Category Filter - Only for Best Seller */}
                  {activeFilterCategory === 'Category' && (
                    <View style={styles.filterOptionsContainer}>
                      <Text style={styles.filterSectionTitle}>
                        {categories.length} {categories.length === 1 ? 'Category' : 'Categories'} Available
                      </Text>
                      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        {categories.length > 0 ? (
                          categories.map((cat) => (
                            <TouchableOpacity
                              key={cat.id}
                              style={styles.filterOptionRow}
                              onPress={() => toggleCategorySelection(cat.id)}>
                              <View style={styles.checkboxContainer}>
                                <Ionicons
                                  name={selectedCategories.includes(cat.id) ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={20}
                                  color={selectedCategories.includes(cat.id) ? '#F53F7A' : '#999'}
                                />
                              </View>
                              <Text style={styles.filterOptionText}>{cat.name}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.emptyFilterState}>
                            <Text style={styles.emptyFilterText}>No categories available</Text>
                          </View>
                        )}
                      </BottomSheetScrollView>
                    </View>
                  )}

                  {/* Brand/Influencer Filter with Tabs */}
                  {activeFilterCategory === 'Brand/Influencer' && (
                    <View style={styles.filterOptionsContainer}>
                      {/* Tabs for Brands and Influencers */}
                      <View style={styles.brandInfluencerTabs}>
                        <TouchableOpacity
                          style={[
                            styles.brandInfluencerTab,
                            activeBrandInfluencerTab === 'brands' && styles.brandInfluencerTabActive
                          ]}
                          onPress={() => setActiveBrandInfluencerTab('brands')}
                        >
                          <Text style={[
                            styles.brandInfluencerTabText,
                            activeBrandInfluencerTab === 'brands' && styles.brandInfluencerTabTextActive
                          ]}>
                            Brands ({filteredVendors.length})
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.brandInfluencerTab,
                            activeBrandInfluencerTab === 'influencers' && styles.brandInfluencerTabActive
                          ]}
                          onPress={() => setActiveBrandInfluencerTab('influencers')}
                        >
                          <Text style={[
                            styles.brandInfluencerTabText,
                            activeBrandInfluencerTab === 'influencers' && styles.brandInfluencerTabTextActive
                          ]}>
                            Influencers ({filteredInfluencers.length})
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Brands Tab */}
                      {activeBrandInfluencerTab === 'brands' && (
                        <>
                          <TextInput
                            style={styles.vendorSearchInput}
                            placeholder="Search brands..."
                            value={vendorSearchQuery}
                            onChangeText={handleVendorSearch}
                            placeholderTextColor="#999"
                          />
                          <BottomSheetScrollView style={styles.vendorList} showsVerticalScrollIndicator={true}>
                            {filteredVendors.length === 0 ? (
                              <View style={styles.emptyFilterState}>
                                <Ionicons name="business-outline" size={40} color="#ccc" />
                                <Text style={styles.emptyFilterText}>No brands available</Text>
                              </View>
                            ) : (
                              filteredVendors.map((vendor: any) => {
                                const isSelected = selectedVendorIds.includes(vendor.id);
                                return (
                                  <TouchableOpacity
                                    key={vendor.id}
                                    style={[
                                      styles.filterOptionRow,
                                      { paddingVertical: 10 }
                                    ]}
                                    onPress={() => toggleVendorSelection(vendor.id)}>
                                    <View style={{
                                      width: 44,
                                      height: 44,
                                      borderRadius: 22,
                                      borderWidth: isSelected ? 3 : 2,
                                      borderColor: isSelected ? '#F53F7A' : '#E5E5E5',
                                      backgroundColor: isSelected ? '#FFF0F5' : '#F5F5F5',
                                      justifyContent: 'center',
                                      alignItems: 'center',
                                      marginRight: 12,
                                      overflow: 'hidden',
                                    }}>
                                      {vendor.profile_image_url ? (
                                        <Image
                                          source={{ uri: vendor.profile_image_url }}
                                          style={{ width: 40, height: 40, borderRadius: 20 }}
                                        />
                                      ) : (
                                        <View style={{
                                          width: 40,
                                          height: 40,
                                          borderRadius: 20,
                                          backgroundColor: isSelected ? '#FFF0F5' : '#E8E8E8',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                        }}>
                                          <Ionicons
                                            name="business"
                                            size={20}
                                            color={isSelected ? '#F53F7A' : '#999'}
                                          />
                                        </View>
                                      )}
                                    </View>
                                    <View style={{ flex: 1 }}>
                                      <Text style={[
                                        styles.filterOptionText,
                                        isSelected && { color: '#F53F7A', fontWeight: '600' }
                                      ]}>{vendor.business_name}</Text>
                                    </View>
                                    {isSelected && (
                                      <View style={{
                                        width: 24,
                                        height: 24,
                                        borderRadius: 12,
                                        backgroundColor: '#F53F7A',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                      }}>
                                        <Ionicons name="checkmark" size={16} color="#fff" />
                                      </View>
                                    )}
                                  </TouchableOpacity>
                                );
                              })
                            )}
                          </BottomSheetScrollView>
                        </>
                      )}

                      {/* Influencers Tab */}
                      {activeBrandInfluencerTab === 'influencers' && (
                        <>
                          <TextInput
                            style={styles.vendorSearchInput}
                            placeholder="Search influencers..."
                            value={influencerSearchQuery}
                            onChangeText={setInfluencerSearchQuery}
                            placeholderTextColor="#999"
                          />
                          <BottomSheetScrollView style={styles.vendorList} showsVerticalScrollIndicator={true}>
                            {filteredInfluencers.length === 0 ? (
                              <View style={styles.emptyFilterState}>
                                <Ionicons name="person-outline" size={40} color="#ccc" />
                                <Text style={styles.emptyFilterText}>No influencers available</Text>
                              </View>
                            ) : (
                              filteredInfluencers
                                .filter(influencer =>
                                  !influencerSearchQuery.trim() ||
                                  influencer.name?.toLowerCase().includes(influencerSearchQuery.toLowerCase()) ||
                                  influencer.username?.toLowerCase().includes(influencerSearchQuery.toLowerCase())
                                )
                                .map((influencer: any) => {
                                  const isSelected = selectedInfluencerIds.includes(influencer.id);
                                  return (
                                    <TouchableOpacity
                                      key={influencer.id}
                                      style={[
                                        styles.filterOptionRow,
                                        { paddingVertical: 10 }
                                      ]}
                                      onPress={() => toggleInfluencerSelection(influencer.id)}>
                                      <View style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: 22,
                                        borderWidth: isSelected ? 3 : 2,
                                        borderColor: isSelected ? '#F53F7A' : '#E5E5E5',
                                        backgroundColor: isSelected ? '#FFF0F5' : '#F5F5F5',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        marginRight: 12,
                                        overflow: 'hidden',
                                      }}>
                                        {influencer.profile_photo ? (
                                          <Image
                                            source={{ uri: influencer.profile_photo }}
                                            style={{ width: 40, height: 40, borderRadius: 20 }}
                                          />
                                        ) : (
                                          <View style={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: 20,
                                            backgroundColor: isSelected ? '#FFF0F5' : '#E8E8E8',
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                          }}>
                                            <Ionicons
                                              name="person"
                                              size={20}
                                              color={isSelected ? '#F53F7A' : '#999'}
                                            />
                                          </View>
                                        )}
                                      </View>
                                      <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                          <Text style={[
                                            styles.filterOptionText,
                                            isSelected && { color: '#F53F7A', fontWeight: '600' }
                                          ]}>
                                            {influencer.name || influencer.username}
                                          </Text>
                                          {influencer.is_verified && (
                                            <Ionicons name="checkmark-circle" size={14} color="#1DA1F2" style={{ marginLeft: 4 }} />
                                          )}
                                        </View>
                                        {influencer.username && influencer.name && (
                                          <Text style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                                            @{influencer.username}
                                          </Text>
                                        )}
                                      </View>
                                      {isSelected && (
                                        <View style={{
                                          width: 24,
                                          height: 24,
                                          borderRadius: 12,
                                          backgroundColor: '#F53F7A',
                                          justifyContent: 'center',
                                          alignItems: 'center',
                                        }}>
                                          <Ionicons name="checkmark" size={16} color="#fff" />
                                        </View>
                                      )}
                                    </TouchableOpacity>
                                  );
                                })
                            )}
                          </BottomSheetScrollView>
                        </>
                      )}
                    </View>
                  )}

                  {/* Size Filter */}
                  {activeFilterCategory === 'Size' && (
                    <View style={styles.filterOptionsContainer}>
                      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        {sizes.length > 0 ? (
                          sizes.map((size) => {
                            const productCount = sizeProductCounts[size.id] || 0;
                            return (
                              <TouchableOpacity
                                key={size.id}
                                style={styles.filterOptionRow}
                                onPress={() => toggleSizeSelection(size.id)}>
                                <View style={styles.checkboxContainer}>
                                  <Ionicons
                                    name={selectedSizes.includes(size.id) ? 'checkmark' : 'square-outline'}
                                    size={20}
                                    color={selectedSizes.includes(size.id) ? '#F53F7A' : '#999'}
                                  />
                                </View>
                                <Text style={styles.filterOptionText}>{size.name}</Text>
                                <Text style={styles.sizeProductCount}>({productCount})</Text>
                              </TouchableOpacity>
                            );
                          })
                        ) : (
                          <View style={styles.emptyFilterState}>
                            <Ionicons name="resize-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyFilterText}>No sizes available</Text>
                            <Text style={styles.emptyFilterSubtext}>
                              Sizes will appear here once products are added
                            </Text>
                          </View>
                        )}
                      </BottomSheetScrollView>
                    </View>
                  )}

                  {/* Price Range Filter */}
                  {activeFilterCategory === 'Price Range' && (
                    <View style={styles.filterOptionsContainer}>
                      <Text style={styles.filterSectionTitle}>Price Range</Text>
                      <View style={styles.priceRangeContainer}>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="Min Price"
                          value={filterMinPrice}
                          onChangeText={setFilterMinPrice}
                          keyboardType="numeric"
                          placeholderTextColor="#999"
                        />
                        <Text style={styles.priceRangeSeparator}>to</Text>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="Max Price"
                          value={filterMaxPrice}
                          onChangeText={setFilterMaxPrice}
                          keyboardType="numeric"
                          placeholderTextColor="#999"
                        />
                      </View>
                    </View>
                  )}


                </View>
              </View>
            </View>

            {/* Footer Buttons */}
            <View style={styles.filterFooter}>
              <TouchableOpacity
                style={styles.filterCloseButton}
                onPress={() => filterSheetRef.current?.dismiss()}>
                <Text style={styles.filterCloseButtonText}>CLOSE</Text>
              </TouchableOpacity>

              <View style={styles.filterFooterDivider} />

              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={handleApplyFilters}>
                <Text style={styles.filterApplyButtonText}>APPLY</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetModal>

        {/* Save to Collection Bottom Sheet - moved after filter and sort sheets */}
        {showCollectionSheet && <View
          style={{
            flex: 1,
            zIndex: 10000,
            position: 'absolute',
            top: 0,
            bottom: 0,
            right: 0,
            left: 0,
          }}>
          <SaveToCollectionSheet
            visible={showCollectionSheet}
            product={selectedProduct}
            onClose={() => {
              setShowCollectionSheet(false);
            }}
            onSaved={(product: any, collectionName: any) => {
              // Don't show any popup - notification is shown immediately when heart is clicked
              // and collection sheet shows the added folders with checkmarks
            }}
            onShowNotification={showNotification}
          />
        </View>}

        {/* Custom Notification */}
        <CustomNotification
          visible={notificationVisible}
          type={notificationType}
          title={notificationTitle}
          subtitle={notificationSubtitle}
          onClose={() => setNotificationVisible(false)}
          duration={3000}
          actionText={notificationTitle.includes('🎉') ? 'View' : undefined}
          onActionPress={notificationTitle.includes('🎉') ? () => {
            setNotificationVisible(false);
            // Navigate to Home tab first, then to Wishlist screen within the HomeStack
            (navigation as any).navigate('TabNavigator', {
              screen: 'Home',
              params: { screen: 'Wishlist' }
            });
          } : undefined}
        />

        {/* Spotlight Onboarding Overlays */}
        {(showOnboarding || (onboardingStep === 'swipe' && !dontShowSwipeTutorial)) && (
          <>
            {/* Modal-based Onboarding */}
            <Modal
              visible={onboardingStep === 'views' && showOnboarding}
              transparent
              animationType="fade"
              onRequestClose={() => completeOnboarding()}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.onboardingModal}>
                  <Text style={styles.modalTitle}>Choose Your View</Text>
                  <Text style={styles.modalSubtitle}>
                    You can browse products in a compact Grid or use Swipe to
                    quickly flip through items like a deck of cards.
                  </Text>

                  <View style={styles.modalPreviewRow}>
                    <TouchableOpacity
                      style={styles.modalPreviewCard}
                      onPress={() => {
                        setLayout(true);
                        setTinderMode(false);
                        completeOnboarding(false);
                      }}
                    >
                      <Ionicons name="grid" size={22} color="#F53F7A" />
                      <Text style={styles.modalPreviewTitle}>Grid</Text>
                      <Text style={styles.modalPreviewDesc}>See more at once</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.modalPreviewCard}
                      onPress={() => {
                        setLayout(true);
                        setTinderMode(true);
                        if (!dontShowSwipeTutorial) {
                          setOnboardingStep('swipe');
                          setTimeout(() => {
                            startSwipeTutorial();
                          }, 300);
                        } else {
                          completeOnboarding(false);
                        }
                      }}
                    >
                      <Ionicons name="layers" size={22} color="#F53F7A" />
                      <Text style={styles.modalPreviewTitle}>Swipe</Text>
                      <Text style={styles.modalPreviewDesc}>Focus one by one</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity
                    style={styles.modalPrimaryButton}
                    onPress={() => {
                      setLayout(true);
                      setTinderMode(true);
                      if (!dontShowSwipeTutorial) {
                        setOnboardingStep('swipe');
                        // Start swipe tutorial animation
                        setTimeout(() => {
                          startSwipeTutorial();
                        }, 300);
                      } else {
                        // If suppressed, just close onboarding entirely
                        completeOnboarding(true);
                      }
                    }}
                  >
                    <Text style={styles.modalPrimaryButtonText}>Try Swipe</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalSecondaryButton}
                    onPress={() => completeOnboarding(false)}
                  >
                    <Text style={styles.modalSecondaryButtonText}>Got it</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalDontShowButton}
                    onPress={() => completeOnboarding(true)}
                  >
                    <Text style={styles.modalDontShowButtonText}>Don't show again</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            {/* Swipe Tutorial Spotlight */}
            {onboardingStep === 'swipe' && (
              <Animated.View
                style={[
                  styles.spotlightOverlay,
                  {
                    opacity: swipeSpotlightAnimation,
                  },
                ]}>
                {/* Dimmed background */}
                <View style={styles.swipeDimmedBackground} />

                {/* Spotlight cutout for swipe area */}
                <View style={[
                  styles.swipeSpotlightCutout,
                  {
                    top: swipeContainerLayout.y >= 0 ? swipeContainerLayout.y : (screenHeight * 0.25),
                    left: swipeContainerLayout.x >= 0 ? swipeContainerLayout.x : 20,
                    right: screenWidth - (swipeContainerLayout.x >= 0 ? swipeContainerLayout.x : 20) - (swipeContainerLayout.width > 0 ? swipeContainerLayout.width : (screenWidth - 40)),
                    height: swipeContainerLayout.height > 0 ? swipeContainerLayout.height : (screenHeight * 0.5),
                  }
                ]}>
                  <View style={[
                    styles.swipeSpotlightHole,
                    {
                      width: swipeContainerLayout.width > 0 ? swipeContainerLayout.width : (screenWidth - 40),
                      height: swipeContainerLayout.height > 0 ? swipeContainerLayout.height : (screenHeight * 0.5),
                    }
                  ]} />
                </View>

                {/* Left swipe instruction with enhanced animation */}
                <Animated.View
                  style={[
                    styles.swipeInstructionLeft,
                    {
                      top: (swipeContainerLayout.y >= 0 ? swipeContainerLayout.y : (screenHeight * 0.25)) - 80,
                      opacity: swipeTutorialAnimation.interpolate({
                        inputRange: [0, 0.5, 1, 1.5, 2],
                        outputRange: [0, 0, 1, 0, 0],
                      }),
                      transform: [
                        {
                          translateX: swipeTutorialAnimation.interpolate({
                            inputRange: [0, 0.5, 1, 1.5, 2],
                            outputRange: [20, 20, 0, 0, 0],
                          }),
                        },
                        {
                          scale: swipeTutorialAnimation.interpolate({
                            inputRange: [0, 0.5, 1, 1.5, 2],
                            outputRange: [0.8, 0.8, 1, 0.8, 0.8],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <View style={styles.swipeInstructionCard}>
                    <View style={styles.swipeInstructionIcon}>
                      <Ionicons name="arrow-back" size={28} color="#fff" />
                    </View>
                    <Text style={styles.swipeInstructionTitle}>Swipe Left ←</Text>
                    <Text style={styles.swipeInstructionDesc}>Pass on this product</Text>
                  </View>
                </Animated.View>

                {/* Right swipe instruction with enhanced animation */}
                <Animated.View
                  style={[
                    styles.swipeInstructionRight,
                    {
                      top: (swipeContainerLayout.y >= 0 ? swipeContainerLayout.y : (screenHeight * 0.25)) - 80,
                      opacity: swipeTutorialAnimation.interpolate({
                        inputRange: [0, 1, 1.5, 2, 2.5],
                        outputRange: [0, 0, 0, 1, 0],
                      }),
                      transform: [
                        {
                          translateX: swipeTutorialAnimation.interpolate({
                            inputRange: [0, 1, 1.5, 2, 2.5],
                            outputRange: [-20, -20, -20, 0, 0],
                          }),
                        },
                        {
                          scale: swipeTutorialAnimation.interpolate({
                            inputRange: [0, 1, 1.5, 2, 2.5],
                            outputRange: [0.8, 0.8, 0.8, 1, 0.8],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <View style={styles.swipeInstructionCard}>
                    <View style={[styles.swipeInstructionIcon, { backgroundColor: '#10B981' }]}>
                      <Ionicons name="arrow-forward" size={28} color="#fff" />
                    </View>
                    <Text style={styles.swipeInstructionTitle}>Swipe Right →</Text>
                    <Text style={styles.swipeInstructionDesc}>Add to wishlist folder</Text>
                  </View>
                </Animated.View>

                {/* Main instruction - Centered */}
                <View style={styles.swipeMainInstruction}>
                  <Text style={styles.swipeMainTitle}>How to Swipe</Text>
                  <Text style={styles.swipeMainSubtitle}>
                    Swipe through products to find what you love
                  </Text>

                  {/* Swipe direction indicators */}
                  <View style={styles.swipeDirectionsContainer}>
                    {/* Left swipe */}
                    <View style={styles.swipeDirectionItem}>
                      <View style={styles.swipeDirectionIconLeft}>
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                      </View>
                      <Text style={styles.swipeDirectionLabel}>Swipe Left</Text>
                      <Text style={styles.swipeDirectionDesc}>Pass</Text>
                    </View>

                    {/* Right swipe */}
                    <View style={styles.swipeDirectionItem}>
                      <View style={styles.swipeDirectionIconRight}>
                        <Ionicons name="arrow-forward" size={24} color="#fff" />
                      </View>
                      <Text style={styles.swipeDirectionLabel}>Swipe Right</Text>
                      <Text style={styles.swipeDirectionDesc}>Add to Wishlist</Text>
                    </View>
                  </View>
                </View>

                {/* Action buttons */}
                <View style={styles.swipeActionButtons}>
                  {/* Don't Show Again Checkbox */}
                  <TouchableOpacity
                    style={styles.dontShowAgainContainer}
                    onPress={() => setDontShowAgainChecked(!dontShowAgainChecked)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.checkboxWrapper}>
                      <View style={[
                        styles.checkbox,
                        dontShowAgainChecked && styles.checkboxChecked
                      ]}>
                        {dontShowAgainChecked && (
                          <Ionicons name="checkmark" size={16} color="#fff" />
                        )}
                      </View>
                      <Text style={styles.dontShowAgainText}>Don't show again</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Button Row */}
                  <View style={styles.buttonRow}>
                    {showOnboarding ? (
                      <TouchableOpacity
                        style={styles.swipeBackButton}
                        onPress={() => {
                          setOnboardingStep('views');
                          // Fade out swipe tutorial
                          Animated.timing(swipeSpotlightAnimation, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: false,
                          }).start();
                        }}>
                        <Ionicons name="arrow-back" size={18} color="#F53F7A" style={{ marginRight: 6 }} />
                        <Text style={styles.swipeBackText}>Back</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.swipeBackButton}
                        onPress={() => {
                          // Just close the tutorial
                          setHasSeenSwipeTutorial(true);
                          if (dontShowAgainChecked) {
                            completeOnboarding(true);
                          } else {
                            Animated.parallel([
                              Animated.timing(swipeSpotlightAnimation, {
                                toValue: 0,
                                duration: 300,
                                useNativeDriver: false,
                              }),
                              Animated.timing(swipeTutorialAnimation, {
                                toValue: 0,
                                duration: 300,
                                useNativeDriver: false,
                              }),
                            ]).start(() => {
                              setOnboardingStep('views');
                            });
                          }
                        }}>
                        <Ionicons name="close" size={18} color="#F53F7A" style={{ marginRight: 6 }} />
                        <Text style={styles.swipeBackText}>Skip</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.swipeDoneButton}
                      onPress={() => {
                        setHasSeenSwipeTutorial(true);
                        if (showOnboarding) {
                          completeOnboarding(dontShowAgainChecked);
                        } else {
                          if (dontShowAgainChecked) {
                            completeOnboarding(true);
                          } else {
                            // Just close the tutorial
                            Animated.parallel([
                              Animated.timing(swipeSpotlightAnimation, {
                                toValue: 0,
                                duration: 300,
                                useNativeDriver: false,
                              }),
                              Animated.timing(swipeTutorialAnimation, {
                                toValue: 0,
                                duration: 300,
                                useNativeDriver: false,
                              }),
                            ]).start(() => {
                              setOnboardingStep('views');
                            });
                          }
                        }
                      }}>
                      <Text style={styles.swipeDoneText}>Got it!</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* Custom Toast */}
        <View style={styles.toastWrapper}>
          <Toast config={{
            wishlistMilestone: ({ text1, text2, props }: any) => (
              <View style={styles.customToast}>
                <View style={styles.toastContent}>
                  <View style={styles.toastTextContainer}>
                    <Text style={styles.toastTitle}>{text1}</Text>
                    <Text style={styles.toastSubtitle}>{text2}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.toastViewButton}
                    onPress={props?.onViewPress}
                  >
                    <Text style={styles.toastViewButtonText}>View</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ),
            filtersApplied: ({ text1, text2 }: any) => (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F53F7A',
                marginHorizontal: 16,
                marginTop: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                shadowColor: '#F53F7A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 20,
                borderWidth: 2,
                borderColor: '#fff',
                zIndex: 9999,
              }}>
                <View style={{ marginRight: 12 }}>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  {text1 && <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#fff',
                    marginBottom: 2,
                  }}>{text1}</Text>}
                  {text2 && <Text style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: '#fff',
                    opacity: 0.95,
                  }}>{text2}</Text>}
                </View>
              </View>
            ),
            comingSoonInterest: ({ text1, text2 }: any) => (
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F53F7A',
                marginHorizontal: 16,
                marginTop: 12,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: 12,
                shadowColor: '#F53F7A',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 20,
                borderWidth: 2,
                borderColor: '#fff',
                zIndex: 9999,
              }}>
                <View style={{ marginRight: 12 }}>
                  <Ionicons name="heart" size={24} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  {text1 && <Text style={{
                    fontSize: 15,
                    fontWeight: '700',
                    color: '#fff',
                    marginBottom: 2,
                  }}>{text1}</Text>}
                  {text2 && <Text style={{
                    fontSize: 13,
                    fontWeight: '500',
                    color: '#fff',
                    opacity: 0.95,
                  }}>{text2}</Text>}
                </View>
              </View>
            ),
          }} />
        </View>

        {/* Reviews Bottom Sheet */}
        <BottomSheetModal
          ref={reviewsSheetRef}
          index={0}
          snapPoints={['75%']}
          backgroundStyle={styles.reviewsSheetBackground}
          handleIndicatorStyle={styles.reviewsSheetHandle}
        >
          <View style={styles.reviewsSheetContainer}>
            <View style={styles.reviewsSheetHeader}>
              <Text style={styles.reviewsSheetTitle}>Reviews & Ratings</Text>
              <TouchableOpacity onPress={() => reviewsSheetRef.current?.dismiss()}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {selectedProductForReviews && (
              <View style={styles.reviewsProductInfo}>
                <Image
                  source={{ uri: getFirstSafeProductImage(selectedProductForReviews) }}
                  style={styles.reviewsProductImage}
                />
                <View style={styles.reviewsProductDetails}>
                  <Text style={styles.reviewsProductName} numberOfLines={2}>
                    {selectedProductForReviews.name}
                  </Text>
                  <View style={styles.reviewsRatingRow}>
                    <Ionicons name="star" size={16} color="#FFD600" />
                    <Text style={styles.reviewsAverageRating}>
                      {productReviews.length > 0
                        ? (productReviews.reduce((sum, r) => sum + r.rating, 0) / productReviews.length).toFixed(1)
                        : '0.0'}
                    </Text>
                    <Text style={styles.reviewsTotalCount}>
                      ({productReviews.length} reviews)
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <BottomSheetScrollView style={styles.reviewsList} showsVerticalScrollIndicator={false}>
              {reviewsLoading ? (
                <View style={styles.reviewsLoadingContainer}>
                  <ActivityIndicator size="large" color="#F53F7A" />
                  <Text style={styles.reviewsLoadingText}>Loading reviews...</Text>
                </View>
              ) : productReviews.length === 0 ? (
                <View style={styles.reviewsEmptyContainer}>
                  <Ionicons name="chatbubble-outline" size={60} color="#ccc" />
                  <Text style={styles.reviewsEmptyTitle}>No reviews yet</Text>
                  <Text style={styles.reviewsEmptySubtitle}>Be the first to review this product</Text>
                </View>
              ) : (
                <>
                  {productReviews.slice(0, 10).map((review: any) => (
                    <View key={review.id} style={styles.reviewItem}>
                      <View style={styles.reviewHeader}>
                        <View style={styles.reviewUserInfo}>
                          {review.profile_image_url ? (
                            <Image
                              source={{ uri: review.profile_image_url }}
                              style={styles.reviewUserAvatar}
                            />
                          ) : (
                            <View style={styles.reviewUserAvatarPlaceholder}>
                              <Ionicons name="person" size={20} color="#999" />
                            </View>
                          )}
                          <View>
                            <Text style={styles.reviewUserName}>{review.reviewer_name || 'Anonymous'}</Text>
                            <View style={styles.reviewRatingStars}>
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Ionicons
                                  key={star}
                                  name={star <= review.rating ? 'star' : 'star-outline'}
                                  size={14}
                                  color="#FFD600"
                                />
                              ))}
                            </View>
                          </View>
                        </View>
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString()}
                        </Text>
                      </View>
                      {review.comment && (
                        <Text style={styles.reviewComment}>{review.comment}</Text>
                      )}
                      {review.review_images && review.review_images.length > 0 && (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.reviewImagesScroll}>
                          {review.review_images.map((img: string, idx: number) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.reviewImageWrapper}
                              activeOpacity={0.8}
                              onPress={() => {
                                const reviewMedia = [
                                  ...(review.review_images || []).map((image: string) => ({ type: 'image' as const, url: image })),
                                  ...(review.review_videos || []).map((video: string) => ({ type: 'video' as const, url: video })),
                                ];
                                setReviewMediaItems(reviewMedia);
                                setReviewMediaIndex(idx);
                                setShowReviewMediaViewer(true);
                              }}
                            >
                              <Image
                                source={{ uri: img }}
                                style={styles.reviewImage}
                                resizeMode="cover"
                              />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      )}
                    </View>
                  ))}
                  {productReviews.length > 10 && (
                    <TouchableOpacity
                      style={styles.showMoreReviewsButton}
                      onPress={() => {
                        reviewsSheetRef.current?.dismiss();
                        setTimeout(() => {
                          (navigation as any).navigate('AllReviews', {
                            productId: selectedProductForReviews?.id,
                            productName: selectedProductForReviews?.name,
                            averageRating: productRatings[String(selectedProductForReviews?.id || '')]?.rating || 0,
                            totalReviews: productReviews.length,
                            reviews: productReviews,
                          });
                        }, 300);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.showMoreReviewsText}>
                        Show All {productReviews.length} Reviews
                      </Text>
                      <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </BottomSheetScrollView>
          </View>
        </BottomSheetModal>

        {/* Review Media Viewer Modal */}
        <Modal
          visible={showReviewMediaViewer}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowReviewMediaViewer(false)}
        >
          <View style={styles.reviewMediaViewerContainer}>
            {/* Close Button */}
            <TouchableOpacity
              style={styles.reviewMediaViewerCloseButton}
              onPress={() => setShowReviewMediaViewer(false)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={32} color="#fff" />
            </TouchableOpacity>

            {/* Media Counter */}
            <View style={styles.reviewMediaViewerCounter}>
              <Text style={styles.reviewMediaViewerCounterText}>
                {reviewMediaIndex + 1} / {reviewMediaItems.length}
              </Text>
            </View>

            {/* Scrollable Media Gallery */}
            <ScrollView
              ref={reviewMediaScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const newIndex = Math.round(e.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setReviewMediaIndex(newIndex);
              }}
              scrollEventThrottle={16}
              contentOffset={{ x: reviewMediaIndex * Dimensions.get('window').width, y: 0 }}
            >
              {reviewMediaItems.map((media, index) => (
                <View key={`review-media-${index}`} style={styles.reviewMediaViewerItemContainer}>
                  {media.type === 'image' ? (
                    <Image
                      source={{ uri: media.url }}
                      style={styles.reviewMediaViewerImage}
                      resizeMode="contain"
                    />
                  ) : (
                    <Video
                      source={{ uri: media.url }}
                      style={styles.reviewMediaViewerVideo}
                      resizeMode={ResizeMode.CONTAIN}
                      useNativeControls
                      shouldPlay={index === reviewMediaIndex && isScreenFocused}
                      isLooping
                    />
                  )}
                </View>
              ))}
            </ScrollView>

            {/* Navigation Arrows */}
            {reviewMediaItems.length > 1 && (
              <>
                {reviewMediaIndex > 0 && (
                  <TouchableOpacity
                    style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerLeftArrow]}
                    onPress={() => {
                      const newIndex = reviewMediaIndex - 1;
                      setReviewMediaIndex(newIndex);
                      reviewMediaScrollViewRef.current?.scrollTo({
                        x: newIndex * Dimensions.get('window').width,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-back" size={32} color="#fff" />
                  </TouchableOpacity>
                )}
                {reviewMediaIndex < reviewMediaItems.length - 1 && (
                  <TouchableOpacity
                    style={[styles.reviewMediaViewerArrow, styles.reviewMediaViewerRightArrow]}
                    onPress={() => {
                      const newIndex = reviewMediaIndex + 1;
                      setReviewMediaIndex(newIndex);
                      reviewMediaScrollViewRef.current?.scrollTo({
                        x: newIndex * Dimensions.get('window').width,
                        animated: true,
                      });
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chevron-forward" size={32} color="#fff" />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Modal>

        {/* Coins Info Modal */}
        <Modal
          visible={showCoinsModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowCoinsModal(false)}
          statusBarTranslucent={true}
        >
          <View style={styles.coinsModalOverlay}>
            <View style={styles.coinsModalContainer}>
              {/* Header */}
              <View style={styles.coinsModalHeader}>
                <View style={styles.coinsModalHeaderContent}>
                  <View style={styles.coinsModalIconWrapper}>
                    <MaterialCommunityIcons name="face-man-shimmer" size={20} color="#F53F7A" />
                  </View>
                  <Text style={styles.coinsModalTitle}>Your Coins</Text>
                </View>
                <TouchableOpacity
                  style={styles.coinsModalCloseButton}
                  onPress={() => setShowCoinsModal(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close" size={22} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Scrollable Content */}
              <ScrollView
                style={styles.coinsModalScrollView}
                contentContainerStyle={styles.coinsModalScrollContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
                {/* Current Balance Card */}
                <View style={styles.coinsBalanceCard}>
                  <Text style={styles.coinsBalanceLabel}>Current Balance</Text>
                  <View style={styles.coinsBalanceRow}>
                    <Text style={styles.coinsBalanceValue}>{userData?.coin_balance || 0}</Text>
                    <Text style={styles.coinsBalanceUnit}>coins</Text>
                  </View>
                </View>

                {/* Redeem Info Card */}
                <View style={styles.coinsRedeemCard}>
                  <View style={styles.coinsRedeemHeader}>
                    <Ionicons name="gift" size={14} color="#F53F7A" />
                    <Text style={styles.coinsRedeemTitle}>Redeem Coins</Text>
                  </View>

                  {/* Shopping Redemption */}
                  <View style={styles.coinsRedeemItem}>
                    <View style={styles.coinsRedeemIconContainer}>
                      <Ionicons name="bag-check" size={14} color="#10B981" />
                    </View>
                    <Text style={styles.coinsRedeemItemText}>
                      Redeem <Text style={styles.coinsRedeemHighlight}>100 coins</Text> for every ₹1000 worth of products you purchase
                    </Text>
                  </View>

                  {/* Face Swap Redemption */}
                  <View style={styles.coinsRedeemItem}>
                    <View style={styles.coinsRedeemIconContainer}>
                      <MaterialCommunityIcons name="face-man-shimmer" size={14} color="#F53F7A" />
                    </View>
                    <Text style={styles.coinsRedeemItemText}>
                      Redeem <Text style={styles.coinsRedeemHighlight}>50 coins</Text> for each face swap
                    </Text>
                  </View>
                </View>

                {/* Ways to Earn Section */}
                <View style={styles.coinsEarnSection}>
                  <Text style={styles.coinsEarnSectionTitle}>Ways to Earn Coins</Text>

                  <View style={styles.coinsEarnItem}>
                    <View style={[styles.coinsEarnIcon, { backgroundColor: '#ECFDF5' }]}>
                      <Ionicons name="cart" size={18} color="#10B981" />
                    </View>
                    <View style={styles.coinsEarnContent}>
                      <Text style={styles.coinsEarnItemTitle}>Make a Purchase</Text>
                      <Text style={styles.coinsEarnItemDesc}>
                        Get 10% of your order value as coins
                      </Text>
                    </View>
                    <View style={styles.coinsEarnAmountBadge}>
                      <Text style={styles.coinsEarnAmount}>+10%</Text>
                    </View>
                  </View>

                  <View style={styles.coinsEarnItem}>
                    <View style={[styles.coinsEarnIcon, { backgroundColor: '#F3E8FF' }]}>
                      <Ionicons name="person-add" size={18} color="#8B5CF6" />
                    </View>
                    <View style={styles.coinsEarnContent}>
                      <Text style={styles.coinsEarnItemTitle}>Refer Friends</Text>
                      <Text style={styles.coinsEarnItemDesc}>
                        Invite friends and earn 100 coins
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Close Button */}
                <TouchableOpacity
                  style={styles.coinsModalButton}
                  onPress={() => setShowCoinsModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.coinsModalButtonText}>Got it!</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Products View Tutorial Modal */}
        <Modal
          visible={showProductsViewTutorial}
          transparent
          animationType="fade"
          onRequestClose={handleDismissProductsViewTutorial}
        >
          <View style={styles.productsViewTutorialOverlay}>
            <View style={styles.productsViewTutorialCard}>
              <View style={styles.productsViewTutorialHeader}>
                <View style={styles.productsViewTutorialIcon}>
                  <Ionicons name="layers-outline" size={22} color="#F53F7A" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.productsViewTutorialTitle}>Swipe & Grid View Guide</Text>
                  <Text style={styles.productsViewTutorialSubtitle}>
                    Learn how to browse products in swipe and grid views.
                  </Text>
                </View>
                <TouchableOpacity onPress={handleDismissProductsViewTutorial}>
                  <Ionicons name="close" size={20} color="#9CA3AF" />
                </TouchableOpacity>
              </View>

              <View style={styles.productsViewTutorialVideoWrapper}>
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={async () => {
                    if (productsViewTutorialVideoRef.current) {
                      if (isProductsViewTutorialVideoPlaying) {
                        await productsViewTutorialVideoRef.current.pauseAsync();
                        setIsProductsViewTutorialVideoPlaying(false);
                      } else {
                        await productsViewTutorialVideoRef.current.playAsync();
                        setIsProductsViewTutorialVideoPlaying(true);
                      }
                    }
                  }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <Video
                    ref={productsViewTutorialVideoRef}
                    source={{ uri: PRODUCTS_VIEW_TUTORIAL_VIDEO_URL }}
                    style={styles.productsViewTutorialVideo}
                    resizeMode={ResizeMode.COVER}
                    shouldPlay
                    isLooping
                    isMuted={false}
                    useNativeControls={true}
                  />
                  {!isProductsViewTutorialVideoPlaying && (
                    <View style={{
                      ...StyleSheet.absoluteFillObject,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: 'rgba(0,0,0,0.3)'
                    }}>
                      <Ionicons name="play" size={50} color="rgba(255,255,255,0.9)" />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* View Selection Buttons */}
              <View style={styles.productsViewTutorialButtonsContainer}>
                <TouchableOpacity
                  style={[
                    styles.productsViewTutorialViewButton,
                    styles.productsViewTutorialGridButton,
                  ]}
                  onPress={() => {
                    setLayout(true);
                    setTinderMode(false);
                    setTutorialModalJustClosed(false); // Don't show swipe animation for grid
                    handleDismissProductsViewTutorial();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="grid" size={24} color="#F53F7A" />
                  <Text style={styles.productsViewTutorialViewButtonText}>Grid View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.productsViewTutorialViewButton,
                    styles.productsViewTutorialSwipeButton,
                  ]}
                  onPress={() => {
                    setLayout(true);
                    setTinderMode(true);
                    handleDismissProductsViewTutorial();
                    // After modal closes, show swipe tutorial animation
                    setTimeout(() => {
                      if (!dontShowSwipeTutorial) {
                        // Set onboarding step to 'swipe' so overlays are visible
                        setOnboardingStep('swipe');
                        startSwipeTutorial();
                      }
                    }, 500);
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="layers" size={24} color="#F53F7A" />
                  <Text style={styles.productsViewTutorialViewButtonText}>Swipe View</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.productsViewTutorialCheckboxRow}
                onPress={() => setProductsViewTutorialDontShowAgain(!productsViewTutorialDontShowAgain)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.productsViewTutorialCheckbox,
                    productsViewTutorialDontShowAgain && styles.productsViewTutorialCheckboxChecked,
                  ]}
                >
                  {productsViewTutorialDontShowAgain && (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  )}
                </View>
                <Text style={styles.productsViewTutorialCheckboxText}>Do not show again</Text>
              </TouchableOpacity>

              <View style={styles.productsViewTutorialActions}>
                <TouchableOpacity
                  style={styles.productsViewTutorialSecondaryBtn}
                  onPress={async () => {
                    // Save preference if checkbox is checked
                    if (productsViewTutorialDontShowAgain) {
                      try {
                        await AsyncStorage.setItem('products_view_tutorial_dont_show', 'true');
                      } catch (error) {
                        console.log('Error saving tutorial preference:', error);
                      }
                    }
                    handleDismissProductsViewTutorial();
                  }}
                >
                  <Text style={styles.productsViewTutorialSecondaryText}>Maybe later</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </BottomSheetModalProvider>
  );
};

const styles = StyleSheet.create({
  // Custom Swipe View Styles
  customSwipeContainer: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    position: 'relative',
    paddingTop: 8,
    paddingBottom: 12,
  },
  stackedCard: {
    position: 'absolute',
    width: screenWidth - 32,
    alignSelf: 'center',
  },
  frontCard: {
    position: 'absolute',
    width: screenWidth - 32,
    alignSelf: 'center',
  },
  swipeOverlay: {
    position: 'absolute',
    top: '30%',
    left: '20%',
    right: '20%',
    bottom: '30%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    zIndex: 1001,
  },
  leftOverlay: {
    backgroundColor: 'transparent',
  },
  rightOverlay: {
    backgroundColor: 'transparent',
  },
  swipeText: {
    fontSize: 36,
    fontWeight: '900',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 1.5,
  },
  leftText: {
    transform: [{ rotate: '-15deg' }],
  },
  rightText: {
    transform: [{ rotate: '15deg' }],
  },
  noMoreCardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  noMoreCardsTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  noMoreCardsSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 30,
  },
  resetButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 25,
  },
  resetButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    overflow: 'hidden',
    paddingBottom: 0,
  },
  container2: {
    flex: 1,
    height: '100%',
    //overflow: 'hidden',
  },
  overlayWrapper: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
    marginLeft: 0,
    zIndex: 1000,
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 1000,
  },
  statusBarSpacer: {
    height: 0,
    backgroundColor: '#fff',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  languageText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  currencyText: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '700',
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  profileButton: {
    backgroundColor: 'lightgray',
    borderRadius: 20,
    padding: 7,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },

  // Tinder Styles
  tinderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tinderCard: {
    position: 'absolute',
    width: screenWidth - 40,
    height: screenHeight * 0.7,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 15,
    overflow: 'hidden',
  },
  cardTouchable: {
    flex: 1,
  },
  tinderImageContainer: {
    flex: 1,
    position: 'relative',
  },
  tinderImage: {
    width: '100%',
    height: '100%',
  },
  gradientOverlay: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '35%',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tinderFeaturedBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 6,
    zIndex: 2,
  },
  tinderFeaturedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tinderWishlistButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  tinderProductInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 25,
    zIndex: 1,
  },
  tinderProductHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tinderProductName: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    marginRight: 10,
  },
  tinderStockBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tinderStockText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  tinderCategory: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 15,
  },
  tinderPriceContainer: {
    gap: 10,
  },
  tinderPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tinderPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  tinderOriginalPrice: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.7)',
    textDecorationLine: 'line-through',
  },
  tinderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tinderDiscountBadge: {
    backgroundColor: '#F53F7A',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  tinderDiscountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  tinderRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  tinderRatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  tinderReviewsText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  swipeIndicator: {
    position: 'absolute',
    top: '50%',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 90,
    transform: [{ translateY: -25 }],
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  likeIndicator: {
    right: '25%',
    borderColor: 'rgba(76, 175, 80, 0.8)',
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
  },
  passIndicator: {
    left: '25%',
    borderColor: 'rgba(244, 67, 54, 0.8)',
    backgroundColor: 'rgba(244, 67, 54, 0.15)',
  },
  swipeIndicatorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    zIndex: 10,
  },
  fullGradientOverlay: {
    position: 'absolute',
    top: '35%',
    left: '25%',
    right: '25%',
    bottom: '35%',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  tinderActionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 20,
    gap: 40,
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  passButton: {
    backgroundColor: '#F44336',
  },
  likeButton: {
    backgroundColor: '#4CAF50',
  },

  // Original styles continue...
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  productCount: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  sortContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortLabel: {
    fontSize: 14,
    color: '#666',
    marginRight: 12,
  },
  sortButtons: {
    flexDirection: 'row',
    flex: 1,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  activeSortButton: {
    backgroundColor: '#FFE8F0',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  horizontalCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  horizontalImage: {
    width: 110,
    height: 110,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  horizontalDetails: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  verticalCardWrapper: {
    width: '50%',
    padding: 6,
  },
  verticalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  verticalImageContainer: {
    position: 'relative',
    width: '100%',
  },
  verticalImage: {
    width: '100%',
    height: 180,
  },
  ratingBadgeOverlay: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    zIndex: 999,
  },
  ratingBadgeOnImage: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  verticalDetails: {
    padding: 12,
  },
  name: {
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 4,
  },
  category: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  horizontalPrice: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 16,
  },
  verticalPrice: {
    color: '#f59e0b',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  reviewText: {
    marginLeft: 3,
    fontSize: 11,
    color: '#666',
    fontWeight: '500',
  },
  activeSortButtonText: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  productList: {
    padding: 12,
    paddingBottom: 20,
  },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 0, // Myntra style - no rounded corners
    position: 'relative',
    margin: 2, // Minimal margin
    borderWidth: 0.5,
    borderColor: '#f0f0f0',
    // No shadows for cleaner look
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 3, // Less rounded
    paddingHorizontal: 8,
    paddingVertical: 4,
    zIndex: 1,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  productImageWrapper: {
    position: 'relative',
    width: '100%',
  },
  productImage: {
    width: '100%',
    height: 240, // Taller image - Myntra style
    resizeMode: 'cover',
    backgroundColor: '#f9f9f9',
  },
  gridRatingBadgeOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 999,
  },
  gridRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 8,
  },
  gridRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 2,
  },
  listImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listImage: {
    width: 80,
    height: 80,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 12,
    paddingBottom: 14,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94969f', // Lighter color for product name
    paddingBottom: 4,
    lineHeight: 17,
    letterSpacing: 0.2,
  },
  productDescription: {
    fontSize: 12,
    color: '#94969f', // Myntra's secondary text
    marginBottom: 6,
    lineHeight: 16,
  },
  productMeta: {
    marginBottom: 8,
  },
  productStock: {
    fontSize: 11,
    color: '#999',
    marginBottom: 2,
  },
  productSku: {
    fontSize: 11,
    color: '#999',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productListStyle: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    padding: 12,
    marginVertical: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 1,
  },
  price: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  originalPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  titleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  titleLeft: {
    flex: 1,
  },
  filterSortButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  count: {
    fontSize: 12,
    color: '#666',
  },
  offTag: {
    position: 'absolute',
    bottom: 95,
    left: 10,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    zIndex: 2,
  },
  offTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  wishlistIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  resellIcon: {
    position: 'absolute',
    top: 10,
    right: 50,
    zIndex: 2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  categoryName: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '600',
    flexShrink: 1,
  },
  bottomBar: {
    width: '100%',
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  bottomBarButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  bottomBarButtonText: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
  },
  sortSheetContent: {
    padding: 24,
  },
  sortSheetLabel: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 18,
    textTransform: 'uppercase',
  },
  sortSheetOption: {
    paddingVertical: 10,
  },
  sortSheetOptionText: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '400',
  },
  sortSheetOptionTextSelected: {
    color: '#000',
    fontWeight: 'bold',
  },
  filterLabel: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
    marginBottom: 2,
  },
  filterInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#f7f8fa',
  },
  filterCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  filterCheckboxLabel: {
    fontSize: 16,
    color: '#222',
    marginLeft: 10,
  },
  filterApplyBtn: {
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  filterApplyBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  filterClearBtn: {
    backgroundColor: '#eee',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  filterClearBtnText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
  },
  vendorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#282c3f',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  savedPopup: {
    position: 'absolute',
    top: 60, // Position at top instead of bottom
    left: 16,
    right: 16,
    zIndex: 9999, // Very high z-index to appear above cards
    elevation: 25, // Very high elevation for Android
  },
  savedPopupContent: {
    backgroundColor: '#fff', // White background
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 25, // Very high elevation for Android
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A', // Pink accent on the left
  },
  savedPopupLeft: {
    marginRight: 12,
  },
  savedPopupImage: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  savedPopupText: {
    flex: 1,
  },
  savedPopupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1a1a1a', // Dark text on white background
    marginBottom: 2,
  },
  savedPopupSubtitle: {
    fontSize: 14,
    color: '#666', // Gray text on white background
  },
  savedPopupViewButton: {
    backgroundColor: '#F53F7A', // Pink button on white background
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  savedPopupViewText: {
    color: '#fff', // White text on pink button
    fontSize: 14,
    fontWeight: '700',
  },
  sectionContainer: {
    marginBottom: 24,
  },
  divider: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 24,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    width: '100%',
    marginTop: 4,
  },
  discountPercentage: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    zIndex: 2,
  },
  discountBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
  },
  discountBadgeInline: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  discountBadgeTextInline: {
    fontSize: 9,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.2,
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  reviews: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
  },
  imageSkeleton: {
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  skeletonShimmer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
    position: 'absolute',
  },

  // View Toggle Styles
  viewToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  viewToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  activeViewToggle: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  viewToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  activeViewToggleText: {
    color: '#F53F7A',
  },

  // Filter Button Styles
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    gap: 6,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },

  // Wishlist milestone notification now handled by Toast - styles removed

  // Tinder Mode Container - Enhanced for better centering
  tinderModeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 0,
    backgroundColor: '#f8f9fa', // Light background like Tinder
  },

  // New Swipe Card Styles (now using dynamic styles in component)
  // swipeCardContainer and swipeImageContainer moved to dynamic styles
  swipeWishlistIcon: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  swipeMuteButton: {
    position: 'absolute',
    top: 78, // Positioned 10px below wishlist button (20 + 48 + 10)
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  swipeFeaturedBadge: {
    position: 'absolute',
    top: 20,
    left: 20,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  swipeFeaturedText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  swipeImageError: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeImageErrorText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  // swipeImageBackground moved to dynamic styles
  swipeImageGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '30%',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  // swipeVideoStyle moved to dynamic styles
  swipeNavButton: {
    position: 'absolute',
    flexDirection: 'row',
    justifyContent: 'space-between',
    left: 0,
    right: 0,
    top: '50%',
    transform: [{ translateY: -20 }],
    paddingHorizontal: 12,
    zIndex: 9,
  },
  swipeNavLeft: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  swipeNavRight: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  swipeTopOverlay: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    zIndex: 8,
  },
  swipeProductHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  swipeProductName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  swipeStockIndicator: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  swipeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  swipeRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  swipeRatingValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#282c3f',
  },
  swipeReviewCount: {
    fontSize: 12,
    color: '#7e818c',
  },
  swipeRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
  },
  swipeVariantsRow: {
    marginBottom: 6,
    gap: 4,
  },
  swipeVariantGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  swipeVariantLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7e818c',
  },
  swipeVariantValues: {
    fontSize: 12,
    color: '#282c3f',
    flex: 1,
  },
  swipeRatingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  swipeReviewsText: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 12,
  },
  // swipeInfoPanel moved to dynamic styles
  swipeProductInfoHeader: {
    marginBottom: 4,
  },
  swipeVendorRatingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  swipeVendorName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#282c3f',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    flex: 1,
    marginRight: 8,
  },
  swipeInfoRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  swipeInfoRatingText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#333',
  },
  swipeProductTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94969f',
    lineHeight: 18,
  },
  swipePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  swipePriceGroup: {
    flexDirection: 'column',
    gap: 2,
  },
  swipeMRPText: {
    fontSize: 12,
    color: '#7e818c',
    fontWeight: '500',
  },
  swipeMRPStrike: {
    fontSize: 15,
    color: '#999',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  swipeStrikethrough: {
    textDecorationLine: 'line-through',
    color: '#7e818c',
  },
  swipePriceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swipePrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#282c3f',
    letterSpacing: 0.3,
  },
  swipeOriginalPriceText: {
    fontSize: 15,
    color: '#999',
    textDecorationLine: 'line-through',
    fontWeight: '500',
  },
  swipeDiscountTag: {
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  swipeDiscountText: {
    color: '#ff905a',
    fontSize: 12,
    fontWeight: '600',
  },
  swipeDiscountBadge: {
    color: '#F53F7A',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#FFF0F5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  swipeButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: -8,
  },
  swipeTryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  swipeTryButtonText: {
    color: '#F53F7A',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  swipeShopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  swipeShopButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Spotlight Onboarding Styles
  spotlightOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  spotlightBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  spotlightTopSection: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80, // Position cutout at Grid/Swipe button level
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  spotlightMiddleSection: {
    position: 'absolute',
    top: 80, // Match the glow border position
    left: 0,
    right: 0,
    height: 40, // Match the button container height
    flexDirection: 'row',
  },
  spotlightLeftSection: {
    width: screenWidth - 260, // Match the glow border left position
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderTopRightRadius: 12, // Curved corner where it meets the hole
    borderBottomRightRadius: 12,
  },
  spotlightTransparentHole: {
    // Make the cutout wide enough to cover both Grid and Swipe
    width: 180,
    height: 40,
    backgroundColor: 'transparent',
    borderRadius: 12, // Match the glow border radius
    overflow: 'hidden', // Ensure rounded corners work properly
  },
  spotlightGlowBorder: {
    position: 'absolute',
    top: 80, // Match spotlightMiddleSection top
    left: screenWidth - 180, // Aligned with the cutout from the right (180 + 16 padding)
    width: 180, // Match spotlightTransparentHole width
    height: 40, // Match spotlightTransparentHole height
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.8,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  spotlightRightSection: {
    width: 80, // Remaining space on the right (260 - 180 = 80)
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderTopLeftRadius: 12, // Curved corner where it meets the hole
    borderBottomLeftRadius: 12,
  },
  spotlightBottomSection: {
    position: 'absolute',
    top: 120, // Adjusted to match 80 + 40 = 120
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  spotlightInstructionText: {
    position: 'absolute',
    top: 150, // Positioned below the spotlight cutout
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  spotlightInstructionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  spotlightInstructionSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    lineHeight: 22,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginBottom: 12,
  },
  spotlightTapHint: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  spotlightSkipButton: {
    position: 'absolute',
    top: 24, // Move away from buttons
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10000, // Ensure it's above the spotlight
  },
  spotlightSkipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },

  // Swipe Tutorial Spotlight Styles
  tutorialOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  tutorialDimBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)'
  },
  tutorialInstructionCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  tutorialTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  tutorialSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  tutorialTapHint: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '600',
    textAlign: 'center',
  },
  tutorialSkipButton: {
    position: 'absolute',
    top: 24,
    right: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    elevation: 4,
  },
  tutorialSkipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tutorialSpotlightRing: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.9,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
    backgroundColor: 'rgba(245,63,122,0.06)',
  },
  // Modal onboarding styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  onboardingModal: {
    width: '90%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#555',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalPreviewRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalPreviewCard: {
    flex: 1,
    backgroundColor: '#fafafa',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#eee',
  },
  modalPreviewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    marginTop: 6,
  },
  modalPreviewDesc: {
    fontSize: 12,
    color: '#777',
    marginTop: 2,
  },
  modalPrimaryButton: {
    marginTop: 20,
    backgroundColor: '#F53F7A',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  modalPrimaryButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  modalSecondaryButton: {
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#F53F7A',
    backgroundColor: '#fff',
  },
  modalSecondaryButtonText: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 16,
  },
  modalDontShowButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalDontShowButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  swipeDimmedBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  swipeSpotlightCutout: {
    position: 'absolute',
    top: screenHeight * 0.25,
    left: 20,
    right: 20,
    height: screenHeight * 0.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swipeSpotlightHole: {
    width: screenWidth - 40,
    height: screenHeight * 0.5,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  swipeInstructionLeft: {
    position: 'absolute',
    left: 20,
    top: screenHeight * 0.15,
  },
  swipeInstructionRight: {
    position: 'absolute',
    right: 20,
    top: screenHeight * 0.15,
  },
  swipeInstructionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
    minWidth: 140,
    borderWidth: 2,
    borderColor: 'rgba(245, 63, 122, 0.1)',
  },
  swipeInstructionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  swipeInstructionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  swipeInstructionDesc: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    lineHeight: 18,
  },
  swipeMainInstruction: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -80 }],
    left: 20,
    right: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    borderWidth: 2,
    borderColor: 'rgba(245, 63, 122, 0.15)',
  },
  swipeMainTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  swipeMainSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  swipeDirectionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    gap: 16,
  },
  swipeDirectionItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  swipeDirectionIconLeft: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EF4444',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#EF4444',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  swipeDirectionIconRight: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  swipeDirectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },
  swipeDirectionDesc: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  swipeActionButtons: {
    position: 'absolute',
    bottom: 100, // Position from bottom for better visibility
    left: 20,
    right: 20,
    flexDirection: 'column',
    gap: 12,
    zIndex: 100000,
  },
  dontShowAgainContainer: {
    alignSelf: 'center',
    marginBottom: 8,
  },
  checkboxWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  dontShowAgainText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  swipeBackButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F53F7A',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8,
  },
  swipeBackText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
    letterSpacing: 0.3,
  },
  swipeDoneButton: {
    flex: 2,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  swipeDoneText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },

  // Play/Pause Overlay for Videos
  playPauseOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 20,
  },
  playPauseButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },

  // Custom Toast Styles
  toastWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999,
    elevation: 99999,
    pointerEvents: 'box-none', // Allow touches to pass through wrapper
  },
  customToast: {
    width: screenWidth - 40,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
    zIndex: 99999,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toastTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  toastTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  toastSubtitle: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  toastViewButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  toastViewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // New Filter UI Styles
  newFilterContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  clearAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterTwoColumn: {
    flex: 1,
    flexDirection: 'row',
  },
  filterLeftColumn: {
    width: '33%',
    backgroundColor: '#fafafa',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
  },
  filterCategoriesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  filterCategoryItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterCategoryItemActive: {
    backgroundColor: '#f5f5f5',
    borderLeftWidth: 3,
    borderLeftColor: '#F53F7A',
  },
  filterCategoryTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterCategoryText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  filterCategoryTextActive: {
    color: '#333',
    fontWeight: '600',
  },
  filterIndicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F53F7A',
  },
  filterRightColumn: {
    flex: 1,
    width: '67%',
    backgroundColor: '#fff',
  },
  filterOptionsContainer: {
    flex: 1,
    padding: 16,
  },
  brandInfluencerTabs: {
    flexDirection: 'row',
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    padding: 4,
  },
  brandInfluencerTab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  brandInfluencerTabActive: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  brandInfluencerTabText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  brandInfluencerTabTextActive: {
    color: '#F53F7A',
    fontWeight: '600',
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    alignSelf: 'center',
    marginRight: 12,
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  // Vendor search styles
  vendorSearchInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: '#f9f9f9',
  },
  vendorList: {
    flex: 1,
  },
  emptyFilterState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyFilterText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptyFilterSubtext: {
    fontSize: 13,
    color: '#999',
    marginTop: 6,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  // Filter option styles
  filterOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 8,
    flex: 1,
  },
  sizeProductCount: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },

  // Price range styles
  filterSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  priceRangeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#f9f9f9',
  },
  priceRangeSeparator: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  // Coming Soon Screen Styles
  comingSoonContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  comingSoonContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  comingSoonIconContainer: {
    marginBottom: 24,
  },
  comingSoonTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  comingSoonDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  pollContainer: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  pollQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
  },
  pollButtons: {
    gap: 12,
  },
  pollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  pollButtonInterested: {
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  pollButtonNotInterested: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  pollButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  pollResponseContainer: {
    width: '100%',
    marginBottom: 24,
  },
  pollResponseCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  pollResponseTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  pollResponseMessage: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  changeResponseButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeResponseText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  comingSoonFooter: {
    alignItems: 'center',
  },
  comingSoonFooterText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  filterFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  filterCloseButton: {
    flex: 1,
    alignItems: 'center',
  },
  filterCloseButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  filterFooterDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 20,
  },
  filterApplyButton: {
    flex: 1,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  verticalVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  verticalVendorName: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingBadgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#FFE47A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FACC15',
    marginLeft: 8,
    flexShrink: 0,
  },
  ratingBadgeIcon: {
    fontSize: 12,
    color: '#1f2937',
  },
  ratingBadgeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 2,
  },
  ratingBadgeCount: {
    fontSize: 11,
    fontWeight: '500',
    color: '#4b5563',
    marginLeft: 4,
  },
  verticalVendorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  verticalVendorText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ratingBadgeInline: {
    backgroundColor: '#FFE47A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FACC15',
    marginLeft: 8,
    flexShrink: 0,
  },
  ratingBadgeCompact: {
    backgroundColor: '#FFE47A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FACC15',
    marginLeft: 8,
    flexShrink: 0,
  },
  ratingBadgePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  ratingBadgeListSpacing: {
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  ratingBadgeGridSpacing: {
    marginLeft: 8,
    marginTop: 4,
  },
  // Reviews Bottom Sheet Styles
  reviewsSheetBackground: {
    backgroundColor: '#fff',
  },
  reviewsSheetHandle: {
    backgroundColor: '#ddd',
  },
  reviewsSheetContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  reviewsSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewsSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewsProductInfo: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewsProductImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  reviewsProductDetails: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  reviewsProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewsRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewsAverageRating: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  reviewsTotalCount: {
    fontSize: 12,
    color: '#666',
  },
  reviewsList: {
    flex: 1,
    marginTop: 16,
  },
  reviewsLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  reviewsLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  reviewsEmptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  reviewsEmptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  reviewsEmptySubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  reviewItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reviewUserAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
  },
  reviewUserAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reviewRatingStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewDate: {
    fontSize: 12,
    color: '#999',
  },
  reviewComment: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 8,
  },
  reviewImagesScroll: {
    marginTop: 12,
  },
  reviewImageWrapper: {
    width: 80,
    height: 80,
    marginRight: 8,
  },
  reviewImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  reviewMediaViewerContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerCounter: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 1000,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  reviewMediaViewerCounterText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  reviewMediaViewerItemContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewMediaViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  reviewMediaViewerVideo: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height * 0.8,
  },
  reviewMediaViewerArrow: {
    position: 'absolute',
    top: '50%',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  reviewMediaViewerLeftArrow: {
    left: 20,
  },
  reviewMediaViewerRightArrow: {
    right: 20,
  },
  showMoreReviewsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 16,
    marginHorizontal: 16,
    gap: 8,
  },
  showMoreReviewsText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  // Try-on modal styles
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  consentModal: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
  },
  consentIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFF0F5',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  consentTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  consentContent: {
    marginBottom: 24,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  consentBullet: {
    marginRight: 12,
  },
  consentPointText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  consentDisclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  consentDisclaimerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    color: '#92400E',
    lineHeight: 18,
  },
  consentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  consentCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  consentCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  consentAgreeButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  consentAgreeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resellTutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  resellTutorialCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
  },
  resellTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  resellTutorialIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resellTutorialTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  resellTutorialSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  resellTutorialVideoWrapper: {
    width: '100%',
    maxWidth: 240,
    height: 400,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#000',
  },
  resellTutorialVideo: {
    width: '100%',
    height: '100%',
  },
  resellTutorialDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  resellTutorialCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  resellTutorialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#ddd',
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resellTutorialCheckboxChecked: {
    backgroundColor: '#F53F7A',
    borderColor: '#F53F7A',
  },
  resellTutorialCheckboxText: {
    fontSize: 14,
    color: '#666',
  },
  resellTutorialActions: {
    flexDirection: 'row',
    gap: 12,
  },
  resellTutorialSecondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  resellTutorialSecondaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  resellTutorialPrimaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  resellTutorialPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  akoolModal: {
    width: '90%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  akoolTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#222',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 4,
  },
  akoolSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    marginBottom: 18,
  },
  tryOnInfoCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#FEE2E8',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#FFF6FA',
    marginBottom: 16,
  },
  tryOnInfoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  tryOnInfoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  tryOnInfoDesc: {
    fontSize: 14,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
  },
  tryOnInfoCost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tryOnInfoCostText: {
    color: '#F53F7A',
    fontWeight: '700',
  },
  akoolBalance: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
    marginBottom: 18,
  },
  akoolContinueBtn: {
    backgroundColor: '#F53F7A',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  akoolContinueText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  sizeModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sizeModalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
  },
  sizeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sizeModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  sizeModalSubtitle: {
    fontSize: 14,
    color: '#4B5563',
    marginBottom: 16,
  },
  sizeModalCloseButton: {
    padding: 4,
  },
  sizeOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  sizeOptionChip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  sizeOptionChipSelected: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF0F5',
  },
  sizeOptionChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2933',
  },
  sizeOptionChipTextSelected: {
    color: '#F53F7A',
  },
  sizeSelectionError: {
    color: '#DC2626',
    fontSize: 13,
    marginBottom: 12,
  },
  sizeModalConfirmButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  sizeModalConfirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  tryOnCompleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tryOnCompleteModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  tryOnCompleteIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0FDF4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  tryOnCompleteTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  tryOnCompleteSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  tryOnCompleteButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  tryOnCompleteCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  tryOnCompleteCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tryOnCompleteViewButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
  },
  tryOnCompleteViewText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  photoPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  photoPickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: Dimensions.get('window').height * 0.9,
  },
  photoPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  photoPickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F53F7A',
  },
  photoPickerScrollView: {
    maxHeight: Dimensions.get('window').height * 0.75,
  },
  photoGuideSection: {
    marginBottom: 24,
  },
  samplePhotoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  samplePhotoPlaceholder: {
    width: 200,
    height: 250,
    backgroundColor: '#FFF5F7',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FEE2E8',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  samplePhotoImage: {
    width: '100%',
    height: '100%',
  },
  samplePhotoBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  samplePhotoBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  photoInstructionsContainer: {
    backgroundColor: '#FFF5F7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#FEE2E8',
  },
  photoInstructionsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
    marginBottom: 16,
  },
  photoInstructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  photoInstructionText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  photoInstructionBold: {
    fontWeight: '600',
    color: '#F53F7A',
  },
  photoPickerOptions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
    marginBottom: 20,
  },
  photoPickerOption: {
    alignItems: 'center',
    padding: 20,
  },
  photoPickerOptionText: {
    fontSize: 14,
    color: '#333',
    marginTop: 8,
  },
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  permissionModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  permissionButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  permissionCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
  },
  permissionCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  permissionSettingsButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
  },
  permissionSettingsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Coins Modal Styles
  coinsModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  coinsModalContainer: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '85%',
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 8,
  },
  coinsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  coinsModalHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  coinsModalIconWrapper: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFF5F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  coinsModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsModalScrollView: {
    flex: 1,
  },
  coinsModalScrollContent: {
    padding: 20,
  },
  coinsBalanceCard: {
    backgroundColor: '#FFF5F7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#FEE2E8',
  },
  coinsBalanceLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 6,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  coinsBalanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  coinsBalanceValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#F53F7A',
    letterSpacing: -1,
  },
  coinsBalanceUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  coinsRedeemCard: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FEE2E8',
  },
  coinsRedeemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  coinsRedeemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  coinsRedeemItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  coinsRedeemIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  coinsRedeemItemText: {
    flex: 1,
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 18,
    fontWeight: '500',
  },
  coinsRedeemHighlight: {
    fontWeight: '700',
    color: '#F53F7A',
  },
  coinsEarnSection: {
    marginBottom: 20,
  },
  coinsEarnSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  coinsEarnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  coinsEarnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  coinsEarnContent: {
    flex: 1,
  },
  coinsEarnItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  coinsEarnItemDesc: {
    fontSize: 12,
    color: '#6B7280',
  },
  coinsEarnAmountBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  coinsEarnAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#10B981',
  },
  coinsModalButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  // Products View Tutorial Modal Styles
  productsViewTutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  productsViewTutorialCard: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  productsViewTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  productsViewTutorialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFE3EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productsViewTutorialTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  productsViewTutorialSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  productsViewTutorialVideoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 300,
    maxWidth: 200,
    alignSelf: 'center',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  productsViewTutorialVideo: {
    width: '100%',
    height: '100%',
  },
  productsViewTutorialButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  productsViewTutorialViewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F8',
  },
  productsViewTutorialGridButton: {
    // Additional styles if needed
  },
  productsViewTutorialSwipeButton: {
    // Additional styles if needed
  },
  productsViewTutorialViewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F53F7A',
  },
  productsViewTutorialCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  productsViewTutorialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  productsViewTutorialCheckboxChecked: {
    backgroundColor: '#F53F7A',
  },
  productsViewTutorialCheckboxText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  productsViewTutorialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  productsViewTutorialSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  productsViewTutorialSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  productsViewTutorialPrimaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  productsViewTutorialPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  coinsModalButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});

export default Products;