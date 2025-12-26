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
    setVideoRef: (id: string, ref: Video | null) => void;
    videoFallbackOverrides: Record<string, string>;
    setVideoFallbackOverrides: (overrides: Record<string, string>) => void;
    videoReady: boolean;
    setVideoReady: (id: string, isReady: boolean) => void;
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
    setVideoRef,
    videoFallbackOverrides,
    setVideoFallbackOverrides,
    videoReady,
    setVideoReady,
}: Props) => {
    const navigation = useNavigation<any>();
    const videoOpacity = useRef(new Animated.Value(0)).current;
    const [doubleTapHeartVisible, setDoubleTapHeartVisible] = useState(false);

    // Derived state
    const vendorName = product.vendor_name || product.alias_vendor || vendor?.business_name || 'Vendor';

    // Video Media Logic
    const allVideoUrls: string[] = [];
    product.variants?.forEach((variant: any) => {
        if (variant.video_urls && Array.isArray(variant.video_urls)) {
            variant.video_urls.forEach((url: string) => {
                if (isVideoUrl(url)) {
                    const playableUrl = getPlayableVideoUrl(url);
                    if (playableUrl) allVideoUrls.push(playableUrl);
                }
            });
        }
    });
    if (product.video_urls && Array.isArray(product.video_urls)) {
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
                                isMuted={videoState.isMuted}
                                useNativeControls={false} // Custom controls
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
                <TouchableOpacity style={styles.modernActionButton} onPress={() => onLike(product.id)}>
                    <View style={styles.actionIconCircle}>
                        <Ionicons
                            name={isLiked ? 'thumbs-up' : 'thumbs-up-outline'}
                            size={28}
                            color={isLiked ? '#F53F7A' : '#fff'}
                        />
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
            <View style={[styles.modernBottomContent, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
                {/* Unified Vendor & Influencer Pill */}
                <View style={styles.modernVendorRow}>
                    <TouchableOpacity
                        style={styles.collabPill}
                        activeOpacity={0.9}
                        onPress={() => onCollabPress(product)}
                    >
                        {/* Overlapping Avatars */}
                        <View style={[styles.avatarContainer, { width: influencer ? 50 : 36 }]}>
                            <Image
                                source={{ uri: vendor?.profile_image_url || vendor?.profile_photo || DEFAULT_AVATAR }}
                                style={[styles.avatarBase, styles.vendorAvatarZ]}
                            />
                            {influencer && (
                                <Image
                                    source={{ uri: influencer.profile_photo || influencer.profile_image_url || DEFAULT_AVATAR }}
                                    style={[styles.avatarBase, styles.influencerAvatarZ]}
                                />
                            )}
                        </View>

                        {/* Text Info */}
                        <View style={styles.collabTextContainer}>
                            {influencer ? (
                                <>
                                    <Text style={styles.collabVendorName} numberOfLines={1}>{vendorName}</Text>
                                    <Text style={[styles.collabSubtext, { fontSize: 9, opacity: 0.7 }]}>with</Text>
                                    <Text style={styles.collabInfluencerName} numberOfLines={1}>{influencer.name.split(' ')[0]}</Text>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.collabVendorName} numberOfLines={1}>{vendorName}</Text>
                                    <Text style={styles.collabSubtext} numberOfLines={1}>{vendor?.location || 'Official Vendor'}</Text>
                                </>
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

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
                        onPress={() => navigation.navigate('ProductDetails', { product })}
                    >
                        <Text style={styles.modernBuyText}>Shop Now</Text>
                        <Ionicons name="arrow-forward" size={20} color="#000" style={{ marginLeft: 4 }} />
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
    modernVendorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        // justifyContent: 'space-between', // Removed, using self-contained pill
    },
    collabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        borderRadius: 30,
        padding: 4,
        paddingRight: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        maxWidth: '90%',
    },
    avatarContainer: {
        flexDirection: 'row',
        width: 44,
        height: 36, // Match avatar height approx
    },
    avatarBase: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: '#000', // Dark border for better separation on dark bg
        position: 'absolute',
    },
    vendorAvatarZ: {
        zIndex: 2, // Vendor on top? Or Influencer? Let's put secondary on top usually. 
        // If overlap, first one (vendor) left 0. 
        left: 0,
    },
    influencerAvatarZ: {
        zIndex: 1,
        left: 20, // Overlap amount
    },
    collabTextContainer: {
        marginLeft: 18, // Adjust based on avatar width/overlap. 
        // 1 avatar: need ~40px space. 2 avatars: need ~60px. 
        // Since avatarContainer width is fixed/small, we need margin to clear it.
        // If container width is 44, and we have 2 avatars (width ~56 visual), we need margin.
        justifyContent: 'center',
        flex: 1,
    },
    collabVendorName: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 0,
    },
    collabInfluencerName: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    collabSubtext: {
        color: '#ccc',
        fontSize: 10,
    },
    pillFollowButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        marginLeft: 12,
    },
    pillFollowText: {
        color: '#000',
        fontSize: 11,
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
        height: 44, // Taller button
        backgroundColor: 'rgba(255,255,255,0.2)', // Glass effect
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.4)',
    },
    modernTryOnText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    modernBuyButton: {
        flex: 1.5, // Wider buy button
        height: 44,
        backgroundColor: '#fff',
        borderRadius: 22,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    modernBuyText: {
        color: '#000',
        fontSize: 15, // Larger text
        fontWeight: '700',
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
