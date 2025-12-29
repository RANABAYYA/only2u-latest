import { View, Text, Platform, Modal, TouchableOpacity, TextInput, KeyboardAvoidingView, Keyboard, ScrollView, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators, TransitionSpecs } from '@react-navigation/stack';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigation as useRootNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Profile from '~/screens/Profile';
import Dashboard from '~/screens/Dashboard';
import TrendingScreen from '~/screens/Trending';
import ProductDetails from '~/screens/ProductDetails';
import Products from '~/screens/Products';
import EditProfile from '~/screens/EditProfile';
import MyOrders from '~/screens/MyOrders';
import BodyMeasurements from '~/screens/BodyMeasurements';
import HelpCenter from '~/screens/HelpCenter';
import Cart from '~/screens/Cart';
import Admin from '~/screens/Admin';
import CategoryManagement from '~/screens/CategoryManagement';
import ProductManagement from '~/screens/ProductManagement';
import ColorManagement from '~/screens/ColorManagement';
import UserManagement from '~/screens/UserManagement';
import SettingsManagement from '~/screens/SettingsManagement';
import SupportTickets from '~/screens/SupportTickets';
import OrderManagement from '~/screens/OrderManagement';
import FeedbackManagement from '~/screens/FeedbackManagement';
import Wishlist from '~/screens/Wishlist';
import CollectionDetails from '~/screens/CollectionDetails';
import SharedCollection from '~/screens/SharedCollection';
import VendorProfile from '~/screens/VendorProfile';
import JoinInfluencer from '~/screens/JoinInfluencer';
import ResellerRegistration from '~/screens/ResellerRegistration';
import ResellerDashboard from '~/screens/ResellerDashboard';
import CatalogShare from '~/screens/CatalogShare';
import AllReviews from '~/screens/AllReviews';
import { useUser } from '~/contexts/UserContext';
import { useCart } from '~/contexts/CartContext';
import { useAuth } from '~/contexts/useAuth';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import { supabase } from '~/utils/supabase';
import ChatThread from '~/screens/ChatThread';
import FriendSearch from '~/screens/FriendSearch';
import Coupons from '~/screens/Coupons';
import Toast from 'react-native-toast-message';
import { validateReferralCode, redeemReferralCode } from '~/services/referralCodeService';
import { sendWhatsAppOTP } from '~/services/whatsappService';

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Custom smooth easing configuration
const customTransitionSpec = {
  open: {
    animation: 'spring' as const,
    config: {
      stiffness: 1000,
      damping: 500,
      mass: 3,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
  close: {
    animation: 'spring' as const,
    config: {
      stiffness: 1000,
      damping: 500,
      mass: 3,
      overshootClamping: true,
      restDisplacementThreshold: 0.01,
      restSpeedThreshold: 0.01,
    },
  },
};

// Home Stack Navigator (Dashboard + ProductDetails + Products + Profile + Profile-related screens)
const HomeStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: customTransitionSpec,
      }}
    >
      <Stack.Screen name="Home" component={Dashboard} />
      <Stack.Screen name="ProductDetails" component={ProductDetails} />
      <Stack.Screen name="Products" component={Products} />
      <Stack.Screen name="Profile" component={Profile} />
      <Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="MyOrders" component={MyOrders} />
      <Stack.Screen name="ChatThread" component={ChatThread} />
      <Stack.Screen name="FriendSearch" component={FriendSearch} />
      <Stack.Screen name="BodyMeasurements" component={BodyMeasurements} />
      <Stack.Screen name="HelpCenter" component={HelpCenter} />
      <Stack.Screen name="Wishlist" component={Wishlist} />
      <Stack.Screen name="CollectionDetails" component={CollectionDetails} />
      <Stack.Screen name="SharedCollection" component={SharedCollection} />
      <Stack.Screen name="AllReviews" component={AllReviews} />
      <Stack.Screen name="VendorProfile" component={VendorProfile} />
      <Stack.Screen name="JoinInfluencer" component={JoinInfluencer} />
      <Stack.Screen name="ResellerRegistration" component={ResellerRegistration} />
      <Stack.Screen name="ResellerDashboard" component={ResellerDashboard} />
      <Stack.Screen name="CatalogShare" component={CatalogShare} />
      <Stack.Screen name="Coupons" component={Coupons} />
      <Stack.Screen name="Admin" component={Admin} />
      <Stack.Screen name="UserManagement" component={UserManagement} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
      <Stack.Screen name="ProductManagement" component={ProductManagement} />
      <Stack.Screen name="ColorManagement" component={ColorManagement} />
      <Stack.Screen name="SettingsManagement" component={SettingsManagement} />
      <Stack.Screen name="SupportTickets" component={SupportTickets} />
      <Stack.Screen name="OrderManagement" component={OrderManagement} />
    </Stack.Navigator>
  );
};

