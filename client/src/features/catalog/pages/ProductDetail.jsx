/**
 * Product detail + rent flow: pick a date range -> live availability check (real overlap endpoint)
 * -> create a quotation on an available unit. On success we go to the order where the customer
 * confirms + pays the deposit. Availability is genuine (server checks reservation overlap), so the
 * quotation rarely 409s — but if it does (a race), we surface the conflict clearly.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, ArrowUpRight, CalendarRange, CheckCircle2, Package, XCircle } from 'lucide-react';
import { fetchCatalog, checkAvailability } from '../api/catalog';
import { createQuotation } from '@/features/rentals/api/rentals';
import { getErrorMessage } from '@/api/axios';
import { money } from '@/lib/format';
import { assetUrl } from '@/lib/assets';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loading } from '@/components/common/Loading';

function toLocalInput(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ProductDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const [product, setProduct] = useState(location.state?.product ?? null);
  const [loadingProduct, setLoadingProduct] = useState(!location.state?.product);

  const defaults = useMemo(() => {
    const from = new Date();
    from.setDate(from.getDate() + 1);
    from.setHours(10, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 3);
    return { from: toLocalInput(from), to: toLocalInput(to) };
  }, []);

  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [avail, setAvail] = useState({ status: 'idle', data: null, error: null });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (product) return;
    fetchCatalog({ limit: 100 })
      .then((res) => setProduct(res.data.find((p) => p.id === id) ?? null))
      .catch(() => {})
      .finally(() => setLoadingProduct(false));
  }, [id, product]);

  async function onCheck(e) {
    e?.preventDefault();
    const fromIso = new Date(from).toISOString();
    const toIso = new Date(to).toISOString();
    if (new Date(to) <= new Date(from)) {
      setAvail({ status: 'error', data: null, error: 'End date must be after start date.' });
      return;
    }
    setAvail({ status: 'checking', data: null, error: null });
    try {
      const data = await checkAvailability({ productId: id, from: fromIso, to: toIso });
      setAvail({ status: 'done', data, error: null });
    } catch (error) {
      setAvail({ status: 'error', data: null, error: getErrorMessage(error) });
    }
  }

  async function onCreateQuotation() {
    const unit = avail.data?.availableUnits?.[0];
    if (!unit) return;
    setCreating(true);
    try {
      const order = await createQuotation({
        rentalStart: new Date(from).toISOString(),
        rentalEnd: new Date(to).toISOString(),
        fulfillmentMethod: 'STORE_PICKUP',
        items: [{ assetId: unit.id }],
      });
      toast.success('Quotation created. Review and confirm.');
      navigate(`/app/orders/${order.id}`);
    } catch (error) {
      if (error.response?.status === 409) {
        toast.error('That unit was just booked for these dates. Re-check availability.');
        setAvail({ status: 'idle', data: null, error: null });
      } else {
        toast.error(getErrorMessage(error, 'Could not create quotation.'));
      }
    } finally {
      setCreating(false);
    }
  }

  if (loadingProduct) return <Loading label="Loading product..." />;
  if (!product) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-muted-foreground">Product not found.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/app">Back to catalogue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/app">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
          <div className="aspect-[5/4] overflow-hidden bg-white sm:aspect-[16/11]">
            {product.primaryImage ? (
              <img src={assetUrl(product.primaryImage.url)} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-muted-foreground"><Package className="h-10 w-10" aria-hidden="true" /></div>
            )}
          </div>

          <div className="space-y-6 p-6 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2">
                <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">{product.categoryName}</p>
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight text-foreground">{product.name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {product.brand ? `${product.brand}` : 'Rental-ready equipment'}
                    {product.manufacturer ? ` by ${product.manufacturer}` : ''}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground">
                View live rates <ArrowUpRight className="h-4 w-4" />
              </span>
            </div>

            {product.description ? (
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{product.description}</p>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Daily</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{product.rates?.DAILY ? money(product.rates.DAILY) : '—'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Weekly</p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{product.rates?.WEEKLY ? money(product.rates.WEEKLY) : '—'}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background p-4">
                <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Availability now</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{product.unitsAvailableNow ?? 0}</p>
              </div>
            </div>

            <dl className="grid gap-3 border-t border-border pt-5 text-sm sm:grid-cols-2">
              {product.manufacturer ? (
                <div className="rounded-xl bg-background px-4 py-3"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Manufacturer</dt><dd className="mt-1 font-medium text-foreground">{product.manufacturer}</dd></div>
              ) : null}
              {product.color ? (
                <div className="rounded-xl bg-background px-4 py-3"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Colour</dt><dd className="mt-1 font-medium text-foreground">{product.color}</dd></div>
              ) : null}
              {product.size ? (
                <div className="rounded-xl bg-background px-4 py-3"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Size</dt><dd className="mt-1 font-medium text-foreground">{product.size}</dd></div>
              ) : null}
              <div className="rounded-xl bg-background px-4 py-3"><dt className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Rate model</dt><dd className="mt-1 font-medium text-foreground">Pricing is snapshotted onto the quotation.</dd></div>
            </dl>
          </div>
        </section>

        <Card className="rounded-[1.75rem] border-border shadow-sm">
          <CardHeader className="space-y-3 p-6 sm:p-7">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-secondary text-primary">
              <CalendarRange className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl">Check availability</CardTitle>
              <CardDescription className="mt-1 text-sm leading-6">
                Choose your rental window, verify available units, then create a quotation from the same card.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 p-6 pt-0 sm:p-7 sm:pt-0">
            <form onSubmit={onCheck} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="from">From</Label>
                <Input id="from" type="datetime-local" value={from} onChange={(e) => { setFrom(e.target.value); setAvail({ status: 'idle', data: null, error: null }); }} className="h-11 rounded-xl bg-background" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="to">To</Label>
                <Input id="to" type="datetime-local" value={to} onChange={(e) => { setTo(e.target.value); setAvail({ status: 'idle', data: null, error: null }); }} className="h-11 rounded-xl bg-background" />
              </div>
              <Button type="submit" variant="outline" className="h-11 w-full rounded-xl" disabled={avail.status === 'checking'}>
                {avail.status === 'checking' ? 'Checking...' : 'Check availability'}
              </Button>
            </form>

            {avail.status === 'error' ? (
              <p className="rounded-xl border border-destructive/20 bg-status-danger-bg px-4 py-3 text-sm text-destructive">{avail.error}</p>
            ) : null}

            {avail.status === 'done' && avail.data ? (
              <div className={`rounded-[1.25rem] border p-4 ${avail.data.available ? 'border-status-active/30 bg-status-active-bg' : 'border-status-danger/30 bg-status-danger-bg'}`}>
                {avail.data.available ? (
                  <>
                    <p className="flex items-center gap-2 font-medium text-status-active">
                      <CheckCircle2 className="h-4 w-4" /> {avail.data.availableCount} available unit{avail.data.availableCount > 1 ? 's' : ''} for these dates
                    </p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Duration</span><span>{avail.data.durationDays} day(s)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Estimated rental</span><span className="font-semibold tabular-nums">{money(avail.data.estimatedSubtotal ?? 0)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="text-right">Shown in the quotation total</span></div>
                    </div>
                    <Button className="mt-4 h-11 w-full rounded-xl" onClick={onCreateQuotation} disabled={creating}>
                      {creating ? 'Creating...' : 'Create quotation'}
                    </Button>
                    <p className="mt-2 text-center text-xs text-muted-foreground">Security deposit is visible before confirmation and settlement.</p>
                  </>
                ) : (
                  <p className="flex items-center gap-2 font-medium text-status-danger">
                    <XCircle className="h-4 w-4" /> Unavailable for these dates.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-[1.25rem] border border-border bg-background p-4 text-sm text-muted-foreground">
                Start with a date range to see exact unit availability instead of a generic stock number.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
