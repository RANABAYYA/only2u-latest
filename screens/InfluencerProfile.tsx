import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useInfluencer, Influencer, InfluencerPost } from '~/contexts/InfluencerContext';
import { useAuth } from '~/contexts/useAuth';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import type { Category } from '~/types/product';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');


type InfluencerProfileRouteParams = {
  InfluencerProfile: {
    influencerId: string;
    influencer?: Influencer;
  };
};

type InfluencerProfileRouteProp = RouteProp<InfluencerProfileRouteParams, 'InfluencerProfile'>;

const InfluencerProfile: React.FC = () => {
  const route = useRoute<InfluencerProfileRouteProp>();
  const navigation = useNavigation();
  const { influencerId, influencer: initialInfluencer } = route.params;
  const { user } = useAuth();
  const { showLoginSheet } = useLoginSheet();

  const {
    fetchInfluencerById,
    fetchProductsByInfluencerId,
    followInfluencer,
    unfollowInfluencer,
    isFollowingInfluencer,
    fetchInfluencerPosts,
    influencerPosts,
  } = useInfluencer();

  const [influencer, setInfluencer] = useState<Influencer | null>(initialInfluencer || null);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'posts' | 'products'>('posts');
  const [influencerProducts, setInfluencerProducts] = useState<any[]>([]);
  const [posts, setPosts] = useState<InfluencerPost[]>([]);
  const [postsDisplayCount, setPostsDisplayCount] = useState(12);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [productRatings, setProductRatings] = useState<{ [id: string]: { rating: number; reviews: number } }>({});

  useEffect(() => {
    loadInfluencerData();
  }, [influencerId]);

  const loadInfluencerData = async () => {
    if (!influencerId) {
      console.log('InfluencerProfile: No influencerId provided');
      return;
    }

    console.log(`InfluencerProfile: Loading data for ${influencerId}`);
    setLoading(true);
    setContentLoading(true);
    try {
      // Check if this is a sample influencer
      if (influencerId.startsWith('sample_influencer_')) {
        console.log('InfluencerProfile: Loading sample influencer');
        // Use the passed influencer data for sample profiles
        if (initialInfluencer) {
          setInfluencer(initialInfluencer);
        }
        // Generate sample post
      } else {
        // Real influencer data
        console.log('InfluencerProfile: Fetching influencer details...');
        const influencerData = await fetchInfluencerById(influencerId);
        console.log('InfluencerProfile: Fetched influencer details:', influencerData ? 'Success' : 'Failed');
        if (influencerData) {
          setInfluencer(influencerData);
        }

        console.log('InfluencerProfile: Fetching posts...');
        const fetchedPosts = await fetchInfluencerPosts(influencerId);
        console.log(`InfluencerProfile: Fetched ${fetchedPosts?.length || 0} posts`);
        setPosts(fetchedPosts.filter(post => post.influencer_id === influencerId));

        // Fetch global categories sorted by display_order
        console.log('InfluencerProfile: Fetching categories...');
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true, nullsFirst: false });
        console.log(`InfluencerProfile: Fetched ${catData?.length || 0} categories`);

        if (catData) {
          setAllCategories(catData);
        }

        // Fetch products associated with this influencer
        console.log('InfluencerProfile: Fetching products...');
        const products = await fetchProductsByInfluencerId(influencerId);
        console.log(`InfluencerProfile: Fetched ${products?.length || 0} products`);
        setInfluencerProducts(products);

        // Fetch ratings for products
        if (products && products.length > 0) {
          const ids = products.map((p: any) => p.id);
          const { data: reviews, error: revErr } = await supabase
            .from('product_reviews')
            .select('product_id, rating')
            .in('product_id', ids);

          if (!revErr && reviews) {
            const ratings: { [id: string]: { rating: number; reviews: number } } = {};
            ids.forEach((id: string) => {
              const pr = reviews.filter((r: any) => r.product_id === id);
              const total = pr.reduce((s: number, r: any) => s + (r.rating || 0), 0);
              const avg = pr.length > 0 ? total / pr.length : 0;
              ratings[id] = { rating: avg, reviews: pr.length };
            });
            setProductRatings(ratings);
          }
        }
      }
    } catch (error) {
      console.error('Error loading influencer data:', error);
      Alert.alert('Error', 'Failed to load influencer profile');
    } finally {
      console.log('InfluencerProfile: Loading complete');
      setLoading(false);
      setContentLoading(false);
    }
  };

  // Helper function to share to WhatsApp
  const shareToWhatsApp = async (message: string) => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Toast.show({
          type: 'error',
          text1: 'WhatsApp not available',
          text2: 'Install WhatsApp to share',
        });
      }
    } catch (error) {
      console.error('Error sharing to WhatsApp:', error);
    }
  };

  // Helper function to get smallest price from variants
  const getSmallestPrice = (product: any) => {
    if (!product?.product_variants?.length) return product?.price || 0;
    const sorted = [...product.product_variants].sort((a: any, b: any) => (a.price || 0) - (b.price || 0));
    return sorted[0]?.price || 0;
  };

  // Helper function to get first image from product
  const getFirstImage = (product: any): string => {
    if (product?.image_urls && Array.isArray(product.image_urls) && product.image_urls.length > 0) {
      return product.image_urls[0];
    }
    if (product?.image_url) {
      return product.image_url;
    }
    // Check variants if main product has no images
    if (product?.product_variants && Array.isArray(product.product_variants) && product.product_variants.length > 0) {
      const firstVariant = product.product_variants[0];
      if (firstVariant?.image_urls && Array.isArray(firstVariant.image_urls) && firstVariant.image_urls.length > 0) {
        return firstVariant.image_urls[0];
      }
    }
    return 'https://via.placeholder.com/400x400/f0f0f0/999999?text=No+Image';
  };

  // Render product card for horizontal list
  const renderProductCard = (product: any) => {
    const firstImage = getFirstImage(product);
    // Use getSmallestPrice to handle variants correctly like VendorProfile
    const price = getSmallestPrice(product);

    // Calculate max discount from variants if available
    const discountPct = (product?.product_variants && product.product_variants.length > 0)
      ? Math.max(...(product.product_variants.map((v: any) => v.discount_percentage || 0)))
      : (product?.discount_percentage || 0);

    const hasDiscount = discountPct > 0;
    const originalPrice = hasDiscount ? price / (1 - discountPct / 100) : undefined;

    const rating = productRatings[product.id]?.rating || 0;
    const reviews = productRatings[product.id]?.reviews || 0;
    const brandLabel = product.vendor_name || 'Only2U'; // Or get vendor name if available

    return (
      <TouchableOpacity
        style={styles.productCard}
        onPress={() => navigation.navigate('ProductDetails' as never, { product } as never)}
        activeOpacity={0.85}
      >
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{Math.round(discountPct)}% OFF</Text>
          </View>
        )}
        <Image
          source={{ uri: firstImage }}
          style={styles.productImage}
          resizeMode="cover"
        />
        <View style={styles.productCardInfo}>
          <Text style={styles.brandName} numberOfLines={1}>{brandLabel}</Text>
          <Text style={styles.productName} numberOfLines={2}>{product?.name || 'Product'}</Text>

          <View style={styles.priceContainer}>
            <View style={styles.priceInfo}>
              {hasDiscount && (
                <Text style={styles.originalPrice}>₹{(originalPrice || 0).toFixed(0)}</Text>
              )}
              <Text style={styles.price}>₹{price.toFixed(0)}</Text>
            </View>
            <View style={styles.discountAndRatingRow}>
              {hasDiscount && (
                <Text style={styles.discountPercentage}>{Math.round(discountPct)}% OFF</Text>
              )}
              <View style={styles.reviewsContainer}>
                <Ionicons name="star" size={12} color="#FFD600" style={{ marginRight: 2 }} />
                <Text style={styles.reviews}>{rating.toFixed(1)}</Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Horizontal Product List with Scroll Buttons Component
  const HorizontalProductList = ({ products, categoryName }: { products: any[], categoryName: string }) => {
    const flatListRef = useRef<FlatList>(null);
    const [scrollPosition, setScrollPosition] = useState(0);
    const [contentWidth, setContentWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const SCROLL_AMOUNT = 200;

    const canScrollLeft = scrollPosition > 10;
    const canScrollRight = contentWidth > containerWidth && scrollPosition < contentWidth - containerWidth - 10;

    const scrollLeft = () => {
      const newPosition = Math.max(0, scrollPosition - SCROLL_AMOUNT);
      flatListRef.current?.scrollToOffset({ offset: newPosition, animated: true });
    };

    const scrollRight = () => {
      const maxScroll = contentWidth - containerWidth;
      const newPosition = Math.min(maxScroll, scrollPosition + SCROLL_AMOUNT);
      flatListRef.current?.scrollToOffset({ offset: newPosition, animated: true });
    };

    return (
      <View style={styles.horizontalListWrapper}>
        {/* Left Arrow Button */}
        {canScrollLeft && (
          <TouchableOpacity
            style={[styles.scrollArrowButton, styles.scrollArrowLeft]}
            onPress={scrollLeft}
            activeOpacity={0.8}
          >
            <View style={styles.scrollArrowBackground}>
              <Ionicons name="chevron-back" size={20} color="#333" />
            </View>
          </TouchableOpacity>
        )}

        <FlatList
          ref={flatListRef}
          horizontal
          data={products}
          renderItem={({ item }) => renderProductCard(item)}
          keyExtractor={(item) => `${categoryName}-${item.id}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.productsHorizontalList}
          ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
          nestedScrollEnabled={true}
          scrollEnabled={true}
          onScroll={(e) => setScrollPosition(e.nativeEvent.contentOffset.x)}
          onContentSizeChange={(w) => setContentWidth(w)}
          onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
          scrollEventThrottle={16}
        />

        {/* Right Arrow Button */}
        {canScrollRight && (
          <TouchableOpacity
            style={[styles.scrollArrowButton, styles.scrollArrowRight]}
            onPress={scrollRight}
            activeOpacity={0.8}
          >
            <View style={styles.scrollArrowBackground}>
              <Ionicons name="chevron-forward" size={20} color="#333" />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const handleFollow = async () => {
    if (!influencer) return;

    // Handle sample influencers
    if (influencer.id.startsWith('sample_influencer_')) {
      Toast.show({
        type: 'success',
        text1: 'Demo Profile',
        text2: 'You are following this sample influencer',
      });
      return;
    }

    let currentUser = user;

    // Fallback: Check Supabase session directly if context user is missing
    if (!currentUser) {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      if (sessionUser) {
        currentUser = sessionUser;
      }
    }

    if (!currentUser) {
      Toast.show({
        type: 'info',
        text1: 'Login Required',
        text2: 'Please login to follow influencers',
      });
      showLoginSheet();
      return;
    }

    try {
      const isFollowing = isFollowingInfluencer(influencer.id);
      const success = isFollowing
        ? await unfollowInfluencer(influencer.id)
        : await followInfluencer(influencer.id);

      if (success) {
        // Update local influencer data
        setInfluencer(prev => prev ? {
          ...prev,
          total_followers: isFollowing ? prev.total_followers - 1 : prev.total_followers + 1
        } : null);
      } else {
        Alert.alert('Error', 'Failed to update follow status');
      }
    } catch (error) {
      console.error('Error updating follow status:', error);
      Alert.alert('Error', 'Failed to update follow status');
    }
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading influencer profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!influencer) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Influencer not found</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFollowing = influencer.id.startsWith('sample_influencer_')
    ? true
    : isFollowingInfluencer(influencer.id);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header - Matching VendorProfile */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{influencer.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Instagram-Style Profile Header */}
        <View style={styles.profileHeader}>
          {/* Profile Info Row */}
          <View style={styles.profileInfoRow}>
            {/* Profile Picture */}
            <Image
              source={{ uri: influencer.profile_photo || 'https://via.placeholder.com/100' }}
              style={styles.profileImage}
            />

            {/* Stats */}
            <View style={styles.statsRow}>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{influencerProducts.length}</Text>
                <Text style={styles.statLabel}>products</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {influencer.total_followers >= 1000
                    ? `${(influencer.total_followers / 1000).toFixed(1)}K`
                    : influencer.total_followers}
                </Text>
                <Text style={styles.statLabel}>followers</Text>
              </TouchableOpacity>

            </View>
          </View>

          {/* Name & Verification */}
          <View style={styles.nameRow}>
            <Text style={styles.influencerName}>{influencer.name}</Text>
            {influencer.is_verified && (
              <Ionicons name="checkmark-circle" size={16} color="#1DA1F2" style={{ marginLeft: 4 }} />
            )}
          </View>

          {/* Bio */}
          {influencer.bio && (
            <Text style={styles.bio}>{influencer.bio}</Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtonsRow}>
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                isFollowing && styles.followingButton
              ]}
              onPress={handleFollow}
            >
              <Text style={[
                styles.primaryActionButtonText,
                isFollowing && styles.followingButtonText
              ]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconActionButton}
              onPress={async () => {
                const influencerName = influencer?.name || 'this influencer';
                const influencerUrl = influencer?.id ? `https://only2u.app/influencer/${influencer.id}` : 'https://only2u.app';
                const message = `Check out ${influencerName} on Only2U 👇\n${influencerUrl}`;
                await shareToWhatsApp(message);
              }}
            >
              <Ionicons name="share-social-outline" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Instagram-like Tab Bar */}
        <View style={styles.tabBarContainer}>
          <View style={styles.tabBarInner}>
            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'posts' && styles.activeTabItem]}
              onPress={() => setActiveTab('posts')}
            >
              <Ionicons
                name="grid"
                size={20}
                color={activeTab === 'posts' ? '#000' : '#999'}
              />
              <Text style={[styles.tabText, activeTab === 'posts' && styles.activeTabText]}>
                POSTS
              </Text>
              {activeTab === 'posts' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabItem, activeTab === 'products' && styles.activeTabItem]}
              onPress={() => setActiveTab('products')}
            >
              <Ionicons
                name="storefront"
                size={20}
                color={activeTab === 'products' ? '#000' : '#999'}
              />
              <Text style={[styles.tabText, activeTab === 'products' && styles.activeTabText]}>
                PRODUCTS
              </Text>
              {activeTab === 'products' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>
        </View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {/* Posts Tab -          {/* Posts Tab - Show all product images in grid */}
          {activeTab === 'posts' && (
            <View style={styles.postsGrid}>
              {contentLoading ? (
                <View style={styles.contentLoadingContainer}>
                  <ActivityIndicator size="large" color="#F53F7A" />
                  <Text style={styles.contentLoadingText}>Loading posts...</Text>
                </View>
              ) : posts.length === 0 ? (
                <View style={styles.emptyTabState}>
                  <Ionicons name="images-outline" size={64} color="#ddd" />
                  <Text style={styles.emptyTabTitle}>No Posts Yet</Text>
                  <Text style={styles.emptyTabSubtitle}>Posts from {influencer?.name} will appear here</Text>
                </View>
              ) : (
                <>
                  <View style={styles.gridContainer}>
                    {posts.slice(0, postsDisplayCount).map((post) => {
                      const thumbnailUrl = post.thumbnail_url || post.video_url; // Fallback to video_url if no thumbnail (might fail if not image, but better than nothing)
                      return (
                        <TouchableOpacity
                          key={post.id}
                          style={styles.gridItem}
                          onPress={() => {
                            // Handle post press - for now just show alert or nothing as we don't have post detail screen
                            // If it has a product_id, we could try to find it in influencerProducts
                            if (post.product_id) {
                              const linkedProduct = influencerProducts.find(p => p.id === post.product_id);
                              if (linkedProduct) {
                                navigation.navigate('ProductDetails' as never, { product: linkedProduct } as never);
                              } else {
                                // Fetch and navigate? or just ignore
                              }
                            }
                          }}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: thumbnailUrl }}
                            style={styles.gridImage}
                            resizeMode="cover"
                            fadeDuration={300}
                          />
                          {/* Add video icon overlay if it's a video */}
                          <View style={{ ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', zIndex: 1 }}>
                            <Ionicons name="play-circle-outline" size={32} color="rgba(255,255,255,0.8)" />
                          </View>

                          <View style={styles.gridImageLoadingOverlay}>
                            <ActivityIndicator size="small" color="#F53F7A" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {posts.length > postsDisplayCount && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() => {
                        const newCount = postsDisplayCount + 12;
                        setPostsDisplayCount(newCount > posts.length ? posts.length : newCount);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.loadMoreText}>
                        Load More ({posts.length - postsDisplayCount} remaining)
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#F53F7A" />
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          )}

          {/* Products Tab */}
          {activeTab === 'products' && (
            <View style={styles.contentSection}>
              {contentLoading ? (
                <View style={styles.contentLoadingContainer}>
                  <ActivityIndicator size="large" color="#F53F7A" />
                  <Text style={styles.contentLoadingText}>Loading products...</Text>
                </View>
              ) : influencerProducts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="storefront-outline" size={64} color="#DDD" />
                  <Text style={styles.emptyStateTitle}>No Products Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Products promoted by {influencer?.name || 'this influencer'} will appear here</Text>
                </View>
              ) : (
                <>
                  {/* Group products by category */}
                  {(() => {
                    // Group products
                    const grouped = influencerProducts.reduce((acc, product) => {
                      const categoryName = product.category?.name || 'Other';
                      const categoryId = product.category_id || 'other';
                      if (!acc[categoryName]) {
                        acc[categoryName] = {
                          products: [],
                          id: categoryId
                        };
                      }
                      acc[categoryName].products.push(product);
                      return acc;
                    }, {} as { [key: string]: { products: any[], id: string } });

                    // Sort groups based on allCategories order
                    const sortedGroups = allCategories.length > 0 ?
                      // 1. Map allCategories to present groups
                      allCategories.map(cat => ({
                        name: cat.name,
                        data: grouped[cat.name]
                      }))
                        .filter(item => item.data && item.data.products.length > 0)
                        // 2. Append any categories not in allCategories (e.g. 'Other')
                        .concat(
                          Object.keys(grouped)
                            .filter(name => !allCategories.some(c => c.name === name))
                            .map(name => ({ name, data: grouped[name] }))
                        )
                      : // Fallback: just use object keys if categories not loaded yet
                      Object.entries(grouped).map(([name, data]) => ({ name, data }));

                    return sortedGroups.map(({ name: categoryName, data }) => {
                      const categoryProducts = data.products;
                      const category = {
                        id: data.id,
                        name: categoryName
                      };

                      return (
                        <View key={categoryName} style={styles.categorySection}>
                          {/* Category Header */}
                          <View style={styles.categoryHeader}>
                            <Text style={styles.categoryTitle}>{categoryName}</Text>
                            <TouchableOpacity
                              style={styles.seeMoreButton}
                              onPress={() => {
                                // Optional: Add logic to see all products in this category for this influencer
                                // For now just navigate to generic products screen or do nothing
                              }}
                            >
                              <Text style={styles.seeMoreText}>See More</Text>
                              <Ionicons name="chevron-forward" size={16} color="#F53F7A" />
                            </TouchableOpacity>
                          </View>

                          {/* Horizontal Product List */}
                          <HorizontalProductList products={categoryProducts} categoryName={categoryName} />
                        </View>
                      );
                    });
                  })()}
                </>
              )}
            </View>
          )}
        </View>
      </ScrollView>


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // New Styles for Product Cards and Categories
  categorySection: {
    marginBottom: 24,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  seeMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 63, 122, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 63, 122, 0.2)',
  },
  seeMoreText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F53F7A',
    marginRight: 4,
  },
  productsHorizontalList: {
    paddingHorizontal: 16,
  },
  horizontalListWrapper: {
    position: 'relative',
  },
  scrollArrowButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -20,
    zIndex: 10,
  },
  scrollArrowLeft: {
    left: 4,
  },
  scrollArrowRight: {
    right: 4,
  },
  scrollArrowBackground: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  productCard: {
    width: 138,
    marginHorizontal: 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  productCardInfo: {
    // No padding top needed
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingTop: 8,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    paddingHorizontal: 12,
    paddingTop: 2,
    lineHeight: 16,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  originalPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
  },
  discountPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F53F7A',
    backgroundColor: 'rgba(245, 63, 122, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  reviewsContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  reviews: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 1,
  },
  discountBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  productImage: {
    width: '100%',
    height: 160,
    resizeMode: 'cover',
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1a1a',
    paddingHorizontal: 12,
    paddingTop: 8,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 13,
    fontWeight: '400',
    color: '#666',
    paddingHorizontal: 12,
    paddingTop: 2,
    lineHeight: 16,
  },
  priceContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
  },
  priceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  originalPrice: {
    fontSize: 12,
    color: '#94a3b8',
    textDecorationLine: 'line-through',
  },
  discountPercentage: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#F53F7A',
    backgroundColor: 'rgba(245, 63, 122, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
  },
  discountAndRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 6,
  },
  reviewsContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    gap: 4,
  },
  reviews: {
    fontSize: 11,
    fontWeight: '700',
    color: '#333',
  },
  // Grid Styles from VendorProfile
  postsGrid: {
    flex: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
  },
  gridItem: {
    width: (width - 6) / 3,
    height: (width - 6) / 3,
    backgroundColor: '#f0f0f0',
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gridImageLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    zIndex: -1,
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(245, 63, 122, 0.1)',
    borderRadius: 12,
    marginHorizontal: 16,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
  },
  emptyTabState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTabTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyTabSubtitle: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#999',
    marginTop: 12,
  },
  contentLoadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentLoadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  content: {
    flex: 1,
  },
  profileHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  profileInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 24,
  },
  statsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  statLabel: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  influencerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  bio: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
    marginBottom: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionButton: {
    flex: 1,
    backgroundColor: '#F53F7A',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  followingButton: {
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOpacity: 0.1,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  followingButtonText: {
    color: '#000',
  },
  iconActionButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBarContainer: {
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  tabBarInner: {
    flexDirection: 'row',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    position: 'relative',
  },
  activeTabItem: {
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#000',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#000',
  },
  contentSection: {
    flex: 1,
  },

  tabContent: {
    flex: 1,
  },
  emptyState: {
    paddingVertical: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default InfluencerProfile;
