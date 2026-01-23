import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Toast from 'react-native-toast-message';
import { aiSupportService } from '~/services/aiSupportService';

type RootStackParamList = {
  TermsAndConditions: undefined;
  PrivacyPolicy: undefined;
  RefundPolicy: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SupportMessage {
  id: string;
  sender_type: 'user' | 'admin';
  message: string;
  created_at: string;
}

const HelpCenter = () => {
  const navigation = useNavigation<NavigationProp>();

  const [activeTab, setActiveTab] = useState('chat');
  const [message, setMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [messages, setMessages] = useState<SupportMessage[]>([
    {
      id: 'welcome-1',
      sender_type: 'admin',
      message: "Hello! Welcome to Only2U Support. How can I help you today?",
      created_at: new Date().toISOString()
    },
    {
      id: 'welcome-2',
      sender_type: 'admin',
      message: "Ask me about your orders, margins, products, or app usage.",
      created_at: new Date().toISOString()
    }
  ]);
  const [sending, setSending] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const handleSendMessage = async () => {
    if (!message?.trim()) return;

    const userMessageText = message.trim();
    const newMessage: SupportMessage = {
      id: Date.now().toString(),
      sender_type: 'user',
      message: userMessageText,
      created_at: new Date().toISOString(),
    };

    // Update local state immediately
    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      setSending(true);
      setAiTyping(true);

      // Construct history for AI context
      const history = messages.map(m => ({
        role: m.sender_type === 'user' ? 'user' : 'model',
        parts: m.message
      }));

      // Get AI Response
      const aiResponseText = await aiSupportService.generateResponse(userMessageText, history as any);

      if (aiResponseText) {
        const aiMessage: SupportMessage = {
          id: (Date.now() + 1).toString(),
          sender_type: 'admin',
          message: aiResponseText,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMessage]);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (error) {
      console.error('Error generating AI response:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to get response. Please try again.',
      });
    } finally {
      setSending(false);
      setAiTyping(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderChatSupport = () => {
    return (
      <KeyboardAvoidingView
        behavior="padding"
        style={styles.chatContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 180 : 160}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatContent}
          contentContainerStyle={styles.chatContentContainer}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender_type === 'user';
            return (
              <View
                key={msg.id}
                style={[
                  styles.messageBubble,
                  isUser ? styles.userMessage : styles.adminMessage,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    isUser ? styles.userMessageText : styles.adminMessageText,
                  ]}
                >
                  {msg.message}
                </Text>
                <Text
                  style={[
                    styles.messageTime,
                    isUser ? styles.userMessageTime : styles.adminMessageTime,
                  ]}
                >
                  {formatTime(msg.created_at)}
                </Text>
              </View>
            );
          })}
          {aiTyping && (
            <View style={[styles.messageBubble, styles.adminMessage, { width: 80 }]}>
              <ActivityIndicator size="small" color="#666" />
            </View>
          )}
        </ScrollView>

        <View style={styles.messageInputContainer}>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Type your message here..."
            placeholderTextColor="#999"
            multiline
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, (sending || aiTyping) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!message?.trim() || sending || aiTyping}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const faqs = [
    {
      question: 'How do I track my order?',
      answer: "You can track your order by going to 'My Orders' section in your profile and clicking on the specific order you want to track.",
    },
    {
      question: 'What is your return policy?',
      answer: 'We accept returns within 7 days of delivery. Items must be in original condition with tags attached.',
    },
    {
      question: 'How do I change my delivery address?',
      answer: 'You can change your delivery address before shipping by contacting customer support or updating it from your order details if the option is available.',
    },
    {
      question: 'Do you ship internationally?',
      answer: 'Yes, we ship to most countries worldwide. Shipping costs and delivery times vary by location.',
    },
  ];

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderFAQs = () => (
    <View style={styles.faqContainer}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search FAQs..."
          placeholderTextColor="#999"
        />
      </View>

      <ScrollView style={styles.faqList} showsVerticalScrollIndicator={false}>
        {filteredFaqs.map((faq, index) => (
          <View key={index} style={styles.faqItem}>
            <Text style={styles.faqQuestion}>{faq.question}</Text>
            <Text style={styles.faqAnswer}>{faq.answer}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderPolicies = () => (
    <View style={styles.policiesContainer}>
      <ScrollView style={styles.policiesList} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('TermsAndConditions')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="document-text-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Terms & Conditions</Text>
              <Text style={styles.policyDescription}>
                Read our terms and conditions for using the Only2U app
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('PrivacyPolicy')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Privacy Policy</Text>
              <Text style={styles.policyDescription}>
                Learn how we collect, use, and protect your personal information
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.policyItem}
          onPress={() => navigation.navigate('RefundPolicy')}
        >
          <View style={styles.policyContent}>
            <Ionicons name="card-outline" size={24} color="#F53F7A" />
            <View style={styles.policyText}>
              <Text style={styles.policyTitle}>Refund Policy</Text>
              <Text style={styles.policyDescription}>
                Understand our return, refund, and exchange policies
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#999" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help Center</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>
            Chat Support
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'faq' && styles.activeTab]}
          onPress={() => setActiveTab('faq')}
        >
          <Text style={[styles.tabText, activeTab === 'faq' && styles.activeTabText]}>
            FAQs
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'policies' && styles.activeTab]}
          onPress={() => setActiveTab('policies')}
        >
          <Text style={[styles.tabText, activeTab === 'policies' && styles.activeTabText]}>
            Policies
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'chat' ? renderChatSupport() : activeTab === 'faq' ? renderFAQs() : renderPolicies()}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    backgroundColor: '#fff',
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#333',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  content: {
    flex: 1,
    backgroundColor: '#fff',
  },
  chatContainer: {
    flex: 1,
    justifyContent: 'space-between',
  },
  chatContent: {
    flex: 1,
  },
  chatContentContainer: {
    padding: 16,
    paddingBottom: 20,
  },
  welcomeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  welcomeMessage: {
    fontSize: 18,
    color: '#333',
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  welcomeSubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  loginPrompt: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  loginPromptTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  loginPromptText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  loginButton: {
    backgroundColor: '#F53F7A',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 24,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#F53F7A',
    borderBottomRightRadius: 4,
  },
  adminMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#f0f0f0',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  adminMessageText: {
    color: '#333',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  userMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  adminMessageTime: {
    color: '#999',
    textAlign: 'left',
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  messageInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  messageInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#f8f9fa',
    marginRight: 12,
    maxHeight: 100,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F53F7A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  faqContainer: {
    flex: 1,
    padding: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  faqList: {
    flex: 1,
  },
  faqItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F53F7A',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  policiesContainer: {
    flex: 1,
    padding: 16,
  },
  policiesList: {
    flex: 1,
  },
  policyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  policyContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  policyText: {
    marginLeft: 12,
    flex: 1,
  },
  policyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  policyDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
});

export default HelpCenter;
