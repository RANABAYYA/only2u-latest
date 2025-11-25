import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';

const { width, height } = Dimensions.get('window');

const MaintenanceMode = ({ children }: { children: React.ReactNode }) => {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const iconRotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkMaintenanceMode();
    
    // Subscribe to real-time changes in maintenance mode
    const channel = supabase
      .channel('maintenance_mode_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settings',
          filter: 'key=eq.maintenance_mode',
        },
        (payload) => {
          if (payload.new) {
            const value = (payload.new as any).value;
            setIsMaintenanceMode(value === 'true');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Animation effects
  useEffect(() => {
    if (isMaintenanceMode) {
      // Fade in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse animation for icon
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Rotate animation for icon
      Animated.loop(
        Animated.timing(iconRotateAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        })
      ).start();
    }
  }, [isMaintenanceMode]);

  const checkMaintenanceMode = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'maintenance_mode')
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('Error checking maintenance mode:', error);
        // If error, assume not in maintenance mode to allow app to function
        setIsMaintenanceMode(false);
      } else {
        setIsMaintenanceMode(data?.value === 'true');
      }
    } catch (error) {
      console.error('Error in checkMaintenanceMode:', error);
      setIsMaintenanceMode(false);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F53F7A" />
      </View>
    );
  }

  if (isMaintenanceMode) {
    const iconRotation = iconRotateAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#FFF5F5', '#FFFFFF', '#FFF5F5']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Animated.View
              style={[
                styles.iconContainer,
                {
                  transform: [
                    { scale: pulseAnim },
                    { rotate: iconRotation },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={['#FFE8F0', '#FFF0F5']}
                style={styles.iconGradient}
              >
                <Ionicons name="construct" size={64} color="#F53F7A" />
              </LinearGradient>
            </Animated.View>

            <View style={styles.titleContainer}>
              <Text style={styles.title}>Under Maintenance</Text>
              <View style={styles.titleUnderline} />
            </View>

            <Text style={styles.message}>
              Because of huge traffic, we are currently{'\n'}maintaining our server
            </Text>

            <View style={styles.detailsContainer}>
              <View style={styles.heartIconContainer}>
                <Ionicons name="heart" size={24} color="#F53F7A" />
              </View>
              <Text style={styles.detailsText}>
                We sincerely regret this inconvenience. We're working hard to improve your experience and ensure smooth service. We will be back shortly. Thank you for your patience and understanding! ❤️
              </Text>
            </View>

            <View style={styles.loadingIndicator}>
              <ActivityIndicator size="small" color="#F53F7A" />
              <Text style={styles.loadingText}>Please wait...</Text>
            </View>
          </Animated.View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  iconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  titleUnderline: {
    width: 60,
    height: 4,
    backgroundColor: '#F53F7A',
    borderRadius: 2,
    marginTop: 8,
  },
  message: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 32,
    fontWeight: '500',
    paddingHorizontal: 8,
  },
  detailsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    maxWidth: '95%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#FFE8F0',
  },
  heartIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFE8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  detailsText: {
    fontSize: 15,
    color: '#555',
    flex: 1,
    lineHeight: 24,
    fontWeight: '400',
  },
  loadingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 24,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 8,
    fontWeight: '500',
  },
});

export default MaintenanceMode;

