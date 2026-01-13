import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Share,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { useWishlist } from '~/contexts/WishlistContext';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { supabase } from '~/utils/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensureNewUserReferralCoupon, ensureReferrerRewardCoupon } from '~/services/referralCouponService';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { Video, ResizeMode } from 'expo-av';
import { uploadProfilePhoto, validateImage, deleteProfilePhoto as deleteProfilePhotoFromStorage } from '~/utils/profilePhotoUpload';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';


type RootStackParamList = {
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
  VendorDashboard: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const PROFILE_PHOTO_TUTORIAL_KEY = 'ONLY2U_PROFILE_PHOTO_TUTORIAL_SEEN';
const PROFILE_PHOTO_TUTORIAL_VIDEO =
  'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566959/productvideos/profile-photo-tips.mp4';

const SELLER_TUTORIAL_KEY = 'ONLY2U_SELLER_TUTORIAL_SEEN';
const SELLER_TUTORIAL_VIDEO =
  'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566960/productvideos/become-seller-tutorial.mp4';

const INFLUENCER_TUTORIAL_KEY = 'ONLY2U_INFLUENCER_TUTORIAL_SEEN';
const INFLUENCER_TUTORIAL_VIDEO =
  'https://res.cloudinary.com/dtt75ypdv/video/upload/v1763566961/productvideos/become-influencer-tutorial.mp4';

const Profile = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { userData, clearUserData, refreshUserData, setUserData, deleteUserProfile, isLoading: isUserLoading } = useUser();
  const { setUser, user } = useAuth();
  const { clearWishlist } = useWishlist();
  const [refreshing, setRefreshing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation();

  // OTP Login state
  const { isLoginSheetVisible, showLoginSheet, hideLoginSheet } = useLoginSheet();
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);

  // Profile photo upload state
  const [showPhotoPickerModal, setShowPhotoPickerModal] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const uploadPulse = useRef(new Animated.Value(0)).current;

  // Debug effect to track auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('--- PROFILE DEBUG ---');
      console.log('Session User ID:', session?.user?.id);
      console.log('Context userData ID:', userData?.id);
      console.log('Context authUser ID:', user?.id);
      console.log('---------------------');
    });
  }, [userData, user]);

  // Auto-detect missing profile logic moved to global TabNavigator to avoid conflicts
  useEffect(() => {
    // This effect previously triggered onboarding if profile was missing
    // Removed to prevent race conditions with login flow
  }, []);

  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (uploadingPhoto) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(uploadPulse, {
            toValue: 1,
            duration: 900,
            useNativeDriver: false,
          }),
          Animated.timing(uploadPulse, {
            toValue: 0,
            duration: 900,
            useNativeDriver: false,
          }),
        ])
      );
      animation.start();
    } else {
      uploadPulse.stopAnimation(() => undefined);
      uploadPulse.setValue(0);
    }

    return () => {
      animation?.stop();
    };
  }, [uploadingPhoto, uploadPulse]);

  const uploadPulseScale = uploadPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.15],
  });

  const uploadPulseOpacity = uploadPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.85],
  });

  const uploadProgressWidth = uploadPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [80, 210],
  });

  const [permissionModal, setPermissionModal] = useState<{ visible: boolean; context: 'camera' | 'gallery' }>({
    visible: false,
    context: 'camera',
  });
  const [showDeletePhotoModal, setShowDeletePhotoModal] = useState(false);
  const [deletingPhoto, setDeletingPhoto] = useState(false);
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [referralCouponId, setReferralCouponId] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<{
    totalFriends: number;
    totalDiscount: number;
    lastUsedAt: string | null;
  }>({
    totalFriends: 0,
    totalDiscount: 0,
    lastUsedAt: null,
  });
  // Referral code welcome coupon state
  const [referralWelcomeCoupon, setReferralWelcomeCoupon] = useState<{
    code: string;
    referralCode: string;
    discountValue: number;
    description: string;
  } | null>(null);
  const [loadingReferralCoupon, setLoadingReferralCoupon] = useState(false);

  // Feedback modal state
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [loadingFeedbacks, setLoadingFeedbacks] = useState(false);
  const [feedbackLikes, setFeedbackLikes] = useState<Record<string, boolean>>({});
  const [feedbackLikeCounts, setFeedbackLikeCounts] = useState<Record<string, number>>({});
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [newFeedbackText, setNewFeedbackText] = useState('');
  const [newFeedbackImages, setNewFeedbackImages] = useState<string[]>([]);
  const [newFeedbackVideos, setNewFeedbackVideos] = useState<string[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [showImageViewerModal, setShowImageViewerModal] = useState(false);
  const [selectedImageUri, setSelectedImageUri] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeState, setReferralCodeState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referralCodeMessage, setReferralCodeMessage] = useState('');
  const [appliedReferralCoupon, setAppliedReferralCoupon] = useState<{ code: string; couponId: string; referrerId?: string | null; referralCodeId?: string | null } | null>(null);
  const [showPhotoTutorialModal, setShowPhotoTutorialModal] = useState(false);
  const [photoTutorialDontShowAgain, setPhotoTutorialDontShowAgain] = useState(false);
  const [hasSeenPhotoTutorial, setHasSeenPhotoTutorial] = useState(false);

  // Seller tutorial state
  const [showSellerTutorialModal, setShowSellerTutorialModal] = useState(false);
  const [sellerTutorialDontShowAgain, setSellerTutorialDontShowAgain] = useState(false);
  const [hasSeenSellerTutorial, setHasSeenSellerTutorial] = useState(false);

  // Influencer tutorial state
  const [showInfluencerTutorialModal, setShowInfluencerTutorialModal] = useState(false);
  const [influencerTutorialDontShowAgain, setInfluencerTutorialDontShowAgain] = useState(false);
  const [hasSeenInfluencerTutorial, setHasSeenInfluencerTutorial] = useState(false);

  // Random 100rs Discount Code
  const [randomDiscountCode, setRandomDiscountCode] = useState('');
  // Shubhamastu Special Code
  const [shubhamastuCode, setShubhamastuCode] = useState<string | null>(null);

  // Sync user data from useAuth to useUser if userData is null but user has data
  useEffect(() => {
    if (userData) {
      setUserData(userData);
    }
  }, [userData]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    const loadTutorialFlags = async () => {
      try {
        const [photoStored, sellerStored, influencerStored] = await Promise.all([
          AsyncStorage.getItem(PROFILE_PHOTO_TUTORIAL_KEY),
          AsyncStorage.getItem(SELLER_TUTORIAL_KEY),
          AsyncStorage.getItem(INFLUENCER_TUTORIAL_KEY),
        ]);
        setHasSeenPhotoTutorial(photoStored === 'true');
        setHasSeenSellerTutorial(sellerStored === 'true');
        setHasSeenInfluencerTutorial(influencerStored === 'true');
      } catch (error) {
        console.warn('Failed to load tutorial preferences', error);
      }
    };

    loadTutorialFlags();
  }, []);

  useEffect(() => {
    // Generate a random 4-character suffix
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRandomDiscountCode(`SAVE100-${suffix}`);
  }, []);


  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile' as never);
  };

  const handleMyOrders = () => {
    navigation.navigate('MyOrders' as never);
  };

  const handleResellerEarnings = () => {
    navigation.navigate('YourEarnings' as never);
  };

  const handleAdminPanel = () => {
    navigation.navigate('Admin' as never);
  };

  const handleHelpCenter = () => {
    navigation.navigate('HelpCenter' as never);
  };

  const handleTermsAndConditions = () => {
    navigation.navigate('TermsAndConditions');
  };

  const handlePrivacyPolicy = () => {
    navigation.navigate('PrivacyPolicy');
  };

  const handleRefundPolicy = () => {
    navigation.navigate('RefundPolicy');
  };

  const handleFeedback = () => {
    if (!userData?.id && !user?.id) {
      showLoginSheet();
      return;
    }
    setShowFeedbackModal(true);
    loadFeedbacks();
  };

  const handleBecomeSeller = () => {
    // Show tutorial if not seen before
    if (!hasSeenSellerTutorial) {
      setShowSellerTutorialModal(true);
    } else {
      navigation.navigate('VendorProfile' as never);
    }
  };

  const handleVendorDashboard = () => {
    navigation.navigate('VendorDashboard' as never);
  };

  const handleJoinInfluencer = () => {
    // Show tutorial if not seen before
    if (!hasSeenInfluencerTutorial) {
      setShowInfluencerTutorialModal(true);
    } else {
      navigation.navigate('JoinInfluencer' as never);
    }
  };

  const generateReferralCode = useCallback(() => {
    if (!userData?.id) return '';
    const namePart = (userData?.name || 'ONLY2U')
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 6)
      .toUpperCase() || 'ONLY2U';
    const idPart = userData.id.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
    return `${namePart}${idPart}`;
  }, [userData?.id, userData?.name]);

  const parseReferralRewardMetadata = (description?: string | null) => {
    if (!description) return { referralCount: 0, maxDiscount: 0 };
    const parts = description.split('|');
    const metaPart = parts.find((part) => part.startsWith('REFERRALS:'));
    if (!metaPart) return { referralCount: 0, maxDiscount: 0 };
    const [referralSection, maxSection] = metaPart.split(':MAX:');
    const referralCount = Number(referralSection.replace('REFERRALS:', '')) || 0;
    const maxDiscount = Number(maxSection) || 0;
    return { referralCount, maxDiscount };
  };

  const loadReferralData = useCallback(async () => {
    if (!userData?.id) return;

    setReferralLoading(true);
    try {
      const code = generateReferralCode();
      setReferralCode(code);

      const { data: existingCoupon, error: couponFetchError } = await supabase
        .from('coupons')
        .select('id, code, is_active')
        .eq('code', code)
        .maybeSingle();

      if (couponFetchError) {
        throw couponFetchError;
      }

      let couponId = existingCoupon?.id ?? null;

      if (!couponId) {
        const { data: newCoupon, error: couponInsertError } = await supabase
          .from('coupons')
          .insert({
            code,
            description: `Referral invite from ${userData.name || 'Only2U customer'}`,
            discount_type: 'fixed',
            discount_value: 100,
            max_uses: null,
            per_user_limit: 1,
            min_order_value: 0,
            is_active: true,
            created_by: userData.id,
          })
          .select('id')
          .single();

        if (couponInsertError) {
          throw couponInsertError;
        }

        couponId = newCoupon.id;
      }

      setReferralCouponId(couponId);

      const { data: usageData, error: usageError } = await supabase
        .from('coupon_usage')
        .select('id, discount_amount, used_at')
        .eq('coupon_id', couponId)
        .order('used_at', { ascending: false });

      if (usageError) {
        throw usageError;
      }

      console.log('📊 Referral stats loaded:', {
        couponCode: code,
        couponId,
        usageCount: usageData?.length || 0,
        usageData: usageData,
      });

      const totalDiscount =
        usageData?.reduce((sum, usage) => sum + Number(usage.discount_amount || 0), 0) || 0;

      const referralInviteUses = usageData?.length || 0;

      const referralRewardCode = `REFREWARD${userData.id.slice(-8).toUpperCase()}`;
      const { data: referralRewardCoupon } = await supabase
        .from('coupons')
        .select('id, description, max_discount_value')
        .eq('code', referralRewardCode)
        .maybeSingle();

      const referralMetadata = parseReferralRewardMetadata(referralRewardCoupon?.description);
      const totalFriends =
        referralMetadata.referralCount > 0
          ? referralMetadata.referralCount
          : referralInviteUses;

      setReferralStats({
        totalFriends,
        totalDiscount,
        lastUsedAt: usageData && usageData.length > 0 ? usageData[0].used_at : null,
      });
    } catch (error) {
      console.error('Error loading referral data:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to load referral info',
        text2: 'Please try again in a moment.',
      });
    } finally {
      setReferralLoading(false);
    }
  }, [generateReferralCode, userData?.id, userData?.name]);

  // Refresh referral stats whenever the referral modal becomes visible
  useEffect(() => {
    if (showReferralModal && userData?.id) {
      loadReferralData();
    }
  }, [showReferralModal, userData?.id, loadReferralData]);

  const handleReferAndEarnPress = async () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to access referral rewards.',
      });
      handleLoginPress();
      return;
    }
    setShowReferralModal(true);
    await loadReferralData();
  };

  const PLAY_STORE_LINK = 'https://play.google.com/store/apps/details?id=com.only2u.only2u';
  const APP_STORE_LINK = 'https://apps.apple.com/in/app/only2u-virtual-try-on-store/id6753112805';

  const handleShareReferral = async () => {
    if (!referralCode) {
      Toast.show({
        type: 'info',
        text1: 'Generating Code',
        text2: 'Please wait while we prepare your referral code.',
      });
      return;
    }

    const message =
      `🎉 Download Only2U and get ₹100 off your first order!\n\n` +
      `Use my referral code: ${referralCode}\n\n` +
      `📱 Download Links:\n` +
      `• Android: ${PLAY_STORE_LINK}\n\n` +
      `• iOS: ${APP_STORE_LINK}\n\n` +
      `Tap the link, install the app, and apply the code while signing up. Happy shopping! 🛍️✨`;
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

  const handleCopyReferralCode = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    Toast.show({
      type: 'success',
      text1: 'Copied to clipboard',
      text2: 'Referral code ready to share!',
    });
  };

  const formatReferralDate = (value: string | null) => {
    if (!value) return 'No usage yet';
    try {
      const date = new Date(value);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return 'Recently used';
    }
  };

  // Fetch referral welcome coupon if user signed up with a referral code
  const loadReferralWelcomeCoupon = useCallback(async () => {
    if (!userData?.id) {
      setReferralWelcomeCoupon(null);
      return;
    }

    setLoadingReferralCoupon(true);
    try {
      // Find if user used a referral code during signup
      const { data: referralUsage, error: usageError } = await supabase
        .from('referral_code_usage')
        .select('referral_code, referral_code_id')
        .eq('user_id', userData.id)
        .order('used_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usageError && usageError.code !== 'PGRST116') {
        throw usageError;
      }

      if (!referralUsage) {
        setReferralWelcomeCoupon(null);
        return;
      }

      // Find the welcome coupon created for this user (starts with WELCOME)
      const { data: welcomeCoupon, error: couponError } = await supabase
        .from('coupons')
        .select('code, description, discount_value')
        .eq('created_by', userData.id)
        .like('code', 'WELCOME%')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (couponError && couponError.code !== 'PGRST116') {
        throw couponError;
      }

      if (welcomeCoupon) {
        setReferralWelcomeCoupon({
          code: welcomeCoupon.code,
          referralCode: referralUsage.referral_code,
          discountValue: welcomeCoupon.discount_value || 100,
          description: welcomeCoupon.description || 'Welcome to Only2U! ₹100 off your first order',
        });
      } else {
        setReferralWelcomeCoupon(null);
      }
    } catch (error) {
      console.error('Error loading referral welcome coupon:', error);
      setReferralWelcomeCoupon(null);
    } finally {
      setLoadingReferralCoupon(false);
    }
  }, [userData?.id]);

  // Load referral welcome coupon when user data is available
  useEffect(() => {
    if (userData?.id) {
      loadReferralWelcomeCoupon();
    } else {
      setReferralWelcomeCoupon(null);
    }
  }, [userData?.id, loadReferralWelcomeCoupon]);

  const handleCopyReferralCouponCode = async () => {
    if (!referralWelcomeCoupon?.code) return;
    await Clipboard.setStringAsync(referralWelcomeCoupon.code);
    Toast.show({
      type: 'success',
      text1: 'Coupon code copied!',
      text2: `Use ${referralWelcomeCoupon.code} at checkout`,
    });
  };

  const handleCopyRandomDiscountCode = async () => {
    if (!randomDiscountCode) return;
    await Clipboard.setStringAsync(randomDiscountCode);
    Toast.show({
      type: 'success',
      text1: 'Discount Code Copied!',
      text2: `Use ${randomDiscountCode} at checkout`,
    });
  };

  // Sample data for Profile feedbacks
  const SAMPLE_FEEDBACKS = [
    {
      id: 'sample-1',
      user_name: 'Rahul Sharma',
      feedback_text: 'The app is great, but I think the try-on feature takes a bit too long to load on older devices.',
      created_at: '2025-12-24T10:30:00Z',
      image_urls: [],
      admin_response: 'Thanks for your feedback, Rahul! We are actively optimizing the try-on performance for all devices in the upcoming update.'
    },
    {
      id: 'sample-2',
      user_name: 'Priya Patel',
      feedback_text: 'Found a bug in the wishlist screen. When I remove an item, it sometimes comes back after refreshing.',
      created_at: '2025-12-25T09:15:00Z',
      image_urls: ['https://images.unsplash.com/photo-1551650975-87deedd944c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'],
      admin_response: 'Hi Priya, sorry about that! We have identified the issue and a fix will be rolling out this week.'
    },
    {
      id: 'sample-3',
      user_name: 'Amit Kumar',
      feedback_text: 'Love the new collection! Can we have more filters for searching products by color?',
      created_at: '2025-12-25T14:20:00Z',
      image_urls: [],
      // No response for this one to show varied UI
    },
  ];

  // Feedback functions
  const loadFeedbacks = useCallback(async () => {
    setLoadingFeedbacks(true);
    try {
      const { data: feedbacksData, error } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('Error loading feedbacks:', error);
        // Fallback to sample data on error
        setFeedbacks(SAMPLE_FEEDBACKS);
        return;
      }

      if (!feedbacksData || feedbacksData.length === 0) {
        setFeedbacks(SAMPLE_FEEDBACKS);
      } else {
        setFeedbacks(feedbacksData);
      }

      // Load likes for current user
      const userId = userData?.id || user?.id;
      // Only try to load likes if we have IDs from real fetching (skip for sample data for now to avoid errors or mock it)
      const isSampleData = !feedbacksData || feedbacksData.length === 0;

      if (userId && !isSampleData) {
        // ... existing like loading logic ...
      }

      // If sample data, just initialize 0 likes
      if (isSampleData) {
        // Initialize empty like counts
        const likeCountsMap: Record<string, number> = {};
        SAMPLE_FEEDBACKS.forEach((f: any) => {
          likeCountsMap[f.id] = 0;
        });
        setFeedbackLikeCounts(likeCountsMap);
        return; // Skip the rest of DB logic
      }

      if (userId && feedbacksData && feedbacksData.length > 0) {
        const feedbackIds = feedbacksData.map(f => f.id);

        // Try to load user's likes
        try {
          const { data: likesData, error: likesError } = await supabase
            .from('feedback_likes')
            .select('feedback_id')
            .eq('user_id', userId)
            .in('feedback_id', feedbackIds);

          if (!likesError && likesData) {
            const likesMap: Record<string, boolean> = {};
            likesData.forEach((like: any) => {
              likesMap[like.feedback_id] = true;
            });
            setFeedbackLikes(likesMap);
          }
        } catch (likesErr) {
          // Table might not exist, that's okay
          console.log('Feedback likes table not available:', likesErr);
        }

        // Load like counts
        try {
          const likeCountsMap: Record<string, number> = {};
          for (const feedback of feedbacksData) {
            const { count, error: countError } = await supabase
              .from('feedback_likes')
              .select('*', { count: 'exact', head: true })
              .eq('feedback_id', feedback.id);

            if (!countError) {
              likeCountsMap[feedback.id] = count || 0;
            } else {
              likeCountsMap[feedback.id] = 0;
            }
          }
          setFeedbackLikeCounts(likeCountsMap);
        } catch (countErr) {
          // Table might not exist, initialize with zeros
          const likeCountsMap: Record<string, number> = {};
          feedbacksData.forEach((f: any) => {
            likeCountsMap[f.id] = 0;
          });
          setFeedbackLikeCounts(likeCountsMap);
        }
      } else {
        // Initialize empty like counts
        const likeCountsMap: Record<string, number> = {};
        (feedbacksData || []).forEach((f: any) => {
          likeCountsMap[f.id] = 0;
        });
        setFeedbackLikeCounts(likeCountsMap);
      }
    } catch (error) {
      console.error('Error loading feedbacks:', error);
      setFeedbacks(SAMPLE_FEEDBACKS);
    } finally {
      setLoadingFeedbacks(false);
    }
  }, [userData?.id, user?.id]);

  const handleLikeFeedback = async (feedbackId: string) => {
    const userId = userData?.id || user?.id;
    if (!userId) {
      showLoginSheet();
      return;
    }

    const isLiked = feedbackLikes[feedbackId];

    try {
      if (isLiked) {
        // Unlike
        const { error } = await supabase
          .from('feedback_likes')
          .delete()
          .eq('feedback_id', feedbackId)
          .eq('user_id', userId);

        if (!error) {
          setFeedbackLikes({ ...feedbackLikes, [feedbackId]: false });
          setFeedbackLikeCounts({
            ...feedbackLikeCounts,
            [feedbackId]: Math.max((feedbackLikeCounts[feedbackId] || 1) - 1, 0),
          });
        } else {
          // Table might not exist, just update UI optimistically
          setFeedbackLikes({ ...feedbackLikes, [feedbackId]: false });
          setFeedbackLikeCounts({
            ...feedbackLikeCounts,
            [feedbackId]: Math.max((feedbackLikeCounts[feedbackId] || 1) - 1, 0),
          });
        }
      } else {
        // Like
        const { error } = await supabase
          .from('feedback_likes')
          .insert([{ feedback_id: feedbackId, user_id: userId }]);

        if (!error) {
          setFeedbackLikes({ ...feedbackLikes, [feedbackId]: true });
          setFeedbackLikeCounts({
            ...feedbackLikeCounts,
            [feedbackId]: (feedbackLikeCounts[feedbackId] || 0) + 1,
          });
        } else {
          // Table might not exist, just update UI optimistically
          setFeedbackLikes({ ...feedbackLikes, [feedbackId]: true });
          setFeedbackLikeCounts({
            ...feedbackLikeCounts,
            [feedbackId]: (feedbackLikeCounts[feedbackId] || 0) + 1,
          });
        }
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Update UI optimistically even if database fails
      if (isLiked) {
        setFeedbackLikes({ ...feedbackLikes, [feedbackId]: false });
        setFeedbackLikeCounts({
          ...feedbackLikeCounts,
          [feedbackId]: Math.max((feedbackLikeCounts[feedbackId] || 1) - 1, 0),
        });
      } else {
        setFeedbackLikes({ ...feedbackLikes, [feedbackId]: true });
        setFeedbackLikeCounts({
          ...feedbackLikeCounts,
          [feedbackId]: (feedbackLikeCounts[feedbackId] || 0) + 1,
        });
      }
    }
  };

  const pickFeedbackImages = async () => {
    if (newFeedbackImages.length >= 5) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 5 images',
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const remainingSlots = 5 - newFeedbackImages.length;
        const imagesToAdd = result.assets.slice(0, remainingSlots);
        const newImageUris = imagesToAdd.map(asset => asset.uri);
        setNewFeedbackImages([...newFeedbackImages, ...newImageUris]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick images. Please try again.',
      });
    }
  };

  const pickFeedbackVideos = async () => {
    if (newFeedbackVideos.length >= 2) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 2 videos',
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your videos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 0.8,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets[0]) {
        setNewFeedbackVideos([...newFeedbackVideos, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error picking video:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick video. Please try again.',
      });
    }
  };

  const removeFeedbackImage = (index: number) => {
    setNewFeedbackImages(newFeedbackImages.filter((_, i) => i !== index));
  };

  const removeFeedbackVideo = (index: number) => {
    setNewFeedbackVideos(newFeedbackVideos.filter((_, i) => i !== index));
  };

  const uploadFeedbackMedia = async (uri: string, type: 'image' | 'video'): Promise<string | null> => {
    try {
      const userId = userData?.id || user?.id || 'anonymous';
      const fileExt = uri.split('.').pop();
      const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const bucket = type === 'image' ? 'feedback-images' : 'feedback-videos';

      // Read file as base64 using Expo FileSystem
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Convert base64 to Uint8Array
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(fileName, bytes, {
          contentType: type === 'image' ? `image/${fileExt}` : `video/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('Error uploading media:', error);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading media:', error);
      return null;
    }
  };

  const handleSubmitNewFeedback = async () => {
    if (!newFeedbackText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Feedback Required',
        text2: 'Please enter your feedback before submitting',
      });
      return;
    }

    setSubmittingFeedback(true);

    try {
      // Upload images
      const uploadedImageUrls: string[] = [];
      for (const imageUri of newFeedbackImages) {
        const url = await uploadFeedbackMedia(imageUri, 'image');
        if (url) uploadedImageUrls.push(url);
      }

      // Upload videos
      const uploadedVideoUrls: string[] = [];
      for (const videoUri of newFeedbackVideos) {
        const url = await uploadFeedbackMedia(videoUri, 'video');
        if (url) uploadedVideoUrls.push(url);
      }

      // Combine image and video URLs
      const mediaUrls = [...uploadedImageUrls, ...uploadedVideoUrls];

      // Save feedback
      const feedbackData = {
        user_id: userData?.id || user?.id || null,
        user_email: userData?.email || user?.email || null,
        user_name: userData?.name || 'Anonymous',
        feedback_text: newFeedbackText.trim(),
        image_urls: mediaUrls.length > 0 ? mediaUrls : null,
        created_at: new Date().toISOString(),
      };

      const { error: feedbackError } = await supabase
        .from('feedback')
        .insert([feedbackData]);

      if (feedbackError) {
        console.error('Error submitting feedback:', feedbackError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Failed to submit feedback. Please try again.',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Thank You!',
          text2: 'Your feedback has been submitted successfully',
        });

        // Reset form
        setNewFeedbackText('');
        setNewFeedbackImages([]);
        setNewFeedbackVideos([]);
        setShowFeedbackForm(false);

        // Reload feedbacks
        loadFeedbacks();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit feedback. Please try again.',
      });
    } finally {
      setSubmittingFeedback(false);
    }
  };

  const handleApplyReferralCodeInput = useCallback(async () => {
    const trimmed = referralCodeInput.trim().toUpperCase();
    if (!trimmed) {
      setReferralCodeState('invalid');
      setReferralCodeMessage('Enter a referral code to apply.');
      setAppliedReferralCoupon(null);
      return;
    }

    setReferralCodeState('checking');
    setReferralCodeMessage('');

    try {
      try {
        const { validateReferralCode } = await import('~/services/referralCodeService');
        const validation = await validateReferralCode(trimmed);

        if (!validation.isValid) {
          setReferralCodeState('invalid');
          setReferralCodeMessage(validation.message || 'Invalid or inactive referral code.');
          setAppliedReferralCoupon(null);
          return;
        }

        setReferralCodeState('valid');
        setReferralCodeMessage('Referral code applied! You will see ₹100 off on your first order.');
        setAppliedReferralCoupon({
          code: trimmed,
          couponId: 'pending', // Not needed for redemption but checking types
          referrerId: null,    // Not needed
          referralCodeId: validation.referralCodeId // CRITICAL: This is what we need
        });
      } catch (err) {
        console.error('Validation service error', err);
        setReferralCodeState('invalid');
        setReferralCodeMessage('Error validating code.');
      }
      return;

      // Legacy code removed
      /*
      const { data, error } = await supabase
        .from('coupons')
        .select('id, code, is_active, discount_type, discount_value, created_by')
        .eq('code', trimmed)
        .eq('is_active', true)
        .maybeSingle();

      if (error || !data) {
        setReferralCodeState('invalid');
        setReferralCodeMessage('Invalid or inactive referral code.');
        setAppliedReferralCoupon(null);
        return;
      }

      if (data.discount_type !== 'fixed' || Number(data.discount_value) < 100) {
        setReferralCodeState('invalid');
        setReferralCodeMessage('This code is not eligible for referral discount.');
        setAppliedReferralCoupon(null);
        return;
      }

      setReferralCodeState('valid');
      setReferralCodeMessage('Referral code applied! You will see ₹100 off on your first order.');
      setAppliedReferralCoupon({
        code: trimmed,
        couponId: data.id,
        referrerId: data.created_by || null
      });
      */
    } catch (error) {
      console.error('Referral code apply error:', error);
      setReferralCodeState('invalid');
      setReferralCodeMessage('Unable to verify referral code. Please try again.');
      setAppliedReferralCoupon(null);
    }
  }, [referralCodeInput]);

  useEffect(() => {
    const loadShubhamastuCode = async () => {
      if (!userData?.id) return;
      try {
        console.log('[Profile] fetching shubhamastu code for:', userData.id);
        const { data, error } = await supabase
          .from('shubhamastu_codes')
          .select('code')
          .eq('assigned_to_user_id', userData.id)
          .maybeSingle();

        console.log('[Profile] shubhamastu response:', { data, error });

        if (!error && data) {
          setShubhamastuCode(data.code);
        } else {
          // Debug: fallback if maybeSingle returns null
          console.log('[Profile] No shubhamastu code found for user.');
        }
      } catch (error) {
        console.error('Error loading shubhamastu code:', error);
      }
    };

    loadShubhamastuCode();
  }, [userData?.id]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUserData();
    } catch (error) {
      console.error('Error refreshing profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Error during logout:', error);
        return;
      }

      // Clear all stored auth data
      await AsyncStorage.removeItem('userData');
      await AsyncStorage.removeItem('last_logged_in_phone');
      await AsyncStorage.removeItem('pending_phone_for_profile');
      await AsyncStorage.removeItem('cached_user_data');
      setUser(null);
      await clearWishlist();

      Toast.show({
        type: 'success',
        text1: 'Logged out successfully',
        text2: 'You have been logged out of your account'
      });
    } catch (error) {
      console.error('Error during logout:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please try again'
      });
    }
  };

  const handleDeleteProfile = () => {
    setShowDeleteModal(true);
  };

  const confirmDeleteProfile = async () => {
    setIsDeleting(true);
    try {
      await deleteUserProfile();
    } catch (error) {
      console.error('Error during delete profile:', error);
      // Continue anyway - we'll still clear everything
    }

    // Always clear everything and navigate, regardless of errors
    try {
      await clearWishlist();
      setUser(null);

      Toast.show({
        type: 'success',
        text1: t('profile_deleted_successfully'),
        text2: 'Your account has been deleted'
      });
    } catch (error) {
      console.error('Error during cleanup:', error);
      // Still show success and navigate
      Toast.show({
        type: 'success',
        text1: 'Profile Deleted',
        text2: 'You have been signed out'
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const cancelDeleteProfile = () => {
    setShowDeleteModal(false);
  };

  // OTP Login functions
  const resetSheetState = () => {
    setCountryCode('+91');
    setPhone('');
    setOtp('');
    setError(null);
    setSending(false);
    setVerifying(false);
    setOtpSent(false);
    setResendIn(0);
    setReferralCodeInput('');
    setReferralCodeState('idle');
    setReferralCodeMessage('');
    setAppliedReferralCoupon(null);
  };

  // Store generated OTP for verification
  const [generatedOtp, setGeneratedOtp] = useState<string>('');

  const handleSendOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!trimmed || trimmed.length < 10) {
        setError('Enter a valid 10-digit phone number');
        return;
      }
      setSending(true);
      const fullPhone = `${countryCode}${trimmed}`;

      // Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);

      // Send OTP via WhatsApp using whatsappService (Meta API)
      const { sendWhatsAppOTP } = await import('~/services/whatsappService');
      await sendWhatsAppOTP(fullPhone, otp);

      setOtpSent(true);
      setResendIn(30);

      Toast.show({
        type: 'success',
        text1: 'OTP Sent!',
        text2: 'Check your WhatsApp for the verification code',
      });
    } catch (e: any) {
      console.error('WhatsApp OTP Error:', e);
      setError(e?.message || 'Failed to send OTP via WhatsApp');
    } finally {
      setSending(false);
    }
  };

  const handleVerifyOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!otp || otp.trim().length < 6) {
        setError('Enter the 6-digit OTP');
        return;
      }
      setVerifying(true);
      const fullPhone = `${countryCode}${trimmed}`;

      // Verify OTP against locally stored one
      if (otp.trim() !== generatedOtp) {
        setError('Invalid OTP. Please check and try again.');
        setVerifying(false);
        return;
      }

      // OTP is correct! Now sign in with Supabase using anonymous or phone-based auth
      // First check if a user with this phone exists
      const { data: existingUser, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('phone', fullPhone)
        .maybeSingle();

      if (existingUser) {
        // User exists - sign in anonymously and update the existing user record
        // to use the new anonymous session ID so it persists
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          setError('Login failed. Please try again.');
          setVerifying(false);
          return;
        }

        const newUserId = signInData?.user?.id;

        if (newUserId && newUserId !== existingUser.id) {
          // Update the existing user's ID to match the new anonymous session ID
          // This ensures the session can find the user profile on app restart
          console.log('[WhatsApp OTP] Updating user ID from', existingUser.id, 'to', newUserId);

          const { error: updateError } = await supabase
            .from('users')
            .update({ id: newUserId })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('Failed to update user ID:', updateError);
            // Fallback: try to use existing user data directly
          }
        }

        // CRITICAL: Cache user data and phone for persistence across app restarts
        await AsyncStorage.setItem('last_logged_in_phone', fullPhone);
        await AsyncStorage.setItem('cached_user_data', JSON.stringify(existingUser));
        console.log('[WhatsApp OTP] Cached user data for persistence');

        // Update user data to link with this phone
        await refreshUserData();
      } else {
        // New user - sign in anonymously and show onboarding
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          setError('Login failed. Please try again.');
          setVerifying(false);
          return;
        }

        // Store phone temporarily for onboarding profile creation
        await AsyncStorage.setItem('pending_phone_for_profile', fullPhone);
      }

      Toast.show({
        type: 'success',
        text1: 'Login Successful',
        text2: 'Welcome to Only2U!',
      });

      // Force refresh user data
      await refreshUserData();

      // Check if profile exists, if not show onboarding
      const { data: sessionData } = await supabase.auth.getSession();
      const authUser = sessionData?.session?.user;

      if (authUser) {
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('id')
          .eq('id', authUser.id)
          .maybeSingle();

        if (!profile) {
          // No profile -> store phone and show onboarding
          hideLoginSheet();
          setName('');
          setShowOnboarding(true);
        } else {
          hideLoginSheet();
        }
      } else {
        hideLoginSheet();
      }

      // Clear state
      setGeneratedOtp('');
      resetSheetState();
      Keyboard.dismiss();
    } catch (e: any) {
      console.error('OTP verification error:', e);
      setError(e?.message || 'OTP verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);

      const redirectUrl = 'only2u://'; // Hardcoded for APK build

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const codeMatch = result.url.match(/[?&]code=([^&]+)/);

          if (codeMatch && codeMatch[1]) {
            const code = codeMatch[1];
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
            if (sessionError) throw sessionError;

            // Force update user context immediately
            await refreshUserData();

            // Success handling
            Toast.show({
              type: 'success',
              text1: 'Google Login Successful',
              text2: 'Welcome to Only2U!',
            });
            // Check for profile creation need
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              // We can rely on userData from context now, or check DB directly as fallback
              const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .single();

              if (!profile && profileError && (profileError.code === 'PGRST116' || profileError.details?.includes('Results contain 0 rows'))) {
                hideLoginSheet();
                setName('');
                setShowOnboarding(true);
              } else {
                hideLoginSheet();
              }
            } else {
              hideLoginSheet();
            }
            resetSheetState();
            return;
          }

          const match = result.url.match(/access_token=([^&]+)/);
          const refreshTokenMatch = result.url.match(/refresh_token=([^&]+)/);

          const accessToken = match ? match[1] : null;
          const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : null;

          if (accessToken && refreshToken) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (sessionError) throw sessionError;

            // Force refresh explicitly
            await refreshUserData();

            Toast.show({
              type: 'success',
              text1: 'Google Login Successful',
              text2: 'Welcome to Only2U!',
            });
            // Check for profile creation need
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (authUser) {
              const { data: profile, error: profileError } = await supabase
                .from('users')
                .select('id')
                .eq('id', authUser.id)
                .single();

              if (!profile && profileError && (profileError.code === 'PGRST116' || profileError.details?.includes('Results contain 0 rows'))) {
                hideLoginSheet();
                setName('');
                setShowOnboarding(true);
              } else {
                hideLoginSheet();
              }
            } else {
              hideLoginSheet();
            }
            resetSheetState();
          } else {
            const parsed = Linking.parse(result.url);
            if (parsed.queryParams?.access_token && parsed.queryParams?.refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: parsed.queryParams.access_token as string,
                refresh_token: parsed.queryParams.refresh_token as string,
              });
              if (sessionError) throw sessionError;
              Toast.show({ type: 'success', text1: 'Login Successful' });
              // Check for profile creation need
              const { data: { user: authUser } } = await supabase.auth.getUser();
              if (authUser) {
                const { data: profile, error: profileError } = await supabase
                  .from('users')
                  .select('id')
                  .eq('id', authUser.id)
                  .single();

                if (!profile && profileError && (profileError.code === 'PGRST116' || profileError.details?.includes('Results contain 0 rows'))) {
                  hideLoginSheet();
                  setName('');
                  setShowOnboarding(true);
                } else {
                  hideLoginSheet();
                }
              } else {
                hideLoginSheet();
              }
              resetSheetState();
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Google Login Error:', err);
      if (err.message !== 'User cancelled') {
        setError(err.message || 'Google Login Failed');
      }
    }
  };

  const handleCreateProfile = async () => {
    try {
      setCreatingProfile(true);
      setError(null);
      if (!name.trim()) {
        setError('Please enter your name');
        setCreatingProfile(false);
        return;
      }
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setError('No auth user found');
        setCreatingProfile(false);
        return;
      }

      // Get phone number from AsyncStorage (stored during OTP verification)
      // or fall back to auth user phone
      let userPhone = authUser.phone || null;
      const pendingPhone = await AsyncStorage.getItem('pending_phone_for_profile');
      if (pendingPhone) {
        userPhone = pendingPhone;
        // Clear it after use
        await AsyncStorage.removeItem('pending_phone_for_profile');
      }

      const newProfile = {
        id: authUser.id,
        name: name.trim(),
        phone: userPhone,
      } as any;
      const { error: insertError } = await supabase.from('users').insert([newProfile]);
      if (insertError) {
        setError(insertError.message);
        setCreatingProfile(false);
        return;
      }

      // CRITICAL: Cache user data and phone for persistence across app restarts
      if (userPhone) {
        await AsyncStorage.setItem('last_logged_in_phone', userPhone);
      }
      await AsyncStorage.setItem('cached_user_data', JSON.stringify(newProfile));
      console.log('[Profile] Cached new user data for persistence');

      if (appliedReferralCoupon && appliedReferralCoupon.referralCodeId) {
        try {
          const { redeemReferralCode } = await import('~/services/referralCodeService');

          await redeemReferralCode(
            appliedReferralCoupon.referralCodeId,
            appliedReferralCoupon.code,
            authUser.id,
            authUser.email || undefined,
            name.trim(),
            userPhone || undefined
          );

          Toast.show({
            type: 'success',
            text1: 'Referral saved',
            text2: '₹100 off coupon added to your account.',
          });
        } catch (couponError) {
          console.error('Error redeeming referral code:', couponError);
        }
      }

      // Force refresh user data context
      await refreshUserData();

      setShowOnboarding(false);
      setName('');
      setReferralCodeInput('');
      setReferralCodeState('idle');
      setReferralCodeMessage('');
      setAppliedReferralCoupon(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to create profile');
    } finally {
      setCreatingProfile(false);
    }
  };

  const handleLoginPress = () => {
    console.log('Login button pressed');
    try {
      showLoginSheet();
      resetSheetState();
      console.log('Login sheet should be visible now:', isLoginSheetVisible);
    } catch (error) {
      console.error('Error showing login sheet:', error);
    }
  };

  // Profile photo upload functions
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

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handlePhotoUpload(result.assets[0].uri);
    }
    setShowPhotoPickerModal(false);
  };

  const pickFromGallery = async () => {
    const hasPermission = await requestGalleryPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await handlePhotoUpload(result.assets[0].uri);
    }
    setShowPhotoPickerModal(false);
  };

  const closePermissionModal = () => setPermissionModal(prev => ({ ...prev, visible: false }));

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

  const removeProfilePhoto = async () => {
    if (!userData?.id || !userData?.profilePhoto) return false;

    try {
      setDeletingPhoto(true);

      const deleted = await deleteProfilePhotoFromStorage(userData.profilePhoto);
      if (!deleted) {
        throw new Error('Failed to remove photo from storage');
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ profilePhoto: null })
        .eq('id', userData.id);

      if (updateError) {
        throw updateError;
      }

      setUserData({ ...userData, profilePhoto: undefined });
      await refreshUserData();

      Toast.show({
        type: 'success',
        text1: 'Photo Removed',
        text2: 'Your profile photo has been deleted.',
      });

      return true;
    } catch (error) {
      console.error('Error deleting profile photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Unable to Delete',
        text2: 'Something went wrong while removing your photo. Please try again.',
      });
      return false;
    } finally {
      setDeletingPhoto(false);
    }
  };

  const handleDeleteProfilePhoto = () => {
    if (!userData?.profilePhoto) {
      Toast.show({
        type: 'info',
        text1: 'No Photo Found',
        text2: 'You do not have a profile photo to remove.',
      });
      return;
    }

    setShowPhotoPickerModal(false);
    setShowDeletePhotoModal(true);
  };

  const handlePhotoUpload = async (uri: string) => {
    if (!userData?.id) {
      Toast.show({
        type: 'error',
        text1: 'Not Logged In',
        text2: 'Please log in to update your profile photo',
      });
      return;
    }

    try {
      setUploadingPhoto(true);

      // Validate the image first
      const validation = await validateImage(uri);
      if (!validation.valid) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Image',
          text2: validation.error || 'Please select a valid image file.',
        });
        return;
      }

      // Upload the image
      const result = await uploadProfilePhoto(uri);

      if (result.success && result.url) {
        // Update user profile in database
        const { error: updateError } = await supabase
          .from('users')
          .update({ profilePhoto: result.url })
          .eq('id', userData.id);

        if (updateError) {
          throw updateError;
        }

        // Refresh user data to show new photo
        await refreshUserData();

        Toast.show({
          type: 'profilePhotoSuccess',
          text1: 'Photo Updated',
          text2: 'Your profile photo has been updated successfully!',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Upload Failed',
          text2: result.error || 'Failed to upload profile picture. Please try again.',
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: 'An error occurred while uploading your picture.',
      });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handlePhotoPress = async () => {
    if (!userData?.id) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please log in to update your profile photo',
      });
      return;
    }

    if (!hasSeenPhotoTutorial) {
      setShowPhotoTutorialModal(true);
      return;
    }

    setShowPhotoPickerModal(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={['#F53F7A']}
            tintColor="#F53F7A"
          />
        }
      >
        {/* Profile Section */}
        <View style={styles.profileSection}>
          {isUserLoading ? (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <ActivityIndicator size="large" color="#F53F7A" />
            </View>
          ) : (userData || user ? (
            <>
              <View style={styles.avatarContainer}>
                {userData?.profilePhoto ? (
                  <Image source={{ uri: userData.profilePhoto }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatar}>
                    <Ionicons name="person" size={40} color="#F53F7A" />
                  </View>
                )}
                {/* Camera/Edit Button */}
                <TouchableOpacity
                  style={styles.cameraButton}
                  onPress={handlePhotoPress}
                  disabled={uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="camera" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.profileTextContainer}>
                <Text style={styles.userName}>
                  {userData?.name || user?.name || 'User'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.headerFeedbackButton}
                onPress={handleFeedback}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={{ marginRight: 6, color: '#F53F7A', fontWeight: 'bold' }}>Feedback</Text>
                <Ionicons name="chatbubble-ellipses-outline" size={24} color="#F53F7A" />
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.loginPromptContainer}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Ionicons name="person-outline" size={40} color="#ccc" />
                </View>
              </View>
              <View style={styles.profileTextContainer}>
                <Text style={styles.loginPromptTitle}>Welcome to Only2U</Text>
                <Text style={styles.loginPromptSubtitle}>Login to access your profile, orders, and wishlist</Text>
                <TouchableOpacity
                  style={styles.loginButton}
                  onPress={handleLoginPress}
                  activeOpacity={0.7}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="log-in-outline" size={20} color="#fff" />
                  <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>
              </View>

            </View>
          ))}

        </View>

        {/* Random 100rs Discount Code Section - Only for users who signed up with referral code AND don't have a Shubhamastu code */}
        {userData?.id && referralWelcomeCoupon && randomDiscountCode && !shubhamastuCode && (
          <View style={[styles.referralWelcomeCouponCard, { padding: 10, marginTop: 12, marginBottom: 4 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={[styles.referralWelcomeCouponTitle, { fontSize: 13, flex: 1 }]}>Welcome Discount Code</Text>
              <View style={[styles.referralWelcomeCouponCodeBox, { paddingVertical: 4, paddingHorizontal: 12, marginLeft: 8, backgroundColor: '#FFF0F5', borderColor: '#F53F7A', borderWidth: 1 }]}>
                <Text style={[styles.referralWelcomeCouponCodeValue, { fontSize: 13, color: '#F53F7A' }]}>
                  {randomDiscountCode}
                </Text>
              </View>
            </View>
            <Text style={{ fontSize: 9, color: '#888', textAlign: 'center' }}>
              * This can only be redeemed once on a minimum order of Rs.500 . 1 month validity.
            </Text>
          </View>
        )}

        {/* Shubhamastu Coupon Code - Only for users who signed up with special referral code */}
        {userData?.id && shubhamastuCode && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              Clipboard.setStringAsync(shubhamastuCode);
              Toast.show({ type: 'success', text1: 'Code Copied!', text2: shubhamastuCode });
            }}
            style={[styles.referralWelcomeCouponCard, { backgroundColor: '#FFF0F5', borderColor: '#F53F7A', padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>

            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                <Ionicons name="gift" size={18} color="#F53F7A" style={{ marginRight: 6 }} />
                <Text style={[styles.referralWelcomeCouponTitle, { fontSize: 15 }]}>Shubhamastu Gift!</Text>
              </View>
              <Text style={[styles.referralWelcomeCouponSubtitle, { fontSize: 12 }]}>
                Tap to copy your special code
              </Text>
            </View>

            <View style={{
              backgroundColor: '#fff',
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#FFE4EF',
              borderStyle: 'dashed'
            }}>
              <Text style={{ color: '#F53F7A', fontWeight: 'bold', fontSize: 14 }}>
                {shubhamastuCode}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Refer & Earn */}
        <TouchableOpacity
          style={styles.referCard}
          onPress={handleReferAndEarnPress}
          activeOpacity={0.85}
        >
          <View style={styles.referIconCircle}>
            <Ionicons name="gift" size={22} color="#F53F7A" />
          </View>
          <View style={styles.referTextBlock}>
            <Text style={styles.referCardTitle}>Refer & Earn</Text>
            <Text style={styles.referCardSubtitle}>
              Share your code, friends get 100 coins
            </Text>
          </View>
          <View style={styles.referRewardPill}>
            <Ionicons name="share-social-outline" size={16} color="#F53F7A" />
            <Text style={styles.referRewardText}>Invite</Text>
          </View>
        </TouchableOpacity>

        {/* Referral Welcome Coupon - Show if user signed up with a referral code */}
        {userData?.id && referralWelcomeCoupon && (
          <View style={styles.referralWelcomeCouponCard}>
            <View style={styles.referralWelcomeCouponHeader}>
              <View style={styles.referralWelcomeCouponIcon}>
                <Ionicons name="ticket" size={24} color="#10B981" />
              </View>
              <View style={styles.referralWelcomeCouponTextContainer}>
                <Text style={styles.referralWelcomeCouponTitle}>Your Welcome Coupon</Text>
                <Text style={styles.referralWelcomeCouponSubtitle}>
                  You signed up with code: {referralWelcomeCoupon.referralCode}
                </Text>
              </View>
            </View>
            <View style={styles.referralWelcomeCouponCodeContainer}>
              <View style={styles.referralWelcomeCouponCodeBox}>
                <Text style={styles.referralWelcomeCouponCodeLabel}>Coupon Code</Text>
                <Text style={styles.referralWelcomeCouponCodeValue}>
                  {referralWelcomeCoupon.code}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.referralWelcomeCouponCopyButton}
                onPress={handleCopyReferralCouponCode}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={18} color="#10B981" />
                <Text style={styles.referralWelcomeCouponCopyText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.referralWelcomeCouponDiscount}>
              <Ionicons name="pricetag" size={16} color="#10B981" />
              <Text style={styles.referralWelcomeCouponDiscountText}>
                ₹{referralWelcomeCoupon.discountValue} off on your first order
              </Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={[
            styles.menuItem,
            {
              backgroundColor: '#FFF0F5',
              marginHorizontal: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#FFD6E5',
              marginVertical: 8,
              paddingVertical: 12,
              borderBottomWidth: 0,
              shadowColor: '#F53F7A',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 2,
            }
          ]}
          onPress={handleResellerEarnings}
        >
          <View style={[styles.menuItemIconCircle, { backgroundColor: '#fff' }]}>
            <MaterialCommunityIcons name="currency-inr" size={20} color="#F53F7A" />
          </View>
          <View style={styles.menuItemTextContainer}>
            <Text style={[styles.menuItemTitle, { color: '#B91C4B' }]}>Reseller Earnings</Text>
            <Text style={[styles.menuItemSubtitle, { color: '#BE185D' }]}>
              View commissions and payouts from reseller orders
            </Text>
          </View>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 4 }}>
            <Ionicons name="chevron-forward" size={18} color="#F53F7A" />
          </View>
        </TouchableOpacity>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {/* New red actions */}


          <TouchableOpacity style={styles.menuItem} onPress={handleMyOrders}>
            <Ionicons name="bag-outline" size={24} color="#333" />
            <Text style={styles.menuText}>{t('my_orders')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleBecomeSeller}>
            <Ionicons name="storefront-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>Become a Vendor</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleJoinInfluencer}>
            <Ionicons name="megaphone-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>Join as Influencer</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleEditProfile}>
            <Ionicons name="person-outline" size={24} color="#333" />
            <Text style={styles.menuText}>{t('edit_profile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>





          {/* Admin Panel - Only visible for admin users */}
          {((userData || user)?.user_type === 'admin') && (
            <TouchableOpacity style={styles.menuItem} onPress={handleAdminPanel}>
              <Ionicons name="settings-outline" size={24} color="#FF6B35" />
              <Text style={[styles.menuText, { color: '#FF6B35' }]}>Admin Panel</Text>
              <Ionicons name="chevron-forward" size={20} color="#FF6B35" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.menuItem} onPress={handleTermsAndConditions}>
            <Ionicons name="document-text-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Terms & Conditions</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handlePrivacyPolicy}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.menuItem} onPress={handleRefundPolicy}>
            <Ionicons name="card-outline" size={24} color="#333" />
            <Text style={styles.menuText}>Refund Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#999" />
          </TouchableOpacity>


          <TouchableOpacity style={styles.menuItem} onPress={handleDeleteProfile}>
            <Ionicons name="trash-outline" size={24} color="red" />
            <Text style={[styles.menuText, { color: 'red' }]}>{t('delete_profile')}</Text>
            <Ionicons name="chevron-forward" size={20} color="red" />
          </TouchableOpacity>

          {(userData || user) && (
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={24} color="red" />
              <Text style={[styles.menuText, { color: 'red' }]}>{t('logout')}</Text>
              <Ionicons name="chevron-forward" size={20} color="red" />
            </TouchableOpacity>
          )}
        </View>

        {/* Contact Support Button */}
        <TouchableOpacity style={styles.supportButton} onPress={handleHelpCenter}>
          <Text style={styles.supportButtonText}>{t('contact_support')}</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Only2U v1.0.2</Text>
          <Text style={styles.footerText}>© 2025 Only2U Fashion Private Limited</Text>
        </View>
      </ScrollView>

      {/* Referral Modal */}
      <Modal
        visible={showReferralModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferralModal(false)}
      >
        <View style={styles.referralOverlay}>
          <View style={styles.referralContainer}>
            <View style={styles.referralHeader}>
              <View style={styles.referralHeaderIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.referralTitle}>Invite & Earn</Text>
                <Text style={styles.referralSubtitle}>Friends get additional 100 coins</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReferralModal(false)}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {referralLoading ? (
              <View style={styles.referralLoading}>
                <ActivityIndicator size="large" color="#F53F7A" />
                <Text style={styles.referralLoadingText}>Preparing your invite...</Text>
              </View>
            ) : (
              <>
                <View style={styles.referralCodeCard}>
                  <View>
                    <Text style={styles.referralCodeLabel}>Your code</Text>
                    <Text style={styles.referralCodeValue}>{referralCode || '— — —'}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.copyButton}
                    onPress={handleCopyReferralCode}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="copy-outline" size={18} color="#F53F7A" />
                    <Text style={styles.copyButtonText}>Copy</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.referralStatsContainer}>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>{referralStats.totalFriends}</Text>
                    <Text style={styles.referralStatLabel}>Friends Joined</Text>
                  </View>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>{referralStats.totalDiscount.toFixed(0)} Coins</Text>
                    <Text style={styles.referralStatLabel}>Total Coins Earned</Text>
                  </View>
                  <View style={styles.referralStat}>
                    <Text style={styles.referralStatValue}>
                      {formatReferralDate(referralStats.lastUsedAt)}
                    </Text>
                    <Text style={styles.referralStatLabel}>Last used</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.whatsappButton}
                  onPress={handleShareReferral}
                  activeOpacity={0.85}
                >
                  <Ionicons name="logo-whatsapp" size={20} color="#fff" />
                  <Text style={styles.whatsappButtonText}>Share on WhatsApp</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeleteModal}
        transparent={true}
        animationType="fade"
        onRequestClose={cancelDeleteProfile}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Ionicons name="warning" size={32} color="#FF6B6B" />
              <Text style={styles.modalTitle}>{t('delete_profile')}</Text>
            </View>

            <Text style={styles.modalMessage}>
              {t('delete_profile_confirm')}
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={cancelDeleteProfile}
                disabled={isDeleting}
              >
                <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.deleteButton,
                  isDeleting && styles.disabledButton
                ]}
                onPress={confirmDeleteProfile}
                disabled={isDeleting}
              >
                <Text style={styles.deleteButtonText}>
                  {isDeleting ? t('processing') : t('delete')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* Login Modal is handled globally by tab-navigator */}

      {/* Onboarding Modal */}
      <Modal visible={showOnboarding} transparent animationType="slide" onRequestClose={() => setShowOnboarding(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
            <View style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 24,
              paddingTop: 16,
              paddingBottom: 32,
              maxHeight: '85%'
            }}>
              {/* Handle indicator */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 48, height: 5, borderRadius: 3, backgroundColor: '#F53F7A' }} />
              </View>

              {/* Header with welcome message */}
              <View style={{ alignItems: 'center', marginBottom: 28 }}>
                <View style={{
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  backgroundColor: '#F53F7A',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 16,
                  shadowColor: '#F53F7A',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35,
                  shadowRadius: 12,
                  elevation: 8
                }}>
                  <Ionicons name="person-add" size={36} color="#fff" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: '800', color: '#1a1a1a', marginBottom: 4 }}>
                  👋 Welcome!
                </Text>
                <Text style={{ fontSize: 15, color: '#666', fontWeight: '500', textAlign: 'center', lineHeight: 22 }}>
                  What should we call you?
                </Text>
              </View>

              <View style={{ maxHeight: '60%' }}>
                <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 16 }}>
                  {/* Name input with icon */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '800',
                      color: '#F53F7A',
                      marginBottom: 10,
                      letterSpacing: 1,
                      textTransform: 'uppercase'
                    }}>
                      Your Name
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#FAFAFA',
                      borderRadius: 16,
                      paddingHorizontal: 16,
                      paddingVertical: Platform.OS === 'android' ? 4 : 0,
                      borderWidth: 2,
                      borderColor: name ? '#F53F7A' : '#E8E8E8',
                    }}>
                      <Ionicons name="person-outline" size={22} color={name ? '#F53F7A' : '#999'} style={{ marginRight: 12 }} />
                      <TextInput
                        value={name}
                        onChangeText={setName}
                        placeholder='Enter your name'
                        placeholderTextColor='#999'
                        style={{
                          flex: 1,
                          fontSize: 17,
                          color: '#1a1a1a',
                          fontWeight: '600',
                          paddingVertical: 16,
                        }}
                      />
                      {name.length > 0 && (
                        <TouchableOpacity onPress={() => setName('')}>
                          <Ionicons name="close-circle" size={20} color="#ccc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>

                  {!!error && (
                    <View style={{
                      marginBottom: 16,
                      backgroundColor: '#FFF0F3',
                      padding: 16,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: '#FFD6DF',
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}>
                      <Ionicons name="alert-circle" size={20} color="#B00020" style={{ marginRight: 10 }} />
                      <Text style={{ color: '#B00020', fontWeight: '600', flex: 1 }}>{error}</Text>
                    </View>
                  )}

                  {/* Continue button */}
                  <TouchableOpacity
                    disabled={creatingProfile || !name.trim()}
                    onPress={handleCreateProfile}
                    activeOpacity={0.8}
                    style={{
                      flexDirection: 'row',
                      backgroundColor: creatingProfile || !name.trim() ? '#F7A3BD' : '#F53F7A',
                      borderRadius: 16,
                      paddingVertical: 18,
                      alignItems: 'center',
                      justifyContent: 'center',
                      shadowColor: '#F53F7A',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.35,
                      shadowRadius: 10,
                      elevation: 6
                    }}
                  >
                    {creatingProfile ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Text style={{ color: '#fff', fontWeight: '800', fontSize: 17, marginRight: 8 }}>
                          Let's Go
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Skip link */}

                </ScrollView>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Photo Picker Modal */}
      <Modal
        visible={showPhotoTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoTutorialModal(false)}
      >
        <View style={styles.photoTutorialOverlay}>
          <View style={styles.photoTutorialCard}>
            <View style={styles.photoTutorialHeader}>
              <View style={styles.photoTutorialIcon}>
                <Ionicons name="sparkles-outline" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTutorialTitle}>Perfect Profile Photo Tips</Text>
                <Text style={styles.photoTutorialSubtitle}>
                  Follow these simple steps for a clear, beautiful profile picture.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPhotoTutorialModal(false)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoTutorialVideoWrapper}>
              <Video
                source={{ uri: PROFILE_PHOTO_TUTORIAL_VIDEO }}
                style={styles.photoTutorialVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.photoTutorialDescription}>
              Use good lighting, keep your face centered, and avoid heavy filters. This helps us
              match you with the right products and virtual try-ons.
            </Text>

            <TouchableOpacity
              style={styles.photoTutorialCheckboxRow}
              onPress={() => setPhotoTutorialDontShowAgain(!photoTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.photoTutorialCheckbox,
                  photoTutorialDontShowAgain && styles.photoTutorialCheckboxChecked,
                ]}
              >
                {photoTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.photoTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoTutorialPrimaryBtn}
              onPress={async () => {
                try {
                  if (photoTutorialDontShowAgain) {
                    await AsyncStorage.setItem(PROFILE_PHOTO_TUTORIAL_KEY, 'true');
                    setHasSeenPhotoTutorial(true);
                  }
                } catch (error) {
                  console.warn('Failed to save tutorial preference', error);
                } finally {
                  setShowPhotoTutorialModal(false);
                  setPhotoTutorialDontShowAgain(false);
                  setTimeout(() => setShowPhotoPickerModal(true), 200);
                }
              }}
            >
              <Text style={styles.photoTutorialPrimaryText}>Start Upload</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seller Tutorial Modal */}
      <Modal
        visible={showSellerTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSellerTutorialModal(false)}
      >
        <View style={styles.photoTutorialOverlay}>
          <View style={styles.photoTutorialCard}>
            <View style={styles.photoTutorialHeader}>
              <View style={styles.photoTutorialIcon}>
                <Ionicons name="storefront" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTutorialTitle}>How to Become a Vendor</Text>
                <Text style={styles.photoTutorialSubtitle}>
                  Learn the simple steps to start selling on Only2U
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowSellerTutorialModal(false)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoTutorialVideoWrapper}>
              <Video
                source={{ uri: SELLER_TUTORIAL_VIDEO }}
                style={styles.photoTutorialVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.photoTutorialDescription}>
              Set up your seller profile, add products, manage inventory, and start earning.
              Watch this video to learn how our platform works for sellers.
            </Text>

            <TouchableOpacity
              style={styles.photoTutorialCheckboxRow}
              onPress={() => setSellerTutorialDontShowAgain(!sellerTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.photoTutorialCheckbox,
                  sellerTutorialDontShowAgain && styles.photoTutorialCheckboxChecked,
                ]}
              >
                {sellerTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.photoTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoTutorialPrimaryBtn}
              onPress={async () => {
                try {
                  if (sellerTutorialDontShowAgain) {
                    await AsyncStorage.setItem(SELLER_TUTORIAL_KEY, 'true');
                    setHasSeenSellerTutorial(true);
                  }
                } catch (error) {
                  console.warn('Failed to save seller tutorial preference', error);
                } finally {
                  setShowSellerTutorialModal(false);
                  setSellerTutorialDontShowAgain(false);
                  setTimeout(() => navigation.navigate('VendorProfile' as never), 200);
                }
              }}
            >
              <Text style={styles.photoTutorialPrimaryText}>Get Started</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Influencer Tutorial Modal */}
      <Modal
        visible={showInfluencerTutorialModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowInfluencerTutorialModal(false)}
      >
        <View style={styles.photoTutorialOverlay}>
          <View style={styles.photoTutorialCard}>
            <View style={styles.photoTutorialHeader}>
              <View style={styles.photoTutorialIcon}>
                <Ionicons name="megaphone" size={22} color="#F53F7A" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.photoTutorialTitle}>How to Join as Influencer</Text>
                <Text style={styles.photoTutorialSubtitle}>
                  Discover how to earn commissions promoting Only2U products
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowInfluencerTutorialModal(false)}>
                <Ionicons name="close" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            </View>

            <View style={styles.photoTutorialVideoWrapper}>
              <Video
                source={{ uri: INFLUENCER_TUTORIAL_VIDEO }}
                style={styles.photoTutorialVideo}
                resizeMode={ResizeMode.COVER}
                shouldPlay
                useNativeControls
                isLooping
              />
            </View>

            <Text style={styles.photoTutorialDescription}>
              Share products with your audience, earn commissions on sales, and grow with exclusive benefits.
              This video explains our influencer program.
            </Text>

            <TouchableOpacity
              style={styles.photoTutorialCheckboxRow}
              onPress={() => setInfluencerTutorialDontShowAgain(!influencerTutorialDontShowAgain)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.photoTutorialCheckbox,
                  influencerTutorialDontShowAgain && styles.photoTutorialCheckboxChecked,
                ]}
              >
                {influencerTutorialDontShowAgain && (
                  <Ionicons name="checkmark" size={14} color="#fff" />
                )}
              </View>
              <Text style={styles.photoTutorialCheckboxText}>Do not show again</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoTutorialPrimaryBtn}
              onPress={async () => {
                try {
                  if (influencerTutorialDontShowAgain) {
                    await AsyncStorage.setItem(INFLUENCER_TUTORIAL_KEY, 'true');
                    setHasSeenInfluencerTutorial(true);
                  }
                } catch (error) {
                  console.warn('Failed to save influencer tutorial preference', error);
                } finally {
                  setShowInfluencerTutorialModal(false);
                  setInfluencerTutorialDontShowAgain(false);
                  setTimeout(() => navigation.navigate('JoinInfluencer' as never), 200);
                }
              }}
            >
              <Text style={styles.photoTutorialPrimaryText}>Apply Now</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showPhotoPickerModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPhotoPickerModal(false)}
      >
        <View style={styles.photoPickerOverlay}>
          <TouchableOpacity
            style={styles.photoPickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowPhotoPickerModal(false)}
          />
          <View style={styles.photoPickerContent}>
            {/* Drag Handle */}
            <View style={styles.dragHandle} />

            <View style={styles.photoPickerHeader}>
              <Text style={styles.photoPickerTitle}>Update Profile Photo</Text>
              <Text style={styles.photoPickerSubtitle}>Choose how you want to upload your photo</Text>
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
            </ScrollView>

            <TouchableOpacity
              style={styles.photoPickerOption}
              onPress={takePhoto}
              activeOpacity={0.7}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="camera" size={24} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Take Photo</Text>
                <Text style={styles.photoPickerOptionSubtitle}>Use camera to capture a new photo</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.photoPickerOption}
              onPress={pickFromGallery}
              activeOpacity={0.7}
            >
              <View style={styles.photoPickerOptionIcon}>
                <Ionicons name="images" size={24} color="#fff" />
              </View>
              <View style={styles.photoPickerOptionTextContainer}>
                <Text style={styles.photoPickerOptionTitle}>Choose from Gallery</Text>
                <Text style={styles.photoPickerOptionSubtitle}>Select from your photo library</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>

            {userData?.profilePhoto && (
              <TouchableOpacity
                style={styles.photoPickerOption}
                onPress={handleDeleteProfilePhoto}
                activeOpacity={0.7}
                disabled={deletingPhoto}
              >
                <View style={styles.photoPickerOptionIcon}>
                  <Ionicons name="trash" size={24} color="#fff" />
                </View>
                <View style={styles.photoPickerOptionTextContainer}>
                  <Text style={styles.photoPickerOptionTitle}>
                    {deletingPhoto ? 'Removing...' : 'Remove Photo'}
                  </Text>
                  <Text style={styles.photoPickerOptionSubtitle}>
                    Revert to your default avatar
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowPhotoPickerModal(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {uploadingPhoto && (
        <View style={styles.uploadingOverlay}>
          <View style={styles.uploadingCard}>
            <View style={styles.uploadingIconWrapper}>
              <Animated.View
                style={[
                  styles.uploadingPulseCircle,
                  { transform: [{ scale: uploadPulseScale }], opacity: uploadPulseOpacity },
                ]}
              />
              <Ionicons name="cloud-upload-outline" size={30} color="#F53F7A" />
            </View>
            <Text style={styles.uploadingTitle}>Uploading photo…</Text>
            <Text style={styles.uploadingSubtitle}>Hang tight while we refresh your look.</Text>
            <View style={styles.uploadingBar}>
              <Animated.View
                style={[styles.uploadingBarFill, { width: uploadProgressWidth }]}
              />
            </View>
          </View>
        </View>
      )}

      <Modal
        visible={permissionModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closePermissionModal}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={styles.permissionIconCircle}>
              <Ionicons
                name={permissionModal.context === 'camera' ? 'camera' : 'images'}
                size={28}
                color="#F53F7A"
              />
            </View>
            <Text style={styles.permissionTitle}>
              {permissionModal.context === 'camera'
                ? 'Camera Access Needed'
                : 'Photo Library Access Needed'}
            </Text>
            <Text style={styles.permissionBody}>
              {permissionModal.context === 'camera'
                ? 'Allow Only2U to use your camera to capture a fresh profile photo.'
                : 'Allow Only2U to access your library so you can pick a profile photo.'}
            </Text>
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={closePermissionModal}
                activeOpacity={0.8}
              >
                <Text style={styles.permissionSecondaryText}>Not Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionPrimaryButton}
                onPress={openSettingsForPermissions}
                activeOpacity={0.8}
              >
                <Ionicons name="settings" size={16} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.permissionPrimaryText}>Open Settings</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showDeletePhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingPhoto) setShowDeletePhotoModal(false);
        }}
      >
        <View style={styles.permissionOverlay}>
          <View style={styles.permissionModal}>
            <View style={[styles.permissionIconCircle, { backgroundColor: '#FEE2F2' }]}>
              <Ionicons name="trash" size={26} color="#F53F7A" />
            </View>
            <Text style={styles.permissionTitle}>Remove Profile Photo?</Text>
            <Text style={styles.permissionBody}>
              This will reset your avatar to the default placeholder. You can upload a new photo anytime.
            </Text>
            <View style={styles.permissionActions}>
              <TouchableOpacity
                style={styles.permissionSecondaryButton}
                onPress={() => {
                  if (!deletingPhoto) setShowDeletePhotoModal(false);
                }}
                activeOpacity={0.8}
                disabled={deletingPhoto}
              >
                <Text style={styles.permissionSecondaryText}>Keep Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.permissionPrimaryButton}
                onPress={async () => {
                  if (deletingPhoto) return;
                  const success = await removeProfilePhoto();
                  if (success) {
                    setShowDeletePhotoModal(false);
                  }
                }}
                activeOpacity={0.8}
                disabled={deletingPhoto}
              >
                {deletingPhoto ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.permissionPrimaryText}>Remove Photo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowFeedbackModal(false);
          setShowFeedbackForm(false);
          setNewFeedbackText('');
          setNewFeedbackImages([]);
          setNewFeedbackVideos([]);
        }}
      >
        <SafeAreaView style={styles.feedbackModalContainer} edges={['top']}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <View style={styles.feedbackModalContent}>
              {/* Header */}
              <View style={styles.feedbackModalHeader}>
                <View style={styles.feedbackModalHeaderLeft}>
                  <Text style={styles.feedbackModalTitle}>Community Feedback</Text>
                  <Text style={styles.feedbackModalSubtitle}>
                    Share your thoughts and see what others are saying
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowFeedbackModal(false);
                    setShowFeedbackForm(false);
                    setNewFeedbackText('');
                    setNewFeedbackImages([]);
                    setNewFeedbackVideos([]);
                  }}
                  style={styles.feedbackModalCloseButton}
                >
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Toggle between list and form */}
              <View style={styles.feedbackModalTabs}>
                <TouchableOpacity
                  style={[
                    styles.feedbackModalTab,
                    !showFeedbackForm && styles.feedbackModalTabActive,
                  ]}
                  onPress={() => setShowFeedbackForm(false)}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color={!showFeedbackForm ? '#F53F7A' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.feedbackModalTabText,
                      !showFeedbackForm && styles.feedbackModalTabTextActive,
                    ]}
                  >
                    View Feedback ({feedbacks.length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.feedbackModalTab,
                    showFeedbackForm && styles.feedbackModalTabActive,
                  ]}
                  onPress={() => setShowFeedbackForm(true)}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={showFeedbackForm ? '#F53F7A' : '#9CA3AF'}
                  />
                  <Text
                    style={[
                      styles.feedbackModalTabText,
                      showFeedbackForm && styles.feedbackModalTabTextActive,
                    ]}
                  >
                    Add Feedback
                  </Text>
                </TouchableOpacity>
              </View>

              {showFeedbackForm ? (
                /* Feedback Form */
                <ScrollView
                  style={styles.feedbackFormScrollView}
                  contentContainerStyle={styles.feedbackFormContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.feedbackFormSection}>
                    <Text style={styles.feedbackFormLabel}>Your Feedback</Text>
                    <TextInput
                      style={styles.feedbackFormTextInput}
                      placeholder="Share your thoughts, suggestions, or report any issues..."
                      placeholderTextColor="#9CA3AF"
                      value={newFeedbackText}
                      onChangeText={setNewFeedbackText}
                      multiline
                      numberOfLines={6}
                      textAlignVertical="top"
                      maxLength={2000}
                    />
                    <Text style={styles.feedbackFormCharCount}>
                      {newFeedbackText.length}/2000 characters
                    </Text>
                  </View>

                  {/* Images Section */}
                  <View style={styles.feedbackFormSection}>
                    <Text style={styles.feedbackFormLabel}>Add Images (Optional)</Text>
                    <Text style={styles.feedbackFormSubLabel}>
                      You can add up to 5 images
                    </Text>
                    <TouchableOpacity
                      style={styles.feedbackFormMediaButton}
                      onPress={pickFeedbackImages}
                      disabled={newFeedbackImages.length >= 5}
                    >
                      <Ionicons name="images-outline" size={20} color="#F53F7A" />
                      <Text style={styles.feedbackFormMediaButtonText}>Add Images</Text>
                    </TouchableOpacity>
                    {newFeedbackImages.length > 0 && (
                      <View style={styles.feedbackFormMediaGrid}>
                        {newFeedbackImages.map((uri, index) => (
                          <View key={index} style={styles.feedbackFormMediaPreview}>
                            <Image source={{ uri }} style={styles.feedbackFormMediaImage} />
                            <TouchableOpacity
                              style={styles.feedbackFormMediaRemove}
                              onPress={() => removeFeedbackImage(index)}
                            >
                              <Ionicons name="close-circle" size={24} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  {/* Videos Section */}
                  <View style={styles.feedbackFormSection}>
                    <Text style={styles.feedbackFormLabel}>Add Videos (Optional)</Text>
                    <Text style={styles.feedbackFormSubLabel}>
                      You can add up to 2 videos (max 60 seconds each)
                    </Text>
                    <TouchableOpacity
                      style={styles.feedbackFormMediaButton}
                      onPress={pickFeedbackVideos}
                      disabled={newFeedbackVideos.length >= 2}
                    >
                      <Ionicons name="videocam-outline" size={20} color="#F53F7A" />
                      <Text style={styles.feedbackFormMediaButtonText}>Add Video</Text>
                    </TouchableOpacity>
                    {newFeedbackVideos.length > 0 && (
                      <View style={styles.feedbackFormMediaGrid}>
                        {newFeedbackVideos.map((uri, index) => (
                          <View key={index} style={styles.feedbackFormMediaPreview}>
                            <Video
                              source={{ uri }}
                              style={styles.feedbackFormMediaVideo}
                              useNativeControls
                              resizeMode={ResizeMode.CONTAIN}
                            />
                            <TouchableOpacity
                              style={styles.feedbackFormMediaRemove}
                              onPress={() => removeFeedbackVideo(index)}
                            >
                              <Ionicons name="close-circle" size={24} color="#EF4444" />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.feedbackFormSubmitButton,
                      (!newFeedbackText.trim() || submittingFeedback) &&
                      styles.feedbackFormSubmitButtonDisabled,
                    ]}
                    onPress={handleSubmitNewFeedback}
                    disabled={!newFeedbackText.trim() || submittingFeedback}
                  >
                    {submittingFeedback ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.feedbackFormSubmitButtonText}>Submit Feedback</Text>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                /* Feedback List */
                <ScrollView
                  style={styles.feedbackListScrollView}
                  contentContainerStyle={styles.feedbackListContent}
                  refreshControl={
                    <RefreshControl
                      refreshing={loadingFeedbacks}
                      onRefresh={loadFeedbacks}
                      colors={['#F53F7A']}
                      tintColor="#F53F7A"
                    />
                  }
                >
                  {loadingFeedbacks && feedbacks.length === 0 ? (
                    <View style={styles.feedbackListEmpty}>
                      <ActivityIndicator size="large" color="#F53F7A" />
                      <Text style={styles.feedbackListEmptyText}>Loading feedbacks...</Text>
                    </View>
                  ) : feedbacks.length === 0 ? (
                    <View style={styles.feedbackListEmpty}>
                      <Ionicons name="chatbubbles-outline" size={64} color="#D1D5DB" />
                      <Text style={styles.feedbackListEmptyText}>No feedback yet</Text>
                      <Text style={styles.feedbackListEmptySubtext}>
                        Be the first to share your thoughts!
                      </Text>
                    </View>
                  ) : (
                    feedbacks.map((feedback) => (
                      <View key={feedback.id} style={styles.feedbackCard}>
                        <View style={styles.feedbackCardHeader}>
                          <View style={styles.feedbackCardUserInfo}>
                            <View style={styles.feedbackCardAvatar}>
                              <Ionicons name="person" size={20} color="#F53F7A" />
                            </View>
                            <View>
                              <Text style={styles.feedbackCardUserName}>
                                {feedback.user_name || 'Anonymous'}
                              </Text>
                              <Text style={styles.feedbackCardDate}>
                                {new Date(feedback.created_at).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Text style={styles.feedbackCardText}>{feedback.feedback_text}</Text>

                        {/* Admin Response Section */}
                        {feedback.admin_response && (
                          <View style={styles.feedbackAdminResponse}>
                            <View style={styles.feedbackAdminResponseHeader}>
                              <View style={styles.feedbackAdminBadge}>
                                <Text style={styles.feedbackAdminBadgeText}>Team Only2U</Text>
                              </View>
                            </View>
                            <Text style={styles.feedbackAdminResponseText}>
                              {feedback.admin_response}
                            </Text>
                          </View>
                        )}

                        {feedback.image_urls && feedback.image_urls.length > 0 && (
                          <View style={styles.feedbackCardMediaGrid}>
                            {feedback.image_urls.map((url: string, index: number) => {
                              const isVideo = url.includes('.mp4') || url.includes('.mov') || url.includes('video') || url.includes('feedback-videos');
                              return (
                                <View key={index} style={styles.feedbackCardMediaItem}>
                                  {isVideo ? (
                                    <Video
                                      source={{ uri: url }}
                                      style={styles.feedbackCardMedia}
                                      useNativeControls
                                      resizeMode={ResizeMode.COVER}
                                      shouldPlay={false}
                                    />
                                  ) : (
                                    <TouchableOpacity
                                      onPress={() => {
                                        setSelectedImageUri(url);
                                        setShowImageViewerModal(true);
                                      }}
                                      activeOpacity={0.9}
                                    >
                                      <Image source={{ uri: url }} style={styles.feedbackCardMedia} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                              );
                            })}
                          </View>
                        )}

                        <View style={styles.feedbackCardActions}>
                          <TouchableOpacity
                            style={styles.feedbackCardLikeButton}
                            onPress={() => handleLikeFeedback(feedback.id)}
                          >
                            <Ionicons
                              name={feedbackLikes[feedback.id] ? 'thumbs-up' : 'thumbs-up-outline'}
                              size={20}
                              color={feedbackLikes[feedback.id] ? '#10B981' : '#6B7280'}
                            />
                            <Text
                              style={[
                                styles.feedbackCardLikeText,
                                feedbackLikes[feedback.id] && styles.feedbackCardLikeTextActive,
                              ]}
                            >
                              Helpful ({feedbackLikeCounts[feedback.id] || 0})
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))
                  )}
                </ScrollView>
              )}
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal >

      {/* Full Screen Image Viewer Modal */}
      < Modal
        visible={showImageViewerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowImageViewerModal(false)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setShowImageViewerModal(false)}
          >
            <Ionicons name="close" size={30} color="#fff" />
          </TouchableOpacity>
          <View style={styles.imageViewerContent}>
            {selectedImageUri ? (
              <Image
                source={{ uri: selectedImageUri }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            ) : null}
          </View>
        </View>
      </Modal >
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    // justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 1,
  },
  avatarContainer: {
    marginRight: 20,
    position: 'relative',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 50,
    backgroundColor: '#FFE8F0',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#F53F7A',
  },
  cameraButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
  },
  profileTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    textAlign: 'left',
  },
  userEmail: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'left',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: '#E8F5E8',
    borderRadius: 12,
  },
  verificationText: {
    fontSize: 12,
    color: '#4CAF50',
    fontWeight: '500',
    marginLeft: 4,
  },
  menuContainer: {
    backgroundColor: '#fff',
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 16,
    flex: 1,
  },
  menuContent: {
    marginLeft: 16,
    flex: 1,
  },
  menuSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  menuItemIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFF5F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuItemTextContainer: {
    flex: 1,
    marginRight: 8,
  },
  menuItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  menuItemSubtitle: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  supportButton: {
    backgroundColor: '#F53F7A',
    marginHorizontal: 16,
    marginVertical: 24,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  supportButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingBottom: 40,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B',
    marginTop: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  deleteButton: {
    backgroundColor: '#F53F7A',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // Login prompt styles
  loginPromptContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 24,
    marginBottom: 1,
  },
  loginPromptTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
    textAlign: 'left',
  },
  loginPromptSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'left',
    marginBottom: 16,
  },
  referCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: '#FFF7FB',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#FFE4EF',
  },
  referIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFE1EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  referTextBlock: {
    flex: 1,
  },
  referCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  referCardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  referRewardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#FECFE3',
  },
  referRewardText: {
    color: '#F53F7A',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  // Referral Welcome Coupon Styles
  referralWelcomeCouponCard: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 18,
    borderRadius: 18,
    backgroundColor: '#F0FDF4',
    borderWidth: 2,
    borderColor: '#10B981',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  referralWelcomeCouponHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  referralWelcomeCouponIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  referralWelcomeCouponTextContainer: {
    flex: 1,
  },
  referralWelcomeCouponTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  referralWelcomeCouponSubtitle: {
    fontSize: 13,
    color: '#6B7280',
  },
  referralWelcomeCouponCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  referralWelcomeCouponCodeBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1FAE5',
    marginRight: 10,
  },
  referralWelcomeCouponCodeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  referralWelcomeCouponCodeValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#10B981',
    letterSpacing: 1,
  },
  referralWelcomeCouponCopyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  referralWelcomeCouponCopyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    marginLeft: 6,
  },
  referralWelcomeCouponDiscount: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  referralWelcomeCouponDiscountText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#047857',
    marginLeft: 6,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Photo Picker Modal styles
  photoPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  photoPickerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  photoPickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 20,
  },
  photoPickerHeader: {
    marginBottom: 24,
  },
  photoPickerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  photoPickerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  photoPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  photoPickerOptionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  photoPickerOptionTextContainer: {
    flex: 1,
  },
  photoPickerOptionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111',
    marginBottom: 3,
  },
  photoPickerOptionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  photoPickerScrollView: {
    maxHeight: 450,
    marginBottom: 16,
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
  photoTutorialOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  photoTutorialCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  photoTutorialHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  photoTutorialIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFE3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoTutorialTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  photoTutorialSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  photoTutorialVideoWrapper: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#000',
    marginBottom: 12,
  },
  photoTutorialVideo: {
    width: '100%',
    height: '100%',
  },
  photoTutorialDescription: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  photoTutorialCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  photoTutorialCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  photoTutorialCheckboxChecked: {
    backgroundColor: '#F53F7A',
  },
  photoTutorialCheckboxText: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  photoTutorialPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  photoTutorialPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  uploadingCard: {
    width: 280,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderRadius: 18,
    backgroundColor: '#fff',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  uploadingIconWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#FFF4F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  uploadingPulseCircle: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: '#FDE2EA',
    borderRadius: 35,
  },
  uploadingTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111',
    marginBottom: 4,
  },
  uploadingSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 14,
  },
  uploadingBar: {
    width: 220,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FDECF0',
    overflow: 'hidden',
  },
  uploadingBarFill: {
    height: '100%',
    backgroundColor: '#F53F7A',
    borderRadius: 3,
  },
  permissionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  permissionModal: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  permissionIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FEE2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  permissionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  permissionBody: {
    fontSize: 14,
    color: '#4B5563',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  permissionActions: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  permissionSecondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionSecondaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  permissionPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  permissionPrimaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  referralOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  referralContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 8,
  },
  referralHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  referralHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#FFE7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  referralTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  referralSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  referralLoading: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  referralLoadingText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  referralCodeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#FBCFE8',
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF8FB',
    marginBottom: 16,
  },
  referralCodeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  referralCodeValue: {
    fontSize: 24,
    fontWeight: '800',
    color: '#F53F7A',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#FECFE3',
    borderRadius: 999,
    backgroundColor: '#fff',
  },
  copyButtonText: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 12,
  },
  referralStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 20,
  },
  referralStat: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    backgroundColor: '#FDF2F8',
  },
  referralStatValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  referralStatLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingVertical: 14,
  },
  whatsappButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // Feedback Modal Styles
  feedbackModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  feedbackModalContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: 60,
  },
  feedbackModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  feedbackModalHeaderLeft: {
    flex: 1,
  },
  feedbackModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  feedbackModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  feedbackModalCloseButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
  },
  feedbackModalTabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 8,
  },
  feedbackModalTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#F9FAFB',
  },
  feedbackModalTabActive: {
    backgroundColor: '#FFF0F5',
  },
  feedbackModalTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  feedbackModalTabTextActive: {
    color: '#F53F7A',
  },
  feedbackFormScrollView: {
    flex: 1,
  },
  feedbackFormContent: {
    padding: 20,
    paddingBottom: 40,
  },
  feedbackFormSection: {
    marginBottom: 24,
  },
  feedbackFormLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  feedbackFormSubLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
  },
  feedbackFormTextInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 120,
    maxHeight: 200,
  },
  feedbackFormCharCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
  },
  feedbackFormMediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  feedbackFormMediaButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F53F7A',
  },
  feedbackFormMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 12,
  },
  feedbackFormMediaPreview: {
    position: 'relative',
    width: '30%',
    aspectRatio: 1,
  },
  feedbackFormMediaImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  feedbackFormMediaVideo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#000',
  },
  feedbackFormMediaRemove: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  feedbackFormSubmitButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  feedbackFormSubmitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  feedbackFormSubmitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackListScrollView: {
    flex: 1,
  },
  feedbackListContent: {
    padding: 20,
    paddingBottom: 40,
  },
  feedbackListEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  feedbackListEmptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  feedbackListEmptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
  },
  feedbackCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  feedbackCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  feedbackCardUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  feedbackCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFE1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackCardUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  feedbackCardDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  feedbackCardText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
    marginBottom: 12,
  },
  feedbackCardMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  feedbackCardMediaItem: {
    width: '30%',
    aspectRatio: 1,
  },
  feedbackCardMedia: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  feedbackCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  feedbackCardLikeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#fff',
  },
  feedbackCardLikeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  feedbackCardLikeTextActive: {
    color: '#10B981',
  },
  feedbackAdminResponse: {
    marginTop: 12,
    marginBottom: 16,
    padding: 14,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
  },
  feedbackAdminResponseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  feedbackAdminBadge: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  feedbackAdminBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  feedbackAdminResponseText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 20,
    fontStyle: 'italic',
  },
  headerFeedbackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: 20,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#FFD6E5',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
  },
  imageViewerContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '80%',
  },
});

export default Profile;
