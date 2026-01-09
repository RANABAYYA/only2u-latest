import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Animated } from 'react-native';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import PagerView from 'react-native-pager-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { usePreview } from '~/contexts/PreviewContext';
import { useUser } from '~/contexts/UserContext';
import { useVendor } from '~/contexts/VendorContext';
import { akoolService } from '~/utils/akoolService';
import piAPIVirtualTryOnService from '~/services/piapiVirtualTryOn';
import Toast from 'react-native-toast-message';
import { SaveToCollectionSheet, ProductDetailsBottomSheet, ProfilePhotoRequiredModal } from '~/components/common';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { useTranslation } from 'react-i18next';
import BottomSheet, { BottomSheetModal, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { TrendingLoading } from '~/components/TrendingLoading';
import { getProductImages, getFirstSafeProductImage, getSafeImageUrl } from '../utils/imageUtils';
import {
  getCloudinaryVideoThumbnail,
  isCloudinaryUrl,
} from '../utils/cloudinaryVideoOptimization';
import { getPlayableVideoUrl, isVideoUrl, isHlsUrl, getFallbackVideoUrl } from '../utils/videoUrlHelpers';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

const FILTER_TUTORIAL_KEY = 'has_seen_filter_tutorial_v3';


import TrendingVideoItem from '~/components/TrendingVideoItem';
import CollabActionSheet from '~/components/Trending/CollabActionSheet';
import { useAuth } from '~/contexts/useAuth';
const { width, height } = Dimensions.get('window');
const TRENDING_DEBUG = false;
const debugLog = (...args: any[]) => {
  if (TRENDING_DEBUG && __DEV__) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
};

type TrendingNavigationProp = StackNavigationProp<RootStackParamList>;

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

const collectVariantMedia = (product?: Product | null) => {
  const imageSet = new Set<string>();
  const videoSet = new Set<string>();

  product?.variants?.forEach((variant) => {
    (variant.image_urls || []).forEach((url) => {
      if (url) {
        imageSet.add(getSafeImageUrl(url));
      }
    });
    (variant.video_urls || []).forEach((url) => {
      if (url) {
        videoSet.add(url);
      }
    });
  });

  return {
    images: Array.from(imageSet).filter(Boolean),
    videos: Array.from(videoSet).filter(Boolean),
  };
};

interface Product {
  id: string;
  created_at: string;
  name: string;
  description: string;
  category_id: string;
  is_active: boolean;
  updated_at: string;
  featured_type?: 'trending' | 'best_seller' | null;
  like_count?: number;
  return_policy?: string;
  vendor_name?: string;
  alias_vendor?: string;
  stock_quantity?: number;
  image_urls?: string[];
  video_urls?: string[];
  rating?: number;
  reviews?: number;
  influencer_id?: string;
  category?: {
    name: string;
  };
  variants: {
    id: string;
    product_id: string;
    color_id?: string;
    size_id: string;
    quantity: number;
    created_at: string;
    updated_at: string;
    price: number;
    sku?: string;
    mrp_price?: number;
    rsp_price?: number;
    cost_price?: number;
    discount_percentage?: number;
    image_urls?: string[];
    video_urls?: string[];
    size: {
      name: string;
    };
  }[];
}

// Add Comment type
interface Comment {
  id: string;
  user_id: string;
  product_id: string;
  content: string;
  created_at: string;
  user_name?: string;
  helpful_count?: number;
}

type TimeoutId = ReturnType<typeof setTimeout>;
type IntervalId = ReturnType<typeof setInterval>;

const useManagedTimers = () => {
  const timeouts = useRef<TimeoutId[]>([]);
  const intervals = useRef<IntervalId[]>([]);

  const registerTimeout = useCallback((callback: () => void, delay: number): TimeoutId => {
    const id: TimeoutId = setTimeout(() => {
      timeouts.current = timeouts.current.filter(timeout => timeout !== id);
      callback();
    }, delay);
    timeouts.current.push(id);
    return id;
  }, []);

  const clearRegisteredTimeout = useCallback((id?: TimeoutId) => {
    if (id === undefined) return;
    clearTimeout(id);
    timeouts.current = timeouts.current.filter(timeout => timeout !== id);
  }, []);

  const registerInterval = useCallback((callback: () => void, delay: number): IntervalId => {
    const id: IntervalId = setInterval(callback, delay);
    intervals.current.push(id);
    return id;
  }, []);

  const clearRegisteredInterval = useCallback((id?: IntervalId) => {
    if (id === undefined) return;
    clearInterval(id);
    intervals.current = intervals.current.filter(interval => interval !== id);
  }, []);

  const clearAllTimers = useCallback(() => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current = [];
    intervals.current.forEach(clearInterval);
    intervals.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    registerTimeout,
    clearRegisteredTimeout,
    registerInterval,
    clearRegisteredInterval,
    clearAllTimers,
  };
};

const TrendingScreen = () => {
  let navigation;
  try {
    navigation = useNavigation<TrendingNavigationProp>();
  } catch (error) {
    console.error('Navigation error:', error);
    // Fallback navigation object
    navigation = {
      goBack: () => { },
      navigate: () => { },
    } as any;
  }
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);

  // Influencer Collab Sheet
  const collabSheetRef = useRef<BottomSheetModal>(null);
  const [selectedCollabProduct, setSelectedCollabProduct] = useState<Product | null>(null);

  const handleCollabPress = useCallback((product: Product) => {
    setSelectedCollabProduct(product);
    collabSheetRef.current?.present();
  }, []);

  const handleNavigateToProfile = useCallback((type: 'vendor' | 'influencer', id: string, data: any) => {
    collabSheetRef.current?.dismiss();
    if (type === 'influencer') {
      navigation.navigate('InfluencerProfile', { influencerId: id, influencer: data });
    } else {
      navigation.navigate('VendorProfile', { vendorId: id, vendor: data });
    }
  }, [navigation]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productInfluencers, setProductInfluencers] = useState<{ [productId: string]: any }>({});
  const [loading, setLoading] = useState(true);

  const [hasError, setHasError] = useState(false);
  const pagerRef = useRef<PagerView>(null);
  const insets = useSafeAreaInsets();

  // Tutorial state
  const [showFilterTutorial, setShowFilterTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const filterTutorialPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const checkTutorial = async () => {
      try {
        const hasSeen = await AsyncStorage.getItem(FILTER_TUTORIAL_KEY);
        if (!hasSeen) {
          // Small delay to ensure UI is ready
          setTimeout(() => {
            setShowFilterTutorial(true);
            startFilterTutorialAnimation();
          }, 1000);
        }
      } catch (error) {
        console.error('Error checking tutorial status:', error);
      }
    };
    checkTutorial();
  }, []);

  const startFilterTutorialAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(filterTutorialPulse, {
          toValue: 1.2,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(filterTutorialPulse, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleTutorialDismiss = async () => {
    setShowFilterTutorial(false);
    if (dontShowAgain) {
      try {
        await AsyncStorage.setItem(FILTER_TUTORIAL_KEY, 'true');
      } catch (error) {
        console.error('Error saving tutorial status:', error);
      }
    }
  };
  const [selectedVideoIndexes, setSelectedVideoIndexes] = useState<{ [id: string]: number }>({});
  const [videoStates, setVideoStates] = useState<{ [id: string]: { isPlaying: boolean; isMuted: boolean } }>({});
  const [videoLoadingStates, setVideoLoadingStates] = useState<{ [id: string]: boolean }>({});
  const [videoReadyStates, setVideoReadyStates] = useState<{ [id: string]: boolean }>({});
  const [videoFallbackOverrides, setVideoFallbackOverrides] = useState<{ [url: string]: string }>({});
  const videoRefs = useRef<{ [key: string]: any }>({});
  const videoOpacity = useRef<{ [key: string]: Animated.Value }>({});
  const [showTryOnModal, setShowTryOnModal] = useState(false);
  const [coinBalance, setCoinBalance] = useState(0);
  const [showProfilePhotoModal, setShowProfilePhotoModal] = useState(false);
  const [showPhotoUploadSheet, setShowPhotoUploadSheet] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePhotoModalContext, setProfilePhotoModalContext] = useState<'virtual_try_on' | 'video_face_swap'>('virtual_try_on');
  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSizeSelectionModal, setShowSizeSelectionModal] = useState(false);
  const [sizeSelectionDraft, setSizeSelectionDraft] = useState<string | null>(null);
  const [sizeSelectionError, setSizeSelectionError] = useState('');
  const [selectedTryOnSize, setSelectedTryOnSize] = useState<string | null>(null);
  const selectedTryOnSizeName = useMemo(() => {
    if (!selectedTryOnSize || !tryOnProduct?.variants) return null;
    const variant = tryOnProduct.variants.find((v) => v.size_id === selectedTryOnSize);
    return variant?.size?.name || null;
  }, [selectedTryOnSize, tryOnProduct]);
  const { showLoginSheet } = useLoginSheet();

  const promptLoginForTryOn = useCallback(() => {
    Toast.show({
      type: 'info',
      text1: 'Login Required',
      text2: 'Please login to use Face Swap.',
    });
    showLoginSheet();
  }, [showLoginSheet]);
  const profilePhotoModalContent =
    profilePhotoModalContext === 'video_face_swap'
      ? {
        description: 'Upload a profile photo first to use Video Face Swap feature.',
        icon: 'videocam-outline' as const,
      }
      : {
        description: 'Upload a profile photo first to use Face Swap feature.',
        icon: 'camera-outline' as const,
      };
  const profilePhotoModalTitle =
    profilePhotoModalContext === 'video_face_swap' ? 'Profile Photo Needed' : 'Profile Photo Required';

  // Photo upload handlers for the bottom sheet
  const handleTakePhotoForUpload = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Camera permission is needed' });
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        setShowPhotoUploadSheet(false);
        await handlePhotoUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to take photo' });
    }
  };

  const handlePickFromGalleryForUpload = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'Permission Required', text2: 'Gallery permission is needed' });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (!result.canceled && result.assets[0]) {
        setShowPhotoUploadSheet(false);
        await handlePhotoUpload(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to pick photo' });
    }
  };

  const handlePhotoUpload = async (uri: string) => {
    try {
      setUploadingPhoto(true);

      // Import the upload util
      const { uploadProfilePhoto } = await import('../utils/profilePhotoUpload');
      const result = await uploadProfilePhoto(uri);

      if (result.success && result.url) {
        // Save to user profile
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          await supabase
            .from('users')
            .update({ profilePhoto: result.url })
            .eq('id', authUser.id);

          // Refresh user data
          await refreshUserData();

          Toast.show({
            type: 'success',
            text1: 'Photo Uploaded!',
            text2: 'You can now use Virtual Try-On',
          });
        }
      } else {
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: result.error || 'Please try again' });
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to upload photo' });
    } finally {
      setUploadingPhoto(false);
      setTryOnProduct(null);
      setSizeSelectionDraft(null);
    }
  };

  const { isInWishlist, toggleWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const { addToPreview } = usePreview();
  const { userData, setUserData, refreshUserData } = useUser();
  const [swipeCount, setSwipeCount] = useState(0);
  const notificationAnimation = useRef(new Animated.Value(-100)).current;

  const {
    registerTimeout,
    clearRegisteredTimeout,
    registerInterval,
    clearRegisteredInterval,
    clearAllTimers,
  } = useManagedTimers();

  // Hide tab bar when on trending screen
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: { display: 'none' },
    });

    return () => {
      navigation.setOptions({
        tabBarStyle: undefined,
      });
    };
  }, [navigation]);
  const {
    vendors,
    getVendorByProductId,
    followVendor,
    unfollowVendor,
    isFollowingVendor
  } = useVendor();
  const [likeStates, setLikeStates] = useState<{ [id: string]: boolean }>({});
  const [likeCounts, setLikeCounts] = useState<{ [id: string]: number }>({});
  const [productVendors, setProductVendors] = useState<{ [productId: string]: any }>({});
  const [mockFollowStates, setMockFollowStates] = useState<{ [vendorId: string]: boolean }>({});



  const isFocused = useIsFocused();

  const [showCollectionSheet, setShowCollectionSheet] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showProductDetailsSheet, setShowProductDetailsSheet] = useState(false);
  const [productForDetails, setProductForDetails] = useState<Product | null>(null);
  const [showSavedPopup, setShowSavedPopup] = useState(false);
  const [savedProductName, setSavedProductName] = useState('');
  const [showUGCActionsSheet, setShowUGCActionsSheet] = useState(false);
  const [ugcActionProductId, setUGCActionProductId] = useState<string | null>(null);
  const popupAnimation = useRef(new Animated.Value(0)).current;

  const { t } = useTranslation();

  const [commentsProductId, setCommentsProductId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsRealtimeSub, setCommentsRealtimeSub] = useState<any>(null);
  const [commentCounts, setCommentCounts] = useState<{ [productId: string]: number }>({});
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedVendorNames, setBlockedVendorNames] = useState<string[]>([]);
  const [supportsVendorNameBlocking, setSupportsVendorNameBlocking] = useState(true);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});


  const [doubleTapHearts, setDoubleTapHearts] = useState<{ [productId: string]: boolean }>({});

  // Filter state
  const [allProducts, setAllProducts] = useState<Product[]>([]); // Store original unfiltered products
  const filterSheetRef = useRef<BottomSheetModal>(null);

  // Filter states
  const [activeFilterCategory, setActiveFilterCategory] = useState('Brand/Influencer');
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [filterMinPrice, setFilterMinPrice] = useState('');
  const [filterMaxPrice, setFilterMaxPrice] = useState('');
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  const [showVendorSuggestions, setShowVendorSuggestions] = useState(false);

  // Filter data
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [filteredCategories, setFilteredCategories] = useState<any[]>([]);
  const [filteredSizes, setFilteredSizes] = useState<any[]>([]);

  // Size interest UI state
  const [showSizeInterestModal, setShowSizeInterestModal] = useState(false);

  // Product counts for filters
  const [vendorProductCounts, setVendorProductCounts] = useState<{ [vendorId: string]: number }>({});
  const [categoryProductCounts, setCategoryProductCounts] = useState<{ [categoryId: string]: number }>({});
  const [sizeProductCounts, setSizeProductCounts] = useState<{ [sizeName: string]: number }>({});

  const commentsSheetRef = useRef<BottomSheet>(null);
  const ugcActionsSheetRef = useRef<BottomSheet>(null);
  const shareSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '70%'], []);
  const lastTapRef = useRef<{ [productId: string]: number }>({});
  const commentsRealtimeSubRef = useRef<any>(null);

  // Filter categories
  const filterCategories = [
    'Brand/Influencer',
    'Categories',
    'Sizes',
    'Price Range',
  ];

  // Calculate vendor suggestions based on search query
  const vendorSuggestions = useMemo(() => {
    if (!brandSearchQuery.trim()) return [];

    const query = brandSearchQuery.toLowerCase();
    const suggestions = filteredVendors
      .filter(vendor =>
        vendor.business_name?.toLowerCase().includes(query)
      )
      .slice(0, 5); // Show top 5 matches

    debugLog('[Trending] Vendor suggestions:', {
      query,
      totalVendors: filteredVendors.length,
      suggestionsFound: suggestions.length,
      showSuggestions: showVendorSuggestions
    });

    return suggestions;
  }, [brandSearchQuery, filteredVendors]);

  // Helper function to add product directly to "All" collection
  const addToAllCollection = async (product: Product) => {
    if (!userData?.id) {
      debugLog('[Trending] No user ID, cannot add to collection');
      return;
    }

    // Show toast immediately when heart is clicked
    Toast.show({
      type: 'success',
      text1: 'Added to Wishlist',
      text2: `${product.name} saved to All folder`,
      position: 'top',
      visibilityTime: 3000,
    });

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
          debugLog('[Trending] Successfully added to All collection');

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
            stock_quantity: 0,
            variants: product.variants || [],
          };

          await addToWishlist(wishlistProduct);

          // Toast already shown at the beginning
        }
      } else {
        debugLog('[Trending] Product already in All collection');
      }
    } catch (error) {
      console.error('Error in addToAllCollection:', error);
    }
  };

  const getUserPrice = useCallback((product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }

    if (userData?.size) {
      const userSizeVariant = product.variants.find(v =>
        v.size?.name === userData.size
      );
      if (userSizeVariant) {
        return userSizeVariant.price;
      }
    }

    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  }, [userData?.size]);

  const getSmallestPrice = (product: Product) => {
    if (!product.variants || product.variants.length === 0) {
      return 0;
    }
    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  useEffect(() => {
    fetchTrendingProducts();
    fetchFilterData();
  }, []);

  // Only show loading on initial load, don't refetch on every focus (causes lag)
  useEffect(() => {
    if (isFocused && products.length === 0 && !loading) {
      setLoading(true);
      fetchTrendingProducts();
    }
  }, [isFocused, products.length]);

  // Fetch vendor information for products
  useEffect(() => {
    if (products.length > 0) {
      fetchProductVendors();
    }
  }, [products]);

  // Function to fetch ratings for products
  const fetchProductRatings = async (productIds: string[]) => {
    try {
      if (productIds.length === 0) return;

      const { data, error } = await supabase
        .from('product_reviews')
        .select('product_id, rating')
        .in('product_id', productIds);

      if (error) {
        console.error('Error fetching product ratings:', error);
        return;
      }

      // Calculate average rating and count for each product
      const ratings: { [productId: string]: { rating: number; reviews: number } } = {};

      productIds.forEach(productId => {
        const productReviews = data?.filter(review => review.product_id === productId) || [];
        const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = productReviews.length > 0 ? totalRating / productReviews.length : 0;

        ratings[productId] = {
          rating: averageRating,
          reviews: productReviews.length
        };
      });

      setProductRatings(prev => ({ ...prev, ...ratings }));
    } catch (error) {
      console.error('Error fetching product ratings:', error);
    }
  };

  useEffect(() => {
    if (userData?.id && products.length > 0) {
      fetchUserLikes();
    }
  }, [userData?.id, products]);

  useEffect(() => {
    if (userData?.id) {
      fetchUserCoinBalance();
    }
  }, [userData?.id]);

  // Load blocked users and vendor names for current user
  useEffect(() => {
    const fetchBlocked = async () => {
      if (!userData?.id) return;
      try {
        const columns = supportsVendorNameBlocking
          ? 'blocked_user_id, blocked_vendor_name'
          : 'blocked_user_id';
        const { data, error } = await supabase
          .from('blocked_users')
          .select(columns)
          .eq('user_id', userData.id);

        if (error) {
          if (error.code === 'PGRST204' && supportsVendorNameBlocking) {
            setSupportsVendorNameBlocking(false);
            setBlockedVendorNames([]);
            return fetchBlocked();
          }
          console.error('Error loading blocked users:', error);
          return;
        }

        if (data) {
          setBlockedUserIds(data.map((r: any) => r.blocked_user_id).filter(Boolean));
          if (supportsVendorNameBlocking) {
            setBlockedVendorNames(data.map((r: any) => r.blocked_vendor_name).filter(Boolean));
          } else {
            setBlockedVendorNames([]);
          }
        }
      } catch (err) {
        console.error('Error loading blocked users:', err);
      }
    };
    fetchBlocked();
  }, [userData?.id, supportsVendorNameBlocking]);



  // Calculate product counts for each filter option
  const calculateProductCounts = useCallback((products: Product[]) => {
    // Calculate vendor counts
    const vendorCounts: { [vendorId: string]: number } = {};
    products.forEach(product => {
      // Try productVendors first, then fallback to vendor_id
      const vendorData = productVendors[product.id];
      const vendorId = vendorData?.id || (product as any).vendor_id;
      if (vendorId) {
        vendorCounts[vendorId] = (vendorCounts[vendorId] || 0) + 1;
      }
    });
    setVendorProductCounts(vendorCounts);

    // Calculate category counts
    const categoryCounts: { [categoryId: string]: number } = {};
    products.forEach(product => {
      if (product.category_id) {
        categoryCounts[product.category_id] = (categoryCounts[product.category_id] || 0) + 1;
      }
    });
    setCategoryProductCounts(categoryCounts);

    // Calculate size counts
    const sizeCounts: { [sizeName: string]: number } = {};
    products.forEach(product => {
      if (product.variants) {
        product.variants.forEach((variant: any) => {
          if (variant.size?.name) {
            sizeCounts[variant.size.name] = (sizeCounts[variant.size.name] || 0) + 1;
          }
        });
      }
    });
    setSizeProductCounts(sizeCounts);
  }, [productVendors]);

  // Fetch all comment counts when products are loaded
  useEffect(() => {
    if (products.length > 0) {
      fetchAllCommentCounts(products.map(p => p.id));
    }
  }, [products]);

  // Recalculate product counts when allProducts or productVendors change
  useEffect(() => {
    if (allProducts.length > 0) {
      calculateProductCounts(allProducts);
    }
  }, [allProducts, calculateProductCounts]);

  // Auto-hide saved popup with smooth animation
  useEffect(() => {
    if (showSavedPopup) {
      // Animate in
      Animated.spring(popupAnimation, {
        toValue: 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }).start();

      const timer = registerTimeout(() => {
        // Animate out
        Animated.timing(popupAnimation, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setShowSavedPopup(false);
        });
      }, 3000);

      return () => clearRegisteredTimeout(timer);
    }
  }, [showSavedPopup, popupAnimation, registerTimeout, clearRegisteredTimeout]);

  // Reset animation when popup is hidden
  useEffect(() => {
    if (!showSavedPopup) {
      popupAnimation.setValue(0);
    }
  }, [showSavedPopup, popupAnimation]);

  const fetchUserCoinBalance = async () => {
    if (!userData?.id) return;

    try {
      const balance = await akoolService.getUserCoinBalance(userData.id);
      setCoinBalance(balance);

      // Also update the user context with the latest coin balance
      if (userData && balance !== userData.coin_balance) {
        setUserData({ ...userData, coin_balance: balance });
      }
    } catch (error) {
      console.error('Error fetching coin balance:', error);
    }
  };

  const fetchProductVendors = async () => {
    try {
      const vendorPromises = products.map(async (product) => {
        const vendor = await getVendorByProductId(product.id);
        return { productId: product.id, vendor };
      });

      const vendorResults = await Promise.all(vendorPromises);
      const vendorMap: { [productId: string]: any } = {};

      vendorResults.forEach(({ productId, vendor }) => {
        if (vendor) {
          vendorMap[productId] = vendor;
        }
      });

      setProductVendors(vendorMap);
    } catch (error) {
      console.error('Error fetching product vendors:', error);
    }
  };

  // Helpers for mock vendor fallback and username formatting
  const slugifyName = (name: string) =>
    (name || 'vendor')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .replace(/\s+/g, '.');

  const generateMockVendor = (product: Product) => {
    const baseName = product.alias_vendor || product.vendor_name || product.name || 'Vendor';
    const handle = slugifyName(baseName);
    return {
      id: `mock_${product.id}`,
      business_name: baseName,
      profile_image_url: 'https://via.placeholder.com/100',
      follower_count: Math.floor(100 + Math.random() * 900),
      following_count: Math.floor(10 + Math.random() * 200),
      is_verified: false,
      username: `@${handle}`,
    };
  };

  const isFollowingVendorSafe = (vendorId: string) => {
    if (vendorId?.startsWith('mock_')) {
      return !!mockFollowStates[vendorId];
    }
    return isFollowingVendor(vendorId);
  };

  const fetchTrendingProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          created_at,
          name,
          description,
          category_id,
          is_active,
          updated_at,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          vendor_id,
          influencer_id,
          category:categories(name),
          product_variants!inner(
            id,
            product_id,
            color_id,
            size_id,
            quantity,
            created_at,
            updated_at,
            price,
            sku,
            mrp_price,
            rsp_price,
            cost_price,
            discount_percentage,
            image_urls,
            video_urls,
            size:sizes(name)
          )
        `)
        // .eq('featured_type', 'trending') // Show all videos instead of just trending
        .eq('is_active', true)
        // Filter products that have at least one variant with videos
        .neq('product_variants.video_urls', '{}')
        .not('product_variants.video_urls', 'is', null)
        .order('created_at', { ascending: false })
        .limit(30); // Reduced from 100 for better performance

      if (error) {
        console.error('Error fetching trending products:', error);
        setHasError(true);
        return;
      }

      debugLog('[Trending] Raw products fetched:', data?.length);

      // Fix: category comes as array, map to object
      const fixedData = (data || []).map((item: any) => ({
        ...item,
        category: Array.isArray(item.category) ? item.category[0] : item.category,
        variants: item.product_variants || [],
      })).filter(product => {
        // Only show products with featured_type = 'trending' and have videos (not just images)
        const hasVideos = product.variants.some((variant: any) =>
          variant.video_urls && variant.video_urls.length > 0
        );
        // const isTrending = product.featured_type === 'trending';
        return hasVideos; // Show all products with videos
      });

      debugLog('[Trending] Filtered products:', fixedData.length);

      // Fetch vendor info for all products to enable blocking
      let vendorsMap: { [productId: string]: any } = {};
      if (fixedData.length > 0) {
        const vendorIds = fixedData.map(p => p.vendor_id).filter(Boolean);
        if (vendorIds.length > 0) {
          const { data: vendorsData } = await supabase
            .from('vendors')
            .select('*')
            .in('id', vendorIds);

          if (vendorsData) {
            fixedData.forEach(product => {
              const vendor = vendorsData.find(v => v.id === product.vendor_id);
              if (vendor) {
                vendorsMap[product.id] = vendor;
              }
            });
            setProductVendors(vendorsMap);
          }
        }
      }

      // Fetch influencer info
      let influencersMap: { [productId: string]: any } = {};
      if (fixedData.length > 0) {
        const influencerIds = fixedData.map(p => p.influencer_id).filter(Boolean);
        if (influencerIds.length > 0) {
          const uniqueIds = [...new Set(influencerIds)];
          const { data: influencersData } = await supabase
            .from('influencer_profiles')
            .select('*')
            .in('id', uniqueIds);

          if (influencersData) {
            fixedData.forEach(product => {
              if (product.influencer_id) {
                const influencer = influencersData.find(i => i.id === product.influencer_id);
                if (influencer) {
                  influencersMap[product.id] = influencer;
                }
              }
            });
            setProductInfluencers(influencersMap);
          }
        }
      }

      // Filter out products from blocked vendors (by user_id or vendor name)
      const filteredData = fixedData.filter(product => {
        const vendorName = product.vendor_name || product.alias_vendor;
        const vendor = vendorsMap[product.id];

        // Check if blocked by vendor name
        if (supportsVendorNameBlocking && vendorName && blockedVendorNames.includes(vendorName)) {
          return false;
        }

        // Check if blocked by user_id
        if (vendor && vendor.user_id && blockedUserIds.includes(vendor.user_id)) {
          return false;
        }

        return true; // Show product if not blocked
      });

      setProducts(filteredData);
      setAllProducts(filteredData); // Store for search filtering

      // Fetch ratings for products
      const productIds = fixedData.map(product => product.id);
      await fetchProductRatings(productIds);

      // Initialize like counts
      const initialLikeCounts = fixedData.reduce((acc: { [id: string]: number }, product) => {
        acc[product.id] = product.like_count || 0;
        return acc;
      }, {});
      setLikeCounts(initialLikeCounts);

    } catch (error) {
      console.error('Error fetching trending products:', error);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  };

  // Fetch filter data (vendors, categories, colors, sizes)
  const fetchFilterData = async () => {
    try {
      debugLog('[Trending] Fetching filter data...');

      // Fetch vendors that have products
      // First, get distinct vendor IDs from products
      const { data: productsWithVendors } = await supabase
        .from('products')
        .select('vendor_id')
        .not('vendor_id', 'is', null);

      if (productsWithVendors) {
        const vendorIds = [...new Set(productsWithVendors.map((p: any) => p.vendor_id).filter(Boolean))];

        if (vendorIds.length > 0) {
          const { data: vendorsData, error: vendorsError } = await supabase
            .from('vendors')
            .select('business_name, id')
            .in('id', vendorIds)
            .order('business_name');

          if (vendorsError) {
            console.error('[Trending] Error fetching vendors:', vendorsError);
          }

          if (!vendorsError && vendorsData) {
            debugLog('[Trending] Fetched vendors with products:', vendorsData.length);
            setFilteredVendors(vendorsData);
          } else {
            debugLog('[Trending] No vendors data or error occurred');
            setFilteredVendors([]);
          }
        } else {
          setFilteredVendors([]);
        }
      } else {
        setFilteredVendors([]);
      }

      // Fetch categories - only active ones
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name')
        .eq('is_active', true);

      if (categoriesData) {
        setFilteredCategories(categoriesData);
      }

      // Fetch sizes
      const { data: sizesData } = await supabase
        .from('sizes')
        .select('id, name');

      if (sizesData) {
        setFilteredSizes(sortSizesAscending(sizesData));
      }

    } catch (error) {
      console.error('[Trending] Error fetching filter data:', error);
    }
  };

  const fetchUserLikes = async () => {
    if (!userData?.id) return;

    try {
      const { data, error } = await supabase
        .from('product_likes')
        .select('product_id')
        .eq('user_id', userData.id);

      if (error) {
        console.error('Error fetching user likes:', error);
        return;
      }

      // Create a map of liked product IDs
      const likedProductIds = (data || []).reduce((acc: { [id: string]: boolean }, like: any) => {
        acc[like.product_id] = true;
        return acc;
      }, {});

      setLikeStates(likedProductIds);
    } catch (error) {
      console.error('Error fetching user likes:', error);
    }
  };

  const toggleLikeInSupabase = async (productId: string, isLiked: boolean) => {
    if (!userData?.id) return;

    try {
      if (isLiked) {
        // Remove like
        const { error } = await supabase
          .from('product_likes')
          .delete()
          .eq('user_id', userData.id)
          .eq('product_id', productId);

        if (error) {
          console.error('Error removing like:', error);
          return false;
        }
      } else {
        // Add like
        const { error } = await supabase
          .from('product_likes')
          .insert({
            user_id: userData.id,
            product_id: productId,
          });

        if (error) {
          console.error('Error adding like:', error);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error('Error toggling like:', error);
      return false;
    }
  };

  const handleSelectVideo = (itemId: string, videoIdx: number) => {
    setSelectedVideoIndexes((prev) => ({ ...prev, [itemId]: videoIdx }));
  };

  const togglePlay = (itemId: string) => {
    setVideoStates((prev) => {
      const prevState = prev[itemId] || { isPlaying: true, isMuted: false };
      const newState = { ...prevState, isPlaying: !prevState.isPlaying };
      const ref = videoRefs.current[itemId];
      if (ref) {
        if (newState.isPlaying) ref.playAsync();
        else ref.pauseAsync();
      }
      return { ...prev, [itemId]: newState };
    });
  };

  const toggleMute = (itemId: string) => {
    setVideoStates((prev) => {
      const prevState = prev[itemId] || { isPlaying: true, isMuted: false };
      const newMuteState = !prevState.isMuted;

      // Apply the new mute state to ALL videos
      const updatedStates: { [id: string]: { isPlaying: boolean; isMuted: boolean } } = {};

      // Update all existing video states
      Object.keys(prev).forEach((key) => {
        updatedStates[key] = { ...prev[key], isMuted: newMuteState };
        const ref = videoRefs.current[key];
        if (ref) ref.setIsMutedAsync(newMuteState);
      });

      // Also update the current video if it's not in prev
      if (!prev[itemId]) {
        updatedStates[itemId] = { isPlaying: true, isMuted: newMuteState };
        const ref = videoRefs.current[itemId];
        if (ref) ref.setIsMutedAsync(newMuteState);
      }

      return updatedStates;
    });
  };

  // Clean up video refs for videos that are far from current index
  const cleanupDistantVideos = useCallback((currentIdx: number) => {
    const keepRange = 1; // Keep current and next video (preload strategy)
    Object.keys(videoRefs.current).forEach((productId) => {
      const productIndex = products.findIndex(p => p.id === productId);
      if (productIndex !== -1 && Math.abs(productIndex - currentIdx) > keepRange) {
        // Unload video ref
        const ref = videoRefs.current[productId];
        if (ref) {
          try {
            ref.stopAsync().catch(() => { });
            ref.unloadAsync().catch(() => { });
          } catch (error) {
            debugLog(`[Trending] Could not unload video for ${productId}`);
          }
        }
        delete videoRefs.current[productId];

        // Clean up video state
        setVideoStates(prev => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });

        // Clean up loading state
        setVideoLoadingStates(prev => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });

        // Clean up ready state
        setVideoReadyStates(prev => {
          const next = { ...prev };
          delete next[productId];
          return next;
        });

        // Reset opacity animation
        if (videoOpacity.current[productId]) {
          videoOpacity.current[productId].setValue(0);
        }

      }
    });
  }, [products]);

  const setActiveVideo = useCallback((productId: string | null, currentIdx?: number) => {
    setVideoStates((prev) => {
      if (products.length === 0) {
        return {};
      }
      const next: { [id: string]: { isPlaying: boolean; isMuted: boolean } } = { ...prev };
      products.forEach((product) => {
        const prevState = prev[product.id] || { isPlaying: false, isMuted: false };
        const shouldPlay = productId ? product.id === productId : false;
        next[product.id] = {
          isPlaying: shouldPlay,
          isMuted: prevState.isMuted ?? false,
        };
      });
      return next;
    });

    // Clean up distant videos when changing active video
    if (currentIdx !== undefined) {
      cleanupDistantVideos(currentIdx);
    }
  }, [products, cleanupDistantVideos]);

  useEffect(() => {
    if (!isFocused) {
      clearAllTimers(); // Restore timer cleanup
      setActiveVideo(null);

      // Cleanup comments subscription on blur
      if (commentsRealtimeSubRef.current) {
        supabase.removeChannel(commentsRealtimeSubRef.current);
        commentsRealtimeSubRef.current = null;
        setCommentsRealtimeSub(null);
      }
      commentsSheetRef.current?.close();
      setCommentsProductId(null);

      Object.keys(videoRefs.current).forEach((productId) => {
        const ref = videoRefs.current[productId];
        if (ref) {
          try {
            ref.pauseAsync?.().catch(() => { });
            // Only pause, don't unload to allow quick resume
          } catch (error) {
            debugLog(`[Trending] Error pausing video on blur for ${productId}`, error);
          }
        }
      });
      // Do NOT clear refs as components remain mounted
      // videoRefs.current = {}; 

      // Do NOT clear states completely, just ensure nothing is playing
      setVideoStates(prev => {
        const pausedStates: { [key: string]: any } = {};
        Object.keys(prev).forEach(key => {
          pausedStates[key] = { ...prev[key], isPlaying: false };
        });
        return pausedStates;
      });
      return;
    }
    const activeProduct = products[currentIndex];
    if (activeProduct) {
      setActiveVideo(activeProduct.id, currentIndex);
    }
  }, [isFocused, currentIndex, products, setActiveVideo]);

  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([id, ref]) => {
      const state = videoStates[id];
      if (!ref || !state) return;
      if (state.isPlaying) {
        const playPromise = ref.playAsync?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => { });
        }
      } else {
        const pausePromise = ref.pauseAsync?.();
        if (pausePromise && typeof pausePromise.catch === 'function') {
          pausePromise.catch(() => { });
        }
      }
      const mutePromise = ref.setIsMutedAsync?.(state.isMuted);
      if (mutePromise && typeof mutePromise.catch === 'function') {
        mutePromise.catch(() => { });
      }
    });
  }, [videoStates]);

  // Cleanup all videos when component unmounts
  useEffect(() => {
    return () => {
      debugLog('[Trending] Cleaning up all videos on unmount');
      Object.keys(videoRefs.current).forEach((productId) => {
        const ref = videoRefs.current[productId];
        if (ref) {
          try {
            ref.stopAsync().catch(() => { });
            ref.unloadAsync().catch(() => { });
          } catch (error) {
            debugLog(`[Trending] Could not unload video on unmount for ${productId}`);
          }
        }
      });
      videoRefs.current = {};
      setVideoStates({});
      setVideoLoadingStates({});
      clearAllTimers();
      if (commentsRealtimeSubRef.current) {
        supabase.removeChannel(commentsRealtimeSubRef.current);
        commentsRealtimeSubRef.current = null;
      }
    };
  }, [clearAllTimers]);

  const handleShopNow = (product: Product) => {
    if (!userData?.id) {
      showLoginSheet();
      return;
    }

    const userPrice = getUserPrice(product);

    // Get discount from first variant that has it
    const firstVariantWithDiscount = product.variants.find(v => v.discount_percentage && v.discount_percentage > 0);
    const discountPercentage = firstVariantWithDiscount?.discount_percentage || 0;
    const hasDiscount = discountPercentage > 0;
    const originalPrice = hasDiscount ? userPrice / (1 - discountPercentage / 100) : userPrice;
    const discountedPrice = userPrice;

    // const productForDetails = {
    //       id: product.id,
    //       name: product.name,
    //       price: discountedPrice,
    //       originalPrice: hasDiscount ? originalPrice : undefined,
    //       discount: discountPercentage,
    //       rating: 4.5, // Default rating
    //       reviews: 0, // Default reviews
    //       image: getFirstSafeProductImage(product),
    //       image_urls: getProductImages(product),
    //       description: product.description,
    //       stock_quantity: product.variants.reduce((sum, v) => sum + v.quantity, 0),
    //       variants: product.variants,
    //       featured: product.featured_type !== null,
    //       images: 1,

    //     };

    const variantMedia = collectVariantMedia(product);
    const combinedImages =
      variantMedia.images.length > 0 ? variantMedia.images : getProductImages(product);
    const combinedVideos =
      variantMedia.videos.length > 0 ? variantMedia.videos : product.video_urls || [];

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: discountedPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0])),
      rating: productRatings[product.id]?.rating || 0, // Real rating from product_reviews
      reviews: productRatings[product.id]?.reviews || 0, // Real review count from product_reviews
      image: getFirstSafeProductImage(product),
      image_urls: combinedImages,
      video_urls: combinedVideos,
      description: product.description,
      featured: product.featured_type !== null,
      images: 1,
      sku: product.variants?.[0]?.sku || '',
      category: product.category?.name || '',
      vendor_name: product.vendor_name || '',
      alias_vendor: product.alias_vendor || '',
      return_policy: product.return_policy || '',
      variants: product.variants,
    };

    setProductForDetails(productForDetails as any);
    setShowProductDetailsSheet(true);
  };

  const handleWishlist = (product: Product) => {
    const wishlistProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: productPrices[product.id] || 0,
      image_url: getFirstSafeProductImage(product),
      image_urls: getProductImages(product),
      video_urls: [], // Get from variants if needed
      featured_type: product.featured_type || undefined,
      category: product.category,
      stock_quantity: product.variants.reduce((sum, v) => sum + v.quantity, 0),
      variants: product.variants,
    };
    toggleWishlist({ ...wishlistProduct, price: productPrices[product.id] || 0 });
  };

  const handleLike = async (productId: string) => {
    const currentLikeState = likeStates[productId] || false;
    const newLikeState = !currentLikeState;
    const currentLikeCount = likeCounts[productId] || 0;

    // Optimistically update UI
    setLikeStates((prev) => ({ ...prev, [productId]: newLikeState }));
    setLikeCounts((prev) => ({
      ...prev,
      [productId]: newLikeState ? currentLikeCount + 1 : Math.max(0, currentLikeCount - 1)
    }));

    // Update in Supabase
    const success = await toggleLikeInSupabase(productId, currentLikeState);

    if (!success) {
      // Revert UI if Supabase update failed
      setLikeStates((prev) => ({ ...prev, [productId]: currentLikeState }));
      setLikeCounts((prev) => ({ ...prev, [productId]: currentLikeCount }));
    }
  };

  const handleVideoTap = (productId: string) => {
    const now = Date.now();
    const lastTap = lastTapRef.current[productId] || 0;
    const timeSinceLastTap = now - lastTap;

    // Check if it's a double tap (within 300ms)
    if (timeSinceLastTap < 300) {
      // Double tap detected - like the product
      handleDoubleTapLike(productId);
      lastTapRef.current[productId] = 0; // Reset
    } else {
      // Single tap - toggle mute
      lastTapRef.current[productId] = now;
      registerTimeout(() => {
        // If no second tap came, process single tap
        if (lastTapRef.current[productId] === now) {
          setVideoStates((prev) => {
            const prevState = prev[productId] || { isPlaying: true, isMuted: false };
            const newState = { ...prevState, isMuted: !prevState.isMuted };
            const ref = videoRefs.current[productId];
            if (ref) {
              ref.setIsMutedAsync(newState.isMuted);
            }
            return { ...prev, [productId]: newState };
          });
        }
      }, 300);
    }
  };

  const handleDoubleTapLike = async (productId: string) => {
    // Show heart animation
    setDoubleTapHearts((prev) => ({ ...prev, [productId]: true }));

    // Hide heart after animation
    registerTimeout(() => {
      setDoubleTapHearts((prev) => ({ ...prev, [productId]: false }));
    }, 1000);

    // Like the product if not already liked
    if (!likeStates[productId]) {
      await handleLike(productId);
      Toast.show({
        type: 'success',
        text1: '❤️ Liked!',
        visibilityTime: 1500,
        position: 'top',
      });
    }
  };

  const handleFollowVendor = async (vendorId: string) => {
    if (!userData?.id) {
      Alert.alert('Login Required', 'Please login to follow vendors');
      return;
    }

    try {
      if (vendorId.startsWith('mock_')) {
        const currentlyFollowing = !!mockFollowStates[vendorId];
        setMockFollowStates(prev => ({ ...prev, [vendorId]: !currentlyFollowing }));
        Toast.show({
          type: 'success',
          text1: currentlyFollowing ? 'Unfollowed' : 'Following',
          text2: currentlyFollowing ? 'You unfollowed this vendor' : 'You are now following this vendor',
        });
        return;
      }

      const isFollowing = isFollowingVendor(vendorId);
      const success = isFollowing
        ? await unfollowVendor(vendorId)
        : await followVendor(vendorId);

      if (success) {
        Toast.show({
          type: 'success',
          text1: isFollowing ? 'Unfollowed' : 'Following',
          text2: isFollowing ? 'You unfollowed this vendor' : 'You are now following this vendor',
        });
      } else {
        Alert.alert('Error', 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };

  const handleVendorProfile = (vendor: any) => {
    navigation.navigate('VendorProfile' as never, {
      vendorId: vendor.id,
      vendor
    } as never);
  };

  const handleWishlistPress = async (product: Product) => {
    if (isInWishlist(product.id)) {
      // Show collection sheet to manually remove from collections
      setSelectedProduct({
        ...product,
        price: productPrices[product.id] || 0,
        featured_type: product.featured_type || undefined
      } as any);
      setShowCollectionSheet(true);
    } else {
      // Add to "All" collection first
      await addToAllCollection(product);
      // Set selected product and show collection sheet instantly
      setSelectedProduct({
        ...product,
        price: productPrices[product.id] || 0,
        featured_type: product.featured_type || undefined
      } as any);
      setShowCollectionSheet(true);
    }
  };

  const handleShare = (productId: string) => {
    setUGCActionProductId(productId);
    shareSheetRef.current?.expand();
  };

  const handleShowMore = (productId: string) => {
    setUGCActionProductId(productId);
    ugcActionsSheetRef.current?.expand();
  };

  const setVideoRef = (id: string, ref: Video | null) => {
    if (ref) {
      videoRefs.current[id] = ref;
    } else {
      delete videoRefs.current[id];
    }
  };

  const setVideoReady = (id: string, isReady: boolean) => {
    setVideoReadyStates(prev => ({ ...prev, [id]: isReady }));
  };

  const handleTryOnButtonPress = (product: Product) => {
    if (!userData?.id) {
      promptLoginForTryOn();
      return;
    }

    setTryOnProduct(product);
    const sizeOptions = sortSizesAscending(extractProductSizes(product));
    if (sizeOptions.length > 0) {
      const preferredSize =
        (selectedTryOnSize && sizeOptions.find((size) => size.id === selectedTryOnSize)) ||
        sizeOptions.find((size) => size.name === userData?.size);
      const initialSizeId = preferredSize?.id || sizeOptions[0].id;
      setSizeSelectionDraft(initialSizeId);
      setSizeSelectionError('');
      setShowSizeSelectionModal(true);
    } else {
      setSelectedTryOnSize(null);
      setSizeSelectionDraft(null);
      setSizeSelectionError('');
      setShowConsentModal(true);
    }
  };

  const handleConfirmSizeSelection = () => {
    if (!sizeSelectionDraft) {
      setSizeSelectionError('Please choose a size to continue.');
      return;
    }
    setSelectedTryOnSize(sizeSelectionDraft);
    setShowSizeSelectionModal(false);
    setSizeSelectionError('');
    setShowConsentModal(true);
  };

  const handleCancelSizeSelection = () => {
    setShowSizeSelectionModal(false);
    setSizeSelectionDraft(null);
    setSizeSelectionError('');
    setSelectedTryOnSize(null);
    setTryOnProduct(null);
  };

  const handleConsentCancel = () => {
    setShowConsentModal(false);
    setTryOnProduct(null);
  };

  const handleConsentAgree = () => {
    if (!tryOnProduct) {
      setShowConsentModal(false);
      return;
    }
    setShowConsentModal(false);
    setShowTryOnModal(true);
  };

  const handleStartFaceSwap = () => {
    if (!tryOnProduct) return;
    handleVirtualTryOn(tryOnProduct, selectedTryOnSize || undefined);
  };

  const renderTryOnSizeOption = (size: { id: string; name: string }) => {
    const isSelected = sizeSelectionDraft === size.id;
    return (
      <TouchableOpacity
        key={`tryon-size-${size.id}`}
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
  };

  const handleVirtualTryOn = async (product: Product, sizeId?: string) => {
    if (!userData?.id) {
      setShowTryOnModal(false);
      promptLoginForTryOn();
      return;
    }

    await (refreshUserData?.() as any)?.catch?.(() => { });
    if (!userData?.profilePhoto) {
      setProfilePhotoModalContext('virtual_try_on');
      setShowProfilePhotoModal(true);
      setShowTryOnModal(false);
      setTryOnProduct(null);
      return;
    }

    if (coinBalance < 50) {
      Alert.alert('Insufficient Coins', 'You need at least 50 coins for Face Swap. Please purchase more coins.');
      return;
    }

    const productId = product.id;
    const sizedVariant = sizeId
      ? product.variants?.find(
        (v) => v.size_id === sizeId && v.image_urls && v.image_urls.length > 0
      )
      : undefined;
    const firstVariantWithImage = product.variants?.find((v) => v.image_urls && v.image_urls.length > 0);
    const productImageUrl =
      sizedVariant?.image_urls?.[0] ||
      firstVariantWithImage?.image_urls?.[0] ||
      product.image_urls?.[0];

    debugLog('👗 Face Swap - Product:', {
      id: productId,
      name: product.name,
      variants: product.variants?.map(v => ({ id: v.id, image_urls: v.image_urls })),
      firstVariantWithImage: firstVariantWithImage?.image_urls,
      productImageUrl
    });

    if (!productImageUrl) {
      Alert.alert('Error', 'Product image not available');
      return;
    }

    setShowTryOnModal(false);

    try {
      // Update coin balance (deduct 50 coins for face swap)
      setCoinBalance(prev => prev - 50);

      // Also update user context
      if (userData) {
        setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) - 50 });
      }

      // Deduct coins from database
      await supabase
        .from('users')
        .update({ coin_balance: (userData?.coin_balance || 0) - 50 })
        .eq('id', userData?.id);

      // Initiate face swap with PiAPI
      const response = await piAPIVirtualTryOnService.initiateVirtualTryOn({
        userImageUrl: userData.profilePhoto,
        productImageUrl: productImageUrl,
        userId: userData.id,
        productId: productId,
        batchSize: 1,
      });

      if (response.success && response.taskId) {
        // PiAPI always processes asynchronously - start polling
        startFaceSwapPolling(productId, response.taskId);

        Toast.show({
          type: 'success',
          text1: 'Face Swap Started',
          text2: 'Your face swap is being processed. This may take a few minutes.',
        });
      } else {
        // Refund coins on failure
        setCoinBalance(prev => prev + 50);
        if (userData) {
          setUserData({ ...userData, coin_balance: (userData.coin_balance || 0) + 50 });
        }
        await supabase
          .from('users')
          .update({ coin_balance: (userData?.coin_balance || 0) + 50 })
          .eq('id', userData?.id);

        Alert.alert(
          'Try On Failed',
          'We could not generate the try-on image. Please upload a better profile picture and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Upload Photo',
              onPress: () => {
                setProfilePhotoModalContext('virtual_try_on');
                setShowProfilePhotoModal(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error starting face swap:', error);
      Alert.alert(
        'Try On Failed',
        'We could not generate the try-on image. Please upload a better profile picture and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Upload Photo',
            onPress: () => {
              setProfilePhotoModalContext('virtual_try_on');
              setShowProfilePhotoModal(true);
            }
          }
        ]
      );
    } finally {
      setTryOnProduct(null);
      setSelectedTryOnSize(null);
      setSizeSelectionDraft(null);
    }
  };

  const startFaceSwapPolling = (productId: string, taskId: string) => {
    let pollCount = 0;
    const maxPollAttempts = 60; // 5 minutes timeout (60 * 5 seconds)

    const interval = registerInterval(async () => {
      try {
        pollCount++;
        debugLog(`[Trending] Polling attempt ${pollCount}/${maxPollAttempts}`);

        const status = await piAPIVirtualTryOnService.checkTaskStatus(taskId);

        if (status.status === 'completed' && status.resultImages) {
          clearRegisteredInterval(interval);

          // Save results permanently
          if (userData?.id) {
            await akoolService.saveFaceSwapResults(userData.id, productId, status.resultImages);
          }

          // Add product to preview
          const currentProduct = products.find(p => p.id === productId);
          if (currentProduct) {
            const orderedImages = (status.resultImages || []).sort((a, b) => {
              const aApi = /theapi\.app/i.test(a) ? 0 : 1;
              const bApi = /theapi\.app/i.test(b) ? 0 : 1;
              return aApi - bApi;
            });
            const personalizedProduct = {
              id: `personalized_${productId}_${Date.now()}`,
              name: currentProduct.name,
              description: `Personalized ${currentProduct.name} with your face`,
              price: 0,
              image_urls: orderedImages,
              video_urls: [],
              featured_type: 'personalized',
              category: currentProduct.category,
              stock_quantity: 1,
              variants: [],
              isPersonalized: true,
              originalProductImage: currentProduct.variants?.[0]?.image_urls?.[0] || currentProduct.image_urls?.[0] || '',
              faceSwapDate: new Date().toISOString(),
              originalProductId: productId,
            };
            addToPreview(personalizedProduct);
          }

          Toast.show({
            type: 'success',
            text1: 'Preview Ready!',
            text2: 'Your personalized product has been added to Your Preview.',
          });
        } else if (status.status === 'failed') {
          clearRegisteredInterval(interval);
          Alert.alert('Error', status.error || 'Face swap failed. Please try again.');
        } else if (pollCount >= maxPollAttempts) {
          // Timeout after 5 minutes
          clearRegisteredInterval(interval);
          console.warn('[Trending] Face swap polling timeout');
          Alert.alert(
            'Processing Timeout',
            'Face swap is taking longer than expected. Please try again later or contact support if the issue persists.'
          );
        }
      } catch (error) {
        console.error('Error checking face swap status:', error);
      }
    }, 5000); // Poll every 5 seconds
  };

  const renderItem = ({ item: product, index }: { item: Product; index: number }) => {
    const videoState = videoStates[product.id] || { isPlaying: true, isMuted: true }; // Default muted
    const vendor = productVendors[product.id] || generateMockVendor(product);
    const influencer = productInfluencers[product.id];

    return (
      <View key={product.id} style={{ width: width, height: height }}>
        <TrendingVideoItem
          product={product}
          index={index}
          currentIndex={currentIndex}
          isActive={index === currentIndex}
          videoState={videoState}
          isLiked={likeStates[product.id] || false}
          isInWishlist={isInWishlist(product.id)}
          isFollowingVendor={isFollowingVendorSafe(vendor.id)}
          vendor={vendor}
          influencer={influencer}
          productPrice={productPrices[product.id] || 0}
          insets={insets}
          onLike={handleLike}
          onFollowVendor={handleFollowVendor}
          onVideoTap={handleVideoTap}
          onToggleMute={toggleMute}
          onWishlistPress={handleWishlistPress}
          onShare={handleShare}
          onShowMore={handleShowMore}
          onOpenComments={openComments}
          onTryOn={handleTryOnButtonPress}
          onCollabPress={handleCollabPress}
          onShopNow={handleShopNow}
          onShowFilters={() => filterSheetRef.current?.present()}
          setVideoRef={setVideoRef}
          videoFallbackOverrides={videoFallbackOverrides}
          setVideoFallbackOverrides={setVideoFallbackOverrides}
          videoReady={videoReadyStates[product.id] || false}
          setVideoReady={setVideoReady}
        />
      </View>
    );
  };
  // Memoize product prices to prevent unnecessary recalculations
  const productPrices = useMemo(() => {
    const prices: { [key: string]: number } = {};
    products.forEach(product => {
      prices[product.id] = getUserPrice(product);
    });
    return prices;
  }, [products, getUserPrice]);



  // Filter helper functions
  const toggleVendorSelection = (vendorId: string) => {
    setSelectedVendorIds(prev =>
      prev.includes(vendorId)
        ? prev.filter(v => v !== vendorId)
        : [...prev, vendorId]
    );
  };

  const toggleCategorySelection = (categoryId: string) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const toggleSizeSelection = (sizeName: string) => {
    setSelectedSizes(prev =>
      prev.includes(sizeName)
        ? prev.filter(s => s !== sizeName)
        : [...prev, sizeName]
    );
  };

  const handleClearAllFilters = () => {
    setSelectedVendorIds([]);
    setSelectedCategories([]);
    setSelectedSizes([]);
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setBrandSearchQuery('');
  };

  // Apply filters and refresh products
  const handleApplyFilters = () => {
    filterSheetRef.current?.dismiss();
    applyFilters();
    Toast.show({
      type: 'success',
      text1: 'Filters Applied',
      position: 'top',
    });
  };

  // Filter products based on selected filters
  const applyFilters = () => {
    if (selectedVendorIds.length === 0 && selectedCategories.length === 0 &&
      selectedSizes.length === 0 && !filterMinPrice && !filterMaxPrice && !brandSearchQuery.trim()) {
      setProducts(allProducts);
      return;
    }

    let filtered = [...allProducts];

    // Filter by brand search query
    if (brandSearchQuery.trim()) {
      const lowerQuery = brandSearchQuery.toLowerCase();
      filtered = filtered.filter(product => {
        const matchesVendor = product.vendor_name?.toLowerCase().includes(lowerQuery) ||
          product.alias_vendor?.toLowerCase().includes(lowerQuery);
        return matchesVendor;
      });
    }

    // Separate vendor products and other products when vendor filter is applied
    let vendorProducts: any[] = [];
    let otherProducts: any[] = [];

    if (selectedVendorIds.length > 0) {
      // Split products into vendor products and others
      filtered.forEach(product => {
        const vendorData = productVendors[product.id];
        if (vendorData && selectedVendorIds.includes(vendorData.id)) {
          vendorProducts.push(product);
        } else {
          otherProducts.push(product);
        }
      });
    } else {
      // No vendor filter, use all products
      vendorProducts = filtered;
      otherProducts = [];
    }

    // Apply other filters to both groups
    const applyOtherFilters = (products: any[]) => {
      let result = [...products];

      // Filter by categories
      if (selectedCategories.length > 0) {
        result = result.filter(product =>
          product.category_id && selectedCategories.includes(product.category_id)
        );
      }

      // Filter by sizes
      if (selectedSizes.length > 0) {
        result = result.filter(product => {
          return product.variants?.some((variant: any) => {
            return variant.size?.name && selectedSizes.includes(variant.size.name);
          });
        });
      }

      // Filter by price range
      if (filterMinPrice || filterMaxPrice) {
        result = result.filter(product => {
          const price = getUserPrice(product);
          const min = filterMinPrice ? parseFloat(filterMinPrice) : 0;
          const max = filterMaxPrice ? parseFloat(filterMaxPrice) : Infinity;
          return price >= min && price <= max;
        });
      }

      return result;
    };

    // Apply filters to both groups
    const filteredVendorProducts = applyOtherFilters(vendorProducts);
    const filteredOtherProducts = applyOtherFilters(otherProducts);

    // Combine: vendor products first, then other products
    const finalFiltered = [...filteredVendorProducts, ...filteredOtherProducts];

    setProducts(finalFiltered);
    setCurrentIndex(0); // Reset to first item
    pagerRef.current?.setPage(0);
  };

  // Fetch comments for a product
  const fetchComments = async (productId: string) => {
    if (!userData?.id) {
      setComments([]);
      setCommentCounts(prev => ({ ...prev, [productId]: 0 }));
      return;
    }

    setCommentsLoading(true);
    const { data, error } = await supabase
      .from('comments')
      .select('*, users(name)')
      .eq('product_id', productId)
      .eq('user_id', userData.id)
      .order('created_at', { ascending: true });
    if (!error && data) {
      const mapped = data.map((c: any) => ({
        ...c,
        user_name: c.users?.name || 'User',
      }));
      const filtered = mapped.filter((c: any) => !blockedUserIds.includes(c.user_id));
      setComments(filtered);
      setCommentCounts(prev => ({ ...prev, [productId]: filtered.length }));
    }
    setCommentsLoading(false);
  };

  // Fetch comment counts for all products
  const fetchAllCommentCounts = async (productIds: string[]) => {
    if (productIds.length === 0) return;

    const baseCounts: { [productId: string]: number } = {};
    productIds.forEach(pid => {
      baseCounts[pid] = 0;
    });

    if (!userData?.id) {
      setCommentCounts(baseCounts);
      return;
    }

    const { data, error } = await supabase
      .from('comments')
      .select('product_id, id')
      .in('product_id', productIds)
      .eq('user_id', userData.id);
    if (!error && data) {
      const counts = { ...baseCounts };
      data.forEach((c: any) => {
        if (c.product_id && counts.hasOwnProperty(c.product_id)) {
          counts[c.product_id]++;
        }
      });
      setCommentCounts(counts);
    } else {
      setCommentCounts(baseCounts);
    }
  };

  // Subscribe to realtime comments
  const subscribeToComments = (productId: string) => {
    if (!userData?.id) return;
    if (commentsRealtimeSub) {
      supabase.removeChannel(commentsRealtimeSub);
    }
    const sub = supabase
      .channel('realtime:comments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `product_id=eq.${productId},user_id=eq.${userData.id}` },
        (payload) => {
          fetchComments(productId);
          // Update comment count for this product
          setCommentCounts(prev => ({
            ...prev,
            [productId]: Math.max(
              0,
              (prev[productId] || 0) +
              (payload.eventType === 'INSERT'
                ? 1
                : payload.eventType === 'DELETE'
                  ? -1
                  : 0)
            ),
          }));
        }
      )
      .subscribe();
    setCommentsRealtimeSub(sub);
  };

  // Open comments sheet
  const openComments = (productId: string) => {
    setCommentsProductId(productId);
    commentsSheetRef.current?.expand();
    fetchComments(productId);
    subscribeToComments(productId);
  };

  // Close comments sheet
  const closeComments = () => {
    commentsSheetRef.current?.close();
    setCommentsProductId(null);
    setComments([]);
    if (commentsRealtimeSub) {
      supabase.removeChannel(commentsRealtimeSub);
      setCommentsRealtimeSub(null);
    }
  };

  // Add new comment
  const handleAddComment = async () => {
    if (!userData?.id || !commentsProductId || !newComment?.trim()) return;
    // Simple profanity filter
    const banned = ['abuse', 'hate', 'violence', 'porn', 'nsfw'];
    const lowered = newComment.toLowerCase();
    if (banned.some(w => lowered.includes(w))) {
      Alert.alert('Content Not Allowed', 'Your comment contains objectionable content.');
      return;
    }
    const { data, error } = await supabase
      .from('comments')
      .insert({
        user_id: userData.id,
        product_id: commentsProductId,
        content: newComment.trim(),
      })
      .select('*, users(name)');
    if (!error && data && data.length > 0) {
      setNewComment('');
      setComments(prev => [
        ...prev,
        {
          ...data[0],
          user_name: data[0].users?.name || 'User',
          helpful_count: 0
        },
      ]);
      setCommentCounts(prev => ({
        ...prev,
        [commentsProductId]: (prev[commentsProductId] || 0) + 1
      }));
    }
  };

  const handleHelpful = async (commentId: string) => {
    // Optimistic updatte
    setComments(prev => prev.map(c =>
      c.id === commentId
        ? { ...c, helpful_count: (c.helpful_count || 0) + 1 }
        : c
    ));

    // In a real app, you would verify if user already liked it in DB
    // For now, simpler implementation: just increment in DB
    try {
      // Need a custom RPC or just update a field if RLS allows
      // Assuming there isn't actually a column yet, so catch error silently if fails
      // but UI remains updated for session
      /* 
      await supabase.rpc('increment_helpful', { comment_id: commentId });
      */
    } catch (e) {
      // ignore
    }
  };

  // Duplicate useEffect removed
  useEffect(() => {
    commentsRealtimeSubRef.current = commentsRealtimeSub;
  }, [commentsRealtimeSub]);

  // Show loading overlay only while data is loading
  const showLoadingOverlay = loading;

  // Only show error if we're done waiting and have an error
  if (hasError && !loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingContent}>
          <Ionicons name="cloud-offline-outline" size={64} color="#999" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>Failed to load trending products</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setHasError(false);
              fetchTrendingProducts();
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Only show empty state if we're done waiting and have no products
  if (products.length === 0 && !loading) {
    // Check if size filter is applied and show size interest UI
    const hasSizeFilter = selectedSizes.length > 0;

    if (hasSizeFilter) {
      // Show size interest modal instead of empty state
      return (
        <SafeAreaView style={styles.container}>
          {/* Back Button */}
          <TouchableOpacity
            style={styles.backButtonTopLeft}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back" size={32} color="#fff" style={styles.iconShadow} />
          </TouchableOpacity>

          <View style={styles.sizeInterestContainer}>
            <View style={styles.sizeInterestContent}>
              {/* Icon */}
              <View style={styles.sizeInterestIconContainer}>
                <Ionicons name="hourglass-outline" size={80} color="#F53F7A" />
              </View>

              {/* Title */}
              <Text style={styles.sizeInterestTitle}>Size Not Available, Coming Soon!</Text>

              {/* Description */}
              <Text style={styles.sizeInterestDescription}>
                We couldn't find any products in size <Text style={styles.sizeInterestHighlight}>{selectedSizes.join(', ')}</Text> right now.
              </Text>

              {/* Interest Poll */}
              <View style={styles.sizeInterestPollContainer}>
                <Text style={styles.sizeInterestPollQuestion}>
                  Are you interested in this size?
                </Text>

                <View style={styles.sizeInterestPollButtons}>
                  <TouchableOpacity
                    style={[styles.sizeInterestPollButton, styles.sizeInterestPollButtonInterested]}
                    onPress={() => {
                      Toast.show({
                        type: 'success',
                        text1: 'Thank you!',
                        text2: "We'll notify you when products in this size are available",
                        position: 'top',
                      });
                      // Clear all filters
                      handleClearAllFilters();
                      // Reset to show all products
                      setProducts(allProducts);
                      setCurrentIndex(0);
                      pagerRef.current?.setPage(0);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="heart" size={24} color="#fff" />
                    <Text style={styles.sizeInterestPollButtonText}>Yes, I'm Interested!</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.sizeInterestPollButton, styles.sizeInterestPollButtonNotInterested]}
                    onPress={() => {
                      // Clear all filters
                      handleClearAllFilters();
                      // Reset to show all products
                      setProducts(allProducts);
                      setCurrentIndex(0);
                      pagerRef.current?.setPage(0);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="close-circle-outline" size={24} color="#666" />
                    <Text style={[styles.sizeInterestPollButtonText, { color: '#666' }]}>Not Interested</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Additional Info */}
              <View style={styles.sizeInterestFooter}>
                <Text style={styles.sizeInterestFooterText}>
                  In the meantime, explore other sizes
                </Text>
              </View>
            </View>
          </View>
        </SafeAreaView>
      );
    }

    // Regular empty state for other cases
    return (
      <SafeAreaView style={styles.container}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backButtonTopLeft}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={32} color="#fff" style={styles.iconShadow} />
        </TouchableOpacity>

        {/* Debug Button */}
        <TouchableOpacity
          style={styles.debugButton}
          onPress={() => {
            setLoading(true);
            fetchTrendingProducts();
          }}
        >
          <Ionicons name="refresh" size={20} color="#fff" />
        </TouchableOpacity>

        <View style={styles.emptyContainer}>
          <Ionicons name="trending-up-outline" size={64} color="#999" />
          <Text style={styles.emptyTitle}>{t('no_trending_products_available')}</Text>
          <Text style={styles.emptySubtitle}>{t('check_back_later')}</Text>

          {/* Debug Info */}
          <View style={styles.debugInfo}>
            <Text style={styles.debugText}>Loading: {loading ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Has Error: {hasError ? 'Yes' : 'No'}</Text>
            <Text style={styles.debugText}>Products Count: {products.length}</Text>

          </View>

          {/* Retry Button */}
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setLoading(true);
              fetchTrendingProducts();
            }}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        <TrendingLoading visible={showLoadingOverlay} />
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

        {products.length > 0 && (
          <PagerView
            ref={pagerRef}
            style={styles.pagerView}
            orientation="vertical"
            onPageSelected={(e) => {
              const newIndex = e.nativeEvent.position;
              setCurrentIndex(newIndex);
              const product = products[newIndex];
              if (product) {
                setActiveVideo(product.id, newIndex);
              }
            }}
            initialPage={0}
            overdrag={false}
            scrollEnabled={true}
            pageMargin={0}
          >
            {products.map((product, index) => renderItem({ item: product, index }))}
          </PagerView>
        )}

        {/* Collab Action Sheet */}
        {selectedCollabProduct && (
          <CollabActionSheet
            sheetRef={collabSheetRef as any} // Cast to satisfy strict type if needed, or fix in component definition
            vendor={productVendors[selectedCollabProduct.id] || generateMockVendor(selectedCollabProduct)}
            influencer={productInfluencers[selectedCollabProduct.id]}
            isFollowingVendor={isFollowingVendorSafe(productVendors[selectedCollabProduct.id]?.id || '')}
            onFollowVendor={handleFollowVendor}
            onNavigateToProfile={handleNavigateToProfile}
            onClose={() => {
              collabSheetRef.current?.dismiss();
              setSelectedCollabProduct(null);
            }}
          />
        )}

        {showTryOnModal && tryOnProduct && (
          <View
            style={{
              ...StyleSheet.absoluteFillObject,
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.3)',
              zIndex: 9999,
            }}
          >
            <View style={styles.akoolModal}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => {
                  setShowTryOnModal(false);
                  setTryOnProduct(null);
                }}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.akoolTitle}>👗 Want to see how this outfit looks on you?</Text>
              <Text style={styles.akoolSubtitle}>Try on with Face Swap AI</Text>

              <View style={styles.tryOnInfoCard}>
                <View style={styles.tryOnInfoHeader}>
                  <Ionicons name="sparkles" size={20} color="#F53F7A" />
                  <Text style={styles.tryOnInfoTitle}>Photo Face Swap</Text>
                </View>
                <Text style={styles.tryOnInfoDesc}>
                  See how this outfit looks on you with AI-powered face swap
                </Text>
                {selectedTryOnSizeName && (
                  <Text style={styles.tryOnInfoDesc}>
                    Preview size: {selectedTryOnSizeName}
                  </Text>
                )}
                <View style={styles.tryOnInfoCost}>
                  <Ionicons name="diamond-outline" size={16} color="#F53F7A" />
                  <Text style={styles.tryOnInfoCostText}>50 coins</Text>
                </View>
              </View>

              <Text style={styles.akoolBalance}>
                {t('available_balance')}:{' '}
                <Text style={{ color: '#F53F7A', fontWeight: 'bold' }}>
                  {coinBalance} {t('coins')}
                </Text>
              </Text>
              <TouchableOpacity style={styles.akoolContinueBtn} onPress={handleStartFaceSwap}>
                <Text style={styles.akoolContinueText}>Start Face Swap</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <Modal
          visible={showConsentModal}
          transparent
          animationType="fade"
          onRequestClose={handleConsentCancel}
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
                  <Text style={styles.consentPointText}>I have the right to use this photo</Text>
                </View>
                <View style={styles.consentPoint}>
                  <View style={styles.consentBullet}>
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  </View>
                  <Text style={styles.consentPointText}>I consent to AI processing for face swap</Text>
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
        <ProfilePhotoRequiredModal
          visible={showProfilePhotoModal}
          title={profilePhotoModalTitle}
          description={profilePhotoModalContent.description}
          icon={profilePhotoModalContent.icon}
          dismissLabel="Maybe Later"
          uploadLabel="Upload Photo"
          onDismiss={() => {
            setShowProfilePhotoModal(false);
            setTryOnProduct(null);
            setSizeSelectionDraft(null);
          }}
          onUpload={() => {
            setShowProfilePhotoModal(false);
            setShowPhotoUploadSheet(true);
          }}
        />

        {/* Photo Upload Bottom Sheet Modal */}
        <Modal
          visible={showPhotoUploadSheet}
          transparent
          animationType="slide"
          onRequestClose={() => {
            if (!uploadingPhoto) {
              setShowPhotoUploadSheet(false);
              setTryOnProduct(null);
            }
          }}
        >
          <View style={styles.photoUploadOverlay}>
            <TouchableOpacity
              style={styles.photoUploadBackdrop}
              activeOpacity={1}
              onPress={() => {
                if (!uploadingPhoto) {
                  setShowPhotoUploadSheet(false);
                  setTryOnProduct(null);
                }
              }}
            />
            <View style={styles.photoUploadContent}>
              {/* Handle */}
              <View style={styles.photoUploadHandle} />

              {/* Header */}
              <View style={styles.photoUploadHeader}>
                <View style={styles.photoUploadIconContainer}>
                  <Ionicons name="camera" size={32} color="#F53F7A" />
                </View>
                <Text style={styles.photoUploadTitle}>Upload Profile Photo</Text>
                <Text style={styles.photoUploadSubtitle}>
                  Take or select a clear photo for Virtual Try-On
                </Text>
              </View>

              {/* Guidelines */}
              <View style={styles.photoUploadGuidelines}>
                <Text style={styles.photoUploadGuideTitle}>📸 Photo Tips</Text>
                <View style={styles.photoUploadGuideItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#F53F7A" />
                  <Text style={styles.photoUploadGuideText}>Clear, well-lit face photo</Text>
                </View>
                <View style={styles.photoUploadGuideItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#F53F7A" />
                  <Text style={styles.photoUploadGuideText}>Face forward, shoulders visible</Text>
                </View>
                <View style={styles.photoUploadGuideItem}>
                  <Ionicons name="checkmark-circle" size={16} color="#F53F7A" />
                  <Text style={styles.photoUploadGuideText}>Simple, neutral background</Text>
                </View>
              </View>

              {/* Options */}
              {uploadingPhoto ? (
                <View style={styles.photoUploadLoading}>
                  <ActivityIndicator size="large" color="#F53F7A" />
                  <Text style={styles.photoUploadLoadingText}>Uploading your photo...</Text>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    style={styles.photoUploadOption}
                    onPress={handleTakePhotoForUpload}
                    activeOpacity={0.7}
                  >
                    <View style={styles.photoUploadOptionIcon}>
                      <Ionicons name="camera" size={24} color="#fff" />
                    </View>
                    <View style={styles.photoUploadOptionText}>
                      <Text style={styles.photoUploadOptionTitle}>Take Photo</Text>
                      <Text style={styles.photoUploadOptionSubtitle}>Use camera to capture</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoUploadOption}
                    onPress={handlePickFromGalleryForUpload}
                    activeOpacity={0.7}
                  >
                    <View style={styles.photoUploadOptionIcon}>
                      <Ionicons name="images" size={24} color="#fff" />
                    </View>
                    <View style={styles.photoUploadOptionText}>
                      <Text style={styles.photoUploadOptionTitle}>Choose from Gallery</Text>
                      <Text style={styles.photoUploadOptionSubtitle}>Select from your library</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#ccc" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.photoUploadCancel}
                    onPress={() => {
                      setShowPhotoUploadSheet(false);
                      setTryOnProduct(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoUploadCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </Modal>

        <ProductDetailsBottomSheet
          visible={showProductDetailsSheet}
          product={productForDetails as any}
          onClose={() => setShowProductDetailsSheet(false)}
          onShowCollectionSheet={(product) => {
            setSelectedProduct(product);
            setShowCollectionSheet(true);
          }}
        />

        {/* Q&A Bottom Sheet */}
        <BottomSheet
          ref={commentsSheetRef}
          index={-1}
          snapPoints={snapPoints}
          enablePanDownToClose={true}
          onClose={closeComments}
          backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 18, borderTopRightRadius: 18 }}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}
          style={{ padding: 20, }}
        >
          <SafeAreaView
            style={[
              styles.commentsContent,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <View style={styles.commentsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="help-circle" size={24} color="#F53F7A" style={{ marginRight: 8 }} />
                <Text style={styles.commentsTitle}>Questions & Answers</Text>
              </View>
              <TouchableOpacity onPress={closeComments}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            {!userData?.id ? (
              <View style={styles.qaLoginPrompt}>
                <Ionicons name="lock-closed-outline" size={36} color="#F53F7A" style={{ marginBottom: 12 }} />
                <Text style={styles.qaLoginTitle}>Sign in to see your questions</Text>
                <Text style={styles.qaLoginSubtitle}>
                  Q&A is private to your account. Login to review or ask questions for this product.
                </Text>
                <TouchableOpacity style={styles.qaLoginButton} onPress={showLoginSheet} activeOpacity={0.85}>
                  <Text style={styles.qaLoginButtonText}>Login to Continue</Text>
                </TouchableOpacity>
              </View>
            ) : commentsLoading ? (
              <ActivityIndicator size="large" color="#F53F7A" style={{ marginTop: 32 }} />
            ) : comments.length === 0 ? (
              <View style={styles.noCommentsContainer}>
                <Ionicons name="help-circle-outline" size={48} color="#ccc" />
                <Text style={styles.noCommentsTitle}>No questions yet</Text>
                <Text style={styles.noCommentsSubtitle}>Be the first to ask about this product!</Text>
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.qaItem}>
                    <View style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                      <View style={{ width: '100%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                          <Ionicons name="person-circle" size={20} color="#666" style={{ marginRight: 6 }} />
                          <Text style={styles.commentUser}>{item.user_name || 'User'}</Text>
                          <Text style={styles.qaDate}> • {new Date(item.created_at).toLocaleDateString()}</Text>
                        </View>
                        <View style={styles.questionBubble}>
                          <Text style={styles.qaQuestion}>Q: {item.content}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', marginTop: 8, alignItems: 'center' }}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}
                          onPress={() => handleHelpful(item.id)}
                        >
                          <Ionicons name="thumbs-up-outline" size={16} color="#666" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 12, color: '#666', fontWeight: '600' }}>
                            {item.helpful_count || 0} Helpful
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={{ marginRight: 12 }}
                          onPress={async () => {
                            try {
                              await supabase.from('ugc_reports').insert({
                                reporter_id: userData?.id || null,
                                target_user_id: item.user_id,
                                product_id: commentsProductId,
                                comment_id: item.id,
                                reason: 'inappropriate',
                              });
                              Toast.show({ type: 'success', text1: 'Reported', text2: 'Thanks for keeping Only2U safe.' });
                            } catch { }
                          }}
                        >
                          <Ionicons name="flag-outline" size={16} color="#999" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={async () => {
                            if (!userData?.id) return;
                            try {
                              await supabase.from('blocked_users').insert({ user_id: userData.id, blocked_user_id: item.user_id });
                              setBlockedUserIds((prev) => [...prev, item.user_id]);
                              setComments((prev) => prev.filter((c) => c.user_id !== item.user_id));
                              Toast.show({ type: 'success', text1: 'User blocked' });
                            } catch { }
                          }}
                        >
                          <Ionicons name="ban-outline" size={16} color="#999" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                )}
                contentContainerStyle={{ paddingBottom: 16 }}
                style={{ flex: 1 }}
              />
            )}
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              keyboardVerticalOffset={10}
            >
              <View style={styles.commentInputBar}>
                <TextInput
                  style={styles.commentInput}
                  value={newComment}
                  onChangeText={setNewComment}
                  placeholder="Ask a question about this product..."
                  placeholderTextColor="#999"
                  multiline
                />
                <TouchableOpacity style={styles.sendCommentBtn} onPress={handleAddComment}>
                  <Ionicons name="send" size={24} color="#F53F7A" />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </BottomSheet>

        {/* Saved Popup */}
        {showSavedPopup && (
          <Animated.View
            style={[
              styles.savedPopup,
              {
                transform: [
                  {
                    translateY: popupAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [100, 0],
                    }),
                  },
                ],
                opacity: popupAnimation,
              },
            ]}
          >
            <View style={styles.savedPopupContent}>
              <View style={styles.savedPopupLeft}>
                <Image
                  source={{ uri: getFirstSafeProductImage(selectedProduct) }}
                  style={styles.savedPopupImage}
                />
              </View>
              <View style={styles.savedPopupText}>
                <Text style={styles.savedPopupTitle}>Saved!</Text>
                <Text style={styles.savedPopupSubtitle}>Saved to {savedProductName}</Text>
              </View>
              <TouchableOpacity
                style={styles.savedPopupViewButton}
                onPress={() => {
                  // Animate out when View button is pressed
                  Animated.timing(popupAnimation, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                  }).start(() => {
                    setShowSavedPopup(false);
                    (navigation as any).navigate('Home', { screen: 'Wishlist' });
                  });
                }}
              >
                <Text style={styles.savedPopupViewText}>View</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* UGC Actions Bottom Sheet */}
        <BottomSheet
          ref={ugcActionsSheetRef}
          index={-1}
          snapPoints={['40%', '50%']}
          enablePanDownToClose={true}
          backgroundStyle={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20 }}
          handleIndicatorStyle={{ backgroundColor: '#ccc' }}
        >
          <View style={styles.ugcActionsContainer}>
            <View style={styles.ugcActionsHeader}>
              <Text style={styles.ugcActionsTitle}>Actions</Text>
              <TouchableOpacity onPress={() => ugcActionsSheetRef.current?.close()}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            {/* Report */}
            <TouchableOpacity
              style={styles.ugcActionItem}
              onPress={async () => {
                try {
                  if (ugcActionProductId) {
                    await supabase.from('ugc_reports').insert({
                      reporter_id: userData?.id || null,
                      product_id: ugcActionProductId,
                      reason: 'inappropriate',
                    });
                    Toast.show({
                      type: 'success',
                      text1: 'Reported',
                      text2: 'Thanks for keeping Only2U safe.'
                    });
                    ugcActionsSheetRef.current?.close();
                  }
                } catch (error) {
                  Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to report' });
                }
              }}
            >
              <View style={styles.ugcActionIconContainer}>
                <Ionicons name="flag" size={22} color="#EF4444" />
              </View>
              <View style={styles.ugcActionTextContainer}>
                <Text style={styles.ugcActionTitle}>Report</Text>
                <Text style={styles.ugcActionSubtitle}>Report this content</Text>
              </View>
            </TouchableOpacity>

            {/* Not Interested */}
            <TouchableOpacity
              style={styles.ugcActionItem}
              onPress={() => {
                if (ugcActionProductId) {
                  Toast.show({
                    type: 'success',
                    text1: 'Noted',
                    text2: "We'll show you less like this"
                  });
                  ugcActionsSheetRef.current?.close();
                }
              }}
            >
              <View style={styles.ugcActionIconContainer}>
                <Ionicons name="eye-off" size={22} color="#6B7280" />
              </View>
              <View style={styles.ugcActionTextContainer}>
                <Text style={styles.ugcActionTitle}>Not Interested</Text>
                <Text style={styles.ugcActionSubtitle}>See fewer posts like this</Text>
              </View>
            </TouchableOpacity>

            {/* Block Vendor */}
            <TouchableOpacity
              style={styles.ugcActionItem}
              onPress={async () => {
                try {
                  const product = products.find(p => p.id === ugcActionProductId);
                  if (product && userData?.id) {
                    const vendor = productVendors[product.id];
                    const vendorName = product.vendor_name || product.alias_vendor || 'Unknown Vendor';

                    // Try to block by vendor user_id if available
                    if (vendor && vendor.user_id) {
                      // Check if already blocked by user_id
                      const { data: existing } = await supabase
                        .from('blocked_users')
                        .select('id')
                        .eq('user_id', userData.id)
                        .eq('blocked_user_id', vendor.user_id)
                        .single();

                      if (existing) {
                        Toast.show({
                          type: 'info',
                          text1: 'Already Blocked',
                          text2: 'This vendor is already blocked'
                        });
                        ugcActionsSheetRef.current?.close();
                        return;
                      }

                      // Insert block record with user_id
                      const blockPayload: any = {
                        user_id: userData.id,
                        blocked_user_id: vendor.user_id,
                        reason: 'Blocked from trending screen'
                      };
                      if (supportsVendorNameBlocking) {
                        blockPayload.blocked_vendor_name = vendorName;
                      }
                      const { error } = await supabase.from('blocked_users').insert(blockPayload);

                      if (error) {
                        console.error('Block error:', error);
                        throw error;
                      }

                      setBlockedUserIds([...blockedUserIds, vendor.user_id]);
                      if (supportsVendorNameBlocking) {
                        setBlockedVendorNames([...blockedVendorNames, vendorName]);
                      }
                    } else {
                      if (!supportsVendorNameBlocking) {
                        Toast.show({
                          type: 'info',
                          text1: 'Upgrade required',
                          text2: 'Vendor name blocking is not available in this build.',
                        });
                        return;
                      }
                      // Block by vendor name only
                      // Check if already blocked by vendor name
                      const { data: existing } = await supabase
                        .from('blocked_users')
                        .select('id')
                        .eq('user_id', userData.id)
                        .eq('blocked_vendor_name', vendorName)
                        .single();

                      if (existing) {
                        Toast.show({
                          type: 'info',
                          text1: 'Already Blocked',
                          text2: 'This vendor is already blocked'
                        });
                        ugcActionsSheetRef.current?.close();
                        return;
                      }

                      // Insert block record with vendor name
                      const { error } = await supabase.from('blocked_users').insert({
                        user_id: userData.id,
                        blocked_vendor_name: vendorName,
                        reason: 'Blocked from trending screen'
                      });

                      if (error) {
                        console.error('Block error:', error);
                        throw error;
                      }

                      setBlockedVendorNames([...blockedVendorNames, vendorName]);
                    }

                    Toast.show({
                      type: 'success',
                      text1: 'Blocked',
                      text2: `You won't see content from "${vendorName}"`
                    });
                    ugcActionsSheetRef.current?.close();
                  }
                } catch (error) {
                  console.error('Block vendor error:', error);
                  Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to block vendor' });
                }
              }}
            >
              <View style={styles.ugcActionIconContainer}>
                <Ionicons name="ban" size={22} color="#DC2626" />
              </View>
              <View style={styles.ugcActionTextContainer}>
                <Text style={styles.ugcActionTitle}>Block Vendor</Text>
                <Text style={styles.ugcActionSubtitle}>You won't see their products</Text>
              </View>
            </TouchableOpacity>

          </View>
        </BottomSheet>

        {/* Share Bottom Sheet */}
        <BottomSheet
          ref={shareSheetRef}
          index={-1}
          snapPoints={['35%']}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: '#fff' }}
          handleIndicatorStyle={{ backgroundColor: '#ddd', width: 40 }}
        >
          <View style={styles.shareContainer}>
            <View style={styles.shareHeader}>
              <Text style={styles.shareTitle}>Share Product</Text>
              <TouchableOpacity onPress={() => shareSheetRef.current?.close()}>
                <Ionicons name="close-circle" size={28} color="#999" />
              </TouchableOpacity>
            </View>

            <Text style={styles.shareSubtitle}>Share this amazing product with your friends!</Text>

            {/* Share Options */}
            <View style={styles.shareOptionsContainer}>
              {/* WhatsApp Button */}
              <TouchableOpacity
                style={styles.whatsappButton}
                activeOpacity={0.8}
                onPress={async () => {
                  try {
                    const product = products.find(p => p.id === ugcActionProductId);
                    if (product) {
                      const deepLink = `https://only2u.app/product/${product.id}`;
                      const shareMessage = `Check out this amazing product: ${product.name}\n\n${deepLink}`;
                      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(shareMessage)}`;

                      const canOpen = await Linking.canOpenURL(whatsappUrl);
                      if (canOpen) {
                        await Linking.openURL(whatsappUrl);
                      } else {
                        Toast.show({
                          type: 'error',
                          text1: 'WhatsApp not installed',
                          text2: 'Please install WhatsApp to share'
                        });
                      }
                      shareSheetRef.current?.close();
                    }
                  } catch (error) {
                    Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to share via WhatsApp' });
                  }
                }}
              >
                <View style={styles.whatsappIconContainer}>
                  <Ionicons name="logo-whatsapp" size={28} color="#fff" />
                </View>
                <View style={styles.shareButtonContent}>
                  <Text style={styles.shareButtonTitle}>Share on WhatsApp</Text>
                  <Text style={styles.shareButtonSubtitle}>Send to friends & groups</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#fff" />
              </TouchableOpacity>

            </View>
          </View>
        </BottomSheet>

        {/* SaveToCollectionSheet */}
        <SaveToCollectionSheet
          visible={showCollectionSheet}
          product={selectedProduct}
          onClose={() => {
            setShowCollectionSheet(false);
            setSelectedProduct(null);
          }}
          onSaved={(product: any, collectionName: string) => {
            // Don't show any popup - toast is shown immediately when heart is clicked
            // and collection sheet shows the added folders with checkmarks
          }}
        />
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
                {(tryOnProduct ? sortSizesAscending(extractProductSizes(tryOnProduct)) : []).map(
                  renderTryOnSizeOption
                )}
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

        {/* Filter Bottom Sheet */}
        <BottomSheetModal
          ref={filterSheetRef}
          snapPoints={['90%']}
          enablePanDownToClose
          backgroundStyle={{ backgroundColor: '#fff' }}
          handleIndicatorStyle={{ backgroundColor: '#ddd' }}
        >
          <View style={styles.filterContainer}>
            {/* Filter Header */}
            <View style={styles.filterHeader}>
              <Text style={styles.filterTitle}>Filters</Text>
              <TouchableOpacity onPress={handleClearAllFilters}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </TouchableOpacity>
            </View>

            {/* Two Column Layout */}
            <View style={styles.filterContent}>
              {/* Left Column - Filter Categories */}
              <View style={styles.filterLeftColumn}>
                <Text style={styles.filterCategoriesTitle}>Filters</Text>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {filterCategories.map((category) => (
                    <TouchableOpacity
                      key={category}
                      style={[
                        styles.filterCategoryItem,
                        activeFilterCategory === category && styles.filterCategoryItemActive
                      ]}
                      onPress={() => setActiveFilterCategory(category)}
                    >
                      <Text style={[
                        styles.filterCategoryText,
                        activeFilterCategory === category && styles.filterCategoryTextActive
                      ]}>
                        {category}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Right Column - Filter Options */}
              <ScrollView style={styles.filterRightColumn} showsVerticalScrollIndicator={false}>
                {/* Brand/Influencer Filter with Search */}
                {activeFilterCategory === 'Brand/Influencer' && (
                  <View style={styles.filterSection}>
                    {/* Search bar for brands with autocomplete */}
                    <View style={styles.brandSearchWrapper}>
                      <View style={styles.brandSearchContainer}>
                        <Ionicons name="search" size={18} color="#999" />
                        <TextInput
                          style={styles.brandSearchInput}
                          placeholder="Search brands or influencers..."
                          placeholderTextColor="#999"
                          value={brandSearchQuery}
                          onChangeText={(text) => {
                            setBrandSearchQuery(text);
                            setShowVendorSuggestions(text.trim().length > 0);
                          }}
                          onFocus={() => setShowVendorSuggestions(brandSearchQuery.trim().length > 0)}
                        />
                        {brandSearchQuery.length > 0 && (
                          <TouchableOpacity
                            onPress={() => {
                              setBrandSearchQuery('');
                              setShowVendorSuggestions(false);
                            }}
                          >
                            <Ionicons name="close-circle" size={18} color="#999" />
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Autocomplete Suggestions Dropdown */}
                      {showVendorSuggestions && vendorSuggestions.length > 0 && (
                        <View style={styles.suggestionsDropdown}>
                          <ScrollView
                            style={styles.suggestionsScrollView}
                            nestedScrollEnabled={true}
                            keyboardShouldPersistTaps="handled"
                          >
                            {vendorSuggestions.map((vendor, index) => (
                              <TouchableOpacity
                                key={vendor.id}
                                style={[
                                  styles.suggestionItem,
                                  index === vendorSuggestions.length - 1 && styles.suggestionItemLast
                                ]}
                                onPress={() => {
                                  toggleVendorSelection(vendor.id);
                                  setBrandSearchQuery('');
                                  setShowVendorSuggestions(false);
                                }}
                              >
                                <View style={styles.suggestionContent}>
                                  <Ionicons
                                    name={selectedVendorIds.includes(vendor.id) ? "checkmark-circle" : "business-outline"}
                                    size={20}
                                    color={selectedVendorIds.includes(vendor.id) ? '#F53F7A' : '#666'}
                                  />
                                  <View style={styles.suggestionTextContainer}>
                                    <Text style={styles.suggestionName}>
                                      {vendor.business_name}
                                    </Text>
                                  </View>
                                </View>
                                <Ionicons
                                  name="chevron-forward"
                                  size={16}
                                  color="#ccc"
                                />
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                    </View>

                    <Text style={styles.filterSectionTitle}>
                      All Vendors ({filteredVendors.length})
                    </Text>

                    {filteredVendors.length === 0 ? (
                      <View style={styles.emptyVendorsContainer}>
                        <Ionicons name="business-outline" size={40} color="#ccc" />
                        <Text style={styles.emptyVendorsText}>No vendors available</Text>
                        <Text style={styles.emptyVendorsSubtext}>Check console for details</Text>
                      </View>
                    ) : (
                      filteredVendors
                        .filter(vendor =>
                          !brandSearchQuery.trim() ||
                          vendor.business_name?.toLowerCase().includes(brandSearchQuery.toLowerCase())
                        )
                        .map((vendor) => (
                          <TouchableOpacity
                            key={vendor.id}
                            style={styles.filterOption}
                            onPress={() => toggleVendorSelection(vendor.id)}
                          >
                            <View style={styles.checkboxContainer}>
                              <Ionicons
                                name={selectedVendorIds.includes(vendor.id) ? 'checkmark-circle' : 'ellipse-outline'}
                                size={20}
                                color={selectedVendorIds.includes(vendor.id) ? '#F53F7A' : '#999'}
                              />
                            </View>
                            <Text style={styles.filterOptionText}>
                              {vendor.business_name}
                            </Text>
                          </TouchableOpacity>
                        ))
                    )}
                  </View>
                )}

                {/* Categories Filter */}
                {activeFilterCategory === 'Categories' && (
                  <View style={styles.filterSection}>
                    {filteredCategories.map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={styles.filterOption}
                        onPress={() => toggleCategorySelection(category.id)}
                      >
                        <View style={styles.checkboxContainer}>
                          <Ionicons
                            name={selectedCategories.includes(category.id) ? 'checkmark' : 'square-outline'}
                            size={20}
                            color={selectedCategories.includes(category.id) ? '#F53F7A' : '#999'}
                          />
                        </View>
                        <View style={styles.filterOptionTextContainer}>
                          <Text style={styles.filterOptionText}>{category.name}</Text>
                          {categoryProductCounts[category.id] !== undefined && (
                            <Text style={styles.filterOptionCount}>
                              ({categoryProductCounts[category.id]})
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Sizes Filter */}
                {activeFilterCategory === 'Sizes' && (
                  <View style={styles.filterSection}>
                    {filteredSizes.map((size) => (
                      <TouchableOpacity
                        key={size.id}
                        style={styles.filterOption}
                        onPress={() => toggleSizeSelection(size.name)}
                      >
                        <View style={styles.checkboxContainer}>
                          <Ionicons
                            name={selectedSizes.includes(size.name) ? 'checkmark' : 'square-outline'}
                            size={20}
                            color={selectedSizes.includes(size.name) ? '#F53F7A' : '#999'}
                          />
                        </View>
                        <View style={styles.filterOptionTextContainer}>
                          <Text style={styles.filterOptionText}>{size.name}</Text>
                          {sizeProductCounts[size.name] !== undefined && (
                            <Text style={styles.filterOptionCount}>
                              ({sizeProductCounts[size.name]})
                            </Text>
                          )}
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Price Range Filter */}
                {activeFilterCategory === 'Price Range' && (
                  <View style={styles.filterSection}>
                    <Text style={styles.filterSectionTitle}>Price Range</Text>
                    <View style={styles.priceInputContainer}>
                      <View style={styles.priceInputWrapper}>
                        <Text style={styles.priceInputLabel}>Min</Text>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="₹0"
                          keyboardType="numeric"
                          value={filterMinPrice}
                          onChangeText={setFilterMinPrice}
                        />
                      </View>
                      <Text style={styles.priceInputSeparator}>-</Text>
                      <View style={styles.priceInputWrapper}>
                        <Text style={styles.priceInputLabel}>Max</Text>
                        <TextInput
                          style={styles.priceInput}
                          placeholder="₹10000"
                          keyboardType="numeric"
                          value={filterMaxPrice}
                          onChangeText={setFilterMaxPrice}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Filter Footer - Action Buttons */}
            <View style={[styles.filterFooter, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}>
              <TouchableOpacity
                style={styles.filterCloseButton}
                onPress={() => filterSheetRef.current?.dismiss()}>
                <Text style={styles.filterCloseButtonText}>CLOSE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={handleApplyFilters}>
                <Text style={styles.filterApplyButtonText}>APPLY FILTERS</Text>
              </TouchableOpacity>
            </View>
          </View>
        </BottomSheetModal>

        {/* Filter Tutorial Overlay */}
        {showFilterTutorial && (
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}
            activeOpacity={1}
            onPress={() => setShowFilterTutorial(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)' }}>
              <Animated.View
                style={{
                  position: 'absolute',
                  top: insets.top - 4, // Adjusted to center 50px pulse over 42px button
                  right: 8, // Adjusted to center 50px pulse over 42px button
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 3,
                  borderColor: '#fff',
                  transform: [{ scale: filterTutorialPulse }],
                  zIndex: 2000,
                  shadowColor: '#fff',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.8,
                  shadowRadius: 10,
                  elevation: 10,
                }}
              />
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  top: insets.top + 54, // Positioned below the pulse
                  right: 20,
                  backgroundColor: '#fff',
                  padding: 16,
                  borderRadius: 12,
                  width: 260,
                  zIndex: 2000,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                {/* Arrow triangle */}
                <View
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: 20,
                    width: 0,
                    height: 0,
                    backgroundColor: 'transparent',
                    borderStyle: 'solid',
                    borderLeftWidth: 10,
                    borderRightWidth: 10,
                    borderBottomWidth: 10,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderBottomColor: '#fff',
                  }}
                />
                <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 8, color: '#333' }}>
                  Filter Videos
                </Text>
                <Text style={{ fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 16 }}>
                  Filter by Brand, Category, Size & Price to find exactly what fits you.
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => setDontShowAgain(!dontShowAgain)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={dontShowAgain ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={dontShowAgain ? '#F53F7A' : '#999'}
                    />
                    <Text style={{ color: '#666', fontSize: 13 }}>Don't show again</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handleTutorialDismiss}
                    style={{ backgroundColor: '#F53F7A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>GOT IT</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </BottomSheetModalProvider >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
  },
  sizeInterestContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  sizeInterestContent: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  sizeInterestIconContainer: {
    marginBottom: 24,
  },
  sizeInterestTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  sizeInterestDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  sizeInterestHighlight: {
    fontWeight: '700',
    color: '#F53F7A',
  },
  sizeInterestPollContainer: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
  },
  sizeInterestPollQuestion: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 26,
  },
  sizeInterestPollButtons: {
    gap: 12,
  },
  sizeInterestPollButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  sizeInterestPollButtonInterested: {
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  sizeInterestPollButtonNotInterested: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  sizeInterestPollButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  sizeInterestFooter: {
    alignItems: 'center',
  },
  sizeInterestFooterText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  pagerView: {
    flex: 1,
  },
  videoContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  videoBackground: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  videoLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10,
  },
  loadingSpinnerContainer: {
    backgroundColor: 'rgba(245, 63, 122, 0.2)',
    borderRadius: 50,
    padding: 20,
    marginBottom: 16,
  },
  videoLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 8,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  videoLoadingSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '400',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'transparent',
    // Simulate gradient from transparent to black
    opacity: 0.8,
  },
  doubleTapHeartContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    pointerEvents: 'none', // Allow taps to pass through
  },
  doubleTapHeart: {
    textShadowColor: 'rgba(245, 63, 122, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -100 },
    shadowOpacity: 1,
    shadowRadius: 100,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    zIndex: 100,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  topBarButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBarContainer: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  searchBarInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 16,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
  },
  rightActions: {
    position: 'absolute',
    right: 12,
    bottom: Platform.OS === 'android' ? 140 : 160,
    alignItems: 'center',
    gap: 18,
    zIndex: 50,
  },
  modernActionButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernActionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconCircleActive: {
    backgroundColor: 'rgba(245, 63, 122, 0.2)',
  },
  modernActionText: {
    color: '#fff',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  modernBottomContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingLeft: 16,
    paddingRight: 88,
    paddingTop: 20,
  },
  modernVendorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modernVendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  modernVendorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: '#fff',
    marginRight: 10,
  },
  compactVendorAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
    borderWidth: 1.5,
  },
  modernVendorTextCol: {
    flex: 1,
    marginRight: 12,
  },
  modernVendorHandle: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.3,
  },
  modernVendorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    flexShrink: 1,
    flexGrow: 1,
    flexWrap: 'wrap',
  },
  compactVendorName: {
    fontSize: 13,
    marginTop: 0,
    lineHeight: 18,
  },
  modernProductName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '400',
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    opacity: 0.9,
  },
  modernFollowButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 6,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  modernFollowingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  modernFollowText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  vendorNameFollowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'nowrap',
    flex: 1,
  },
  compactFollowButton: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#F53F7A',
  },
  compactFollowingButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  compactFollowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modernPriceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modernPriceGroup: {
    flex: 1,
  },
  priceAndRatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  modernPrice: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    letterSpacing: 0.5,
  },
  modernDiscountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  modernOriginalPrice: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 14,
    textDecorationLine: 'line-through',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernDiscountBadge: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  modernDiscountText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  modernRatingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  modernRatingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernReviewsText: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  modernActionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  modernTryOnButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 5,
  },
  modernTryOnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  modernShopButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 28,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  modernShopText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '35%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  actionButton: {
    alignItems: 'center',
    marginVertical: 16,
  },
  actionText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  bottomContent: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 60 : 120,
    left: 16,
    right: 80,
  },
  productInfo: {
    marginBottom: 16,
  },
  titleRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    marginBottom: 8,
  },
  productTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    // flex: 1,
    marginRight: 12,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 4,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  price: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  originalPrice: {
    color: '#ccc',
    fontSize: 14,
    textDecorationLine: 'line-through',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  discount: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  tryOnButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  tryOnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  shopNowButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  shopNowText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  thumbnailsRow: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  thumbnailWrapper: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  selectedThumbnailWrapper: {
    borderColor: '#F53F7A',
  },
  thumbnail: {
    width: 40,
    height: 40,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  playPauseButtonTop: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 20,
  },
  muteButtonTop: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 20,
  },
  iconShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  akoolModal: {
    width: 340,
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
    marginBottom: 16,
  },
  consentTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111827',
    marginBottom: 16,
  },
  consentContent: {
    gap: 12,
    marginBottom: 20,
  },
  consentPoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  consentBullet: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  consentPointText: {
    flex: 1,
    fontSize: 15,
    color: '#1F2933',
    lineHeight: 20,
  },
  consentButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  consentCancelButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    alignItems: 'center',
  },
  consentCancelText: {
    color: '#1F2933',
    fontSize: 15,
    fontWeight: '600',
  },
  consentAgreeButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: '#F53F7A',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  consentAgreeText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  backButtonTopLeft: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  muteButton: {
    position: 'absolute',
    top: 80,
    right: 26,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  previewScrollContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    zIndex: 1000,
    maxWidth: 200,
  },
  previewScrollContent: {
    paddingVertical: 8,
  },
  previewItem: {
    marginBottom: 8,
    alignItems: 'center',
  },
  previewImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  previewLabel: {
    marginTop: 2,
    color: '#fff',
    fontSize: 7,
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  selectedPreviewItem: {
    borderColor: '#F53F7A',
    borderWidth: 3,
    borderRadius: 8,
  },
  imageLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  imageLoadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  // backButtonBox: {
  //   position: 'absolute',
  //   top: 16,
  //   left: 16,
  //   backgroundColor: 'rgba(0,0,0,0.7)',
  //   borderRadius: 24,
  //   padding: 8,
  //   zIndex: 30,
  //   shadowColor: '#000',
  //   shadowOpacity: 0.25,
  //   shadowRadius: 8,
  //   shadowOffset: { width: 0, height: 2 },
  //   elevation: 8,
  // },
  wishlistIcon: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 20,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  faceSwapProcessingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  faceSwapProcessingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  commentIcon: {
    position: 'absolute',
    top: 24,
    right: 70,
    zIndex: 20,
    padding: 8,
  },
  commentsSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    minHeight: 320,
    maxHeight: '70%',
  },
  commentsContent: {
    flex: 1,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  commentsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  qaLoginPrompt: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  qaLoginTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  qaLoginSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  qaLoginButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 12,
  },
  qaLoginButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  noCommentsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  noCommentsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noCommentsSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  commentItem: {
    marginBottom: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 10,
  },
  qaItem: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  questionBubble: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#F53F7A',
  },
  qaQuestion: {
    color: '#222',
    fontSize: 15,
    lineHeight: 22,
  },
  qaDate: {
    color: '#999',
    fontSize: 12,
  },
  commentUser: {
    fontWeight: '600',
    color: '#F53F7A',
    fontSize: 14,
  },
  commentContent: {
    color: '#222',
    fontSize: 15,
    marginBottom: 2,
  },
  commentDate: {
    color: '#888',
    fontSize: 11,
    textAlign: 'right',
  },
  commentInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 8,
    marginBottom: 45
    // marginTop: 8,
  },
  commentInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 80,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#222',
  },
  sendCommentBtn: {
    marginLeft: 8,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stockIndicator: {
    backgroundColor: '#FF3B30',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    marginTop: 4,
  },
  lowStockIndicator: {
    backgroundColor: 'rgba(255,59,48,0.9)',
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  lowStockText: {
    color: '#fff',
  },
  savedPopup: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    zIndex: 1000,
  },
  savedPopupContent: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
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
    color: '#333',
    marginBottom: 2,
  },
  savedPopupSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  savedPopupViewButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  savedPopupViewText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Skeleton Loading Styles
  skeletonContainer: {
    flex: 1,
    width: '100%',
  },
  skeletonVideoContainer: {
    width: width,
    height: height,
    position: 'relative',
  },
  skeletonVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#e0e0e0',
  },
  skeletonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  skeletonBackButton: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e0e0e0',
  },
  skeletonRightActions: {
    position: 'absolute',
    right: 16,
    bottom: '8%',
    alignItems: 'center',
  },
  skeletonActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
  skeletonBottomContent: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 80,
  },
  skeletonTitle: {
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 8,
    width: '80%',
  },
  skeletonPrice: {
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    marginBottom: 16,
    width: '40%',
  },
  skeletonButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonButton: {
    height: 44,
    backgroundColor: '#e0e0e0',
    borderRadius: 22,
    flex: 1,
  },
  // Error State Styles
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugButton: {
    position: 'absolute',
    top: 24,
    right: 80,
    zIndex: 30,
    backgroundColor: 'rgba(69, 67, 67, 0.7)',
    borderRadius: 24,
    padding: 8,
  },
  loadMoreContainer: {
    width: width,
    height: height,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadMoreText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  debugInfo: {
    marginTop: 20,
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 8,
    marginHorizontal: 20,
  },
  debugText: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 4,
    textAlign: 'center',
  },
  // UGC Actions Bottom Sheet Styles
  ugcActionsContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  ugcActionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  ugcActionsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },
  ugcActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  ugcActionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  ugcActionTextContainer: {
    flex: 1,
  },
  ugcActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  ugcActionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  // Share Options Row Styles
  // New Share Sheet Styles
  shareContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shareTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
  },
  shareSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
    lineHeight: 20,
  },
  shareOptionsContainer: {
    marginTop: 24,
    gap: 16,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  whatsappIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  shareButtonContent: {
    flex: 1,
  },
  shareButtonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  shareButtonSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  // Vendor styles
  vendorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  vendorProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vendorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  vendorAvatarSmall: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#666',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)'
  },
  vendorHeaderTap: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 10,
  },
  vendorHeaderHandle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorHeaderTextCol: {
    marginLeft: 10,
    maxWidth: width * 0.5,
  },
  vendorHeaderProduct: {
    color: '#eee',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  minimalFollowButton: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.25)',
    marginLeft: 12,
  },
  vendorDetails: {
    flex: 1,
  },
  vendorNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vendorHandleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vendorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  vendorFollowers: {
    color: '#ccc',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  vendorUsername: {
    color: '#ddd',
    fontSize: 12,
    marginTop: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // duplicate removed: minimalFollowButton now defined above
  minimalFollowingButton: {
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  minimalFollowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  minimalFollowingText: {
    color: '#fff',
  },
  followButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 80,
    alignItems: 'center',
  },
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  followButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  followingButtonText: {
    color: '#fff',
  },
  // Filter styles
  filterContainer: {
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
    borderBottomColor: '#e0e0e0',
  },
  filterTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  clearAllText: {
    fontSize: 14,
    color: '#F53F7A',
    fontWeight: '600',
  },
  filterContent: {
    flex: 1,
    flexDirection: 'row',
  },
  filterLeftColumn: {
    width: '35%',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    paddingVertical: 16,
  },
  filterCategoriesTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterCategoryItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  filterCategoryItemActive: {
    backgroundColor: '#FFF5F8',
    borderLeftWidth: 3,
    borderLeftColor: '#F53F7A',
  },
  filterCategoryText: {
    fontSize: 14,
    color: '#666',
  },
  filterCategoryTextActive: {
    fontSize: 14,
    color: '#F53F7A',
    fontWeight: '600',
  },
  filterRightColumn: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  filterSection: {
    marginBottom: 16,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  brandSearchWrapper: {
    marginBottom: 16,
  },
  brandSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  brandSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  // Autocomplete Suggestions Styles
  suggestionsDropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 200,
    overflow: 'hidden',
  },
  suggestionsScrollView: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  suggestionTextContainer: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
    marginBottom: 2,
  },
  suggestionSubtext: {
    fontSize: 12,
    color: '#999',
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  filterOptionTextContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterOptionText: {
    fontSize: 14,
    color: '#666',
  },
  filterOptionCount: {
    fontSize: 13,
    color: '#999',
    fontWeight: '500',
  },
  emptyVendorsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyVendorsText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#999',
    marginTop: 12,
  },
  emptyVendorsSubtext: {
    fontSize: 13,
    color: '#bbb',
    marginTop: 4,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceInputWrapper: {
    flex: 1,
  },
  priceInputLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  priceInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  priceInputSeparator: {
    fontSize: 16,
    color: '#999',
    marginTop: 20,
  },
  filterFooter: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 12,
  },
  filterCloseButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F53F7A',
    alignItems: 'center',
  },
  filterCloseButtonText: {
    color: '#F53F7A',
    fontSize: 14,
    fontWeight: '600',
  },
  filterApplyButton: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  filterApplyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  // Photo Upload Modal Styles
  photoUploadOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  photoUploadBackdrop: {
    flex: 1,
  },
  photoUploadContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 30,
  },
  photoUploadHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#F53F7A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  photoUploadHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  photoUploadIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(245, 63, 122, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  photoUploadTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  photoUploadSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  photoUploadGuidelines: {
    backgroundColor: 'rgba(245, 63, 122, 0.05)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  photoUploadGuideTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  photoUploadGuideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  photoUploadGuideText: {
    fontSize: 13,
    color: '#444',
  },
  photoUploadLoading: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  photoUploadLoadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#666',
  },
  photoUploadOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  photoUploadOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F53F7A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  photoUploadOptionText: {
    flex: 1,
  },
  photoUploadOptionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  photoUploadOptionSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  photoUploadCancel: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  photoUploadCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F53F7A',
  },
});

export default TrendingScreen;
