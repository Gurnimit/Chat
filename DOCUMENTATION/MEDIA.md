# MEDIA.md

## File Upload System

### Upload Flow
1. Client selects file, validates MIME type and size locally
2. File uploaded via multipart form-data to `POST /api/upload`
3. Server saves as `.tmp` file first (neutral extension)
4. Server validates file signature using magic bytes (262-byte header read)
5. Server determines correct extension and MIME from magic bytes
6. File renamed from `.tmp` to correct extension
7. File URL returned: `/uploads/{uniqueSuffix}.{ext}`

### Accepted File Types
| Category | MIME Types | Size Limit |
|----------|-----------|------------|
| Image | jpeg, png, gif, webp, bmp | 25 MB |
| Video | mp4, mpeg, quicktime, webm, x-msvideo | 500 MB |
| Audio | mpeg, ogg, wav, webm, aac | 100 MB |
| Document | pdf, plain text, csv, msword, office formats | 100 MB |
| Archive | zip, x-zip-compressed | 250 MB |

### Security
- **Layer 1**: MIME type validation from client header
- **Layer 2**: Magic byte signature verification (server-side)
- Blocked: Executables, HTML, JavaScript, SVGs, PHP, XML
- Text files checked for malicious content (script tags, event handlers)
- CSP sandbox header on static file serving
- Content-Disposition set per file type (inline for safe, attachment for others)

### File Storage
- **Location**: `server/uploads/` directory
- **Naming**: `{Date.now()}-{random}.{validated_ext}`
- **Serving**: Express static middleware with security headers
- **Persistence**: Docker volume mount `./server/uploads:/usr/src/app/uploads`

## Audio Assets
Located in `soundsforcall/` and `client/public/sounds/`:
- `ringtone.mp3` — Incoming call ring (looped)
- `callertone.mp3` — Outgoing call tone (looped)
- `messagetone.mp3` — Notification sound (one-shot)

Audio unlocked on first user interaction (click/keydown) to comply with browser autoplay policies.

## Avatar Images
- Default avatars generated via DiceBear API: `https://api.dicebear.com/7.x/bottts/svg?seed={username}`
- User can upload custom avatar via profile settings
- Avatar URLs stored in `Profile.avatarUrl`
- Avatar upload handled via the general file upload system

## Image Rendering
- Images displayed inline in chat messages via `<img>` tags
- Full URLs resolved via `getAbsoluteUrl()` helper (handles relative paths for Capacitor)
- Attachment downloads open in system browser on Capacitor, new tab on web

## No Image Processing
- No server-side image resizing or optimization
- No thumbnail generation
- No CDN or object storage integration
- All files served directly from filesystem
