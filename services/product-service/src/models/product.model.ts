export interface Product {
  id: string;
  name: string;
  description?: string;
  slug?: string;
  category_id?: string;
  image_urls?: string[];
  video_urls?: string[];
  base_price: number;
  is_active: boolean;
  featured_type?: string;
  like_count: number;
  return_policy?: string;
  vendor_name?: string;
  alias_vendor?: string;
  tags?: string[];
  meta_title?: string;
  meta_description?: string;
  stock_quantity: number;
  weight?: number;
  dimensions?: { length?: number; width?: number; height?: number };
  created_at: Date;
  updated_at: Date;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  color_id?: string;
  size_id?: string;
  sku?: string;
  barcode?: string;
  price: number;
  mrp_price?: number;
  rsp_price?: number;
  cost_price?: number;
  discount_percentage: number;
  quantity: number;
  weight?: number;
  image_urls?: string[];
  video_urls?: string[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  parent_id?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Color {
  id: string;
  name: string;
  hex_code?: string;
  is_active: boolean;
  created_at: Date;
}

export interface Size {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

export interface CreateProductDto {
  name: string;
  description?: string;
  category_id?: string;
  image_urls?: string[];
  video_urls?: string[];
  base_price: number;
  featured_type?: string;
  vendor_name?: string;
  tags?: string[];
  stock_quantity?: number;
}

export interface UpdateProductDto {
  name?: string;
  description?: string;
  category_id?: string;
  image_urls?: string[];
  video_urls?: string[];
  base_price?: number;
  is_active?: boolean;
  featured_type?: string;
  stock_quantity?: number;
}

export interface ProductWithVariants extends Product {
  variants?: ProductVariant[];
  category?: Category;
}

