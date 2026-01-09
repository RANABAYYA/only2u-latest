import { useState, useEffect, useRef } from 'react';
import {
  Text,
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Platform,
  KeyboardAvoidingView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/useAuth';
import { Only2ULogo } from '../components/common';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

// Hook to warm up browser for faster load
const useWarmUpBrowser = () => {
  useEffect(() => {
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
};

const Login = () => {
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation: any = useNavigation();

  useWarmUpBrowser();

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // Create a redirect URI that matches your app's scheme (works in Expo Go and Prod)
      // Using root path '/' is often more reliable for Expo Go redirects
      const redirectUrl = Linking.createURL('/');
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

            Toast.show({
              type: 'success',
              text1: 'Google Login Successful',
              text2: 'Welcome to Only2U!',
            });
            return;
          }

          // Fallback: Implicit Flow (access_token in hash)
          // Parse tokens from the redirect URL
          // The URL will look like: only2u://dashboard#access_token=...&refresh_token=...&...
          // or only2u://dashboard?access_token=... (depending on Supabase config, usually hash for implicit flow)

          // Use Linking.parse to help, but it might put hash vars in key-value pairs if configured
          // Or we can manually regex it for safety

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
              Toast.show({ type: 'success', text1: 'Login Successful' });
            } else {
              throw new Error('Could not retrieve session tokens.');
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Google Login Error:', err);
      // Ignore text dismissal by user
      if (err.message !== 'User cancelled') {
        Toast.show({
          type: 'error',
          text1: 'Google Login Failed',
          text2: err.message || 'An unknown error occurred.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email address');
      setLoading(false);
      return;
    }

    if (!password.trim()) {
      setError('Please enter your password');
      setLoading(false);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password: password,
    });

    if (signInError) {
      setError(signInError.message);
      Toast.show({ type: 'error', text1: 'Login Failed', text2: signInError.message });
      setLoading(false);
      return;
    }

    Toast.show({
      type: 'success',
      text1: 'Login Successful',
      text2: 'Welcome to Only2U!'
    });
    setLoading(false);

    // Auth context will handle user profile creation and navigation automatically
  };

  // Navigation is now handled by AuthFlowScreen automatically

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#F53F7A" />
      <LinearGradient
        colors={['#FF6EA6', '#F53F7A', '#E91E63']}
        style={styles.container}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <SafeAreaView style={styles.safeArea}>
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Header Section */}
              <Animated.View
                style={[
                  styles.headerSection,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  }
                ]}
              >
                <View style={styles.logoContainer}>
                  <View style={styles.logoCircle}>
                    <Text style={styles.logoText}>
                      <Only2ULogo size="large" />
                    </Text>
                  </View>
                </View>

                <View style={styles.headerTextContainer}>
                  <Text style={styles.welcomeTitle}>Welcome Back!</Text>
                  <Text style={styles.welcomeSubtitle}>
                    Sign in with your email and password to continue
                  </Text>
                </View>
              </Animated.View>

              {/* Form Section */}
              <Animated.View
                style={[
                  styles.formSection,
                  {
                    opacity: fadeAnim,
                    transform: [
                      { translateY: slideAnim },
                      { scale: scaleAnim }
                    ],
                  }
                ]}
              >
                <View style={styles.formCard}>
                  <Text style={styles.formTitle}>
                    Login to Your Account
                  </Text>

                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="mail-outline" size={20} color="#666" style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        placeholderTextColor="#999"
                        editable={!loading}
                      />
                    </View>
                  </View>

                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="lock-closed-outline" size={20} color="#666" style={{ marginRight: 12 }} />
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        placeholderTextColor="#999"
                        editable={!loading}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={20}
                          color="#666"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {error && (
                    <View style={styles.errorContainer}>
                      <Ionicons name="warning" size={16} color="#FF4444" />
                      <Text style={styles.errorText}>{error}</Text>
                    </View>
                  )}

                  {/* Action Button */}
                  <TouchableOpacity
                    style={[styles.actionButton, (loading || !email.trim() || !password.trim()) && styles.actionButtonDisabled]}
                    onPress={handleLogin}
                    disabled={loading || !email.trim() || !password.trim()}
                  >
                    <LinearGradient
                      colors={['#FF6EA6', '#F53F7A']}
                      style={styles.buttonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <View style={styles.buttonContent}>
                          <Text style={styles.buttonText}>
                            Login
                          </Text>
                          <Ionicons
                            name="arrow-forward"
                            size={20}
                            color="#fff"
                          />
                        </View>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 20 }}>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5E5' }} />
                    <Text style={{ marginHorizontal: 10, color: '#666', fontSize: 13, fontWeight: '600' }}>OR</Text>
                    <View style={{ flex: 1, height: 1, backgroundColor: '#E5E5E5' }} />
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      {
                        backgroundColor: '#fff',
                        borderWidth: 1.5,
                        borderColor: '#EEE',
                        elevation: 0,
                        shadowColor: 'transparent',
                        marginBottom: 10
                      }
                    ]}
                    onPress={handleGoogleLogin}
                    disabled={loading}
                  >
                    <View style={[styles.buttonContent, { justifyContent: 'center' }]}>
                      <Ionicons name="logo-google" size={20} color="#000" style={{ marginRight: 10 }} />
                      <Text style={[styles.buttonText, { color: '#000', fontSize: 16 }]}>
                        Sign in with Google
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.signupLinkContainer}>
                    <Text style={styles.signupLinkText}>Don't have an account? </Text>
                    <TouchableOpacity onPress={() => navigation.navigate('Register' as never)}>
                      <Text style={styles.signupLink}>Sign Up</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.termsText}>
                  By continuing, you agree to our{' '}
                  <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
                  <Text style={styles.termsLink}>Privacy Policy</Text>
                </Text>
              </Animated.View>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 20,
  },
  headerSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 20,
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoCircle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 35,
    paddingHorizontal: 24,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
  },
  formSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  formCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 12,
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#333',
    textAlign: 'center',
    marginBottom: 28,
  },
  inputSection: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E9ECEF',
    height: 56,
    paddingHorizontal: 16,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 0,
  },
  signupLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  signupLinkText: {
    fontSize: 14,
    color: '#6C757D',
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE6E6',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#FF4444',
    marginLeft: 8,
    flex: 1,
  },
  actionButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  buttonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 16,
    color: '#F53F7A',
    fontWeight: '600',
    marginLeft: 6,
  },
  termsText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  termsLink: {
    color: '#fff',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});

export default Login;