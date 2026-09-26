import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDKitResult } from '@worldcoin/idkit-core';
import {
  requireWorldStagingToken,
  verifyWorldProof,
  WorldVerifierError,
} from '../src/lib/marketplace/world-verifier';

test('World staging credentials stay server-side and are never attached to production calls', async () => {
  const original = globalThis.fetch;
  try {
    for (const environment of ['staging', 'production']) {
      const result = {
        protocol_version: '4.0',
        nonce: 'request',
        action: 'placed-participant',
        environment,
        responses: [],
      } as IDKitResult;
      globalThis.fetch = async (url, init) => {
        assert.equal(url, 'https://developer.world.org/api/v4/verify/rp_test');
        assert.equal(init?.body, JSON.stringify(result));
        assert.equal(
          new Headers(init?.headers).get('x-staging-verification-token'),
          environment === 'staging' ? 'server-token' : null,
        );
        return Response.json({ success: true, environment });
      };
      await verifyWorldProof(result, 'rp_test', environment, 'server-token');
    }
  } finally {
    globalThis.fetch = original;
  }
});

test('World missing or expired staging access cannot authorize a participant', async () => {
  assert.throws(() => requireWorldStagingToken('staging'), {
    code: 'staging_token_missing',
    status: 503,
  });
  assert.doesNotThrow(() => requireWorldStagingToken('production'));
  const original = globalThis.fetch;
  const result = {
    protocol_version: '4.0',
    nonce: 'request',
    action: 'placed-participant',
    environment: 'staging',
    responses: [],
  } as IDKitResult;
  try {
    for (const [body, status, expected] of [
      [{ code: 'environment_not_allowed' }, 403, 503],
      [{ success: true, environment: 'production' }, 200, 401],
      [{ success: false, environment: 'staging' }, 200, 401],
      [{ code: 'sensitive upstream detail' }, 400, 401],
    ] as const) {
      globalThis.fetch = async () => Response.json(body, { status });
      await assert.rejects(
        verifyWorldProof(result, 'rp_test', 'staging', 'server-token'),
        (error) => {
          assert.ok(error instanceof WorldVerifierError);
          assert.equal(error.status, expected);
          assert.ok(!error.message.includes('sensitive upstream detail'));
          assert.ok(!error.message.includes('server-token'));
          return true;
        },
      );
    }
  } finally {
    globalThis.fetch = original;
  }
});
