/**
 * Order detail — shared by customer and admin, driven by the real GET /api/rentals/:id.
 * Renders the full order (lines, deposit ledger, late fees, events, payments, invoices) and the
 * role- and status-aware lifecycle actions that make the demo path work end to end:
 *   customer: Confirm & Pay (Razorpay checkout) on a QUOTATION; Cancel while QUOTATION/CONFIRMED.
 *   admin:    Handover (CONFIRMED→IN_RENTAL); Return (IN_RENTAL→RETURNED, shows penalty);
 *             Settle deposit (RETURNED→CLOSED, shows deduction + refund breakdown).
 * The deposit balance shown is derived from the ledger (no balance column), matching the schema.
 */
import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { AlertCircle, ArrowLeft, CreditCard, LoaderCircle, RotateCcw, Truck, Wallet, X, XCircle } from 'lucide-react';
import { useAuth } from '@/features/auth/context/AuthContext';
import { fetchRentalById, cancelRental, handover, returnScan } from '../api/rentals';
import { createPaymentOrder, loadRazorpayCheckout, verifyPayment } from '@/features/payments/api/payments';
import { reconcileDeposit } from '@/features/deposits/api/deposits';
import { getErrorMessage } from '@/api/axios';
import { money, fmtDate, fmtDateTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/common/StatusBadge';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';

function Row({ label, value, strong, accent }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''} ${accent ? 'text-accent' : ''}`}>{value}</span>
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();

  const [state, setState] = useState({ status: 'loading', order: null, error: null });
  const [acting, setActing] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutState, setCheckoutState] = useState({ status: 'idle', error: null });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.order ? 'ready' : 'loading' }));
    try {
      const order = await fetchRentalById(id);
      setState({ status: 'ready', order, error: null });
    } catch (error) {
      setState({ status: 'error', order: null, error: getErrorMessage(error) });
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const order = state.order;

  async function run(fn, successMsg) {
    setActing(true);
    try {
      const result = await fn();
      if (successMsg) toast.success(typeof successMsg === 'function' ? successMsg(result) : successMsg);
      await load();
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) toast.error('Conflict: ' + getErrorMessage(error));
      else toast.error(getErrorMessage(error));
    } finally {
      setActing(false);
    }
  }

  async function startCheckout() {
    if (!order) return;

    setCheckoutState({ status: 'starting', error: null });
    try {
      const gatewayOrder = await createPaymentOrder(order.id);
      const Razorpay = await loadRazorpayCheckout();

      if (!Razorpay) {
        throw new Error('Razorpay Checkout is unavailable in this browser.');
      }

      setCheckoutState({ status: 'checkout_open', error: null });

      const rzp = new Razorpay({
        key: gatewayOrder.keyId,
        amount: gatewayOrder.amountPaise,
        currency: gatewayOrder.currency,
        name: 'Zenith Rentals',
        description: `Rental payment for ${gatewayOrder.orderNumber}`,
        order_id: gatewayOrder.razorpayOrderId,
        prefill: {
          name: gatewayOrder.customer?.name ?? user?.fullName ?? '',
          email: gatewayOrder.customer?.email ?? user?.email ?? '',
        },
        theme: { color: '#b45309' },
        modal: {
          ondismiss: () => {
            setCheckoutState({ status: 'dismissed', error: null });
            setCheckoutOpen(false);
            toast('Checkout dismissed before payment confirmation.');
          },
        },
        handler: async (response) => {
          setCheckoutState({ status: 'verifying', error: null });
          try {
            await verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });
            setCheckoutOpen(false);
            setCheckoutState({ status: 'verified', error: null });
            toast.success('Payment verified. Order confirmed.');
            await load();
          } catch (error) {
            const message = getErrorMessage(error, 'Payment verification failed.');
            setCheckoutState({ status: 'failed', error: message });
            toast.error(message);
          }
        },
      });

      rzp.on('payment.failed', (event) => {
        const message = event?.error?.description || 'Razorpay reported a payment failure.';
        setCheckoutState({ status: 'failed', error: message });
        toast.error(message);
      });

      rzp.open();
    } catch (error) {
      const message = getErrorMessage(error, 'Unable to start Razorpay checkout.');
      setCheckoutState({ status: 'failed', error: message });
      toast.error(message);
    }
  }

  if (state.status === 'loading') return <Loading label="Loading order..." />;
  if (state.status === 'error') return <ErrorState message={state.error} onRetry={load} />;
  if (!order) return null;

  const barcodes = order.lines.map((l) => l.serialNumber);
  const dueNow = Number(order.total) + Number(order.depositTotal);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to={isAdmin ? '/app/rentals' : '/app/orders'}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{order.orderNumber}</h1>
          <p className="text-muted-foreground">
            {fmtDate(order.rentalStart)} {'->'} {fmtDate(order.rentalEnd)} · {order.fulfillmentMethod === 'DELIVERY' ? 'Delivery' : 'Store pickup'}
            {order.customer && isAdmin ? ` · ${order.customer.name}` : ''}
          </p>
        </div>
        <StatusBadge status={order.status} className="text-sm" />
      </div>

      <div className="flex flex-wrap gap-2">
        {order.status === 'QUOTATION' ? (
          <Button onClick={() => { setCheckoutOpen(true); setCheckoutState({ status: 'idle', error: null }); }} disabled={acting}>
            <CreditCard className="h-4 w-4" /> Confirm & Pay {money(dueNow)}
          </Button>
        ) : null}

        {isAdmin && order.status === 'CONFIRMED' ? (
          <Button onClick={() => run(() => handover(order.id, barcodes), 'Handover recorded. Now on rent.')} disabled={acting}>
            <Truck className="h-4 w-4" /> Record handover
          </Button>
        ) : null}

        {isAdmin && order.status === 'IN_RENTAL' ? (
          <Button
            onClick={() =>
              run(
                () => returnScan(order.id, barcodes),
                (r) => (Number(r.lateFeesCalculated) > 0 ? `Returned. Late fee ${money(r.lateFeesCalculated)} applied.` : 'Returned on time. No penalty.')
              )
            }
            disabled={acting}
          >
            <RotateCcw className="h-4 w-4" /> Record return
          </Button>
        ) : null}

        {isAdmin && order.status === 'RETURNED' ? (
          <Button
            onClick={() =>
              run(
                () => reconcileDeposit(order.id),
                (r) => `Deposit settled. Refunded ${money(r.refundedAmount)}${Number(r.lateFeesDeducted) > 0 ? `, deducted ${money(r.lateFeesDeducted)}` : ''}.`
              )
            }
            disabled={acting}
          >
            <Wallet className="h-4 w-4" /> Settle deposit
          </Button>
        ) : null}

        {(order.status === 'QUOTATION' || order.status === 'CONFIRMED') ? (
          <Button variant="outline" onClick={() => run(() => cancelRental(order.id), 'Order cancelled.')} disabled={acting}>
            <XCircle className="h-4 w-4" /> Cancel
          </Button>
        ) : null}
      </div>

      {checkoutOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6">
          <div className="w-full max-w-md rounded-[1.5rem] border border-border bg-card p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-primary">Razorpay Test Checkout</p>
                <h2 className="mt-2 text-xl font-semibold text-foreground">Confirm payment for {order.orderNumber}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  The server verifies Razorpay&apos;s signature before the order is marked paid. Closing Checkout does not confirm anything.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCheckoutOpen(false);
                  setCheckoutState({ status: 'dismissed', error: null });
                }}
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label="Close payment dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-2 rounded-2xl border border-border bg-background p-4">
              <Row label="Rental total" value={money(order.total)} />
              <Row label="Security deposit" value={money(order.depositTotal)} accent />
              <div className="border-t border-border pt-2">
                <Row label="Charge now" value={money(dueNow)} strong />
              </div>
            </div>

            {checkoutState.error ? (
              <div className="mt-4 flex gap-3 rounded-2xl border border-destructive/20 bg-status-danger-bg px-4 py-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>{checkoutState.error}</p>
              </div>
            ) : null}

            {checkoutState.status === 'dismissed' ? (
              <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
                Checkout was dismissed before payment confirmation.
              </div>
            ) : null}

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                className="flex-1"
                onClick={startCheckout}
                disabled={checkoutState.status === 'starting' || checkoutState.status === 'checkout_open' || checkoutState.status === 'verifying'}
              >
                {checkoutState.status === 'starting' || checkoutState.status === 'verifying' ? (
                  <><LoaderCircle className="h-4 w-4 animate-spin" /> {checkoutState.status === 'verifying' ? 'Verifying...' : 'Starting...'}</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Pay with Razorpay</>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCheckoutOpen(false);
                  setCheckoutState({ status: 'dismissed', error: null });
                }}
                disabled={checkoutState.status === 'verifying'}
              >
                Cancel
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Production note: the webhook should reuse the same verified finalization path as this browser callback.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Items</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="pb-2 font-medium">Product</th>
                    <th className="pb-2 font-medium">Unit</th>
                    <th className="pb-2 text-right font-medium">Rate</th>
                    <th className="pb-2 text-right font-medium">Days</th>
                    <th className="pb-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2">{l.productName}</td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">{l.serialNumber}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.rateApplied)}</td>
                      <td className="py-2 text-right tabular-nums">{l.durationCount}</td>
                      <td className="py-2 text-right tabular-nums">{money(l.lineSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <Row label="Subtotal" value={money(order.subtotal)} />
              <Row label="Security deposit" value={money(order.depositTotal)} accent />
              {Number(order.totalPenalties) > 0 ? <Row label="Penalties" value={money(order.totalPenalties)} /> : null}
              <Row label="Order total" value={money(order.total)} strong />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between text-base">
              Deposit
              <StatusBadge status={order.deposit.status === 'SETTLED' ? 'CLOSED' : order.deposit.status === 'HELD' ? 'IN_RENTAL' : 'INACTIVE'} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Row label="Held" value={money(order.deposit.amountHeld)} />
            {Number(order.deposit.amountDeducted) > 0 ? <Row label="Deducted" value={`- ${money(order.deposit.amountDeducted)}`} /> : null}
            {Number(order.deposit.amountRefunded) > 0 ? <Row label="Refunded" value={`- ${money(order.deposit.amountRefunded)}`} /> : null}
            <div className="mt-1 border-t border-border pt-1">
              <Row label="Balance" value={money(order.deposit.balance)} strong />
            </div>
            {order.deposit.ledger.length > 0 ? (
              <ul className="mt-3 space-y-1.5 border-t border-border pt-3 text-xs">
                {order.deposit.ledger.map((e) => (
                  <li key={e.id} className="flex items-start justify-between gap-2">
                    <span className="text-muted-foreground">{e.entryType} · {fmtDate(e.createdAt)}</span>
                    <span className="tabular-nums">{money(e.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {order.lateFees.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Late fee</CardTitle></CardHeader>
          <CardContent>
            {order.lateFees.map((f) => (
              <div key={f.id} className="grid gap-2 sm:grid-cols-2">
                <Row label="Penalty" value={money(f.amount)} strong />
                <Row label="Days late" value={f.daysLate} />
                <Row label="Rule" value={`${f.ruleType} · ${money(f.ruleValue)}`} />
                <Row label="Grace / cap" value={`${f.graceHours}h / ${money(f.capAmount)}`} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {order.events.length > 0 ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Pickup & return</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {order.events.map((e) => (
              <div key={e.id} className="flex items-center justify-between">
                <span className="font-medium">{e.eventType === 'PICKUP' ? 'Pickup' : 'Return'}</span>
                <span className="text-muted-foreground">
                  Scheduled {fmtDate(e.scheduledAt)} · {e.actualAt ? `done ${fmtDateTime(e.actualAt)}` : 'pending'}
                  {e.damageFlag ? ' · damage flagged' : ''}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
