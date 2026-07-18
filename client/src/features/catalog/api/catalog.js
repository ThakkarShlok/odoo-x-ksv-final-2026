/** Catalogue API — the new public customer endpoints (real pricelist rates + genuine availability). */
import api from '@/api/axios';

export async function fetchCatalog({ page = 1, limit = 12, categoryId, search, sort, minPrice, maxPrice, from, to } = {}) {
  const res = await api.get('/catalog', {
    params: { page, limit, categoryId, search, sort, minPrice, maxPrice, from, to },
  });
  return res.data; // { data:[products w/ primaryImage], meta:{ totalCount, page, limit, totalPages } }
}

export async function checkAvailability({ productId, from, to }) {
  const res = await api.get('/catalog/availability', { params: { productId, from, to } });
  return res.data.data; // { available, availableCount, availableUnits, rates, estimatedSubtotal, ... }
}

// Categories for the storefront filter — the real taxonomy from the public catalog endpoint.
// (Was GET /api/products, now deprecated; /api/catalog/categories is the successor.)
export async function fetchCategories() {
  const res = await api.get('/catalog/categories');
  return res.data.data; // [{ id, name, slug, productCount }]
}
