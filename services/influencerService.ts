/**
 * Influencer Application Service
 * Handles all API calls related to influencer applications
 */

import { supabase } from '~/utils/supabase';

// =====================================================
// TYPES & INTERFACES
// =====================================================

export interface InfluencerApplication {
  id?: string;
  full_name: string;
  instagram_url: string;
  instagram_handle?: string;
  user_id?: string;
  user_email?: string;
  user_phone?: string;
  status?: 'pending' | 'under_review' | 'approved' | 'rejected' | 'on_hold';
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  instagram_followers?: number;
  instagram_engagement_rate?: number;
  instagram_verified?: boolean;
  influencer_code?: string;
  commission_rate?: number;
  approved_at?: string;
  contract_signed?: boolean;
  contract_signed_at?: string;
  contact_email?: string;
  contact_phone?: string;
  preferred_contact_method?: 'email' | 'phone' | 'instagram' | 'whatsapp';
  last_active_at?: string;
  total_orders?: number;
  total_revenue?: number;
  total_commission_earned?: number;
  is_active?: boolean;
  internal_notes?: string;
  admin_tags?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface InfluencerCommission {
  id?: string;
  influencer_id: string;
  influencer_code: string;
  order_id: string;
  customer_id?: string;
  order_amount: number;
  commission_rate: number;
  commission_amount: number;
  status?: 'pending' | 'approved' | 'paid' | 'cancelled';
  payment_method?: string;
  payment_reference?: string;
  paid_at?: string;
  order_date: string;
  created_at?: string;
  updated_at?: string;
}

export interface InfluencerStats {
  total_orders: number;
  total_revenue: number;
  total_commission: number;
  pending_commission: number;
  paid_commission: number;
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Extract Instagram handle from URL or @handle
 */
export const extractInstagramHandle = (input: string): string => {
  const trimmed = input.trim();
  
  // If it's a URL, extract the handle
  const urlMatch = trimmed.match(/instagram\.com\/([A-Za-z0-9_.]+)/i);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }
  
  // If it starts with @, remove it
  if (trimmed.startsWith('@')) {
    return trimmed.substring(1);
  }
  
