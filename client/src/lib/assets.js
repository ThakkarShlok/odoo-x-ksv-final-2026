/**
 * Build an absolute URL for a server asset (product image) from the path/url the API returns.
 * Images are served from the API ORIGIN (e.g. http://localhost:5000/uploads/...), NOT the /api
 * base the axios client uses — so we derive the origin by stripping the trailing /api. Absolute
 * URLs (http/https) are returned untouched, so this is safe if the backend ever returns a full URL.
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000/api').replace(/\/api\/?$/, '');

export function assetUrl(pathOrUrl) {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const p = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${API_ORIGIN}${p}`;
}
