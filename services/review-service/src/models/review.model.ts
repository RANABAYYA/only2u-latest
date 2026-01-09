export interface Review {
  id: string;
  product_id: string;
  user_id?: string;
  reviewer_name: string;
  rating: number;
  comment?: string;
  is_verified: boolean;
  profile_image_url?: string;
  helpful_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface CreateReviewDto {
  product_id: string;
  user_id?: string;
  reviewer_name: string;
  rating: number;
  comment?: string;
  is_verified?: boolean;
  profile_image_url?: string;
}

export interface UpdateReviewDto {
  rating?: number;
  comment?: string;
}

