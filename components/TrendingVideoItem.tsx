import React, { memo, useRef, useEffect, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    Image,
    Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
    getCloudinaryVideoThumbnail,
    isCloudinaryUrl,
} from '../utils/cloudinaryVideoOptimization';
import { getPlayableVideoUrl, isVideoUrl, isHlsUrl, getFallbackVideoUrl } from '../utils/videoUrlHelpers';


const { width, height } = Dimensions.get('window');

const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

// Interface for props (simplified based on usage)
interface Props {
    product: any;
    index: number;
    currentIndex: number;
    isActive: boolean;
    videoState: { isPlaying: boolean; isMuted: boolean };
    isLiked: boolean;
    isInWishlist: boolean;
    isFollowingVendor: boolean;
    vendor: any;
    influencer: any;
    productPrice: number;
    insets: { top: number; bottom: number };
    onLike: (id: string) => void;
    onFollowVendor: (id: string) => void;
    onVideoTap: (id: string) => void;
    onToggleMute: (id: string) => void;
    onWishlistPress: (product: any) => void;
    onShare: (id: string) => void;
    onShowMore: (id: string) => void;
    onOpenComments: (id: string) => void;
    onTryOn: (product: any) => void;
    onCollabPress: (product: any) => void;
    onShowFilters: () => void;
    onShopNow: (product: any) => void;
    setVideoRef: (id: string, ref: Video | null) => void;
    videoFallbackOverrides: Record<string, string>;
    setVideoFallbackOverrides: (overrides: Record<string, string>) => void;
    videoReady: boolean;
    setVideoReady: (id: string, isReady: boolean) => void;
    selectedSizes?: string[];
}