  // Otherwise, return as is
  return trimmed;
};

/**
 * Validate Instagram URL or handle
 */
export const validateInstagramInput = (input: string): boolean => {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\/(www\.)?instagram\.com\/[A-Za-z0-9_.]+\/?$/i.test(trimmed);
  const isAtHandle = /^@[A-Za-z0-9_.]+$/.test(trimmed);
  const isPlainHandle = /^[A-Za-z0-9_.]+$/.test(trimmed);
  return isUrl || isAtHandle || isPlainHandle;
};

// =====================================================
// APPLICATION MANAGEMENT
// =====================================================

/**
 * Submit a new influencer application
 */
export const submitInfluencerApplication = async (
  applicationData: Omit<InfluencerApplication, 'id' | 'created_at' | 'updated_at'>
): Promise<{ success: boolean; data?: InfluencerApplication; error?: string }> => {
  try {
    // Extract Instagram handle
    const instagram_handle = extractInstagramHandle(applicationData.instagram_url);

    // Get current user if logged in
    const { data: { user } } = await supabase.auth.getUser();
    
    const dataToInsert = {
      ...applicationData,
      instagram_handle,
      user_id: user?.id || null,
      user_email: user?.email || applicationData.user_email || null,
      status: 'pending' as const,
    };

    const { data, error } = await supabase
      .from('influencer_applications')
      .insert(dataToInsert)
      .select()
      .single();

    if (error) {
      console.error('Error submitting influencer application:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to submit application' 
      };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected error submitting application:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

/**
 * Get user's influencer application(s)
 */
export const getUserInfluencerApplications = async (
  userId?: string
): Promise<{ success: boolean; data?: InfluencerApplication[]; error?: string }> => {
  try {
    let query = supabase
      .from('influencer_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching influencer applications:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch applications' 
      };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Unexpected error fetching applications:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

/**
 * Get influencer application by ID
 */
export const getInfluencerApplicationById = async (
  applicationId: string
): Promise<{ success: boolean; data?: InfluencerApplication; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('influencer_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) {
      console.error('Error fetching influencer application:', error);
      return { 
        success: false, 
        error: error.message || 'Application not found' 
      };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected error fetching application:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

/**
 * Check if user has an approved influencer account
 */
export const isUserApprovedInfluencer = async (
  userId: string
): Promise<{ success: boolean; isApproved: boolean; data?: InfluencerApplication; error?: string }> => {
  try {
    const { data, error } = await supabase
      .from('influencer_applications')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'approved')
      .eq('is_active', true)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error checking influencer status:', error);
      return { 
        success: false, 
        isApproved: false,
        error: error.message 
      };
    }

    return { 
      success: true, 
      isApproved: !!data,
      data: data || undefined
    };
  } catch (error: any) {
    console.error('Unexpected error checking influencer status:', error);
    return { 
      success: false, 
      isApproved: false,
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

// =====================================================
// COMMISSION MANAGEMENT
// =====================================================

/**
 * Get influencer commissions
 */
export const getInfluencerCommissions = async (
  influencerId: string,
  options?: {
    status?: 'pending' | 'approved' | 'paid' | 'cancelled';
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<{ success: boolean; data?: InfluencerCommission[]; error?: string }> => {
  try {
    let query = supabase
      .from('influencer_commissions')
      .select('*')
      .eq('influencer_id', influencerId)
      .order('order_date', { ascending: false });

    if (options?.status) {
      query = query.eq('status', options.status);
    }

    if (options?.startDate) {
      query = query.gte('order_date', options.startDate);
    }

    if (options?.endDate) {
      query = query.lte('order_date', options.endDate);
    }

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching commissions:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch commissions' 
      };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('Unexpected error fetching commissions:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

/**
 * Get influencer commission statistics
 */
export const getInfluencerStats = async (
  influencerId: string,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; data?: InfluencerStats; error?: string }> => {
  try {
    const { data, error } = await supabase.rpc('calculate_influencer_commission', {
      influencer_id_param: influencerId,
      start_date: startDate || null,
      end_date: endDate || null,
    });

    if (error) {
      console.error('Error fetching influencer stats:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to fetch statistics' 
      };
    }

    return { 
      success: true, 
      data: data && data.length > 0 ? data[0] : {
        total_orders: 0,
        total_revenue: 0,
        total_commission: 0,
        pending_commission: 0,
        paid_commission: 0,
      }
    };
  } catch (error: any) {
    console.error('Unexpected error fetching stats:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

// =====================================================
// ADMIN FUNCTIONS (require admin role)
// =====================================================

/**
 * Approve an influencer application
 */
export const approveInfluencerApplication = async (
  applicationId: string,
  commissionRate?: number
): Promise<{ success: boolean; data?: InfluencerApplication; error?: string }> => {
  try {
    // Call the PostgreSQL function to approve and generate code
    const { error: approveError } = await supabase.rpc('approve_influencer_application', {
      application_id: applicationId,
    });

    if (approveError) {
      console.error('Error approving application:', approveError);
      return { 
        success: false, 
        error: approveError.message || 'Failed to approve application' 
      };
    }

    // If custom commission rate provided, update it
    if (commissionRate !== undefined) {
      const { error: updateError } = await supabase
        .from('influencer_applications')
        .update({ commission_rate: commissionRate })
        .eq('id', applicationId);

      if (updateError) {
        console.warn('Failed to update commission rate:', updateError);
      }
    }

    // Fetch the updated application
    const { data, error } = await supabase
      .from('influencer_applications')
      .select('*')
      .eq('id', applicationId)
      .single();

    if (error) {
      return { 
        success: true, // Approval succeeded even if fetch failed
        error: 'Application approved but failed to fetch updated data' 
      };
    }

    return { success: true, data };
  } catch (error: any) {
    console.error('Unexpected error approving application:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

/**
 * Reject an influencer application
 */
export const rejectInfluencerApplication = async (
  applicationId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { error } = await supabase
      .from('influencer_applications')
      .update({
        status: 'rejected',
        rejection_reason: reason,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', applicationId);

    if (error) {
      console.error('Error rejecting application:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to reject application' 
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Unexpected error rejecting application:', error);
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    };
  }
};

export default {
  submitInfluencerApplication,
  getUserInfluencerApplications,
  getInfluencerApplicationById,
  isUserApprovedInfluencer,
  getInfluencerCommissions,
  getInfluencerStats,
  approveInfluencerApplication,
  rejectInfluencerApplication,
  extractInstagramHandle,
  validateInstagramInput,
};

