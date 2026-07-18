/** Payments API. */
import api from '@/api/axios';

let razorpayScriptPromise = null;

export async function createPaymentOrder(orderId) {
  const res = await api.post('/payments/create-order', { orderId });
  return res.data.data;
}

export async function verifyPayment({ orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature }) {
  const res = await api.post('/payments/verify', {
    orderId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  });
  return res.data.data;
}

export async function loadRazorpayCheckout() {
  if (typeof window === 'undefined') throw new Error('Razorpay checkout requires a browser environment.');
  if (window.Razorpay) return window.Razorpay;
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay-checkout="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(window.Razorpay), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay Checkout.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.dataset.razorpayCheckout = 'true';
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout.'));
    document.body.appendChild(script);
  }).catch((error) => {
    razorpayScriptPromise = null;
    throw error;
  });

  return razorpayScriptPromise;
}

export async function listPayments({ page = 1, limit = 20 } = {}) {
  const res = await api.get('/payments', { params: { page, limit } });
  return res.data;
}
