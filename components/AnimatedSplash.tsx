import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface AnimatedSplashProps {
  onFinish: () => void;
}

const AnimatedSplash: React.FC<AnimatedSplashProps> = ({ onFinish }) => {
  // Main animations
  const fadeIn = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;
  const yearSlide = useRef(new Animated.Value(60)).current;
  const discoPulse = useRef(new Animated.Value(1)).current;
  const discoGlow = useRef(new Animated.Value(0.3)).current;

  // Snowflake animations - reduced to 4 for cleaner look
  const snowflakes = useRef(
    Array.from({ length: 4 }, () => ({
      opacity: new Animated.Value(0),
      y: new Animated.Value(0),
    }))
  ).current;

  const snowflakePositions = [
    { top: 80, left: 40, size: 24 },
    { top: 140, right: 50, size: 20 },
    { bottom: 200, left: 50, size: 22 },
    { bottom: 140, right: 40, size: 18 },
  ];

  useEffect(() => {
    // Main entrance - smoother timing
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 10,
        tension: 50,
        useNativeDriver: true,
      }),
      Animated.timing(yearSlide, {
        toValue: 0,
        duration: 1200,
        delay: 400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Disco ball gentle pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(discoPulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(discoPulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Soft glow animation for disco ball
    Animated.loop(
      Animated.sequence([
        Animated.timing(discoGlow, {
          toValue: 0.6,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(discoGlow, {
          toValue: 0.3,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Snowflake animations - gentle floating
    snowflakes.forEach((flake, index) => {
      const delay = index * 300;

      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(flake.opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.loop(
            Animated.sequence([
              Animated.timing(flake.y, {
                toValue: 8,
                duration: 2500 + index * 400,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
              Animated.timing(flake.y, {
                toValue: 0,
                duration: 2500 + index * 400,
                easing: Easing.inOut(Easing.sin),
                useNativeDriver: true,
              }),
            ])
          ),
        ]),
      ]).start();
    });

    // Exit
    const timer = setTimeout(() => {
      Animated.timing(fadeIn, {
        toValue: 0,
        duration: 500,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 4000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#F53F7A" translucent />

      {/* Clean Gradient Background */}
      <LinearGradient
        colors={['#FF7BAC', '#F53F7A', '#D62B66']}
        style={styles.background}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      >
        {/* Subtle decorative circles */}
        <View style={styles.decorCircle1} />
        <View style={styles.decorCircle2} />

        {/* Floating Snowflakes - simpler, no rotation */}
        {snowflakes.map((flake, index) => {
          const pos = snowflakePositions[index];
          return (
            <Animated.View
              key={index}
              style={[
                styles.snowflake,
                pos,
                {
                  opacity: flake.opacity,
                  transform: [{ translateY: flake.y }],
                },
              ]}
            >
              <MaterialCommunityIcons
                name="snowflake"
                size={pos.size}
                color="rgba(255,255,255,0.5)"
              />
            </Animated.View>
          );
        })}

        {/* Main Content */}
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeIn, transform: [{ scale: logoScale }] },
          ]}
        >
          {/* Brand Name */}
          <Text style={styles.brandName}>Only2U</Text>

          {/* Tagline */}
          <Text style={styles.tagline}>YOUR FASHION DESTINATION</Text>

          {/* Welcoming */}
          <Text style={styles.welcomingText}>WELCOMING</Text>

          {/* Clean 2026 Display */}
          <Animated.View
            style={[
              styles.yearContainer,
              { transform: [{ translateY: yearSlide }] },
            ]}
          >
            {/* Row 1: 2 and Disco Ball (as 0) */}
            <View style={styles.yearRow}>
              <Text style={styles.yearDigit}>2</Text>

              {/* Disco Ball replacing 0 - with soft glow */}
              <Animated.View
                style={[
                  styles.discoBallContainer,
                  { transform: [{ scale: discoPulse }] },
                ]}
              >
                {/* Soft glow behind disco ball */}
                <Animated.View style={[styles.discoGlow, { opacity: discoGlow }]} />

                <View style={styles.discoBall}>
                  <LinearGradient
                    colors={['#FFD4E0', '#FF8AAD', '#E84A7F']}
                    style={styles.discoBallGradient}
                    start={{ x: 0.2, y: 0.2 }}
                    end={{ x: 0.8, y: 0.8 }}
                  >
                    {/* Simplified disco ball pattern */}
                    {Array.from({ length: 3 }).map((_, row) =>
                      Array.from({ length: 5 }).map((_, col) => (
                        <View
                          key={`${row}-${col}`}
                          style={[
                            styles.discoTile,
                            {
                              top: 12 + row * 18,
                              left: 8 + col * 12,
                              opacity: (row + col) % 2 === 0 ? 0.5 : 0.25,
                            },
                          ]}
                        />
                      ))
                    )}
                  </LinearGradient>
                </View>
              </Animated.View>
            </View>

            {/* Row 2: 26 */}
            <View style={styles.yearRow}>
              <Text style={styles.yearDigitBottom}>26</Text>
            </View>
          </Animated.View>
        </Animated.View>

        {/* Bottom accent line */}
        <View style={styles.bottomAccent} />
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  decorCircle1: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width * 0.75,
    backgroundColor: 'rgba(255,255,255,0.03)',
    top: -width * 0.5,
    left: -width * 0.25,
  },
  decorCircle2: {
    position: 'absolute',
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width * 0.6,
    backgroundColor: 'rgba(255,255,255,0.02)',
    bottom: -width * 0.4,
    right: -width * 0.3,
  },
  snowflake: {
    position: 'absolute',
    zIndex: 10,
  },
  content: {
    alignItems: 'center',
    zIndex: 20,
  },
  brandName: {
    fontSize: 54,
    fontFamily: 'Riccione-Serial-Bold',
    color: '#fff',
    letterSpacing: 3,
    textShadowColor: 'rgba(0,0,0,0.15)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
    marginBottom: 14,
  },
  tagline: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 4,
    fontWeight: '600',
    marginBottom: 60,
  },
  welcomingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    letterSpacing: 8,
    fontWeight: '500',
    marginBottom: 16,
  },
  yearContainer: {
    alignItems: 'center',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearDigit: {
    fontSize: 110,
    fontFamily: 'Riccione-Serial-Bold',
    color: 'rgba(255,255,255,0.2)',
    marginRight: -8,
  },
  yearDigitBottom: {
    fontSize: 110,
    fontFamily: 'Riccione-Serial-Bold',
    color: 'rgba(255,255,255,0.2)',
    marginTop: -35,
  },
  discoBallContainer: {
    marginLeft: -8,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discoGlow: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#fff',
  },
  discoBall: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  discoBallGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 36,
  },
  discoTile: {
    position: 'absolute',
    width: 10,
    height: 12,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },
  bottomAccent: {
    position: 'absolute',
    bottom: 60,
    width: 60,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
});

export default AnimatedSplash;
