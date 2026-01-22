import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

// Custom Truck Icon
const TruckIcon = ({ isCancelled }: { isCancelled: boolean }) => {
    if (isCancelled) {
        return (
            <View style={truckStyles.cancelledContainer}>
                <Ionicons name="close" size={14} color="#fff" />
            </View>
        );
    }

    return (
        <View style={truckStyles.iconWrapper}>
            <MaterialCommunityIcons
                name="truck-fast"
                size={28}
                color="#F53F7A"
                style={{ transform: [{ rotateY: '0deg' }] }} // Face Right for L->R motion
            />
        </View>
    );
};

const truckStyles = StyleSheet.create({
    iconWrapper: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: "#F53F7A",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    cancelledContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F44336',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
});

const TrackingProgressBar: React.FC<TrackingProgressBarProps> = ({ status, dates }) => {

    const normalizeStatus = (s: string) => s?.toLowerCase() || '';
    const isCancelledOrRejected = ['cancelled', 'rejected'].includes(normalizeStatus(status));

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
    const progress = useSharedValue(0);

    useEffect(() => {
        progress.value = 0;
        progress.value = withDelay(
            400,
            withTiming(targetIndex, {
                duration: 2000,
                easing: Easing.out(Easing.cubic),
            })
        );
    }, [targetIndex]);

    const CARD_PADDING = 16;
    const CARD_WIDTH = SCREEN_WIDTH - 32 - (CARD_PADDING * 2);
    const NODE_SIZE = 20;
    const FIRST_NODE_OFFSET = NODE_SIZE / 2;
    const LAST_NODE_OFFSET = NODE_SIZE / 2;
    const LINE_WIDTH = CARD_WIDTH - FIRST_NODE_OFFSET - LAST_NODE_OFFSET;
    const SEGMENT_WIDTH = LINE_WIDTH / (STAGES.length - 1);

    const animatedTruckStyle = useAnimatedStyle(() => {
        const translateX = interpolate(progress.value, [0, 3], [0, LINE_WIDTH]);
        return { transform: [{ translateX }] };
    });

    const animatedLineStyle = useAnimatedStyle(() => {
        const lineWidth = interpolate(progress.value, [0, 3], [0, LINE_WIDTH]);
        return { width: lineWidth };
    });

    const formatDate = (dateString?: string) => {
        if (!dateString) return null;
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

            <View style={styles.trackContainer}>
                <View style={[styles.backgroundLine, { width: LINE_WIDTH }]} />
                <Animated.View
                    style={[
                        styles.activeLine,
                        animatedLineStyle,
                        isCancelledOrRejected && styles.cancelledLine
                    ]}
                />
                {STAGES.map((stage, index) => {
                    const isCompleted = index <= completedIndex;
                    const nodeLeft = index * SEGMENT_WIDTH;
                    let bgColor = '#E0E0E0';
                    let borderColor = '#E0E0E0';
                    if (isCancelledOrRejected && index === 0) {
                        bgColor = '#F44336';
                        borderColor = '#F44336';
                    } else if (isCompleted && !isCancelledOrRejected) {
                        bgColor = '#4CAF50';
                        borderColor = '#4CAF50';
                    }
                    return (
                        <View key={stage.key} style={[styles.nodeContainer, { left: nodeLeft }]}>
                            <View style={[styles.node, { backgroundColor: bgColor, borderColor: borderColor }]}>
                                {(isCompleted || (isCancelledOrRejected && index === 0)) && (
                                    <Ionicons name="checkmark" size={12} color="#fff" />
                                )}
                            </View>
                        </View>
                    );
                })}
                <Animated.View
                    style={[
                        styles.truckContainer,
                        animatedTruckStyle,
                        isCancelledOrRejected && { top: -2, left: -2 }
                    ]}
                >
                    <TruckIcon isCancelled={isCancelledOrRejected} />
                </Animated.View>
            </View>

            <View style={styles.labelsContainer}>
                {STAGES.map((stage, index) => {
                    let dateStr: string | undefined = '';
                    if (index === 0) dateStr = dates?.ordered;
                    else if (index === 1) dateStr = dates?.shipped;
                    else if (index === 2) dateStr = dates?.outForDelivery;
                    else if (index === 3) dateStr = dates?.delivered;

                    const formattedDate = formatDate(dateStr);
                    const nodeLeft = index * SEGMENT_WIDTH;

                    return (
                        <View key={stage.key} style={[styles.labelItem, { left: nodeLeft }]}>
                            <Text
                                style={[
                                    styles.labelText,
                                    index <= completedIndex && styles.labelTextActive
                                ]}
                            >
                                {stage.label}
                            </Text>
                            {formattedDate ? (
                                <Text style={[
                                    styles.dateText,
                                    index <= completedIndex && styles.dateTextActive
                                ]}>
                                    {formattedDate}
                                </Text>
                            ) : null}
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
        borderRadius: 16,
        marginHorizontal: 16,
        marginVertical: 12,
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 24,
        overflow: 'visible',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2.22,
        elevation: 3,
    },
    tooltipWrapper: {
        position: 'absolute',
        top: 10,
        left: 10 + 10 - 55,
        zIndex: 100,
        width: 110,
        alignItems: 'center',
    },
    tooltip: {
        backgroundColor: '#1A202C',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
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
        fontSize: 10,
        fontWeight: '700',
    },
    tooltipArrow: {
        width: 0,
        height: 0,
        borderLeftWidth: 5,
        borderRightWidth: 5,
        borderTopWidth: 5,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderTopColor: '#1A202C',
    },
    trackContainer: {
        height: 24,
        position: 'relative',
        marginBottom: 8,
        marginLeft: 0,
    },
    backgroundLine: {
        position: 'absolute',
        left: 10,
        top: 10 - 1.5,
        height: 3,
        backgroundColor: '#EDF2F7',
        borderRadius: 1.5,
    },
    activeLine: {
        position: 'absolute',
        left: 10,
        top: 10 - 1.5,
        height: 3,
        backgroundColor: '#FF8FAB', // Light Pink
        borderRadius: 1.5,
    },
    cancelledLine: {
        backgroundColor: '#FFCDD2',
    },
    nodeContainer: {
        position: 'absolute',
        top: 0,
        width: 20,
        height: 20,
        marginLeft: 0,
    },
    node: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#EDF2F7',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#EDF2F7',
    },
    truckContainer: {
        position: 'absolute',
        top: -6,
        left: 10 - 16,
        zIndex: 50,
    },
    labelsContainer: {
        position: 'relative',
        height: 40,
        marginTop: 4,
    },
    labelItem: {
        position: 'absolute',
        top: 0,
        width: 90,
        marginLeft: -45 + 10, // -HalfWidth + 10
        alignItems: 'center',
    },
    labelText: {
        fontSize: 11,
        color: '#718096',
        fontWeight: '600',
        textAlign: 'center',
        lineHeight: 14,
    },
    labelTextActive: {
        color: '#1A202C',
        fontWeight: '700',
    },
    dateText: {
        fontSize: 10,
        color: '#A0AEC0',
        textAlign: 'center',
        marginTop: 2,
        fontWeight: '500',
    },
    dateTextActive: {
        color: '#718096',
    }
});

export default TrackingProgressBar;
