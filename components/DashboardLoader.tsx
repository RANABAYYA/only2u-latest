import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    interpolateColor,
    Easing,
    useDerivedValue
} from 'react-native-reanimated';

const DashboardLoader = () => {
    // Animation progress value that moves from left to right across the characters
    const progress = useSharedValue(-2);

    useEffect(() => {
        progress.value = withRepeat(
            withTiming(8, {
                duration: 2000,
                easing: Easing.linear,
            }),
            -1, // Infinite repeat
            false // No reverse, just restart
        );
    }, []);

    const LETTERS = [
        { char: 'O', color: '#1a1a1a' },
        { char: 'n', color: '#1a1a1a' },
        { char: 'l', color: '#1a1a1a' },
        { char: 'y', color: '#1a1a1a' },
        { char: '2', color: '#F53F7A' },
        { char: 'U', color: '#1a1a1a' },
    ];

    const FONT_FAMILY = 'Riccione-Serial-Bold';
    // Highlight color to slide across (Brand Pink for black text, White for pink text)
    const HIGHLIGHT_COLOR = '#F53F7A';
    const ALT_HIGHLIGHT_COLOR = '#FFFFFF'; // or a lighter pink like '#FF8FA3'

    return (
        <View style={styles.container}>
            <View style={styles.logoContainer}>
                {LETTERS.map((item, index) => {
                    // Create an animated style for each letter
                    const animatedStyle = useAnimatedStyle(() => {
                        // Calculate distance of this letter from the current "wave" position
                        // We want a gaussian-like or triangular window passing through
                        const distance = Math.abs(progress.value - index);

                        // Interaction window size
                        const windowSize = 1.5;

                        // If within window, interpolate color
                        // For black letters (Only, U): Black -> Pink -> Black
                        // For pink letter (2): Pink -> White -> Pink

                        let targetColor;
                        if (item.color === '#F53F7A') {
                            // It's the '2'
                            // Interpolate towards white/light pink
                            // 0 distance = full effect
                            const intensity = Math.max(0, 1 - distance / windowSize);
                            return {
                                color: interpolateColor(
                                    intensity,
                                    [0, 1],
                                    [item.color, '#FFB6C1'] // Light pink highlight
                                ),
                                transform: [
                                    { scale: 1 + (intensity * 0.1) } // Slight scale up
                                ]
                            };
                        } else {
                            // It's black text
                            const intensity = Math.max(0, 1 - distance / windowSize);
                            return {
                                color: interpolateColor(
                                    intensity,
                                    [0, 1],
                                    [item.color, '#F53F7A']
                                ),
                                transform: [
                                    { scale: 1 + (intensity * 0.1) } // Slight scale up
                                ]
                            };
                        }
                    });

                    return (
                        <Animated.Text
                            key={index}
                            style={[
                                styles.text,
                                { fontFamily: FONT_FAMILY },
                                animatedStyle
                            ]}
                        >
                            {item.char}
                        </Animated.Text>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    text: {
        fontSize: 32, // Large size as requested
        fontWeight: 'normal', // Font handles weight
        letterSpacing: -0.5,
    },
});

export default DashboardLoader;
