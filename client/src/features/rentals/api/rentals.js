/** Rentals API — quotations, order detail, and the admin lifecycle actions. */
import api from '@/api/axios';

export async function fetchRentals({ page = 1, limit = 20, status, customerId } = {}) {
  const res = await api.get('/rentals', { params: { page, limit, status, customerId } });
  return res.data; // { data:[orders], meta:{ totalCount, page, limit, totalPages } }
}

export async function fetchRentalById(id) {
  const res = await api.get(`/rentals/${id}`);
  return res.data.data; // full detail
}

export async function createQuotation({ rentalStart, rentalEnd, fulfillmentMethod, items, customerId }) {
  const res = await api.post('/rentals', { rentalStart, rentalEnd, fulfillmentMethod, items, customerId });
  return res.data.data;
}

export async function handover(id, barcodes) {
  const res = await api.post(`/rentals/${id}/handover`, { barcodes });
  return res.data;
}

export async function returnScan(id, barcodes) {
  const res = await api.post(`/rentals/${id}/return-scan`, { barcodes });
  return res.data.data; // { lateFeesCalculated, actualReturnTime, ... }
}

export async function cancelRental(id) {
  const res = await api.post(`/rentals/${id}/cancel`, {});
  return res.data;
}
