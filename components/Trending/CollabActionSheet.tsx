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
                    <TouchableOpacity
                        style={[styles.actionButton, styles.viewButton]}
                        onPress={() => {
                            onNavigateToProfile(type, data.id, data);
                            sheetRef.current?.dismiss();
                        }}
                    >
                        <Ionicons name="arrow-forward" size={16} color="#F53F7A" />
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
        backgroundColor: '#F53F7A',
        width: 40,
        height: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F53F7A',
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
        paddingVertical: 14,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(245, 63, 122, 0.15)',
        marginVertical: 4,
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        marginRight: 12,
        borderWidth: 2,
        borderColor: '#F53F7A',
    },
    textContainer: {
        justifyContent: 'center',
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '700',
        color: '#000',
        marginBottom: 2,
    },
    role: {
        fontSize: 12,
        color: '#F53F7A',
        fontWeight: '600',
    },
    actions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 22,
        backgroundColor: '#F53F7A',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#F53F7A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 3,
    },
    followingButton: {
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: '#F53F7A',
        shadowOpacity: 0,
    },
    viewButton: {
        backgroundColor: 'rgba(245, 63, 122, 0.1)',
        paddingHorizontal: 12,
        shadowOpacity: 0,
    },
    actionText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    followingText: {
        color: '#F53F7A',
    },
});

export default CollabActionSheet;
