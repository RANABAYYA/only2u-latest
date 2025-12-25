export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  is_private: boolean;
  is_default: boolean;
  created_at: Date;
  updated_at: Date;
  product_count?: number;
}

export interface CollectionProduct {
  id: string;
  collection_id: string;
  product_id: string;
  added_at: Date;
  product_name?: string;
  image_urls?: string[];
  base_price?: number;
}

export interface CreateCollectionDto {
  user_id: string;
  name: string;
  description?: string;
  is_private?: boolean;
  is_default?: boolean;
}

