import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

const RefundPolicy = () => {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Refund Policy</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Refund Policy</Text>
          <Text style={styles.lastUpdated}>Last updated: {new Date().toLocaleDateString()}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Overview</Text>
          <Text style={styles.text}>
            At Only2U, we strive to ensure complete customer satisfaction with every purchase. 
            This refund policy outlines the terms and conditions for refunds, returns, and exchanges 
            for products purchased through our mobile application.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Return Window</Text>
          <Text style={styles.text}>
            We accept returns within 7 days of the original purchase date. To be eligible for a return, 
            your item must be:
          </Text>
          <Text style={styles.bulletPoint}>• Unused and in the same condition as received</Text>
          <Text style={styles.bulletPoint}>• In the original packaging</Text>
          <Text style={styles.bulletPoint}>• Accompanied by the original receipt or proof of purchase</Text>
          <Text style={styles.bulletPoint}>• Not a personalized or custom-made item</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Unboxing Video Requirement</Text>
          <Text style={styles.text}>
            To ensure the integrity of returns and protect both customers and the business, we require 
            an unboxing video for all return and refund requests. This policy helps us verify the 
            condition of products upon delivery and prevents fraudulent claims.
          </Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: '600' }}>Important:</Text> An unboxing video of the original 
            order while opening the package is mandatory for processing any refund or return request.
          </Text>
          <Text style={styles.text}>
            Your unboxing video must include:
          </Text>
          <Text style={styles.bulletPoint}>• Continuous recording from the moment you receive the sealed package</Text>
          <Text style={styles.bulletPoint}>• Clear visibility of the shipping label and order number</Text>
          <Text style={styles.bulletPoint}>• Opening of the sealed package without any cuts or edits</Text>
          <Text style={styles.bulletPoint}>• Clear view of all contents inside the package</Text>
          <Text style={styles.bulletPoint}>• Any visible damages or defects on the product</Text>
          <Text style={styles.text}>
            <Text style={{ fontWeight: '600' }}>Note:</Text> Returns without a proper unboxing video 
            will not be processed. Please ensure you record the unboxing before opening your package.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Non-Returnable Items</Text>
          <Text style={styles.text}>
            The following items are not eligible for returns:
          </Text>
          <Text style={styles.bulletPoint}>• Personalized or custom-made products</Text>
          <Text style={styles.bulletPoint}>• Digital products or services</Text>
          <Text style={styles.bulletPoint}>• Items marked as "Final Sale"</Text>
          <Text style={styles.bulletPoint}>• Products that have been used, damaged, or altered</Text>
          <Text style={styles.bulletPoint}>• Gift cards</Text>
          <Text style={styles.bulletPoint}>• AI-generated content or face swap services</Text>
          <Text style={styles.bulletPoint}>• Face swap preview experiences</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Return Process</Text>
          <Text style={styles.text}>
            To initiate a return, please follow these steps:
          </Text>
          <Text style={styles.bulletPoint}>1. Contact our customer service within 7 days of purchase</Text>
          <Text style={styles.bulletPoint}>2. Provide your order number and reason for return</Text>
          <Text style={styles.bulletPoint}>3. Receive return authorization and shipping label</Text>
          <Text style={styles.bulletPoint}>4. Package the item securely with all original materials</Text>
          <Text style={styles.bulletPoint}>5. Ship the item using the provided label</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Refund Processing</Text>
          <Text style={styles.text}>
            Once we receive and inspect your return:
          </Text>
          <Text style={styles.bulletPoint}>• Refunds will be processed within 5-7 business days</Text>
          <Text style={styles.bulletPoint}>• You will receive an email confirmation</Text>
          <Text style={styles.bulletPoint}>• Refunds will be issued to the original payment method</Text>
          <Text style={styles.bulletPoint}>• Shipping costs are non-refundable unless the item was defective</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Defective Products</Text>
          <Text style={styles.text}>
            If you receive a defective product:
          </Text>
          <Text style={styles.bulletPoint}>• Contact us immediately upon discovery</Text>
          <Text style={styles.bulletPoint}>• Provide photos of the defect if possible</Text>
          <Text style={styles.bulletPoint}>• We will provide a prepaid return label</Text>
          <Text style={styles.bulletPoint}>• Full refund including shipping costs will be issued</Text>
          <Text style={styles.bulletPoint}>• Replacement will be sent at no additional cost</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>8. AI and Digital Services</Text>
          <Text style={styles.text}>
            For AI-powered features and digital services:
          </Text>
          <Text style={styles.bulletPoint}>• Face swap and AI-generated content are provided "as is"</Text>
          <Text style={styles.bulletPoint}>• No refunds for AI-generated content or face swap results</Text>
          <Text style={styles.bulletPoint}>• Technical issues with AI features will be addressed promptly</Text>
          <Text style={styles.bulletPoint}>• We are not responsible for misuse of AI-generated content</Text>
          <Text style={styles.bulletPoint}>• Face swap previews are for visualization purposes only</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>9. Exchanges</Text>
          <Text style={styles.text}>
            We offer exchanges for:
          </Text>
          <Text style={styles.bulletPoint}>• Different sizes (subject to availability)</Text>
          <Text style={styles.bulletPoint}>• Different colors (subject to availability)</Text>
          <Text style={styles.bulletPoint}>• Different styles (subject to availability)</Text>
          <Text style={styles.text}>
            Exchange requests must be made within 7 days of purchase. Shipping costs for exchanges 
            are the responsibility of the customer unless the original item was defective.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>10. Cancellations</Text>
          <Text style={styles.text}>
            Order cancellations are accepted if:
          </Text>
          <Text style={styles.bulletPoint}>• Requested within 24 hours of order placement</Text>
          <Text style={styles.bulletPoint}>• Order has not been shipped</Text>
          <Text style={styles.bulletPoint}>• Full refund will be processed immediately</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>11. International Returns</Text>
          <Text style={styles.text}>
            For international orders:
          </Text>
          <Text style={styles.bulletPoint}>• Return shipping costs are the customer's responsibility</Text>
          <Text style={styles.bulletPoint}>• Customs duties and taxes are non-refundable</Text>
          <Text style={styles.bulletPoint}>• Processing time may be extended</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>12. Contact Information</Text>
          <Text style={styles.text}>
            For questions about returns, refunds, or exchanges, please contact us:
          </Text>
          <Text style={styles.contactInfo}>Email: support@only2u.com</Text>
          <Text style={styles.contactInfo}>Phone: +91 7013580331</Text>
          <Text style={styles.contactInfo}>Hours: Monday - Friday, 9 AM - 6 PM IST</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>13. Policy Updates</Text>
          <Text style={styles.text}>
            We reserve the right to modify this refund policy at any time. Changes will be effective 
            immediately upon posting. Continued use of our services constitutes acceptance of any 
            modifications to this policy.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 34,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  lastUpdated: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 15,
  },
  text: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginLeft: 10,
    marginBottom: 5,
  },
  contactInfo: {
    fontSize: 15,
    color: '#444',
    fontWeight: '500',
    marginTop: 5,
  },
});

export default RefundPolicy; 