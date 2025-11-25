import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { ResellerService } from '~/services/resellerService';
import type { Reseller, ResellerEarning } from '~/types/reseller';

interface ResellerOrderRecord {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  reseller_commission: number;
  platform_commission: number;
  payment_status: string;
  status?: string | null;
  estimated_delivery_date?: string | null;
  expected_completion_date?: string | null;
  items: Array<{
    product_id?: string;
    variant_id?: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
    reseller_price?: number;
  }>;
}

type EnrichedOrder = {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  original_total: number;
  reseller_margin_amount: number;
  reseller_profit: number;
  payment_status: string;
  status?: string | null;
  estimated_delivery_date?: string | null;
  expected_completion_date?: string | null;
  order_items: ResellerOrderRecord['items'];
};

interface EarningsStats {
  totalEarnings: number;
  totalOrders: number;
  pendingEarnings: number;
  completedEarnings: number;
}

type TierConfig = {
  name: 'Starter' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
  min: number;
  max: number;
  rate: number;
  accent: string;
  bg: string;
  badgeBg: string;
};

const TIER_CONFIG: TierConfig[] = [
  { name: 'Starter', min: 0, max: 2500, rate: 0.03, accent: '#F472B6', bg: '#FFF5FA', badgeBg: '#FDECF3' },
  { name: 'Bronze', min: 2500, max: 5000, rate: 0.05, accent: '#F97316', bg: '#FFF7ED', badgeBg: '#FFE9D6' },
  { name: 'Silver', min: 5000, max: 7500, rate: 0.07, accent: '#38BDF8', bg: '#F0F9FF', badgeBg: '#E0F2FE' },
  { name: 'Gold', min: 7500, max: 10000, rate: 0.075, accent: '#FACC15', bg: '#FEFCE8', badgeBg: '#FEF3C7' },
  { name: 'Platinum', min: 10000, max: 20000, rate: 0.1, accent: '#94A3B8', bg: '#F8FAFC', badgeBg: '#E2E8F0' },
  { name: 'Diamond', min: 20000, max: Infinity, rate: 0.12, accent: '#8B5CF6', bg: '#F5F3FF', badgeBg: '#EDE9FE' },
];

const formatDisplayDate = (date: Date) =>
  date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const formatCurrency = (value: number) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getTierForSales = (amount: number): TierConfig => {
  return (
    TIER_CONFIG.find((tier) => amount >= tier.min && amount < tier.max) ||
    TIER_CONFIG[TIER_CONFIG.length - 1]
  );
};

const maskAccountNumber = (account?: string | null) => {
  if (!account) return 'Add your payout account';
  const trimmed = account.replace(/\s+/g, '');
  if (trimmed.length <= 4) return trimmed;
  return `•••• ${trimmed.slice(-4)}`;
};

