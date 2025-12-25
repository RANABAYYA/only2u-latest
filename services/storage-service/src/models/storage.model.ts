export interface FileMetadata {
  id: string;
  user_id?: string;
  file_name: string;
  original_name: string;
  file_path: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  folder: string;
  created_at: Date;
}

export interface UploadFileDto {
  user_id?: string;
  folder?: string;
}

