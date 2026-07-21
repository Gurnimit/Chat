import fs from 'fs';
import path from 'path';

export interface FileValidationResult {
  isValid: boolean;
  mimeType?: string;
  ext?: string;
}

// Map extensions to their standard MIME types
function getMimeForExtension(ext: string): string {
  switch (ext) {
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.doc': return 'application/msword';
    case '.xls': return 'application/vnd.ms-excel';
    case '.ppt': return 'application/vnd.ms-powerpoint';
    case '.zip': return 'application/zip';
    default: return 'application/octet-stream';
  }
}

/**
 * Validates a file's actual type using its magic bytes (signatures)
 * instead of trusting user-supplied headers.
 */
export function validateFileSignature(filePath: string, originalName: string): FileValidationResult {
  const buffer = Buffer.alloc(262); // 262 bytes is sufficient for common signatures
  let fd: number | undefined;

  try {
    fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 262, 0);
  } catch (err) {
    console.error('[FileValidator] Error reading file signature:', err);
    return { isValid: false };
  } finally {
    if (fd !== undefined) {
      try {
        fs.closeSync(fd);
      } catch (e) {
        console.error('[FileValidator] Error closing file:', e);
      }
    }
  }

  // Helper to match bytes at the start of the buffer
  const checkHeader = (hexSig: string): boolean => {
    const bytes = hexSig.split(' ').map(h => parseInt(h, 16));
    for (let i = 0; i < bytes.length; i++) {
      if (buffer[i] !== bytes[i]) return false;
    }
    return true;
  };

  // 1. Check binary signatures

  // JPEG: FF D8 FF
  if (checkHeader('FF D8 FF')) {
    return { isValid: true, mimeType: 'image/jpeg', ext: '.jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (checkHeader('89 50 4E 47 0D 0A 1A 0A')) {
    return { isValid: true, mimeType: 'image/png', ext: '.png' };
  }

  // GIF: GIF87a / GIF89a (47 49 46 38 37 61 / 47 49 46 38 39 61)
  if (checkHeader('47 49 46 38 37 61') || checkHeader('47 49 46 38 39 61')) {
    return { isValid: true, mimeType: 'image/gif', ext: '.gif' };
  }

  // PDF: %PDF (25 50 44 46)
  if (checkHeader('25 50 44 46')) {
    return { isValid: true, mimeType: 'application/pdf', ext: '.pdf' };
  }

  // ZIP: PK (50 4B 03 04) - matches ZIP archives and docx/xlsx/pptx
  if (checkHeader('50 4B 03 04')) {
    const origExt = path.extname(originalName).toLowerCase();
    const allowedZipExts = ['.zip', '.docx', '.xlsx', '.pptx'];
    if (allowedZipExts.includes(origExt)) {
      return { isValid: true, mimeType: getMimeForExtension(origExt), ext: origExt };
    }
    return { isValid: true, mimeType: 'application/zip', ext: '.zip' };
  }

  // Older Office OLECF documents (doc, xls, ppt)
  if (checkHeader('D0 CF 11 E0 A1 B1 1A E1')) {
    const origExt = path.extname(originalName).toLowerCase();
    const allowedOlecfExts = ['.doc', '.xls', '.ppt'];
    if (allowedOlecfExts.includes(origExt)) {
      return { isValid: true, mimeType: getMimeForExtension(origExt), ext: origExt };
    }
    return { isValid: true, mimeType: 'application/msword', ext: '.doc' }; // fallback
  }

  // BMP: BM (42 4D)
  if (checkHeader('42 4D')) {
    return { isValid: true, mimeType: 'image/bmp', ext: '.bmp' };
  }

  // WEBP: RIFF (52 49 46 46) at 0, and WEBP (57 45 42 50) at 8
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return { isValid: true, mimeType: 'image/webp', ext: '.webp' };
  }

  // WAV: RIFF at 0, and WAVE at 8
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x41 && buffer[10] === 0x56 && buffer[11] === 0x45) {
    return { isValid: true, mimeType: 'audio/wav', ext: '.wav' };
  }

  // OGG: OggS (4F 67 67 53)
  if (checkHeader('4F 67 67 53')) {
    return { isValid: true, mimeType: 'audio/ogg', ext: '.ogg' };
  }

  // MP3: ID3 (49 44 33) or MPEG Frame Sync (FF FB / FF F3 / FF F2)
  if (checkHeader('49 44 33') || checkHeader('FF FB') || checkHeader('FF F3') || checkHeader('FF F2')) {
    return { isValid: true, mimeType: 'audio/mpeg', ext: '.mp3' };
  }

  // MP4: ftyp (66 74 79 70) at byte 4
  if (buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return { isValid: true, mimeType: 'video/mp4', ext: '.mp4' };
  }

  // WEBM: EBML (1A 45 DF A3)
  if (checkHeader('1A 45 DF A3')) {
    return { isValid: true, mimeType: 'video/webm', ext: '.webm' };
  }

  // AVI: RIFF at 0, and AVI (41 56 49 20) at 8
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x41 && buffer[9] === 0x56 && buffer[10] === 0x49 && buffer[11] === 0x20) {
    return { isValid: true, mimeType: 'video/x-msvideo', ext: '.avi' };
  }

  // AAC: ADTS frames (FF F1 or FF F9)
  if (checkHeader('FF F1') || checkHeader('FF F9')) {
    return { isValid: true, mimeType: 'audio/aac', ext: '.aac' };
  }

  // 2. Check for plain text files (e.g. TXT, CSV)
  // Text files should not contain binary null-bytes (0x00)
  let isText = true;
  for (let i = 0; i < buffer.length; i++) {
    if (buffer[i] === 0) {
      isText = false;
      break;
    }
  }

  if (isText) {
    const origExt = path.extname(originalName).toLowerCase();
    // Enforce that plain text files must have safe extensions (txt, csv)
    if (origExt !== '.txt' && origExt !== '.csv') {
      return { isValid: false };
    }

    const textContent = buffer.toString('utf8').toLowerCase();
    // Prevent script execution, XML, HTML, PHP or SVG from being loaded under text guise
    const hasMaliciousContent =
      textContent.includes('<html') ||
      textContent.includes('<body') ||
      textContent.includes('<script') ||
      textContent.includes('<svg') ||
      textContent.includes('<?php') ||
      textContent.includes('<?xml') ||
      textContent.includes('javascript:') ||
      textContent.includes('onload=') ||
      textContent.includes('onerror=') ||
      textContent.includes('<!doctype');

    if (hasMaliciousContent) {
      console.warn(`[FileValidator] Rejected text file due to potential script/markup inclusion: ${originalName}`);
      return { isValid: false };
    }

    return { isValid: true, mimeType: origExt === '.csv' ? 'text/csv' : 'text/plain', ext: origExt };
  }

  return { isValid: false };
}
