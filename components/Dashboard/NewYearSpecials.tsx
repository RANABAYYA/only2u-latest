import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Dimensions, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Product } from '~/types/product';
import { getFirstSafeProductImage } from '~/utils/imageUtils';

interface NewYearSpecialsProps {
    products: Product[];
    onProductPress: (product: Product) => void;
    onSeeAllPress: () => void;
}

const NewYearSpecials: React.FC<NewYearSpecialsProps> = ({ products, onProductPress, onSeeAllPress }) => {
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;
    const floatAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Pulse animation for the badge
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

        // Shimmer effect
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 2500,
                easing: Easing.linear,
                useNativeDriver: true,
            })
        ).start();

        // Floating effect for header elements
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim, {
                    toValue: -5,
                    duration: 1500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.sin),
                }),
                Animated.timing(floatAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: true,
                    easing: Easing.inOut(Easing.sin),
                }),
            ])
        ).start();
    }, []);

    if (!products || products.length === 0) return null;

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-300, 300],
    });

    return (
        <View style={styles.container}>
            {/* Dynamic Background */}
            <LinearGradient
                colors={['#FFF0F5', '#FFEef2', '#FFF5F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBackground}
            >
                {/* Decorative Background Elements */}
                <Animated.View style={[styles.decoStar, { top: 10, right: 30, opacity: 0.2, transform: [{ translateY: floatAnim }] }]}>
                    <Ionicons name="sparkles" size={24} color="#F53F7A" />
                </Animated.View>
                <Animated.View style={[styles.decoStar, { bottom: 20, left: 10, opacity: 0.15 }]}>
                    <Ionicons name="star" size={18} color="#FFD700" />
                </Animated.View>

                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Animated.View style={[styles.badgeContainer, { transform: [{ scale: pulseAnim }] }]}>
                            <LinearGradient
                                colors={['#1a1008', '#2a1b12']} // Premium Dark/Gold vibe
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.badgeGradient}
                            >
                                <Ionicons name="sparkles" size={10} color="#FFD700" style={{ marginRight: 4 }} />
                                <Text style={styles.badgeText}>HELLO 2026</Text>
                                <Ionicons name="sparkles" size={10} color="#FFD700" style={{ marginLeft: 4 }} />
                            </LinearGradient>
                        </Animated.View>
                        <View style={styles.titleRow}>
                            <Text style={styles.title}>New Year Epic Sale</Text>
                            <MaterialCommunityIcons name="party-popper" size={24} color="#F53F7A" style={{ marginLeft: 8 }} />
                        </View>
                        <Text style={styles.subtitle}>Unbox the future of fashion ✨</Text>
                    </View>
                    <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAllPress} activeOpacity={0.7}>
                        <Text style={styles.seeAllText}>Explore</Text>
                        <View style={styles.arrowCircle}>
                            <Ionicons name="arrow-forward" size={14} color="#fff" />
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Product List */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                >
                    {products.slice(0, 8).map((product, index) => (
                        <TouchableOpacity
                            key={product.id}
                            style={styles.card}
                            onPress={() => onProductPress(product)}
                            activeOpacity={0.9}
                        >
                            <View style={styles.imageContainer}>
                                <Image
                                    source={{ uri: getFirstSafeProductImage(product) }}
                                    style={styles.productImage}
                                    resizeMode="cover"
                                />

                                {/* Shimmer Overlay on Image */}
                                <Animated.View
                                    style={[
                                        styles.shimmerOverlay,
                                        { transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }] }
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={{ flex: 1 }}
                                    />
                                </Animated.View>

                                {/* Rank/Special Badge */}
                                <View style={[styles.rankBadge, { backgroundColor: index < 3 ? '#FFD700' : '#F53F7A' }]}>
                                    <Text style={[styles.rankText, { color: index < 3 ? '#000' : '#fff' }]}>
                                        {index < 3 ? 'TOP PICK' : 'HOT'}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.cardInfo}>
                                <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
                                <Text style={styles.brandName} numberOfLines={1}>{product.vendor_name || 'Premium Selection'}</Text>

                                <View style={styles.priceContainer}>
                                    <Text style={styles.price}>₹{product.variants?.[0]?.price || 'N/A'}</Text>
                                    {product.variants?.[0]?.mrp_price && (
                                        <Text style={styles.mrp}>₹{product.variants[0].mrp_price}</Text>
                                    )}
                                    <Text style={styles.offText}>
                                        {product.variants?.[0]?.mrp_price && product.variants?.[0]?.price
                                            ? `${Math.round(((product.variants[0].mrp_price - product.variants[0].price) / product.variants[0].mrp_price) * 100)}% OFF`
                                            : ''}
                                    </Text>
                                </View>
                            </View>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
        marginHorizontal: 16,
        borderRadius: 24,
        overflow: 'hidden',
        backgroundColor: '#fff',
        elevation: 4,
        shadowColor: '#F53F7A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
    },
    gradientBackground: {
        paddingVertical: 20,
        position: 'relative',
    },
    decoStar: {
        position: 'absolute',
        zIndex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center', // Changed from flex-start to center
        paddingHorizontal: 20,
        marginBottom: 20,
        zIndex: 2,
    },
    headerLeft: {
        flex: 1,
    },
    badgeContainer: {
        alignSelf: 'flex-start',
        marginBottom: 8,
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 3,
    },
    badgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 215, 0, 0.3)', // Subtle gold border
    },
    badgeText: {
        color: '#FFD700', // Gold text
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5, // Widespacing for premium feel
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1A1A1A',
        marginBottom: 4,
        fontStyle: 'italic', // Adds a bit of dynamic flair
    },
    subtitle: {
        fontSize: 13,
        color: '#666',
        fontWeight: '500',
    },
    seeAllButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingLeft: 12,
        paddingRight: 4,
        paddingVertical: 4,
        borderRadius: 20,
        // marginTop: 8, // Removed to fix alignment
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    seeAllText: {
        color: '#F53F7A',
        fontWeight: '700',
        fontSize: 12,
        marginRight: 6,
    },
    arrowCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F53F7A',
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 10,
    },
    card: {
        width: 145,
        marginRight: 15,
        backgroundColor: '#fff',
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    imageContainer: {
        position: 'relative',
        width: '100%',
        height: 150,
        backgroundColor: '#f9f9f9',
        overflow: 'hidden',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    shimmerOverlay: {
        ...StyleSheet.absoluteFillObject,
        width: '100%',
    },
    rankBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        elevation: 2,
    },
    rankText: {
        fontSize: 9,
        fontWeight: '800',
    },
    cardInfo: {
        padding: 10,
    },
    productName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1a1008',
        marginBottom: 4,
    },
    brandName: {
        fontSize: 10,
        color: '#888',
        marginBottom: 6,
        fontWeight: '500',
    },
    priceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    price: {
        fontSize: 14,
        fontWeight: '800',
        color: '#F53F7A',
        marginRight: 6,
    },
    mrp: {
        fontSize: 10,
        color: '#bbb',
        textDecorationLine: 'line-through',
        marginRight: 6,
    },
    offText: {
        fontSize: 10,
        color: '#28a745', // Green for discount
        fontWeight: '700',
    },
});

export default NewYearSpecials;