const TrendingVideoItem = ({
    product,
    index,
    currentIndex,
    isActive,
    videoState,
    isLiked,
    isInWishlist,
    isFollowingVendor,
    vendor,
    influencer,
    productPrice,
    insets,
    onLike,
    onFollowVendor,
    onVideoTap,
    onToggleMute,
    onWishlistPress,
    onShare,
    onShowMore,
    onOpenComments,
    onTryOn,
    onCollabPress,
    onShowFilters,
    onShopNow,
    setVideoRef,
    videoFallbackOverrides,
    setVideoFallbackOverrides,
    videoReady,
    setVideoReady,
    selectedSizes,
}: Props) => {
    const navigation = useNavigation<any>();
    const videoOpacity = useRef(new Animated.Value(0)).current;

    // Floating thumbs up state
    interface AnimationItem {
        id: number;
        val: Animated.Value;
    }
    const [floatingThumbsUps, setFloatingThumbsUps] = useState<AnimationItem[]>([]);
    const [doubleTapHeartVisible, setDoubleTapHeartVisible] = useState(false);

    // Function to trigger floating thumbs up animation
    const triggerThumbsUp = () => {
        const id = Date.now();
        const val = new Animated.Value(0);

        const newAnim: AnimationItem = { id, val };
        setFloatingThumbsUps(prev => [...prev, newAnim]);

        Animated.timing(val, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setFloatingThumbsUps(prev => prev.filter(item => item.id !== id));
            }
        });
    };

    const handleLikePress = () => {
        if (!isLiked) {
            triggerThumbsUp();
        }
        onLike(product.id);
    };

    // Derived state
    const vendorName = product.vendor_name || product.alias_vendor || vendor?.business_name || 'Vendor';

    // Video Media Logic
    const allVideoUrls: string[] = [];
    product.variants?.forEach((variant: any) => {
        // If specific sizes selected, only include videos from those sizes
        if (selectedSizes && selectedSizes.length > 0) {
            if (!selectedSizes.includes(variant.size?.name)) {
                return;
            }
        }

        if (variant.video_urls && Array.isArray(variant.video_urls)) {
            variant.video_urls.forEach((url: string) => {
                if (isVideoUrl(url)) {
                    const playableUrl = getPlayableVideoUrl(url);
                    if (playableUrl) allVideoUrls.push(playableUrl);
                }
            });
        }
    });

    // Only include generic product videos if NO size is selected
    // OR if we want to allow fallback (decision: strict filtering for now per user request "only show ... selected sizes")
    if ((!selectedSizes || selectedSizes.length === 0) && product.video_urls && Array.isArray(product.video_urls)) {
        product.video_urls.forEach((url: string) => {
            if (isVideoUrl(url)) {
                const playableUrl = getPlayableVideoUrl(url);
                if (playableUrl) allVideoUrls.push(playableUrl);
            }
        });
    }

    const hasVideo = allVideoUrls.length > 0;
    // Get first variant image or product image
    const firstVariantImage = product.variants?.[0]?.image_urls?.[0];
    const hasImage = !!(firstVariantImage || product.image_urls?.[0]);

    const mediaItems = hasVideo && allVideoUrls.length > 0 ? [{
        url: allVideoUrls[0],
        thumbnail: isCloudinaryUrl(allVideoUrls[0])
            ? getCloudinaryVideoThumbnail(allVideoUrls[0], { width: 400, height: 600, time: 0 })
            : (firstVariantImage || product.image_urls?.[0])
    }] :
        hasImage ? [{ url: null, thumbnail: firstVariantImage || product.image_urls?.[0] }] :
            [{ url: null, thumbnail: 'https://via.placeholder.com/400x600/cccccc/999999?text=No+Image' }];

    const mainMedia = mediaItems[0];
    const finalVideoUrl = mainMedia.url || null;
    const resolvedVideoUrl = finalVideoUrl ? videoFallbackOverrides?.[finalVideoUrl] || finalVideoUrl : null;

    // Preload logic (simplistic: render if active or next)
    const shouldRenderVideo = index === currentIndex || index === currentIndex + 1;

    // Animations
    useEffect(() => {
        if (videoReady) {
            Animated.timing(videoOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [videoReady]);

    const handleVendorProfile = () => {
        if (influencer) {
            navigation.navigate('InfluencerProfile', { influencerId: influencer.id, influencer });
        } else {
            navigation.navigate('VendorProfile', {
                vendorId: vendor?.id,
                vendor
            });
        }
    };

    const handleDoubleTap = () => {
        onLike(product.id);
        setDoubleTapHeartVisible(true);
        setTimeout(() => setDoubleTapHeartVisible(false), 1000);
    };

    return (
        <View style={styles.videoContainer}>
            {hasVideo ? (
                <TouchableOpacity
                    activeOpacity={1}
                    style={[styles.videoBackground, { backgroundColor: '#000' }]}
                    onPress={() => onVideoTap(product.id)}
                >
                    {resolvedVideoUrl && shouldRenderVideo && (
                        <Animated.View
                            style={[
                                styles.videoBackground,
                                {
                                    opacity: videoOpacity,
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0
                                }
                            ]}
                        >
                            <Video
                                ref={ref => setVideoRef(product.id, ref)}
                                source={{
                                    uri: resolvedVideoUrl,
                                    overrideFileExtensionAndroid: isHlsUrl(resolvedVideoUrl || '') ? 'm3u8' : 'mp4',
                                }}
                                style={styles.videoBackground}
                                resizeMode={ResizeMode.COVER}
                                shouldPlay={isActive && videoState.isPlaying}
                                isLooping
                                isMuted={false} // Default unmuted
                                useNativeControls={false} // Enable native controls
                                progressUpdateIntervalMillis={1000}
                                onLoad={() => {
                                    setVideoReady(product.id, true);
                                    if (isActive) {
                                        // Attempt auto-play logic handled in parent or here if ref accessible
                                    }
                                }}
                                onError={(e) => {
                                    console.error(`Video error ${product.id}`, e);
                                    if (finalVideoUrl) {
                                        const fallback = getFallbackVideoUrl(finalVideoUrl);
                                        if (fallback && fallback !== finalVideoUrl) {
                                            setVideoFallbackOverrides({ ...videoFallbackOverrides, [finalVideoUrl]: fallback });
                                        }
                                    }
                                }}
                            />
                        </Animated.View>
                    )}
                    <View style={styles.gradientOverlay} />
                </TouchableOpacity>
            ) : (
                <TouchableOpacity
                    activeOpacity={1}
                    style={styles.videoBackground}
                    onPress={() => onVideoTap(product.id)}
                >
                    <Image
                        source={{ uri: mainMedia.thumbnail }}
                        style={styles.videoBackground}
                        resizeMode="cover"
                    />
                    <View style={styles.gradientOverlay} />
                </TouchableOpacity>
            )}

            {/* Double Tap Heart */}
            {doubleTapHeartVisible && (
                <Animated.View style={styles.doubleTapHeartContainer}>
                    <Ionicons name="heart" size={100} color="#fff" style={styles.doubleTapHeart} />
                </Animated.View>
            )}

            {/* Top Bar */}
            <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
                <TouchableOpacity style={styles.topBarButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>

                <View style={[styles.topBarRight, { gap: 8 }]}>
                    {hasVideo && (
                        <TouchableOpacity style={styles.topBarButton} onPress={() => onToggleMute(product.id)}>
                            <Ionicons
                                name={videoState.isMuted ? 'volume-mute' : 'volume-high'}
                                size={24}
                                color="#fff"
                            />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.topBarButton} onPress={() => onWishlistPress(product)}>
                        <Ionicons
                            name={isInWishlist ? 'heart' : 'heart-outline'}
                            size={24}
                            color={isInWishlist ? '#F53F7A' : '#fff'}
                        />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.topBarButton} onPress={onShowFilters}>
                        <Ionicons name="options-outline" size={24} color="#fff" />
                    </TouchableOpacity>

                    {/* Usually filter is global, but passing handler for now if needed or remove if top bar is absolute overlay */}
                    {/* Moving Filter/Search to parent usually better if it's a global overlay, but keeping per-item structure for now to match original */}
                </View>
            </View>

            {/* Right Actions */}
            <View style={styles.rightActions}>
                <TouchableOpacity style={styles.modernActionButton} onPress={handleLikePress}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons
                            name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                            size={28}
                            color={isLiked ? '#F53F7A' : '#fff'}
                        />
                        {floatingThumbsUps.map(anim => {
                            const translateY = anim.val.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, -100],
                            });
                            const opacity = anim.val.interpolate({
                                inputRange: [0, 0.5, 1],
                                outputRange: [1, 1, 0],
                            });
                            const scale = anim.val.interpolate({
                                inputRange: [0, 0.2, 1],
                                outputRange: [0.5, 1.2, 1],
                            });

                            return (
                                <Animated.View
                                    key={anim.id}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        opacity: opacity,
                                        transform: [
                                            { translateY: translateY },
                                            { scale: scale },
                                            { rotate: '-15deg' }
                                        ],
                                    }}
                                    pointerEvents="none"
                                >
                                    <Ionicons name="thumbs-up" size={28} color="#F53F7A" />
                                </Animated.View>
                            );
                        })}
                    </View>
                    <Text style={styles.modernActionText}>Like</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modernActionButton} onPress={() => onOpenComments(product.id)}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons name="help-circle-outline" size={28} color="#fff" />
                    </View>
                    <Text style={styles.modernActionText}>Q&A</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modernActionButton} onPress={() => onShare(product.id)}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons name="paper-plane-outline" size={24} color="#fff" />
                    </View>
                    <Text style={styles.modernActionText}>Share</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.modernActionButton} onPress={() => onShowMore(product.id)}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
                    </View>
                    <Text style={styles.modernActionText}>More</Text>
                </TouchableOpacity>
            </View>

            {/* Bottom Content */}
            <View style={[styles.modernBottomContent, { paddingBottom: Math.max(insets.bottom, 34) + 20 }]}>
                {/* Vendor/Influencer Row - Clean Design */}
                <TouchableOpacity
                    style={styles.vendorInfoRow}
                    activeOpacity={0.85}
                    onPress={() => onCollabPress(product)}
                >
                    {/* Avatar(s) */}
                    <View style={styles.avatarStack}>
                        <Image
                            source={{ uri: vendor?.profile_image_url || vendor?.profile_photo || DEFAULT_AVATAR }}
                            style={styles.vendorAvatar}
                        />
                        {influencer && (
                            <Image
                                source={{ uri: influencer.profile_photo || influencer.profile_image_url || DEFAULT_AVATAR }}
                                style={styles.influencerAvatar}
                            />
                        )}
                    </View>

                    {/* Name & Subtitle */}
                    <View style={styles.vendorTextBlock}>
                        <View style={styles.vendorNameRow}>
                            <Text style={styles.vendorNameText} numberOfLines={1}>{vendorName}</Text>
                            {influencer && (
                                <>
                                    <Text style={styles.vendorCollab}> × </Text>
                                    <Text style={styles.influencerNameText} numberOfLines={1}>{influencer.name.split(' ')[0]}</Text>
                                </>
                            )}
                        </View>
                        <Text style={styles.vendorSubtitle} numberOfLines={1}>
                            {influencer ? 'Brand Collaboration' : (vendor?.location || 'Official Vendor')}
                        </Text>
                    </View>

                    {/* Follow/View indicator */}
                    <View style={styles.viewProfileBtn}>
                        <Ionicons name="person-add" size={14} color="#fff" />
                    </View>
                </TouchableOpacity>

                {/* Price Row */}
                <View style={styles.modernPriceRow}>
                    <View style={styles.modernPriceGroup}>
                        <Text style={styles.modernPrice}>₹{(productPrice || 0).toFixed(2)}</Text>
                        {(() => {
                            const maxDiscount = Math.max(...(product.variants?.map((v: any) => v.discount_percentage || 0) || [0]));
                            if (maxDiscount > 0) {
                                const originalPrice = productPrice / (1 - maxDiscount / 100);
                                return (
                                    <View style={styles.modernDiscountRow}>
                                        <Text style={styles.modernOriginalPrice}>₹{originalPrice.toFixed(2)}</Text>
                                        <View style={styles.modernDiscountBadge}>
                                            <Text style={styles.modernDiscountText}>{Math.round(maxDiscount)}% OFF</Text>
                                        </View>
                                    </View>
                                );
                            }
                            return null;
                        })()}
                    </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.modernActionButtons}>
                    <TouchableOpacity style={styles.modernTryOnButton} onPress={() => onTryOn(product)}>
                        <Ionicons name="shirt-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
                        <Text style={styles.modernTryOnText}>Try On</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.modernBuyButton}
                        onPress={() => onShopNow(product)}
                    >
                        <Text style={styles.modernBuyText}>Shop Now</Text>
                        <Ionicons name="arrow-forward" size={20} color="#fff" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};

