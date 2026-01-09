import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';

const PushNotifications = () => {
    const navigation = useNavigation();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleBackPress = () => {
        navigation.goBack();
    };

    const sendPushNotifications = async () => {
        if (!title.trim() || !body.trim()) {
            Alert.alert('Error', 'Please enter both title and body for the notification.');
            return;
        }

        setLoading(true);
        setStatus('Fetching users...');

        try {
            // 1. Fetch all users with a push token
            const { data: users, error } = await supabase
                .from('users')
                .select('expo_push_token')
                .not('expo_push_token', 'is', null);

            if (error) throw error;

            if (!users || users.length === 0) {
                setLoading(false);
                setStatus(null);
                Alert.alert('Info', 'No users found with push tokens.');
                return;
            }

            // Filter out duplicate tokens and remove null/undefined
            const tokens = [...new Set(users.map(u => u.expo_push_token).filter(t => t))];

            setStatus(`Sending to ${tokens.length} devices...`);

            // 2. Prepare messages for Expo
            const messages = tokens.map(token => ({
                to: token,
                sound: 'default',
                title,
                body,
                data: { someData: 'goes here' },
            }));

            // 3. Send via Expo API
            // Note: In production, this should be done on the backend to handle large batches and throttling.
            // Expo recommends chunking (max 100 per request).
            const chunks = [];
            for (let i = 0; i < messages.length; i += 100) {
                chunks.push(messages.slice(i, i + 100));
            }

            for (const chunk of chunks) {
                await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(chunk),
                });
            }

            setLoading(false);
            setStatus(null);
            Alert.alert('Success', `Notification sent to ${tokens.length} devices!`);
            setTitle('');
            setBody('');

        } catch (error) {
            console.error('Error sending notifications:', error);
            setLoading(false);
            setStatus(null);
            Alert.alert('Error', 'Failed to send notifications. Check console for details.');
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Push Notification</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notification Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g., New Arrival Alert!"
                        value={title}
                        onChangeText={setTitle}
                        maxLength={50}
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Notification Body</Text>
                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="e.g., Check out our latest summer collection now."
                        value={body}
                        onChangeText={setBody}
                        multiline
                        numberOfLines={4}
                        textAlignVertical="top"
                    />
                </View>

                {status && (
                    <View style={styles.statusContainer}>
                        <ActivityIndicator size="small" color="#F53F7A" />
                        <Text style={styles.statusText}>{status}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.sendButton, loading && styles.disabledButton]}
                    onPress={sendPushNotifications}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <>
                            <Ionicons name="send" size={20} color="#fff" style={styles.sendIcon} />
                            <Text style={styles.sendButtonText}>Send to All Users</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.infoContainer}>
                    <Ionicons name="information-circle-outline" size={20} color="#666" />
                    <Text style={styles.infoText}>
                        This will send a push notification to all users who have allowed notifications on their device.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 50,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    headerSpacer: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        color: '#333',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderWidth: 1,
        borderColor: '#eee',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: '#333',
    },
    textArea: {
        height: 100,
    },
    sendButton: {
        backgroundColor: '#F53F7A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        marginTop: 20,
        elevation: 2,
        shadowColor: '#F53F7A',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    disabledButton: {
        backgroundColor: '#f8a5c2',
    },
    sendIcon: {
        marginRight: 8,
    },
    sendButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    statusText: {
        marginLeft: 8,
        color: '#666',
    },
    infoContainer: {
        flexDirection: 'row',
        marginTop: 24,
        backgroundColor: '#f8f9fa',
        padding: 16,
        borderRadius: 8,
        alignItems: 'flex-start',
    },
    infoText: {
        marginLeft: 8,
        color: '#666',
        flex: 1,
        fontSize: 14,
        lineHeight: 20,
    },
});

export default PushNotifications;
