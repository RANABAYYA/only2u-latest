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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '~/types/navigation';
import { supabase } from '~/utils/supabase';
import { useUser } from '~/contexts/UserContext';
import { ResellerService } from '~/services/resellerService';
import type { Reseller, ResellerEarning } from '~/types/reseller';

interface ResellerOrderRecord {
  id: string;
  order_number: string;
  created_at: string;
  total_amount: number;
  reseller_margin_percentage?: number;
  reseller_margin_amount?: number;
  original_total?: number;
  reseller_profit?: number;
  payment_status: string;
  status?: string | null;
  estimated_delivery_date?: string | null;
  expected_completion_date?: string | null;
  items: Array<{
    id?: string;
    product_id?: string;
    variant_id?: string;
    product_name?: string;
    product_image?: string;
    size?: string;
    color?: string;
    quantity: number;
    unit_price?: number;
    total_price?: number;
  }>;
}

// Flattened item for individual display (similar to MyOrders pattern)
interface FlattenedEarningItem {
  // Order info
  orderId: string;
  orderNumber: string;
  createdAt: string;
  orderStatus: string;
  paymentStatus: string;
  estimatedDeliveryDate?: string | null;
  expectedCompletionDate?: string | null;

  // Item info
  itemId?: string;
  productId?: string;
  productName: string;
  productImage?: string;
  size?: string;
  color?: string;
  quantity: number;

  // Pricing
  itemBasePrice: number;
  itemSellingPrice: number;
  itemProfit: number;
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
  const navigation = useNavigation<StackNavigationProp<RootStackParamList>>();
  const { userData } = useUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<FlattenedEarningItem[]>([]);
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

      console.log('[YourEarnings] Fetching earnings for user:', userData.id);

      // IMPORTANT: Use ensureResellerForUser to auto-create profile if missing
      // This prevents the screen from being blank if they've never registered but placed correct orders
      let resellerProfile: Reseller | null = null;
      try {
        resellerProfile = await ResellerService.ensureResellerForUser(userData.id);
      } catch (e) {
        console.error('[YourEarnings] Failed to ensure reseller profile:', e);
        // Fallback: try simple get
        resellerProfile = await ResellerService.getResellerByUserId(userData.id);
      }

