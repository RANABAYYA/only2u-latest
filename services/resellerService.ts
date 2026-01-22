import { supabase } from '~/utils/supabase';
import type {
  Reseller,
  ResellerProduct,
  ResellerOrder,
  ResellerRegistrationForm,
  ResellerProductForm,
  CatalogShareForm,
  ResellerDashboard,
  ResellerEarning,
} from '~/types/reseller';

interface ResellerCheckoutItemInput {
  productId: string | null;
  variantId?: string | null;
  quantity: number;
  baseUnitPrice: number;
  resellerUnitPrice: number;
  baseTotal: number;
  resellerTotal: number;
  marginAmount: number;
}

interface ResellerCheckoutSyncPayload {
  userId: string;
  orderId: string;
  orderNumber?: string | null;
  paymentMethod: string | null | undefined;
  paymentStatus: 'pending' | 'paid';
  totals: {
    originalTotal: number;
    resellerTotal: number;
    totalProfit: number;
  };
  items: ResellerCheckoutItemInput[];
  customer: {
    name: string;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  };
}

export class ResellerService {
  // ===========================
  // RESELLER REGISTRATION
  // ===========================

  static async registerReseller(formData: ResellerRegistrationForm): Promise<Reseller> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase
        .from('resellers')
        .insert({
          user_id: user.id,
          ...formData,
          is_verified: false,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error registering reseller:', error);
      throw error;
    }
  }

  static async getResellerByUserId(userId: string): Promise<Reseller | null> {
    try {
      const { data, error } = await supabase
        .from('resellers')
        .select(`
          *,
          user:users(
            id,
            name,
            email,
            phone,
            profilePhoto
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No reseller found
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching reseller:', error);
      throw error;
    }
  }

  static async ensureResellerForUser(userId: string): Promise<Reseller> {
    const existing = await this.getResellerByUserId(userId);
    if (existing) {
      return existing;
    }

    const { data: userProfile } = await supabase
      .from('users')
      .select('id, name, email, phone, address, city, state, postal_code')
      .eq('id', userId)
      .maybeSingle();

    const { data: authUserResponse } = await supabase.auth.getUser();
    const authUser = authUserResponse?.user;

    const businessName = userProfile?.name || authUser?.email || 'Reseller';
    const phone = userProfile?.phone || authUser?.phone || null;
    const email = userProfile?.email || authUser?.email || null;

    const { data: newReseller, error: insertError } = await supabase
      .from('resellers')
      .insert({
        user_id: userId,
        business_name: businessName,
        business_type: 'individual',
        phone,
        email,
        address: userProfile?.address || null,
        city: userProfile?.city || null,
        state: userProfile?.state || null,
        pincode: (userProfile as any)?.postal_code || null,
        is_verified: false,
        is_active: true,
        commission_rate: 20,
        total_earnings: 0,
        total_orders: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('*')
      .single();

    if (insertError || !newReseller) {
      throw insertError || new Error('Unable to create reseller profile');
    }

    return newReseller as Reseller;
  }

  static async updateResellerProfile(resellerId: string, updates: Partial<Reseller>): Promise<Reseller> {
    try {
      const { data, error } = await supabase
        .from('resellers')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', resellerId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating reseller profile:', error);
      throw error;
    }
  }

  static async updateBankDetails(resellerId: string, details: {
    account_holder_name: string;
    bank_account_number: string;
    ifsc_code: string;
  }): Promise<Reseller> {
    try {
      const { data, error } = await supabase
        .from('resellers')
        .update({
          ...details,
          updated_at: new Date().toISOString()
        })
        .eq('id', resellerId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating bank details:', error);
      throw error;
    }
  }

  // ===========================
  // RESELLER PRODUCTS
  // ===========================

  static async addProductToResellerCatalog(
    resellerId: string,
    productForm: ResellerProductForm
  ): Promise<ResellerProduct> {
    try {
      // Get the base price from the product variant
      const { data: productData, error: productError } = await supabase
        .from('product_variants')
        .select('price')
        .eq('id', productForm.variant_id || productForm.product_id)
        .single();

      if (productError) {
        throw productError;
      }

      const basePrice = productData.price;

      const { data, error } = await supabase
        .from('reseller_products')
        .insert({
          reseller_id: resellerId,
          base_price: basePrice,
          ...productForm
        })
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding product to reseller catalog:', error);
      throw error;
    }
  }

  static async getResellerProducts(resellerId: string): Promise<ResellerProduct[]> {
    try {
      const { data, error } = await supabase
        .from('reseller_products')
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .eq('reseller_id', resellerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching reseller products:', error);
      throw error;
    }
  }

  static async updateResellerProduct(
    resellerProductId: string,
    updates: Partial<ResellerProduct>
  ): Promise<ResellerProduct> {
    try {
      const { data, error } = await supabase
        .from('reseller_products')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', resellerProductId)
        .select(`
          *,
          product:products(
            id,
            name,
            description,
            image_urls,
            video_urls,
            category:categories(name),
            variants:product_variants(
              id,
              price,
              size:sizes(name),
              color:colors(name, hex_code)
            )
          ),
          variant:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating reseller product:', error);
      throw error;
    }
  }

  static async removeProductFromResellerCatalog(resellerProductId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('reseller_products')
        .update({ is_active: false })
        .eq('id', resellerProductId);

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error('Error removing product from reseller catalog:', error);
      throw error;
    }
  }

