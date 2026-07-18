/** Admin catalogue-management API — products, categories, rates, units, images (/api/admin/*). */
import api from '@/api/axios';

// ----- Products -------------------------------------------------------------
export async function fetchAdminProducts({ page = 1, limit = 20, categoryId, search } = {}) {
  const res = await api.get('/admin/products', { params: { page, limit, categoryId, search } });
  return res.data; // { data:[...], meta }
}

export async function fetchAdminProduct(id) {
  const res = await api.get(`/admin/products/${id}`);
  return res.data.data; // full detail incl units, images, rates
}

export async function createProduct(body) {
  const res = await api.post('/admin/products', body);
  return res.data.data;
}

export async function updateProduct(id, body) {
  const res = await api.patch(`/admin/products/${id}`, body);
  return res.data.data;
}

export async function deleteProduct(id) {
  const res = await api.delete(`/admin/products/${id}`);
  return res.data.data;
}

// ----- Categories -----------------------------------------------------------
export async function fetchAdminCategories() {
  const res = await api.get('/admin/categories');
  return res.data.data; // [{ id, name, productCount, ... }]
}

export async function createCategory(body) {
  const res = await api.post('/admin/categories', body);
  return res.data.data;
}

// ----- Units ----------------------------------------------------------------
export async function createUnit(productId, body) {
  const res = await api.post(`/admin/products/${productId}/units`, body);
  return res.data.data;
}

export async function deleteUnit(unitId) {
  const res = await api.delete(`/admin/units/${unitId}`);
  return res.data.data;
}

// ----- Images ---------------------------------------------------------------
export async function uploadProductImage(productId, file) {
  const form = new FormData();
  form.append('image', file);
  // Let the browser set the multipart boundary — axios recomputes Content-Type for FormData when we
  // clear the JSON default that the shared instance otherwise applies.
  const res = await api.post(`/admin/products/${productId}/images`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.data; // { id, path, url, isPrimary, sortOrder }
}

export async function setPrimaryImage(productId, imageId) {
  const res = await api.patch(`/admin/products/${productId}/images/${imageId}/primary`);
  return res.data.data;
}

export async function deleteProductImage(productId, imageId) {
  const res = await api.delete(`/admin/products/${productId}/images/${imageId}`);
  return res.data.data;
}
