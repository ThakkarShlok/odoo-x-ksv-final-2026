import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from '../src/modules/notifications/notification.service.js';
import { prisma } from '../src/config/prisma.js';
import { mailService } from '../src/modules/notifications/mail.service.js';

// Mock the prisma instance
vi.mock('../src/config/prisma.js', () => {
  return {
    prisma: {
      user: {
        findMany: vi.fn(),
      },
      notification: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    },
  };
});

// Mock mailService
vi.mock('../src/modules/notifications/mail.service.js', () => {
  return {
    mailService: {
      sendOrderNotificationEmail: vi.fn().mockResolvedValue({}),
    },
  };
});

describe('notificationService.notifyOrderPartiesOnce', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggers email notification when no notification exists yet', async () => {
    const order = {
      id: 'order-123',
      orderNumber: 'RO-2026-001',
      customerId: 'customer-123',
    };

    // Mock prisma.user.findMany to return admins
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', role: 'ADMIN' },
      { id: 'customer-123', role: 'CUSTOMER' },
    ]);

    // Mock prisma.notification.findFirst to return null (no existing notification)
    prisma.notification.findFirst.mockResolvedValue(null);
    prisma.notification.create.mockResolvedValue({});

    await notificationService.notifyOrderPartiesOnce({
      order,
      type: 'PICKUP_DUE_TOMORROW',
      message: 'Order Tomorrow',
    });

    // Wait for the async task queue to clear so setTimeout(..., 0) runs
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify email was triggered
    expect(mailService.sendOrderNotificationEmail).toHaveBeenCalledWith('order-123', 'PICKUP_DUE_TOMORROW');
  });

  it('does NOT trigger email notification when notification already exists', async () => {
    const order = {
      id: 'order-123',
      orderNumber: 'RO-2026-001',
      customerId: 'customer-123',
    };

    // Mock prisma.user.findMany to return admins
    prisma.user.findMany.mockResolvedValue([
      { id: 'admin-1', role: 'ADMIN' },
      { id: 'customer-123', role: 'CUSTOMER' },
    ]);

    // Mock prisma.notification.findFirst to return an existing notification record
    prisma.notification.findFirst.mockResolvedValue({
      id: 'notif-123',
      userId: 'customer-123',
      type: 'PICKUP_DUE_TOMORROW',
      entityRef: 'order:order-123',
    });

    await notificationService.notifyOrderPartiesOnce({
      order,
      type: 'PICKUP_DUE_TOMORROW',
      message: 'Order Tomorrow',
    });

    // Wait for the async task queue to clear
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify email was NOT triggered
    expect(mailService.sendOrderNotificationEmail).not.toHaveBeenCalled();
  });
});
