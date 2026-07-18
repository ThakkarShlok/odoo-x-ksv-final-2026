/**
 * WHAT: Resolve the pricelist that should price a given operation. One helper so pricing,
 *   availability, and admin rate-editing all agree on the SAME list instead of each re-deriving it.
 * RESOLUTION ORDER: the explicit default (guarded to at most one by pricelists_one_default in
 *   migration 004) → else the oldest still-active list → else null. Returning null (not throwing)
 *   lets each caller decide the right failure: a customer checkout returns a clean 422, an admin
 *   rate edit can offer to create a list. Mirrors catalog.controller's original inline logic,
 *   promoted to a shared function now that three call sites need it.
 */
import { prisma } from '../config/prisma.js';

export async function resolveDefaultPricelistId(client = prisma) {
  const pl =
    (await client.pricelist.findFirst({ where: { isDefault: true }, select: { id: true } })) ??
    (await client.pricelist.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    }));
  return pl?.id ?? null;
}
