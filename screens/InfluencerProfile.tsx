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

    if (!user) {
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

    if (!user) {
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
          {/* Posts Tab - Show all videos in grid */}
          {activeTab === 'posts' && (
            <View style={styles.contentSection}>
              {contentLoading ? (
                <View style={styles.contentLoadingContainer}>
                  <ActivityIndicator size="large" color="#F53F7A" />
                  <Text style={styles.contentLoadingText}>Loading posts...</Text>
                </View>
              ) : posts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="videocam-outline" size={64} color="#DDD" />
                  <Text style={styles.emptyStateTitle}>No Posts Yet</Text>
                  <Text style={styles.emptyStateSubtitle}>Videos from {influencer?.name || 'this influencer'} will appear here</Text>
                </View>
              ) : (
                <FlatList
                  data={posts}
                  renderItem={renderPost}
                  keyExtractor={(item) => item.id}
                  numColumns={3}
                  scrollEnabled={false}
                  contentContainerStyle={styles.postsGrid}
                  columnWrapperStyle={styles.postsRow}
                />
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
                <FlatList
                  data={influencerProducts}
                  renderItem={({ item }) => {
                    const price = item.product_variants?.[0]?.price || 0;
                    const imageUrl = item.image_urls?.[0] || item.product_variants?.[0]?.image_urls?.[0];
                    return (
                      <TouchableOpacity
                        style={styles.productItem}
                        onPress={() => navigation.navigate('ProductDetails' as never, { product: item } as never)}
                      >
                        <Image
                          source={{ uri: imageUrl || 'https://via.placeholder.com/150' }}
                          style={styles.productImage}
                          resizeMode="cover"
                        />
                        <View style={styles.productInfo}>
                          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                          <Text style={styles.productPrice}>₹{price.toFixed(2)}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  }}
                  keyExtractor={(item) => item.id}
                  numColumns={2}
                  scrollEnabled={false}
                  contentContainerStyle={styles.productsGrid}
                  columnWrapperStyle={styles.productsRow}
                />
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
    backgroundColor: '#FFFFFF',
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
