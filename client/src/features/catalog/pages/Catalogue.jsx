/**
 * Customer catalogue — browse rentable products from the real /api/catalog. Filtering (category,
 * price range, availability window), sorting, and pagination are ALL passed through to the server
 * (the endpoint does them in SQL) — the client never fetches everything and filters locally. Three
 * explicit states (loading / error+retry / empty). Cards show the product's primary image.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Package, Search, SlidersHorizontal, X } from 'lucide-react';
import { fetchCatalog, fetchCategories } from '../api/catalog';
import { getErrorMessage } from '@/api/axios';
import { money } from '@/lib/format';
import { assetUrl } from '@/lib/assets';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loading } from '@/components/common/Loading';
import { ErrorState } from '@/components/common/ErrorState';
import { EmptyState } from '@/components/common/EmptyState';

const SORTS = [
  { value: 'name', label: 'Name (A-Z)' },
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const PAGE_SIZE = 12;
const EMPTY = { categoryId: '', search: '', sort: 'name', minPrice: '', maxPrice: '', from: '', to: '', page: 1 };

function CardBadge({ available, children }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[0.7rem] font-medium uppercase tracking-[0.14em] ${
        available ? 'bg-status-active-bg text-status-active' : 'bg-status-inactive-bg text-status-inactive'
      }`}
    >
      {children}
    </span>
  );
}

export default function Catalogue() {
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null });
  const [categories, setCategories] = useState([]);
  // `query` is the APPLIED filter set (drives fetches). `draft` holds unapplied sidebar edits.
  const [query, setQuery] = useState(EMPTY);
  const [draft, setDraft] = useState(EMPTY);

  const load = useCallback(async (q) => {
    setState((s) => ({ ...s, status: 'loading' }));
    try {
      const res = await fetchCatalog({
        page: q.page,
        limit: PAGE_SIZE,
        categoryId: q.categoryId || undefined,
        search: q.search || undefined,
        sort: q.sort || undefined,
        minPrice: q.minPrice || undefined,
        maxPrice: q.maxPrice || undefined,
        from: q.from ? new Date(q.from).toISOString() : undefined,
        to: q.to ? new Date(q.to).toISOString() : undefined,
      });
      setState({ status: 'ready', items: res.data, meta: res.meta, error: null });
    } catch (error) {
      setState({ status: 'error', items: [], meta: null, error: getErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    load(query);
  }, [load, query]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
  }, []);

  // Apply the draft (resets to page 1); patch merges a single field and refetches immediately.
  const applyDraft = () => setQuery({ ...draft, page: 1 });
  const patch = (changes) => {
    const next = { ...query, ...changes, page: changes.page ?? 1 };
    setQuery(next);
    setDraft((d) => ({ ...d, ...changes }));
  };
  const reset = () => {
    setDraft(EMPTY);
    setQuery(EMPTY);
  };

  const meta = state.meta;
  const activeFilters = query.categoryId || query.minPrice || query.maxPrice || query.from || query.search;
  const windowed = Boolean(meta?.windowed);
  const depositRule = meta?.depositRule;
  const depositLabel = depositRule
    ? depositRule.ruleType === 'PERCENTAGE'
      ? `${Number(depositRule.value)}% refundable deposit`
      : `${money(depositRule.value)} refundable deposit`
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-sm">
        <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[1.25fr_auto] lg:items-end lg:px-8 lg:py-8">
          <div className="space-y-3">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.2em] text-primary">Zenith Rentals Catalogue</p>
            <div className="space-y-2">
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Real equipment, real photography, and availability you can trust.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                Browse by category, narrow by rental window, and compare pricing without leaving the catalogue.
                {meta ? ` ${meta.totalCount} product${meta.totalCount === 1 ? '' : 's'} are live right now.` : ''}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[25rem]">
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Daily pricing</p>
              <p className="mt-2 text-lg font-semibold text-foreground">Front and center on every card</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Deposit visibility</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{depositLabel ?? 'Shown from active rules'}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/70 px-4 py-3">
              <p className="text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">Date aware</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{windowed ? 'Window-filtered stock' : 'Current stock view'}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays className="h-4 w-4 text-primary" aria-hidden="true" />
          {windowed ? 'Availability badges reflect your selected rental dates.' : 'Add dates to switch from current stock to date-specific availability.'}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="sort" className="text-sm text-muted-foreground">Sort</Label>
          <select
            id="sort"
            value={query.sort}
            onChange={(e) => patch({ sort: e.target.value })}
            className="h-10 rounded-full border border-input bg-card px-4 text-sm shadow-sm"
          >
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[260px_1fr]">
        <aside className="h-fit rounded-[1.5rem] border border-border bg-card p-5 shadow-sm xl:sticky xl:top-6">
          <div className="space-y-6">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                Refine results
                {activeFilters ? (
                  <button
                    onClick={reset}
                    className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                ) : null}
              </div>
              <form onSubmit={(e) => { e.preventDefault(); patch({ search: draft.search }); }} className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  value={draft.search}
                  onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                  placeholder="Search equipment"
                  className="h-11 rounded-xl border-border bg-background pl-9"
                  aria-label="Search products"
                />
              </form>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">Category</p>
              <div className="space-y-1.5">
                <button
                  onClick={() => patch({ categoryId: '' })}
                  className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                    query.categoryId === '' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'
                  }`}
                >
                  All categories
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => patch({ categoryId: c.id })}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                      query.categoryId === c.id ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-secondary'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className={`text-xs ${query.categoryId === c.id ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{c.productCount}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">Daily price (INR)</p>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <Input type="number" min="0" inputMode="numeric" value={draft.minPrice} onChange={(e) => setDraft((d) => ({ ...d, minPrice: e.target.value }))} placeholder="Min" aria-label="Minimum price" className="h-11 rounded-xl bg-background" />
                <span className="text-muted-foreground">-</span>
                <Input type="number" min="0" inputMode="numeric" value={draft.maxPrice} onChange={(e) => setDraft((d) => ({ ...d, maxPrice: e.target.value }))} placeholder="Max" aria-label="Maximum price" className="h-11 rounded-xl bg-background" />
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold">Available for dates</p>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="from" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">From</Label>
                  <Input id="from" type="datetime-local" value={draft.from} onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))} className="h-11 rounded-xl bg-background" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="to" className="text-xs uppercase tracking-[0.12em] text-muted-foreground">To</Label>
                  <Input id="to" type="datetime-local" value={draft.to} onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))} className="h-11 rounded-xl bg-background" />
                </div>
                {draft.from && !draft.to ? <p className="text-xs text-destructive">Pick an end date too.</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-background p-3 text-sm text-muted-foreground">
              Availability badges switch from current stock to date-specific unit counts when both dates are applied.
            </div>

            <Button onClick={applyDraft} className="h-11 w-full rounded-xl" disabled={Boolean(draft.from) !== Boolean(draft.to)}>Apply filters</Button>
          </div>
        </aside>

        <div>
          {state.status === 'loading' ? <Loading label="Loading catalogue..." /> : null}
          {state.status === 'error' ? <ErrorState title="Couldn't load the catalogue" message={state.error} onRetry={() => load(query)} /> : null}
          {state.status === 'ready' && state.items.length === 0 ? <EmptyState title="No products found" message="Try clearing filters or a different search." /> : null}

          {state.status === 'ready' && state.items.length > 0 ? (
            <>
              <div className="grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
                {state.items.map((p) => {
                  const count = windowed ? p.availableInWindow : p.unitsAvailableNow;
                  const available = count > 0;
                  const badgeText = windowed
                    ? available ? `${count} available` : 'Unavailable for these dates'
                    : available ? `${count} available` : 'Out of stock';

                  return (
                    <Card key={p.id} className="group flex h-full flex-col overflow-hidden rounded-[1.5rem] border-border bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                      <Link to={`/app/product/${p.id}`} state={{ product: p }} className="block bg-white">
                        <div className="aspect-[5/4] overflow-hidden bg-white">
                          {p.primaryImage ? (
                            <img src={assetUrl(p.primaryImage.url)} alt={p.name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground"><Package className="h-8 w-8" aria-hidden="true" /></div>
                          )}
                        </div>
                      </Link>

                      <CardContent className="flex flex-1 flex-col p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[0.68rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">{p.categoryName}</p>
                            <h3 className="mt-1 line-clamp-2 min-h-[3.25rem] text-lg font-semibold leading-6 text-foreground">{p.name}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{p.brand ?? 'Rental-ready unit'}</p>
                          </div>
                          <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" aria-hidden="true" />
                        </div>

                        <div className="mt-4 flex min-h-[2.25rem] items-start">
                          <CardBadge available={available}>{badgeText}</CardBadge>
                        </div>

                        <div className="mt-4 space-y-2 border-t border-border pt-4">
                          <div className="flex items-end justify-between gap-3">
                            <div>
                              <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted-foreground">Daily rate</p>
                              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{p.rates?.DAILY ? money(p.rates.DAILY) : '—'}</p>
                            </div>
                            <p className="pb-1 text-xs text-muted-foreground">per day</p>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Weekly</span>
                            <span className="tabular-nums">{p.rates?.WEEKLY ? money(p.rates.WEEKLY) : 'Not listed'}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <span>Deposit</span>
                            <span className="text-right">{depositLabel ?? 'Shown at checkout'}</span>
                          </div>
                        </div>

                        <Button asChild className="mt-3 w-full rounded-xl"><Link to={`/app/product/${p.id}`} state={{ product: p }}>Rent</Link></Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {meta && meta.totalPages > 1 ? (
                <div className="mt-6 flex items-center justify-center gap-3">
                  <Button variant="outline" size="sm" disabled={query.page <= 1} onClick={() => patch({ page: query.page - 1 })}>Previous</Button>
                  <span className="text-sm text-muted-foreground">Page {meta.page} of {meta.totalPages}</span>
                  <Button variant="outline" size="sm" disabled={query.page >= meta.totalPages} onClick={() => patch({ page: query.page + 1 })}>Next</Button>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
