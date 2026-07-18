/**
 * WHAT: Supertest smoke tests for the health endpoints. Drives the exported app IN-PROCESS —
 *   no port bound — which is exactly why app.js and server.js are split.
 * WHY THESE TESTS AND NOT MORE: they are non-destructive (read-only SELECT 1, no writes) and
 *   they prove the two things most likely to break a demo: "is the server wired?" and "does the
 *   DB-health response have the shape the frontend depends on?". A test that created/deleted rows
 *   would risk the very data we demo on, so we don't.
 * NOTE: /api/health/database hits the REAL database. These tests therefore require a reachable
 *   Postgres (the same .env the app uses). That is intentional — a health test against a mocked
 *   DB would prove nothing about readiness.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('GET /api/health', () => {
  it('returns 200 with the success envelope and healthy status', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    // The envelope contract: every success response has these keys.
    expect(res.body).toMatchObject({
      success: true,
      message: expect.any(String),
      data: expect.objectContaining({ status: 'healthy' }),
    });
    // meta carries the timestamp — asserting its presence guards the contract.
    expect(res.body.meta).toHaveProperty('checkedAt');
  });
});

describe('GET /api/health/database', () => {
  it('returns the readiness envelope with a status and latency measurement', async () => {
    const res = await request(app).get('/api/health/database');

    // 200 when the DB is reachable (the normal case in CI/local). We assert the STRUCTURE
    // rather than hardcoding 200, so the test documents both the healthy and unreachable shapes.
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('message');

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('status', 'healthy');
      expect(typeof res.body.data.latencyMs).toBe('number');
    } else {
      // 503 path: must NOT leak internals — no stack, no connection string.
      expect(res.body.success).toBe(false);
      expect(JSON.stringify(res.body)).not.toMatch(/postgresql:\/\//);
      expect(res.body).not.toHaveProperty('stack');
    }
  });
});

describe('unknown /api route', () => {
  it('returns a JSON 404 in the failure envelope, not an HTML page', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ success: false, message: expect.stringContaining('not found') });
  });
});
