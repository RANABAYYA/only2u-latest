import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withDelay,
    Easing,
    interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface TrackingProgressBarProps {
    status: string;
    dates?: {
        ordered?: string;
        shipped?: string;
        outForDelivery?: string;
        delivered?: string;
    };
}

const STAGES = [
    { label: 'Ordered', key: 'ordered' },
    { label: 'Shipped', key: 'shipped' },
    { label: 'Out for Delivery', key: 'out_for_delivery' },
    { label: 'Delivery', key: 'delivered' },
];

// Custom Truck Icon - Pink theme, facing right
const TruckIcon = ({ isCancelled }: { isCancelled: boolean }) => {
    if (isCancelled) {
        return (
            <View style={truckStyles.cancelledContainer}>
                <Ionicons name="close" size={12} color="#fff" />
            </View>
        );
    }

    // Truck facing RIGHT (cabin on right, cargo on left)
    return (
        <View style={truckStyles.truckWrapper}>
            {/* Cargo (left side) */}
            <View style={truckStyles.cargo} />
            {/* Cabin (right side) */}
            <View style={truckStyles.cabin}>
                <View style={truckStyles.window} />
            </View>
            {/* Wheels */}
            <View style={truckStyles.wheel1} />
            <View style={truckStyles.wheel2} />
        </View>
    );
};