// Admin Stack Navigator (Admin + UserManagement + CategoryManagement + ProductManagement + ColorManagement)
const AdminStack = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        gestureDirection: 'horizontal',
        cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
        transitionSpec: customTransitionSpec,
      }}
    >
      <Stack.Screen name="AdminMain" component={Admin} />
      <Stack.Screen name="UserManagement" component={UserManagement} />
      <Stack.Screen name="CategoryManagement" component={CategoryManagement} />
      <Stack.Screen name="ProductManagement" component={ProductManagement} />
      <Stack.Screen name="ColorManagement" component={ColorManagement} />
      <Stack.Screen name="SupportTickets" component={SupportTickets} />
      <Stack.Screen name="FeedbackManagement" component={FeedbackManagement} />
    </Stack.Navigator>
  );
};

export default function TabLayout() {
  const rootNav = useRootNavigation<any>();
  const { userData, refreshUserData } = useUser()
  const { user } = useAuth();
  const isAdmin = userData?.role === 'admin';
  const { getCartCount } = useCart();
  const cartCount = getCartCount();
  const insets = useSafeAreaInsets();

  // Safe translate helper - returns plain strings without i18n
  const tt = (key: string, fallback: string): string => {
    // Just return the fallback directly to avoid any translation issues
    const result = fallback || key || 'Label';
    return String(result); // Ensure it's always a string
  };

  // Recurring login prompt for guests
  const { isLoginSheetVisible, showLoginSheet, hideLoginSheet } = useLoginSheet();
  const [hasSession, setHasSession] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [countryCode, setCountryCode] = useState('+91');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  // Onboarding bottom sheet state (name-only)
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [name, setName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);
  // Referral code state
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [referralCodeState, setReferralCodeState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [referralCodeMessage, setReferralCodeMessage] = useState('');
  const [appliedReferralCoupon, setAppliedReferralCoupon] = useState<{ code: string; referralCodeId: string; type?: 'referral' | 'coupon' } | null>(null);
  // Track Supabase auth session directly to avoid profile-loading delays
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      setHasSession(!!data.session);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(!!session);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Manage recurring prompt based on hasSession
  useEffect(() => {
    if (hasSession) {
      // We do NOT force hideLoginSheet() here anymore.
      // This allows the user to manually open the login sheet even if a session technically exists
      // (e.g. if the UI thinks they are a guest but Supabase has a session).
      // The sheet will close explicitly upon successful login actions.

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    // If no session, start/restart interval
    if (!intervalRef.current) {
      intervalRef.current = setInterval(() => {
        // Only show login sheet if it's not already visible
        if (!isLoginSheetVisible) {
          showLoginSheet();
        }
      }, 20000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasSession, isLoginSheetVisible, showLoginSheet, hideLoginSheet]);

  // resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn(v => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const resetSheetState = () => {
    setCountryCode('+91');
    setPhone('');
    setOtp('');
    setGeneratedOtp(null);
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

  const handleSendOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!trimmed || trimmed.length < 10) {
        setError('Enter a valid phone number');
        return;
      }
      setSending(true);
      const fullPhone = `${countryCode}${trimmed}`.replace('+', ''); // Remove + for WhatsApp API if needed, but usually kept. Check API. Curl uses "91...".
      // Clean phone for whatsapp: remove +
      const whatsappPhone = fullPhone.replace('+', '');

      // Generate 6 digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      console.log('Generated OTP:', code);

      await sendWhatsAppOTP(whatsappPhone, code);

      setGeneratedOtp(code);
      setOtpSent(true);
      setResendIn(30);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'Failed to send WhatsApp OTP');
    } finally {
      setSending(false);
    }
  };

  const handleApplyReferralCodeInput = async () => {
    if (!referralCodeInput || referralCodeInput.trim().length < 3) {
      setReferralCodeState('invalid');
      setReferralCodeMessage('Please enter a valid code');
      return;
    }

    setReferralCodeState('checking');
    setReferralCodeMessage('');

    try {
      const trimmed = referralCodeInput.trim().toUpperCase();

      // Use the service to validate
      const { validateReferralCode } = await import('~/services/referralCodeService');
      const validation = await validateReferralCode(trimmed);

      if (!validation.isValid || !validation.referralCodeId) {
        // Fallback: Check if it's a valid coupon code
        // Users might share their coupon codes (e.g. WELCOME...) or other coupons as referral codes
        const { data: coupon, error: couponError } = await supabase
          .from('coupons')
          .select('id, code, description')
          .eq('code', trimmed)
          .eq('is_active', true)
          .maybeSingle();

        if (coupon && !couponError) {
          setReferralCodeState('valid');
          setReferralCodeMessage('Coupon code applied! You will receive ₹100 off on your first order.');
          setAppliedReferralCoupon({
            code: trimmed,
            referralCodeId: coupon.id,
            type: 'coupon',
          });
          return;
        }

        setReferralCodeState('invalid');
        setReferralCodeMessage(validation.message || 'Invalid or inactive referral code.');
        setAppliedReferralCoupon(null);
        return;
      }

      setReferralCodeState('valid');
      setReferralCodeMessage('Referral code applied! You will receive ₹100 off on your first order.');
      setAppliedReferralCoupon({
        code: trimmed,
        referralCodeId: validation.referralCodeId,
        type: 'referral',
      });
    } catch (error) {
      console.error('Referral code apply error:', error);
      setReferralCodeState('invalid');
      setReferralCodeMessage('Unable to verify referral code. Please try again.');
      setAppliedReferralCoupon(null);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);

      // Hardcoded redirect URL for APK Production Build
      const redirectUrl = 'only2u://';
      console.log('--------------------------------------------------');
      console.log('ℹ️  OAuth Redirect URL:', redirectUrl);
      console.log('⚠️  ADD THIS URL TO SUPABASE AUTH SETTINGS');
      console.log('--------------------------------------------------');

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
          // Check for PKCE Authorization Code first (Supabase V2 default)
          const codeMatch = result.url.match(/[?&]code=([^&]+)/);

          if (codeMatch && codeMatch[1]) {
            const code = codeMatch[1];
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
            if (sessionError) throw sessionError;

            hideLoginSheet();
            resetSheetState();
            Toast.show({
              type: 'success',
              text1: 'Google Login Successful',
              text2: 'Welcome to Only2U!',
            });
            return; // Stop here if code exchange worked
          }

          // Fallback: Implicit Flow (access_token in hash)
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

            hideLoginSheet();
            resetSheetState();
            Toast.show({
              type: 'success',
              text1: 'Google Login Successful',
              text2: 'Welcome to Only2U!',
            });
          } else {
            // Fallback: check query params if hash failed
            const parsed = Linking.parse(result.url);
            if (parsed.queryParams?.access_token && parsed.queryParams?.refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({
                access_token: parsed.queryParams.access_token as string,
                refresh_token: parsed.queryParams.refresh_token as string,
              });
              if (sessionError) throw sessionError;

              hideLoginSheet();
              resetSheetState();
              Toast.show({ type: 'success', text1: 'Login Successful' });
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

  const handleVerifyOtp = async () => {
    try {
      setError(null);
      const trimmed = phone.replace(/\D/g, '');
      if (!otp || otp.trim().length < 6) {
        setError('Enter the 6-digit OTP');
        return;
      }
      setVerifying(true);

      // 1. Verify OTP locally
      if (otp.trim() !== generatedOtp) {
        setError('Invalid OTP');
        setVerifying(false);
        return;
      }

      const fullPhone = `${countryCode}${trimmed}`;

      // 2. Check if user with this phone exists in our users table
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('phone', fullPhone)
        .maybeSingle();

      if (existingUser) {
        // User exists - sign in anonymously (we'll link by phone in users table)
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          setError('Login failed. Please try again.');
          setVerifying(false);
          return;
        }

        // Force refresh user data
        await refreshUserData();

        Toast.show({
          type: 'success',
          text1: 'Login Successful',
          text2: 'Welcome back!',
        });

        hideLoginSheet();
        resetSheetState();
        Keyboard.dismiss();
      } else {
        // New user - sign in anonymously and show onboarding
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();

        if (signInError) {
          setError('Login failed. Please try again.');
          setVerifying(false);
          return;
        }

        // Store phone temporarily for profile creation
        // We'll pass it via state to onboarding

        Toast.show({
          type: 'success',
          text1: 'OTP Verified!',
          text2: 'Complete your profile to continue',
        });

        hideLoginSheet();
        setName('');
        setShowOnboarding(true);
        Keyboard.dismiss();
      }

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (e: any) {
      console.error(e);
      setError(e?.message || 'OTP verification failed');
    } finally {
      setVerifying(false);
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

      // Get phone number from the OTP flow state (since we use anonymous auth)
      const trimmed = phone.replace(/\D/g, '');
      const userPhone = trimmed ? `${countryCode}${trimmed}` : null;

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

      // Handle referral code redemption if one was applied
      if (appliedReferralCoupon && appliedReferralCoupon.referralCodeId) {
        try {
          // If it's a standard referral code
          if (appliedReferralCoupon.type === 'referral' || !appliedReferralCoupon.type) {
            // Redeem the referral code - this will record usage and create the welcome coupon
            const { coupon } = await redeemReferralCode(
              appliedReferralCoupon.referralCodeId,
              appliedReferralCoupon.code,
              authUser.id,
              authUser.email || undefined,
              name.trim(),
              userPhone || undefined
            );

            Toast.show({
              type: 'success',
              text1: 'Referral code applied!',
              text2: '₹100 off coupon added to your account.',
            });

            console.log('[Signup] ✅ Referral code redeemed successfully:', {
              referralCode: appliedReferralCoupon.code,
              couponCode: coupon.code,
            });
          } else {
            // It's a coupon code used as referral
            // 1. Record coupon usage (optional, but good for tracking)
            const { error: usageError } = await supabase
              .from('coupon_usage')
              .insert({
                coupon_id: appliedReferralCoupon.referralCodeId,
                user_id: authUser.id,
                // We don't have an order_id, so we leave it null if allowed, or we might just skip this if not allowed
                // Assuming it's allowed or we just skip error
              });

            if (usageError) {
              console.warn('[Signup] Could not record coupon usage as referral:', usageError);
            }

            // 2. Give the new user their Welcome Coupon
            const { createWelcomeCouponForReferral } = await import('~/services/referralCodeService');
            const coupon = await createWelcomeCouponForReferral(authUser.id, name.trim());

            Toast.show({
              type: 'success',
              text1: 'Code applied!',
              text2: '₹100 off coupon added to your account.',
            });

            console.log('[Signup] ✅ Coupon code redeemed as referral successfully:', {
              referralCode: appliedReferralCoupon.code,
              couponCode: coupon.code,
            });
          }
        } catch (couponError: any) {
          console.error('[Signup] ❌ Error redeeming referral code:', couponError);
          // Don't fail the signup if referral redemption fails, just log it
          Toast.show({
            type: 'error',
            text1: 'Referral code error',
            text2: couponError?.message || 'Could not apply referral code, but account created successfully.',
          });
        }
      }

      await refreshUserData(); // Force refresh to show new profile data immediately

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

  // Base tab bar style with safe area insets
  const baseTabBarStyle = {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: Math.max(insets.bottom, 8),
    height: Math.max(insets.bottom + 60, 70),
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -2 },
    elevation: 8,
  } as const;

  return (
    <>
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: '#FF3F6C',
          tabBarInactiveTintColor: '#8E8E93',
          tabBarStyle: { ...baseTabBarStyle, display: isLoginSheetVisible && !hasSession ? 'none' : 'flex' },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            marginTop: 4,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}>
        <Tab.Screen
          name="Home"
          component={HomeStack}
          options={{
            title: 'Home',
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <View style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: focused ? '#FF3F6C' : '#FFE5EC',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}>
                  <Text style={{
                    color: focused ? '#FFFFFF' : '#FF3F6C',
                    fontSize: 12,
                    fontWeight: '800',
                    letterSpacing: -0.2,
                  }}>O<Text style={{ color: focused ? '#FFFFFF' : '#FF3F6C' }}>2</Text>U</Text>
                </View>
              </View>
            ),
          }}
        />
        {isAdmin && (
          <Tab.Screen
            name="Admin"
            component={AdminStack}
            options={{
              title: tt('admin', 'Admin'),
              headerShown: false,
              tabBarIcon: ({ color, focused }) => (
                <View style={{
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: focused ? '#F53F7A' : '#FFE8F0',
                  borderRadius: 25,
                  width: 50,
                  height: 50,
                  marginBottom: 50,
                  shadowColor: '#F53F7A',
                  shadowOpacity: focused ? 0.3 : 0.1,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 2 },
                  elevation: 4,
                }}>
                  <Ionicons
                    name={focused ? "shield-checkmark" : "shield-checkmark-outline"}
                    size={28}
                    color={focused ? '#fff' : '#F53F7A'}
                  />
                </View>
              ),
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: '600',
                marginTop: -5,
              },
              tabBarLabel: ({ focused }) => (
                <Text style={{ color: '#000', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                  {tt('admin', 'Admin') || 'Admin'}
                </Text>
              ),
            }}
          />
        )}
        <Tab.Screen
          name="Trending"
          component={TrendingScreen}
          options={{
            title: tt('trending', 'Trending'),
            headerShown: false,
            tabBarIcon: ({ color, focused }) => (
              <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name={focused ? 'flame' : 'flame-outline'} size={24} color={focused ? '#FF3F6C' : '#8E8E93'} />
              </View>
            ),
            tabBarLabel: ({ focused }) => (
              <Text style={{ color: focused ? '#FF3F6C' : '#8E8E93', fontSize: 12, fontWeight: '600', marginTop: 4 }}>
                {tt('trending', 'Trending') || 'Trending'}
              </Text>
            ),
          }}
        />
        {!isAdmin && (
          <Tab.Screen
            name="Cart"
            component={Cart}
            options={{
              title: 'Bag',
              headerShown: false,
              tabBarIcon: ({ color, focused }) => (
                <View style={{ alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  <Ionicons
                    name={focused ? "bag" : "bag-outline"}
                    size={24}
                    color={color}
                  />
                  {/* Cart badge */}
                  {cartCount > 0 && (
                    <View style={{
                      position: 'absolute',
                      top: -2,
                      right: -6,
                      backgroundColor: '#FF3F6C',
                      borderRadius: 8,
                      minWidth: 16,
                      height: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingHorizontal: 4,
                    }}>
                      <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{cartCount}</Text>
                    </View>
                  )}
                </View>
              ),
              tabBarLabel: ({ focused }) => (
                <Text style={{ color: '#000', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Bag</Text>
              ),
            }}
          />
        )}
      </Tab.Navigator>

      {/* Bottom sheet style modal for OTP login */}
      <Modal visible={isLoginSheetVisible && !hasSession} transparent animationType="slide" onRequestClose={() => { hideLoginSheet(); resetSheetState(); }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
            <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 18, maxHeight: '78%' }}>
              <View style={{ alignItems: 'center', marginBottom: 10 }}>
                <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: '#D6D6D6' }} />
              </View>

              {/* Title + subtitle */}
              <View style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#1f1f1f' }}>{tt('welcome_back', 'Welcome back')}</Text>
                <Text style={{ marginTop: 4, color: '#666', fontWeight: '500' }}>{tt('login_benefits', 'Login to track orders, wishlist, and get offers')}</Text>
              </View>

              <ScrollView keyboardShouldPersistTaps='handled' contentContainerStyle={{ paddingBottom: 8 }}>
                {/* Perks */}
                <View style={{ flexDirection: 'row', marginTop: 6, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name='shield-checkmark-outline' size={16} color='#2e7d32' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('secure_otp', 'Secure OTP')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 12 }}>
                    <Ionicons name='heart-outline' size={16} color='#F53F7A' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('save_wishlist', 'Save Wishlist')}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name='pricetag-outline' size={16} color='#6a5acd' />
                    <Text style={{ marginLeft: 6, color: '#333', fontSize: 12, fontWeight: '600' }}>{tt('exclusive_offers', 'Exclusive Offers')}</Text>
                  </View>
                </View>

                {/* Phone input */}
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700', letterSpacing: 0.2 }}>{tt('enter_mobile', 'Enter your mobile number')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F5F7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: Platform.OS === 'android' ? 8 : 12, borderWidth: 1, borderColor: '#EAECF0' }}>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    style={{ width: 68, fontSize: 16, fontWeight: '800', color: '#111' }}
                    keyboardType='phone-pad'
                  />
                  <View style={{ width: 1, height: 22, backgroundColor: '#E0E0E0', marginHorizontal: 10 }} />
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    placeholder={tt('phone_placeholder', '9876543210')}
                    placeholderTextColor='#999'
                    style={{ flex: 1, fontSize: 16, color: '#111' }}
                    keyboardType='phone-pad'
                    returnKeyType='done'
                    maxLength={15}
                  />
                </View>

                {/* Referral code input */}
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 12, color: '#666', marginBottom: 6, fontWeight: '700', letterSpacing: 0.2 }}>
                    Have a referral code? (optional)
                  </Text>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      backgroundColor: '#F4F5F7',
                      borderRadius: 14,
                      paddingHorizontal: 12,
                      borderWidth: 1,
                      borderColor:
                        referralCodeState === 'valid'
                          ? '#A7F3D0'
                          : referralCodeState === 'invalid'
                            ? '#FECACA'
                            : '#EAECF0',
                    }}
                  >
                    <TextInput
                      value={referralCodeInput}
                      onChangeText={(text) => {
                        setReferralCodeInput(text.toUpperCase());
                        if (referralCodeState !== 'idle') {
                          setReferralCodeState('idle');
                          setReferralCodeMessage('');
                          setAppliedReferralCoupon(null);
                        }
                      }}
                      placeholder="ENTER CODE"
                      placeholderTextColor="#9CA3AF"
                      style={{ flex: 1, fontSize: 14, color: '#111', paddingVertical: Platform.OS === 'android' ? 10 : 14 }}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity
                      style={{
                        paddingHorizontal: 14,
                        paddingVertical: 8,
                        backgroundColor: referralCodeState === 'valid' ? '#10B981' : '#F53F7A',
                        borderRadius: 12,
                        marginLeft: 8,
                      }}
                      onPress={handleApplyReferralCodeInput}
                      disabled={referralCodeState === 'checking'}
                    >
                      {referralCodeState === 'checking' ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={{ color: '#fff', fontWeight: '700' }}>
                          {referralCodeState === 'valid' ? 'Applied' : 'Apply'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                  {!!referralCodeMessage && (
                    <Text
                      style={{
                        marginTop: 6,
                        fontSize: 12,
                        color: referralCodeState === 'valid' ? '#047857' : '#B91C1C',
                      }}
                    >
                      {referralCodeMessage}
                    </Text>
                  )}
                </View>

                {/* Primary CTA send/resend */}
                {!otpSent ? (
                  <TouchableOpacity disabled={sending} onPress={handleSendOtp} style={{ marginTop: 14, backgroundColor: sending ? '#F7A3BD' : '#F53F7A', borderRadius: 14, paddingVertical: 14, alignItems: 'center', shadowColor: '#F53F7A', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 }}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{sending ? tt('sending', 'Sending...') : tt('send_otp', 'Send OTP')}</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={{ marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: '#666' }}>{resendIn > 0 ? `${tt('resend_in', 'Resend in')} ${resendIn}s` : tt('you_can_resend', 'You can resend now')}</Text>
                    <TouchableOpacity disabled={resendIn > 0} onPress={handleSendOtp}>
                      <Text style={{ color: resendIn > 0 ? '#AAA' : '#F53F7A', fontWeight: '800' }}>{tt('resend_otp', 'Resend OTP')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* OTP input + Verify CTA */}
                {otpSent && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 12, color: '#666', fontWeight: '700' }}>{tt('enter_otp', 'Enter OTP')}</Text>
                      <TouchableOpacity
                        onPress={() => Linking.openURL('whatsapp://send?phone=917993980632')}
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#DCFCE7' }}
                      >
                        <Ionicons name="logo-whatsapp" size={14} color="#25D366" />
                        <Text style={{ fontSize: 11, color: '#25D366', fontWeight: '700', marginLeft: 4 }}>Open WhatsApp for OTP</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F5F7', borderRadius: 14, paddingHorizontal: 14, paddingVertical: Platform.OS === 'android' ? 8 : 12, borderWidth: 1, borderColor: '#EAECF0' }}>
                      <Ionicons name='key-outline' size={18} color='#999' />
                      <TextInput
                        value={otp}
                        onChangeText={setOtp}
                        placeholder='123456'
                        placeholderTextColor='#999'
                        style={{ flex: 1, fontSize: 18, color: '#111', marginLeft: 10, letterSpacing: 6 }}
                        keyboardType='number-pad'
                        returnKeyType='done'
                        maxLength={6}
                      />
                    </View>
                    <TouchableOpacity disabled={verifying} onPress={handleVerifyOtp} style={{ marginTop: 14, backgroundColor: verifying ? '#F7A3BD' : '#F53F7A', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                      <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>{verifying ? tt('verifying', 'Verifying...') : tt('verify_continue', 'Verify & Continue')}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!!error && (
                  <View style={{ marginTop: 12, backgroundColor: '#FFF0F3', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FFD6DF' }}>
                    <Text style={{ color: '#B00020', fontWeight: '900' }}>{tt('error', 'Error')}</Text>
                    <Text style={{ color: '#B00020', marginTop: 4 }}>Error Sending sisdial otp, server request response timed out</Text>
                  </View>
                )}



                {/* Secondary CTAs */}
                <View style={{ marginTop: 6 }}>
                  <TouchableOpacity onPress={() => { hideLoginSheet(); resetSheetState(); }} style={{ alignItems: 'center', paddingVertical: 10 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '800' }}>{tt('continue_as_guest', 'Continue as Guest')}</Text>
                  </TouchableOpacity>
                  <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 4 }}>
                    <TouchableOpacity onPress={() => { try { rootNav.navigate('PrivacyPolicy'); } catch { } }}>
                      <Text style={{ color: '#6B7280', fontWeight: '600', textDecorationLine: 'underline' }}>{tt('privacy_policy', 'Privacy Policy')}</Text>
                    </TouchableOpacity>
                    <Text style={{ marginHorizontal: 8, color: '#9CA3AF' }}>•</Text>
                    <TouchableOpacity onPress={() => { try { rootNav.navigate('TermsAndConditions'); } catch { } }}>
                      <Text style={{ color: '#6B7280', fontWeight: '600', textDecorationLine: 'underline' }}>{tt('terms', 'Terms')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: Onboarding after OTP for new users */}
      <Modal visible={showOnboarding && hasSession} transparent animationType="slide" onRequestClose={() => setShowOnboarding(false)}>
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
                  👋 {tt('welcome', 'Welcome!')}
                </Text>
                <Text style={{ fontSize: 15, color: '#666', fontWeight: '500', textAlign: 'center', lineHeight: 22 }}>
                  {tt('enter_name_to_continue', "What should we call you?")}
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
                        placeholder={tt('name_placeholder', 'Enter your name')}
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
                          {tt('continue', "Let's Go")}
                        </Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" />
                      </>
                    )}
                  </TouchableOpacity>

                  {/* Skip link */}
                  <TouchableOpacity
                    onPress={() => setShowOnboarding(false)}
                    style={{ alignItems: 'center', paddingVertical: 16, marginTop: 8 }}
                    activeOpacity={0.6}
                  >
                    <Text style={{ color: '#888', fontWeight: '600', fontSize: 14 }}>
                      {tt('skip_for_now', 'Skip for now')}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}