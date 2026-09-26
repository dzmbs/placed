import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IDKitResult } from '@worldcoin/idkit-core';
import {
  minimumAdvertisingBid,
  splitAdvertisingPayment,
  usdcAmount,
  worldSignalHash,
} from '../src/lib/marketplace/math';
import { validateWorldResult } from '../src/lib/marketplace/world-policy';
import { restoreMarketplaceDraft } from '../src/lib/marketplace/drafts';
import { initialDraft } from '../src/lib/studio';
import { compareSponsorshipPhotos } from '../src/lib/marketplace/proof-matching';
import { encodeTrade, routerAbi } from '../src/lib/marketplace/uniswap';
import { decodeFunctionData, decodeAbiParameters, parseAbiParameters } from 'viem';

test('USDC bids use integer precision and round increases upwards', () => {
  assert.equal(minimumAdvertisingBid(0n, 1000), 1_000_000n);
  assert.equal(minimumAdvertisingBid(1_000_001n, 1000), 1_100_002n);
  assert.equal(minimumAdvertisingBid(1_000_000n, 0), 1_000_001n);
  assert.equal(usdcAmount('1.000001'), 1_000_001n);
  for (const input of ['1e6', '-1', '0.0000001', '1.0foo']) assert.throws(() => usdcAmount(input));
});
test('marketplace drafts retain generated models and reject external model references', () => {
  const draft = {
    ...initialDraft(),
    asset: 'custom',
    assetUrl: `http://127.0.0.1:3000/api/marketplace/media/0x${'ab'.repeat(32)}`,
  };
  assert.equal(
    restoreMarketplaceDraft(JSON.parse(JSON.stringify(draft)), 'http://127.0.0.1:3000')?.assetUrl,
    draft.assetUrl,
  );
  assert.equal(
    restoreMarketplaceDraft(
      { ...draft, assetUrl: 'https://untrusted.example/model.glb' },
      'http://127.0.0.1:3000',
    ),
    null,
  );
});

test('proof matching fails closed on refusal, incomplete output and malformed results', async () => {
  const original = globalThis.fetch;
  const image = { data: new Uint8Array([1, 2, 3]), type: 'image/png' };
  try {
    for (const response of [
      new Response('{}', { status: 503 }),
      Response.json({ status: 'incomplete' }),
      Response.json({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal' }] }],
      }),
      Response.json({
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: '{"outcome":"match"}' }] },
        ],
      }),
    ]) {
      globalThis.fetch = async () => response;
      assert.equal(
        (await compareSponsorshipPhotos(image, image, 'Front of shirt', 'test-key')).outcome,
        'inconclusive',
      );
    }
    globalThis.fetch = async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.store, false);
      assert.equal(request.text.format.strict, true);
      assert.equal(
        request.input[0].content.filter((item: { type: string }) => item.type === 'input_image')
          .length,
        2,
      );
      return Response.json({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({ outcome: 'no-match', explanation: 'The logo differs.' }),
              },
            ],
          },
        ],
      });
    };
    assert.deepEqual(await compareSponsorshipPhotos(image, image, 'Front of shirt', 'test-key'), {
      outcome: 'no-match',
      explanation: 'The logo differs.',
    });
  } finally {
    globalThis.fetch = original;
  }
});
test('v4 swap calldata preserves the quoted minimum, input cap and deadline', () => {
  const input = '0x0000000000000000000000000000000000000001' as const,
    output = '0x0000000000000000000000000000000000000002' as const;
  const encoded = encodeTrade({
    assetId: '1',
    inputToken: input,
    outputToken: output,
    amountIn: '1000000',
    amountOut: '1000',
    minimumOut: '995',
    deadline: 2000,
    poolKey: {
      currency0: input,
      currency1: output,
      fee: 3000,
      tickSpacing: 60,
      hooks: '0x0000000000000000000000000000000000000000',
    },
    zeroForOne: true,
    feePips: 3000,
    priceImpactBps: 10,
    gasEstimate: '100000',
  });
  const decoded = decodeFunctionData({ abi: routerAbi, data: encoded });
  assert.equal(decoded.args[0], '0x10');
  assert.equal(decoded.args[2], 2000n);
  const [actions, params] = decodeAbiParameters(
    parseAbiParameters('bytes,bytes[]'),
    decoded.args[1][0],
  );
  assert.equal(actions, '0x060c0f');
  const [swap] = decodeAbiParameters(
    parseAbiParameters(
      '((address currency0,address currency1,uint24 fee,int24 tickSpacing,address hooks) poolKey,bool zeroForOne,uint128 amountIn,uint128 amountOutMinimum,bytes hookData)',
    ),
    params[0],
  );
  assert.equal(swap.amountOutMinimum, 995n);
  assert.equal(swap.amountIn, 1_000_000n);
  assert.deepEqual(decodeAbiParameters(parseAbiParameters('address,uint256'), params[1]), [
    input,
    1_000_000n,
  ]);
  assert.deepEqual(decodeAbiParameters(parseAbiParameters('address,uint256'), params[2]), [
    output,
    995n,
  ]);
});
test('creator, investor and escrow balances sum to the accepted bid', () => {
  assert.deepEqual(splitAdvertisingPayment(1_000_000_000n, 6000, 5000), {
    creator: 200_000_000n,
    vault: 200_000_000n,
    held: 600_000_000n,
  });
  assert.deepEqual(splitAdvertisingPayment(1_000_000n, 6000, 0), {
    creator: 400_000n,
    vault: 0n,
    held: 600_000n,
  });
  for (let i = 1; i < 1000; i++) {
    const amount = BigInt(i * 7919);
    const split = splitAdvertisingPayment(amount, i % 10001, (i * 17) % 10001);
    assert.equal(split.creator + split.vault + split.held, amount);
  }
});
test('World signal hashing matches the official empty-string vector', () => {
  assert.equal(
    worldSignalHash(''),
    '0x00c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a4',
  );
});
test('World authorization rejects wallet, action, nonce, environment and credential substitutions', () => {
  const expected = {
    nonce: 'request-1',
    signal: 'placed:wallet:nonce',
    action: 'placed-participant',
    environment: 'staging',
    expires: 2000,
  };
  const valid: IDKitResult = {
    protocol_version: '4.0',
    nonce: expected.nonce,
    action: expected.action,
    environment: expected.environment,
    responses: [
      {
        identifier: 'proof_of_human',
        issuer_schema_id: 1,
        expires_at_min: 2000,
        signal_hash: worldSignalHash(expected.signal),
        nullifier: '0x0a',
        proof: ['0x1', '0x2', '0x3', '0x4', '0x5'],
      },
    ],
  };
  assert.equal(validateWorldResult(valid, expected, 1000), '10');
  for (const change of [
    { nonce: 'other' },
    { action: 'other' },
    { environment: 'production' },
    { protocol_version: '3.0' },
  ])
    assert.throws(() =>
      validateWorldResult({ ...valid, ...change } as IDKitResult, expected, 1000),
    );
  assert.throws(() => validateWorldResult(valid, { ...expected, signal: 'another-wallet' }, 1000));
  assert.throws(() => validateWorldResult(valid, expected, 2001));
  const badCredential = {
    ...valid,
    responses: [{ ...valid.responses[0], identifier: 'passport', issuer_schema_id: 9303 }],
  } as IDKitResult;
  assert.throws(() => validateWorldResult(badCredential, expected, 1000));
});
