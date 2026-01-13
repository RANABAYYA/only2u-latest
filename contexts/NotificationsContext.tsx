import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from './UserContext';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from '~/utils/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type AppNotification = {
  id: string;
  title: string;
  subtitle?: string;
  image?: string;
  timeIso: string;
  unread: boolean;
  productId?: string; // For face swap notifications
  resultImages?: string[]; // For face swap result images
};

type NotificationsContextType = {
  notifications: AppNotification[];
  unreadCount: number;
  expoPushToken: string | undefined;
  addNotification: (n: Omit<AppNotification, 'id' | 'timeIso' | 'unread'> & { timeIso?: string }) => Promise<void>;
  markAllRead: () => Promise<void>;
  removeNotification: (id: string) => Promise<void>;
  clear: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

async function registerForPushNotificationsAsync() {
  // Create notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
      sound: 'default',
    });
  }

  // Check if running on physical device
  if (!Device.isDevice) {
    console.log('[PushNotifications] Must use physical device for Push Notifications');
    return undefined;
  }

  // Request permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    console.log('[PushNotifications] Requesting permission...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[PushNotifications] Permission denied!');
    return undefined;
  }

  console.log('[PushNotifications] Permission granted, fetching token...');

  // Get project ID - try multiple sources for production compatibility
  let projectId = Constants?.expoConfig?.extra?.eas?.projectId
    ?? Constants?.easConfig?.projectId;

  // Hardcoded fallback for production builds where Constants may not be available
  if (!projectId) {
    projectId = '23280bb9-6b62-412f-a55b-292d7738e440'; // From app.json extra.eas.projectId
    console.log('[PushNotifications] Using hardcoded projectId:', projectId);
  } else {
    console.log('[PushNotifications] Using projectId from Constants:', projectId);
  }

  // Retry logic for token fetch
  const maxRetries = 3;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync({
        projectId,
      });

      const pushTokenString = tokenResponse.data;
      console.log('[PushNotifications] ✅ Expo Push Token obtained:', pushTokenString);
      return pushTokenString;
    } catch (e: unknown) {
      lastError = e;
      console.error(`[PushNotifications] Attempt ${attempt}/${maxRetries} failed:`, e);

      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  console.error('[PushNotifications] ❌ Failed to get push token after all retries:', lastError);
  return undefined;
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { userData } = useUser();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>('');
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();

  // Calculate unread count
  const unreadCount = notifications.filter(n => n.unread).length;

  const storageKey = userData?.id ? `notifications_${userData.id}` : undefined;

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => setExpoPushToken(token));

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      // Handle incoming notification while app is in foreground
      // We can also choose to add it to our local notifications list here
      console.log('Notification Received:', notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification Clicked:', response);
    });

    return () => {
      notificationListener.current && Notifications.removeNotificationSubscription(notificationListener.current);
      responseListener.current && Notifications.removeNotificationSubscription(responseListener.current);
    };
  }, []);

  // Sync token to database when user logs in or token changes
  useEffect(() => {
    console.log('[NotificationsContext] Checking token sync:', { userId: userData?.id, hasToken: !!expoPushToken });
    if (userData?.id && expoPushToken) {
      console.log('[NotificationsContext] Attempting to save token to DB...');
      saveTokenToDatabase(expoPushToken, userData.id);
    }
  }, [userData?.id, expoPushToken]);

  useEffect(() => {
    const load = async () => {
      if (!storageKey) return;
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        setNotifications(raw ? JSON.parse(raw) : []);
      } catch {
        setNotifications([]);
      }
    };
    load();
  }, [storageKey]);

  const persist = async (next: AppNotification[]) => {
    if (!storageKey) return;
    setNotifications(next);
    await AsyncStorage.setItem(storageKey, JSON.stringify(next));
  };

  const addNotification: NotificationsContextType['addNotification'] = async (n) => {
    if (!storageKey) return;
    const item: AppNotification = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      title: n.title,
      subtitle: n.subtitle,
      image: n.image,
      timeIso: n.timeIso ?? new Date().toISOString(),
      unread: true,
    };
    await persist([item, ...notifications]);
  };

  const markAllRead = async () => {
    await persist(notifications.map(n => ({ ...n, unread: false })));
  };

  const removeNotification = async (id: string) => {
    await persist(notifications.filter(n => n.id !== id));
  };

  const clear = async () => {
    await persist([]);
  };

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, expoPushToken, addNotification, markAllRead, removeNotification, clear }}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = (): NotificationsContextType => {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
  return ctx;
};

// Helper to save token to Supabase
const saveTokenToDatabase = async (token: string, userId: string) => {
  console.log(`[NotificationsContext] Saving token for user ${userId}: ${token.substring(0, 20)}...`);
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ expo_push_token: token })
      .eq('id', userId)
      .select();

    if (error) {
      console.error('[NotificationsContext] ❌ Error saving push token to database:', error);
    } else {
      console.log('[NotificationsContext] ✅ Push token saved to database. Data:', data);
    }
  } catch (err) {
    console.error('[NotificationsContext] ❌ Exception saving push token:', err);
  }
};