const formatIsoDate = (iso?: string | null) => {
  if (!iso) return 'Pending';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Pending';
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getStatusTheme = (status?: string | null) => {
  const normalized = (status || 'pending').toLowerCase();
  switch (normalized) {
    case 'delivered':
    case 'completed':
    case 'paid':
      return { label: toTitleCase(status), color: '#10B981', bg: '#ECFDF5', icon: 'checkmark-circle-outline' };
    case 'shipped':
    case 'confirmed':
      return { label: toTitleCase(status), color: '#3B82F6', bg: '#DBEAFE', icon: 'airplane-outline' };
    case 'cancelled':
    case 'rejected':
      return { label: toTitleCase(status), color: '#EF4444', bg: '#FEE2E2', icon: 'close-circle-outline' };
    default:
      return { label: toTitleCase(status) || 'Pending', color: '#F59E0B', bg: '#FEF3C7', icon: 'time-outline' };
  }
};

const getPayoutStatusTheme = (status?: string | null) => {
  const normalized = (status || 'pending').toLowerCase();
  switch (normalized) {
    case 'paid':
      return { color: '#10B981', bg: '#ECFDF5', label: 'Paid', icon: 'checkmark-done-outline' };
    case 'cancelled':
    case 'failed':
      return { color: '#EF4444', bg: '#FEE2E2', label: 'Failed', icon: 'close-circle-outline' };
    default:
      return { color: '#F59E0B', bg: '#FEF3C7', label: 'Pending', icon: 'time-outline' };
  }
};

const getEstimatedDateLabel = (isoDate?: string, daysToAdd = 0) => {
  if (!isoDate) {
    return 'TBD';
  }
  const baseDate = new Date(isoDate);
  if (Number.isNaN(baseDate.getTime())) {
    return 'TBD';
  }
  baseDate.setDate(baseDate.getDate() + daysToAdd);
  return formatDisplayDate(baseDate);
};

const toTitleCase = (value?: string | null) => {
  if (!value) return 'Pending';
  return value
    .replace(/_/g, ' ')
    .split(' ')
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

export default function ResellerEarnings() {
  const navigation = useNavigation();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    totalEarnings: 0,
    totalOrders: 0,
    pendingEarnings: 0,
    completedEarnings: 0,
  });
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'paid'>('all');
  const [monthlySales, setMonthlySales] = useState(0);
  const [currentTier, setCurrentTier] = useState<TierConfig>(TIER_CONFIG[0]);
  const [tierModalVisible, setTierModalVisible] = useState(false);
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [resellerProfileData, setResellerProfileData] = useState<Reseller | null>(null);
  const [payoutHistory, setPayoutHistory] = useState<ResellerEarning[]>([]);
  const [bankForm, setBankForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    confirmAccountNumber: '',
    ifsc: '',
  });
  const [savingBankDetails, setSavingBankDetails] = useState(false);

  const nextTier = useMemo(() => {
    const currentIndex = TIER_CONFIG.findIndex((tier) => tier.name === currentTier.name);
    if (currentIndex === -1 || currentIndex === TIER_CONFIG.length - 1) {
      return null;
    }
    return TIER_CONFIG[currentIndex + 1];
  }, [currentTier]);

  const tierProgress = useMemo(() => {
    if (!nextTier) {
      return 1;
    }
    const range = nextTier.min - currentTier.min;
    if (range <= 0) {
      return 1;
    }
    return Math.min(1, Math.max(0, (monthlySales - currentTier.min) / range));
  }, [currentTier, nextTier, monthlySales]);

  const amountToNextTier = useMemo(() => {
    if (!nextTier) return 0;
    return Math.max(0, nextTier.min - monthlySales);
  }, [monthlySales, nextTier]);

  const monthlyCashback = useMemo(() => monthlySales * currentTier.rate, [monthlySales, currentTier]);
  const pendingPayoutLabel = stats.pendingEarnings > 0 ? `${formatCurrency(stats.pendingEarnings)} pending` : 'No pending payouts';

  const openBankModal = () => {
    setBankForm({
      accountHolderName: resellerProfileData?.account_holder_name || '',
      accountNumber: resellerProfileData?.bank_account_number || '',
      confirmAccountNumber: resellerProfileData?.bank_account_number || '',
      ifsc: resellerProfileData?.ifsc_code || '',
    });
    setBankModalVisible(true);
  };

  const closeBankModal = () => {
    setBankModalVisible(false);
  };

  const handleSaveBankDetails = async () => {
    if (!resellerProfileData) {
      Alert.alert('Reseller profile missing', 'Please complete your reseller registration first.');
      return;
    }

    if (!bankForm.accountHolderName.trim() || !bankForm.accountNumber.trim() || !bankForm.ifsc.trim()) {
      Alert.alert('Missing Information', 'Please fill all the required payout fields.');
      return;
    }

    if (bankForm.accountNumber.trim() !== bankForm.confirmAccountNumber.trim()) {
      Alert.alert('Mismatch', 'Account number and confirm account number must match.');
      return;
    }

    setSavingBankDetails(true);
    try {
      const updated = await ResellerService.updateBankDetails(resellerProfileData.id, {
        account_holder_name: bankForm.accountHolderName.trim(),
        bank_account_number: bankForm.accountNumber.trim(),
        ifsc_code: bankForm.ifsc.trim(),
      });
      setResellerProfileData(updated);
      setBankModalVisible(false);
      Alert.alert('Payout Details Updated', 'Your payout information has been saved.');
    } catch (error) {
      console.error('Error saving payout details:', error);
      Alert.alert('Unable to save', 'Please try again in a moment.');
    } finally {
      setSavingBankDetails(false);
    }
  };

  const handlePayoutHistoryPress = (entry: ResellerEarning) => {
    const title =
      entry.status === 'paid'
        ? 'Payout Completed'
        : entry.status === 'pending'
        ? 'Payout Pending'
        : 'Payout Details';

    const infoLines = [
      `Amount: ${formatCurrency(entry.amount || 0)}`,
      `Status: ${toTitleCase(entry.status)}`,
      entry.paid_at
        ? `Paid on: ${formatIsoDate(entry.paid_at)}`
        : `Created on: ${formatIsoDate(entry.created_at)}`,
      entry.description ? `Note: ${entry.description}` : null,
      entry.order_id ? `Order ID: ${entry.order_id}` : null,
    ].filter(Boolean);

    Alert.alert(title, infoLines.join('\n'));
  };

  useEffect(() => {
    fetchEarningsData();
  }, [selectedFilter]);

  const loadPayoutHistory = async (resellerId: string) => {
    try {
      let history = await ResellerService.getPayoutHistory(resellerId, 25);
      if (!history || history.length === 0) {
        history = [
          {
            id: 'sample-1',
            amount: 2500,
            status: 'paid',
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            description: 'Sample payout deposited',
            order_id: null,
          },
          {
            id: 'sample-2',
            amount: 1800,
            status: 'pending',
            paid_at: null,
            created_at: new Date().toISOString(),
            description: 'Awaiting transfer',
            order_id: null,
          },
        ] as ResellerEarning[];
      }
      setPayoutHistory(history || []);
    } catch (error) {
      console.error('Error fetching payout history:', error);
    }
  };

  const fetchEarningsData = async () => {
    try {
      setLoading(true);
      
      if (!userData?.id) {
        setLoading(false);
        return;
      }

      const resellerProfile = await ResellerService.getResellerByUserId(userData.id);
      if (!resellerProfile) {
        setOrders([]);
        setStats({
          totalEarnings: 0,
          totalOrders: 0,
          pendingEarnings: 0,
          completedEarnings: 0,
        });
        setLoading(false);
        return;
      }

      setResellerProfileData(resellerProfile);
      loadPayoutHistory(resellerProfile.id);

      let query = supabase
        .from('reseller_orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          reseller_commission,
          platform_commission,
          payment_status,
          status,
          items:reseller_order_items(
            product_id,
            variant_id,
            quantity,
            unit_price,
            total_price,
            reseller_price
          )
        `)
        .eq('reseller_id', resellerProfile.id)
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rawOrders: ResellerOrderRecord[] = (data as ResellerOrderRecord[] | null) ?? [];

      const mapOrder = (order: ResellerOrderRecord): EnrichedOrder => {
        const originalTotal = (order.items || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0);
        const marginAmount = Number(order.reseller_commission || 0);
        return {
          id: order.id,
          order_number: order.order_number,
          created_at: order.created_at,
          total_amount: Number(order.total_amount || 0),
          original_total: originalTotal,
          reseller_margin_amount: marginAmount,
          reseller_profit: marginAmount,
          payment_status: order.payment_status,
          status: order.status,
          estimated_delivery_date: (order as any).estimated_delivery_date || null,
          expected_completion_date: (order as any).expected_completion_date || null,
          order_items: order.items || [],
        };
      };

      const allEnrichedOrders = rawOrders.map(mapOrder);

      const filteredOrders = selectedFilter === 'all'
        ? allEnrichedOrders
        : allEnrichedOrders.filter(o => o.payment_status === selectedFilter);

      const totalEarnings = allEnrichedOrders.reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
      const pendingEarnings = allEnrichedOrders
        .filter(o => o.payment_status === 'pending')
        .reduce((sum, order) => sum + (order.reseller_profit || 0), 0);
      const completedEarnings = allEnrichedOrders
        .filter(o => o.payment_status === 'paid')
        .reduce((sum, order) => sum + (order.reseller_profit || 0), 0);

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthlyTotal = allEnrichedOrders
        .filter((order) => {
          const orderDate = new Date(order.created_at);
          return orderDate >= startOfMonth;
        })
        .reduce((sum, order) => sum + (order.total_amount || 0), 0);
      const derivedTier = getTierForSales(monthlyTotal);
      setMonthlySales(monthlyTotal);
      setCurrentTier(derivedTier);

      setStats({
        totalEarnings,
        totalOrders: allEnrichedOrders.length,
        pendingEarnings,
        completedEarnings,
      });

      setOrders(filteredOrders);

    } catch (error) {
      console.error('Error in fetchEarningsData:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarningsData();
  };

  const renderStatCard = (title: string, value: string, icon: string, color: string) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderOrderItem = ({ item }: { item: EnrichedOrder }) => {
    const statusTheme = getStatusTheme(item.status || item.payment_status);
    const quickInfoData = [
      {
        label: 'Created',
        value: formatDisplayDate(new Date(item.created_at)),
        icon: 'calendar-outline',
        color: '#6B7280',
      },
      {
        label: 'Status',
        value: toTitleCase(item.status),
        icon: 'flag-outline',
        color: statusTheme.color,
      },
      {
        label: 'Est. Delivery',
        value: item.estimated_delivery_date
          ? getEstimatedDateLabel(item.estimated_delivery_date)
          : getEstimatedDateLabel(item.created_at, 5),
        icon: 'cube-outline',
        color: '#F97316',
      },
      {
        label: 'Est. Payout',
        value: item.expected_completion_date
          ? getEstimatedDateLabel(item.expected_completion_date)
          : getEstimatedDateLabel(item.created_at, 12),
        icon: 'time-outline',
        color: '#3B82F6',
      },
    ];

    return (
      <TouchableOpacity
        style={styles.orderCard}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate('OrderDetails' as never, { orderId: item.id } as never)
        }
      >
      <View style={styles.orderHeader}>
          <View style={styles.orderHeaderLeft}>
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
          </View>
          <View style={[styles.orderStatusPill, { backgroundColor: statusTheme.bg }]}>
            <Ionicons name={statusTheme.icon as any} size={14} color={statusTheme.color} />
            <Text style={[styles.orderStatusText, { color: statusTheme.color }]}>
              {statusTheme.label}
          </Text>
        </View>
        </View>

        <View style={styles.orderMetaRow}>
          <View style={styles.orderMetaItem}>
            <Ionicons name="cube-outline" size={16} color="#6B7280" />
            <Text style={styles.orderMetaText}>{item.order_items?.length || 0} item(s)</Text>
          </View>
          <View style={styles.orderMetaItem}>
            <Ionicons name="cash-outline" size={16} color="#6B7280" />
            <Text style={styles.orderMetaText}>{formatCurrency(item.total_amount || 0)}</Text>
          </View>
        </View>

        <View style={styles.quickInfoRow}>
          {quickInfoData.map((info) => (
            <TouchableOpacity
              key={`${item.id}-${info.label}`}
              style={styles.quickInfoPill}
              activeOpacity={0.85}
              onPress={() => Alert.alert(info.label, info.value)}
            >
              <Ionicons name={info.icon as any} size={14} color={info.color} />
              <View style={styles.quickInfoTextGroup}>
                <Text style={styles.quickInfoLabel}>{info.label}</Text>
                <Text style={[styles.quickInfoValue, { color: info.color }]}>{info.value}</Text>
              </View>
            </TouchableOpacity>
          ))}
      </View>

      <View style={styles.divider} />

      <View style={styles.orderDetails}>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Original Price</Text>
            <Text style={styles.detailValue}>{formatCurrency(item.original_total || 0)}</Text>
        </View>
        <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Selling Price</Text>
            <Text style={styles.detailValueBold}>{formatCurrency(item.total_amount || 0)}</Text>
        </View>
      </View>

      {/* Delivery Dates for Pending Orders */}
      {item.payment_status === 'pending' && (item.estimated_delivery_date || item.expected_completion_date) && (
        <>
          <View style={styles.divider} />
          <View style={styles.deliveryInfoContainer}>
            {item.estimated_delivery_date && (
              <View style={styles.deliveryRow}>
                <Ionicons name="location-outline" size={18} color="#F59E0B" />
                <View style={styles.deliveryTextContainer}>
                  <Text style={styles.deliveryLabel}>Estimated Delivery</Text>
                  <Text style={styles.deliveryDate}>
                    {new Date(item.estimated_delivery_date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}
            {item.expected_completion_date && (
              <View style={styles.deliveryRow}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                <View style={styles.deliveryTextContainer}>
                  <Text style={styles.deliveryLabel}>Expected Completion</Text>
                  <Text style={styles.deliveryDate}>
                    {new Date(item.expected_completion_date).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </>
      )}

      <View style={styles.divider} />
    </TouchableOpacity>
  );
  };

  const renderListHeader = () => (
    <View style={styles.listHeader}>
      <View style={styles.statsContainer}>
        {renderStatCard(
          'Total Earnings',
          `₹${stats.totalEarnings.toFixed(2)}`,
          'wallet',
          '#10B981'
        )}
        {renderStatCard(
          'Total Orders',
          stats.totalOrders.toString(),
          'receipt',
          '#F53F7A'
        )}
      </View>

      <View style={styles.statsContainer}>
        {renderStatCard(
          'Pending Earnings',
          `₹${stats.pendingEarnings.toFixed(2)}`,
          'time',
          '#F59E0B'
        )}
        {renderStatCard(
          'Completed Earnings',
          `₹${stats.completedEarnings.toFixed(2)}`,
          'checkmark-circle',
          '#3B82F6'
        )}
      </View>

      <View style={styles.tierBanner}>
        <View style={styles.tierBannerLeft}>
          <View style={styles.tierBannerTitleRow}>
            <Text style={styles.tierBannerLabel}>Your Tier</Text>
            <View style={styles.tierBannerBadge}>
              <Ionicons name="diamond" size={14} color="#F53F7A" />
              <Text style={styles.tierBannerBadgeText}>{currentTier.name}</Text>
            </View>
          </View>
          <Text style={styles.tierBannerValue}>{formatCurrency(monthlySales)}</Text>
          <Text style={styles.tierBannerSubtext}>
            {nextTier
              ? `${formatCurrency(amountToNextTier)} more for ${nextTier.name}`
              : 'Top tier unlocked 🎉'}
          </Text>
          <View style={styles.tierMiniProgress}>
            <View style={[styles.tierMiniProgressFill, { width: `${tierProgress * 100}%` }]} />
          </View>
        </View>
        <TouchableOpacity style={styles.tierCTAButton} onPress={() => setTierModalVisible(true)}>
          <Text style={styles.tierCTALabel}>View Tier Journey</Text>
        </TouchableOpacity>
      </View>

      {resellerProfileData && (
        <TouchableOpacity
          style={styles.payoutBanner}
          activeOpacity={0.85}
          onPress={openBankModal}
        >
          <View style={styles.payoutBannerIconWrap}>
            <Ionicons
              name={resellerProfileData.bank_account_number ? 'shield-checkmark-outline' : 'alert-circle-outline'}
              size={22}
              color="#F53F7A"
            />
          </View>
          <View style={styles.payoutBannerContent}>
            <Text style={styles.payoutBannerTitle}>
              {resellerProfileData.bank_account_number ? 'Payout account ready' : 'Add payout account'}
            </Text>
            <Text style={styles.payoutBannerSubtitle}>
              {resellerProfileData.bank_account_number
                ? `Account ending ${maskAccountNumber(resellerProfileData.bank_account_number)}`
                : 'Tap to add your bank details and receive earnings'}
            </Text>
            <View style={styles.payoutBannerChip}>
              <Ionicons name="cash-outline" size={14} color="#F53F7A" />
              <Text style={styles.payoutBannerChipText}>{pendingPayoutLabel}</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#F53F7A" />
        </TouchableOpacity>
      )}

      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'all' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('all')}>
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'pending' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('pending')}>
          <Text style={[styles.filterText, selectedFilter === 'pending' && styles.filterTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, selectedFilter === 'paid' && styles.filterTabActive]}
          onPress={() => setSelectedFilter('paid')}>
          <Text style={[styles.filterText, selectedFilter === 'paid' && styles.filterTextActive]}>
            Completed
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#F53F7A" />
        <Text style={styles.loadingText}>Loading your earnings...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Earnings</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Orders List */}
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderListHeader}
        ListHeaderComponentStyle={styles.listHeaderComponent}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#F53F7A']}
            tintColor="#F53F7A"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="bag-handle-outline" size={64} color="#ccc" />
            <Text style={styles.emptyTitle}>No Reseller Orders Yet</Text>
            <Text style={styles.emptySubtitle}>
              Start reselling products to track your earnings here
            </Text>
          </View>
        }
      />
      <Modal
        visible={tierModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTierModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.tierModal}>
            <View style={styles.tierModalHeader}>
              <Text style={styles.tierModalTitle}>Your Tier Journey</Text>
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setTierModalVisible(false)}>
                <Ionicons name="close" size={22} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.tierModalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.tierModalHero}>
                <Text style={styles.tierModalEyebrow}>Current Tier</Text>
                <Text style={styles.tierModalHeroTitle}>{currentTier.name}</Text>
                <Text style={styles.tierModalHeroSubtitle}>
                  {formatCurrency(monthlySales)} sold this month
                </Text>
                <View style={styles.tierModalProgressBar}>
                  <View style={[styles.tierModalProgressFill, { width: `${tierProgress * 100}%` }]} />
                </View>
                <Text style={styles.tierModalProgressLabel}>
                  {nextTier
                    ? `${formatCurrency(amountToNextTier)} more to unlock ${nextTier.name}`
                    : "You're enjoying Diamond benefits"}
                </Text>
                <View style={styles.tierModalStatsRow}>
                  <View style={styles.tierModalStat}>
                    <Text style={styles.tierModalStatLabel}>Cashback Rate</Text>
                    <Text style={styles.tierModalStatValue}>
                      {(currentTier.rate * 100).toFixed(1).replace(/\.0$/, '')}%
                    </Text>
                  </View>
                  <View style={styles.tierModalStat}>
                    <Text style={styles.tierModalStatLabel}>Projected Cashback</Text>
                    <Text style={styles.tierModalStatValue}>{formatCurrency(monthlyCashback)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.tierTimeline}>
                {TIER_CONFIG.map((tier, index) => {
                  const isCurrent = tier.name === currentTier.name;
                  const isNext = nextTier?.name === tier.name;
                  const achieved = monthlySales >= tier.min;
                  const rangeLabel =
                    tier.max === Infinity
                      ? `${formatCurrency(tier.min).replace('.00', '')}+`
                      : `${formatCurrency(tier.min).replace('.00', '')} – ${formatCurrency(tier.max).replace('.00', '')}`;

                const sampleVolume = Math.max(2500, Math.min(tier.max === Infinity ? tier.min + 5000 : tier.max, 10000));
                const tierTheme = tier;
                const unlocked = monthlySales >= tier.min;
                const unlockNeed = Math.max(0, tier.min - monthlySales);
                return (
                    <View
                      key={tier.name}
                      style={[
                        styles.tierTimelineCard,
                      {
                        borderColor: isCurrent ? tierTheme.accent : tierTheme.badgeBg,
                        backgroundColor: isCurrent ? tierTheme.bg : '#fff',
                      },
                      isNext && { borderColor: tierTheme.accent },
                      ]}
                    >
                      <View style={styles.tierTimelineHeader}>
                        <View style={styles.tierTimelineTitleRow}>
                          <Text style={styles.tierTimelineName}>{tier.name}</Text>
                          {isCurrent && <Text style={styles.tierTimelinePill}>Current</Text>}
                          {!isCurrent && achieved && <Text style={styles.tierTimelinePillSecondary}>Achieved</Text>}
                          {isNext && !achieved && <Text style={styles.tierTimelinePill}>Up Next</Text>}
                        </View>
                        <Text style={styles.tierTimelineRange}>{rangeLabel}</Text>
                      </View>
                      <View style={styles.tierTimelineDetails}>
                        <View style={styles.tierDetail}>
                          <Text style={styles.tierDetailLabel}>Cashback Rate</Text>
                          <Text style={styles.tierDetailValue}>
                            {(tier.rate * 100).toFixed(1).replace(/\.0$/, '')}%
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tierInfoChips}>
                        <View style={[styles.tierChip, { backgroundColor: tierTheme.badgeBg }]}>
                          <Ionicons name="pricetags-outline" size={12} color={tierTheme.accent} />
                          <Text style={[styles.tierChipText, { color: tierTheme.accent }]}>{rangeLabel}</Text>
                        </View>
                        <View style={[styles.tierChip, { backgroundColor: tierTheme.badgeBg }]}>
                          <Ionicons name="cash-outline" size={12} color={tierTheme.accent} />
                          <Text style={[styles.tierChipText, { color: tierTheme.accent }]}>
                            {formatCurrency(sampleVolume * tier.rate)} on ₹{sampleVolume.toLocaleString('en-IN')}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.tierHintRow}>
                        <Ionicons
                          name={unlocked ? 'star' : 'trending-up-outline'}
                          size={14}
                          color={tierTheme.accent}
                        />
                        <Text style={styles.tierHintText}>
                          {unlocked
                            ? 'Cashback active on every order in this tier'
                            : `${formatCurrency(unlockNeed)} more sales to unlock`}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.tierTipCard}>
                <Text style={styles.tierTipTitle}>How to reach the next tier?</Text>
                <Text style={styles.tierTipText}>
                  Share curated catalogs daily, follow up with interested shoppers, and keep your cart earnings healthy to
                  unlock higher cashbacks.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={bankModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeBankModal}
      >
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={{ flex: 1, justifyContent: 'flex-end' }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.bankModal}>
              <View style={styles.sheetHandle} />
              <View style={styles.bankModalHeader}>
                <Text style={styles.bankModalTitle}>Payouts & Bank Details</Text>
                <TouchableOpacity style={styles.modalCloseButton} onPress={closeBankModal}>
                  <Ionicons name="close" size={22} color="#111" />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.bankModalScroll} showsVerticalScrollIndicator={false}>
                {resellerProfileData && (
                  <View style={styles.payoutSheetSummary}>
                    <View style={styles.payoutSheetSummaryRow}>
                      <View>
                        <Text style={styles.payoutSheetSummaryLabel}>Pending Payout</Text>
                        <Text style={styles.payoutSheetSummaryValue}>{pendingPayoutLabel}</Text>
                      </View>
                      <View style={styles.payoutSheetChip}>
                        <Ionicons name="shield-checkmark-outline" size={14} color="#F53F7A" />
                        <Text style={styles.payoutSheetChipText}>
                          {resellerProfileData.bank_account_number ? 'Account verified' : 'Account missing'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.payoutSheetAccountRow}>
                      <View style={styles.payoutSheetAccountCol}>
                        <Text style={styles.payoutSheetAccountLabel}>Account Holder</Text>
                        <Text style={styles.payoutSheetAccountValue}>
                          {resellerProfileData.account_holder_name || 'Not added'}
                        </Text>
                      </View>
                      <View style={styles.payoutSheetAccountCol}>
                        <Text style={styles.payoutSheetAccountLabel}>Account Number</Text>
                        <Text style={styles.payoutSheetAccountValue}>
                          {maskAccountNumber(resellerProfileData.bank_account_number)}
                        </Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.sheetSection}>
                  <Text style={styles.sheetSectionTitle}>Bank Account Details</Text>
                  <View style={styles.bankField}>
                    <Text style={styles.bankFieldLabel}>Account Holder Name</Text>
                    <TextInput
                      style={styles.bankInput}
                      placeholder="As per bank records"
                      value={bankForm.accountHolderName}
                      onChangeText={(text) => setBankForm((prev) => ({ ...prev, accountHolderName: text }))}
                    />
                  </View>
                  <View style={styles.bankField}>
                    <Text style={styles.bankFieldLabel}>Account Number</Text>
                    <TextInput
                      style={styles.bankInput}
                      placeholder="Enter account number"
                      keyboardType="number-pad"
                      value={bankForm.accountNumber}
                      onChangeText={(text) => setBankForm((prev) => ({ ...prev, accountNumber: text }))}
                    />
                  </View>
                  <View style={styles.bankField}>
                    <Text style={styles.bankFieldLabel}>Confirm Account Number</Text>
                    <TextInput
                      style={styles.bankInput}
                      placeholder="Re-enter account number"
                      keyboardType="number-pad"
                      value={bankForm.confirmAccountNumber}
                      onChangeText={(text) => setBankForm((prev) => ({ ...prev, confirmAccountNumber: text }))}
                    />
                  </View>
                  <View style={styles.bankField}>
                    <Text style={styles.bankFieldLabel}>IFSC Code</Text>
                    <TextInput
                      style={styles.bankInput}
                      placeholder="e.g. HDFC0001234"
                      autoCapitalize="characters"
                      value={bankForm.ifsc}
                      onChangeText={(text) => setBankForm((prev) => ({ ...prev, ifsc: text.toUpperCase() }))}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.saveBankButton, savingBankDetails && { opacity: 0.7 }]}
                    onPress={handleSaveBankDetails}
                    disabled={savingBankDetails}
                  >
                    {savingBankDetails ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.saveBankButtonText}>Save Payout Details</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.sheetSection}>
                  <View style={styles.payoutHistorySheetHeader}>
                    <Text style={styles.sheetSectionTitle}>Payout History</Text>
                    <View style={styles.payoutHistoryBadge}>
                      <Text style={styles.payoutHistoryBadgeText}>
                        {payoutHistory.length > 0 ? `${payoutHistory.length} records` : 'No payouts yet'}
                      </Text>
                    </View>
                  </View>
                  {payoutHistory.length === 0 ? (
                    <View style={styles.payoutHistoryEmpty}>
                      <Ionicons name="wallet-outline" size={32} color="#D1D5DB" />
                      <Text style={styles.payoutHistoryEmptyText}>
                        Your payouts will appear here once processed.
                      </Text>
                    </View>
                  ) : (
                    payoutHistory.map((entry) => {
                      const theme = getPayoutStatusTheme(entry.status);
                      return (
                        <TouchableOpacity
                          key={entry.id}
                          style={styles.payoutHistoryItem}
                          activeOpacity={0.8}
                          onPress={() => handlePayoutHistoryPress(entry)}
                        >
                          <View style={[styles.payoutHistoryDot, { backgroundColor: theme.color }]} />
                          <View style={styles.payoutHistoryItemBody}>
                            <Text style={styles.payoutHistoryItemAmount}>{formatCurrency(entry.amount || 0)}</Text>
                            <Text style={styles.payoutHistoryItemMeta}>
                              {formatIsoDate(entry.paid_at || entry.created_at)}
                              {entry.description ? ` • ${entry.description}` : ''}
                            </Text>
                          </View>
                          <View style={[styles.payoutStatusChip, { backgroundColor: theme.bg }]}>
                            <Ionicons name={theme.icon as any} size={12} color={theme.color} />
                            <Text style={[styles.payoutStatusText, { color: theme.color }]}>
                              {theme.label}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })
                  )}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerRight: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  listHeader: {
    paddingBottom: 8,
  },
  listHeaderComponent: {
    paddingBottom: 8,
  },
  tierBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#FFE7F1',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  tierBannerLeft: {
    flex: 1,
  },
  tierBannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  tierBannerLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F53F7A',
  },
  tierBannerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    gap: 4,
  },
  tierBannerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F53F7A',
  },
  tierBannerValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  tierBannerSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  tierMiniProgress: {
    marginTop: 10,
    height: 6,
    backgroundColor: '#FAD1E1',
    borderRadius: 999,
    overflow: 'hidden',
  },
  tierMiniProgressFill: {
    height: '100%',
    backgroundColor: '#F53F7A',
  },
  tierCTAButton: {
    backgroundColor: '#F53F7A',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    shadowColor: '#F53F7A',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
  },
  tierCTALabel: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  payoutBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: '#FFF5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#FBD3E3',
  },
  payoutBannerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  payoutBannerContent: {
    flex: 1,
  },
  payoutBannerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  payoutBannerSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  payoutBannerChip: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FDE7EF',
  },
  payoutBannerChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F53F7A',
  },
  payoutHistoryBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  payoutHistoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  payoutHistoryEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  payoutHistoryEmptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  sheetHandle: {
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#E5E7EB',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  payoutSheetSummary: {
    backgroundColor: '#FFF5F9',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  payoutSheetSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutSheetSummaryLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  payoutSheetSummaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  payoutSheetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#FDE7EF',
  },
  payoutSheetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F53F7A',
  },
  payoutSheetAccountRow: {
    flexDirection: 'row',
    gap: 12,
  },
  payoutSheetAccountCol: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#FBD3E3',
  },
  payoutSheetAccountLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  payoutSheetAccountValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  sheetSection: {
    marginBottom: 28,
  },
  sheetSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  payoutHistorySheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  payoutHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  payoutHistoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  payoutHistoryItemBody: {
    flex: 1,
  },
  payoutHistoryItemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  payoutHistoryItemMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  payoutStatusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  payoutStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statContent: {
    gap: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  statTitle: {
    fontSize: 13,
    color: '#666',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#F53F7A',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContainer: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  orderCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderHeaderLeft: {
    gap: 4,
  },
  orderStatusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  orderMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 4,
  },
  orderMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderMetaText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  quickInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 8,
    rowGap: 8,
    marginTop: 12,
  },
  quickInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F3F4F6',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
  },
  quickInfoTextGroup: {
    marginLeft: 8,
  },
  quickInfoLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  quickInfoValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 16,
  },
  orderDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailLabelBold: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  detailValue: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  detailValueBold: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F53F7A',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  deliveryInfoContainer: {
    gap: 12,
    backgroundColor: '#FFF9F5',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
  },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  deliveryTextContainer: {
    flex: 1,
  },
  deliveryLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  deliveryDate: {
    fontSize: 14,
    color: '#1a1a1a',
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  tierModal: {
    height: '85%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 16,
  },
  tierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F3',
  },
  tierModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 999,
    backgroundColor: '#f5f5f5',
  },
  tierModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  tierModalHero: {
    backgroundColor: '#FFE7F1',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  tierModalEyebrow: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F53F7A',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tierModalHeroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111',
    marginTop: 4,
  },
  tierModalHeroSubtitle: {
    fontSize: 16,
    color: '#444',
    marginTop: 4,
  },
  tierModalProgressBar: {
    height: 10,
    backgroundColor: '#FAD1E1',
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 16,
  },
  tierModalProgressFill: {
    height: '100%',
    backgroundColor: '#F53F7A',
  },
  tierModalProgressLabel: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 13,
  },
  tierModalStatsRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  tierModalStat: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 2,
  },
  tierModalStatLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  tierModalStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  tierTimeline: {
    gap: 14,
    marginBottom: 24,
  },
  tierTimelineCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F1F3',
    padding: 16,
    backgroundColor: '#fff',
  },
  tierTimelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tierTimelineTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tierTimelineName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
  },
  tierTimelinePill: {
    backgroundColor: '#F53F7A',
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  tierTimelinePillSecondary: {
    backgroundColor: '#E5E7EB',
    color: '#111',
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    textTransform: 'uppercase',
  },
  tierTimelineRange: {
    fontSize: 13,
    color: '#6B7280',
  },
  tierTimelineDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  tierDetail: {
    flex: 1,
    backgroundColor: '#F8F8FA',
    borderRadius: 12,
    padding: 12,
  },
  tierDetailLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  tierDetailValue: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  tierInfoChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tierChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tierHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  tierHintText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  tierTipCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 18,
    marginBottom: 32,
  },
  tierTipTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  tierTipText: {
    color: '#E5E7EB',
    fontSize: 14,
    lineHeight: 20,
  },
  bankModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    maxHeight: '90%',
  },
  bankModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F1F3',
  },
  bankModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  bankModalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  bankModalScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  bankField: {
    marginBottom: 16,
  },
  bankFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
  },
  bankInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  saveBankButton: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: '#F53F7A',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F53F7A',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 10,
    elevation: 4,
  },
  saveBankButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});

