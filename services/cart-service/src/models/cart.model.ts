export interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  product_name: string;
  product_image?: string;
  size?: string;
  color?: string;
  price: number;
  quantity: number;
  isReseller?: boolean;
  resellerPrice?: number;
}

export interface AddToCartDto {
  product_id: string;
  variant_id?: string;
  product_name: string;
  product_image?: string;
  size?: string;
  color?: string;
  price: number;
  quantity: number;
}

