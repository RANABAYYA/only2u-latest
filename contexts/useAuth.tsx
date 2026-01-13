import React, { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '~/utils/supabase';

interface AuthContextType {
  user: any | null;
  setUser: (user: any | null) => void;
  loading: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (needs: boolean) => void;
  refreshAuthUser: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function Provider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('[useAuth] Getting initial session...');

        // FIRST: Check AsyncStorage for cached user data (primary persistence)
        const cachedUserData = await AsyncStorage.getItem('cached_user_data');
        const lastPhone = await AsyncStorage.getItem('last_logged_in_phone');

        if (cachedUserData) {
          const parsedUser = JSON.parse(cachedUserData);
          console.log('[useAuth] Found cached user data:', parsedUser.id);

          // Verify this user still exists in database (by phone for reliability)
          if (lastPhone) {
            const { data: dbUser, error: dbError } = await supabase
              .from('users')
              .select('*')
              .eq('phone', lastPhone)
              .maybeSingle();

            if (dbUser && !dbError) {
              console.log('[useAuth] Verified user from database by phone');
              setUser(dbUser);
              setNeedsOnboarding(false);
              setLoading(false);

              // Try to establish a Supabase session if we don't have one
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                // Sign in anonymously to get a session for API calls
                await supabase.auth.signInAnonymously();
              }
              return;
            }
          }

          // Phone not found in DB but we have cached data - use it anyway
          console.log('[useAuth] Using cached user data (no DB verification)');
          setUser(parsedUser);
          setNeedsOnboarding(false);
          setLoading(false);
          return;
        }

        // SECOND: Check Supabase session (fallback)
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[useAuth] Supabase session:', session?.user?.id);

        if (session?.user) {
          // Try to find user by session ID
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (userData) {
            console.log('[useAuth] Found user by session ID');
            setUser(userData);
            setNeedsOnboarding(false);
            // Cache for next time
            await AsyncStorage.setItem('cached_user_data', JSON.stringify(userData));
            if (userData.phone) {
              await AsyncStorage.setItem('last_logged_in_phone', userData.phone);
            }
          } else if (lastPhone) {
            // Try phone fallback
            console.log('[useAuth] Trying phone fallback...');
            const { data: phoneUserData, error: phoneError } = await supabase
              .from('users')
              .select('*')
              .eq('phone', lastPhone)
              .maybeSingle();

            if (phoneUserData && !phoneError) {
              console.log('[useAuth] Found user by phone');
              setUser(phoneUserData);
              setNeedsOnboarding(false);
              await AsyncStorage.setItem('cached_user_data', JSON.stringify(phoneUserData));
            } else {
              setNeedsOnboarding(true);
              setUser(null);
            }
          } else {
            setNeedsOnboarding(true);
            setUser(null);
          }
        } else if (lastPhone) {
          // No session but we have a phone - try to find user
          console.log('[useAuth] No session, trying phone lookup:', lastPhone);
          const { data: phoneUserData } = await supabase
            .from('users')
            .select('*')
            .eq('phone', lastPhone)
            .maybeSingle();

          if (phoneUserData) {
            console.log('[useAuth] Found user by phone, creating session');
            setUser(phoneUserData);
            setNeedsOnboarding(false);
            await AsyncStorage.setItem('cached_user_data', JSON.stringify(phoneUserData));
            // Create anonymous session for API access
            await supabase.auth.signInAnonymously();
          }
        }
      } catch (error) {
        console.error('[useAuth] Error in getInitialSession:', error);
      }
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') && session?.user) {
          // Fetch user profile data
          const { data: userData, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          console.log('User data fetch result:', userData, error);

          if (userData) {
            setUser(userData);
            setNeedsOnboarding(false);
            console.log('User set in context:', userData);
          } else if (error && error.code === 'PGRST116') {
            // User profile doesn't exist, needs onboarding
            console.log('User needs onboarding - no profile found');
            setNeedsOnboarding(true);
            setUser(null);
          } else if (error && error.code === '42P17') {
            // RLS infinite recursion error - treat as new user needing onboarding
            console.log('RLS recursion error - treating as new user needing onboarding');
            setNeedsOnboarding(true);
            setUser(null);
          } else if (error) {
            console.error('Unexpected error fetching user data:', error);
            // For other errors, also treat as needing onboarding to avoid blocking the user
            setNeedsOnboarding(true);
            setUser(null);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setNeedsOnboarding(false);
          console.log('User signed out');
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Imperative function to refresh user data after login/signup
  const refreshAuthUser = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: userData, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (userData && !error) {
          setUser(userData);
          setNeedsOnboarding(false);
          console.log('[useAuth] refreshAuthUser: User set:', userData.id);
        } else if (!userData) {
          // Profile doesn't exist yet
          setNeedsOnboarding(true);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('[useAuth] refreshAuthUser error:', error);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        needsOnboarding,
        setNeedsOnboarding,
        refreshAuthUser,
      }}>
      {props.children}
    </AuthContext.Provider>
  );
}