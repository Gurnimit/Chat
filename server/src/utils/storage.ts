import fs from 'fs';
import path from 'path';

export interface UploadResult {
  fileUrl: string;
  storageType: 'local' | 's3';
}

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const saveUploadedFile = async (
  tempFilePath: string,
  finalFilename: string,
  mimeType: string
): Promise<UploadResult> => {
  const s3Endpoint = process.env.S3_ENDPOINT;
  const s3Bucket = process.env.S3_BUCKET;
  const s3AccessKey = process.env.S3_ACCESS_KEY;
  const s3SecretKey = process.env.S3_SECRET_KEY;

  if (s3Endpoint && s3Bucket && s3AccessKey && s3SecretKey) {
    try {
      // S3 Cloud / MinIO Upload path
      const fileBuffer = fs.readFileSync(tempFilePath);
      const targetUrl = `${s3Endpoint.replace(/\/$/, '')}/${s3Bucket}/${finalFilename}`;

      const response = await fetch(targetUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': mimeType,
        },
        body: fileBuffer,
      });

      // Cleanup local temp file after upload
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }

      if (response.ok) {
        return { fileUrl: targetUrl, storageType: 's3' };
      }
    } catch (err) {
      console.warn('S3 cloud storage upload failed, falling back to local storage:', err);
    }
  }

  // Local filesystem storage fallback
  const finalPath = path.join(UPLOADS_DIR, finalFilename);
  fs.renameSync(tempFilePath, finalPath);
  return {
    fileUrl: `/uploads/${finalFilename}`,
    storageType: 'local',
  };
};
