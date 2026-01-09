import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import AWS from 'aws-sdk';
import { db } from '../config/database';
import { FileMetadata, UploadFileDto } from '../models/storage.model';
import fs from 'fs';
import path from 'path';

class StorageService {
  private s3: AWS.S3;
  private storageType: 'local' | 's3' | 'supabase';

  constructor() {
    this.storageType = (process.env.STORAGE_TYPE || 'local') as 'local' | 's3' | 'supabase';

    if (this.storageType === 's3') {
      this.s3 = new AWS.S3({
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        region: process.env.AWS_REGION || 'us-east-1',
      });
    }
  }

  /**
   * Upload file
   */
  async uploadFile(
    file: Express.Multer.File,
    metadata: UploadFileDto
  ): Promise<FileMetadata> {
    const fileId = uuidv4();
    const extension = path.extname(file.originalname);
    const fileName = `${fileId}${extension}`;
    const filePath = this.getFilePath(metadata.folder || 'uploads', fileName);

    let url: string;
    let optimizedPath: string | null = null;

    // Optimize image if needed
    if (file.mimetype.startsWith('image/')) {
      optimizedPath = await this.optimizeImage(file.buffer, filePath);
    }

    // Upload to storage
    if (this.storageType === 's3') {
      url = await this.uploadToS3(optimizedPath || file.buffer, filePath, file.mimetype);
    } else {
      // Local storage
      const uploadDir = path.join(process.cwd(), 'uploads', metadata.folder || 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const finalPath = path.join(uploadDir, fileName);
      fs.writeFileSync(finalPath, optimizedPath ? fs.readFileSync(optimizedPath) : file.buffer);
      url = `/uploads/${metadata.folder || 'uploads'}/${fileName}`;
    }

    // Save metadata to database
    const result = await db.query(
      `INSERT INTO file_metadata (
        id, user_id, file_name, original_name, file_path, file_url,
        file_size, mime_type, folder, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING *`,
      [
        fileId,
        metadata.user_id || null,
        fileName,
        file.originalname,
        filePath,
        url,
        file.size,
        file.mimetype,
        metadata.folder || 'uploads',
      ]
    );

    return result.rows[0];
  }

  /**
   * Optimize image
   */
  private async optimizeImage(buffer: Buffer, outputPath: string): Promise<string> {
    const optimized = await sharp(buffer)
      .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const tempPath = path.join(process.cwd(), 'temp', path.basename(outputPath));
    const tempDir = path.dirname(tempPath);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    fs.writeFileSync(tempPath, optimized);
    return tempPath;
  }

  /**
   * Upload to S3
   */
  private async uploadToS3(
    buffer: Buffer | string,
    key: string,
    contentType: string
  ): Promise<string> {
    const params: AWS.S3.PutObjectRequest = {
      Bucket: process.env.AWS_S3_BUCKET || '',
      Key: key,
      Body: typeof buffer === 'string' ? fs.readFileSync(buffer) : buffer,
      ContentType: contentType,
      ACL: 'public-read',
    };

    await this.s3.upload(params).promise();
    return `https://${params.Bucket}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId: string): Promise<FileMetadata | null> {
    const result = await db.query('SELECT * FROM file_metadata WHERE id = $1', [fileId]);
    return result.rows[0] || null;
  }

  /**
   * Get user files
   */
  async getUserFiles(userId: string, folder?: string): Promise<FileMetadata[]> {
    let query = 'SELECT * FROM file_metadata WHERE user_id = $1';
    const params: any[] = [userId];

    if (folder) {
      query += ' AND folder = $2';
      params.push(folder);
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Delete file
   */
  async deleteFile(fileId: string, userId?: string): Promise<void> {
    const file = await this.getFileMetadata(fileId);

    if (!file) {
      throw new Error('File not found');
    }

    if (userId && file.user_id !== userId) {
      throw new Error('Access denied');
    }

    // Delete from storage
    if (this.storageType === 's3') {
      await this.s3
        .deleteObject({
          Bucket: process.env.AWS_S3_BUCKET || '',
          Key: file.file_path,
        })
        .promise();
    } else {
      const filePath = path.join(process.cwd(), 'uploads', file.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete metadata
    await db.query('DELETE FROM file_metadata WHERE id = $1', [fileId]);
  }

  /**
   * Get file path
   */
  private getFilePath(folder: string, fileName: string): string {
    return `${folder}/${fileName}`;
  }
}

export const storageService = new StorageService();
export default storageService;

