import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const toastConfig = {
  wishlistAdded: ({ text1, text2 }: any) => (
    <View style={styles.toastContainerWhite}>
      <View style={styles.toastIconContainer}>
        <Ionicons name="heart" size={24} color="#F53F7A" />
      </View>
      <View style={styles.toastTextContainer}>
        {text1 && <Text style={styles.toastTitleDark}>{text1}</Text>}
        {text2 && <Text style={styles.toastSubtitleDark}>{text2}</Text>}
      </View>
    </View>
  ),
  wishlistRemove: ({ text1, text2 }: any) => (
    <View style={styles.wishlistRemoveContainer}>
      <View style={styles.wishlistRemoveIconContainer}>
        <Ionicons name="heart-dislike-outline" size={24} color="#F53F7A" />
      </View>
      <View style={styles.wishlistRemoveTextContainer}>
        {text1 && <Text style={styles.wishlistRemoveTitle}>{text1}</Text>}
        {text2 && <Text style={styles.wishlistRemoveSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  wishlistMilestone: ({ text1, text2, props }: any) => (
    <View style={styles.wishlistToastContainer}>
      <View style={styles.wishlistContent}>
        <View style={styles.wishlistIconContainer}>
          <Ionicons name="heart" size={24} color="#fff" />
        </View>
        <View style={styles.wishlistTextContainer}>
          {text1 && <Text style={styles.wishlistTitle}>{text1}</Text>}
          {text2 && <Text style={styles.wishlistSubtitle}>{text2}</Text>}
        </View>
      </View>
      {props?.onViewPress && (
        <TouchableOpacity
          style={styles.wishlistViewButton}
          onPress={props.onViewPress}
          activeOpacity={0.8}
        >
          <Text style={styles.wishlistViewButtonText}>View</Text>
        </TouchableOpacity>
      )}
    </View>
  ),
  success: ({ text1, text2 }: any) => {
    // Check if this is a removal action
    const isRemoval = text1?.toLowerCase().includes('removed');
    // Check if this is a face swap toast - check both text1 and text2
    const isFaceSwap = text1?.toLowerCase().includes('face swap') ||
      text2?.toLowerCase().includes('face swap') ||
      text1?.toLowerCase().includes('face swap started') ||
      text1?.toLowerCase() === 'face swap started';

    let iconName = 'heart';
    if (isRemoval) {
      iconName = 'heart-dislike-outline';
    } else if (isFaceSwap) {
      iconName = 'sparkles';
    }

    // Determine border style based on face swap detection
    const borderStyle = isFaceSwap ? {
      borderWidth: 2,
      borderColor: '#F53F7A', // Full pink border for face swap
    } : {
      borderLeftWidth: 4,
      borderLeftColor: '#F53F7A', // Left border for other success toasts
    };

    return (
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 8,
        ...borderStyle,
      }}>
        <View style={{ marginRight: 12 }}>
          <Ionicons name={iconName} size={24} color="#F53F7A" />
        </View>
        <View style={{ flex: 1 }}>
          {text1 && <Text style={{
            fontSize: 15,
            fontWeight: '700',
            color: '#1a1a1a',
            marginBottom: 2,
          }}>{text1}</Text>}
          {text2 && <Text style={{
            fontSize: 13,
            fontWeight: '500',
            color: '#666',
          }}>{text2}</Text>}
        </View>
      </View>
    );
  },
  profilePhotoSuccess: ({ text1, text2 }: any) => (
    <View style={styles.profilePhotoToastContainer}>
      <View style={styles.profilePhotoToastIconContainer}>
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
      </View>
      <View style={styles.profilePhotoToastTextContainer}>
        {text1 && <Text style={styles.profilePhotoToastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.profilePhotoToastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  filtersApplied: ({ text1, text2 }: any) => (
    <View style={styles.filtersAppliedToastContainer}>
      <View style={styles.filtersAppliedToastIconContainer}>
        <Ionicons name="checkmark-circle" size={24} color="#fff" />
      </View>
      <View style={styles.filtersAppliedToastTextContainer}>
        {text1 && <Text style={styles.filtersAppliedToastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.filtersAppliedToastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  comingSoonInterest: ({ text1, text2 }: any) => (
    <View style={styles.comingSoonInterestToastContainer}>
      <View style={styles.comingSoonInterestToastIconContainer}>
        <Ionicons name="heart" size={24} color="#fff" />
      </View>
      <View style={styles.comingSoonInterestToastTextContainer}>
        {text1 && <Text style={styles.comingSoonInterestToastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.comingSoonInterestToastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  error: ({ text1, text2 }: any) => (
    <View style={[styles.toastContainer, styles.toastError]}>
      <View style={styles.toastIconContainer}>
        <Ionicons name="close-circle" size={24} color="#fff" />
      </View>
      <View style={styles.toastTextContainer}>
        {text1 && <Text style={styles.toastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.toastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  info: ({ text1, text2 }: any) => (
    <View style={[styles.toastContainer, styles.toastInfo]}>
      <View style={styles.toastIconContainer}>
        <Ionicons name="information-circle" size={24} color="#fff" />
      </View>
      <View style={styles.toastTextContainer}>
        {text1 && <Text style={styles.toastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.toastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  faceSwapStarted: ({ text1, text2 }: any) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 8,
      borderWidth: 2,
      borderColor: '#F53F7A', // Full pink border for face swap
    }}>
      <View style={{ marginRight: 12 }}>
        <Ionicons name="sparkles" size={24} color="#F53F7A" />
      </View>
      <View style={{ flex: 1 }}>
        {text1 && <Text style={{
          fontSize: 15,
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: 2,
        }}>{text1}</Text>}
        {text2 && <Text style={{
          fontSize: 13,
          fontWeight: '500',
          color: '#666',
        }}>{text2}</Text>}
      </View>
    </View>
  ),
  warning: ({ text1, text2 }: any) => (
    <View style={[styles.toastContainer, styles.toastWarning]}>
      <View style={styles.toastIconContainer}>
        <Ionicons name="warning" size={24} color="#fff" />
      </View>
      <View style={styles.toastTextContainer}>
        {text1 && <Text style={styles.toastTitle}>{text1}</Text>}
        {text2 && <Text style={styles.toastSubtitle}>{text2}</Text>}
      </View>
    </View>
  ),
  sizeRequired: ({ text1, text2 }: any) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 12,
      shadowColor: '#F53F7A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
      borderLeftWidth: 4,
      borderLeftColor: '#F53F7A',
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFF0F5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
      }}>
        <Ionicons name="resize-outline" size={22} color="#F53F7A" />
      </View>
      <View style={{ flex: 1 }}>
        {text1 && <Text style={{
          fontSize: 15,
          fontWeight: '700',
          color: '#1a1a1a',
          marginBottom: 2,
        }}>{text1}</Text>}
        {text2 && <Text style={{
          fontSize: 13,
          fontWeight: '500',
          color: '#666',
        }}>{text2}</Text>}
      </View>
    </View>
  ),
};

const styles = StyleSheet.create({
  // Wishlist Remove Toast - White background with pink left border
  wishlistRemoveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A',
  },
  wishlistRemoveIconContainer: {
    marginRight: 12,
  },
  wishlistRemoveTextContainer: {
    flex: 1,
  },
  wishlistRemoveTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  wishlistRemoveSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  // Wishlist Milestone Toast - High z-index to appear above swipe cards
  wishlistToastContainer: {
    backgroundColor: '#F53F7A',
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 20, // Very high elevation to appear above cards
    zIndex: 9999, // Very high z-index
    borderWidth: 2,
    borderColor: '#fff',
  },
  wishlistContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  wishlistIconContainer: {
    marginRight: 12,
  },
  wishlistTextContainer: {
    flex: 1,
  },
  wishlistTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  wishlistSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.95,
  },
  wishlistViewButton: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wishlistViewButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F53F7A',
  },
  toastContainerWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', // White background
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F53F7A', // Pink left border
  },
  toastTitleDark: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 2,
  },
  toastSubtitleDark: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  toastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A', // Pink theme color
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderLeftWidth: 4,
    borderLeftColor: '#fff',
  },
  toastError: {
    backgroundColor: '#EF4444', // Red for errors
    shadowColor: '#EF4444',
    borderLeftColor: '#fff',
  },
  toastInfo: {
    backgroundColor: '#F53F7A', // Pink for info
    shadowColor: '#F53F7A',
    borderLeftColor: '#fff',
  },
  toastWarning: {
    backgroundColor: '#F59E0B', // Orange for warnings
    shadowColor: '#F59E0B',
    borderLeftColor: '#fff',
  },
  toastIconContainer: {
    marginRight: 12,
  },
  toastTextContainer: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  toastSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff',
    opacity: 0.95,
  },
  // Profile Photo Success Toast - Pink and White theme
  profilePhotoToastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A', // Pink background
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#fff', // White border
  },
  profilePhotoToastIconContainer: {
    marginRight: 12,
  },
  profilePhotoToastTextContainer: {
    flex: 1,
  },
  profilePhotoToastTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff', // White text
    marginBottom: 2,
  },
  profilePhotoToastSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff', // White text
    opacity: 0.95,
  },
  // Filters Applied Toast - Pink and White theme, appears on top
  filtersAppliedToastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A', // Pink background
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20, // High elevation to appear on top
    borderWidth: 2,
    borderColor: '#fff', // White border
    zIndex: 9999, // Very high z-index to appear on top
  },
  filtersAppliedToastIconContainer: {
    marginRight: 12,
  },
  filtersAppliedToastTextContainer: {
    flex: 1,
  },
  filtersAppliedToastTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff', // White text
    marginBottom: 2,
  },
  filtersAppliedToastSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff', // White text
    opacity: 0.95,
  },
  // Coming Soon Interest Toast - Pink and White theme, appears on top
  comingSoonInterestToastContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F53F7A', // Pink background
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 20, // High elevation to appear on top
    borderWidth: 2,
    borderColor: '#fff', // White border
    zIndex: 9999, // Very high z-index to appear on top
  },
  comingSoonInterestToastIconContainer: {
    marginRight: 12,
  },
  comingSoonInterestToastTextContainer: {
    flex: 1,
  },
  comingSoonInterestToastTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff', // White text
    marginBottom: 2,
  },
  comingSoonInterestToastSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#fff', // White text
    opacity: 0.95,
  },
});

