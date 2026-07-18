/** Deposits API — settlement. */
import api from '@/api/axios';

export async function reconcileDeposit(orderId) {
  // The backend accepts an order id here (it resolves ledger-id-or-order-id).
  const res = await api.post(`/deposits/${orderId}/reconcile`, {});
  return res.data.data; // { amountHeld, lateFeesDeducted, refundedAmount, status }
}
