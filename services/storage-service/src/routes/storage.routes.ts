import { Router } from 'express';
import { storageController, upload } from '../controllers/storage.controller';

const router = Router();

router.post('/upload', upload.single('file'), storageController.uploadFile);
router.get('/:id', storageController.getFile);
router.get('/user/:userId', storageController.getUserFiles);
router.delete('/:id', storageController.deleteFile);

export { router as storageRoutes };

