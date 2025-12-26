import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from 'react-native';
import { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const DEFAULT_AVATAR = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';

interface Props {
    sheetRef: React.RefObject<BottomSheetModal | null>;
    vendor: any;
    influencer: any;
    isFollowingVendor: boolean;
    onFollowVendor: (id: string) => void;
    onNavigateToProfile: (type: 'vendor' | 'influencer', id: string, data: any) => void;
    onClose: () => void;
}

const CollabActionSheet = ({
    sheetRef,
    vendor,
    influencer,
    isFollowingVendor,
    onFollowVendor,
    onNavigateToProfile,
    onClose,
}: Props) => {
    const insets = useSafeAreaInsets();
    const snapPoints = useMemo(() => [influencer ? '35%' : '25%'], [influencer]);

    const renderBackdrop = (props: any) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
        />
    );

    const renderEntityRow = (
        type: 'vendor' | 'influencer',
        data: any,
        isFollowing?: boolean,
        onFollow?: () => void
    ) => {
        if (!data) return null;
        const isVendor = type === 'vendor';
        const name = isVendor ? (data.business_name || data.vendor_name || 'Vendor') : data.name;
        const image = isVendor
            ? (data.profile_image_url || data.profile_photo)
            : (data.profile_photo || data.profile_image_url);

        return (
            <View style={styles.row}>
                <TouchableOpacity
                    style={styles.profileInfo}
                    onPress={() => {
                        onNavigateToProfile(type, data.id, data);
                        sheetRef.current?.dismiss();
                    }}
                >
                    <Image source={{ uri: image || DEFAULT_AVATAR }} style={styles.avatar} />
                    <View style={styles.textContainer}>
                        <Text style={styles.name} numberOfLines={1}>{name}</Text>
                        <Text style={styles.role}>{isVendor ? 'Brand' : 'Influencer'}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                    {onFollow && (
                        <TouchableOpacity
                            style={[styles.actionButton, isFollowing && styles.followingButton]}
                            onPress={onFollow}
                        >
                            <Text style={[styles.actionText, isFollowing && styles.followingText]}>
                                {isFollowing ? 'Following' : 'Follow'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[styles.actionButton, styles.viewButton]}
                        onPress={() => {
                            onNavigateToProfile(type, data.id, data);
                            sheetRef.current?.dismiss();
                        }}
                    >
                        <Ionicons name="arrow-forward" size={16} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <BottomSheetModal
            ref={sheetRef}
            index={0}
            snapPoints={snapPoints}
            backdropComponent={renderBackdrop}
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.indicator}
        >
            <View style={[styles.content, { paddingBottom: insets.bottom + 20 }]}>
                <Text style={styles.title}>Creators</Text>

                <View style={styles.list}>
                    {renderEntityRow('vendor', vendor, isFollowingVendor, () => onFollowVendor(vendor.id))}
                    {influencer && <View style={styles.divider} />}
                    {renderEntityRow('influencer', influencer, false, undefined)}
                    {/* Note: Influencer follow logic not in context yet, passing undefined for now or handle later */}
                </View>
            </View>
        </BottomSheetModal>
    );
};

const styles = StyleSheet.create({
    sheetBackground: {
        backgroundColor: '#fff',
        borderRadius: 24,
    },
    indicator: {
        backgroundColor: '#E5E7EB',
        width: 40,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#000',
        marginBottom: 20,
        textAlign: 'center',
    },
    list: {
        gap: 0,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#F3F4F6',
        marginVertical: 4,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    textContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#000',
        marginBottom: 2,
    },
    role: {
        fontSize: 12,
        color: '#6B7280',
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#000',
        justifyContent: 'center',
        alignItems: 'center',
    },
    followingButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    viewButton: {
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
    },
    actionText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    followingText: {
        color: '#000',
    },
});

export default CollabActionSheet;
