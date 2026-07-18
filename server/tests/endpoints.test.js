import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';
import { signToken } from '../src/lib/jwt.js';

// Mock the prisma instance
vi.mock('../src/config/prisma.js', () => {
  return {
    prisma: {
      user: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        delete: vi.fn(),
      },
      address: {
        create: vi.fn(),
        update: vi.fn(),
      },
      category: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      productUnit: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      product: {
        findFirst: vi.fn(),
        create: vi.fn(),
        findMany: vi.fn(),
      },
      rentalSettings: {
        findFirst: vi.fn(),
      },
      pricelist: {
        findFirst: vi.fn(),
      },
      pricelistItem: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      rentalOrder: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      rentalOrderLine: {
        create: vi.fn(),
      },
      reservation: {
        updateMany: vi.fn(),
      },
      payment: {
        create: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
      },
      depositLedger: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
      },
      lateFee: {
        create: vi.fn(),
      },
      invoice: {
        create: vi.fn(),
      },
      rentalEvent: {
        create: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      activityLog: {
        create: vi.fn(),
      },
      notification: {
        findMany: vi.fn(),
        count: vi.fn(),
        updateMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn((cb) => cb(prisma)),
      $executeRawUnsafe: vi.fn(),
    },
  };
});

const app = createApp();

const customerUser = {
  id: 'e6a256d0-e17f-442b-9c7b-7b24eb6b81a2',
  email: 'customer@zenith.dev',
  role: 'CUSTOMER',
  name: 'Jane Doe',
};

const adminUser = {
  id: '7b24eb6b-81a2-442b-9c7b-e6a256d0e17f',
  email: 'admin@zenith.dev',
  role: 'ADMIN',
  name: 'Ada Admin',
};

const agentUser = {
  id: 'f5b256d0-e17f-442b-9c7b-7b24eb6b81a3',
  email: 'agent@zenith.dev',
  role: 'FIELD_AGENT',
  name: 'John Agent',
};

// Standard compliant v4 UUID strings for inputs to satisfy validations
const orderUuid = 'd9c856d0-e17f-442b-9c7b-7b24eb6b83c2';
const assetUuid = 'b4a356d0-e17f-442b-9c7b-7b24eb6b82b1';
const categoryUuid = 'b8a156d0-e17f-442b-9c7b-7b24eb6b81a4';

const customerToken = signToken(customerUser);
const adminToken = signToken(adminUser);
const agentToken = signToken(agentUser);

