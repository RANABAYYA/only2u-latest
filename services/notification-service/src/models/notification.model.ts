export interface Notification {
  id: string;
  user_id: string;
  type: 'push' | 'email' | 'in_app';
  title: string;
  body: string;
  data?: Record<string, string>;
  read: boolean;
  created_at: Date;
}

export interface CreateNotificationDto {
  user_id: string;
  type: 'push' | 'email' | 'in_app';
  title: string;
  body: string;
  data?: Record<string, string>;
}

