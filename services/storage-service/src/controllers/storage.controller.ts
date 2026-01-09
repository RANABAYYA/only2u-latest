import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { storageService } from '../services/storage.service';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

export class StorageController {
  uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'No file uploaded' },
        });
        return;
      }

      const metadata = {
        user_id: req.body.user_id,
        folder: req.body.folder || 'uploads',
      };

      const fileMetadata = await storageService.uploadFile(file, metadata);
      res.status(201).json({
        success: true,
        data: { file: fileMetadata },
      });
    } catch (error) {
      next(error);
    }
  };

  getFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const file = await storageService.getFileMetadata(req.params.id);
      if (!file) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'File not found' },
        });
        return;
      }
      res.json({
        success: true,
        data: { file },
      });
    } catch (error) {
      next(error);
    }
  };

  getUserFiles = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const folder = req.query.folder as string;
      const files = await storageService.getUserFiles(req.params.userId, folder);
      res.json({
        success: true,
        data: { files },
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.query.userId as string;
      await storageService.deleteFile(req.params.id, userId);
      res.json({
        success: true,
        data: { message: 'File deleted' },
      });
    } catch (error) {
      next(error);
    }
  };
}

export { upload };
export const storageController = new StorageController();