  // ===========================
  // CATALOG SHARING
  // ===========================

  static async shareProductCatalog(
    resellerId: string,
    shareForm: CatalogShareForm
  ): Promise<void> {
    try {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          id,
          name,
          description,
          image_urls,
          video_urls,
          category:categories(name),
          variants:product_variants(
            id,
            price,
            size:sizes(name),
            color:colors(name, hex_code)
          )
        `)
        .eq('id', shareForm.product_id)
        .single();

      if (productError) {
        throw productError;
      }

      // Get reseller product info
      const { data: resellerProduct, error: resellerProductError } = await supabase
        .from('reseller_products')
        .select('selling_price, margin_percentage')
        .eq('reseller_id', resellerId)
        .eq('product_id', shareForm.product_id)
        .single();

      if (resellerProductError) {
        throw resellerProductError;
      }

      // Generate share content
      const shareContent = this.generateCatalogShareContent(product, resellerProduct, shareForm);

      // Record the share
      await supabase
        .from('reseller_catalog_shares')
        .insert({
          reseller_id: resellerId,
          product_id: shareForm.product_id,
          share_method: shareForm.share_method,
          share_content: shareContent,
          recipient_count: shareForm.recipient_contacts?.length || 1
        });

      // Here you would integrate with actual sharing services (WhatsApp, Telegram, etc.)
      // For now, we'll just log the content
      console.log('Catalog share content:', shareContent);

    } catch (error) {
      console.error('Error sharing product catalog:', error);
      throw error;
    }
  }

  private static generateCatalogShareContent(
    product: any,
    resellerProduct: any,
    shareForm: CatalogShareForm
  ): string {
    const availableSizes = product.variants?.map((v: any) => v.size?.name).filter(Boolean).join(', ');
    const availableColors = product.variants?.map((v: any) => v.color?.name).filter(Boolean).join(', ');

    let content = `🛍️ *${product.name}*\n\n`;
    content += `📝 ${product.description}\n\n`;
    content += `💰 *Price: ₹${resellerProduct.selling_price}*\n`;
    content += `📏 *Available Sizes: ${availableSizes}*\n`;
    content += `🎨 *Available Colors: ${availableColors}*\n\n`;

    if (shareForm.custom_message) {
      content += `💬 *Message:* ${shareForm.custom_message}\n\n`;
    }

    content += `🛒 Order now and get the best deals!\n`;
    content += `📱 Contact me for more details`;

    return content;
  }

  // ===========================
  // RESELLER ORDERS
  // ===========================

  static async getResellerOrders(resellerId: string): Promise<ResellerOrder[]> {
    try {
      // 1. Get reseller's user_id
      const { data: resellerData, error: resellerError } = await supabase
        .from('resellers')
        .select('user_id')
        .eq('id', resellerId)
        .single();

      if (resellerError) throw resellerError;
      const userId = resellerData.user_id;

      // 2. Fetch orders from the main orders table
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          created_at,
          updated_at,
          status,
          payment_status,
          total_amount,
          reseller_profit,
          reseller_margin_amount,
          payment_method,
          items:order_items(
            id,
            product_id,
            quantity,
            unit_price,
            total_price,
            product:products(
              id,
              name,
              image_urls
            )
          )
        `)
        .eq('user_id', userId)
        .eq('is_reseller_order', true)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      // 3. Map to ResellerOrder interface
      return (data || []).map(order => ({
        id: order.id,
        order_number: order.order_number,
        reseller_id: resellerId,
        customer_name: 'Customer', // Placeholder as per discussion
        customer_phone: '',
        customer_address: '',
        customer_city: '',
        customer_state: '',
        customer_pincode: '',
        total_amount: Number(order.total_amount),
        reseller_commission: Number(order.reseller_profit || order.reseller_margin_amount || 0),
        platform_commission: 0, // Not exposing this currently
        status: order.status as any,
        payment_status: (order.payment_status || 'pending') as any,
        payment_method: (order.payment_method || 'online') as any,
        created_at: order.created_at,
        updated_at: order.updated_at,
        items: (order.items || []).map((item: any) => ({
          id: item.id,
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price,
          reseller_price: item.unit_price,
          margin_amount: 0,
          created_at: order.created_at,
          product: item.product
        }))
      }));
    } catch (error) {
      console.error('Error fetching reseller orders:', error);
      throw error;
    }
  }

  static async createResellerOrder(
    resellerId: string,
    orderData: {
      customer_name: string;
      customer_phone: string;
      customer_email?: string;
      customer_address: string;
      customer_city: string;
      customer_state: string;
      customer_pincode: string;
      items: Array<{
        product_id: string;
        variant_id?: string;
        quantity: number;
        unit_price: number;
      }>;
      payment_method: string;
    }
  ): Promise<ResellerOrder> {
    try {
      // Calculate totals
      const totalAmount = orderData.items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);

      // Get reseller commission rate
      const { data: reseller, error: resellerError } = await supabase
        .from('resellers')
        .select('commission_rate')
        .eq('id', resellerId)
        .single();

      if (resellerError) {
        throw resellerError;
      }

      const resellerCommission = (totalAmount * reseller.commission_rate) / 100;
      const platformCommission = totalAmount - resellerCommission;

      // Generate order number
      const orderNumber = `RO${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from('reseller_orders')
        .insert({
          reseller_id: resellerId,
          order_number: orderNumber,
          customer_name: orderData.customer_name,
          customer_phone: orderData.customer_phone,
          customer_email: orderData.customer_email,
          customer_address: orderData.customer_address,
          customer_city: orderData.customer_city,
          customer_state: orderData.customer_state,
          customer_pincode: orderData.customer_pincode,
          total_amount: totalAmount,
          reseller_commission: resellerCommission,
          platform_commission: platformCommission,
          payment_method: orderData.payment_method,
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) {
        throw orderError;
      }

      // Create order items
      const orderItems = orderData.items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.unit_price * item.quantity,
        reseller_price: item.unit_price, // This should be calculated based on reseller's margin
        margin_amount: 0 // This should be calculated based on reseller's margin
      }));

      const { error: itemsError } = await supabase
        .from('reseller_order_items')
        .insert(orderItems);

      if (itemsError) {
        throw itemsError;
      }

      return order;
    } catch (error) {
      console.error('Error creating reseller order:', error);
      throw error;
    }
  }

  static async logResellerOrderFromCheckout(payload: ResellerCheckoutSyncPayload): Promise<void> {
    // Deprecated: Orders are now handled directly via the main 'orders' table.
    // This function is kept to prevent errors in existing calls but does nothing.
    console.log('[ResellerService] logResellerOrderFromCheckout is deprecated. Order should be logged via standard checkout flow.');
    return;
  }

  // ===========================
  // DASHBOARD & ANALYTICS
  // ===========================

  static async getResellerDashboard(resellerId: string): Promise<ResellerDashboard> {
    try {
      // 1. Get reseller's user_id to query the main orders table
      const { data: resellerData, error: resellerError } = await supabase
        .from('resellers')
        .select('user_id')
        .eq('id', resellerId)
        .single();

      if (resellerError) throw resellerError;
      const userId = resellerData.user_id;

      // 2. Fetch data in parallel
      const [productsResult, ordersResult] = await Promise.all([
        supabase
          .from('reseller_products')
          .select('id, is_active')
          .eq('reseller_id', resellerId),

        // Fetch from main orders table where is_reseller_order is true
        supabase
          .from('orders')
          .select(`
            id, 
            order_number, 
            status, 
            total_amount, 
            reseller_profit, 
            reseller_margin_amount,
            created_at, 
            updated_at
          `)
          .eq('user_id', userId)
          .eq('is_reseller_order', true)
          .order('created_at', { ascending: false }),
      ]);

      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;

      const products = productsResult.data || [];
      const orders = (ordersResult.data || []).map(order => ({
        ...order,
        total_amount: Number(order.total_amount || 0),
        // Use reseller_profit or margin_amount as commission
        reseller_commission: Number(order.reseller_profit || order.reseller_margin_amount || 0),
        customer_name: 'Customer', // Default since main orders might not expose full customer details to this view easily without extra queries, or we can add it if needed.
        customer_phone: '',
      }));

      const totalProducts = products.length;
      const activeProducts = products.filter(p => p.is_active).length;
      const totalOrders = orders.length;

      // Status mapping might need adjustment if order statuses differ
      const pendingOrders = orders.filter(o => ['pending', 'processing', 'shipped'].includes(o.status)).length;

      // Calculate earnings from the orders table
      // Total earnings: Sum of profit from non-cancelled, non-returned orders (or just confirmed/delivered)
      // For now, assume all non-cancelled orders count towards "Total Earnings" visually, 
      // or strictly 'delivered'/'completed'. Let's stick to 'delivered' for realized earnings, 
      // and others for pending.

      const realizedStatuses = ['delivered', 'completed'];
      const pendingStatuses = ['pending', 'processing', 'shipped', 'out_for_delivery'];

      const totalEarnings = orders
        .filter(o => realizedStatuses.includes(o.status))
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      const pendingEarnings = orders
        .filter(o => pendingStatuses.includes(o.status))
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      // Monthly calculations
      const now = new Date();
      const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

      const thisMonthEarnings = orders
        .filter(o => o.created_at >= firstDayThisMonth && realizedStatuses.includes(o.status))
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      const lastMonthEarnings = orders
        .filter(o => o.created_at >= firstDayLastMonth && o.created_at <= lastDayLastMonth && realizedStatuses.includes(o.status))
        .reduce((sum, o) => sum + o.reseller_commission, 0);

      return {
        total_products: totalProducts,
        active_products: activeProducts,
        total_orders: totalOrders,
        pending_orders: pendingOrders,
        total_earnings: totalEarnings,
        pending_earnings: pendingEarnings,
        this_month_earnings: thisMonthEarnings,
        last_month_earnings: lastMonthEarnings,
        recent_orders: orders.slice(0, 5) as any[], // TODO: Properly map to ResellerOrder
        top_products: [], // TODO: Implement top products logic
        analytics: {
          daily_revenue: [],
          weekly_orders: [],
          monthly_earnings: []
        }
      };
    } catch (error) {
      console.error('Error fetching reseller dashboard:', error);
      throw error;
    }
  }

  // ===========================
  // UTILITY METHODS
  // ===========================

  static async isUserReseller(userId: string): Promise<boolean> {
    try {
      const reseller = await this.getResellerByUserId(userId);
      return reseller !== null;
    } catch (error) {
      console.error('Error checking if user is reseller:', error);
      return false;
    }
  }

  static calculateSellingPrice(basePrice: number, marginPercentage: number): number {
    return basePrice + (basePrice * marginPercentage / 100);
  }

  static calculateMargin(basePrice: number, sellingPrice: number): number {
    return ((sellingPrice - basePrice) / basePrice) * 100;
  }
  static async getPayoutHistory(resellerId: string, limit: number = 20): Promise<ResellerEarning[]> {
    try {
      const { data, error } = await supabase
        .from('reseller_earnings')
        .select('*')
        .eq('reseller_id', resellerId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching payout history:', error);
      return [];
    }
  }
}
