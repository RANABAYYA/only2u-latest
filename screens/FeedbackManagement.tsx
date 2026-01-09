import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    Image,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// Sample data for approval
const SAMPLE_FEEDBACKS = [
    {
        id: '1',
        user_name: 'Rahul Sharma',
        user_email: 'rahul.s@example.com',
        feedback_text: 'The app is great, but I think the try-on feature takes a bit too long to load on older devices. Would love to see some performance improvements!',
        created_at: '2025-12-24T10:30:00Z',
        status: 'pending',
        image_urls: [],
    },
    {
        id: '2',
        user_name: 'Priya Patel',
        user_email: 'priya.p@example.com',
        feedback_text: 'Found a bug in the wishlist screen. When I remove an item, it sometimes comes back after refreshing. Also attached a screenshot.',
        created_at: '2025-12-25T09:15:00Z',
        status: 'pending',
        image_urls: ['https://images.unsplash.com/photo-1551650975-87deedd944c3?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80'],
    },
    {
        id: '3',
        user_name: 'Amit Kumar',
        user_email: 'amit.k@example.com',
        feedback_text: 'Love the new collection! Can we have more filters for searching products by color?',
        created_at: '2025-12-25T14:20:00Z',
        status: 'pending',
        image_urls: [],
    },
    {
        id: '4',
        user_name: 'Sneha Gupta',
        user_email: 'sneha.g@example.com',
        feedback_text: 'The checkout process is very smooth. Good job team!',
        created_at: '2025-12-23T18:45:00Z',
        status: 'pending',
        image_urls: [],
    },
];

const FeedbackManagement = () => {
    const navigation = useNavigation();
    const [feedbacks, setFeedbacks] = useState(SAMPLE_FEEDBACKS);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const handleBackPress = () => {
        navigation.goBack();
    };

    const handleApprove = (id: string) => {
        Alert.alert(
            'Approve Feedback',
            'Are you sure you want to approve this feedback?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: () => {
                        // In a real app, make API call here
                        setFeedbacks(prev => prev.filter(item => item.id !== id));
                        Toast.show({
                            type: 'success',
                            text1: 'Approved',
                            text2: 'Feedback approved successfully',
                        });
                    },
                },
            ]
        );
    };

    const handleReject = (id: string) => {
        Alert.alert(
            'Reject Feedback',
            'Are you sure you want to reject this feedback?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: () => {
                        // In a real app, make API call here
                        setFeedbacks(prev => prev.filter(item => item.id !== id));
                        Toast.show({
                            type: 'info',
                            text1: 'Rejected',
                            text2: 'Feedback rejected',
                        });
                    },
                },
            ]
        );
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
        });
    };

    const renderItem = ({ item }: { item: typeof SAMPLE_FEEDBACKS[0] }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{item.user_name.charAt(0)}</Text>
                    </View>
                    <View>
                        <Text style={styles.userName}>{item.user_name}</Text>
                        <Text style={styles.userEmail}>{item.user_email}</Text>
                    </View>
                </View>
                <Text style={styles.date}>{formatDate(item.created_at)}</Text>
            </View>

            <Text style={styles.feedbackText}>{item.feedback_text}</Text>

            {item.image_urls && item.image_urls.length > 0 && (
                <View style={styles.imagesContainer}>
                    {item.image_urls.map((url, index) => (
                        <TouchableOpacity key={index} onPress={() => setSelectedImage(url)}>
                            <Image source={{ uri: url }} style={styles.thumbnail} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.button, styles.rejectButton]}
                    onPress={() => handleReject(item.id)}
                >
                    <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    <Text style={styles.rejectButtonText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.approveButton]}
                    onPress={() => handleApprove(item.id)}
                >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                    <Text style={styles.approveButtonText}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Feedback Approval</Text>
                <View style={styles.headerRight} />
            </View>

            {feedbacks.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="checkmark-done-circle-outline" size={64} color="#10B981" />
                    <Text style={styles.emptyTitle}>All Caught Up!</Text>
                    <Text style={styles.emptySubtitle}>No pending feedbacks for approval.</Text>
                </View>
            ) : (
                <FlatList
                    data={feedbacks}
                    renderItem={renderItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Image Modal */}
            <Modal
                visible={!!selectedImage}
                transparent={true}
                onRequestClose={() => setSelectedImage(null)}
            >
                <View style={styles.modalContainer}>
                    <TouchableOpacity
                        style={styles.closeModalButton}
                        onPress={() => setSelectedImage(null)}
                    >
                        <Ionicons name="close" size={30} color="#fff" />
                    </TouchableOpacity>
                    {selectedImage && (
                        <Image
                            source={{ uri: selectedImage }}
                            style={styles.fullImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    headerRight: {
        width: 40,
    },
    listContent: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFE4E6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    avatarText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#F43F5E',
    },
    userName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    userEmail: {
        fontSize: 12,
        color: '#6B7280',
    },
    date: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    feedbackText: {
        fontSize: 15,
        color: '#374151',
        lineHeight: 22,
        marginBottom: 12,
    },
    imagesContainer: {
        flexDirection: 'row',
        marginBottom: 16,
    },
    thumbnail: {
        width: 60,
        height: 60,
        borderRadius: 8,
        marginRight: 8,
        backgroundColor: '#E5E7EB',
    },
    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
        paddingTop: 12,
        gap: 12,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        gap: 6,
    },
    rejectButton: {
        backgroundColor: '#FEF2F2',
    },
    approveButton: {
        backgroundColor: '#ECFDF5',
    },
    rejectButtonText: {
        color: '#EF4444',
        fontWeight: '600',
        fontSize: 14,
    },
    approveButtonText: {
        color: '#10B981',
        fontWeight: '600',
        fontSize: 14,
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    closeModalButton: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
        padding: 10,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
});

export default FeedbackManagement;
