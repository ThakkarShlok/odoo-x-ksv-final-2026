import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow } from 'date-fns';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/** Format currency — always ₹, two decimals, right-alignable */
export function formatCurrency(value) {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '₹0.00';
  return `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Standard date format used everywhere: "18 Jul 2026, 3:41 PM" */
export function formatDate(dateStr) {
  if (!dateStr) return '—';
  return format(new Date(dateStr), 'dd MMM yyyy, h:mm a');
}

/** Short date: "18 Jul 2026" */
export function formatDateShort(dateStr) {
  if (!dateStr) return '—';
  return format(new Date(dateStr), 'dd MMM yyyy');
}

/** Relative: "3 days ago" */
export function formatRelative(dateStr) {
  if (!dateStr) return '—';
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
}

/** Status display config */
export const STATUS_CONFIG = {
  QUOTATION:  { label: 'Quotation',  color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  CONFIRMED:  { label: 'Confirmed',  color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  IN_RENTAL:  { label: 'In Rental',  color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  RETURNED:   { label: 'Returned',   color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' },
  CLOSED:     { label: 'Closed',     color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
  CANCELLED:  { label: 'Cancelled',  color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  AVAILABLE:  { label: 'Available',  color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400' },
  RENTED:     { label: 'Rented',     color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400' },
  RESERVED:   { label: 'Reserved',   color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
  DAMAGED:    { label: 'Damaged',    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' },
  RETIRED:    { label: 'Retired',    color: 'bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400' },
};

/** Get relevant placeholder image based on product keywords */
export function getProductImageUrl(productName = '', categoryName = '', fallbackId = '1') {
  const query = `${productName} ${categoryName}`.toLowerCase();
  
  if (query.includes('electric') || query.includes('bike') || query.includes('bicycle')) {
    return 'https://images.unsplash.com/photo-1572002958223-95989e2185d3?w=800&q=80';
  }
  if (query.includes('laptop') || query.includes('macbook')) {
    return 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&q=80';
  }
  if (query.includes('mobile') || query.includes('phone') || query.includes('iphone') || query.includes('samsung')) {
    return 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800&q=80';
  }
  if (query.includes('camera') || query.includes('dslr') || query.includes('lens')) {
    return 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&q=80';
  }
  if (query.includes('drone')) {
    return 'https://images.unsplash.com/photo-1507582020474-9a35b7d455d9?w=800&q=80';
  }
  if (query.includes('watch') || query.includes('smartwatch')) {
    return 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80';
  }
  if (query.includes('gaming') || query.includes('console') || query.includes('ps5') || query.includes('xbox')) {
    return 'https://images.unsplash.com/photo-1605901309584-818e25960b8f?w=800&q=80';
  }
  if (query.includes('headphone') || query.includes('earbud') || query.includes('audio')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80';
  }
  
  // Generic tech/product fallback
  return `https://picsum.photos/seed/${fallbackId}/800/600`;
}
