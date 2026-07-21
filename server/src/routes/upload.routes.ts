import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth.middleware';
import { validateFileSignature } from '../utils/file_validator';
import { saveUploadedFile } from '../utils/storage';

const router = Router();

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer Storage Configuration: Save as a neutral .tmp extension first
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '.tmp');
  },
});

// Category definitions and their specific size limits
const CATEGORY_LIMITS = {
  image: 25 * 1024 * 1024,      // 25 MB
  audio: 100 * 1024 * 1024,    // 100 MB
  document: 100 * 1024 * 1024, // 100 MB
  archive: 250 * 1024 * 1024,  // 250 MB
  video: 500 * 1024 * 1024,    // 500 MB
};

const ALLOWED_TYPES = {
  image: [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'
  ],
  video: [
    'video/mp4', 'video/mpeg', 'video/quicktime', 'video/webm', 'video/x-msvideo'
  ],
  audio: [
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm', 'audio/aac'
  ],
  document: [
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ],
  archive: [
    'application/zip', 'application/x-zip-compressed'
  ]
};

// Simple MIME validation from client-side header (layer 1 defense)
const fileFilter = (req: any, file: any, cb: any) => {
  const mimeType = file.mimetype;
  const isAllowed = Object.values(ALLOWED_TYPES).some(types => types.includes(mimeType));
  
  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Allowed files: Images, Videos, Audio, PDFs, Office documents, and ZIP archives. Executables, HTML, JavaScript, and SVGs are strictly prohibited.'), false);
  }
};

// Multer Upload Limits & Filtering (limit globally to 500MB max)
const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024,
  },
  fileFilter,
});

// Wrapper middleware to intercept and clean Multer errors
const uploadSingle = (req: any, res: any, next: any) => {
  upload.single('file')(req, res, (err: any) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

// Upload Single File API
router.post('/', authenticateToken, uploadSingle, async (req: AuthenticatedRequest, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.file;

  try {
    // Perform server-side validation using magic bytes (layer 2 defense)
    const verification = validateFileSignature(file.path, file.originalname);

    if (!verification.isValid || !verification.ext || !verification.mimeType) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ 
        error: 'File signature verification failed. Executables, HTML, JavaScript, SVGs, and other scriptable content are strictly prohibited.' 
      });
    }

    // Determine category based on validated MIME type
    let category: keyof typeof CATEGORY_LIMITS | null = null;
    for (const [cat, types] of Object.entries(ALLOWED_TYPES)) {
      if (types.includes(verification.mimeType)) {
        category = cat as keyof typeof CATEGORY_LIMITS;
        break;
      }
    }

    if (!category) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'File type category not allowed.' });
    }

    // Enforce category size limits
    const limit = CATEGORY_LIMITS[category];
    if (file.size > limit) {
      fs.unlinkSync(file.path);
      const limitMB = limit / (1024 * 1024);
      return res.status(400).json({ 
        error: `File size exceeds the limit for this category. ${category.charAt(0).toUpperCase() + category.slice(1)} files are limited to ${limitMB}MB.` 
      });
    }

    // Rename / upload file via storage abstraction layer
    const finalFilename = path.basename(file.filename, '.tmp') + verification.ext;
    const uploadResult = await saveUploadedFile(file.path, finalFilename, verification.mimeType);

    return res.json({
      message: 'File uploaded successfully',
      fileUrl: uploadResult.fileUrl,
      storageType: uploadResult.storageType,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: verification.mimeType,
    });
  } catch (error) {
    console.error('File upload route error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    return res.status(500).json({ error: 'Internal server error during upload' });
  }
});

export default router;
export { UPLOADS_DIR };