const truckStyles = StyleSheet.create({
    truckWrapper: {
        width: 28,
        height: 18,
        flexDirection: 'row',
        alignItems: 'flex-end',
        position: 'relative',
    },
    cargo: {
        width: 14,
        height: 10,
        backgroundColor: '#F53F7A', // Pink - app theme
        borderTopLeftRadius: 2,
        borderBottomLeftRadius: 1,
    },
    cabin: {
        width: 10,
        height: 12,
        backgroundColor: '#FF8FAB', // Light pink
        borderTopRightRadius: 3,
        borderBottomRightRadius: 1,
        marginLeft: -1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 2,
    },
    window: {
        width: 5,
        height: 4,
        backgroundColor: '#FFD4E0',
        borderRadius: 1,
    },
    wheel1: {
        position: 'absolute',
        bottom: -3,
        left: 2,
        width: 5,
        height: 5,
        backgroundColor: '#333',
        borderRadius: 2.5,
    },
    wheel2: {
        position: 'absolute',
        bottom: -3,
        right: 2,
        width: 5,
        height: 5,
        backgroundColor: '#333',
        borderRadius: 2.5,
    },
    cancelledContainer: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#F44336',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

const TrackingProgressBar: React.FC<TrackingProgressBarProps> = ({ status, dates }) => {

    const normalizeStatus = (s: string) => s?.toLowerCase() || '';
    const isCancelledOrRejected = ['cancelled', 'rejected'].includes(normalizeStatus(status));

    // Determine target index
    const getTargetIndex = () => {
        const s = normalizeStatus(status);

        if (s === 'cancelled' || s === 'rejected') return 0;
        if (s === 'placed' || s === 'pending') return 0.5;
        if (s === 'confirmed' || s === 'processing') return 0.5;
        if (s === 'shipped') return 1.5;
        if (s === 'out_for_delivery') return 2.5;
        if (s === 'delivered') return 3;

        return 0;
    };

    const targetIndex = getTargetIndex();

    // Animation
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = 0;

        // Delayed start for a nice entrance effect
        progress.value = withDelay(
            400,
            withTiming(targetIndex, {
                duration: 2000, // 2 seconds
                easing: Easing.out(Easing.cubic), // Smooth deceleration
            })
        );
    }, [targetIndex]);

    // Calculate dimensions - ensure everything fits within card
    const CARD_PADDING = 16;
    const CARD_WIDTH = SCREEN_WIDTH - 32 - (CARD_PADDING * 2); // Card margins + padding
    const NODE_SIZE = 22;
    const FIRST_NODE_OFFSET = NODE_SIZE / 2;
    const LAST_NODE_OFFSET = NODE_SIZE / 2;
    const LINE_WIDTH = CARD_WIDTH - FIRST_NODE_OFFSET - LAST_NODE_OFFSET;
    const SEGMENT_WIDTH = LINE_WIDTH / (STAGES.length - 1);

    const animatedTruckStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            progress.value,
            [0, 3],
            [0, LINE_WIDTH]
        );
        return {
            transform: [{ translateX }],
        };
    });

    const animatedLineStyle = useAnimatedStyle(() => {
        const lineWidth = interpolate(
            progress.value,
            [0, 3],
            [0, LINE_WIDTH]
        );
        return {
            width: lineWidth,
        };
    });

    const formatDate = (dateString?: string) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
        });
    };

    const getCompletedIndex = () => {
        const s = normalizeStatus(status);
        if (s === 'cancelled' || s === 'rejected') return 0;
        if (s === 'placed' || s === 'pending') return 0;
        if (s === 'confirmed' || s === 'processing') return 0;
        if (s === 'shipped') return 1;
        if (s === 'out_for_delivery') return 2;
        if (s === 'delivered') return 3;
        return 0;
    };

    const completedIndex = getCompletedIndex();

    return (
        <View style={styles.container}>
            {/* Tooltip */}
            {!isCancelledOrRejected && targetIndex < 3 && (
                <Animated.View style={[styles.tooltipWrapper, animatedTruckStyle]}>
                    <View style={styles.tooltip}>
                        <View style={styles.tooltipDot} />
                        <Text style={styles.tooltipText}>
                            {targetIndex <= 0.5 ? 'Shipping Soon!' :
                                targetIndex <= 1.5 ? 'On the way!' :
                                    'Out for Delivery!'}
                        </Text>
                    </View>
                    <View style={styles.tooltipArrow} />
                </Animated.View>
            )}

            {/* Progress Track */}
            <View style={styles.trackContainer}>
                {/* Background Line */}
                <View style={[styles.backgroundLine, { width: LINE_WIDTH }]} />

                {/* Active Line (Pink) */}
                <Animated.View
                    style={[
                        styles.activeLine,
                        animatedLineStyle,
                        isCancelledOrRejected && styles.cancelledLine
                    ]}
                />

                {/* Nodes */}
                {STAGES.map((stage, index) => {
                    const isCompleted = index <= completedIndex;
                    const nodeLeft = index * SEGMENT_WIDTH;

                    let bgColor = '#E0E0E0';

                    if (isCancelledOrRejected && index === 0) {
                        bgColor = '#4CAF50';
                    } else if (isCompleted && !isCancelledOrRejected) {
                        bgColor = '#4CAF50';
                    }

                    return (
                        <View
                            key={stage.key}
                            style={[styles.nodeContainer, { left: nodeLeft }]}
                        >
                            <View style={[styles.node, { backgroundColor: bgColor }]}>
                                {(isCompleted || (isCancelledOrRejected && index === 0)) && (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                )}
                            </View>
                        </View>
                    );
                })}

                {/* Truck */}
                <Animated.View style={[styles.truckContainer, animatedTruckStyle]}>
                    <TruckIcon isCancelled={isCancelledOrRejected} />
                </Animated.View>
            </View>

            {/* Labels Row */}
            <View style={styles.labelsRow}>
                {STAGES.map((stage, index) => {
                    let dateStr: string | undefined = '';
                    if (index === 0) dateStr = dates?.ordered;
                    else if (index === 1) dateStr = dates?.shipped;
                    else if (index === 2) dateStr = dates?.outForDelivery;
                    else if (index === 3) dateStr = dates?.delivered;

                    const formattedDate = formatDate(dateStr);

                    return (
                        <View key={stage.key} style={styles.labelItem}>
                            <Text
                                style={styles.labelText}
                                numberOfLines={1}
                            >
                                {stage.label}
                            </Text>
                            <Text style={styles.dateText}>
                                {formattedDate || '--'}
                            </Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginHorizontal: 16,
        marginVertical: 8,
        paddingHorizontal: 16,
        paddingTop: 48, // Space for tooltip
        paddingBottom: 16,
        overflow: 'hidden', // Prevent overflow
    },
    tooltipWrapper: {
        position: 'absolute',
        top: 10,
        left: 16 + 11 - 50, // Centered above truck
        zIndex: 100,
    },
    tooltip: {
        backgroundColor: '#2D3748',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    tooltipDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#48BB78',
        marginRight: 6,
    },
    tooltipText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
    },
    tooltipArrow: {
        alignSelf: 'center',
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#2D3748',
    },
    trackContainer: {
        height: 24,
        position: 'relative',
        marginBottom: 8,
    },
    backgroundLine: {
        position: 'absolute',
        left: 11, // NODE_SIZE / 2
        top: 10, // Center of node
        height: 3,
        backgroundColor: '#E8E8E8',
        borderRadius: 1.5,
    },
    activeLine: {
        position: 'absolute',
        left: 11,
        top: 10,
        height: 3,
        backgroundColor: '#F53F7A', // Pink - matches app theme
        borderRadius: 1.5,
    },
    cancelledLine: {
        backgroundColor: '#FFCDD2',
    },
    nodeContainer: {
        position: 'absolute',
        top: 0,
        width: 22,
        height: 22,
        marginLeft: 0, // No offset needed, positioned at node center
    },
    node: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
    },
    truckContainer: {
        position: 'absolute',
        top: -1, // Slightly above line
        left: 11 - 14, // Center truck on starting point
        zIndex: 50,
    },
    labelsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    labelItem: {
        flex: 1,
        alignItems: 'center',
    },
    labelText: {
        fontSize: 10,
        color: '#333',
        fontWeight: '600',
        textAlign: 'center',
    },
    dateText: {
        fontSize: 9,
        color: '#888',
        textAlign: 'center',
        marginTop: 1,
    },
});

export default TrackingProgressBar;
