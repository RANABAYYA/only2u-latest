import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from './useAuth';

export interface Influencer {
  id: string;
  user_id: string;
  name: string;
  username: string;
  bio?: string;
  profile_photo?: string;
  instagram_handle?: string;
  youtube_handle?: string;
  tiktok_handle?: string;
  twitter_handle?: string;
  is_verified: boolean;
  total_followers: number;
  total_posts: number;
  total_products_promoted: number;
  influencer_code?: string;
  created_at: string;
  updated_at: string;
}

export interface InfluencerPost {
  id: string;
  influencer_id: string;
  title?: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  product_id?: string;
  views: number;
  likes: number;
  shares: number;
  is_published: boolean;
  is_featured: boolean;
  published_at: string;
  created_at: string;
  updated_at: string;
  is_liked?: boolean;
}

export interface InfluencerFollow {
  id: string;
  follower_id: string;
  influencer_id: string;
  created_at: string;
}

interface InfluencerContextType {
  influencers: Influencer[];
  influencerPosts: InfluencerPost[];
  followedInfluencers: string[];
  loading: boolean;
  error: string | null;

  // Influencer actions
  fetchInfluencers: () => Promise<void>;
  fetchInfluencerById: (influencerId: string) => Promise<Influencer | null>;
  fetchInfluencerPosts: (influencerId?: string) => Promise<void>;
  fetchFollowedInfluencers: () => Promise<void>;

  // Follow actions
  followInfluencer: (influencerId: string) => Promise<boolean>;
  unfollowInfluencer: (influencerId: string) => Promise<boolean>;
  isFollowingInfluencer: (influencerId: string) => boolean;

  // Post actions
  likePost: (postId: string) => Promise<boolean>;
  unlikePost: (postId: string) => Promise<boolean>;
  sharePost: (postId: string) => Promise<boolean>;

  // Utility functions
  getInfluencerByProductId: (productId: string) => Promise<Influencer | null>;
  fetchProductsByInfluencerId: (influencerId: string) => Promise<any[]>;
  refreshInfluencerData: () => Promise<void>;
}

const InfluencerContext = createContext<InfluencerContextType | undefined>(undefined);

export const useInfluencer = () => {
  const context = useContext(InfluencerContext);
  if (context === undefined) {
    throw new Error('useInfluencer must be used within an InfluencerProvider');
  }
  return context;
};

interface InfluencerProviderProps {
  children: ReactNode;
}