describe('REST API Endpoints Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/v1/users/profile', () => {
    it('returns 200 with profile data for authenticated user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: customerUser.id,
        email: customerUser.email,
        name: customerUser.name,
        phone: '+15551234567',
        role: 'CUSTOMER',
        createdAt: new Date(),
        updatedAt: new Date(),
        addresses: [
          { line1: '123 Main St', isDefault: true },
        ],
      });

      const res = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toBe(customerUser.email);
    });
  });

  describe('POST /api/v1/products', () => {
    it('creates a new category when called by admin', async () => {
      prisma.category.findFirst.mockResolvedValue(null);
      prisma.category.create.mockResolvedValue({
        id: categoryUuid,
        name: 'Cargo E-Bike',
        slug: 'cargo-e-bike',
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cargo E-Bike',
          depositMethod: 'FIXED',
          depositValue: 200.00,
          baseHourlyRate: 15.00,
          baseDailyRate: 60.00,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Cargo E-Bike');
    });
  });

  describe('GET /api/v1/inventory', () => {
    it('allows admins and agents to list physical asset units', async () => {
      prisma.productUnit.findMany.mockResolvedValue([
        {
          id: assetUuid,
          serialNumber: 'BIKE-001',
          status: 'AVAILABLE',
          product: {
            brand: 'Specialized',
            categoryId: categoryUuid,
            category: { name: 'E-Bikes' },
          },
        },
      ]);
      prisma.productUnit.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data[0].barcode).toBe('BIKE-001');
    });

    it('rejects listing requests from customer roles', async () => {
      const res = await request(app)
        .get('/api/v1/inventory')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/rentals', () => {
    it('assembles a draft quotation booking', async () => {
      prisma.rentalSettings.findFirst.mockResolvedValue({
        depositRuleType: 'PERCENTAGE',
        depositValue: 20.00,
      });
      prisma.pricelist.findFirst.mockResolvedValue({
        id: 'pl-1',
      });
      prisma.productUnit.findUnique.mockResolvedValue({
        id: assetUuid,
        productId: 'prod-1',
        serialNumber: 'BIKE-001',
        status: 'AVAILABLE',
        product: { brand: 'Specialized' },
      });
      prisma.pricelistItem.findFirst.mockResolvedValue({
        rate: 50.00,
      });
      prisma.rentalOrder.create.mockResolvedValue({
        id: orderUuid,
        orderNumber: 'RO-2026-001',
        customerId: customerUser.id,
        status: 'QUOTATION',
        fulfillmentMethod: 'STORE_PICKUP',
        rentalStart: new Date(),
        rentalEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        total: 100.00,
        depositTotal: 20.00,
        createdAt: new Date(),
      });

      const res = await request(app)
        .post('/api/v1/rentals')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          rentalStart: new Date().toISOString(),
          rentalEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          fulfillmentMethod: 'STORE_PICKUP',
          items: [{ assetId: assetUuid }],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('QUOTATION');
      expect(res.body.data.totalBaseCost).toBe('100');
    });
  });

  describe('POST /api/v1/payments/authorize', () => {
    it('charges payment methods and updates status to CONFIRMED', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue({
        id: orderUuid,
        orderNumber: 'RO-2026-001',
        status: 'QUOTATION',
        total: 100.00,
        depositTotal: 20.00,
      });
      prisma.payment.create.mockResolvedValue({
        id: 'pay-1',
        amount: 120.00,
        purpose: 'RENTAL',
        status: 'AUTHORIZED',
        reference: 'ch_test123',
      });

      const res = await request(app)
        .post('/api/v1/payments/authorize')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          orderId: orderUuid,
          paymentMethodToken: 'tok_visa',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.gatewayStatus).toBe('succeeded');
      expect(res.body.data.orderStatus).toBe('AUTHORIZED');
    });
  });

  describe('POST /api/v1/deposits/:id/reconcile', () => {
    it('blocks deposit settlement if return inspection checksheets are pending', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue({
        id: orderUuid,
        depositTotal: 20.00,
        events: [
          { eventType: 'RETURN', actualAt: null }, // ActualAt null means inspection not signed off!
        ],
        depositLedger: [],
      });

      const res = await request(app)
        .post(`/api/v1/deposits/${orderUuid}/reconcile`)
        .set('Authorization', `Bearer ${agentToken}`);

      expect(res.status).toBe(400); // safety gate violation returns bad request
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/v1/inspections', () => {
    it('submits inspection checklists and diverts status to DAMAGED if flagged', async () => {
      prisma.rentalOrder.findUnique.mockResolvedValue({
        id: orderUuid,
        rentalEnd: new Date(),
      });
      prisma.productUnit.findUnique.mockResolvedValue({
        id: assetUuid,
        serialNumber: 'BIKE-001',
      });
      prisma.rentalEvent.findFirst.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/inspections')
        .set('Authorization', `Bearer ${agentToken}`)
        .send({
          orderId: orderUuid,
          assetId: assetUuid,
          physicalCondition: 'DAMAGED',
          accessoriesComplete: true,
          damageLogged: true,
          damageNotes: 'Bent frame',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.damageLogged).toBe(true);
    });
  });

  describe('GET /api/v1/reports/dashboard', () => {
    it('allows admin to query Operations Dashboard analytical summaries', async () => {
      prisma.rentalOrder.count.mockResolvedValue(5);
      prisma.rentalOrder.findMany.mockResolvedValue([
        { total: 500.00 },
      ]);
      prisma.depositLedger.findMany.mockResolvedValue([
        { entryType: 'HELD', amount: 200.00 },
        { entryType: 'DEDUCTED', amount: 50.00 },
      ]);

      const res = await request(app)
        .get('/api/v1/reports/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.volumes.activeRentals).toBe(5);
      expect(res.body.data.financials.grossRevenue).toBe('500.00');
      expect(res.body.data.financials.securityDepositsHeld).toBe('150.00');
    });
  });
});
