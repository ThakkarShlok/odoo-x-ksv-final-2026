/**
 * WHAT: multer configured for product-image upload to local disk, with a strict allow-list on type
 *   and a hard size cap. Exposes ONE middleware, `uploadProductImage`, that accepts a single file
 *   under the field name "image".
 * WHY VALIDATE TYPE + SIZE HERE, NOT IN THE CONTROLLER: the file is streamed to disk BEFORE the
 *   controller runs, so an unvalidated upload has already written bytes by the time a controller
 *   could object. The fileFilter rejects a bad MIME type before a byte is stored, and `limits`
 *   aborts an oversized stream mid-flight — both fail closed. We store only the generated PATH; the
 *   binary never touches the database (see schema comment on ProductImage).
 * SECURITY: the on-disk filename is a fresh UUID + a canonical extension derived from the *checked*
 *   MIME type — never the client-supplied `originalname`. That defeats path-traversal ("../../etc")
 *   and double-extension tricks ("evil.php.jpg") in the filename, because we never use the client
 *   string to name the file.
 *
 * Both failure modes are translated to a clean 422 (via AppError → errorHandler), matching the
 * validation contract the rest of the API uses. A raw MulterError would otherwise surface as a 500.
 */
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PRODUCTS_DIR } from '../lib/uploads.js';
import { AppError } from '../lib/apiResponse.js';

// Canonical extension per accepted MIME type. The map IS the allow-list: unknown type => rejected.
const ALLOWED_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif'],
]);

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — ample for a catalogue photo, small enough to bound disk.

// multer needs the destination to exist before it writes. Idempotent.
fs.mkdirSync(PRODUCTS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, PRODUCTS_DIR),
  filename: (_req, file, cb) => {
    const ext = ALLOWED_TYPES.get(file.mimetype) ?? '';
    cb(null, `${crypto.randomUUID()}${ext}`); // never the client's originalname
  },
});

function fileFilter(_req, file, cb) {
  if (!ALLOWED_TYPES.has(file.mimetype)) {
    return cb(new AppError(`Unsupported image type "${file.mimetype}". Allowed: JPEG, PNG, WebP, GIF.`, 422));
  }
  cb(null, true);
}

const single = multer({ storage, fileFilter, limits: { fileSize: MAX_BYTES, files: 1 } }).single('image');

/**
 * Wraps multer so its two structured failures (oversize, wrong field) become AppError(422) like the
 * fileFilter's type rejection, instead of a raw MulterError the error handler would treat as a 500.
 */
export function uploadProductImage(req, res, next) {
  single(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const message =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Image exceeds the 5 MB size limit.'
          : err.code === 'LIMIT_UNEXPECTED_FILE'
            ? 'Unexpected file field — upload the image under the field name "image".'
            : `Upload error: ${err.message}`;
      return next(new AppError(message, 422));
    }
    return next(err); // AppError from fileFilter, or a genuine unknown → 500
  });
}
