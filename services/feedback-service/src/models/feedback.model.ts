export interface Feedback {
  id: string;
  user_id?: string;
  user_email?: string;
  user_name: string;
  feedback_text: string;
  image_urls?: string[];
  category: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'closed';
  created_at: Date;
  updated_at?: Date;
}

export interface CreateFeedbackDto {
  user_id?: string;
  user_email?: string;
  user_name?: string;
  feedback_text: string;
  image_urls?: string[];
  category?: string;
}

