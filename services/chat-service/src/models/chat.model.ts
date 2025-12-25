export interface ChatThread {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  created_at: Date;
}

export interface CreateMessageDto {
  thread_id: string;
  sender_id: string;
  content: string;
}