// Styles (Copied from Trending.tsx to ensure self-containment)
const styles = StyleSheet.create({
    videoContainer: {
        width: width,
        height: height, // Full height instead of calculation
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    videoBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: '50%', // increased height for better visibility
        backgroundColor: 'transparent', // Use linear gradient if available, else transparent
        // Need expo-linear-gradient for real gradient, assuming simple opacity for now or external style
        // For now simple transparent, assuming parent handled it.
        // If strict match needed, need LinearGradient, but avoiding extra import if not used by user
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        zIndex: 20,
    },
    topBarButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    topBarRight: {
        flexDirection: 'row',
    },
    rightActions: {
        position: 'absolute',
        right: 8,
        bottom: 180, // Moved up to clear bottom content
        alignItems: 'center',
        zIndex: 10,
    },
    modernActionButton: {
        alignItems: 'center',
        marginBottom: 20,
    },
    actionIconCircle: {
        // width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 4
    },
    modernActionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    modernBottomContent: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        zIndex: 10,
    },
    // New clean vendor/influencer layout
    vendorInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        paddingVertical: 4,
    },
    avatarStack: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10,
    },
    vendorAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: '#fff',
        backgroundColor: '#333',
    },
    influencerAvatar: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        borderColor: '#F53F7A',
        backgroundColor: '#333',
        marginLeft: -12,
        zIndex: -1,
    },
    vendorTextBlock: {
        flex: 0,
        flexShrink: 1,
        justifyContent: 'center',
        maxWidth: '60%',
    },
    vendorNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    vendorNameText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    vendorCollab: {
        color: '#F53F7A',
        fontSize: 12,
        fontWeight: '700',
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    influencerNameText: {
        color: '#F53F7A',
        fontSize: 13,
        fontWeight: '700',
        textShadowColor: '#000',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    vendorSubtitle: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 11,
        fontWeight: '500',
        marginTop: 1,
        textShadowColor: '#000',
        textShadowOffset: { width: 0.5, height: 0.5 },
        textShadowRadius: 2,
    },
    viewProfileBtn: {
        backgroundColor: '#F53F7A',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 12,
    },
    // Keep legacy styles for compatibility
    modernVendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    collabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 28,
        paddingVertical: 6,
        paddingLeft: 6,
        paddingRight: 18,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        maxWidth: '92%',
    },
    avatarContainer: {
        flexDirection: 'row',
        width: 48,
        height: 40,
    },
    avatarBase: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderColor: '#fff', // White border for clean separation
        position: 'absolute',
    },
    vendorAvatarZ: {
        zIndex: 2,
        left: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 4,
    },
    influencerAvatarZ: {
        zIndex: 1,
        left: 24,
        borderColor: '#F53F7A', // Pink border for influencer
    },
    collabTextContainer: {
        marginLeft: 16,
        justifyContent: 'center',
        flex: 1,
    },
    collabVendorName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 1,
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    collabInfluencerName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    collabSubtext: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 11,
        fontWeight: '500',
    },
    pillFollowButton: {
        backgroundColor: '#F53F7A', // Pink follow button
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 16,
        marginLeft: 12,
    },
    pillFollowText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
    },
    modernPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    modernPriceGroup: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    modernPrice: {
        color: '#fff',
        fontSize: 22, // Slightly larger
        fontWeight: '800',
        marginRight: 8,
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    modernDiscountRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modernOriginalPrice: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        textDecorationLine: 'line-through',
        marginRight: 6,
    },
    modernDiscountBadge: {
        backgroundColor: '#F53F7A',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    modernDiscountText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    modernActionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modernTryOnButton: {
        flex: 1,
        height: 48,
        backgroundColor: 'rgba(245, 63, 122, 0.2)', // Pink tinted glass
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(245, 63, 122, 0.6)', // Pink border
        shadowColor: '#F53F7A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 4,
    },
    modernTryOnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    modernBuyButton: {
        flex: 1.5,
        height: 48,
        backgroundColor: '#F53F7A', // App's signature pink
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F53F7A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 8,
    },
    modernBuyText: {
        color: '#fff', // White text on pink background
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    doubleTapHeartContainer: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 50,
        pointerEvents: 'none',
    },
    doubleTapHeart: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 10,
    }
});

export default memo(TrendingVideoItem, (prevProps, nextProps) => {
    return (
        prevProps.index === nextProps.index &&
        prevProps.currentIndex === nextProps.currentIndex &&
        prevProps.videoState.isPlaying === nextProps.videoState.isPlaying &&
        prevProps.videoState.isMuted === nextProps.videoState.isMuted &&
        prevProps.isLiked === nextProps.isLiked &&
        prevProps.isInWishlist === nextProps.isInWishlist &&
        prevProps.isFollowingVendor === nextProps.isFollowingVendor &&
        prevProps.product.id === nextProps.product.id &&
        prevProps.videoReady === nextProps.videoReady &&
        prevProps.vendor === nextProps.vendor &&
        prevProps.influencer === nextProps.influencer
    );
});
