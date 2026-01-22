import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Animated,
  Platform,
  RefreshControl,
  Alert,
  Modal,
  Dimensions,
  Linking,
  Share,
  StyleProp,
  ViewStyle,
  BackHandler,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { supabase } from '~/utils/supabase';
import { useWishlist } from '~/contexts/WishlistContext';
import { useUser } from '~/contexts/UserContext';
import { useNotifications } from '~/contexts/NotificationsContext';
import { getFirstSafeImageUrl, getProductImages, getFirstSafeProductImage } from '../utils/imageUtils';
import type { Product, Category } from '~/types/product';
import { Only2ULogo } from '../components/common';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import BottomSheet, { BottomSheetScrollView, BottomSheetModal, BottomSheetBackdrop, BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import Toast from 'react-native-toast-message';
import { LinearGradient } from 'expo-linear-gradient';

import NewYearSpecials from '~/components/Dashboard/NewYearSpecials';
import DashboardLoader from '~/components/DashboardLoader';

type DashboardNavigationProp = StackNavigationProp<RootStackParamList>;

const HEADER_HEIGHT = 64;

interface Address {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at?: string;
}

interface FeatureSection {
  id: string;
  section_type: 'best_seller' | 'trending' | 'categories';
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const Dashboard = () => {
  const navigation = useNavigation<DashboardNavigationProp>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [trendingProducts, setTrendingProducts] = useState<Product[]>([]);
  const [bestSellerProducts, setBestSellerProducts] = useState<Product[]>([]);
  const [categoryProducts, setCategoryProducts] = useState<{ [categoryId: string]: Product[] }>({});
  const [featureSections, setFeatureSections] = useState<FeatureSection[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const { wishlist, unreadCount: wishlistUnreadCount } = useWishlist();
  const { unreadCount: notificationUnreadCount } = useNotifications();
  const { userData, updateUserData } = useUser();
  const [searchText, setSearchText] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const searchBarAnim = useRef(new Animated.Value(0)).current; // 0: header, 1: search bar
  const scrollY = useRef(new Animated.Value(0)).current;
  const [langMenuVisible, setLangMenuVisible] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [addressSheetVisible, setAddressSheetVisible] = useState(false);
  const addressSheetRef = useRef<BottomSheet>(null);
  const [productRatings, setProductRatings] = useState<{ [productId: string]: { rating: number; reviews: number } }>({});

  const [pincode, setPincode] = useState('');
  const [checkingPincode, setCheckingPincode] = useState(false);
  const [pincodeAvailable, setPincodeAvailable] = useState<boolean | null>(null);
  const shimmerAnimation = useRef(new Animated.Value(0)).current;
  const [showCoinsModal, setShowCoinsModal] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');

  // Search suggestions state
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Filter States
  const filterSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['85%'], []);
  const [activeFilterCategory, setActiveFilterCategory] = useState<string>('Category');
  const [activeBrandInfluencerTab, setActiveBrandInfluencerTab] = useState<'brands' | 'influencers'>('brands');
  const [brands, setBrands] = useState<any[]>([]);
  const [influencers, setInfluencers] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);

  // Selection States
  // distinct from 'categories' data used for display sections
  const [selectedFilterCategories, setSelectedFilterCategories] = useState<string[]>([]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [selectedInfluencers, setSelectedInfluencers] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [filterMinPrice, setFilterMinPrice] = useState<string>('');
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>('');
  const [selectedRating, setSelectedRating] = useState<number | null>(null);

  // Search in filters
  const [vendorSearchQuery, setVendorSearchQuery] = useState('');
  const [influencerSearchQuery, setInfluencerSearchQuery] = useState('');

  // Filtered lists for UI
  const filteredVendors = useMemo(() => {
    if (!vendorSearchQuery.trim()) return brands;
    return brands.filter(vendor =>
      (vendor.store_name || vendor.vendor_name || '').toLowerCase().includes(vendorSearchQuery.toLowerCase())
    );
  }, [brands, vendorSearchQuery]);

  const filteredInfluencers = useMemo(() => {
    if (!influencerSearchQuery.trim()) return influencers;
    return influencers.filter(influencer =>
      (influencer.name || '').toLowerCase().includes(influencerSearchQuery.toLowerCase())
    );
  }, [influencers, influencerSearchQuery]);

  // Generate referral code
  const generateReferralCode = useCallback(() => {
    if (!userData?.id) return '';
    const namePart = (userData?.name || 'ONLY2U')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'ONLY2U';
    const idPart = userData.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    return `${namePart}${idPart}`;
  }, [userData?.id, userData?.name]);

  // Load referral code when modal opens
  useEffect(() => {
    if (showCoinsModal && userData?.id) {
      const code = generateReferralCode();
      setReferralCode(code);
    }
  }, [showCoinsModal, userData?.id, generateReferralCode]);

  // Share referral on WhatsApp
  const handleShareReferral = async () => {
    if (!referralCode) {
      Toast.show({
        type: 'info',
        text1: 'Generating Code',
        text2: 'Please wait while we prepare your referral code.',
      });
      return;
    }

    const message = `🎉 Download Only2U app and get 100 coins worth of rewards!\n\nUse my referral code: ${referralCode}\n\n📱 Download Links:\n• Android: https://play.google.com/store/apps/details?id=com.only2u.only2u\n• iOS: https://apps.apple.com/in/app/only2u-virtual-try-on-store/id6753112805\n\nJoin me and start shopping with amazing rewards! 🛍️✨`;
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const whatsappWebUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

    try {
      await Linking.openURL(whatsappUrl);
    } catch {
      try {
        await Linking.openURL(whatsappWebUrl);
      } catch {
        await Share.share({ message });
      }
    }
  };

  // Welcome animations
  const [showWelcomeAnimation, setShowWelcomeAnimation] = useState(false);
  const welcomeOpacity = useRef(new Animated.Value(0)).current;
  const welcomeScale = useRef(new Animated.Value(0.3)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-100)).current;
  const floatingElements = useRef([...Array(12)].map(() => ({
    translateY: new Animated.Value(0),
    translateX: new Animated.Value(0),
    opacity: new Animated.Value(0),
    rotate: new Animated.Value(0),
    scale: new Animated.Value(1),
  }))).current;
  const logoGlow = useRef(new Animated.Value(0)).current;
  const shimmerPosition = useRef(new Animated.Value(-1)).current;
  const rippleScale = useRef(new Animated.Value(0)).current;
  const rippleOpacity = useRef(new Animated.Value(0)).current;
  const gradientAnimation = useRef(new Animated.Value(0)).current;

  // Cache for data
  const [lastFetchTime, setLastFetchTime] = useState<number>(0);
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

  // Cache keys
  const CACHE_KEYS = {
    CATEGORIES: 'dashboard_categories',
    TRENDING_PRODUCTS: 'dashboard_trending_products',
    BEST_SELLER_PRODUCTS: 'dashboard_best_seller_products',
    CATEGORY_PRODUCTS: 'dashboard_category_products',
    LAST_FETCH_TIME: 'dashboard_last_fetch_time',
    PRODUCT_RATINGS: 'dashboard_product_ratings',
  };

  useEffect(() => {
    loadDashboardData();
    // Attempt to capture GPS and city on first mount
    captureLocationIfMissing();
    // Load user addresses
    if (userData?.id) {
      fetchAddresses();
    }

    // Fallback: turn off loading after 10 seconds to prevent infinite loading
    const timeout = setTimeout(() => {
      if (isInitialLoading) {
        setIsInitialLoading(false);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [userData?.id]);

  // Refresh addresses when the screen regains focus (e.g., after AddAddress)
  useFocusEffect(
    useCallback(() => {
      if (userData?.id) fetchAddresses();
    }, [userData?.id])
  );

  // Handle hardware back button when category filter is active
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedFilterCategories.length > 0) {
        // Clear category filter and return to normal view
        setSelectedFilterCategories([]);
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    });

    return () => backHandler.remove();
  }, [selectedFilterCategories]);

  // Also refresh when address bottom sheet is opened
  useEffect(() => {
    if (addressSheetVisible && userData?.id) {
      fetchAddresses();
    }
  }, [addressSheetVisible, userData?.id]);

  // Realtime: refresh addresses when user updates Address Book
  useEffect(() => {
    if (!userData?.id) return;

    const channel = supabase
      .channel(`user_addresses_${userData.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_addresses',
          filter: `user_id=eq.${userData.id}`,
        },
        () => {
          // Re-fetch addresses so the bottom sheet reflects latest state
          fetchAddresses();
        }
      )
      .subscribe();

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch { }
    };
  }, [userData?.id]);

  // Welcome animation effect - runs once on first load
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenWelcome = await AsyncStorage.getItem('dashboard_welcome_seen');
        if (!hasSeenWelcome) {
          setShowWelcomeAnimation(true);
          await AsyncStorage.setItem('dashboard_welcome_seen', 'true');
          startWelcomeAnimation();
        } else {
          // Start quick entrance animation
          startQuickEntranceAnimation();
        }
      } catch (error) {
        console.log('Error checking welcome status:', error);
        startQuickEntranceAnimation();
      }
    };

    checkFirstLaunch();
  }, []);

  // Clear search on tab press (Home tab)
  useEffect(() => {
    const parentNav = navigation.getParent();
    if (!parentNav) return;

    const unsubscribe = parentNav.addListener('tabPress', (e) => {
      // Clear search text when Home tab is pressed
      setSearchText('');
      // Optional: Scroll to top logic could go here if needed, 
      // but clearing search usually resets the view enough for this requirement.
    });

    return unsubscribe;
  }, [navigation]);

  // Welcome animation sequence
  const startWelcomeAnimation = () => {
    // Gradient background animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(gradientAnimation, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: false,
        }),
        Animated.timing(gradientAnimation, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // First: Show welcome splash with ripple effect
    Animated.parallel([
      Animated.timing(welcomeOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(welcomeScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Ripple effect
    Animated.sequence([
      Animated.delay(200),
      Animated.parallel([
        Animated.timing(rippleScale, {
          toValue: 3,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(rippleOpacity, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Pulsing glow effect on logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();

    // Shimmer effect
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPosition, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.delay(500),
        Animated.timing(shimmerPosition, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Enhanced floating elements with more movement
    floatingElements.forEach((element, index) => {
      const isEven = index % 2 === 0;
      const moveDistance = 30 + (index % 4) * 10;
      const horizontalMove = isEven ? 15 : -15;

      Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(element.translateY, {
              toValue: -moveDistance,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
            Animated.timing(element.translateX, {
              toValue: horizontalMove,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
            Animated.timing(element.rotate, {
              toValue: isEven ? 1 : -1,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(element.scale, {
                toValue: 1.2,
                duration: 1000 + (index * 75),
                useNativeDriver: true,
              }),
              Animated.timing(element.scale, {
                toValue: 1,
                duration: 1000 + (index * 75),
                useNativeDriver: true,
              }),
            ]),
          ]),
          Animated.parallel([
            Animated.timing(element.translateY, {
              toValue: 0,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
            Animated.timing(element.translateX, {
              toValue: 0,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
            Animated.timing(element.rotate, {
              toValue: 0,
              duration: 2000 + (index * 150),
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();

      // Staggered fade in for floating elements
      Animated.timing(element.opacity, {
        toValue: index < 6 ? 0.7 : 0.4, // Vary opacity for depth
        duration: 500,
        delay: 100 + (index * 80),
        useNativeDriver: true,
      }).start();
    });

    // After 2.5 seconds, hide welcome and show content
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(welcomeOpacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(headerSlide, {
          toValue: 0,
          tension: 40,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowWelcomeAnimation(false);
        // Fade out floating elements
        floatingElements.forEach((element) => {
          Animated.timing(element.opacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start();
        });
      });
    }, 2500);
  };

  // Quick entrance animation for returning users
  const startQuickEntranceAnimation = () => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(headerSlide, {
        toValue: 0,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  };

  // Fetch user addresses
  const fetchAddresses = async () => {
    if (!userData?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', userData.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching addresses:', error);
        return;
      }

      const list = data || [];

      // Normalize: ensure at most one default
      const defaults = list.filter((a: Address) => a.is_default);
      if (defaults.length > 1) {
        // Keep the most recently created as default; unset others
        const keep = defaults[0];
        const unsetIds = defaults.slice(1).map((a: Address) => a.id);
        try {
          if (unsetIds.length) {
            await supabase.from('user_addresses').update({ is_default: false }).in('id', unsetIds);
          }
        } catch (e) {
          console.log('Normalize defaults failed:', e);
        }
        // Reflect in UI
        const normalized = list.map((a: Address) => ({ ...a, is_default: a.id === keep.id }));
        setAddresses(normalized);
      } else {
        setAddresses(list);
      }
      const defaultAddr = (list || []).find((addr: Address) => addr.is_default);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
      } else if (data && data.length > 0) {
        setSelectedAddress(data[0]);
      }
    } catch (error) {
      console.error('Error in fetchAddresses:', error);
    }
  };

  // Handle address selection
  const handleAddressSelect = async (address: Address) => {
    setSelectedAddress(address);
    // Persist selection as default so other parts of app stay consistent
    try {
      if (userData?.id) {
        await supabase.from('user_addresses').update({ is_default: false }).eq('user_id', userData.id);
        await supabase.from('user_addresses').update({ is_default: true }).eq('id', address.id);
      }
    } catch (e) {
      console.log('Failed to set default address:', e);
    }
    setAddressSheetVisible(false);
    addressSheetRef.current?.close();
  };

  // Check pincode availability
  const handleCheckPincode = async () => {
    if (!pincode || pincode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Pincode',
        text2: 'Please enter a valid 6-digit pincode',
      });
      return;
    }

    setCheckingPincode(true);
    try {
      // Simulated pincode check - in production, call your logistics API
      // For now, we'll accept most pincodes but reject some for demo
      await new Promise(resolve => setTimeout(resolve, 1000));

      const unavailablePincodes = ['000000', '111111', '999999'];
      const isAvailable = !unavailablePincodes.includes(pincode);

      setPincodeAvailable(isAvailable);

      if (isAvailable) {
        Toast.show({
          type: 'success',
          text1: 'Delivery Available! ✓',
          text2: `We deliver to pincode ${pincode}`,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Not Serviceable',
          text2: `Sorry, we don't deliver to pincode ${pincode} yet`,
        });
      }
    } catch (error) {
      console.error('Error checking pincode:', error);
      Toast.show({
        type: 'error',
        text1: 'Check Failed',
        text2: 'Could not verify pincode availability',
      });
    } finally {
      setCheckingPincode(false);
    }
  };

  const captureLocationIfMissing = async () => {
    try {
      // Only attempt if user is logged in and we don't have a location saved
      if (!userData || !userData.id || (userData.location && userData.location.trim() !== '')) return;

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return; // silently skip if denied
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const geocode = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
      const first = geocode && geocode.length > 0 ? geocode[0] : null;
      const city = first?.city || first?.subregion || first?.region || '';
      if (city && userData?.id) {
        // Update local context (and DB)
        await updateUserData({ location: city }, true);
        // Also persist minimal field to Supabase directly in case mapping differs
        await supabase.from('users').update({ location: city }).eq('id', userData.id);
      }
    } catch (err) {
      // ignore errors; do not block dashboard
    }
  };


  // Load cached data from AsyncStorage
  const loadCachedData = async () => {
    try {
      const [
        cachedCategories,
        cachedTrendingProducts,
        cachedBestSellerProducts,
        cachedCategoryProducts,
        cachedLastFetchTime,
        cachedProductRatings,
      ] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEYS.CATEGORIES),
        AsyncStorage.getItem(CACHE_KEYS.TRENDING_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.BEST_SELLER_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.CATEGORY_PRODUCTS),
        AsyncStorage.getItem(CACHE_KEYS.LAST_FETCH_TIME),
        AsyncStorage.getItem(CACHE_KEYS.PRODUCT_RATINGS),
      ]);

      if (cachedCategories) setCategories(JSON.parse(cachedCategories));
      if (cachedTrendingProducts) setTrendingProducts(JSON.parse(cachedTrendingProducts));
      if (cachedBestSellerProducts) setBestSellerProducts(JSON.parse(cachedBestSellerProducts));
      if (cachedCategoryProducts) setCategoryProducts(JSON.parse(cachedCategoryProducts));
      if (cachedLastFetchTime) setLastFetchTime(JSON.parse(cachedLastFetchTime));
      if (cachedProductRatings) setProductRatings(JSON.parse(cachedProductRatings));

      const hasCachedData = !!(cachedCategories && cachedTrendingProducts);
      const lastFetchTime = cachedLastFetchTime ? JSON.parse(cachedLastFetchTime) : 0;

      return {
        hasCachedData,
        lastFetchTime,
      };
    } catch (error) {
      console.error('Error loading cached data:', error);
      return { hasCachedData: false, lastFetchTime: 0 };
    }
  };

  // Save data to AsyncStorage
  const saveDataToCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.setItem(CACHE_KEYS.CATEGORIES, JSON.stringify(categories)),
        AsyncStorage.setItem(CACHE_KEYS.TRENDING_PRODUCTS, JSON.stringify(trendingProducts)),
        AsyncStorage.setItem(CACHE_KEYS.BEST_SELLER_PRODUCTS, JSON.stringify(bestSellerProducts)),
        AsyncStorage.setItem(CACHE_KEYS.CATEGORY_PRODUCTS, JSON.stringify(categoryProducts)),
        AsyncStorage.setItem(CACHE_KEYS.LAST_FETCH_TIME, JSON.stringify(lastFetchTime)),
        AsyncStorage.setItem(CACHE_KEYS.PRODUCT_RATINGS, JSON.stringify(productRatings)),
      ]);
    } catch (error) {
      console.error('Error saving data to cache:', error);
    }
  };

  // Clear all cached data
  const clearCache = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(CACHE_KEYS.CATEGORIES),
        AsyncStorage.removeItem(CACHE_KEYS.TRENDING_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.BEST_SELLER_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.CATEGORY_PRODUCTS),
        AsyncStorage.removeItem(CACHE_KEYS.LAST_FETCH_TIME),
        AsyncStorage.removeItem(CACHE_KEYS.PRODUCT_RATINGS),
      ]);
      setLastFetchTime(0);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  };

  const handleDebugReload = async () => {
    await clearCache();
    setIsInitialLoading(true);
    setHasError(false);
    setErrorMessage('');
    loadDashboardData();
  };

  // Unified data loading function with persistent caching
  const loadDashboardData = async (forceRefresh = false) => {
    const now = Date.now();

    if (!forceRefresh) {
      // Try to load cached data first
      const { hasCachedData, lastFetchTime: cachedLastFetchTime } = await loadCachedData();
      const shouldUseCache = hasCachedData && (now - cachedLastFetchTime) < CACHE_DURATION;

      if (shouldUseCache) {
        setIsInitialLoading(false); // Make sure loading is turned off
        return;
      }
    }

    if (forceRefresh) {
      // setIsRefreshing(true);
      // Show custom loader even on refresh as per user request
      setIsInitialLoading(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      setHasError(false);
      setErrorMessage('');

      // Fetch all data in parallel
      // Fetch all data in parallel, but handle dependencies
      await Promise.all([
        fetchFeatureSections(),
        fetchFeaturedProducts(),
        // Chain categories and their products together
        (async () => {
          const fetchedCategories = await fetchCategories();
          if (fetchedCategories && fetchedCategories.length > 0) {
            await fetchCategoryProducts(fetchedCategories);
          }
        })()
      ]);

      setLastFetchTime(now);

      // Save to cache after a short delay to ensure state is updated
      setTimeout(() => {
        saveDataToCache();
      }, 100);

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setHasError(true);
      setErrorMessage('Failed to load dashboard data. Please try again.');
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  };

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

      // Save updated ratings to cache
      setTimeout(() => {
        AsyncStorage.setItem(CACHE_KEYS.PRODUCT_RATINGS, JSON.stringify({ ...productRatings, ...ratings }));
      }, 100);
    } catch (error) {
      console.error('Error fetching product ratings:', error);
    }
  };

  // Removed automatic fetching of category products on categories change to prevent double loading/blinking
  // useEffect(() => {
  //   if (categories.length > 0) {
  //     fetchCategoryProducts();
  //   }
  // }, [categories]);

  // Shimmer animation effect
  useEffect(() => {
    const animation = Animated.loop(
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
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnimation]);

  const fetchFeatureSections = async () => {
    try {
      const { data, error } = await supabase
        .from('feature_sections')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error fetching feature sections:', error);
        return;
      }

      setFeatureSections(data || []);
    } catch (error) {
      console.error('Error fetching feature sections:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true, nullsFirst: false });

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      setCategories(data || []);
      return data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      // Fetch trending products
      const { data: trendingData, error: trendingError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          category_id,
          category:categories(name),
          image_urls,
          video_urls,
          is_active,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          sku,
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
            size:sizes(name)
          )
        `)
        .eq('featured_type', 'trending')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (trendingError) {
        console.error('Error fetching trending products:', trendingError);
      } else {
        // Fix: category comes as array, map to object and get images from variants
        const fixedTrendingData = (trendingData || []).map((item: any) => ({
          ...item,
          image_urls: getProductImages(item),
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: item.product_variants || [],
        }));
        setTrendingProducts(fixedTrendingData);

        // Fetch ratings for trending products
        const trendingProductIds = fixedTrendingData.map(product => product.id);
        await fetchProductRatings(trendingProductIds);
      }

      // Fetch best seller products
      const { data: bestSellerData, error: bestSellerError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          category_id,
          category:categories(name),
          image_urls,
          video_urls,
          is_active,
          featured_type,
          like_count,
          return_policy,
          vendor_name,
          alias_vendor,
          sku,
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
            size:sizes(name)
          )
        `)
        .eq('featured_type', 'best_seller')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (bestSellerError) {
        console.error('Error fetching best seller products:', bestSellerError);
      } else {
        // Fix: category comes as array, map to object and get images from variants
        const fixedBestSellerData = (bestSellerData || []).map((item: any) => ({
          ...item,
          image_urls: getProductImages(item),
          category: Array.isArray(item.category) ? item.category[0] : item.category,
          variants: item.product_variants || [],
        }));
        setBestSellerProducts(fixedBestSellerData);

        // Fetch ratings for best seller products
        const bestSellerProductIds = fixedBestSellerData.map(product => product.id);
        await fetchProductRatings(bestSellerProductIds);
      }
    } catch (error) {
      console.error('Error fetching featured products:', error);
    }
  };

  const fetchCategoryProducts = async (currentCategories: Category[] = categories) => {
    try {
      // Fetch products for each category
      const categoryProductsData: { [categoryId: string]: Product[] } = {};

      for (const category of currentCategories) {
        try {
          const { data, error } = await supabase
            .from('products')
            .select(`
              id,
              name,
              description,
              category_id,
              category:categories(name),
              image_urls,
              video_urls,
              is_active,
              featured_type,
              like_count,
              return_policy,
              vendor_name,
              alias_vendor,
              sku,
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
                size:sizes(name)
              )
            `)
            .eq('category_id', category.id)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(6); // Limit to 6 products per category

          if (error) {
            console.error(`Error fetching products for category ${category.name}:`, error);
            categoryProductsData[category.id] = [];
          } else {
            // Fix: category comes as array, map to object and get images from variants
            const fixedData = (data || []).map((item: any) => ({
              ...item,
              image_urls: getProductImages(item),
              category: Array.isArray(item.category) ? item.category[0] : item.category,
              variants: item.product_variants || [],
            }));
            categoryProductsData[category.id] = fixedData;

            // Fetch ratings for category products
            const categoryProductIds = fixedData.map(product => product.id);
            await fetchProductRatings(categoryProductIds);
          }
        } catch (error) {
          console.error(`Error fetching products for category ${category.name}:`, error);
          categoryProductsData[category.id] = [];
        }
      }

      setCategoryProducts(categoryProductsData);
    } catch (error) {
      console.error('Error fetching category products:', error);
    }
  };



  // Helper functions moved outside component
  const getUserPrice = (product: Product, userSize?: string) => {
    if (!product.variants || product.variants.length === 0) return 0;

    if (userSize) {
      const userSizeVariant = product.variants.find(v => v.size?.name === userSize);
      if (userSizeVariant) return userSizeVariant.price;
    }

    const sortedVariants = [...product.variants].sort((a, b) => a.price - b.price);
    return sortedVariants[0]?.price || 0;
  };

  const getDiscountPercentage = (product: Product) => {
    if (!product.variants || product.variants.length === 0) return 0;
    return Math.max(...product.variants.map(v => v.discount_percentage || 0));
  };

  const getOriginalPrice = (product: Product, userSize?: string) => {
    const userPrice = getUserPrice(product, userSize);
    const discountPercentage = getDiscountPercentage(product);
    if (discountPercentage > 0) {
      return userPrice / (1 - discountPercentage / 100);
    }
    return userPrice;
  };

  // Memoized ProductCard Component
  const ProductCard = React.memo(({
    product,
    ratingData,
    userSize,
    onPress,
    shimmerAnimation,
    style,
  }: {
    product: Product;
    ratingData?: { rating: number; reviews: number };
    userSize?: string;
    onPress: (product: Product) => void;
    shimmerAnimation: Animated.Value;
    style?: StyleProp<ViewStyle>;
  }) => {
    const [imageLoadingState, setImageLoadingState] = useState<'loading' | 'loaded' | 'error'>('loading');

    const discountPercentage = getDiscountPercentage(product);
    const userPrice = getUserPrice(product, userSize);
    const originalPrice = getOriginalPrice(product, userSize);

    return (
      <TouchableOpacity
        style={[styles.productCard, style]}
        onPress={() => onPress(product)}
        activeOpacity={0.7}
      >
        {product.featured_type && (
          <View style={[
            styles.featuredBadge,
            { backgroundColor: product.featured_type === 'trending' ? '#FF9800' : '#4CAF50' }
          ]}>
          </View>
        )}

        {imageLoadingState !== 'loaded' && imageLoadingState !== 'error' && (
          <View style={[styles.productImage, styles.imageSkeleton, { position: 'absolute', zIndex: 1 }]}>
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
          </View>
        )}

        {imageLoadingState === 'error' ? (
          <View style={[styles.productImage, styles.imageSkeleton]}>
            <Ionicons name="image-outline" size={24} color="#ccc" />
          </View>
        ) : (
          <Image
            source={{ uri: getFirstSafeProductImage(product) }}
            style={styles.productImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
            onLoadEnd={() => setImageLoadingState('loaded')}
            onError={() => setImageLoadingState('error')}
          />
        )}

        <Text style={styles.brandName} numberOfLines={1}>
          {product.name}
        </Text>

        <View style={styles.priceContainer}>
          <View style={styles.priceInfo}>
            {discountPercentage > 0 && (
              <Text style={styles.originalPrice}>₹{originalPrice.toFixed(0)}</Text>
            )}
            <Text style={styles.price}>₹{userPrice.toFixed(0)}</Text>
          </View>
          <View style={styles.discountAndRatingRow}>
            {discountPercentage > 0 && (
              <Text style={styles.discountPercentage}>{discountPercentage.toFixed(0)}% OFF</Text>
            )}
            <View style={styles.reviewsContainer}>
              <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
              <Text style={styles.reviews}>{ratingData?.rating?.toFixed(1) || '0.0'}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  });

  const handleProductPress = useCallback((product: Product) => {
    const userPrice = getUserPrice(product, userData?.size);
    const hasDiscount = product.variants?.some(v => v.discount_percentage && v.discount_percentage > 0) || false;
    const originalPrice = hasDiscount ? userPrice / (1 - (Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0])) / 100)) : userPrice;
    const discountedPrice = userPrice;

    // Calculate total stock
    const totalStock = product.variants?.reduce((sum, variant) => sum + (variant.quantity || 0), 0) || product.stock_quantity || 0;

    const productForDetails = {
      id: product.id,
      name: product.name,
      price: discountedPrice,
      originalPrice: hasDiscount ? originalPrice : undefined,
      discount: Math.max(...(product.variants?.map(v => v.discount_percentage || 0) || [0])),
      rating: productRatings[product.id]?.rating || 0,
      reviews: productRatings[product.id]?.reviews || 0,
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
    navigation.replace('ProductDetails', { product: productForDetails });
  }, [navigation, userData?.size, productRatings]);

  // Fetch search suggestions from database
  const fetchSearchSuggestions = useCallback(async (query: string) => {
    if (!query.trim() || query.trim().length < 2) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          mrp_price,
          rsp_price,
          discount_percentage,
          image_urls,
          vendor_name,
          product_variants (
            id,
            mrp_price,
            rsp_price,
            discount_percentage,
            image_urls,
            size:sizes(name)
          )
        `)
        .ilike('name', `%${query.trim()}%`)
        .eq('is_active', true)
        .limit(8);

      if (error) {
        console.error('Error fetching suggestions:', error);
        setSearchSuggestions([]);
      } else {
        console.log('🔍 Search suggestions fetched:', data?.length || 0, 'results');
        setSearchSuggestions(data || []);
        setShowSuggestions(true);
        console.log('🔍 showSuggestions set to true');
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      setSearchSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  // Fetch Filter Data
  const fetchBrands = async () => {
    try {
      const { data, error } = await supabase.from('vendors').select('*').order('business_name', { ascending: true });
      if (!error && data) {
        console.log('✅ Fetched Brands:', data.length);
        setBrands(data);
      } else if (error) {
        console.error('❌ Error fetching brands:', error);
      }
    } catch (error) { console.error('Error fetching brands catch:', error); }
  };

  const fetchInfluencers = async () => {
    try {
      const { data, error } = await supabase.from('influencer_profiles').select('*').order('name', { ascending: true });
      if (!error && data) {
        console.log('✅ Fetched Influencers:', data.length);
        setInfluencers(data);
      } else if (error) {
        console.error('❌ Error fetching influencers:', error);
      }
    } catch (error) { console.error('Error fetching influencers catch:', error); }
  };

  const fetchSizes = async () => {
    try {
      const { data, error } = await supabase.from('sizes').select('*');
      if (!error && data) {
        console.log('✅ Fetched Sizes:', data.length);
        // Sort sizes manually if needed, or rely on order
        // Use the custom sort logic from Products.tsx for better UX
        const sizeOrder: { [key: string]: number } = {
          'XS': 1, 'S': 2, 'M': 3, 'L': 4, 'XL': 5, 'XXL': 6, '2XL': 6, '3XL': 7, 'XXXL': 7, '4XL': 8, '5XL': 9, 'Free Size': 10
        };
        const sortedSizes = [...data].sort((a, b) => {
          const aOrder = sizeOrder[a.name?.toUpperCase()] || 999;
          const bOrder = sizeOrder[b.name?.toUpperCase()] || 999;
          if (aOrder !== 999 && bOrder !== 999) return aOrder - bOrder;
          return a.name?.localeCompare(b.name || '');
        });
        setSizes(sortedSizes);
      } else if (error) {
        console.error('❌ Error fetching sizes:', error);
      }
    } catch (error) { console.error('Error fetching sizes catch:', error); }
  };

  useEffect(() => {
    fetchBrands();
    fetchInfluencers();
    fetchSizes();
  }, []);

  // Filter Handlers
  const toggleCategorySelection = (id: string) => {
    setSelectedFilterCategories(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleBrandSelection = (id: string) => {
    setSelectedBrands(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleInfluencerSelection = (id: string) => {
    setSelectedInfluencers(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const toggleSizeSelection = (id: string) => {
    setSelectedSizes(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
  };

  const handleResetFilters = () => {
    setSelectedFilterCategories([]);
    setSelectedBrands([]);
    setSelectedInfluencers([]);
    setSelectedSizes([]);
    setFilterMinPrice('');
    setFilterMaxPrice('');
    setSelectedRating(null);
  };

  const handleApplyFilters = () => {
    filterSheetRef.current?.dismiss();
    // Re-render will happen automatically as getAllSearchResults depends on filter states (to be updated)
  };

  const filterCategories = ['Category', 'Brand/Influencer', 'Size', 'Price Range'];
  const hasActiveFilters = (category: string) => {
    switch (category) {
      case 'Category': return selectedFilterCategories.length > 0;
      case 'Brand/Influencer': return selectedBrands.length > 0 || selectedInfluencers.length > 0;
      case 'Size': return selectedSizes.length > 0;
      case 'Price Range': return !!filterMinPrice || !!filterMaxPrice;
      default: return false;
    }
  };

  const handleClearAllFilters = () => handleResetFilters();

  // Handle search text change with debounce
  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text);

    // Clear previous debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (!text.trim()) {
      setSearchSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Debounce the suggestion fetch
    searchDebounceRef.current = setTimeout(() => {
      fetchSearchSuggestions(text);
    }, 300);
  }, [fetchSearchSuggestions]);

  // Handle suggestion selection
  const handleSuggestionSelect = useCallback((product: any) => {
    setShowSuggestions(false);
    setSearchText('');

    // Navigate to product details
    const productForDetails = {
      id: product.id,
      name: product.name,
      price: product.rsp_price || product.mrp_price || 0,
      mrp_price: product.mrp_price || 0,
      rsp_price: product.rsp_price || 0,
      discount_percentage: product.discount_percentage || 0,
      image: product.image_urls?.[0] || '',
      vendor_name: product.vendor_name || '',
    };
    navigation.replace('ProductDetails', { product: productForDetails });
  }, [navigation]);

  // Helper function to check if product matches search (by name, SKU, or variant SKU)
  const productMatchesSearch = (product: any) => {
    const isFiltering = selectedFilterCategories.length > 0 || selectedBrands.length > 0 || selectedInfluencers.length > 0 || selectedSizes.length > 0 || filterMinPrice || filterMaxPrice || selectedRating !== null;

    // Text Search
    let matchesText = true;
    if (searchText.trim()) {
      const searchLower = searchText.toLowerCase().trim();
      matchesText = product.name?.toLowerCase().includes(searchLower) ||
        product.sku?.toLowerCase().includes(searchLower) ||
        product.variants?.some((v: any) => v.sku?.toLowerCase().includes(searchLower));
    }

    if (!matchesText) return false;

    // Filter Logic
    if (selectedFilterCategories.length > 0) {
      if (!selectedFilterCategories.includes(product.category_id)) return false;
    }

    if (selectedBrands.length > 0) {
      const selectedBrandNames = brands.filter(b => selectedBrands.includes(b.id)).map(b => (b.store_name || b.vendor_name || '').toLowerCase());
      const productVendor = (product.vendor_name || product.alias_vendor || '').toLowerCase();
      if (!selectedBrandNames.includes(productVendor)) return false;
    }

    if (selectedSizes.length > 0) {
      const selectedSizeNames = sizes.filter(s => selectedSizes.includes(s.id)).map(s => s.name);
      const hasSize = product.variants?.some((v: any) => {
        const sName = v.size?.name || v.size_name;
        return selectedSizeNames.includes(sName);
      });
      if (!hasSize) return false;
    }

    if (filterMinPrice || filterMaxPrice) {
      const price = getUserPrice(product);
      if (filterMinPrice && price < parseFloat(filterMinPrice)) return false;
      if (filterMaxPrice && price > parseFloat(filterMaxPrice)) return false;
    }

    if (selectedRating !== null) {
      const reviews = product.product_reviews || product.reviews || [];
      const avg = calculateAverageRating(reviews);
      if (avg < selectedRating) return false;
    }

    return true;
  };

  // Get all search results (combine all products when searching)
  const getAllSearchResults = () => {
    const isFiltering = selectedFilterCategories.length > 0 || selectedBrands.length > 0 || selectedInfluencers.length > 0 || selectedSizes.length > 0 || filterMinPrice || filterMaxPrice || selectedRating !== null;

    if (!searchText.trim() && !isFiltering) return [];

    const allProducts = [
      ...trendingProducts,
      ...bestSellerProducts,
      ...Object.values(categoryProducts).flat(),
    ];

    // Remove duplicates by id
    const uniqueProducts = Array.from(
      new Map(allProducts.map(item => [item.id, item])).values()
    );

    return uniqueProducts.filter(productMatchesSearch);
  };

  // Check if user is actively searching
  const isSearching = searchText.trim().length > 0;
  const searchResults = getAllSearchResults();

  // Check if category filter is actively applied (for grid view mode)
  const isFilteringCategory = selectedFilterCategories.length > 0;

  // Get filtered products for grid view when category filter is applied
  const getFilteredProductsForGrid = () => {
    if (!isFilteringCategory) return [];

    const allProducts = [
      ...trendingProducts,
      ...bestSellerProducts,
      ...Object.values(categoryProducts).flat(),
    ];

    // Remove duplicates by id
    const uniqueProducts = Array.from(
      new Map(allProducts.map(item => [item.id, item])).values()
    );

    return uniqueProducts.filter(productMatchesSearch);
  };

  const filteredGridProducts = getFilteredProductsForGrid();

  // Get selected category name for header
  const getSelectedCategoryName = () => {
    if (selectedFilterCategories.length === 0) return '';
    const category = categories.find(c => selectedFilterCategories.includes(c.id));
    if (selectedFilterCategories.length === 1) {
      return category?.name || 'Filtered Products';
    }
    return `${selectedFilterCategories.length} Categories Selected`;
  };

  // Filtered products (for individual sections when not searching)
  const filteredTrendingProducts = trendingProducts.filter(productMatchesSearch);
  const filteredBestSellerProducts = bestSellerProducts.filter(productMatchesSearch);

  // Filtered category products
  const getFilteredCategoryProducts = (categoryId: string) => {
    const products = categoryProducts[categoryId] || [];
    return products.filter(productMatchesSearch);
  };

  // Scroll handler to show/hide search bar
  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: false,
      listener: (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        if (y > 20 && !showSearchBar) {
          setShowSearchBar(true);
          Animated.timing(searchBarAnim, {
            toValue: 1,
            duration: 250,
            useNativeDriver: false,
          }).start();
        } else if (y <= 20 && showSearchBar) {
          setShowSearchBar(false);
          Animated.timing(searchBarAnim, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
          }).start();
        }
      },
    }
  );

  const renderCategorySection = (category: Category) => {
    const products = getFilteredCategoryProducts(category.id);

    return (
      <View key={category.id} style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{category.name}</Text>
          <TouchableOpacity
            style={styles.seeMoreButton}
            onPress={() => navigation.navigate('Products', { category })}
          >
            <Text style={styles.seeMoreText}>See More</Text>
            <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
          </TouchableOpacity>
        </View>
        {products.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="shirt-outline" size={48} color="#999" />
            <Text style={styles.emptyText}>No products available.</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                ratingData={productRatings[product.id]}
                userSize={userData?.size}
                onPress={handleProductPress}
                shimmerAnimation={shimmerAnimation}
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  // Search Product Card (Grid Style)
  const SearchProductCard = ({ product, onPress }: { product: Product; onPress: (product: Product) => void }) => {
    const ratingData = productRatings[product.id] ?? { rating: 0, reviews: 0 };
    const vendorName = product.vendor_name || product.alias_vendor || 'Only2U';
    const userPrice = getUserPrice(product, userData?.size);
    const originalPrice = getOriginalPrice(product, userData?.size);
    const discount = getDiscountPercentage(product);

    return (
      <TouchableOpacity onPress={() => onPress(product)} style={styles.verticalCard} activeOpacity={0.9}>
        <View style={styles.verticalImageContainer}>
          <Image source={{ uri: getFirstSafeProductImage(product) }} style={styles.verticalImage} />

          {/* Best Seller / Trending Badge */}
          {product.featured_type && (
            <View style={[styles.verticalBadge, { backgroundColor: product.featured_type === 'best_seller' ? '#4CAF50' : '#FF9800' }]}>
              <Text style={styles.verticalBadgeText}>
                {product.featured_type === 'best_seller' ? 'Best Seller' : 'Trending'}
              </Text>
            </View>
          )}

          {/* Wishlist Heart Icon */}
          <TouchableOpacity style={styles.verticalWishlistButton}>
            <Ionicons name="heart-outline" size={20} color="#666" />
          </TouchableOpacity>

          {/* Rating Badge (Bottom Right) */}
          <View style={styles.ratingBadgeOverlay}>
            <View style={styles.ratingBadgeOnImage}>
              <Ionicons name="star" size={12} color="#FFD600" />
              <Text style={styles.ratingBadgeValue}>{ratingData.rating.toFixed(1)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.verticalDetails}>
          <Text style={styles.verticalVendorText} numberOfLines={1}>{vendorName}</Text>
          <Text style={styles.verticalProductName} numberOfLines={1}>{product.name}</Text>

          <View style={styles.verticalPriceRow}>
            {discount > 0 && (
              <Text style={styles.verticalOriginalPrice}>₹{originalPrice.toFixed(0)}</Text>
            )}
            <Text style={styles.verticalPrice}>₹{userPrice.toFixed(0)}</Text>
            {discount > 0 && (
              <View style={styles.verticalDiscountBadge}>
                <Text style={styles.verticalDiscountText}>{discount.toFixed(0)}% OFF</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Render Categories Section
  const renderCategoriesSection = () => (
    <View style={styles.sectionContainer}>
      {categories.length === 0 && !isInitialLoading ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="folder-open-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>No categories available.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScrollView}>
          {categories.map((category) => (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => navigation.navigate('Products', { category })}
            >
              <Image
                source={{
                  uri: category.image_url || 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=300&h=200&fit=crop'
                }}
                style={styles.categoryImage}
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
              <Text style={styles.categoryTitle}>{category.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render Trending Section
  const renderTrendingSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Trending Now</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => navigation.navigate('Products', {
            category: {
              id: 'trending',
              name: 'Trending Products',
              description: 'Trending products',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            featuredType: 'trending'
          })}
        >
          <Text style={styles.seeMoreText}>See More</Text>
          <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
        </TouchableOpacity>
      </View>
      {filteredTrendingProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="trending-up-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>No trending products available.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
          {filteredTrendingProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              ratingData={productRatings[product.id]}
              userSize={userData?.size}
              onPress={handleProductPress}
              shimmerAnimation={shimmerAnimation}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render Best Sellers Section
  const renderBestSellersSection = () => (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Best Sellers</Text>
        <TouchableOpacity
          style={styles.seeMoreButton}
          onPress={() => navigation.navigate('Products', {
            category: {
              id: 'best_sellers',
              name: 'Best Sellers',
              description: 'Best selling products',
              is_active: true,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            featuredType: 'best_seller'
          })}
        >
          <Text style={styles.seeMoreText}>See More</Text>
          <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
        </TouchableOpacity>
      </View>
      {filteredBestSellerProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="star-outline" size={48} color="#999" />
          <Text style={styles.emptyText}>No best sellers available.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScrollView}>
          {filteredBestSellerProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              ratingData={productRatings[product.id]}
              userSize={userData?.size}
              onPress={handleProductPress}
              shimmerAnimation={shimmerAnimation}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );

  // Render section based on type
  const renderSectionByType = (section: FeatureSection) => {
    switch (section.section_type) {
      case 'categories':
        return renderCategoriesSection();
      case 'trending':
        return renderTrendingSection();
      case 'best_seller':
        return renderBestSellersSection();
      default:
        return null;
    }
  };

  // Render Search Results
  const renderSearchResults = () => (
    <View style={styles.searchResultsContainer}>
      <View style={styles.searchResultsHeader}>
        <Text style={styles.searchResultsTitle}>
          {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found for "{searchText}"
        </Text>
      </View>

      {searchResults.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="search-outline" size={64} color="#ccc" />
          <Text style={styles.noResultsTitle}>No products found</Text>
          <Text style={styles.noResultsText}>
            Try searching with a different keyword or SKU
          </Text>
        </View>
      ) : (
        <View style={styles.searchResultsGrid}>
          {searchResults.map((product) => (
            <View key={product.id} style={styles.searchResultCard}>
              <SearchProductCard
                product={product}
                onPress={handleProductPress}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // Render category filter grid view
  const renderCategoryFilterGrid = () => (
    <View style={styles.categoryFilterContainer}>
      {/* Category Filter Header */}
      <View style={styles.categoryFilterHeader}>
        <TouchableOpacity
          style={styles.categoryFilterBackButton}
          onPress={() => {
            // Clear category filter and return to normal view
            setSelectedFilterCategories([]);
            handleResetFilters();
          }}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.categoryFilterTitle}>{getSelectedCategoryName()}</Text>
        <TouchableOpacity
          style={styles.categoryFilterButton}
          onPress={() => filterSheetRef.current?.present()}
        >
          <Ionicons name="options-outline" size={24} color="#F53F7A" />
        </TouchableOpacity>
      </View>

      {/* Products Count */}
      <View style={styles.categoryFilterCountRow}>
        <Text style={styles.categoryFilterCountText}>{filteredGridProducts.length} products found</Text>
      </View>

      {/* Products Grid - Edge to edge, no gaps */}
      {filteredGridProducts.length === 0 ? (
        <View style={styles.noResultsContainer}>
          <Ionicons name="shirt-outline" size={64} color="#ccc" />
          <Text style={styles.noResultsTitle}>No products found</Text>
          <Text style={styles.noResultsText}>
            Try selecting a different category
          </Text>
        </View>
      ) : (
        <View style={styles.categoryFilterGrid}>
          {filteredGridProducts.map((product) => (
            <View key={product.id} style={styles.categoryFilterCard}>
              <SearchProductCard
                product={product}
                onPress={handleProductPress}
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  const renderSearchBar = () => (
    <View style={styles.searchBarContainer}>
      <Ionicons name="search-outline" size={20} color="#888" style={{ marginRight: 8 }} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search Product"
        placeholderTextColor="#888"
        value={searchText}
        onChangeText={handleSearchChange}
        returnKeyType="search"
        autoFocus={false}
      />
      <TouchableOpacity style={styles.micButton} onPress={() => {
        Alert.alert(
          'Voice Search',
          'Voice search feature is coming soon! For now, you can use the text search above.',
          [{ text: 'OK', style: 'default' }]
        );
      }}>
        <Ionicons name="mic-outline" size={20} color="#F53F7A" />
      </TouchableOpacity>
    </View>
  );

  return (
    <BottomSheetModalProvider>
      <View style={styles.container}>
        {/* Search Suggestions Overlay - Rendered at root level to prevent clipping */}
        {showSuggestions && searchSuggestions.length > 0 && (
          <View style={styles.suggestionsOverlay}>
            <TouchableOpacity
              style={styles.suggestionsBackdrop}
              activeOpacity={1}
              onPress={() => setShowSuggestions(false)}
            />
            <View style={styles.suggestionsDropdown}>
              <ScrollView
                style={{ maxHeight: 350 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {searchSuggestions.map((rawProduct, index) => {
                  // Map the raw product data to match the expected Product structure for helpers
                  const product = {
                    ...rawProduct,
                    variants: rawProduct.product_variants?.map((v: any) => ({
                      ...v,
                      price: v.rsp_price // Map rsp_price to price for getUserPrice
                    })) || []
                  };

                  const userPrice = getUserPrice(product);
                  const originalPrice = getOriginalPrice(product);
                  const discountPercentage = getDiscountPercentage(product);

                  return (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.suggestionItem,
                        index === searchSuggestions.length - 1 && { borderBottomWidth: 0 }
                      ]}
                      onPress={() => handleSuggestionSelect(product)}
                      activeOpacity={0.7}
                    >
                      <Image
                        source={{ uri: getFirstSafeProductImage(product) }}
                        style={styles.suggestionImage}
                        contentFit="cover"
                        transition={200}
                      />
                      <View style={styles.suggestionInfo}>
                        <Text style={styles.suggestionName} numberOfLines={1}>
                          {product.name}
                        </Text>
                        <View style={styles.suggestionPriceRow}>
                          <Text style={styles.suggestionPrice}>
                            ₹{userPrice.toFixed(0)}
                          </Text>
                          {discountPercentage > 0 && (
                            <>
                              <Text style={styles.suggestionMrp}>₹{originalPrice.toFixed(0)}</Text>
                              <Text style={styles.suggestionDiscount}>{discountPercentage.toFixed(0)}% OFF</Text>
                            </>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#ccc" />
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Welcome Animation Overlay */}
        {showWelcomeAnimation && (
          <Animated.View
            style={[
              styles.welcomeOverlay,
              {
                opacity: welcomeOpacity,
              },
            ]}
          >
            {/* Animated gradient background */}
            <LinearGradient
              colors={['#FFFFFF', '#FFF5F7', '#FFE5EC', '#FFF5F7', '#FFFFFF']}
              style={StyleSheet.absoluteFillObject}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            {/* Particles background layer */}
            <View style={styles.particlesContainer}>
              {[...Array(20)].map((_, i) => (
                <View
                  key={`particle-${i}`}
                  style={[
                    styles.particle,
                    {
                      left: `${Math.random() * 100}%`,
                      top: `${Math.random() * 100}%`,
                      width: 2 + Math.random() * 4,
                      height: 2 + Math.random() * 4,
                      opacity: 0.3 + Math.random() * 0.4,
                    },
                  ]}
                />
              ))}
            </View>

            <Animated.View
              style={[
                styles.welcomeContent,
                {
                  transform: [{ scale: welcomeScale }],
                },
              ]}
            >
              {/* Enhanced floating decorative elements with variety */}
              {floatingElements.map((element, index) => {
                const size = 25 + (index % 4) * 12;
                const colors = ['#FF3F6C', '#FFE5EC', '#F53F7A', '#FF6B9D', '#FFC0DB', '#FF85A1'];
                const shapes = ['circle', 'square', 'diamond', 'star'];
                const shapeType = shapes[index % 4];

                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.floatingElement,
                      {
                        left: `${10 + (index % 4) * 25}%`,
                        top: `${15 + Math.floor(index / 4) * 28}%`,
                        opacity: element.opacity,
                        transform: [
                          { translateY: element.translateY },
                          { translateX: element.translateX },
                          { scale: element.scale },
                          {
                            rotate: element.rotate.interpolate({
                              inputRange: [-1, 0, 1],
                              outputRange: ['-180deg', '0deg', '180deg'],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    {shapeType === 'circle' && (
                      <View style={[
                        styles.floatingShape,
                        {
                          backgroundColor: colors[index % colors.length],
                          width: size,
                          height: size,
                          borderRadius: size / 2,
                        },
                      ]} />
                    )}
                    {shapeType === 'square' && (
                      <View style={[
                        styles.floatingShape,
                        {
                          backgroundColor: colors[index % colors.length],
                          width: size,
                          height: size,
                          borderRadius: 8,
                        },
                      ]} />
                    )}
                    {shapeType === 'diamond' && (
                      <View style={[
                        styles.floatingShape,
                        {
                          backgroundColor: colors[index % colors.length],
                          width: size,
                          height: size,
                          borderRadius: 4,
                          transform: [{ rotate: '45deg' }],
                        },
                      ]} />
                    )}
                    {shapeType === 'star' && (
                      <View style={[
                        styles.floatingShape,
                        styles.starShape,
                        {
                          backgroundColor: colors[index % colors.length],
                          width: size,
                          height: size,
                        },
                      ]} />
                    )}
                  </Animated.View>
                );
              })}

              {/* Ripple effect behind logo */}
              <Animated.View
                style={[
                  styles.rippleCircle,
                  {
                    opacity: rippleOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.6, 0],
                    }),
                    transform: [{ scale: rippleScale }],
                  },
                ]}
              />

              {/* Welcome message with enhanced effects */}
              <View style={styles.welcomeMessageContainer}>
                {/* Logo with glow effect */}
                <Animated.View
                  style={[
                    styles.logoCircle,
                    {
                      shadowOpacity: logoGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.4, 0.8],
                      }),
                      shadowRadius: logoGlow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 35],
                      }),
                    },
                  ]}
                >
                  <LinearGradient
                    colors={['#FF3F6C', '#F53F7A', '#FF6B9D']}
                    style={styles.logoGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.logoText}>O<Text style={styles.logoSubText}>2</Text>U</Text>
                  </LinearGradient>

                  {/* Shimmer overlay */}
                  <Animated.View
                    style={[
                      styles.shimmerOverlay,
                      {
                        transform: [{
                          translateX: shimmerPosition.interpolate({
                            inputRange: [-1, 1],
                            outputRange: [-200, 200],
                          }),
                        }],
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(255, 255, 255, 0.6)', 'transparent']}
                      style={{ width: 100, height: 120 }}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    />
                  </Animated.View>
                </Animated.View>

                {/* Animated text */}
                <View style={styles.textContainer}>
                  <Text style={styles.welcomeTitle}>
                    <Text style={styles.welcomeTitleGradient}>Welcome to </Text>
                    <Text style={styles.welcomeTitleBrand}>Only2U</Text>
                  </Text>
                  <View style={styles.subtitleContainer}>
                    <Ionicons name="sparkles" size={16} color="#F53F7A" />
                    <Text style={styles.welcomeSubtitle}>Your personalized fashion experience</Text>
                    <Ionicons name="sparkles" size={16} color="#F53F7A" />
                  </View>
                </View>

                {/* Decorative dots */}
                <View style={styles.dotsContainer}>
                  {[0, 1, 2].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.decorativeDot,
                        { backgroundColor: i === 1 ? '#FF3F6C' : '#FFE5EC' },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {/* Animated Content Wrapper */}
        <Animated.View
          style={[
            styles.contentWrapper,
            {
              opacity: contentOpacity,
            },
          ]}
        >
          {/* Enhanced Header with Integrated Search */}
          <Animated.View style={{ transform: [{ translateY: headerSlide }] }}>
            <SafeAreaView edges={['top']} style={styles.safeHeader}>
              <View style={styles.header}>
                {/* Top Row: Logo + Actions */}
                <View style={styles.headerTopRow}>
                  <View style={styles.logoContainer}>
                    <Only2ULogo size="medium" />
                    <TouchableOpacity
                      style={styles.locationRow}
                      onPress={() => {
                        setAddressSheetVisible(true);
                        addressSheetRef.current?.expand();
                      }}
                    >
                      <Ionicons name="location" size={12} color="#F53F7A" />
                      <Text style={styles.cityText}>
                        {selectedAddress
                          ? `${selectedAddress.city}, ${selectedAddress.state}`
                          : userData?.location || 'Select location'}
                      </Text>
                      <Ionicons name="chevron-down" size={12} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.headerRight}>
                    <TouchableOpacity
                      style={styles.coinBadge}
                      onPress={() => setShowCoinsModal(true)}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="face-man-shimmer" size={16} color="#F53F7A" />
                      <Text style={styles.coinText}>{userData?.coin_balance || 0}</Text>
                    </TouchableOpacity>
                    {/* Wishlist Heart Icon */}
                    <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Wishlist')}>
                      <Ionicons name="heart-outline" size={22} color="#F53F7A" />
                      {wishlistUnreadCount > 0 && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeText}>{wishlistUnreadCount > 99 ? '99+' : wishlistUnreadCount}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.profileButton}
                      onPress={() => navigation.navigate('Profile')}
                    >
                      {userData?.profilePhoto ? (
                        <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
                      ) : (
                        <Ionicons name="person-outline" size={16} color="#333" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Bottom Row: Integrated Search Bar with Suggestions */}
                <View style={{ position: 'relative', zIndex: 1000, flexDirection: 'row', alignItems: 'center' }}>
                  <View style={[styles.searchBarIntegrated, { flex: 1 }]}>
                    <Ionicons name="search-outline" size={20} color="#888" />
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Search products..."
                      placeholderTextColor="#888"
                      value={searchText}
                      onChangeText={handleSearchChange}
                      onFocus={() => searchText.trim().length >= 2 && setShowSuggestions(true)}
                      returnKeyType="search"
                    />
                    {searchText.length > 0 && (
                      <TouchableOpacity
                        onPress={() => {
                          setSearchText('');
                          setSearchSuggestions([]);
                          setShowSuggestions(false);
                        }}
                        style={{ padding: 4 }}
                      >
                        <Ionicons name="close-circle" size={18} color="#999" />
                      </TouchableOpacity>
                    )}
                    {loadingSuggestions && (
                      <ActivityIndicator size="small" color="#F53F7A" style={{ marginLeft: 8 }} />
                    )}
                  </View>

                  {/* Filter Button */}
                  <TouchableOpacity
                    style={{
                      marginLeft: 10,
                      width: 44,
                      height: 44,
                      backgroundColor: '#f5f5f5',
                      borderRadius: 12,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => filterSheetRef.current?.present()}
                  >
                    <Ionicons name="options-outline" size={24} color="#333" />
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </Animated.View>
          {/* End Header Animation */}

          {/* Initial Loading Screen */}
          {isInitialLoading && !hasError ? (
            <DashboardLoader />
          ) : hasError ? (
            <View style={styles.errorContainer}>
              <Ionicons name="cloud-offline-outline" size={64} color="#999" />
              <Text style={styles.errorTitle}>Something went wrong</Text>
              <Text style={styles.errorMessage}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => {
                  setHasError(false);
                  setErrorMessage('');
                  setIsInitialLoading(true);
                  loadDashboardData(true);
                }}
              >
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={styles.scrollContent}
              contentContainerStyle={styles.scrollContentContainer}
              refreshControl={
                <RefreshControl
                  refreshing={isRefreshing}
                  onRefresh={() => loadDashboardData(true)}
                  colors={['#F53F7A']}
                  tintColor="#F53F7A"
                />
              }
            >
              {/* Show search results if user is actively searching */}
              {isSearching ? (
                renderSearchResults()
              ) : isFilteringCategory ? (
                // Show category filter grid when category filter is applied
                renderCategoryFilterGrid()
              ) : (
                <>
                  {/* Dynamic Sections based on admin panel ordering */}
                  {featureSections.map((section, index) => (
                    <View key={section.id}>
                      {renderSectionByType(section)}
                    </View>
                  ))}

                  {/* Category-specific product sections (shown after main sections) */}
                  {categories.map((category) => renderCategorySection(category))}
                </>
              )}

              {/* Policies Footer */}
              <View style={styles.policiesFooter}>
                <Text style={styles.policiesFooterText}>Legal & Policies</Text>
                <View style={styles.policiesFooterLinks}>
                  <TouchableOpacity
                    style={styles.policyFooterLink}
                    onPress={() => navigation.navigate('TermsAndConditions' as any)}
                  >
                    <Text style={styles.policyFooterLinkText}>Terms</Text>
                  </TouchableOpacity>
                  <Text style={styles.policyFooterSeparator}>•</Text>
                  <TouchableOpacity
                    style={styles.policyFooterLink}
                    onPress={() => navigation.navigate('PrivacyPolicy' as any)}
                  >
                    <Text style={styles.policyFooterLinkText}>Privacy</Text>
                  </TouchableOpacity>
                  <Text style={styles.policyFooterSeparator}>•</Text>
                  <TouchableOpacity
                    style={styles.policyFooterLink}
                    onPress={() => navigation.navigate('RefundPolicy' as any)}
                  >
                    <Text style={styles.policyFooterLinkText}>Refund</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>
          )}

          {/* Address Selection Bottom Sheet */}
          {
            addressSheetVisible && (
              <BottomSheet
                ref={addressSheetRef}
                index={0}
                snapPoints={['70%']}
                enablePanDownToClose
                onClose={() => setAddressSheetVisible(false)}
              >
                <BottomSheetScrollView style={styles.addressSheetContent}>
                  <View style={styles.addressSheetHeader}>
                    <Text style={styles.addressSheetTitle}>Select Delivery Address</Text>
                    <TouchableOpacity
                      style={styles.addNewAddressButton}
                      onPress={() => {
                        setAddressSheetVisible(false);
                        addressSheetRef.current?.close();
                        navigation.navigate('AddressBook' as never);
                      }}
                    >
                      <Ionicons name="add-circle" size={20} color="#F53F7A" />
                      <Text style={styles.addNewAddressText}>Add New</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Pincode Availability Checker */}
                  <View style={styles.pincodeChecker}>
                    <Text style={styles.pincodeCheckerTitle}>Check Delivery Availability</Text>
                    <View style={styles.pincodeInputRow}>
                      <TextInput
                        style={styles.pincodeInput}
                        placeholder="Enter Pincode"
                        value={pincode}
                        onChangeText={setPincode}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholderTextColor="#999"
                      />
                      <TouchableOpacity
                        style={[styles.checkButton, checkingPincode && styles.checkButtonDisabled]}
                        onPress={handleCheckPincode}
                        disabled={checkingPincode}
                      >
                        {checkingPincode ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={styles.checkButtonText}>Check</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    {pincodeAvailable !== null && (
                      <View style={[styles.availabilityResult, pincodeAvailable ? styles.availableResult : styles.unavailableResult]}>
                        <Ionicons
                          name={pincodeAvailable ? 'checkmark-circle' : 'close-circle'}
                          size={18}
                          color={pincodeAvailable ? '#10b981' : '#ef4444'}
                        />
                        <Text style={[styles.availabilityText, pincodeAvailable ? styles.availableText : styles.unavailableText]}>
                          {pincodeAvailable ? 'Delivery available to this location' : 'Currently not serviceable'}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.dividerLine} />

                  {addresses.length === 0 ? (
                    <View style={styles.emptyAddressContainer}>
                      <Ionicons name="location-outline" size={48} color="#999" />
                      <Text style={styles.emptyAddressText}>No addresses added yet</Text>
                      <TouchableOpacity
                        style={styles.addFirstAddressButton}
                        onPress={() => {
                          setAddressSheetVisible(false);
                          addressSheetRef.current?.close();
                          navigation.navigate('AddressBook' as never);
                        }}
                      >
                        <Text style={styles.addFirstAddressText}>Add Your First Address</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.addressList}>
                      {addresses.map((address) => (
                        <TouchableOpacity
                          key={address.id}
                          style={[
                            styles.addressCard,
                            selectedAddress?.id === address.id && styles.selectedAddressCard
                          ]}
                          onPress={() => handleAddressSelect(address)}
                        >
                          <View style={styles.addressCardHeader}>
                            <View style={styles.addressCardNameRow}>
                              <Text style={styles.addressCardName}>{address.full_name}</Text>
                              {address.is_default && (
                                <View style={styles.defaultBadge}>
                                  <Text style={styles.defaultBadgeText}>Default</Text>
                                </View>
                              )}
                            </View>
                            {selectedAddress?.id === address.id && (
                              <Ionicons name="checkmark-circle" size={24} color="#F53F7A" />
                            )}
                          </View>
                          <Text style={styles.addressCardPhone}>{address.phone}</Text>
                          <Text style={styles.addressCardAddress}>
                            {address.address_line1}
                            {address.address_line2 && `, ${address.address_line2}`}
                          </Text>
                          <Text style={styles.addressCardCity}>
                            {address.city}, {address.state} - {address.pincode}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </BottomSheetScrollView>
              </BottomSheet>
            )
          }

        </Animated.View >
        {/* End Animated Content Wrapper */}

        {/* Coins Info Modal - Outside Animated.View for proper visibility */}
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

                  {userData?.id && referralCode ? (
                    <TouchableOpacity
                      style={styles.coinsReferFriendsSimple}
                      onPress={handleShareReferral}
                      activeOpacity={0.7}
                    >
                      <LinearGradient
                        colors={['#25D366', '#128C7E']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.coinsReferralCard}
                      >
                        <View style={styles.coinsReferralIconContainer}>
                          <Ionicons name="logo-whatsapp" size={32} color="#fff" />
                        </View>
                        <View style={styles.coinsReferFriendsTextContainer}>
                          <Text style={styles.coinsEarn100Title}>🎁 Refer & Earn 100 coins</Text>
                          <Text style={styles.coinsEarn100Subtitle}>Share on WhatsApp to earn 100 coins</Text>
                        </View>
                        <View style={styles.coinsShareArrow}>
                          <Ionicons name="arrow-forward-circle" size={32} color="rgba(255,255,255,0.9)" />
                        </View>
                      </LinearGradient>
                    </TouchableOpacity>
                  ) : (
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
                  )}

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

        {/* Filter Bottom Sheet */}
        <BottomSheetModal
          ref={filterSheetRef}
          index={0}
          snapPoints={snapPoints}
          backdropComponent={(props) => (
            <BottomSheetBackdrop {...props} opacity={0.5} disappearsOnIndex={-1} pressBehavior="close" />
          )}
          enablePanDownToClose={true}
          style={{ borderRadius: 24, overflow: 'hidden' }}
          handleIndicatorStyle={{ backgroundColor: '#e0e0e0', width: 40 }}
        >
          <View style={{ flex: 1, backgroundColor: '#fff' }}>
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
                  {/* Category Filter */}
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
                                  name={selectedFilterCategories.includes(cat.id) ? 'checkmark-circle' : 'ellipse-outline'}
                                  size={20}
                                  color={selectedFilterCategories.includes(cat.id) ? '#F53F7A' : '#999'}
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
                      {/* Tabs */}
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
                            onChangeText={setVendorSearchQuery}
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
                                const isSelected = selectedBrands.includes(vendor.id);
                                return (
                                  <TouchableOpacity
                                    key={vendor.id}
                                    style={[
                                      styles.filterOptionRow,
                                      { paddingVertical: 10 }
                                    ]}
                                    onPress={() => toggleBrandSelection(vendor.id)}>
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
                                      {(vendor.profile_image_url || vendor.store_logo_url) ? (
                                        <Image
                                          source={{ uri: vendor.profile_image_url || vendor.store_logo_url }}
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
                                      ]}>{vendor.store_name || vendor.business_name}</Text>
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
                              filteredInfluencers.map((influencer: any) => {
                                const isSelected = selectedInfluencers.includes(influencer.id);
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
                                      </View>
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
                          sizes.map((size) => (
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
                            </TouchableOpacity>
                          ))
                        ) : (
                          <View style={styles.emptyFilterState}>
                            <Ionicons name="resize-outline" size={48} color="#ccc" />
                            <Text style={styles.emptyFilterText}>No sizes available</Text>
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

                  {/* Rating Filter */}
                  {activeFilterCategory === 'Rating' && (
                    <View style={styles.filterOptionsContainer}>
                      <Text style={styles.filterSectionTitle}>Customer Ratings</Text>
                      <BottomSheetScrollView showsVerticalScrollIndicator={false}>
                        {[4, 3, 2, 1].map((rating) => (
                          <TouchableOpacity
                            key={rating}
                            style={styles.filterOptionRow}
                            onPress={() => setSelectedRating(selectedRating === rating ? null : rating)}>
                            <View style={styles.checkboxContainer}>
                              <Ionicons
                                name={selectedRating === rating ? 'radio-button-on' : 'radio-button-off'}
                                size={20}
                                color={selectedRating === rating ? '#F53F7A' : '#999'}
                              />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Ionicons
                                  key={i}
                                  name={i < rating ? "star" : "star-outline"}
                                  size={16}
                                  color="#FFD700"
                                  style={{ marginRight: 2 }}
                                />
                              ))}
                              <Text style={styles.filterOptionText}>& Up</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </BottomSheetScrollView>
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
      </View >
    </BottomSheetModalProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  safeHeader: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 1000,
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoContainer: {
    gap: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  languageContainer: {
    marginRight: 16,
    position: 'relative',
  },
  languageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  langMenuDropdown: {
    position: 'absolute',
    top: 32,
    right: 0,
    backgroundColor: '#f7f8fa',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    minWidth: 120,
    zIndex: 100,
  },
  langMenuItem: {
    padding: 12,
  },
  langMenuItemActive: {
    backgroundColor: '#f1f2f4',
  },
  langMenuText: {
    color: '#222',
    fontSize: 16,
  },
  coinBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
  },
  coinText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
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
    width: '95%',
    maxWidth: 500,
    backgroundColor: '#fff',
    borderRadius: 20,
    maxHeight: Dimensions.get('window').height * 0.95,
    minHeight: 600,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 15 },
    elevation: 15,
  },
  coinsModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 20,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsModalScrollView: {
    flex: 1,
  },
  coinsModalScrollContent: {
    padding: 24,
    paddingBottom: 28,
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
  coinsRedeemText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
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
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 12,
  },
  coinsEarnItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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
    marginRight: 10,
  },
  coinsEarnItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  coinsEarnItemDesc: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  coinsEarnAmountBadge: {
    backgroundColor: '#FFF5F7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FEE2E8',
  },
  coinsEarnAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F53F7A',
  },
  coinsReferralButton: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  coinsReferralButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  coinsReferralButtonInline: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  coinsReferFriendsSimple: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  coinsReferralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  coinsReferralIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  coinsReferFriendsTextContainer: {
    flex: 1,
  },
  coinsEarn100Title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  coinsEarn100Subtitle: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  coinsShareArrow: {
    marginLeft: 12,
  },
  coinsEarn100Badge: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#128C7E',
  },
  coinsEarn100BadgeText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  coinsModalButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  coinsModalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
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
  searchBarIntegrated: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  suggestionsDropdown: {
    position: 'absolute',
    top: 120,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 999,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
    zIndex: 9999,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  suggestionImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  suggestionInfo: {
    flex: 1,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 3,
  },
  suggestionPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  suggestionPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
  },
  suggestionMrp: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  suggestionDiscount: {
    fontSize: 11,
    color: '#4CAF50',
    fontWeight: '600',
  },
  suggestionsOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  suggestionsBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContentContainer: {
    paddingBottom: 24,
    paddingTop: 12,
  },
  currencyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currencyText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  iconButton: {
    position: 'relative',
    padding: 4,
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
  categoryContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },

  shopButton: {
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 25,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  shopButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryScrollView: {
    paddingLeft: 0,
    paddingHorizontal: 0,
  },
  categoryCard: {
    width: 80,
    borderRadius: 8,
    overflow: 'hidden',
    marginHorizontal: 3,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  categoryImage: {
    width: '100%',
    height: 60,
    resizeMode: 'cover',
    // add opacity to image
    // borderRadius: 8,
  },
  categoryOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryTitle: {
    color: '#333',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sectionContainer: {
    backgroundColor: '#fff',
    // marginHorizontal: 16,
    // marginTop: 10,
    borderRadius: 16,
    padding: 8,
    // shadowColor: '#000',
    // shadowOpacity: 0.04,
    // shadowRadius: 8,
    // shadowOffset: { width: 0, height: 2 },
    // elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    letterSpacing: -0.3,
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
    marginRight: 2,
  },
  noVideosContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  noVideosText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
  },
  productScrollView: {
    paddingLeft: 0,
    paddingHorizontal: 0,
    paddingBottom: 16,
  },
  productCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#eee',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  discountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  offText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 2,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    paddingHorizontal: 12,
    paddingTop: 2,
    lineHeight: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
  },
  ratingText: {
    fontSize: 11,
    color: '#1a1a1a',
    marginLeft: 3,
    fontWeight: '600',
  },
  reviewsText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 3,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 4,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  sizeIndicator: {
    fontSize: 10,
    color: '#999',
    marginLeft: 4,
  },
  originalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  discountPercentage: {
    fontSize: 11,
    // color: '#F53F7A',
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 4,
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reviewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor: '#FFD600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 6,
  },
  reviews: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#333',
    // marginLeft: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  loadingText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    marginTop: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#666',
    fontWeight: '500',
    marginTop: 12,
  },
  featuredBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  featuredBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  productCategory: {
    fontSize: 11,
    color: '#999',
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f2f2f2',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'android' ? 2 : 6,
    // marginLeft: 2,
    marginTop: 5,
    // flex: 1,
    // marginRight: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#222',
    paddingVertical: 0,
  },
  micButton: {
    padding: 4,
  },
  searchBarOnlyHeader: {
    paddingTop: 0, // or Platform.OS === 'ios' ? 35 : 0, if you want to account for status bar
    paddingBottom: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBarBeforeCategory: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    zIndex: 1,
    marginTop: 16, // <-- Add this line for extra space above
  },
  stockIndicator: {
    backgroundColor: '#fff',
    paddingHorizontal: 5,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignSelf: 'flex-start',
    // marginBottom: 6,
    marginTop: 4,
    // marginLeft: 6,
  },
  stockText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF3B30',
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
  fullScreenLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingTop: HEADER_HEIGHT,
  },
  fullScreenLoadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  debugButton: {
    padding: 4,
    marginLeft: 4,
  },
  // Skeleton Loading Styles
  skeletonScrollView: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  skeletonContentContainer: {
    paddingTop: HEADER_HEIGHT,
    paddingBottom: 24,
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  skeletonLogo: {
    width: 80,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skeletonIcon: {
    width: 24,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 12,
  },
  skeletonSearchBar: {
    height: 40,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
    marginHorizontal: 20,
    marginVertical: 16,
  },
  skeletonSection: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 8,
    marginBottom: 16,
  },
  skeletonSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  skeletonTitle: {
    width: 120,
    height: 24,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonSeeMore: {
    width: 60,
    height: 16,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
  },
  skeletonCategoryCard: {
    width: 80,
    marginHorizontal: 3,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  skeletonCategoryImage: {
    width: '100%',
    height: 60,
    backgroundColor: '#e0e0e0',
  },
  skeletonCategoryTitle: {
    height: 12,
    backgroundColor: '#e0e0e0',
    margin: 6,
    borderRadius: 2,
  },
  skeletonProductCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  skeletonProductImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#e0e0e0',
  },
  skeletonProductTitle: {
    height: 14,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 2,
  },
  skeletonProductPrice: {
    height: 16,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 12,
    marginTop: 8,
    marginBottom: 12,
    borderRadius: 2,
    width: '60%',
  },
  // Error State Styles
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    paddingTop: HEADER_HEIGHT,
    paddingHorizontal: 32,
  },
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
  // Policies Footer Styles
  policiesFooter: {
    backgroundColor: '#fff',
    paddingVertical: 20,
    paddingHorizontal: 20,
    marginTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  policiesFooterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  policiesFooterLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  policyFooterLink: {
    paddingHorizontal: 8,
  },
  policyFooterLinkText: {
    fontSize: 13,
    color: '#F53F7A',
    fontWeight: '500',
  },
  policyFooterSeparator: {
    fontSize: 13,
    color: '#999',
    marginHorizontal: 4,
  },
  // Address Bottom Sheet Styles
  addressSheetContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  addressSheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressSheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  addNewAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFF5F7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addNewAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  emptyAddressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyAddressText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
  },
  addFirstAddressButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addFirstAddressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  addressList: {
    gap: 12,
    paddingBottom: 20,
  },
  addressCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  selectedAddressCard: {
    borderColor: '#F53F7A',
    backgroundColor: '#FFF5F7',
  },
  addressCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  addressCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  addressCardName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  defaultBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  defaultBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#fff',
  },
  addressCardPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  addressCardAddress: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  addressCardCity: {
    fontSize: 14,
    color: '#666',
  },
  // Pincode Checker Styles
  pincodeChecker: {
    marginBottom: 20,
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
  },
  pincodeCheckerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  pincodeInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  pincodeInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  checkButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  checkButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  availabilityResult: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
  },
  availableResult: {
    backgroundColor: '#ECFDF5',
  },
  unavailableResult: {
    backgroundColor: '#FEF2F2',
  },
  availabilityText: {
    fontSize: 13,
    fontWeight: '600',
  },
  availableText: {
    color: '#10b981',
  },
  unavailableText: {
    color: '#ef4444',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  // Search Results Styles
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  searchResultsHeader: {
    marginBottom: 16,
  },
  searchResultsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  searchResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8, // Adjust for card padding
  },
  searchResultCard: {
    width: '50%',
    padding: 8, // Create spacing
    marginBottom: 0,
  },
  noResultsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  noResultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  // Welcome Animation Styles
  welcomeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    zIndex: 10000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  floatingElement: {
    position: 'absolute',
  },
  floatingShape: {
    shadowColor: '#F53F7A',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  welcomeMessageContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF3F6C',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#FF3F6C',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
  },
  logoSubText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFE5EC',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1C1C1E',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    textAlign: 'center',
    marginHorizontal: 4,
  },
  contentWrapper: {
    flex: 1,
  },
  // Enhanced Premium Styles
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  particle: {
    position: 'absolute',
    backgroundColor: '#FF3F6C',
    borderRadius: 50,
  },
  starShape: {
    borderRadius: 0,
  },
  rippleCircle: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 3,
    borderColor: '#FF3F6C',
    backgroundColor: 'transparent',
  },
  logoGradient: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: -50,
    width: 200,
    height: 120,
    overflow: 'hidden',
    borderRadius: 60,
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  welcomeTitleGradient: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1C1C1E',
  },
  welcomeTitleBrand: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FF3F6C',
    letterSpacing: -0.5,
  },
  subtitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
    alignItems: 'center',
  },
  decorativeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  // Vertical Card Styles (Matched with Products.tsx Grid)
  // Vertical Card Styles (Matched with Products.tsx Grid)
  verticalCard: {
    backgroundColor: '#fff',
    borderRadius: 0,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
    width: '100%',
    elevation: 2, // Slight shadow for card effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    marginBottom: 16,
  },
  verticalImageContainer: {
    position: 'relative',
    width: '100%',
  },
  verticalImage: {
    width: '100%',
    height: 220,
  },
  verticalBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    zIndex: 1,
  },
  verticalBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  verticalWishlistButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingBadgeOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10, // Moved to bottom right
    zIndex: 999,
  },
  ratingBadgeOnImage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16, // Pill shape
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  ratingBadgeValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#333',
  },
  verticalDetails: {
    padding: 10,
  },
  verticalVendorText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#333', // Darker black for vendor
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  verticalProductName: {
    fontWeight: '500',
    fontSize: 12,
    color: '#888', // Gray for product name
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  verticalPriceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verticalOriginalPrice: {
    fontSize: 12,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  verticalPrice: {
    color: '#000',
    fontWeight: '700',
    fontSize: 15,
  },
  verticalDiscountBadge: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  verticalDiscountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  // Filter Styles
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
  sizeProductCount: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  // Category Filter Grid Styles
  categoryFilterContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  categoryFilterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryFilterBackButton: {
    padding: 8,
  },
  categoryFilterTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
    textAlign: 'center',
  },
  categoryFilterButton: {
    padding: 8,
  },
  categoryFilterCountRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  categoryFilterCountText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  // Category Filter Grid - exactly like search results
  categoryFilterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8, // Outer spacing
  },
  categoryFilterCard: {
    width: '50%',
    padding: 8, // Inner spacing (creates gap)
  },
});

export default Dashboard;