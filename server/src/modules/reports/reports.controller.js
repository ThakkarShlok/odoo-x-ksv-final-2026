import { prisma } from '../../config/prisma.js';
import { ok, fail } from '../../lib/apiResponse.js';

export async function getDashboardKpi(req, res) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  // Operational Volumes queries
  const [
    activeRentals,
    rentalsDueToday,
    upcomingPickups,
    upcomingReturns,
    overdueRentals,
  ] = await Promise.all([
    // Active rentals in active pickup state
    prisma.rentalOrder.count({ where: { status: 'IN_RENTAL' } }),

    // Rentals due today
    prisma.rentalOrder.count({
      where: {
        status: 'IN_RENTAL',
        rentalEnd: { gte: startOfToday, lte: endOfToday },
      },
    }),

    // Upcoming pickups
    prisma.rentalOrder.count({
      where: {
        status: 'CONFIRMED',
        rentalStart: { gt: new Date() },
      },
    }),

    // Upcoming returns
    prisma.rentalOrder.count({
      where: {
        status: 'IN_RENTAL',
        rentalEnd: { gt: new Date() },
      },
    }),

    // Overdue rentals
    prisma.rentalOrder.count({
      where: {
        status: 'IN_RENTAL',
        rentalEnd: { lt: new Date() },
      },
    }),
  ]);

  // Financial aggregates queries
  const completedOrders = await prisma.rentalOrder.findMany({
    where: {
      status: { in: ['CONFIRMED', 'IN_RENTAL', 'RETURNED', 'CLOSED'] },
    },
    select: { total: true },
  });

  const grossRevenue = completedOrders.reduce((acc, o) => acc + parseFloat(o.total), 0);

  // Deposit ledger balance
  const ledger = await prisma.depositLedger.findMany({
    select: { entryType: true, amount: true },
  });

  let securityDepositsHeld = 0;
  let lateFeesCollected = 0;

  for (const entry of ledger) {
    const amt = parseFloat(entry.amount);
    if (entry.entryType === 'HELD') {
      securityDepositsHeld += amt;
    } else if (entry.entryType === 'DEDUCTED') {
      securityDepositsHeld -= amt;
      lateFeesCollected += amt;
    } else if (entry.entryType === 'REFUNDED') {
      securityDepositsHeld -= amt;
    }
  }

  // Fallback to absolute positive values
  securityDepositsHeld = Math.max(0, securityDepositsHeld);

  return ok(res, {
    data: {
      volumes: {
        activeRentals,
        rentalsDueToday,
        upcomingPickups,
        upcomingReturns,
        overdueRentals,
      },
      financials: {
        grossRevenue: grossRevenue.toFixed(2),
        securityDepositsHeld: securityDepositsHeld.toFixed(2),
        lateFeesCollected: lateFeesCollected.toFixed(2),
      },
    },
  });
}

export async function getForecasts(req, res) {
  const categories = await prisma.category.findMany({
    include: {
      products: {
        include: {
          units: true,
        },
      },
    },
  });

  const responseData = categories.map((cat) => {
    let totalStock = 0;
    let usableStock = 0;

    for (const prod of cat.products) {
      for (const unit of prod.units) {
        totalStock++;
        if (unit.status !== 'DAMAGED' && unit.status !== 'RETIRED') {
          usableStock++;
        }
      }
    }

    const projectedDemand30Days = Math.ceil(totalStock * 1.25);
    const projectedShortfall = Math.max(0, projectedDemand30Days - usableStock);

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      totalStock,
      usableStock,
      projectedDemand30Days,
      projectedShortfall,
      warningFlag: projectedShortfall > 0,
    };
  });

  return ok(res, { data: responseData });
}
