import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '~/contexts/UserContext';
import { getAllSettings, setSetting } from '~/utils/settings';
import { Setting } from '~/utils/settings';

const SettingsManagement = () => {
  const navigation = useNavigation();
  const { userData } = useUser();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Check if user is admin
  if (userData?.role !== 'admin') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={48} color="#999" />
          <Text style={styles.errorTitle}>Access Denied</Text>
          <Text style={styles.errorText}>Only administrators can manage settings.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const data = await getAllSettings();
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      Alert.alert('Error', 'Failed to fetch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSettings();
    setRefreshing(false);
  };

  const handleEdit = (setting: Setting) => {
    setEditingKey(setting.key);
    setEditValue(setting.value);
  };

  const handleSave = async () => {
    if (!editingKey || !editValue.trim()) {
      Alert.alert('Error', 'Please enter a value');
      return;
    }

    try {
      setSaving(true);
      
      const success = await setSetting(editingKey, editValue.trim());
      if (success) {
        Alert.alert('Success', 'Setting updated successfully');
      } else {
        Alert.alert('Error', 'Failed to update setting');
        return;
      }

      setEditingKey(null);
      setEditValue('');
      await fetchSettings();
    } catch (error) {
      console.error('Error saving setting:', error);
      Alert.alert('Error', 'Failed to save setting');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingKey(null);
    setEditValue('');
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleToggleMaintenanceMode = async (currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    
    Alert.alert(
      newValue === 'true' ? 'Enable Maintenance Mode?' : 'Disable Maintenance Mode?',
      newValue === 'true'
        ? 'This will block all users from accessing the app. Only admins will be able to access the app.'
        : 'Users will be able to access the app again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newValue === 'true' ? 'Enable' : 'Disable',
          style: newValue === 'true' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              setSaving(true);
              const success = await setSetting('maintenance_mode', newValue);
              if (success) {
                Alert.alert(
                  'Success',
                  `Maintenance mode ${newValue === 'true' ? 'enabled' : 'disabled'} successfully`
                );
                await fetchSettings();
              } else {
                Alert.alert('Error', 'Failed to update maintenance mode');
              }
            } catch (error) {
              console.error('Error toggling maintenance mode:', error);
              Alert.alert('Error', 'Failed to update maintenance mode');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const renderSetting = (setting: Setting) => {
    const isEditing = editingKey === setting.key;
    const isMaintenanceMode = setting.key === 'maintenance_mode';
    const isMaintenanceEnabled = setting.value === 'true';
    
    return (
      <View
        key={setting.id}
        style={[
          styles.settingItem,
          isMaintenanceMode && isMaintenanceEnabled && styles.maintenanceModeActive,
        ]}
      >
        <View style={styles.settingHeader}>
          <View style={styles.settingKeyContainer}>
            <Text style={styles.settingKey}>{setting.key}</Text>
            {isMaintenanceMode && (
              <View
                style={[
                  styles.maintenanceBadge,
                  isMaintenanceEnabled && styles.maintenanceBadgeActive,
                ]}
              >
                <Ionicons
                  name={isMaintenanceEnabled ? 'warning' : 'checkmark-circle'}
                  size={14}
                  color={isMaintenanceEnabled ? '#fff' : '#4CAF50'}
                />
                <Text
                  style={[
                    styles.maintenanceBadgeText,
                    isMaintenanceEnabled && styles.maintenanceBadgeTextActive,
                  ]}
                >
                  {isMaintenanceEnabled ? 'ACTIVE' : 'INACTIVE'}
                </Text>
              </View>
            )}
          </View>
          {!isEditing && !isMaintenanceMode && (
            <TouchableOpacity
              onPress={() => handleEdit(setting)}
              style={styles.editButton}
            >
              <Ionicons name="pencil" size={16} color="#F53F7A" />
            </TouchableOpacity>
          )}
        </View>

        {setting.description && (
          <Text style={styles.settingDescription}>{setting.description}</Text>
        )}

        {isMaintenanceMode ? (
          <View style={styles.toggleContainer}>
            <Text style={styles.toggleLabel}>
              {isMaintenanceEnabled
                ? 'App is currently in maintenance mode'
                : 'App is currently accessible'}
            </Text>
            <TouchableOpacity
              style={[
                styles.toggleSwitch,
                isMaintenanceEnabled && styles.toggleSwitchActive,
              ]}
              onPress={() => handleToggleMaintenanceMode(setting.value)}
              disabled={saving}
            >
              <View
                style={[
                  styles.toggleThumb,
                  isMaintenanceEnabled && styles.toggleThumbActive,
                ]}
              />
            </TouchableOpacity>
          </View>
        ) : isEditing ? (
          <View style={styles.editContainer}>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              placeholder="Enter value"
              multiline
            />
            <View style={styles.editActions}>
              <TouchableOpacity
                onPress={handleCancel}
                style={styles.cancelButton}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                style={[styles.saveButton, saving && styles.disabledButton]}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.settingValue}>{setting.value}</Text>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F53F7A" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings Management</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Configuration</Text>
          {settings
            .sort((a, b) => {
              // Put maintenance_mode first
              if (a.key === 'maintenance_mode') return -1;
              if (b.key === 'maintenance_mode') return 1;
              return 0;
            })
            .map(renderSetting)}
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  settingItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e1e5e9',
  },
  settingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  settingKey: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  editButton: {
    padding: 8,
  },
  settingDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  settingValue: {
    fontSize: 14,
    color: '#333',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    fontFamily: 'monospace',
  },
  editContainer: {
    marginTop: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    backgroundColor: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  saveButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 8,
  },
  saveButtonText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  settingKeyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  maintenanceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    gap: 4,
  },
  maintenanceBadgeActive: {
    backgroundColor: '#FF6B6B',
  },
  maintenanceBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4CAF50',
    textTransform: 'uppercase',
  },
  maintenanceBadgeTextActive: {
    color: '#fff',
  },
  maintenanceModeActive: {
    borderColor: '#FF6B6B',
    borderWidth: 2,
    backgroundColor: '#FFF5F5',
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    marginRight: 12,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ccc',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleSwitchActive: {
    backgroundColor: '#F53F7A',
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
});

export default SettingsManagement;
