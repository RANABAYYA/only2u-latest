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
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useInfluencer, Influencer, InfluencerPost } from '~/contexts/InfluencerContext';
import { useAuth } from '~/contexts/useAuth';
import { useLoginSheet } from '~/contexts/LoginSheetContext';
import type { Category } from '~/types/product';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');
const POST_SIZE = (width - 6) / 3;

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
    fetchInfluencerPosts,
    influencerPosts,
    fetchProductsByInfluencerId,
    followInfluencer,
    unfollowInfluencer,
    isFollowingInfluencer,
    likePost,
    unlikePost,
  } = useInfluencer();

  const [influencer, setInfluencer] = useState<Influencer | null>(initialInfluencer || null);
  const [posts, setPosts] = useState<InfluencerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<InfluencerPost | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'products'>('posts');
  const [influencerProducts, setInfluencerProducts] = useState<any[]>([]);
  const [postsDisplayCount, setPostsDisplayCount] = useState(12);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    loadInfluencerData();
  }, [influencerId]);

  const loadInfluencerData = async () => {
    if (!influencerId) return;

    setLoading(true);
    setContentLoading(true);
    try {
      // Check if this is a sample influencer
      if (influencerId.startsWith('sample_influencer_')) {
        // Use the passed influencer data for sample profiles
        if (initialInfluencer) {
          setInfluencer(initialInfluencer);
        }

        // Generate sample posts
        const samplePosts: InfluencerPost[] = Array.from({ length: 9 }, (_, i) => ({
          id: `sample_post_${influencerId}_${i}`,
          influencer_id: influencerId,
          title: `Style Inspiration ${i + 1}`,
          description: 'Check out this amazing look! 💫✨',
          video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          thumbnail_url: `https://via.placeholder.com/400x600/FF6EA6/FFFFFF?text=Video+${i + 1}`,
          product_id: undefined,
          views: Math.floor(Math.random() * 50000) + 10000,
          likes: Math.floor(Math.random() * 5000) + 500,
          shares: Math.floor(Math.random() * 500) + 50,
          is_published: true,
          is_featured: i < 3,
          published_at: new Date(Date.now() - i * 86400000).toISOString(),
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
          updated_at: new Date(Date.now() - i * 86400000).toISOString(),
          is_liked: false,
        }));

        setPosts(samplePosts);
      } else {
        // Real influencer data
        const influencerData = await fetchInfluencerById(influencerId);
        if (influencerData) {
          setInfluencer(influencerData);
        }

        await fetchInfluencerPosts(influencerId);
        setPosts(influencerPosts.filter(post => post.influencer_id === influencerId));

        // Fetch global categories sorted by display_order
        const { data: catData } = await supabase
          .from('categories')
          .select('*')
          .eq('is_active', true)
          .order('display_order', { ascending: true, nullsFirst: false });

        if (catData) {
          setAllCategories(catData);
        }

        // Fetch products associated with this influencer
        const products = await fetchProductsByInfluencerId(influencerId);
        setInfluencerProducts(products);
      }
    } catch (error) {
      console.error('Error loading influencer data:', error);
      Alert.alert('Error', 'Failed to load influencer profile');
    } finally {
      setLoading(false);
      setContentLoading(false);
    }
  };

  useEffect(() => {
    // Update posts when context data changes
    setPosts(influencerPosts.filter(post => post.influencer_id === influencerId));
  }, [influencerPosts, influencerId]);

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

  const handleLikePost = async (postId: string, isLiked: boolean) => {
    // Handle sample posts
    if (postId.startsWith('sample_post_')) {
      // Just update local state for demo
      setPosts(prev => prev.map(post =>
        post.id === postId
          ? {
            ...post,
            likes: isLiked ? post.likes - 1 : post.likes + 1,
            is_liked: !isLiked
          }
          : post
      ));
      Toast.show({
        type: 'success',
        text1: isLiked ? 'Unliked' : 'Liked',
        text2: 'Sample profile demo',
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
        text2: 'Please login to like posts',
      });
      showLoginSheet();
      return;
    }

    try {
      const success = isLiked ? await unlikePost(postId) : await likePost(postId);
      if (success) {
        // Update local state
        setPosts(prev => prev.map(post =>
          post.id === postId
            ? {
              ...post,
              likes: isLiked ? post.likes - 1 : post.likes + 1,
              is_liked: !isLiked
            }
            : post
        ));
      }
    } catch (error) {
      console.error('Error updating like status:', error);
    }
  };

  const shareToWhatsApp = async (message: string) => {
    try {
      const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);
      if (canOpen) {
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert('WhatsApp not installed', 'Please install WhatsApp to share.');
      }
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      Alert.alert('Error', 'Unable to open WhatsApp for sharing.');
    }
  };

  // Helper functions for Product Card
  const getSmallestPrice = (product: any) => {
    if (product.product_variants && product.product_variants.length > 0) {
      // Find variant with lowest price
      return Math.min(...product.product_variants.map((v: any) => v.price));
    }
    return 0;
  };

  const getFirstImage = (product: any) => {
    if (product.image_urls && product.image_urls.length > 0) return product.image_urls[0];
    if (product.product_variants && product.product_variants.length > 0) {
      const v = product.product_variants.find((v: any) => v.image_urls && v.image_urls.length > 0);
      if (v) return v.image_urls[0];
    }
    return 'https://via.placeholder.com/150';
  };



  const renderProductCard = (product: any) => {
    const price = getSmallestPrice(product);
    const discountPct = Math.max(...(product?.product_variants?.map((v: any) => v.discount_percentage || 0) || [0]));
    const hasDiscount = discountPct > 0;
    const originalPrice = hasDiscount ? price / (1 - discountPct / 100) : undefined;

    // Use rating if available, else 0
    const rating = product.rating || 0;

    const firstImage = getFirstImage(product);
    const brandLabel = product.vendor_name || 'Only2U';

    return (
      <TouchableOpacity
        key={product.id}
        style={styles.productCard}
        activeOpacity={0.85}
        onPress={() => navigation.navigate('ProductDetails' as never, { product } as never)}
      >
        {hasDiscount && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountBadgeText}>{Math.round(discountPct)}% OFF</Text>
          </View>
        )}
        <Image source={{ uri: firstImage }} style={styles.productImage} />
        <Text style={styles.brandName} numberOfLines={1}>{brandLabel}</Text>
        <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
        <View style={styles.priceContainer}>
          <View style={styles.priceInfo}>
            {hasDiscount && (
              <Text style={styles.originalPrice}>₹{(originalPrice || 0).toFixed(0)}</Text>
            )}
            <Text style={styles.price}>₹{price?.toFixed(0)}</Text>
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
      </TouchableOpacity>
    );
  };

  const handlePostPress = (post: InfluencerPost) => {
    setSelectedPost(post);
    setShowVideoModal(true);
  };

  const renderPost = ({ item }: { item: InfluencerPost }) => (
    <TouchableOpacity
      style={styles.postItem}
      onPress={() => handlePostPress(item)}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.postImage}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.postImagePlaceholder}>
          <Ionicons name="play-circle" size={40} color="rgba(255,255,255,0.8)" />
        </View>
      )}
      <View style={styles.postOverlay}>
        <View style={styles.postStats}>
          <Ionicons name="play" size={16} color="white" />
          <Text style={styles.postStatText}>{item.views}</Text>
          <Ionicons name="heart" size={16} color="white" style={{ marginLeft: 12 }} />
          <Text style={styles.postStatText}>{item.likes}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderVideoModal = () => {
    if (!showVideoModal || !selectedPost) return null;

    return (
      <Modal
        visible={showVideoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowVideoModal(false)}
      >
        <View style={styles.videoModalContainer}>
          <TouchableOpacity
            style={styles.videoModalOverlay}
            activeOpacity={1}
            onPress={() => setShowVideoModal(false)}
          >
            <SafeAreaView style={styles.videoModalContent}>
              <View style={styles.videoModalHeader}>
                <TouchableOpacity onPress={() => setShowVideoModal(false)}>
                  <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
              </View>

              <View style={styles.videoContainer}>
                <Video
                  source={{ uri: selectedPost.video_url }}
                  style={styles.video}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  shouldPlay
                  isLooping
                />
              </View>

              <View style={styles.videoInfoSection}>
                <View style={styles.videoHeader}>
                  <Image
                    source={{
                      uri: influencer?.profile_photo || 'https://via.placeholder.com/40'
                    }}
                    style={styles.videoInfluencerAvatar}
                  />
                  <View style={styles.videoInfluencerInfo}>
                    <View style={styles.videoInfluencerNameRow}>
                      <Text style={styles.videoInfluencerName}>{influencer?.name}</Text>
                      {influencer?.is_verified && (
                        <Ionicons name="checkmark-circle" size={16} color="#4FC3F7" />
                      )}
                    </View>
                    <Text style={styles.videoInfluencerUsername}>@{influencer?.username}</Text>
                  </View>
                </View>

                {selectedPost.title && (
                  <Text style={styles.videoTitle}>{selectedPost.title}</Text>
                )}
                {selectedPost.description && (
                  <Text style={styles.videoDescription}>{selectedPost.description}</Text>
                )}

                <View style={styles.videoActions}>
                  <TouchableOpacity
                    style={styles.videoActionButton}
                    onPress={() => handleLikePost(selectedPost.id, selectedPost.is_liked || false)}
                  >
                    <Ionicons
                      name={selectedPost.is_liked ? "heart" : "heart-outline"}
                      size={24}
                      color={selectedPost.is_liked ? "#FF6EA6" : "white"}
                    />
                    <Text style={styles.videoActionText}>{selectedPost.likes}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.videoActionButton}>
                    <Ionicons name="share-social-outline" size={24} color="white" />
                    <Text style={styles.videoActionText}>{selectedPost.shares}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </SafeAreaView>
          </TouchableOpacity>
        </View>
      </Modal>
    );
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
                <Text style={styles.statNumber}>{posts.length}</Text>
                <Text style={styles.statLabel}>posts</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>
                  {influencer.total_followers >= 1000
                    ? `${(influencer.total_followers / 1000).toFixed(1)}K`
                    : influencer.total_followers}
                </Text>
                <Text style={styles.statLabel}>followers</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statItem}>
                <Text style={styles.statNumber}>{influencer.total_products_promoted || 0}</Text>
                <Text style={styles.statLabel}>products</Text>
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
              ) : influencerProducts.length === 0 ? (
                <View style={styles.emptyTabState}>
                  <Ionicons name="images-outline" size={64} color="#ddd" />
                  <Text style={styles.emptyTabTitle}>No Products Yet</Text>
                  <Text style={styles.emptyTabSubtitle}>Product images from {influencer?.name} will appear here</Text>
                </View>
              ) : (
                <>
                  <View style={styles.gridContainer}>
                    {influencerProducts.slice(0, postsDisplayCount).map((product) => {
                      const firstImage = getFirstImage(product);
                      return (
                        <TouchableOpacity
                          key={product.id}
                          style={styles.gridItem}
                          onPress={() => navigation.navigate('ProductDetails' as never, { product } as never)}
                          activeOpacity={0.8}
                        >
                          <Image
                            source={{ uri: firstImage }}
                            style={styles.gridImage}
                            resizeMode="cover"
                            fadeDuration={300}
                          />
                          <View style={styles.gridImageLoadingOverlay}>
                            <ActivityIndicator size="small" color="#F53F7A" />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {influencerProducts.length > postsDisplayCount && (
                    <TouchableOpacity
                      style={styles.loadMoreButton}
                      onPress={() => {
                        const newCount = postsDisplayCount + 12;
                        setPostsDisplayCount(newCount > influencerProducts.length ? influencerProducts.length : newCount);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.loadMoreText}>
                        Load More ({influencerProducts.length - postsDisplayCount} remaining)
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
                          <FlatList
                            horizontal
                            data={categoryProducts}
                            renderItem={({ item }) => renderProductCard(item)}
                            keyExtractor={(item) => item.id}
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.productsHorizontalList}
                            ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
                            nestedScrollEnabled={true}
                            scrollEnabled={true}
                          />
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

      {/* Video Modal */}
      {renderVideoModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F0F0',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  seeMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F53F7A',
    marginRight: 2,
  },
  productsHorizontalList: {
    paddingHorizontal: 8,
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
  postsGrid: {
    paddingHorizontal: 2,
  },
  postsRow: {
    gap: 2,
    marginBottom: 2,
  },
  postItem: {
    width: POST_SIZE,
    height: POST_SIZE,
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  postImage: {
    width: '100%',
    height: '100%',
  },
  postImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  postOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  postStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postStatText: {
    fontSize: 12,
    color: 'white',
    marginLeft: 4,
    fontWeight: '600',
  },
  productsGrid: {
    padding: 8,
  },
  productsRow: {
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productItem: {
    width: (width - 28) / 2,
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 4,
  },
  productImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    padding: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
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
  videoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
  },
  videoModalOverlay: {
    flex: 1,
  },
  videoModalContent: {
    flex: 1,
  },
  videoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: width,
    height: width * 1.777, // 16:9 aspect ratio
  },
  videoInfoSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 30,
  },
  videoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  videoInfluencerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  videoInfluencerInfo: {
    flex: 1,
  },
  videoInfluencerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  videoInfluencerName: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  videoInfluencerUsername: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
  },
  videoDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 20,
    marginBottom: 16,
  },
  videoActions: {
    flexDirection: 'row',
    gap: 24,
  },
  videoActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  videoActionText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
});

export default InfluencerProfile;
