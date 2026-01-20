import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Linking,
    ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '~/utils/supabase';

const { width } = Dimensions.get('window');

type TrackingStage = {
    id: string;
    title: string;
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    status: 'completed' | 'current' | 'pending';
    date?: string;
};

type OrderTrackingParams = {
    OrderTracking: {
        orderId: string;
        orderNumber: string;
        status: string;
        trackingNumber?: string;
        createdAt: string;
        shippedAt?: string;
        deliveredAt?: string;
        productName?: string;
        productImage?: string;
    };
};

interface OrderData {
    status: string;
    tracking_number?: string;
    shipped_at?: string;
    delivered_at?: string;
    created_at: string;
}

const OrderTracking = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<OrderTrackingParams, 'OrderTracking'>>();
    const insets = useSafeAreaInsets();

    const {
        orderId,
        orderNumber,
        status: initialStatus,
        trackingNumber: initialTrackingNumber,
        createdAt,
        shippedAt: initialShippedAt,
        deliveredAt: initialDeliveredAt,
        productName,
        productImage,
    } = route.params || {};

    // State for live order data from database
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState(initialStatus);
    const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
    const [shippedAt, setShippedAt] = useState(initialShippedAt);
    const [deliveredAt, setDeliveredAt] = useState(initialDeliveredAt);
    const [updatedAt, setUpdatedAt] = useState<string | undefined>(undefined);

    // Fetch order status from database
    useEffect(() => {
        const fetchOrderStatus = async () => {
            if (!orderId) {
                setLoading(false);
                return;
            }

            try {
                // First try orders table
                const { data: orderData, error: orderError } = await supabase
                    .from('orders')
                    .select('status, tracking_number, shipped_at, delivered_at, created_at, updated_at')
                    .eq('id', orderId)
                    .maybeSingle();

                if (orderData) {
                    setStatus(orderData.status);
                    setTrackingNumber(orderData.tracking_number || initialTrackingNumber);
                    setShippedAt(orderData.shipped_at || initialShippedAt);
                    setDeliveredAt(orderData.delivered_at || initialDeliveredAt);
                    setUpdatedAt(orderData.updated_at || orderData.created_at);
                    setLoading(false);
                    return;
                }

                // If not found in orders, try reseller_orders table
                // Note: reseller_orders may not have tracking_number column
                const { data: resellerData, error: resellerError } = await supabase
                    .from('reseller_orders')
                    .select('status, shipped_at, delivered_at, created_at, updated_at')
                    .eq('id', orderId)
                    .maybeSingle();

                if (resellerData) {
                    setStatus(resellerData.status);
                    // Keep initial tracking number for reseller orders
                    setShippedAt(resellerData.shipped_at || initialShippedAt);
                    setDeliveredAt(resellerData.delivered_at || initialDeliveredAt);
                    setUpdatedAt(resellerData.updated_at || resellerData.created_at);
                }
            } catch (error) {
                console.error('Error fetching order status:', error);
                // Keep using initial values on error
            } finally {
                setLoading(false);
            }
        };

        fetchOrderStatus();
    }, [orderId]);

    // Determine which stages are completed based on order status
    const getTrackingStages = (): TrackingStage[] => {
        const orderStatus = status?.toLowerCase() || 'pending';

        // For rejected orders - show only Order Placed -> Order Rejected
        if (orderStatus === 'rejected') {
            return [
                {
                    id: 'placed',
                    title: 'Order Placed',
                    description: 'Your order has been placed successfully',
                    icon: 'cart-outline',
                    status: 'completed',
                    date: formatDateTime(createdAt),
                },
                {
                    id: 'rejected',
                    title: 'Order Rejected',
                    description: 'This order has been rejected by the seller',
                    icon: 'close-circle-outline',
                    status: 'current',
                    date: updatedAt ? formatDateTime(updatedAt) : undefined,
                },
            ];
        }

        // For cancelled orders - show only Order Placed -> Order Cancelled
        if (orderStatus === 'cancelled') {
            return [
                {
                    id: 'placed',
                    title: 'Order Placed',
                    description: 'Your order has been placed successfully',
                    icon: 'cart-outline',
                    status: 'completed',
                    date: formatDateTime(createdAt),
                },
                {
                    id: 'cancelled',
                    title: 'Order Cancelled',
                    description: 'This order has been cancelled',
                    icon: 'close-circle-outline',
                    status: 'current',
                    date: updatedAt ? formatDateTime(updatedAt) : undefined,
                },
            ];
        }

        // Normal order flow stages
        const stages: TrackingStage[] = [
            {
                id: 'placed',
                title: 'Order Placed',
                description: 'Your order has been placed successfully',
                icon: 'cart-outline',
                status: 'completed',
                date: formatDateTime(createdAt),
            },
            {
                id: 'confirmed',
                title: 'Order Confirmed',
                description: 'Seller has confirmed your order',
                icon: 'checkmark-circle-outline',
                status: 'pending',
            },
            {
                id: 'processing',
                title: 'Processing',
                description: 'Your order is being prepared for shipment',
                icon: 'cube-outline',
                status: 'pending',
            },
            {
                id: 'shipped',
                title: 'Shipped',
                description: trackingNumber
                    ? `Tracking: ${trackingNumber}`
                    : 'Package handed over to courier',
                icon: 'airplane-outline',
                status: 'pending',
                date: shippedAt ? formatDateTime(shippedAt) : undefined,
            },
            {
                id: 'out_for_delivery',
                title: 'Out for Delivery',
                description: 'Package is out for delivery in your area',
                icon: 'bicycle-outline',
                status: 'pending',
            },
            {
                id: 'delivered',
                title: 'Delivered',
                description: 'Package has been delivered',
                icon: 'home-outline',
                status: 'pending',
                date: deliveredAt ? formatDateTime(deliveredAt) : undefined,
            },
        ];

        // Mark stages based on status
        const statusOrder = ['pending', 'confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'];
        const currentStatusIndex = statusOrder.indexOf(orderStatus);

        return stages.map((stage, index) => {
            const stageStatusMap: { [key: string]: number } = {
                'placed': -1, // Always completed
                'confirmed': 0,
                'processing': 1,
                'shipped': 2,
                'out_for_delivery': 3,
                'delivered': 4,
            };

            const stageIndex = stageStatusMap[stage.id] ?? -1;

            if (stageIndex < currentStatusIndex) {
                return { ...stage, status: 'completed' as const };
            } else if (stageIndex === currentStatusIndex) {
                return { ...stage, status: 'current' as const };
            }
            return stage;
        });
    };

    const formatDateTime = (dateString?: string) => {
        if (!dateString) return undefined;
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusColor = (stageStatus: TrackingStage['status']) => {
        switch (stageStatus) {
            case 'completed':
                return '#4CAF50';
            case 'current':
                return '#F53F7A';
            case 'pending':
                return '#E0E0E0';
            default:
                return '#E0E0E0';
        }
    };

    const stages = getTrackingStages();
    const isCancelled = status?.toLowerCase() === 'cancelled';
    const isRejected = status?.toLowerCase() === 'rejected';

    const handleContactSupport = () => {
        // Open support - could also navigate to a support screen
        Linking.openURL('mailto:support@only2u.app?subject=Order%20Tracking%20Help%20-%20' + orderNumber);
    };

    // Show loading state while fetching order data
    if (loading) {
        return (
            <View style={[styles.container, { paddingTop: insets.top }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Track Order</Text>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#F53F7A" />
                    <Text style={styles.loadingText}>Loading order status...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Track Order</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Order Info Card */}
                <View style={styles.orderInfoCard}>
                    <View style={styles.orderInfoHeader}>
                        <View>
                            <Text style={styles.orderNumber}>Order #{orderNumber}</Text>
                            {productName && (
                                <Text style={styles.productName} numberOfLines={1}>{productName}</Text>
                            )}
                        </View>
                        {trackingNumber && (
                            <TouchableOpacity
                                style={styles.trackingBadge}
                                onPress={() => {
                                    // Copy to clipboard or show tracking info
                                }}
                            >
                                <Ionicons name="qr-code-outline" size={14} color="#F53F7A" />
                                <Text style={styles.trackingText}>{trackingNumber}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {/* Cancelled Order Banner */}
                {isCancelled && (
                    <View style={styles.cancelledBanner}>
                        <Ionicons name="close-circle" size={24} color="#F44336" />
                        <View style={styles.cancelledTextContainer}>
                            <Text style={styles.cancelledTitle}>Order Cancelled</Text>
                            <Text style={styles.cancelledSubtitle}>This order has been cancelled</Text>
                        </View>
                    </View>
                )}

                {/* Rejected Order Banner */}
                {isRejected && (
                    <View style={styles.rejectedBanner}>
                        <Ionicons name="close-circle" size={24} color="#F44336" />
                        <View style={styles.rejectedTextContainer}>
                            <Text style={styles.rejectedTitle}>Order Rejected</Text>
                            <Text style={styles.rejectedSubtitle}>This order has been rejected by the seller</Text>
                        </View>
                    </View>
                )}

                {/* Tracking Timeline */}
                <View style={styles.timelineCard}>
                    <Text style={styles.sectionTitle}>{isCancelled || isRejected ? 'Order Status' : 'Delivery Status'}</Text>

                    <View style={styles.timeline}>
                        {stages.map((stage, index) => (
                            <View key={stage.id} style={styles.timelineItem}>
                                {/* Vertical Line */}
                                {index < stages.length - 1 && (
                                    <View
                                        style={[
                                            styles.timelineLine,
                                            {
                                                backgroundColor: stage.status === 'completed' ? '#4CAF50' : '#E0E0E0',
                                            }
                                        ]}
                                    />
                                )}

                                {/* Icon Circle */}
                                <View
                                    style={[
                                        styles.timelineIcon,
                                        {
                                            backgroundColor: stage.status === 'pending'
                                                ? '#fff'
                                                : (stage.id === 'rejected' || stage.id === 'cancelled')
                                                    ? '#F44336'
                                                    : getStatusColor(stage.status),
                                            borderColor: (stage.id === 'rejected' || stage.id === 'cancelled')
                                                ? '#F44336'
                                                : getStatusColor(stage.status),
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name={stage.status === 'completed' ? 'checkmark' : stage.icon}
                                        size={stage.status === 'current' ? 20 : 16}
                                        color={stage.status === 'pending' ? '#ccc' : '#fff'}
                                    />
                                </View>

                                {/* Content */}
                                <View style={styles.timelineContent}>
                                    <Text
                                        style={[
                                            styles.timelineTitle,
                                            {
                                                color: stage.status === 'pending' ? '#999' : '#333',
                                                fontWeight: stage.status === 'current' ? '700' : '600',
                                            }
                                        ]}
                                    >
                                        {stage.title}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.timelineDescription,
                                            { color: stage.status === 'pending' ? '#bbb' : '#666' }
                                        ]}
                                    >
                                        {stage.description}
                                    </Text>
                                    {stage.date && stage.status !== 'pending' && (
                                        <Text style={styles.timelineDate}>{stage.date}</Text>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Expected Delivery */}
                {!isCancelled && !isRejected && !deliveredAt && (
                    <View style={styles.expectedDeliveryCard}>
                        <View style={styles.expectedDeliveryIcon}>
                            <Ionicons name="calendar-outline" size={24} color="#F53F7A" />
                        </View>
                        <View style={styles.expectedDeliveryContent}>
                            <Text style={styles.expectedDeliveryLabel}>Expected Delivery</Text>
                            <Text style={styles.expectedDeliveryDate}>
                                {shippedAt
                                    ? `Within 5-7 business days from shipment`
                                    : `Will be updated once shipped`
                                }
                            </Text>
                        </View>
                    </View>
                )}

                {/* Delivered Success Card */}
                {status?.toLowerCase() === 'delivered' && (
                    <LinearGradient
                        colors={['#E8F5E9', '#C8E6C9']}
                        style={styles.deliveredCard}
                    >
                        <View style={styles.deliveredIconContainer}>
                            <Ionicons name="checkmark-circle" size={48} color="#4CAF50" />
                        </View>
                        <Text style={styles.deliveredTitle}>Order Delivered!</Text>
                        <Text style={styles.deliveredSubtitle}>
                            Your package was delivered on {formatDateTime(deliveredAt)}
                        </Text>
                    </LinearGradient>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8f8f8',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#666',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 8,
        marginLeft: -8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#333',
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    orderInfoCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    orderInfoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    orderNumber: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    productName: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        maxWidth: width * 0.5,
    },
    trackingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF0F4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        gap: 6,
    },
    trackingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F53F7A',
    },
    cancelledBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    cancelledTextContainer: {
        flex: 1,
    },
    cancelledTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F44336',
    },
    cancelledSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    rejectedBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        gap: 12,
    },
    rejectedTextContainer: {
        flex: 1,
    },
    rejectedTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#F44336',
    },
    rejectedSubtitle: {
        fontSize: 14,
        color: '#666',
        marginTop: 2,
    },
    timelineCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
        marginBottom: 16,
    },
    timeline: {
        paddingLeft: 4,
    },
    timelineItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 24,
        position: 'relative',
    },
    timelineLine: {
        position: 'absolute',
        left: 18,
        top: 40,
        width: 2,
        height: 48,
        backgroundColor: '#E0E0E0',
    },
    timelineIcon: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        marginRight: 12,
        zIndex: 1,
    },
    timelineContent: {
        flex: 1,
        paddingTop: 4,
    },
    timelineTitle: {
        fontSize: 15,
        fontWeight: '600',
        color: '#333',
    },
    timelineDescription: {
        fontSize: 13,
        color: '#666',
        marginTop: 2,
    },
    timelineDate: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
    },
    expectedDeliveryCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    expectedDeliveryIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFF0F4',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    expectedDeliveryContent: {
        flex: 1,
    },
    expectedDeliveryLabel: {
        fontSize: 14,
        color: '#666',
    },
    expectedDeliveryDate: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginTop: 2,
    },
    deliveredCard: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
    },
    deliveredIconContainer: {
        marginBottom: 12,
    },
    deliveredTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#2E7D32',
    },
    deliveredSubtitle: {
        fontSize: 14,
        color: '#4CAF50',
        marginTop: 4,
        textAlign: 'center',
    },
    helpCard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    helpTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#333',
    },
    helpDescription: {
        fontSize: 14,
        color: '#666',
        marginTop: 4,
        marginBottom: 12,
    },
    helpButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F53F7A',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 8,
    },
    helpButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});

export default OrderTracking;
