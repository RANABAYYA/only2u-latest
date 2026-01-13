import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';

const DashboardLoader = () => {
    // Shared animation value for scaling/opacity
    const animValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(animValue, {
                toValue: 1,
                duration: 2000,
                easing: Easing.bezier(0.4, 0, 0.2, 1),
                useNativeDriver: true,
            })
        ).start();
    }, [animValue]);

    return (
        <View style={styles.container}>
            {/* Ripple Circles */}
            {[0, 1, 2].map((i) => {
                const inputRange = [0, 0.5, 1];
                // Stagger ripples: first one starts at 0, second midway
                const startOff = i * 0.3;

                // Infinite expanding logic for multiple ripples is complex with single value
                // Let's use a simpler approach: One main ripple or simpler loop

                // Redoing logic for a clean single ripple + breathing logo
                return null;
            })}

            {/* 
               Better implementation: 
               Pulsing Logo in center.
               Two rings radiating out.
             */}

            {/* Outer Ring 1 */}
            <Animated.View style={[
                styles.ring,
                {
                    transform: [{ scale: animValue.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
                    opacity: animValue.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.3, 0.1, 0] })
                }
            ]} />

            {/* Outer Ring 2 (Delayed/Staggered - simplified to just one ring for cleaner look or recreate staggering if needed) */}
            {/* A single clean ripple is often more elegant. Let's stick to one nice ripple and a breathing core. */}

            <Animated.View style={styles.centerCircle}>
                <Text style={styles.logoText}>
                    O<Text style={styles.accentText}>2</Text>U
                </Text>
            </Animated.View>
        </View>
    );
};

// Re-implementing with proper separate animations for maximum smoothness
const DashboardLoaderFinal = () => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // Multiple ripples
    const ripple1 = useRef(new Animated.Value(0)).current;
    const ripple2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Breathing logo
        Animated.loop(
            Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 800, useNativeDriver: true })
            ])
        ).start();

        // Ripple 1
        Animated.loop(
            Animated.timing(ripple1, {
                toValue: 1,
                duration: 2500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        ).start();

        // Ripple 2 (Delay start)
        setTimeout(() => {
            Animated.loop(
                Animated.timing(ripple2, {
                    toValue: 1,
                    duration: 2500,
                    easing: Easing.out(Easing.ease),
                    useNativeDriver: true,
                })
            ).start();
        }, 1250);

    }, []);

    const renderRipple = (anim: Animated.Value) => (
        <Animated.View style={[
            styles.ring,
            {
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 3] }) }],
                opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 0.1, 0] })
            }
        ]} />
    );

    return (
        <View style={styles.container}>
            {renderRipple(ripple1)}
            {renderRipple(ripple2)}

            {/* Main Logo Circle */}
            <Animated.View style={[styles.centerCircle, { transform: [{ scale: scaleAnim }] }]}>
                <Text style={styles.logoText}>O2U</Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff', // Clean white background
    },
    ring: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#FF3F6C', // Brand pink
        zIndex: 0,
    },
    centerCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.15,
        shadowRadius: 3.84,
        elevation: 5,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    logoText: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FF3F6C',
        includeFontPadding: false,
    }
});

export default DashboardLoaderFinal;
