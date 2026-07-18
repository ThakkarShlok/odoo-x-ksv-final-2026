/**
 * WHAT: The one place that knows WHERE uploaded/seed images live on disk and under what URL they
 *   are served. Everything else (multer middleware, the admin image controller, the seed) imports
 *   these constants so the path is defined once, not re-derived per call site.
 * WHY LOCAL DISK, NOT AN EXTERNAL SERVICE (S3/Cloudinary): the venue demo must work OFFLINE. A
 *   remote image host is a network dependency that fails exactly when the projector is up and the
 *   wifi is not. Bytes on local disk, served by Express static, have no such failure mode. The
 *   tradeoff (no CDN, no multi-instance sharing) is irrelevant for a single-node demo and is the
 *   documented place where production would swap in object storage + a signed-URL scheme.
 *
 * Paths are resolved from THIS module's location (import.meta.url), not process.cwd(), so they are
 * correct no matter which directory the server is launched from.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)); // .../server/src/lib

// .../server/src/lib -> up two -> .../server/uploads
export const UPLOADS_ROOT = path.resolve(here, '../../uploads');
export const PRODUCTS_DIR = path.join(UPLOADS_ROOT, 'products'); // admin-uploaded product images
export const SEED_DIR = path.join(UPLOADS_ROOT, 'seed'); // seed-generated placeholder images

// The public URL prefix these are served under (see app.js static mount). A stored ProductImage.path
// like "products/<uuid>.jpg" becomes "<API_ORIGIN>/uploads/products/<uuid>.jpg" to the browser.
export const UPLOADS_URL_PREFIX = '/uploads';