      if (!resellerProfile) {
        console.log('[YourEarnings] No reseller profile found even after ensure');
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
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          total_amount,
          reseller_margin_percentage,
          reseller_margin_amount,
          reseller_profit,
          original_total,
          payment_status,
          status,
          items:order_items(
            id,
            product_id,
            product_name,
            product_image,
            size,
            color,
            quantity,
            unit_price,
            total_price
          )
        `)
        .eq('user_id', userData.id)
        .eq('is_reseller_order', true)
        .order('created_at', { ascending: false });

      // DEBUG: Fetch ALL orders count to compare
      const { count: allOrdersCount, error: countError } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userData.id);

      console.log('[YourEarnings] Total orders (any type):', allOrdersCount);
      if (countError) console.error('[YourEarnings] Count error:', countError);

      const { data, error } = await query;
      if (error) {
        throw error;
      }

      const rawOrders: ResellerOrderRecord[] = (data as ResellerOrderRecord[] | null) ?? [];
      console.log('[YourEarnings] Fetched orders count:', rawOrders.length);

      // Flatten orders into individual items (similar to MyOrders pattern)
      const flattenOrders = (orders: ResellerOrderRecord[]): FlattenedEarningItem[] => {
        const flattenedItems: FlattenedEarningItem[] = [];

        orders.forEach(order => {
          const orderTotalAmount = Number(order.total_amount || 0);
          const orderOriginalTotal = Number(order.original_total || 0);
          // Calculate profit: use reseller_profit, fallback to margin_amount, then calculate from totals
          let orderProfit = Number(order.reseller_profit || order.reseller_margin_amount || 0);
          // If profit is 0 but we have total and original, calculate profit from difference
          if (orderProfit === 0 && orderTotalAmount > 0 && orderOriginalTotal > 0) {
            orderProfit = orderTotalAmount - orderOriginalTotal;
          }
          const itemsCount = order.items?.length || 1;

          // Calculate profit margin per unit to match OrderDetails logic
          const totalItemsCount = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 1;
          const marginPerUnit = totalItemsCount > 0 ? orderProfit / totalItemsCount : 0;

          order.items?.forEach((item, index) => {
            const quantity = item.quantity || 1;
            // In reseller orders, unit_price is the Selling Price (what customer paid)
            const unitSellingPrice = Number(item.unit_price || 0);
            const unitBasePrice = unitSellingPrice - marginPerUnit;

            const itemSellingPrice = unitSellingPrice * quantity;
            const itemBasePrice = unitBasePrice * quantity;
            const itemProfit = marginPerUnit * quantity;

            flattenedItems.push({
              // Order info
              orderId: order.id,
              orderNumber: order.order_number,
              createdAt: order.created_at,
              orderStatus: order.status || 'pending',
              paymentStatus: order.payment_status,
              estimatedDeliveryDate: (order as any).estimated_delivery_date || null,
              expectedCompletionDate: (order as any).expected_completion_date || null,

              // Item info
              itemId: item.id || `${order.id}-${index}`,
              productId: item.product_id,
              productName: item.product_name || 'Unknown Product',
              productImage: item.product_image,
              size: item.size,
              color: item.color,
              quantity: quantity,

              // Pricing
              itemBasePrice: itemBasePrice,
              itemSellingPrice: itemSellingPrice,
              itemProfit: itemProfit,
            });
          });
        });

        return flattenedItems;
      };

      const allFlattenedItems = flattenOrders(rawOrders);
      console.log('[YourEarnings] Total flattened items:', allFlattenedItems.length);

      // Filter based on selected filter
      const filteredItems = selectedFilter === 'all'
        ? allFlattenedItems
        : allFlattenedItems.filter(item => item.paymentStatus === selectedFilter);

      // Calculate stats from flattened items
      const totalEarnings = allFlattenedItems.reduce((sum, item) => sum + item.itemProfit, 0);
      const pendingEarnings = allFlattenedItems
        .filter(item => item.paymentStatus === 'pending')
        .reduce((sum, item) => sum + item.itemProfit, 0);
      const completedEarnings = allFlattenedItems
        .filter(item => item.paymentStatus === 'paid')
        .reduce((sum, item) => sum + item.itemProfit, 0);

      // Get unique order count for stats
      const uniqueOrderIds = new Set(allFlattenedItems.map(item => item.orderId));

      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      const monthlyTotal = allFlattenedItems
        .filter((item) => {
          const itemDate = new Date(item.createdAt);
          return itemDate >= startOfMonth;
        })
        .reduce((sum, item) => sum + item.itemProfit, 0);
      const derivedTier = getTierForSales(monthlyTotal);
      setMonthlySales(monthlyTotal);
      setCurrentTier(derivedTier);

      setStats({
        totalEarnings,
        totalOrders: uniqueOrderIds.size,
        pendingEarnings,
        completedEarnings,
      });

      setOrders(filteredItems);

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

  const renderOrderItem = ({ item }: { item: FlattenedEarningItem }) => {
    const statusTheme = getStatusTheme(item.orderStatus || item.paymentStatus);
    const orderDate = new Date(item.createdAt).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return (
      <TouchableOpacity
        style={styles.earningsItemCard}
        activeOpacity={0.7}
        onPress={() => {
          navigation.navigate('OrderDetails', { orderId: item.orderId });
        }}
      >
        {/* Order Header with Order Number and Profit */}
        <View style={styles.earningsCardHeader}>
          <View style={styles.earningsOrderNumberContainer}>
            <Ionicons name="receipt-outline" size={14} color="#6B7280" />
            <Text style={styles.earningsOrderNumberText}>#{item.orderNumber}</Text>
          </View>
          <View style={styles.earningsProfitBadge}>
            <Text style={styles.earningsProfitText}>+{formatCurrency(item.itemProfit)}</Text>
          </View>
        </View>

        {/* Order Date */}
        <Text style={styles.earningsDateText}>
          Placed on {orderDate}
        </Text>

        {/* Divider */}
        <View style={styles.earningsCardDivider} />

        {/* Product Info Section */}
        <View style={styles.earningsProductSection}>
          {/* Product Image */}
          <View style={styles.earningsImageContainer}>
            {item.productImage ? (
              <Image
                source={{ uri: item.productImage }}
                style={styles.earningsProductImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.earningsProductImage, styles.earningsImagePlaceholder]}>
                <Ionicons name="image-outline" size={24} color="#C7C7CC" />
              </View>
            )}
          </View>

          {/* Product Details */}
          <View style={styles.earningsProductDetails}>
            <Text style={styles.earningsProductName} numberOfLines={2}>
              {item.productName}
            </Text>

            {/* Size & Qty */}
            <View style={styles.earningsProductMeta}>
              {item.size && (
                <View style={styles.earningsMetaBadge}>
                  <Text style={styles.earningsMetaText}>Size: {item.size}</Text>
                </View>
              )}
              {item.quantity && (
                <View style={styles.earningsMetaBadge}>
                  <Text style={styles.earningsMetaText}>Qty: {item.quantity}</Text>
                </View>
              )}
            </View>

            {/* Pricing Row */}
            <View style={styles.earningsPricingRow}>
              <Text style={styles.earningsPricingLabel}>Base:</Text>
              <Text style={styles.earningsPricingValue}>{formatCurrency(item.itemBasePrice)}</Text>
              <Text style={styles.earningsPricingArrow}>→</Text>
              <Text style={styles.earningsPricingLabel}>Sold:</Text>
              <Text style={styles.earningsPricingSoldValue}>{formatCurrency(item.itemSellingPrice)}</Text>
            </View>

            {/* Status Badge */}
            <View
              style={[
                styles.earningsStatusBadge,
                { backgroundColor: statusTheme.bg }
              ]}
            >
              <View style={[styles.earningsStatusDot, { backgroundColor: statusTheme.color }]} />
              <Text style={[styles.earningsStatusText, { color: statusTheme.color }]}>
                {statusTheme.label}
              </Text>
            </View>
          </View>

          {/* Chevron */}
          <View style={styles.earningsChevron}>
            <Ionicons name="chevron-forward" size={20} color="#C7C7CC" />
          </View>
        </View>
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
        keyExtractor={(item) => `${item.orderId}-${item.itemId}`}
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
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.tierTipCard}>
                <Text style={styles.tierTipTitle}>How to reach the next tier?</Text>
                <Text style={styles.tierTipText}>
                  Share curated catalogs daily, follow up with interested shoppers, and keep your cart earnings healthy to
                  unlock higher reward points.
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
  // New individual earnings item card styles - COMPACT
  earningsItemCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Earnings Card Header
  earningsCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  earningsOrderNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  earningsOrderNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    letterSpacing: -0.3,
  },
  earningsProfitBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  earningsProfitText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
  },
  earningsDateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  earningsCardDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginBottom: 12,
  },
  // Earnings Product Section
  earningsProductSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  earningsImageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  earningsProductImage: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: '#F8F8F8',
  },
  earningsImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  earningsProductDetails: {
    flex: 1,
    justifyContent: 'flex-start',
  },
  earningsProductName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 20,
    marginBottom: 6,
  },
  earningsProductMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  earningsMetaBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  earningsMetaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  earningsPricingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 4,
  },
  earningsPricingLabel: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  earningsPricingValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  earningsPricingArrow: {
    fontSize: 12,
    color: '#9CA3AF',
    marginHorizontal: 4,
  },
  earningsPricingSoldValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  earningsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  earningsStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  earningsStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earningsChevron: {
    justifyContent: 'center',
    paddingLeft: 8,
  },
  // Legacy Styles kept for backward compatibility
  earningsItemTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  earningsItemImageContainer: {
    position: 'relative',
  },
  earningsItemImage: {
    width: 85,
    height: 85,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  earningsItemImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  earningsItemInfo: {
    flex: 1,
    gap: 3,
  },
  earningsItemName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  earningsItemMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  earningsItemPricingInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  pricingLabelSmall: {
    fontSize: 10,
    color: '#9CA3AF',
  },
  pricingValueSmall: {
    fontSize: 10,
    color: '#6B7280',
    fontWeight: '500',
  },
  pricingValueSmallBold: {
    fontSize: 10,
    color: '#1F2937',
    fontWeight: '700',
  },
  pricingArrow: {
    fontSize: 10,
    color: '#D1D5DB',
    marginHorizontal: 2,
  },
  earningsItemRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  profitBadgeCompact: {
    backgroundColor: '#ECFDF5',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#10B981',
  },
  profitBadgeTextCompact: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '700',
  },
  statusPillSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusPillTextSmall: {
    fontSize: 9,
    fontWeight: '600',
  },
  // Keep old styles for compatibility
  profitBadge: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    right: -6,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingVertical: 3,
    alignItems: 'center',
  },
  profitBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '600',
  },
  earningsItemQty: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  orderNumberBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  orderNumberText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  earningsItemPricingRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  pricingItem: {
    flex: 1,
    alignItems: 'center',
  },
  pricingLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  pricingValue: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  pricingValueBold: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '700',
  },
  pricingValueProfit: {
    fontSize: 13,
    color: '#10B981',
    fontWeight: '700',
  },
  pricingDivider: {
    width: 1,
    backgroundColor: '#F3F4F6',
  },
  earningsItemDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  earningsItemDateText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
});

