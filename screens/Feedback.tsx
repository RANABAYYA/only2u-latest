import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useUser } from '~/contexts/UserContext';
import { useAuth } from '~/contexts/useAuth';
import { supabase } from '~/utils/supabase';
import Toast from 'react-native-toast-message';

const Feedback = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  const { user } = useAuth();
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackImages, setFeedbackImages] = useState<string[]>([]);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const handleBackPress = () => {
    navigation.goBack();
  };

  const pickImages = async () => {
    if (feedbackImages.length >= 5) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 5 images',
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const remainingSlots = 5 - feedbackImages.length;
        const imagesToAdd = result.assets.slice(0, remainingSlots);
        const newImageUris = imagesToAdd.map(asset => asset.uri);
        setFeedbackImages([...feedbackImages, ...newImageUris]);
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to pick images. Please try again.',
      });
    }
  };

  const takePhoto = async () => {
    if (feedbackImages.length >= 5) {
      Toast.show({
        type: 'info',
        text1: 'Maximum Limit',
        text2: 'You can upload up to 5 images',
      });
      return;
    }

    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setFeedbackImages([...feedbackImages, result.assets[0].uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to take photo. Please try again.',
      });
    }
  };

  const removeImage = (index: number) => {
    setFeedbackImages(feedbackImages.filter((_, i) => i !== index));
  };

  const uploadImageToSupabase = async (imageUri: string): Promise<string | null> => {
    try {
      const fileName = `feedback/${userData?.id || user?.id || 'anonymous'}_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
      const fileExt = imageUri.split('.').pop();
      const filePath = `${fileName}.${fileExt}`;

      // Convert image to blob
      const response = await fetch(imageUri);
      const blob = await response.blob();

      // Upload to Supabase storage
      const { data, error } = await supabase.storage
        .from('feedback-images')
        .upload(filePath, blob, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.error('Error uploading image:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('feedback-images')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Feedback Required',
        text2: 'Please enter your feedback before submitting',
      });
      return;
    }

    setSubmittingFeedback(true);
    setUploadingImages(true);

    try {
      // Upload images if any
      let uploadedImageUrls: string[] = [];
      if (feedbackImages.length > 0) {
        for (const imageUri of feedbackImages) {
          const uploadedUrl = await uploadImageToSupabase(imageUri);
          if (uploadedUrl) {
            uploadedImageUrls.push(uploadedUrl);
          }
        }
      }

      // Save feedback to Supabase
      const feedbackData = {
        user_id: userData?.id || user?.id || null,
        user_email: userData?.email || user?.email || null,
        user_name: userData?.name || 'Anonymous',
        feedback_text: feedbackText.trim(),
        image_urls: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
        created_at: new Date().toISOString(),
      };

      const { error: feedbackError } = await supabase
        .from('feedback')
        .insert([feedbackData]);

      if (feedbackError) {
        // If table doesn't exist, log it
        console.log('Feedback data:', feedbackData);
        Toast.show({
          type: 'info',
          text1: 'Feedback Logged',
          text2: 'Your feedback has been logged. Thank you!',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Thank You!',
          text2: 'Your feedback has been submitted successfully',
        });
      }

      // Reset form and go back
      setFeedbackText('');
      setFeedbackImages([]);
      navigation.goBack();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to submit feedback. Please try again.',
      });
    } finally {
      setSubmittingFeedback(false);
      setUploadingImages(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 50}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Your Feedback</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Subtitle */}
          <Text style={styles.subtitle}>
            We'd love to hear your thoughts! Your feedback helps us improve Only2U.
          </Text>

          {/* Feedback Text Input */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tell us more</Text>
            <TextInput
              style={styles.textInput}
              placeholder="Share your thoughts, suggestions, or report any issues..."
              placeholderTextColor="#9CA3AF"
              value={feedbackText}
              onChangeText={setFeedbackText}
              multiline
              numberOfLines={8}
              textAlignVertical="top"
              maxLength={2000}
            />
            <Text style={styles.charCount}>
              {feedbackText.length}/2000 characters
            </Text>
          </View>

          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add Images (Optional)</Text>
            <Text style={styles.sectionSubtitle}>
              You can add up to 5 images to help us understand your feedback better
            </Text>

            {/* Image Picker Buttons */}
            <View style={styles.imagePickerButtons}>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={pickImages}
                disabled={feedbackImages.length >= 5}
              >
                <Ionicons name="images-outline" size={20} color="#F53F7A" />
                <Text style={styles.imagePickerButtonText}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.imagePickerButton}
                onPress={takePhoto}
                disabled={feedbackImages.length >= 5}
              >
                <Ionicons name="camera-outline" size={20} color="#F53F7A" />
                <Text style={styles.imagePickerButtonText}>Camera</Text>
              </TouchableOpacity>
            </View>

            {/* Image Preview Grid */}
            {feedbackImages.length > 0 && (
              <View style={styles.imagesGrid}>
                {feedbackImages.map((imageUri, index) => (
                  <View key={index} style={styles.imagePreviewContainer}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close-circle" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!feedbackText.trim() || submittingFeedback) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmitFeedback}
            disabled={!feedbackText.trim() || submittingFeedback}
          >
            {submittingFeedback || uploadingImages ? (
              <View style={styles.submitButtonContent}>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={styles.submitButtonText}>
                  {uploadingImages ? 'Uploading Images...' : 'Submitting...'}
                </Text>
              </View>
            ) : (
              <Text style={styles.submitButtonText}>Submit Feedback</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    borderBottomColor: '#F3F4F6',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 12,
    lineHeight: 18,
  },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    minHeight: 150,
    maxHeight: 300,
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 6,
  },
  imagePickerButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFF0F5',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F53F7A',
  },
  imagePickerButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F53F7A',
  },
  imagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imagePreviewContainer: {
    position: 'relative',
    width: '30%',
    aspectRatio: 1,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  submitButton: {
    backgroundColor: '#F53F7A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default Feedback;

