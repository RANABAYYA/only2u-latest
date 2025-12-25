export interface Order {
  id: string;
  user_id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded' | 'partial';
  payment_method?: string;
  payment_id?: string;
  subtotal: number;
  tax_amount: number;
  shipping_amount: number;
  discount_amount: number;
  total_amount: number;
  shipping_address: {
    full_name: string;
    phone: string;
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  billing_address?: {
    full_name: string;
    phone: string;
    address_line1: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
  };
  tracking_number?: string;
  shipped_at?: Date;
  delivered_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id?: string;
  variant_id?: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  size?: string;
  color?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: Date;
}

export interface CreateOrderDto {
  user_id: string;
  status?: string;
  payment_status?: string;
  payment_method?: string;
  payment_id?: string;
  subtotal: number;
  tax_amount?: number;
  shipping_amount?: number;
  discount_amount?: number;
  total_amount: number;
  shipping_address: Order['shipping_address'];
  billing_address?: Order['billing_address'];
  notes?: string;
  items: Array<{
    product_id?: string;
    variant_id?: string;
    product_name: string;
    product_sku?: string;
    product_image?: string;
    size?: string;
    color?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export interface UpdateOrderStatusDto {
  status?: Order['status'];
  payment_status?: Order['payment_status'];
  tracking_number?: string;
  shipped_at?: Date;
  delivered_at?: Date;
}

