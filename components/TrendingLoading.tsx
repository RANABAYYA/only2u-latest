import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
 v import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

interface TrendingLoadingProps {
    visible: boolean;
}



export const TrendingLoading = ({ visible }: TrendingLoadingProps) => {
    const fadeAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(0.9)).current;
    const discoPulse = useRef(new Animated.Value(1)).current;
    const hasShownRef = useRef(false);
    const animationsRef = useRef<Animated.CompositeAnimation[]>([]);

    // Bouncing dots
    const dot1 = useRef(new Animated.Value(0)).current;
    const dot2 = useRef(new Animated.Value(0)).current;
    const dot3 = useRef(new Animated.Value(0)).current;

    // Stop all animations
    const stopAllAnimations = () => {
        animationsRef.current.forEach(anim => anim.stop());
        animationsRef.current = [];
    };

    useEffect(() => {
        if (!visible) {
            // Fade out and stop animations
            if (hasShownRef.current) {
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 300,
                    useNativeDriver: true,
                }).start(() => {
                    stopAllAnimations();
                });
            }
        } else {
            if (!hasShownRef.current) {
                hasShownRef.current = true;
                fadeAnim.setValue(1);

                // Logo entrance
                const entranceAnim = Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true,
                });
                entranceAnim.start();

                // Disco pulse - simplified
                const pulseAnim = Animated.loop(
                    Animated.sequence([
                        Animated.timing(discoPulse, {
                            toValue: 1.1,
                            duration: 700,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                        Animated.timing(discoPulse, {
                            toValue: 1,
                            duration: 700,
                            easing: Easing.inOut(Easing.sin),
                            useNativeDriver: true,
                        }),
                    ])
                );
                pulseAnim.start();
                animationsRef.current.push(pulseAnim);

                // Bouncing dots - simplified
                const animateDot = (anim: Animated.Value, delay: number) => {
                    const dotAnim = Animated.loop(
                        Animated.sequence([
                            Animated.timing(anim, {
                                toValue: -8,
                                duration: 400,
                                delay,
                                easing: Easing.out(Easing.cubic),
                                useNativeDriver: true,
                            }),
                            Animated.timing(anim, {
                                toValue: 0,
                                duration: 400,
                                easing: Easing.in(Easing.cubic),
                                useNativeDriver: true,
                            }),
                        ])
                    );
                    dotAnim.start();
                    animationsRef.current.push(dotAnim);
                };

                animateDot(dot1, 0);
                animateDot(dot2, 150);
                animateDot(dot3, 300);
            } else {
                fadeAnim.setValue(1);
            }
        }

        return () => {
            if (!visible) {
                stopAllAnimations();
            }
        };
    }, [visible]);

    // Don't render anything if not visible (performance)
    if (!visible && (fadeAnim as any)._value === 0) return null;

    return (
        <Animated.View
            style={[
                styles.container,
                { opacity: fadeAnim },
                !visible && styles.pointerEventsNone
            ]}
        >
            {/* Pink Theme Background - Simplified */}
            <LinearGradient
                colors={['#FF6B9C', '#F53F7A', '#E8306B']}
                style={styles.gradient}
            >
                <Animated.View style={[styles.content, { transform: [{ scale: scaleAnim }] }]}>
                    {/* Disco Ball */}
                    <Animated.View
                        style={[
                            styles.discoBallContainer,
                            { transform: [{ scale: discoPulse }] },
                        ]}
                    >
                        <View style={styles.discoBall}>
                            <LinearGradient
                                colors={['#FFB6C1', '#F53F7A', '#C72C5C']}
                                style={styles.discoBallGradient}
                            >
                                {/* Simplified disco tiles */}
                                {Array.from({ length: 3 }).map((_, row) =>
                                    Array.from({ length: 4 }).map((_, col) => (
                                        <View
                                            key={`${row}-${col}`}
                                            style={[
                                                styles.discoTile,
                                                {
                                                    top: 12 + row * 18,
                                                    left: 12 + col * 15,
                                                    opacity: (row + col) % 2 === 0 ? 0.4 : 0.2,
                                                },
                                            ]}
                                        />
                                    ))
                                )}
                            </LinearGradient>
                        </View>

                        {/* Single sparkle */}
                        <Ionicons
                            name="sparkles"
                            size={16}
                            color="#fff"
                            style={styles.sparkle}
                        />
                    </Animated.View>

                    {/* Title */}
                    <Text style={styles.title}>Loading trends...</Text>

                    {/* Loading Dots */}
                    <View style={styles.dotsContainer}>
                        <Animated.View style={[styles.dot, { transform: [{ translateY: dot1 }] }]} />
                        <Animated.View style={[styles.dotMiddle, { transform: [{ translateY: dot2 }] }]} />
                        <Animated.View style={[styles.dot, { transform: [{ translateY: dot3 }] }]} />
                    </View>
                </Animated.View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
    },
    pointerEventsNone: {
        pointerEvents: 'none',
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
    },
    discoBallContainer: {
        marginBottom: 25,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 8,
    },
    discoBall: {
        width: 70,
        height: 70,
        borderRadius: 35,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    discoBallGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 35,
    },
    discoTile: {
        position: 'absolute',
        width: 10,
        height: 12,
        backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2,
    },
    sparkle: {
        position: 'absolute',
        top: -8,
        right: -4,
    },
    title: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '600',
        marginBottom: 25,
        letterSpacing: 0.5,
    },
    dotsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#FFD700',
    },
    dotMiddle: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#fff',
    },
});
