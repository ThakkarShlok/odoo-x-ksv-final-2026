/**
 * One place for money and date formatting, so every screen agrees. Money is always 2 decimals
 * with a single currency symbol; dates use one date-fns format everywhere.
 */
import { format } from 'date-fns';

const CURRENCY = '₹'; // INR — matches the backend's default currency

/** Money: symbol + grouped, exactly 2 decimals. Accepts number or numeric string. */
export function money(value) {
  const n = Number(value ?? 0);
  return `${CURRENCY}${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Date: one format app-wide. */
export function fmtDate(value) {
  if (!value) return '—';
  return format(new Date(value), 'dd MMM yyyy');
}

/** Date + time, for events/timestamps. */
export function fmtDateTime(value) {
  if (!value) return '—';
  return format(new Date(value), 'dd MMM yyyy, HH:mm');
}