export const InfluencerProvider: React.FC<InfluencerProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [influencerPosts, setInfluencerPosts] = useState<InfluencerPost[]>([]);
  const [followedInfluencers, setFollowedInfluencers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all influencers
  const fetchInfluencers = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('influencer_profiles')
        .select('*')
        .eq('is_active', true)
        .order('total_followers', { ascending: false });

      if (error) throw error;
      setInfluencers(data || []);
    } catch (err) {
      console.error('Error fetching influencers:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch influencers');
    } finally {
      setLoading(false);
    }
  };

  // Fetch influencer by ID
  const fetchInfluencerById = async (influencerId: string): Promise<Influencer | null> => {
    try {
      const { data, error } = await supabase
        .from('influencer_profiles')
        .select('*')
        .eq('id', influencerId)
        .single();

      if (error) throw error;
      return data;
    } catch (err) {
      console.error('Error fetching influencer:', err);
      return null;
    }
  };

  // Fetch influencer posts (all or specific influencer)
  const fetchInfluencerPosts = async (influencerId?: string) => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('influencer_posts')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });

      if (influencerId) {
        query = query.eq('influencer_id', influencerId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Check if user has liked each post
      const postsWithLikes = await Promise.all(
        (data || []).map(async (post) => {
          if (!user) return { ...post, is_liked: false };

          const { data: likeData } = await supabase
            .from('influencer_post_likes')
            .select('id')
            .eq('post_id', post.id)
            .eq('user_id', user.id)
            .single();

          return { ...post, is_liked: !!likeData };
        })
      );

      setInfluencerPosts(postsWithLikes);
    } catch (err) {
      console.error('Error fetching influencer posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setLoading(false);
    }
  };

  // Fetch followed influencers
  const fetchFollowedInfluencers = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('influencer_follows')
        .select('influencer_id')
        .eq('follower_id', user.id);

      if (error) throw error;
      setFollowedInfluencers((data || []).map(f => f.influencer_id));
    } catch (err) {
      console.error('Error fetching followed influencers:', err);
    }
  };

  // Follow influencer
  const followInfluencer = async (influencerId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('influencer_follows')
        .insert({
          follower_id: user.id,
          influencer_id: influencerId
        });

      if (error) throw error;

      setFollowedInfluencers(prev => [...prev, influencerId]);
      return true;
    } catch (err) {
      console.error('Error following influencer:', err);
      return false;
    }
  };

  // Unfollow influencer
  const unfollowInfluencer = async (influencerId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('influencer_follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('influencer_id', influencerId);

      if (error) throw error;

      setFollowedInfluencers(prev => prev.filter(id => id !== influencerId));
      return true;
    } catch (err) {
      console.error('Error unfollowing influencer:', err);
      return false;
    }
  };

  // Check if following influencer
  const isFollowingInfluencer = (influencerId: string): boolean => {
    return followedInfluencers.includes(influencerId);
  };

  // Like post
  const likePost = async (postId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('influencer_post_likes')
        .insert({
          user_id: user.id,
          post_id: postId
        });

      if (error) throw error;

      // Update local state
      setInfluencerPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, likes: post.likes + 1, is_liked: true }
          : post
      ));

      return true;
    } catch (err) {
      console.error('Error liking post:', err);
      return false;
    }
  };

  // Unlike post
  const unlikePost = async (postId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error } = await supabase
        .from('influencer_post_likes')
        .delete()
        .eq('user_id', user.id)
        .eq('post_id', postId);

      if (error) throw error;

      // Update local state
      setInfluencerPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, likes: post.likes - 1, is_liked: false }
          : post
      ));

      return true;
    } catch (err) {
      console.error('Error unliking post:', err);
      return false;
    }
  };

  // Share post
  const sharePost = async (postId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('influencer_posts')
        .update({ shares: supabase.raw('shares + 1') })
        .eq('id', postId);

      if (error) throw error;

      // Update local state
      setInfluencerPosts(prev => prev.map(post =>
        post.id === postId
          ? { ...post, shares: post.shares + 1 }
          : post
      ));

      return true;
    } catch (err) {
      console.error('Error sharing post:', err);
      return false;
    }
  };

  // Get influencer by product ID
  const getInfluencerByProductId = async (productId: string): Promise<Influencer | null> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('influencer_id')
        .eq('id', productId)
        .single();

      if (error || !data?.influencer_id) return null;

      return await fetchInfluencerById(data.influencer_id);
    } catch (err) {
      console.error('Error getting influencer by product ID:', err);
      return null;
    }
  };

  // Get products by influencer ID
  const fetchProductsByInfluencerId = async (influencerId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          product_variants (
            price,
            image_urls
          )
        `)
        .eq('influencer_id', influencerId)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error fetching products by influencer ID:', err);
      return [];
    }
  };

  // Refresh all influencer data
  const refreshInfluencerData = async () => {
    await Promise.all([
      fetchInfluencers(),
      fetchInfluencerPosts(),
      fetchFollowedInfluencers()
    ]);
  };

  // Initialize data when user changes
  useEffect(() => {
    if (user) {
      fetchFollowedInfluencers();
    } else {
      setFollowedInfluencers([]);
    }
  }, [user]);

  // Initial data fetch
  useEffect(() => {
    fetchInfluencers();
    fetchInfluencerPosts();
  }, []);

  const value: InfluencerContextType = {
    influencers,
    influencerPosts,
    followedInfluencers,
    loading,
    error,
    fetchInfluencers,
    fetchInfluencerById,
    fetchInfluencerPosts,
    fetchFollowedInfluencers,
    followInfluencer,
    unfollowInfluencer,
    isFollowingInfluencer,
    likePost,
    unlikePost,
    sharePost,
    getInfluencerByProductId,
    fetchProductsByInfluencerId,
    refreshInfluencerData
  };

  return (
    <InfluencerContext.Provider value={value}>
      {children}
    </InfluencerContext.Provider>
  );
};

