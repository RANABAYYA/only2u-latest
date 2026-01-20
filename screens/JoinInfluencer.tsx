import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  StatusBar,
  Alert,
  Vibration
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { submitInfluencerApplication, getUserInfluencerApplications } from '~/services/influencerService';
import { useUser } from '~/contexts/UserContext';
import { supabase } from '~/utils/supabase';

const JoinInfluencer = () => {
  const { userData } = useUser();
  const navigation = useNavigation();
  const [fullName, setFullName] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);

  // Enhanced Animations
  const headerTranslate = useRef(new Animated.Value(0)).current;
  const headerScale = useRef(new Animated.Value(1)).current;
  const nameFocus = useRef(new Animated.Value(0)).current;
  const instaFocus = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(50)).current;
  const successScale = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Parallax scroll value
  const scrollY = useRef(new Animated.Value(0)).current;

  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Check for existing application
  useEffect(() => {
    const checkExistingApplication = async () => {
      // 1. Check local storage first (immediate feedback)
      try {
        const localSubmitted = await AsyncStorage.getItem('influencer_application_submitted');
        if (localSubmitted === 'true') {
          setHasSubmitted(true);
          return;
        }
      } catch (e) {
        console.log('Error reading local storage:', e);
      }

      // 2. Check database if user is logged in
      if (userData?.id) {
        try {
          // 1. Check by ID first using the service
          const { success, data } = await getUserInfluencerApplications(userData.id);
          if (success && data && data.length > 0) {
            setHasSubmitted(true);
            return;
          }

          // 2. Fallback: Check explicitly by phone number if available
          // This handles cases where user_id might not be linked correctly or RLS issues
          if (userData.phone) {
            const { data: phoneData, error } = await supabase
              .from('influencer_applications')
              .select('id')
              .eq('user_phone', userData.phone)
              .maybeSingle();

            if (phoneData) {
              setHasSubmitted(true);
              return;
            }
          }
        } catch (error) {
          console.error('Error checking existing influencer application:', error);
        }
      }
    };

    checkExistingApplication();
  }, [userData]);

  // Component mount animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true
      })
    ]).start();

    // Floating header animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerTranslate, {
          toValue: -8,
          duration: 2000,
          useNativeDriver: true
        }),
        Animated.timing(headerTranslate, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true
        }),
      ])
    ).start();

    // Pulse animation for header icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(headerScale, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true
        }),
        Animated.timing(headerScale, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true
        }),
      ])
    ).start();
  }, []);

  // Enhanced focus animations
  const createFocusAnimation = (animValue: Animated.Value, focused: boolean) => {
    Animated.spring(animValue, {
      toValue: focused ? 1 : 0,
      tension: 100,
      friction: 8,
      useNativeDriver: false,
    }).start();
  };

  const focusedInputStyle = (anim: Animated.Value) => ({
    borderColor: anim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#E5E7EB', '#F53F7A']
    }),
    borderWidth: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2]
    }),
    shadowColor: '#F53F7A',
    shadowOpacity: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 0.15]
    }) as any,
    shadowRadius: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 8]
    }) as any,
    shadowOffset: { width: 0, height: 2 },
    elevation: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 4]
    }) as any,
    transform: [{
      scale: anim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.02]
      })
    }]
  });

  const benefitCards = useMemo(() => ([
    {
      icon: 'flash-outline',
      title: 'Amplify Your Reach',
      desc: 'Get featured across Only2U and partner channels with millions of followers.',
      gradient: ['#FF6B6B', '#FF8E8E']
    },
    {
      icon: 'cash-outline',
      title: 'Monetize Your Influence',
      desc: 'Earn substantial rewards for every sale and referral you drive.',
      gradient: ['#4ECDC4', '#6BCCC4']
    },
    {
      icon: 'people-outline',
      title: 'Elite Creator Network',
      desc: 'Join an exclusive community of top creators and premium brands.',
      gradient: ['#45B7D1', '#6BCFF6']
    },
    {
      icon: 'ribbon-outline',
      title: 'VIP Early Access',
      desc: 'Be the first to try new collections before they launch publicly.',
      gradient: ['#96CEB4', '#B8E6C1']
    },
  ]), []);

  const screenWidth = Dimensions.get('window').width;
  const scrollX = useRef(new Animated.Value(0)).current;
  const carouselRef = useRef<Animated.ScrollView | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  // Enhanced carousel auto-scroll with proper card width calculation
  const cardWidth = screenWidth - 48; // Account for container padding
  useEffect(() => {
    const id = setInterval(() => {
      const next = (activeIdx + 1) % benefitCards.length;
      setActiveIdx(next);
      try {
        carouselRef.current?.scrollTo({ x: next * cardWidth, animated: true });
      } catch { }
    }, 5000);
    return () => clearInterval(id);
  }, [activeIdx, benefitCards.length, cardWidth]);

  // Validation helpers
  const validateName = (name: string) => name.trim().length >= 2;
  const validateInstagram = (url: string) => {
    const trimmed = url.trim();
    const isUrl = /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/i.test(trimmed);
    const isAtHandle = /^@[A-Za-z0-9_.]+$/.test(trimmed);
    const isPlainHandle = /^[A-Za-z0-9_.]+$/.test(trimmed);
    return isUrl || isAtHandle || isPlainHandle;
  };

  const isFormValid = validateName(fullName) && validateInstagram(instagramUrl);

  const handleBack = () => {
    Animated.timing(contentOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true
    }).start(() => navigation.goBack());
  };

  const animateButtonPress = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
  };

  const handleSubmit = async () => {
    if (!isFormValid) {
      Vibration.vibrate(100);
      Toast.show({
        type: 'error',
        text1: 'Please check your details',
        text2: 'Enter a valid name and Instagram handle/link',
        visibilityTime: 3000,
      });
      return;
    }

    animateButtonPress();

    try {
      setSubmitting(true);

      // Submit application to database
      const result = await submitInfluencerApplication({
        full_name: fullName.trim(),
        instagram_url: instagramUrl.trim(),
        user_email: userData?.email || undefined,
        user_phone: userData?.phone || undefined,
      });

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit application');
      }

      // Save to local storage
      try {
        await AsyncStorage.setItem('influencer_application_submitted', 'true');
      } catch (e) {
        console.error('Failed to save submission status locally:', e);
      }

      // Success animation
      setShowSuccessAnimation(true);
      Animated.spring(successScale, {
        toValue: 1,
        tension: 100,
        friction: 8,
        useNativeDriver: true,
      }).start();

      setTimeout(() => {
        Toast.show({
          type: 'success',
          text1: '🎉 Application Submitted!',
          text2: 'We\'ll review your profile and get back to you within 24-48 hours',
          visibilityTime: 4000,
        });

        // Clear form
        setFullName('');
        setInstagramUrl('');

        navigation.goBack();
      }, 2000);

    } catch (e: any) {
      Vibration.vibrate([100, 200, 100]);
      Toast.show({
        type: 'error',
        text1: 'Submission failed',
        text2: e?.message || 'Please try again later',
        visibilityTime: 3000,
      });
    } finally {
      setTimeout(() => setSubmitting(false), 2000);
    }
  };

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false }
  );

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const headerHeight = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [120, 100],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#F53F7A" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Enhanced Header */}
        <Animated.View style={[styles.headerWrapper, { opacity: headerOpacity, height: headerHeight }]}>
          <LinearGradient
            colors={['#F53F7A', '#FF7E9D', '#FBBF24']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerBg}
          />
          <View style={styles.headerOverlay} />

          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Become an Influencer</Text>
            <View style={{ width: 40 }} />
          </View>

          <Animated.View style={[
            styles.heroIcon,
            {
              transform: [
                { translateY: headerTranslate },
                { scale: headerScale }
              ]
            }
          ]}>
            <View style={styles.heroIconBg}>
              <Ionicons name="star" size={28} color="#FFD700" />
            </View>
          </Animated.View>
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={{
            opacity: contentOpacity,
            transform: [{ translateY: slideUpAnim }]
          }}
        >
          {hasSubmitted ? (
            <View style={styles.formSection}>
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <View style={[styles.successCard, { padding: 40, width: '100%' }]}>
                  <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                  <Text style={[styles.successText, { marginTop: 20, fontSize: 24, fontWeight: 'bold' }]}>
                    Application Already Submitted!
                  </Text>
                  <Text style={[styles.successText, { fontSize: 16, marginTop: 12, textAlign: 'center', color: '#4B5563', fontWeight: '500' }]}>
                    We are currently reviewing your application. You will be notified once the review process is complete.
                  </Text>

                  <TouchableOpacity
                    style={[styles.submitButton, { marginTop: 30, backgroundColor: '#F53F7A', width: '100%' }]}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}
                  >
                    <View style={styles.buttonGradient}>
                      <Text style={styles.submitText}>Go Back</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Enhanced Carousel */}
              <View style={styles.carouselContainer}>
                <Text style={styles.sectionTitle}>Why Join Our Network?</Text>
                <Animated.ScrollView
                  ref={carouselRef}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 24 }}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                  )}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / cardWidth);
                    setActiveIdx(idx);
                  }}
                  scrollEventThrottle={16}
                >
                  {benefitCards.map((card, i) => (
                    <View key={i} style={{ width: cardWidth, paddingHorizontal: 6 }}>
                      <View style={styles.carouselCard}>
                        <LinearGradient
                          colors={card.gradient}
                          style={styles.cardGradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                        />
                        <View style={styles.cardContent}>
                          <View style={styles.carouselIconWrap}>
                            <Ionicons name={card.icon as any} size={28} color="#fff" />
                          </View>
                          <Text style={styles.carouselTitle}>{card.title}</Text>
                          <Text style={styles.carouselDesc}>{card.desc}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </Animated.ScrollView>

                {/* Enhanced Dots Indicator */}
                <View style={styles.dotsRow}>
                  {benefitCards.map((_, i) => {
                    const inputRange = [(i - 1) * cardWidth, i * cardWidth, (i + 1) * cardWidth];
                    const dotOpacity = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.3, 1, 0.3],
                      extrapolate: 'clamp'
                    });
                    const dotScale = scrollX.interpolate({
                      inputRange,
                      outputRange: [0.8, 1.3, 0.8],
                      extrapolate: 'clamp'
                    });
                    const dotWidth = scrollX.interpolate({
                      inputRange,
                      outputRange: [8, 24, 8],
                      extrapolate: 'clamp'
                    });
                    return (
                      <Animated.View
                        key={i}
                        style={[
                          styles.dot,
                          {
                            opacity: dotOpacity,
                            width: dotWidth,
                            transform: [{ scale: dotScale }]
                          }
                        ]}
                      />
                    );
                  })}
                </View>
              </View>

              {/* Standard Form */}
              <View style={styles.formSection}>
                <Text style={styles.formTitle}>Your Details</Text>

                <Text style={styles.label}>Full Name *</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Enter your full name"
                  placeholderTextColor="#9CA3AF"
                  style={styles.input}
                  autoCapitalize="words"
                />
                {!validateName(fullName) && fullName.length > 0 && (
                  <Text style={styles.errorText}>Please enter at least 2 characters</Text>
                )}

                <Text style={styles.label}>Instagram Profile *</Text>
                <TextInput
                  value={instagramUrl}
                  onChangeText={setInstagramUrl}
                  placeholder="@username or instagram.com/username"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  style={styles.input}
                />
                {!validateInstagram(instagramUrl) && instagramUrl.length > 0 && (
                  <Text style={styles.errorText}>Please enter a valid Instagram handle or URL</Text>
                )}

                {/* Links Row */}
                <View style={styles.linkRow}>
                  <TouchableOpacity onPress={() => {
                    Alert.alert(
                      "Influencer Guidelines",
                      "Our guidelines ensure authentic partnerships and quality content that resonates with audiences.",
                      [{ text: "Got it", style: "default" }]
                    );
                  }}>
                    <Text style={styles.linkText}>📋 Guidelines</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    Alert.alert(
                      "Program Terms",
                      "Review our comprehensive terms and conditions for the influencer program.",
                      [{ text: "Understood", style: "default" }]
                    );
                  }}>
                    <Text style={styles.linkText}>📄 Terms</Text>
                  </TouchableOpacity>
                </View>

                {/* Standard Submit Button */}
                <TouchableOpacity
                  disabled={submitting || !isFormValid}
                  style={[
                    styles.submitButton,
                    {
                      opacity: (submitting || !isFormValid) ? 0.6 : 1,
                      backgroundColor: '#F53F7A'
                    }
                  ]}
                  onPress={handleSubmit}
                  activeOpacity={0.8}
                >
                  {submitting ? (
                    <View style={styles.submitContent}>
                      <ActivityIndicator color="#fff" size="small" />
                      <Text style={styles.submitText}>Processing...</Text>
                    </View>
                  ) : (
                    <View style={styles.submitContent}>
                      <Text style={styles.submitText}>Submit Application</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  headerWrapper: {
    backgroundColor: '#F53F7A',
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    zIndex: 1,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  heroIcon: {
    alignSelf: 'center',
    marginTop: 4,
    zIndex: 1,
  },
  heroIconBg: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  content: {
    paddingTop: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  carouselContainer: {
    marginBottom: 40,
  },
  carouselCard: {
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
    backgroundColor: '#fff',
  },
  cardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardContent: {
    padding: 28,
    alignItems: 'flex-start',
    minHeight: 180,
    justifyContent: 'space-between',
  },
  carouselIconWrap: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  carouselTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  carouselDesc: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    marginTop: 20,
    height: 12,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F53F7A',
    marginHorizontal: 5,
  },
  formSection: {
    paddingHorizontal: 24,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1F2937',
    marginBottom: 24,
    letterSpacing: -0.5,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 12,
    marginBottom: 6
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: '#111',
    backgroundColor: '#fff',
    fontSize: 14,
  },
  // Removed old inputWrapper and inputIconContainer and hero style
  linkText: {
    color: '#F53F7A',
    fontWeight: '700',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '500',
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  submitButton: {
    borderRadius: 10,
    backgroundColor: '#F53F7A',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  errorText: {
    marginTop: 6,
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  successCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  successText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#10B981',
    marginTop: 16,
    textAlign: 'center',
  },
});

export default JoinInfluencer;